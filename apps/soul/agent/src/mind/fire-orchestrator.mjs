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
  "例: 「そうだね<nod>」「えっ<surprised>ほんとに？」。タグは半角の山括弧で書き、読み上げ文には含めません。";

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
 * @param {{ sendSpeech: Function; sendEnvelope?: Function }} [options.channel]  speak/演出送出へ渡す接続済みチャネル。
 * @param {number} [options.expressionIntensity=1.0]  演出強さ係数（全 peak 一括スケール・表の外で適用）。
 * @param {{ play: Function }} [options.player]  speak へ渡す常駐プレイヤー。
 * @param {object} [options.speakDeps]  speak へ渡す追加 deps（tts/writeWav/sConfig 等）。
 * @param {number} [options.windowMs=FIRE_WINDOW_MS]  注入窓幅。
 * @param {number} [options.maxChars=FIRE_MAX_CHARS]  注入文字数上限。
 * @param {() => number} [options.nowImpl=Date.now]  窓の起点となる壁時計（注入可）。
 * @param {(state: FireState) => void} [options.onState]  状態遷移通知（操縦席 busy 表示）。
 * @param {(info: object) => void} [options.onFire]  Fire 受理/棄却の通知。
 * @param {(diag: object) => void} [options.onDiagnostic]  失敗診断（fireError / fireEmptyReply）。
 * @param {(entry: object) => void} [options.onSoulTranscript]  soul 追記の通知（結線層が transcript として broadcast）。
 * @param {(info: object) => void} [options.onExpression]  演出適用の通知（語ごとに {word, args?, applied, rejected}）。
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
  const expressionIntensity =
    typeof options.expressionIntensity === "number" ? options.expressionIntensity : 1.0;
  const { onState, onFire, onDiagnostic, onSoulTranscript, onExpression } = options;

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

        // 5. パーサ: replyText → speechText（読み上げ・会話ログ）+ 演出イベント列 + 診断。
        const parsed = parseExpressionTags(replyText);
        const speechText = parsed.speechText;
        const events = parsed.events;
        // 未知タグ・壊れタグ診断は expression 接頭辞で onDiagnostic へ（声にも演出にも出さない）。
        for (const d of parsed.diagnostics) {
          emit(onDiagnostic, { ...d, type: `expression${capitalize(d.type)}` });
        }

        const hasSpeech = speechText.length > 0;
        const hasEvents = events.length > 0;

        // 6a. 発話も演出も無い（空応答 / 未知タグのみ）→ 既存 fireEmptyReply 経路。
        if (!hasSpeech && !hasEvents) {
          emit(onDiagnostic, { type: "fireEmptyReply" });
          return { fired: false, reason: "empty-reply" };
        }

        // 7. speaking → 演出（発話開始と同時に一括送出・speak と独立に走る・throw しない）。
        setState("speaking");
        const expressionPromise = hasEvents ? applyExpressions(events) : Promise.resolve([]);

        // 6b. 発話なし・演出のみ（タグのみ応答）→ speak せず soul 追記せず envelope だけ実行。
        if (!hasSpeech) {
          const expressions = await expressionPromise;
          return { fired: false, reason: "expression-only", expressed: true, expressions, injectedChars, includedCount };
        }

        // 6c. 発話あり → 口 + 声（speechText のみ）。speak の throw は下の catch（fireError）へ。
        await speakImpl(speechText, { channel, player, ...speakDeps });

        // soul 記録（**speechText のみ**・startMs/endMs=0）。broadcast は onSoulTranscript 経由。
        const appended = buffer.append({ startMs: 0, endMs: 0, text: speechText, speaker: "soul" });
        if (appended && appended.appended && appended.entry) {
          emit(onSoulTranscript, appended.entry);
        }

        const expressions = await expressionPromise;
        return { fired: true, replyText: speechText, expressions, injectedChars, includedCount };
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

/**
 * 診断 type を expression 接頭辞に整える（"unknownTag" → "UnknownTag"）。
 * @param {string} s
 * @returns {string}
 */
function capitalize(s) {
  if (typeof s !== "string" || s.length === 0) return "";
  return s[0].toUpperCase() + s.slice(1);
}
