import { createVoiceEngine } from "./engines/voice-engine.mjs";
import { loadElevenLabsApiKey } from "../ears/elevenlabs-stt.mjs";

/** 声の警告の detail に載せる理由の上限（字数・cockpit-server 側でも切る）。 */
const VOICE_REASON_MAX_CHARS = 80;

/**
 * ElevenLabs の声の engine の診断（onDiagnostic）から、警告の detail に載せる短い理由を作る
 * （声の差し替え Wave 3 仕上げ・STT の `closed code=1006` と同じ流儀）。engine の reason は決まった語彙・close code・
 * サーバーの error の識別子だけ（キー・本文は入らない・D がテストで固定）だが、ここでも制御文字を除き長さを切る。
 * message は使わない。
 *
 * @param {unknown} diagnostic
 * @returns {string | null | undefined}  理由（string）・繋がったので消す（null）・理由に関係しない診断（undefined）。
 */
export function voiceDiagnosticReason(diagnostic) {
  if (!diagnostic || typeof diagnostic !== "object") return undefined;
  const d = /** @type {{ type?: unknown; reason?: unknown }} */ (diagnostic);
  const raw = typeof d.reason === "string" ? d.reason.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() : "";
  /** @param {string} text */
  const clip = (text) => (text.length > VOICE_REASON_MAX_CHARS ? `${text.slice(0, VOICE_REASON_MAX_CHARS - 1)}…` : text);
  switch (d.type) {
    case "ttsDisconnected":
      return clip(`closed ${raw || "code=?"}`);
    case "ttsConnectFailed":
      return clip(`接続できない（${raw || "?"}）`);
    case "ttsServerError":
      return clip(`サーバーのエラー（${raw || "unknown"}）`);
    case "ttsConnected":
    case "ttsReconnected":
      return null;
    default:
      return undefined;
  }
}

/**
 * 声の engine の持ち主（声の差し替え Wave 3 Domain E・voice-swap-wave-plan.md §3「D と E の接点」・Wave 2 申し送り 2）。
 * 耳の Start で `prepare(kind)` を呼ぶ。種類が前回と同じなら使い回し、違えば古い engine を dispose して
 * `createVoiceEngine(kind, deps)` で作り直す。ただし ElevenLabs で status が `down` の engine は、種類が同じでも
 * dispose して作り直す（キーを読み直す。無効なキーを直して Stop → Start したときに古いキーで繋ぎ直し続けないように）。
 * ElevenLabs は作るときに `loadElevenLabsApiKey()` を読み、`apiKey` として渡す（process.env に入れない・キーは状態にも
 * ログにも出さない）。engine の status は `onStatus` へ流す（今の engine の分だけ・作り直した古い engine の通知は捨てる）。
 *
 * ElevenLabs の engine には deps の `onDiagnostic` を渡し、切断・接続失敗・サーバーのエラーの理由を覚えておく
 * （{@link voiceDiagnosticReason}・短い理由だけ。キーも会話の本文も入らない）。`reconnecting` / `down` を知らせる
 * ときはその理由を `reason` に載せる（`tts-reconnecting` / `tts-down` の警告の detail・STT と同じ流儀）。繋がれば消す。
 *
 * 失敗（キーが無い・工場が投げた）は `{ ok:false, reason }` を返し、engine は持たない（自動で AivisSpeech に戻さない）。
 * Start より前の Fire は `ensure(kind)` で同じ道を通り、失敗は reason の Error を投げる。
 *
 * @param {object} [options]
 * @param {(kind: string, deps: any) => any} [options.createEngine=createVoiceEngine]  工場関数（テストは偽物）。
 * @param {() => ({ ok: true; apiKey: string } | { ok: false; reason: string })} [options.loadApiKey=loadElevenLabsApiKey]
 * @param {() => object} [options.aivisDeps]  AivisSpeech の deps（ttsBaseUrl / speaker）。
 * @param {() => object} [options.elevenLabsDeps]  ElevenLabs の追加 deps（readingClient など・apiKey と onReadingsFallback と onDiagnostic はここで足す）。
 * @param {(info: { engine: string; status: string; reason: string | null }) => void} [options.onStatus]
 * @param {(info?: unknown) => void} [options.onReadingsFallback]  読みが取れず簡易版の口になったとき。
 * @param {() => string} [options.voiceKey]  声の中身（話者・声の id）の鍵（配信の組み直し Domain A）。種類が同じでも
 *   鍵が engine を作ったときと違えば作り直す（ロールを替えて声が替わったとき）。既定は常に同じ鍵。
 */
export function createVoiceEngineManager(options = {}) {
  const createEngine = options.createEngine ?? createVoiceEngine;
  const loadApiKey = options.loadApiKey ?? (() => loadElevenLabsApiKey());
  const aivisDeps = options.aivisDeps ?? (() => ({}));
  const elevenLabsDeps = options.elevenLabsDeps ?? (() => ({}));
  const onStatus = typeof options.onStatus === "function" ? options.onStatus : () => {};
  const onReadingsFallback = typeof options.onReadingsFallback === "function" ? options.onReadingsFallback : () => {};
  const voiceKey = typeof options.voiceKey === "function" ? options.voiceKey : () => "";
  /** @type {any} */
  let engine = null;
  /** @type {string | null} */
  let engineKind = null;
  /** 今の engine を作ったときの声の鍵。 @type {string | null} */
  let engineKey = null;
  /** @type {(() => void) | null} */
  let statusOff = null;
  /** 今の engine の診断の受け口（作り直したら古い engine の診断は捨てる）。 @type {{ live: boolean; reason: string | null } | null} */
  let diagSlot = null;

  const report = (/** @type {string} */ kind, /** @type {string} */ status, /** @type {string | null} */ reason) => {
    try {
      onStatus({ engine: kind, status, reason });
    } catch {
      // 通知先の失敗で声を止めない。
    }
  };

  const drop = () => {
    const old = engine;
    if (statusOff) {
      try {
        statusOff();
      } catch {
        // best-effort
      }
    }
    statusOff = null;
    if (diagSlot) diagSlot.live = false;
    diagSlot = null;
    engine = null;
    engineKind = null;
    engineKey = null;
    if (old) {
      try {
        old.dispose();
      } catch {
        // best-effort（古い engine は使わない）。
      }
    }
  };

  /**
   * @param {string} kind
   * @returns {{ ok: true } | { ok: false; reason: string }}
   */
  const prepare = (kind) => {
    const key = voiceKey();
    if (engine != null && engineKind === kind && engineKey === key) {
      // 落ちた ElevenLabs の engine は使い回さない（下で dispose し、キーを読み直して作り直す）。
      if (!(kind === "elevenlabs" && engine.status === "down")) return { ok: true };
    }
    drop();
    /** @type {{ live: boolean; reason: string | null }} */
    const slot = { live: true, reason: null };
    /** reconnecting / down のときだけ覚えた理由を載せる（それ以外は null）。 @param {string} status */
    const reasonFor = (status) => (status === "reconnecting" || status === "down" ? slot.reason : null);
    /** @type {any} */
    let made = null;
    /** @type {any} */
    let deps;
    if (kind === "elevenlabs") {
      /** @type {any} */
      let key;
      try {
        key = loadApiKey();
      } catch {
        key = { ok: false };
      }
      if (!key || key.ok !== true || typeof key.apiKey !== "string" || key.apiKey.length === 0) {
        const reason = (key && typeof key.reason === "string" && key.reason) || "ElevenLabs のキーが見つからない";
        report(kind, "down", reason);
        return { ok: false, reason };
      }
      deps = {
        ...elevenLabsDeps(),
        apiKey: key.apiKey,
        onReadingsFallback: (/** @type {unknown} */ info) => {
          try {
            onReadingsFallback(info);
          } catch {
            // 警告の失敗で声を止めない。
          }
        },
        // 切断などの理由を覚え、reconnecting / down の通知に載せる（engine は診断を出してから status を変える）。
        onDiagnostic: (/** @type {unknown} */ diagnostic) => {
          if (!slot.live) return;
          const next = voiceDiagnosticReason(diagnostic);
          if (next === undefined) return;
          slot.reason = next;
          // 状態はそのままで理由だけ変わったとき（繋ぎ直しの失敗が続くなど）も知らせ直す。
          if (made != null && engine === made && typeof made.status === "string" && reasonFor(made.status) !== null) {
            report(kind, made.status, reasonFor(made.status));
          }
        }
      };
    } else {
      deps = { ...aivisDeps() };
    }
    try {
      made = createEngine(kind, deps);
    } catch (error) {
      slot.live = false;
      // 工場のエラー文言（キーは含まない）だけを理由にする。
      const reason = `声の engine を作れない（${kind}: ${error instanceof Error ? error.message : String(error)}）`;
      report(kind, "down", reason);
      return { ok: false, reason };
    }
    engine = made;
    engineKind = kind;
    engineKey = key;
    diagSlot = slot;
    if (made && typeof made.onStatus === "function") {
      statusOff = made.onStatus((/** @type {string} */ status) => {
        if (engine === made) report(kind, status, reasonFor(status));
      });
    }
    const initial = made && typeof made.status === "string" ? made.status : "unknown";
    report(kind, initial, reasonFor(initial));
    return { ok: true };
  };

  return {
    prepare,
    /**
     * Start より前の Fire 用: 今の engine を返す（無ければ kind で作る）。用意できなければ理由の Error を投げる。
     * 声の鍵が作ったときと違えば（ロールを替えて声が替わった）作り直す。
     * @param {string} kind
     */
    ensure(kind) {
      if (engine != null && engineKey === voiceKey()) return engine;
      const result = prepare(kind);
      if (!result.ok) throw new Error(result.reason);
      return engine;
    },
    /** 今の engine（無ければ null）。 */
    current: () => engine,
    /** 今の engine の種類（無ければ null）。 */
    currentKind: () => engineKind,
    /** 畳む（終了時）。 */
    dispose: drop
  };
}
