// @ts-check
/**
 * 発火オーケストレータ（S3 Domain A・魂の胴体）— apps/soul/agent。
 *
 * Fire（操縦席のボタン / POST /api/fire / AHK）1 発を受け、会話ログの直近窓を LLM セッションへ注入し、
 * 返ってきた一言を speak（口 + 声）で発話し、その発話を会話ログへ speaker:"soul" で追記する。
 * 「AI は全部聞くが、全部では考えない」——聞くのは耳（常時）、考えるのは Fire のとき（ここ）。
 *
 *   fire() → getBuffer() → formatFireInjection(直近窓) → session.ask(注入文) → speak(応答) →
 *            buffer.append(soul) → idle へ。
 *
 * ── 何を作らない / 変えない ────────────────────────────────────────────────
 *  session（createLlmSession の返り）・speak・channel・player・転写バッファは**受け取るだけ**。
 *  ここで作らず・変えない（S1/S2 の器官はそのまま結線する）。所有権は呼び出し側（本番結線 = Domain B）。
 *
 * ── busy 状態機械（wave 計画 §2 裁定 5）───────────────────────────────────────
 *  idle →(fire)→ thinking →(応答)→ speaking →(発話完了)→ idle。**state≠idle の間の fire は無視**
 *  （重ね発火・割り込みは S4/S6 の領分）。state 遷移ごとに onState(state) を通知（操縦席の busy 表示）。
 *  finally で必ず idle へ戻す（ask/speak が throw してもサーバを殺さない・状態を詰まらせない）。
 *
 * ── 失敗の握り ──────────────────────────────────────────────────────────────
 *  ask/speak の throw は onDiagnostic({type:"fireError", message}) に落とし、{fired:false, reason:"error"}
 *  を返す（例外を上へ投げず常駐を続ける）。応答が空なら ask は撃ったが発話せず idle へ戻す
 *  （fireEmptyReply 診断）。空窓は ask を撃つ前に empty-window で返す（無駄撃ち回避）。
 *
 * ── soul 記録の broadcast 経路 ───────────────────────────────────────────────
 *  soul の発話行は pipeline の onTranscript を通らない（耳の転写経路ではないから）。よって soul を
 *  buffer.append した直後に onSoulTranscript(entry) フックで結線層（cockpit）へ通知し、cockpit が
 *  既存 transcript イベント（speaker:"soul"）として SSE broadcast する（domain-a.md ワイヤ契約 §）。
 */

import { speak as defaultSpeak } from "../voice/speak.mjs";
import { formatFireInjection, FIRE_WINDOW_MS, FIRE_MAX_CHARS } from "./fire-injection.mjs";

/**
 * 最小仮面（v0）の発火用システムプロンプト（wave 計画 §2 裁定 4）。
 * **意図的に貧しく**——凝るのは persona の領分。本番結線（Domain B）が createLlmSession に渡す想定
 * （orchestrator 自身は session を受け取るだけ）。
 */
export const FIRE_SYSTEM_PROMPT =
  "あなたは配信の相方です。直前の会話を踏まえ、短く自然な日本語で一言だけ返してください。" +
  "箇条書き・記号・長い説明はしないでください。";

/**
 * @typedef {"idle" | "thinking" | "speaking"} FireState
 */

/**
 * 発火オーケストレータを作る。
 *
 * @param {object} options
 * @param {() => ({ append: Function; all: () => any[] } | null | undefined)} options.getBuffer
 *   会話ログ（転写バッファ）を返す。null = 耳未起動（cockpit が pipeline?.transcriptBuffer を渡す）。
 * @param {{ ask: (text: string) => Promise<{ replyText: string }> }} options.session
 *   常駐 LLM セッション（createLlmSession の返り）。ask のみ使う。ここでは作らない/変えない。
 * @param {typeof defaultSpeak} [options.speakImpl]  発話同期（既定 Domain B speak）。テスト差し替え可能。
 * @param {{ sendSpeech: Function }} [options.channel]  speak へ渡す接続済みチャネル。
 * @param {{ play: Function }} [options.player]  speak へ渡す常駐プレイヤー。
 * @param {object} [options.speakDeps]  speak へ渡す追加 deps（tts/writeWav/sConfig 等）。
 * @param {number} [options.windowMs=FIRE_WINDOW_MS]  注入窓幅。
 * @param {number} [options.maxChars=FIRE_MAX_CHARS]  注入文字数上限。
 * @param {() => number} [options.nowImpl=Date.now]  窓の起点となる壁時計（注入可）。
 * @param {(state: FireState) => void} [options.onState]  状態遷移通知（操縦席 busy 表示）。
 * @param {(info: object) => void} [options.onFire]  Fire 受理/棄却の通知。
 * @param {(diag: object) => void} [options.onDiagnostic]  失敗診断（fireError / fireEmptyReply）。
 * @param {(entry: object) => void} [options.onSoulTranscript]  soul 追記の通知（結線層が transcript として broadcast）。
 * @returns {{ fire: () => Promise<object>; getState: () => FireState; dispose: () => void }}
 */
export function createFireOrchestrator(options) {
  if (options == null || typeof options !== "object") {
    throw new TypeError("createFireOrchestrator: options is required.");
  }
  const getBuffer = options.getBuffer;
  const session = options.session;
  if (typeof getBuffer !== "function") {
    throw new TypeError("createFireOrchestrator: options.getBuffer must be a function.");
  }
  if (!session || typeof session.ask !== "function") {
    throw new TypeError("createFireOrchestrator: options.session with ask() is required.");
  }
  const speakImpl = options.speakImpl ?? defaultSpeak;
  const channel = options.channel;
  const player = options.player;
  const speakDeps = options.speakDeps ?? {};
  const windowMs = options.windowMs ?? FIRE_WINDOW_MS;
  const maxChars = options.maxChars ?? FIRE_MAX_CHARS;
  const nowImpl = options.nowImpl ?? Date.now;
  const { onState, onFire, onDiagnostic, onSoulTranscript } = options;

  /** @type {FireState} */
  let state = "idle";
  let disposed = false;

  /** listener 呼び出しはサーバを殺さない（throw を握る）。 */
  const emit = (/** @type {Function|undefined} */ fn, /** @type {unknown} */ arg) => {
    if (typeof fn !== "function") return;
    try {
      fn(arg);
    } catch {
      // best-effort（通知先の失敗で発火経路を壊さない）。
    }
  };

  /** 状態遷移（同値は再通知しない = 冪等・finally の idle 復帰が二重発火しない）。 */
  const setState = (/** @type {FireState} */ next) => {
    if (state === next) return;
    state = next;
    emit(onState, state);
  };

  return {
    /**
     * Fire 1 発を処理する（Promise を返す・テストが await 可能）。
     * @returns {Promise<object>}
     */
    async fire() {
      if (disposed) {
        return { fired: false, reason: "disposed", state };
      }
      // 1. busy 中の Fire は無視（重ね発火は S4/S6 の領分）。
      if (state !== "idle") {
        emit(onFire, { accepted: false, reason: "busy" });
        return { fired: false, reason: "busy", state };
      }
      // 2. 耳未起動（会話ログが無い）。
      const buffer = getBuffer();
      if (buffer == null) {
        emit(onFire, { accepted: false, reason: "ears-not-running" });
        return { fired: false, reason: "ears-not-running" };
      }
      // 3. 直近窓を収集。空窓なら ask を無駄撃ちしない。
      const nowMs = nowImpl();
      const injection = formatFireInjection(buffer.all(), { nowMs, windowMs, maxChars });
      if (injection.includedCount === 0) {
        emit(onFire, { accepted: false, reason: "empty-window" });
        return { fired: false, reason: "empty-window" };
      }
      const injectedText = injection.text;
      const injectedChars = injection.charCount;
      const includedCount = injection.includedCount;

      // 4. 受理 → thinking。ask を撃つ。
      setState("thinking");
      emit(onFire, { accepted: true, injectedChars, includedCount, atMs: nowMs });

      try {
        const asked = await session.ask(injectedText);
        const replyText = asked && typeof asked.replyText === "string" ? asked.replyText : "";

        // 5. 空応答: 発話せず idle へ（finally が戻す）。
        if (replyText.length === 0) {
          emit(onDiagnostic, { type: "fireEmptyReply" });
          return { fired: false, reason: "empty-reply" };
        }

        // 6. speaking → 口 + 声。
        setState("speaking");
        await speakImpl(replyText, { channel, player, ...speakDeps });

        // 7. soul 記録（会話ログへ追記・startMs/endMs=0）。broadcast は onSoulTranscript 経由。
        const appended = buffer.append({ startMs: 0, endMs: 0, text: replyText, speaker: "soul" });
        if (appended && appended.appended && appended.entry) {
          emit(onSoulTranscript, appended.entry);
        }

        return { fired: true, replyText, injectedChars, includedCount };
      } catch (error) {
        // 失敗の握り: サーバを殺さず診断に落とす。
        const message = error instanceof Error ? error.message : String(error);
        emit(onDiagnostic, { type: "fireError", message });
        return { fired: false, reason: "error", message };
      } finally {
        // 8. どの経路でも idle へ戻す（詰まりを残さない）。冪等 setState ゆえ二重発火なし。
        setState("idle");
      }
    },

    /** 現在の状態（idle/thinking/speaking）。 */
    getState() {
      return state;
    },

    /** 畳む（以後の fire を拒否）。session/channel/player は所有しない = ここでは畳まない。 */
    dispose() {
      disposed = true;
    }
  };
}
