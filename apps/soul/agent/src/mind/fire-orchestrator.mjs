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
 * @returns {{ fire: (fireOptions?: { vision?: boolean }) => Promise<object>; getState: () => FireState; dispose: () => void }}
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
  const { onState, onFire, onDiagnostic, onSoulTranscript, onExpression, onVisionCaptured, onUsage } =
    options;

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
    await speakImpl(speechText, { channel, player, ...speakDeps });

    // soul 記録（**speechText のみ**・startMs/endMs=0）。broadcast は onSoulTranscript 経由。
    // S5: 視覚発火でも画像は一切積まない（会話ログの正本は speechText のみ・ディスク非保存の流儀）。
    const appended = buffer.append({ startMs: 0, endMs: 0, text: speechText, speaker: "soul" });
    if (appended && appended.appended && appended.entry) {
      emit(onSoulTranscript, appended.entry);
    }

    const expressions = await expressionPromise;
    return { fired: true, replyText: speechText, expressions, ...extra };
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
