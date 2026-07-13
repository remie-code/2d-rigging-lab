// @ts-check
/**
 * 発火オーケストレータ（S3 Domain A・魂の胴体）— apps/soul/agent。
 *
 * Fire（操縦席のボタン / POST /api/fire / AHK）1 発を受け、会話ログの直近窓を LLM セッションへ注入し、
 * 返ってきた一言を speak（口 + 声）で発話し、その発話を会話ログへ speaker:"soul" で追記する。
 * 「AI は全部聞くが、全部では考えない」——聞くのは耳（常時）、考えるのは Fire のとき（ここ）。
 *
 *   fire() → getBuffer() → formatFireInjection(直近窓) → session.ask(注入文) →
 *            parseExpressionTags(応答) → speak(speechText) + channel.sendEnvelope(演出) →
 *            buffer.append(soul=speechText) → idle へ。
 *
 * ── S4「表情が乗る」の結線（Domain A）────────────────────────────────────────────
 *  ask 返りの replyText を **パーサ**に通して speechText（読み上げ・会話ログ）と演出イベント列へ分離する。
 *   - **soul 記録・speak は speechText のみ**（従来 replyText をタグ込みで speak+append していたのを修正・
 *     裁定済みの意図変更）。
 *   - events → **翻訳層**（強さ係数適用）→ intent.envelope payload 列 → 発話開始時に channel.sendEnvelope を
 *     スロット毎に送出。**rejected / 送出 throw は onDiagnostic に握って発話を止めない**（部分適用は正常系）。
 *     envelope 経路は speak の成否と独立（envelope が全部こけても speak は走る／speak がこけても既存 fireError）。
 *   - 分岐: speechText 空 & events 空 → 既存 fireEmptyReply。speechText 空 & events あり → 発話せず演出のみ
 *     （reason:"expression-only"）。speechText あり → speak + soul 追記 +（events あれば）envelope。
 *   - 未知タグ（パーサ診断）は onDiagnostic({type:"expressionUnknownTag", tag})、演出適用は onExpression で通知
 *     （ワイヤ契約は domain-a.md ワイヤ契約節・Domain B が消費）。
 *
 * ── 何を作らない / 変えない ────────────────────────────────────────────────
 *  session（createLlmSession の返り）・speak・channel・player・転写バッファは**受け取るだけ**。
 *  ここで作らず・変えない（S1/S2 の器官はそのまま結線する）。所有権は呼び出し側（本番結線 = Domain B）。
 *
 * ── busy 状態機械（wave 計画 §2 裁定 5・S6 で意味が変わる）─────────────────────────
 *  idle →(fire)→ thinking →(応答)→ speaking →(発話完了 or barge-in 中断)→ idle。**state≠idle の
 *  間の fire は無視**（重ね発火は S4/S6 の領分）。state 遷移ごとに onState(state) を通知。
 *  finally で必ず idle へ戻す（ask/speak が throw してもサーバを殺さない）。
 *
 *  **S6 で speaking 状態が実再生区間を覆うように変わった**（inventory §3-3 の回収）: 従来は
 *  speakImpl（play() 送出は非ブロッキング）が resolve した瞬間に soul を append して即 idle へ
 *  向かっていた＝実際の音声再生中はもう idle だった。S6 では speak() の戻り（timeline・
 *  wavDurationSec・playbackStartedAtMs）で **再生実区間を追跡**し、その間 speaking 状態を保つ。
 *  soul 追記は **発話完了時（全文）または barge-in 中断時（声に出た接頭辞 + 中断注記）** の 1 回だけ
 *  行う（append-only 維持・裁定済みの意図変更）。この window に interrupt() が効く。
 *
 * ── S6「会話が続く」barge-in（Domain B）─────────────────────────────────────────
 *  外部（cockpit-server の onVadEvent → barge-in gate）が `interrupt()` を呼ぶと、再生中の魂発話を
 *  中断する: ① player.stop()（声を止める）② channel へ mouth-open intent.set(value=0・短 ttl) を
 *  送出（口を閉じる = speech タイムライン強制 release・inventory §2）③ モーラタイムライン × 再生経過で
 *  切断点算出（barge-in.computeSpokenPrefix・過大評価しない）④ soul 行に「接頭辞 + 中断注記」を追記
 *  ⑤ onDiagnostic({type:"bargeIn",...})。stop 失敗・set rejected/throw は診断に握って落とさない
 *  （envelope 経路の作法に倣う）。interrupt() は speaking 中でなければ no-op（冪等・dispose 後も安全）。
 *
 * ── 失敗の握り ──────────────────────────────────────────────────────────────
 *  ask/speak の throw は onDiagnostic({type:"fireError", message}) に落とし、{fired:false, reason:"error"}
 *  を返す（例外を上へ投げず常駐を続ける）。応答が空なら ask は撃ったが発話せず idle へ戻す
 *  （fireEmptyReply 診断）。空窓は ask を撃つ前に empty-window で返す（無駄撃ち回避）。
 *
 * ── S5「目が開く」の視覚発火（Domain B の結線）─────────────────────────────────
 *  `fire({ vision: true })` で起動する**第二の発火種別**（通常 `fire()` の署名・挙動・戻り値は
 *  完全不変＝無退行）。フロー: busy 中は無視（通常 Fire 同様）→ 耳未起動チェック（通常 Fire と共通）→
 *  `getVisionTarget()` で対象ウインドウのタイトルを解決（null/空なら対象未設定として中止）→
 *  thinking 遷移 → `captureImpl(title)`（既定 `captureWindow`）でキャプチャ → **失敗（{error}）なら
 *  session.ask を呼ばずに中止**（「見て」と言われて盲目のまま答えるのは嘘になる。fireVisionError 診断
 *  + ゴースト＝発話しない）→ 成功なら会話窓（`formatFireInjection`）+ 視覚指示テキストと画像ブロックを
 *  content 配列（**画像先行**）にして `session.ask(contentBlocks)` → 以降はパーサ→speak→soul 記録→
 *  演出という**従来経路と完全共通**（`processReply` に抽出）。画像は会話ログ（転写バッファ）へは
 *  一切積まない（speechText のみ append・ディスク非保存の流儀を会話ログにも適用）。
 *  「見た」事実は `onVisionCaptured({title,width,height,jpegBase64,elapsedMs})` で結線層へ通知する
 *  （サムネ用 base64 はこの通知にだけ載る）。
 *
 * ── usage 計器（wave 計画 §2 裁定 2・blocking）───────────────────────────────
 *  session.ask の戻り値 usage を、通常 Fire・視覚発火の**両方**で `onUsage({ usage, vision })` として
 *  通知する（askごとの input_tokens 推移を結線層が追える形。usage が null/undefined のときは通知しない）。
 *
 * ── soul 記録の broadcast 経路 ───────────────────────────────────────────────
 *  soul を buffer.append した直後に onSoulTranscript(entry) フックで結線層（cockpit）へ通知し、
 *  cockpit が既存 transcript イベント（speaker:"soul"）として SSE broadcast する（domain-a.md
 *  ワイヤ契約 §）。**これが soul の唯一の正経路**。
 *
 *  注意（S3 追撃 domain-c で接地）: soul も you と同じ transcriptBuffer に append されるため、
 *  ear-pipeline の onAppend→onTranscript（耳の転写経路）を**必ず通る**。よって結線層（cockpit）の
 *  onTranscript ハンドラ側で speaker:"soul" を除外しないと同一エントリが二重 broadcast される。
 *  （かつての「soul は onTranscript を通らない」という記述は誤りだった。）
 */

import { speak as defaultSpeak } from "../voice/speak.mjs";
import { formatFireInjection, FIRE_WINDOW_MS, FIRE_MAX_CHARS } from "./fire-injection.mjs";
import { parseExpressionTags } from "./expression-parser.mjs";
import { translateExpression } from "./expression-translator.mjs";
import { captureWindow as defaultCaptureWindow } from "../eyes/window-capture.mjs";
import {
  computeSpokenPrefix,
  BARGE_IN_NOTE,
  MOUTH_CLOSE_SLOT_ID,
  MOUTH_CLOSE_TTL_MS
} from "./barge-in.mjs";

/** 視覚発火の最小指示文（wave 計画 §2 裁定・人格の作り込みはしない＝persona の領分）。 */
const VISION_INSTRUCTION_TEXT = "今の画面を見て、直近の会話と合わせて自然に反応してください。";

/**
 * 最小仮面（v0）の発火用システムプロンプト（wave 計画 §2 裁定 4）。
 * **意図的に貧しく**——凝るのは persona の領分。本番結線（Domain B）が createLlmSession に渡す想定
 * （orchestrator 自身は session を受け取るだけ）。
 *
 * S4: 表情タグ 6 語の教示を最小限だけ足す（人格の作り込みはしない＝persona の領分・引き続き貧しく）。
 */
export const FIRE_SYSTEM_PROMPT =
  "あなたは配信の相方です。直前の会話を踏まえ、短く自然な日本語で一言だけ返してください。" +
  "箇条書き・記号・長い説明はしないでください。" +
  "感情が動いたときだけ、返事にごく短い表情タグを添えてよいです（無理に付けなくてよい）。" +
  "使えるタグは <smile> <troubled> <surprised> <nod> <look-away> <look-camera> の 6 つだけです。" +
  "例: 「そうだね<nod>」「えっ<surprised>ほんとに？」。タグは半角の山括弧で書き、読み上げ文には含めません。" +
  "画面（画像）が渡されることがあります。その場合は画面を見て、自然に反応してください。";

/**
 * @typedef {"idle" | "thinking" | "speaking"} FireState
 */

/**
 * 発火オーケストレータを作る。
 *
 * @param {object} options
 * @param {() => ({ append: Function; all: () => any[] } | null | undefined)} options.getBuffer
 *   会話ログ（転写バッファ）を返す。null = 耳未起動（cockpit が pipeline?.transcriptBuffer を渡す）。
 * @param {{ ask: (content: string | Array<any>) => Promise<{ replyText: string; usage?: any }> }} options.session
 *   常駐 LLM セッション（createLlmSession の返り）。ask のみ使う。ここでは作らない/変えない。
 *   S5: ask は文字列（通常 Fire）と content ブロック配列（視覚発火）の両方を受理する前提。
 * @param {typeof defaultSpeak} [options.speakImpl]  発話同期（既定 Domain B speak）。テスト差し替え可能。
 * @param {{ sendSpeech: Function; sendEnvelope?: Function }} [options.channel]  speak/演出送出へ渡す接続済みチャネル。
 * @param {number} [options.expressionIntensity=1.0]  演出強さ係数（全 peak 一括スケール・表の外で適用）。
 * @param {{ play: Function }} [options.player]  speak へ渡す常駐プレイヤー。
 * @param {object} [options.speakDeps]  speak へ渡す追加 deps（tts/writeWav/sConfig 等）。
 * @param {number} [options.windowMs=FIRE_WINDOW_MS]  注入窓幅。
 * @param {number} [options.maxChars=FIRE_MAX_CHARS]  注入文字数上限。
 * @param {() => number} [options.nowImpl=Date.now]  窓の起点となる壁時計（注入可）。
 * @param {typeof defaultCaptureWindow} [options.captureImpl]  視覚発火のキャプチャ実装（既定 captureWindow・テスト差し替え可能）。
 * @param {() => (string | null | undefined) | Promise<string | null | undefined>} [options.getVisionTarget]
 *   視覚発火の対象ウインドウタイトルを解決する関数（cockpit-settings 等・orchestrator は対象設定を所有しない）。
 *   未注入 or null/空文字を返せば「対象未設定」として視覚発火を中止する。
 * @param {(state: FireState) => void} [options.onState]  状態遷移通知（操縦席 busy 表示）。
 * @param {(info: object) => void} [options.onFire]  Fire 受理/棄却の通知。
 * @param {(diag: object) => void} [options.onDiagnostic]  失敗診断（fireError / fireEmptyReply / fireVisionError）。
 * @param {(entry: object) => void} [options.onSoulTranscript]  soul 追記の通知（結線層が transcript として broadcast）。
 * @param {(info: object) => void} [options.onExpression]  演出適用の通知（語ごとに {word, args?, applied, rejected}）。
 * @param {(info: { title: string; width: number; height: number; jpegBase64: string; elapsedMs: number }) => void} [options.onVisionCaptured]
 *   視覚発火のキャプチャ成功通知（「見た」事実・サムネ用 base64 はここにだけ載る。会話ログには積まない）。
 * @param {(info: { usage: any; vision: boolean }) => void} [options.onUsage]
 *   ask ごとの usage 通知（通常 Fire・視覚発火の両方・usage が null/undefined のときは発火しない）。
 * @param {typeof setTimeout} [options.setTimeoutImpl=setTimeout]  再生完了タイマの注入（決定論テスト用）。
 * @param {typeof clearTimeout} [options.clearTimeoutImpl=clearTimeout]  再生完了タイマの解除（注入）。
 * @returns {{ fire: (fireOptions?: { vision?: boolean }) => Promise<object>; interrupt: (atMs?: number) => Promise<object>; getState: () => FireState; dispose: () => void }}
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
  const captureImpl = options.captureImpl ?? defaultCaptureWindow;
  const getVisionTarget = options.getVisionTarget;
  const expressionIntensity =
    typeof options.expressionIntensity === "number" ? options.expressionIntensity : 1.0;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const { onState, onFire, onDiagnostic, onSoulTranscript, onExpression, onVisionCaptured, onUsage } =
    options;

  /** @type {FireState} */
  let state = "idle";
  let disposed = false;

  /**
   * 再生実区間の追跡（S6）。speak() 後〜発話完了/中断まで有効。null = 現在発話中でない。
   * @type {null | {
   *   buffer: { append: Function };
   *   speechText: string;
   *   timeline: Array<any>;
   *   playbackStartedAtMs: number;
   *   interrupted: boolean;
   *   appended: boolean;
   *   timer: ReturnType<typeof setTimeout> | null;
   *   resolve: (outcome: { interrupted: boolean; disposed?: boolean; elapsedMs?: number; charsSpoken?: number; prefix?: string }) => void;
   * }}
   */
  let currentPlayback = null;

  /** エラー→メッセージ（診断用）。 */
  const errMessage = (/** @type {unknown} */ err) =>
    err instanceof Error ? err.message : String(err);

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

  /**
   * 演出イベント列を intent.envelope へ翻訳しスロット毎に送出する（**発話を止めない**・throw しない）。
   * 各語ごとに applied/rejected を数えて onExpression で通知する。rejected（器拒否）・送出 throw・
   * チャネル未対応はすべて onDiagnostic に握り、部分適用（一部 accepted・一部 rejected）は正常系。
   * 戻り値は語ごとの適用サマリ（発話ありなら戻り値へ・expression-only は診断用）。
   * @param {Array<{ word: string; args?: string; position: number }>} events
   * @returns {Promise<Array<{ word: string; args?: string; applied: number; rejected: number }>>}
   */
  const applyExpressions = async (events) => {
    /** @type {Array<{ word: string; args?: string; applied: number; rejected: number }>} */
    const summaries = [];
    for (const ev of events) {
      const { payloads, diagnostics } = translateExpression(ev.word, ev.args, expressionIntensity);
      for (const d of diagnostics) {
        // 翻訳層の診断（存在しない語＝防御）。パーサが既知語のみ event 化するため通常は来ない。
        emit(onDiagnostic, { ...d, type: `expression${capitalize(d.type)}` });
      }
      let applied = 0;
      let rejected = 0;
      const send = async (/** @type {any} */ payload) => {
        try {
          if (!channel || typeof channel.sendEnvelope !== "function") {
            rejected += 1;
            emit(onDiagnostic, { type: "expressionSendError", slotId: payload.slotId, message: "channel has no sendEnvelope" });
            return;
          }
          const outcome = await channel.sendEnvelope(payload);
          if (outcome && outcome.result === "accepted") {
            applied += 1;
          } else {
            rejected += 1;
            emit(onDiagnostic, {
              type: "expressionRejected",
              slotId: payload.slotId,
              error: outcome && outcome.error != null ? outcome.error : null
            });
          }
        } catch (err) {
          rejected += 1;
          const message = err instanceof Error ? err.message : String(err);
          emit(onDiagnostic, { type: "expressionSendError", slotId: payload.slotId, message });
        }
      };
      await Promise.all(payloads.map(send));
      /** @type {{ word: string; args?: string; applied: number; rejected: number }} */
      const summary = { word: ev.word, applied, rejected };
      if (ev.args != null) summary.args = ev.args;
      summaries.push(summary);
      emit(onExpression, summary);
    }
    return summaries;
  };

  /**
   * ask の戻りを共通処理する（パーサ→speechText/events分岐→speak→soul記録→envelope送出→戻り値組み立て）。
   * 通常 Fire・視覚発火の両方から呼ばれる（S5: 完全共通化。通常 Fire 単体で見た分岐仕様・診断発行順序・
   * 戻り値の形は元のインライン実装と完全に同一＝無退行）。
   * @param {{ append: Function }} buffer
   * @param {any} asked  session.ask の戻り値。
   * @param {boolean} vision  onUsage に載せる区別フラグ。
   * @param {object} extra  戻り値へマージする付随情報（injectedChars/includedCount・視覚発火は vision:true も）。
   * @returns {Promise<object>}
   */
  const processAskedReply = async (buffer, asked, vision, extra) => {
    // usage 計器（wave 計画 §2 裁定 2・blocking）: 通常 Fire・視覚発火の両方で通知する。
    if (asked && asked.usage != null) {
      emit(onUsage, { usage: asked.usage, vision });
    }
    const replyText = asked && typeof asked.replyText === "string" ? asked.replyText : "";

    // パーサ: replyText → speechText（読み上げ・会話ログ）+ 演出イベント列 + 診断。
    const parsed = parseExpressionTags(replyText);
    const speechText = parsed.speechText;
    const events = parsed.events;
    // 未知タグ・壊れタグ診断は expression 接頭辞で onDiagnostic へ（声にも演出にも出さない）。
    for (const d of parsed.diagnostics) {
      emit(onDiagnostic, { ...d, type: `expression${capitalize(d.type)}` });
    }

    const hasSpeech = speechText.length > 0;
    const hasEvents = events.length > 0;

    // 発話も演出も無い（空応答 / 未知タグのみ）→ 既存 fireEmptyReply 経路。
    if (!hasSpeech && !hasEvents) {
      emit(onDiagnostic, { type: "fireEmptyReply" });
      return { fired: false, reason: "empty-reply" };
    }

    // speaking → 演出（発話開始と同時に一括送出・speak と独立に走る・throw しない）。
    setState("speaking");
    const expressionPromise = hasEvents ? applyExpressions(events) : Promise.resolve([]);

    // 発話なし・演出のみ（タグのみ応答）→ speak せず soul 追記せず envelope だけ実行。
    if (!hasSpeech) {
      const expressions = await expressionPromise;
      return { fired: false, reason: "expression-only", expressed: true, expressions, ...extra };
    }

    // 発話あり → 口 + 声（speechText のみ）。speak の throw は呼び出し元の catch（fireError）へ。
    const spoken = await speakImpl(speechText, { channel, player, ...speakDeps });

    // S6: 再生実区間を追跡し、その間 speaking を保つ。soul 追記は完了時 or 中断時の 1 回だけ。
    // speak() の戻り（timeline・wavDurationSec・playbackStartedAtMs）で切断点算出材料と完了尺を得る。
    const timeline = spoken && Array.isArray(spoken.timeline) ? spoken.timeline : [];
    const wavDurationSec =
      spoken && typeof spoken.wavDurationSec === "number" && Number.isFinite(spoken.wavDurationSec)
        ? spoken.wavDurationSec
        : 0;
    const playbackStartedAtMs =
      spoken && typeof spoken.playbackStartedAtMs === "number" && Number.isFinite(spoken.playbackStartedAtMs)
        ? spoken.playbackStartedAtMs
        : nowImpl();
    const durationMs = Math.max(0, wavDurationSec * 1000);

    // 再生中は speaking のまま。natural 完了タイマ or interrupt() のどちらかで resolve する。
    const completion = await new Promise((resolve) => {
      const pb = {
        buffer,
        speechText,
        timeline,
        playbackStartedAtMs,
        interrupted: false,
        appended: false,
        resolve,
        /** @type {ReturnType<typeof setTimeout> | null} */
        timer: null
      };
      pb.timer = setTimeoutImpl(() => {
        // 自然完了（この window に interrupt が来なかった）。
        if (currentPlayback === pb && !pb.interrupted) {
          resolve({ interrupted: false });
        }
      }, durationMs);
      currentPlayback = pb;
    });

    // window を閉じる（タイマ解除・現在発話をクリア）。interrupt() 経由なら timer は既に解除済み。
    const pb = currentPlayback;
    currentPlayback = null;
    if (pb && pb.timer != null) {
      clearTimeoutImpl(/** @type {any} */ (pb.timer));
      pb.timer = null;
    }

    // dispose 中断: soul 追記せず畳む（詰まりを残さない）。
    if (completion.disposed) {
      await expressionPromise;
      return { fired: false, reason: "disposed", ...extra };
    }

    if (completion.interrupted) {
      // barge-in 中断: soul 追記（接頭辞 + 中断注記）と bargeIn 診断は interrupt() が済ませている。
      // ここでは二重 append しない（append-only 維持・1 発話 = soul 1 エントリ）。
      const expressions = await expressionPromise;
      return {
        fired: true,
        interrupted: true,
        replyText: completion.prefix ?? "",
        charsSpoken: completion.charsSpoken ?? 0,
        elapsedMs: completion.elapsedMs ?? 0,
        expressions,
        ...extra
      };
    }

    // 自然完了 → 全文を soul 記録（**speechText のみ**・startMs/endMs=0）。broadcast は onSoulTranscript 経由。
    // S5: 視覚発火でも画像は一切積まない（会話ログの正本は speechText のみ・ディスク非保存の流儀）。
    const appended = buffer.append({ startMs: 0, endMs: 0, text: speechText, speaker: "soul" });
    if (appended && appended.appended && appended.entry) {
      emit(onSoulTranscript, appended.entry);
    }

    const expressions = await expressionPromise;
    return { fired: true, replyText: speechText, expressions, ...extra };
  };

  /**
   * barge-in 中断（S6・外部の VAD 結線が確定時に呼ぶ）。speaking 中の魂発話を止め、器の口を閉じ、
   * 切断点を正直に算出して「接頭辞 + 中断注記」を soul へ 1 回追記し、bargeIn 診断を出す。
   * speaking 中でなければ no-op（冪等・dispose 後も安全）。stop/set の失敗は診断に握って落とさない。
   * @param {number} [atMs]  中断時刻（既定 nowImpl()）。切断点は atMs − playbackStartedAtMs で算出。
   * @returns {Promise<{ interrupted: boolean; reason?: string; elapsedMs?: number; charsSpoken?: number; prefix?: string }>}
   */
  const interrupt = async (atMs) => {
    const pb = currentPlayback;
    if (!pb || pb.interrupted) {
      // 発話中でない・既に中断済み → 何もしない（冪等）。
      return { interrupted: false, reason: pb ? "already-interrupted" : "not-speaking" };
    }
    pb.interrupted = true;
    // 自然完了タイマを止める（この後 resolve するので二重 resolve しない）。
    if (pb.timer != null) {
      clearTimeoutImpl(/** @type {any} */ (pb.timer));
      pb.timer = null;
    }

    // ① 声を止める（player.stop）。失敗は診断に握る（落とさない）。
    try {
      if (player && typeof player.stop === "function") {
        player.stop();
      }
    } catch (err) {
      emit(onDiagnostic, { type: "bargeInStopError", message: errMessage(err) });
    }

    // ② 器の口を閉じる（mouth-open へ intent.set value=0・短 ttl = speech タイムライン強制 release）。
    //    rejected/throw/未対応はすべて診断に握る（口が閉じ切らなくても中断処理は続ける）。
    try {
      if (channel && typeof channel.sendSet === "function") {
        const outcome = await channel.sendSet({
          slotId: MOUTH_CLOSE_SLOT_ID,
          value: 0,
          ttlMs: MOUTH_CLOSE_TTL_MS
        });
        if (!(outcome && outcome.result === "accepted")) {
          emit(onDiagnostic, {
            type: "bargeInMouthCloseRejected",
            slotId: MOUTH_CLOSE_SLOT_ID,
            error: outcome && outcome.error != null ? outcome.error : null
          });
        }
      } else {
        emit(onDiagnostic, {
          type: "bargeInMouthCloseError",
          slotId: MOUTH_CLOSE_SLOT_ID,
          message: "channel has no sendSet"
        });
      }
    } catch (err) {
      emit(onDiagnostic, {
        type: "bargeInMouthCloseError",
        slotId: MOUTH_CLOSE_SLOT_ID,
        message: errMessage(err)
      });
    }

    // ③ 切断点算出（モーラタイムライン × 再生経過・過大評価しない純関数）。
    const interruptAtMs = typeof atMs === "number" && Number.isFinite(atMs) ? atMs : nowImpl();
    const elapsedMs = interruptAtMs - pb.playbackStartedAtMs;
    const cut = computeSpokenPrefix({
      speechText: pb.speechText,
      timeline: pb.timeline,
      elapsedMs
    });

    // ④ soul 追記（接頭辞 + 中断注記・1 回・上書きせず append）。broadcast は onSoulTranscript 経由。
    const soulText = cut.prefix + BARGE_IN_NOTE;
    const appended = pb.buffer.append({ startMs: 0, endMs: 0, text: soulText, speaker: "soul" });
    pb.appended = true;
    if (appended && appended.appended && appended.entry) {
      emit(onSoulTranscript, appended.entry);
    }

    // ⑤ 診断（barge-in 発生・切断点・声に出た文字数）。
    emit(onDiagnostic, {
      type: "bargeIn",
      elapsedMs,
      charsSpoken: cut.charsSpoken,
      totalChars: pb.speechText.length,
      prefix: cut.prefix
    });

    const info = { interrupted: true, elapsedMs, charsSpoken: cut.charsSpoken, prefix: cut.prefix };
    // processAskedReply の await を解放（この後 finally が idle へ戻す）。
    pb.resolve(info);
    return info;
  };

  /**
   * 視覚発火（S5「目が開く」）。busy 判定・耳未起動判定は呼び出し元（fire()）で通常 Fire と共有済み。
   * @param {{ all: Function; append: Function }} buffer
   * @returns {Promise<object>}
   */
  const fireVision = async (buffer) => {
    // 対象ウインドウのタイトルを解決する（orchestrator は対象設定を所有しない・注入された解決関数に委譲）。
    let title = null;
    try {
      title = typeof getVisionTarget === "function" ? await getVisionTarget() : null;
    } catch {
      title = null; // 解決関数の throw も「対象未設定」として正直に扱う（盲目のまま撃たない）。
    }
    if (typeof title !== "string" || title.length === 0) {
      emit(onFire, { accepted: false, reason: "vision-no-target", vision: true });
      emit(onDiagnostic, {
        type: "fireVisionError",
        kind: "no-target",
        message: "vision target window is not set"
      });
      return { fired: false, reason: "vision-no-target" };
    }

    // 受理 → thinking。
    setState("thinking");
    emit(onFire, { accepted: true, vision: true, atMs: nowImpl() });

    try {
      // キャプチャ。失敗（{error}）なら session.ask を呼ばずに正直に中止する（成功を捏造しない）。
      const captured = await captureImpl(title);
      if (captured && captured.error) {
        const { kind, message } = captured.error;
        emit(onDiagnostic, { type: "fireVisionError", kind, message });
        return { fired: false, reason: "vision-capture-failed", kind };
      }

      // 「見た」事実の通知（サムネ用 base64 はここにだけ載る・会話ログの正本には積まない）。
      emit(onVisionCaptured, {
        title,
        width: captured.width,
        height: captured.height,
        jpegBase64: captured.jpegBase64,
        elapsedMs: captured.elapsedMs
      });

      // 会話窓 + 視覚指示テキストと画像ブロックを content 配列（**画像先行**）にして注入。
      const nowMs = nowImpl();
      const injection = formatFireInjection(buffer.all(), { nowMs, windowMs, maxChars });
      const injectedText = injection.text;
      const injectedChars = injection.charCount;
      const includedCount = injection.includedCount;
      const instructionText =
        injectedText.length > 0 ? `${injectedText}\n${VISION_INSTRUCTION_TEXT}` : VISION_INSTRUCTION_TEXT;
      const contentBlocks = [
        { type: "image", source: { type: "base64", data: captured.jpegBase64, media_type: "image/jpeg" } },
        { type: "text", text: instructionText }
      ];

      // 以降は従来経路と完全共通（パーサ→speak→soul記録→演出）。
      const asked = await session.ask(contentBlocks);
      return await processAskedReply(buffer, asked, true, { injectedChars, includedCount, vision: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit(onDiagnostic, { type: "fireError", message });
      return { fired: false, reason: "error", message };
    } finally {
      setState("idle");
    }
  };

  return {
    /**
     * Fire 1 発を処理する（Promise を返す・テストが await 可能）。
     * @param {{ vision?: boolean }} [fireOptions]  省略/未指定時は従来どおり通常 Fire（完全不変）。
     *   `{ vision: true }` で視覚発火（S5）。
     * @returns {Promise<object>}
     */
    async fire(fireOptions) {
      if (disposed) {
        return { fired: false, reason: "disposed", state };
      }
      // 1. busy 中の Fire は無視（重ね発火は S4/S6 の領分・視覚発火も同一判定を共有）。
      if (state !== "idle") {
        emit(onFire, { accepted: false, reason: "busy" });
        return { fired: false, reason: "busy", state };
      }
      // 2. 耳未起動（会話ログが無い）。視覚発火も会話窓の注入に buffer を要するため共有。
      const buffer = getBuffer();
      if (buffer == null) {
        emit(onFire, { accepted: false, reason: "ears-not-running" });
        return { fired: false, reason: "ears-not-running" };
      }

      // S5: 視覚発火は別フローへ（これより下の通常 Fire ロジックは元の実装と完全に不変）。
      if (fireOptions != null && fireOptions.vision === true) {
        return fireVision(buffer);
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
        return await processAskedReply(buffer, asked, false, { injectedChars, includedCount });
      } catch (error) {
        // 失敗の握り: サーバを殺さず診断に落とす。
        const message = error instanceof Error ? error.message : String(error);
        emit(onDiagnostic, { type: "fireError", message });
        return { fired: false, reason: "error", message };
      } finally {
        // どの経路でも idle へ戻す（詰まりを残さない）。冪等 setState ゆえ二重発火なし。
        setState("idle");
      }
    },

    /** barge-in 中断（S6・外部の VAD 結線が呼ぶ）。詳細は interrupt の JSDoc。 */
    interrupt,

    /** 現在の状態（idle/thinking/speaking）。 */
    getState() {
      return state;
    },

    /** 畳む（以後の fire を拒否）。session/channel/player は所有しない = ここでは畳まない。 */
    dispose() {
      disposed = true;
      // 発話再生中に畳まれたら、await 中の processAskedReply を安全に解放する（詰まりを残さない）。
      const pb = currentPlayback;
      if (pb && !pb.interrupted) {
        pb.interrupted = true;
        if (pb.timer != null) {
          clearTimeoutImpl(/** @type {any} */ (pb.timer));
          pb.timer = null;
        }
        pb.resolve({ interrupted: false, disposed: true });
      }
    }
  };
}

/**
 * 診断 type を expression 接頭辞に整える（"unknownTag" → "UnknownTag"）。
 * @param {string} s
 * @returns {string}
 */
function capitalize(s) {
  if (typeof s !== "string" || s.length === 0) return "";
  return s[0].toUpperCase() + s.slice(1);
}
