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
 *  向かっていた＝実際の音声再生中はもう idle だった。S6 では speak() の戻りで **再生実区間を追跡**し、
 *  その間 speaking 状態を保つ。声の差し替え Wave 2 から、一括の読み上げも SpeechStreamer
 *  （voice/speech-streamer.mjs の speakOnce）に載り、完了は WAV 長のタイマーではなく player の
 *  ENDED（speakImpl の返りの `ended`）で判断する。`ended` を持たない返り（テストや計測の偽物）は
 *  返った時点で鳴り終わったとみなす。
 *  soul 追記は **発話完了時（全文）または barge-in 中断時（声に出た接頭辞 + 中断注記）** の 1 回だけ
 *  行う（append-only 維持・裁定済みの意図変更）。この window に interrupt() が効く。
 *  鳴らし始めた後（STARTED の後）に再生が失敗したときは、文ごとの読み上げと同じく「声に出た接頭辞 +
 *  改行 + PROGRESSIVE_INTERRUPTION_NOTE」を 1 回追記し、{fired:false, reason:"speech-playback-failed"} を
 *  返す（fireError にしない）。STARTED 前・声に出た分が 0 文字の失敗は今どおり fireError。
 *
 * ── S6「会話が続く」barge-in（Domain B）─────────────────────────────────────────
 *  外部（cockpit-server の onVadEvent → barge-in gate）が `interrupt()` を呼ぶと、再生中の魂発話を
 *  中断する: ① player.stop()（声を止める）② channel へ mouth-open intent.set(value=0・短 ttl) を
 *  送出（口を閉じる = speech タイムライン強制 release・inventory §2）。①② は SpeechStreamer の
 *  stop が行い、合成中の engine にも signal で中止を伝える ③ 累積の口の時間割 × STARTED からの経過で
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
 * ── S6 追撃「自発発火に画像同乗」（Domain E・視覚優先モード）───────────────────────
 *  `fire({ vision: "preferred" })` で起動する**第三のモード**（手動 `fire()`・手動視覚 `fire({vision:true})`
 *  の署名・挙動・戻り値は 1 ビットも変えない＝無退行）。人間ゲート裁定: 自発発火のうち **call（呼びかけ）・
 *  turn-end（区切り応答）** を、視覚対象が設定済みなら S5 視覚経路（実キャプチャ + 画像先行 content + ask）へ
 *  **格上げ**する。ただし手動視覚 Fire・沈黙発火（silence = 従来どおり `fire({vision:true})`）の「見えなければ
 *  中止」とは違い、preferred は**盲目でも嘘にならない**（誰もボタンを押していない）ので中止せず劣化する:
 *   - 対象未設定（getVisionTarget → null/空）→ **画像なしの通常 Fire**（`vision-no-target` 中止ではない）。
 *   - キャプチャ失敗（captureImpl → {error}）→ **画像なしの通常 Fire に静かに劣化**。痕跡は診断
 *     `fireVisionDegraded {kind, message}`（ゴースト行の材料・cockpit の既存 diagnostic 経路が kind/message を運ぶ）
 *     で必ず残す（`vision-capture-failed` 中止ではない）。
 *   - 対象あり + キャプチャ成功 → 手動視覚 Fire と**完全共通**の視覚 ask（画像先行・onVisionCaptured 発火・
 *     usage {vision:true}）。
 *  **劣化/対象未設定の発火は実際には画像なし ask** ゆえ、onUsage・戻り値の vision フラグは **false**（正直・
 *  見ていないのに見たと言わない）。onVisionCaptured も発火しない。結線層（cockpit-server）は call/turn-end を
 *  preferred・silence を従来 `fire({vision:true})` に振り分ける（domain-e.md §）。
 *
 * ── usage 計器（wave 計画 §2 裁定 2・blocking）───────────────────────────────
 *  session.ask の戻り値 usage を、通常 Fire・視覚発火の**両方**で `onUsage({ usage, vision })` として
 *  通知する（askごとの input_tokens 推移を結線層が追える形。usage が null/undefined のときは通知しない）。
 *
 * ── S8「キルスイッチ」（Domain A・全発火 OFF + 声の即切断）───────────────────────
 *  `kill()`/`revive()`/`initialKilled` は**全発火経路を閉じる**（manual `fire()`・視覚 `fire({vision:true})`・
 *  自発 `fire({vision:"preferred"})` はすべて唯一の合流点 `fire()` を通るため、ここ一箇所のガードで足りる）。
 *  キル中の再生は interrupt() 相当の即切断（player.stop 同期呼び・口閉じ・切断点算出・soul へ
 *  `prefix + KILL_NOTE` 追記・onDiagnostic({type:"kill"})）で止める。再生中の切断ロジックは interrupt() と
 *  共有ヘルパ `severSpeaking()` に抽出し（DRY・診断 type を `bargeIn`/`kill` でパラメータ化するだけ）、
 *  bargeIn の外形・診断・soul 二重 append 回避は 1 ビットも変えない（無退行）。killed 中に返ってきた
 *  in-flight 応答（ask 撃った後にキルされたケース）は speak せず・soul 追記せず・診断 `killDiscarded`
 *  （応答本文は載せない = 秘匿）のみ残して畳む。プロセス不殺・in-memory のみ・ears 系には一切触れない
 *  （耳の不干渉）。revive() はフラグを倒すだけ（残留状態を作らない）。
 *
 * ── S8「NG 最終検査」（Domain C・配信の安全弁の二段目）────────────────────────────
 *  `processAskedReply` 内、in-flight キル検査の直後・speechText 確定後〜speakImpl 呼び出し前に
 *  検問所を置く（キル検査と同じ場所に並べる）。`containsNgWord(speechText)`（`./ng-words.mjs`・
 *  最小 starter list を NFKC 正規化 + 部分一致で照合する素朴形）が命中したら、その発話は
 *  **丸ごと没**にする: speakImpl を呼ばない・speechText 本文をどこにも書かない（soul 本文・
 *  onDiagnostic・戻り値・ログのいずれにも命中語も本文も載せない = 秘匿）。正本へは固定の事実
 *  文字列 `NG_BLOCKED_NOTE`（本文なし・`./ng-words.mjs`）だけを append し、`onDiagnostic({type:
 *  "ngBlocked"})`（type のみ）を通知して `{fired:false, reason:"ng-blocked"}` を返す。
 *  `containsNgWord("")` は false ゆえ、発話なし（expression-only・空応答）はこの検査を素通りする
 *  （NG 検査は「声になるもの」だけを向く）。非命中は挙動完全不変（無退行）。
 *
 * ── 発火番号・きっかけ・推論の範囲・遅延（操縦席の作り直し 1 回目・cockpit-glance-redesign.md §9）────────
 *  受理した発火ごとに番号（fireId・1 から増える整数）を振り、受理（onFire）・ask（onAsk）・soul の追記
 *  （onSoulTranscript の entry）・遅延（onLatency）・fire() の戻り値に同じ番号を載せる。`fire({ cause })` の
 *  cause（きっかけ・結線層が作る本文なしの小さなオブジェクト）は受理・棄却と遅延にそのまま載せる（ここでは解釈しない）。
 *  onAsk はその回の LLM に渡した会話の窓の始まりと終わりの seq（formatFireInjection の firstSeq / lastSeq）を
 *  ask の直前に通知する（通常・画面あり・画面優先の全経路）。遅延は ./fire-latency.mjs の createFireTiming に
 *  既存のトレースを食わせて測り、声が鳴り始めた時点（鳴らなかった返事は発火の終わり）で 1 回だけ通知する。
 *
 * ── 増えた分だけ渡す（長い配信の文脈・context-growth-2026-10.md §5・§6）───────────────────────
 *  頭のセッションが conversationKey()（今の会話 = Codex の thread の識別子・次の ask が新しい会話なら null）を
 *  持つときだけ、前回の ask で渡した最後の seq より後ろの行だけを渡す（formatFireInjectionSince・チャッピーの
 *  実際に聞こえた分の soul 行も含む・新しい行が無ければ「（前回から新しい発言はなし）」・窓と 4000 字の上限は
 *  そのまま）。会話が新しく始まったとき・頭のセッションが替わったとき・Codex が内部で thread を作り直したとき
 *  （turn の失敗・接続の作り直し）は key が変わるので、従来どおり直近 5 分を全部渡す。conversationKey を
 *  持たない頭（Claude）は従来のまま（毎回直近 5 分）。空窓（直近 5 分に 1 行も無い）の判定は従来どおり全体で行う。
 *  onAsk・onFire（受理）の範囲と行数・文字数は実際に渡した分をそのまま出す。
 *  ask が返るたびに onAskRecord（発火番号・頭・渡した行数と文字数・usage・tokenUsage・最初の文字までの時間。
 *  本文なし）を通知する（結線層が起動ごとの記録ファイルへ 1 行書く）。
 *
 * ── 思い出しの目印と、黙って渡す前置き（記憶の作り直し Wave 3 Domain D）──────────────────────────
 *  返事の中の `<recall 頼みごと>`（表情とは別の語彙集合・recall-tag.mjs）は声にも会話ログにも出さず、
 *  **返事が終わったあと**（fire() が結果を返す直前・状態は idle に戻った後）に、頼みごとごとに
 *  `onRecallRequest({ request, fireId })` で結線層（思い出しの係）へ渡す。逐次の読み上げ（Codex）では
 *  逐次の部品が読んだ tags から、一括の読み上げでは最後の parser の結果から拾う。ask が失敗した返事・
 *  キルで捨てた返事・NG で没にした返事・dispose で畳んだ返事の目印は渡さない。
 *  `deferInstruction(text)` は、次の ask の先頭に 1 回だけ黙って前置きする内部の文を積む（progressive
 *  correction と同じ形・会話ログには残らない）。思い出した中身を「今は言わない」ときに①へ渡す口。
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

import { speakOnce as defaultSpeak, createSpeechStreamer } from "../voice/speech-streamer.mjs";
import { createVoiceEngine, DEFAULT_VOICE_ENGINE_KIND } from "../voice/engines/voice-engine.mjs";
import { formatFireInjection, formatFireInjectionSince, FIRE_WINDOW_MS, FIRE_MAX_CHARS } from "./fire-injection.mjs";
import { parseExpressionTags } from "./expression-parser.mjs";
import { translateExpression } from "./expression-translator.mjs";
import { captureWindow as defaultCaptureWindow } from "../eyes/window-capture.mjs";
import {
  computeSpokenPrefix,
  BARGE_IN_NOTE,
  KILL_NOTE,
  MOUTH_CLOSE_SLOT_ID,
  MOUTH_CLOSE_TTL_MS
} from "./barge-in.mjs";
import { containsNgWord, NG_BLOCKED_NOTE } from "./ng-words.mjs";
import { createIncrementalSentenceTagBuffer } from "./incremental-sentence-tag-buffer.mjs";
import { DEFAULT_MODEL_IDENTITY, MODEL_IDENTITIES } from "./model-identity.mjs";
import { createFireTiming } from "./fire-latency.mjs";
import { appendSoulSkills, loadSoulSkills } from "./soul-skills.mjs";
import { performance } from "node:perf_hooks";

/** 視覚発火の最小指示文（wave 計画 §2 裁定・人格の作り込みはしない＝persona の領分）。 */
const VISION_INSTRUCTION_TEXT = "今の画面を見て、直近の会話と合わせて自然に反応してください。";

/** C3 visible canonical marker. It deliberately carries no diagnostic cause. */
export const PROGRESSIVE_INTERRUPTION_NOTE = "（応答は途中で中断されました）";

/**
 * One-shot internal continuity correction for the first ask after a partial
 * progressive delivery. The visible transcript already contains the exact
 * heard prefix, so this instruction never repeats private model output.
 */
export const PROGRESSIVE_CONTINUITY_INSTRUCTION =
  "[内部の会話継続情報: 直前のアシスタント応答は途中で中断され、表示された発話済み部分だけが相手に届いています。内部スレッドに残る未配信部分は相手が聞いていないものとして扱い、必要がない限り発話済み部分を繰り返さないでください。]";

/**
 * 最小仮面（v0）の発火用システムプロンプト（wave 計画 §2 裁定 4）。
 * **意図的に貧しく**——凝るのは persona の領分。本番結線（Domain B）が createLlmSession に渡す想定
 * （orchestrator 自身は session を受け取るだけ）。
 *
 * S4: 表情タグ 6 語の教示を最小限だけ足す（人格の作り込みはしない＝persona の領分・引き続き貧しく）。
 *
 * 自己名の一言を追加（既定は耳側の呼びかけ検出 NAME_VARIANTS_V0「コーディ」と一致させ、呼ばれても自分の
 * 名前だと認識できるようにする最小の事実のみ）。Domain C の builder はこの一行だけを現在の frozen
 * model-family identity に差し替え、人格描写やキャラ付けは足さない＝persona の領分。
 *
 * 指示の切り分け（応答の遅れの直し・latency-fix-plan.md §2-4）: ここ（会話指示の既定・ユーザーが編集できる）は
 * 話し方の部分だけにした。仕組みを教える部分（表情タグ 6 語の使い方と例・画面が渡されること）は、思い出す教えと
 * 同じ固定のファイル（skills/expression.md・skills/screen.md・soul-skills.mjs）に移し、魂が①の固定の部分に足す
 * （会話指示を書き換えても消えない）。
 */
const FIRE_SYSTEM_PROMPT_BODY =
  "あなたは配信の相方です。直前の会話を踏まえ、短く自然な日本語で一言だけ返してください。" +
  "箇条書き・記号・長い説明はしないでください。";

/**
 * Build the self-name line for a newly-created Fire session.
 *
 * The identity object comes from the frozen model registry. Invalid or absent
 * values deliberately use the existing Cody default, keeping the exported
 * FIRE_SYSTEM_PROMPT byte-compatible for Claude callers.
 *
 * @param {unknown} [identity]
 * @returns {string}
 */
/**
 * The editable conversation-instruction body starts from this exact legacy
 * body. Keep the export separate from the generated identity line so Cockpit
 * can persist one override per technical brain without touching identity,
 * memory, transcript, or provider settings.
 */
export const DEFAULT_CONVERSATION_INSTRUCTION_BODY = FIRE_SYSTEM_PROMPT_BODY;
/** Backwards-friendly shorter alias for consumers of the profile resolver. */
export const DEFAULT_CONVERSATION_INSTRUCTION = DEFAULT_CONVERSATION_INSTRUCTION_BODY;

/** The only technical brain ids that may carry a conversation override. */
export const CONVERSATION_INSTRUCTION_BRAIN_IDS = Object.freeze([
  "claude",
  "claude-opus-55",
  "codex",
  "codex-56-sol",
  "codex-astra",
  "codex-61-sol"
]);

/** @param {unknown} value */
function normalizeConversationInstruction(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * Resolve the effective editable body for one technical brain.
 *
 * Unknown ids and malformed/empty overrides deliberately retain the Claude
 * default. The returned object is a fresh frozen value so callers cannot
 * mutate the canonical profile or accidentally share a draft with storage.
 *
 * @param {unknown} brainId
 * @param {unknown} [overrides]
 * @returns {{ brainId: string; defaultBody: string; override: string | null; body: string; hasOverride: boolean }}
 */
export function resolveConversationInstructionProfile(brainId, overrides = undefined) {
  const knownBrain = CONVERSATION_INSTRUCTION_BRAIN_IDS.includes(brainId);
  const id = knownBrain ? brainId : "claude";
  const record = overrides && typeof overrides === "object" ? /** @type {any} */ (overrides) : null;
  // An unknown technical id falls back to the byte-compatible default profile;
  // it must not accidentally inherit a saved override belonging to Claude.
  const override = knownBrain ? normalizeConversationInstruction(record ? record[id] : null) : null;
  return Object.freeze({
    brainId: id,
    defaultBody: DEFAULT_CONVERSATION_INSTRUCTION_BODY,
    override,
    body: override ?? DEFAULT_CONVERSATION_INSTRUCTION_BODY,
    hasOverride: override != null
  });
}

/**
 * Build a Fire system prompt with the generated identity line followed by an
 * effective conversation body. The one-argument form remains byte-compatible
 * with the existing Cody default prompt.
 *
 * @param {unknown} [identity]
 * @param {unknown} [conversationInstruction]
 * @returns {string}
 */
export function buildFireSystemPrompt(identity = DEFAULT_MODEL_IDENTITY, conversationInstruction = undefined) {
  const resolved =
    identity && typeof identity === "object" &&
    (/** @type {any} */ (identity).id === "cody" || /** @type {any} */ (identity).id === "chappy")
      ? MODEL_IDENTITIES[/** @type {"cody" | "chappy"} */ (/** @type {any} */ (identity).id)]
      : DEFAULT_MODEL_IDENTITY;
  const body = normalizeConversationInstruction(conversationInstruction) ?? DEFAULT_CONVERSATION_INSTRUCTION_BODY;
  return `あなたの名前は${resolved.canonicalName}（${resolved.latinName}）です。${body}`;
}

/**
 * Cody の既定の固定の指示（名前の一文 + 会話指示の既定 + 魂の教え）。操縦席が①に渡すもの（名前 + 会話指示 + 教え・
 * scripts/cockpit.mjs）と同じ組み立てで、観測用のスクリプト（measure-fire 等・Claude の頭）にも同じ内容が届く。
 * 教え（skills/）はこのモジュールを読み込んだ時点のもの。
 */
export const FIRE_SYSTEM_PROMPT = appendSoulSkills(buildFireSystemPrompt(), loadSoulSkills());

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
 * @param {typeof defaultSpeak} [options.speakImpl]  一括の読み上げ（既定 speech-streamer の speakOnce）。テスト差し替え可能。
 *   返りの `ended`（Promise）で鳴り終わりを、`snapshot()` で切断点の材料（時間割・STARTED 時刻）を、
 *   `stop(cause)` で止め方を渡す。持たない返りは「返った時点で鳴り終わった」とみなす。
 * @param {{ openSpeech?: Function; appendSpeech?: Function; endSpeech?: Function; sendEnvelope?: Function; sendSet?: Function }} [options.channel]
 *   発話（intent.speechStream）・演出・口閉じの送出へ渡す接続済みチャネル。
 * @param {number} [options.expressionIntensity=1.0]  演出強さ係数（全 peak 一括スケール・表の外で適用）。
 * @param {any} [options.player]  常駐の流し込みプレイヤー（stream-player.mjs・open/write/end/stop/onEvent）。
 * @param {import("../voice/engines/voice-engine.mjs").VoiceEngine} [options.engine]  声の差し替え口。
 *   未指定（かつ acquireFireResources も engine を渡さない）なら speakDeps から AivisSpeech の engine を作る。
 * @param {object} [options.speakDeps]  既定の AivisSpeech engine へ渡す deps（tts/ttsBaseUrl/speaker/sConfig）。
 * @param {() => object | Promise<object>} [options.acquireFireResources]
 *   accepted 公開前に exact session/channel/player/engine snapshot を取得する production seam。
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
 *   自然完了時（processAskedReply の通常完了パス）は entry に `latencyMs`（asked.elapsedMs 実測・
 *   非数値なら null）を additive で乗せる（多頭化 Domain C・観測層の応答レイテンシ実値化）。
 *   NG ブロック時/barge-in 中断時の soul 追記は既存どおり latencyMs を持たない entry（結線層側で null 扱い）。
 * @param {(info: object) => void} [options.onExpression]  演出適用の通知（語ごとに {word, args?, applied, rejected}）。
 * @param {(info: { title: string; width: number; height: number; jpegBase64: string; elapsedMs: number }) => void} [options.onVisionCaptured]
 *   視覚発火のキャプチャ成功通知（「見た」事実・サムネ用 base64 はここにだけ載る。会話ログには積まない）。
 * @param {(info: { usage: any; vision: boolean }) => void} [options.onUsage]
 *   ask ごとの usage 通知（通常 Fire・視覚発火の両方・usage が null/undefined のときは発火しない）。
 * @param {(chunk: { text: string; index: number; final: boolean }) => void} [options.onProgressiveSentence]
 *   Codex delta から確定した safe sentence の同期 enqueue seam。C1 では playback を所有せず、
 *   production default（未注入）は既存の最終一括 speak を維持する。
 * @param {boolean} [options.progressivePlayback=false] production Cockpit enables the Wave 2 queue adapter.
 * @param {typeof createSpeechStreamer} [options.speechStreamerFactory]  Codex の文ごとの読み上げの運び手（既定 createSpeechStreamer）。
 * @param {(outcome: object) => void} [options.onProgressiveTerminal] C3 projection seam.
 * @param {typeof setTimeout} [options.setTimeoutImpl=setTimeout]  発話の見張りタイマの注入（SpeechStreamer へ渡す）。
 * @param {typeof clearTimeout} [options.clearTimeoutImpl=clearTimeout]  見張りタイマの解除（注入）。
 * @param {(info: { fireId: number; windowFirstSeq: number | null; windowLastSeq: number | null; includedCount: number; vision: boolean; atMs: number }) => void} [options.onAsk]
 *   ask の直前の通知（推論に使った会話の窓の始まりと終わりの seq・全経路）。
 * @param {(info: import("./fire-latency.mjs").FireLatency) => void} [options.onLatency]
 *   1 返事 1 回の遅延の通知（発火の中の区間）。声が鳴り始めた時点、鳴らなかったときは発火の終わり（ask した回だけ）。
 * @param {() => number} [options.monotonicNowImpl]  遅延を測る単調時計（既定 performance.now・テスト注入）。
 * @param {(info: { fireId: number | null; brain: string | null; vision: boolean; windowMode: "legacy" | "full" | "delta"; includedCount: number; injectedChars: number; usage: any; tokenUsage: any; ttftMs: number | null; elapsedMs: number | null; serviceTier: string | null; atMs: number }) => void} [options.onAskRecord]
 *   ask が返るたびの記録（本文なし・数字と種類だけ）。windowMode は渡した会話の窓の種類
 *   （legacy = 会話の世代を持たない頭の従来の窓 / full = 新しい会話なので直近 5 分の全部 / delta = 増えた分だけ）。
 * @param {(info: { request: string; fireId: number | null }) => void} [options.onRecallRequest]
 *   返事の中の思い出しの目印（`<recall 頼みごと>`）を、返事が終わったあとに 1 つずつ渡す（記憶の作り直し Wave 3）。
 * @param {boolean} [options.initialKilled=false]  キル状態の初期値（S8）。キル状態の正本はサーバ側
 *   （Domain B）にあるため、orchestrator 生成時にサーバの現況を渡し「キル中に生まれる orchestrator は
 *   キル済みで生まれる」不変を成立させる（born-killed）。
 * @returns {{ fire: (fireOptions?: { vision?: boolean | "preferred"; instruction?: string; cause?: object }) => Promise<object>; interrupt: (atMs?: number) => Promise<object>; kill: (atMs?: number) => Promise<object>; revive: () => void; getKilled: () => boolean; getState: () => FireState; deferInstruction: (text: string) => boolean; dispose: () => void }}
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
  const acquireFireResources = options.acquireFireResources;
  const windowMs = options.windowMs ?? FIRE_WINDOW_MS;
  const maxChars = options.maxChars ?? FIRE_MAX_CHARS;
  const nowImpl = options.nowImpl ?? Date.now;
  const captureImpl = options.captureImpl ?? defaultCaptureWindow;
  const getVisionTarget = options.getVisionTarget;
  const expressionIntensity =
    typeof options.expressionIntensity === "number" ? options.expressionIntensity : 1.0;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const {
    onState,
    onFire,
    onDiagnostic,
    onSoulTranscript,
    onExpression,
    onVisionCaptured,
    onUsage,
    onTrace,
    onProgressiveSentence,
    onProgressiveTerminal,
    onAsk,
    onLatency,
    onAskRecord,
    onRecallRequest
  } = options;
  const monotonicNowImpl = options.monotonicNowImpl ?? (() => performance.now());
  const progressivePlayback = options.progressivePlayback === true;
  const speechStreamerFactory = options.speechStreamerFactory ?? createSpeechStreamer;
  /** speakDeps → 既定の AivisSpeech engine（engine を渡されなかったときだけ作る）。 */
  const defaultEngines = new WeakMap();

  /** @type {FireState} */
  let state = "idle";
  // Resource acquisition and vision-target resolution happen before `thinking`.
  // Claim synchronously so two callers cannot both become an accepted Fire in
  // that pre-publication window (and cannot race a one-shot C3 correction).
  let fireClaimed = false;
  let disposed = false;
  /** キル状態（S8）。true の間は全発火経路を閉じる（fire() 冒頭ガード・唯一の合流点）。 */
  let killed = options.initialKilled === true;

  /**
   * 再生実区間の追跡（S6）。speak() 後〜発話完了/中断まで有効。null = 現在発話中でない。
   * spoken は speakImpl の返り（ended / snapshot / stop を持ちうる）。timeline / playbackStartedAtMs は
   * snapshot を持たない返りのための材料。
   * @type {null | {
   *   buffer: { append: Function };
   *   speechText: string;
   *   spoken: any;
   *   timeline: Array<any>;
   *   playbackStartedAtMs: number | null;
   *   interrupted: boolean;
   *   appended: boolean;
   *   resolve: (outcome: { interrupted: boolean; disposed?: boolean; failed?: boolean; error?: unknown; cause?: string | null; elapsedMs?: number; charsSpoken?: number; prefix?: string }) => void;
   * }}
   */
  let currentPlayback = null;
  /** @type {ReturnType<typeof createSpeechStreamer> | null} */
  let currentProgressiveDelivery = null;
  let currentProgressiveBoundary = null;
  let currentFireResources = null;
  let nextProgressiveGeneration = 0;
  const reportedProgressiveGenerations = new Set();
  /** Exact generation -> accepted Fire transcript owner. */
  const progressiveProjectionOwners = new Map();
  /** Latest unconsumed partial; single-flight Fire makes one pending slot sufficient. */
  let pendingProgressiveCorrection = null;
  /**
   * 受理した 1 発だけに付く内部指示（`fire({ instruction })`・コメント反応でどのコメントかを明示する・
   * discussion/ai-cohost/decisions/comment-react/integration.md §1-7）。ask の先頭に付けるだけで、会話ログ
   * （転写バッファ）には残らない（progressive correction と同じ作り）。fire() の finally で必ず畳む。
   * @type {string | null}
   */
  let currentFireInstruction = null;
  /**
   * 次の ask の先頭に 1 回だけ黙って前置きする内部の文（deferInstruction・思い出した中身を「今は言わない」とき）。
   * 次の ask で全部まとめて使い切る（progressive correction と同じ形）。多すぎるときは古い方から捨てる。
   * @type {string[]}
   */
  let pendingDeferredInstructions = [];
  /** 受理した発火に振る番号（1 から）。 */
  let nextFireId = 0;
  /**
   * 今の 1 発（fire() の claim から finally まで）。fireId は受理した時点で振る（受理しなかった発火は null）。
   * single-flight なので 1 つで足りる。
   * recall は思い出しの目印の拾い場所（streamed = 逐次の部品が読んだもの・final = 最後の parser の結果・
   * discard = 渡さない返事）。
   * @type {null | { fireId: number | null; cause: object | null; vision: boolean; timing: ReturnType<typeof createFireTiming>; latencyEmitted: boolean; recall: { sawDelta: boolean; streamed: Array<{ request: string }>; final: Array<{ request: string }> | null; discard: boolean } }}
   */
  let currentFire = null;

  /**
   * 増えた分だけ渡すための目印: 前回 ask が返った会話（session と conversationKey）と、そこまでに渡した最後の seq。
   * 会話が替わったら使わない（直近 5 分を全部渡す）。
   * @type {null | { session: any; key: string; lastSeq: number | null }}
   */
  let conversationCursor = null;

  /** 受理した発火に番号を振る（冪等・劣化フォールバックで二重に振らない）。 */
  const acceptFireId = () => {
    if (!currentFire) return null;
    if (currentFire.fireId == null) currentFire.fireId = ++nextFireId;
    return currentFire.fireId;
  };
  /** 受理の通知に載せる番号ときっかけ。 */
  const acceptedTags = () => ({ fireId: acceptFireId(), cause: currentFire ? currentFire.cause : null });
  /** soul の追記 entry に今の発火番号を載せる（正本の frozen entry は変えずコピー）。 */
  const withFireId = (/** @type {any} */ entry, /** @type {number | null | undefined} */ fireId = currentFire?.fireId) => ({
    ...entry,
    fireId: fireId ?? null
  });
  /** 遅延を 1 返事 1 回だけ通知する（声が鳴り始めた時点 or 発火の終わり）。 */
  const emitLatencyOnce = (/** @type {boolean} */ spoken) => {
    const fire = currentFire;
    if (!fire || fire.latencyEmitted || fire.fireId == null || !fire.timing.hasAsked()) return;
    fire.latencyEmitted = true;
    emit(onLatency, {
      fireId: fire.fireId,
      cause: fire.cause,
      vision: fire.vision,
      spoken,
      ...fire.timing.segments(),
      serviceTier: typeof fire.serviceTier === "string" ? fire.serviceTier : null
    });
  };
  /**
   * ask の直前に、その回の LLM に渡した会話の窓の範囲を通知する。
   * @param {{ firstSeq: number | null; lastSeq: number | null; includedCount: number }} injection @param {boolean} vision
   */
  const emitAsk = (injection, vision) => {
    if (currentFire) currentFire.vision = vision;
    emit(onAsk, {
      fireId: currentFire?.fireId ?? null,
      windowFirstSeq: injection.firstSeq ?? null,
      windowLastSeq: injection.lastSeq ?? null,
      includedCount: injection.includedCount,
      vision,
      atMs: nowImpl()
    });
  };

  /**
   * 頭のセッションの今の会話の識別子。口を持たない頭（Claude）は undefined、次の ask が新しい会話なら null。
   * @param {any} target
   * @returns {string | null | undefined}
   */
  const conversationKeyOf = (target) => {
    if (!target || typeof target.conversationKey !== "function") return undefined;
    try {
      const key = target.conversationKey();
      return typeof key === "string" && key.length > 0 ? key : null;
    } catch {
      return null;
    }
  };

  /**
   * この ask に渡す会話の窓を作る。同じ会話が続いていれば前回より後ろの行だけ、そうでなければ従来の窓。
   * fullWindow を渡されたら（通常の発火の空窓判定で作ったもの）従来の窓としてそれを使う（同じ時刻で作り直さない）。
   * @param {{ all: Function }} buffer  @param {any} resources  @param {number} nowMs
   * @param {ReturnType<typeof formatFireInjection>} [fullWindow]
   */
  const buildInjection = (buffer, resources, nowMs, fullWindow) => {
    const target = resources?.session;
    const key = conversationKeyOf(target);
    const cursor = conversationCursor;
    if (typeof key === "string" && cursor && cursor.session === target && cursor.key === key) {
      return {
        injection: formatFireInjectionSince(buffer.all(), { nowMs, windowMs, maxChars, afterSeq: cursor.lastSeq }),
        windowMode: /** @type {"delta"} */ ("delta")
      };
    }
    return {
      injection: fullWindow ?? formatFireInjection(buffer.all(), { nowMs, windowMs, maxChars }),
      windowMode: key === undefined ? /** @type {"legacy"} */ ("legacy") : /** @type {"full"} */ ("full")
    };
  };

  /**
   * ask が返った後に目印を進める（その会話へ渡した最後の seq）。会話の世代を持たない頭・会話が無くなった頭では消す。
   * @param {any} resources  @param {{ lastSeq: number | null }} injection  @param {string} windowMode
   */
  const commitInjection = (resources, injection, windowMode) => {
    const target = resources?.session;
    const key = conversationKeyOf(target);
    if (typeof key !== "string") {
      conversationCursor = null;
      return;
    }
    const cursor = conversationCursor;
    const sameConversation = windowMode === "delta" && cursor && cursor.session === target && cursor.key === key;
    const previous = sameConversation ? cursor.lastSeq : null;
    conversationCursor = { session: target, key, lastSeq: injection.lastSeq ?? previous };
  };

  /**
   * ask が返るたびの記録（本文なし）。
   * @param {any} asked  @param {any} resources  @param {boolean} vision  @param {string} windowMode
   * @param {{ includedCount: number; charCount: number }} injection  @param {number} injectedChars
   */
  const emitAskRecord = (asked, resources, vision, windowMode, injection, injectedChars) => {
    if (typeof onAskRecord !== "function") return;
    const num = (/** @type {unknown} */ v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    emit(onAskRecord, {
      fireId: currentFire?.fireId ?? null,
      brain: typeof resources?.configuration?.brain === "string" ? resources.configuration.brain : null,
      vision,
      windowMode,
      includedCount: injection.includedCount,
      injectedChars,
      usage: asked && asked.usage != null ? asked.usage : null,
      tokenUsage: asked && asked.tokenUsage != null ? asked.tokenUsage : null,
      ttftMs: num(asked?.ttftMs),
      elapsedMs: num(asked?.elapsedMs),
      // その返事の turn/start に送った速さの段（Codex の頭が返す・送っていなければ null）。
      serviceTier: typeof asked?.serviceTier === "string" ? asked.serviceTier : null,
      atMs: nowImpl()
    });
  };

  const acquireResources = async () => {
    const supplied =
      typeof acquireFireResources === "function" ? await acquireFireResources() : {};
    const resources = {
      session: supplied?.session ?? session,
      channel: supplied?.channel ?? channel,
      player: supplied?.player ?? player,
      engine: supplied?.engine ?? options.engine ?? null,
      speakDeps: Object.freeze({ ...speakDeps, ...(supplied?.speakDeps ?? {}) }),
      configuration: Object.freeze({ ...(supplied?.configuration ?? {}) }),
      metadata: Object.freeze({ ...(supplied?.metadata ?? {}) })
    };
    if (!resources.session || typeof resources.session.ask !== "function") {
      throw new Error("accepted Fire snapshot has no session.ask().");
    }
    return Object.freeze(resources);
  };

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

  /** Release Runtime mouth timeline after either legacy or progressive stop. */
  const releaseMouth = async (diagnosticType, resources = currentFireResources) => {
    const ownedChannel = resources?.channel ?? channel;
    try {
      if (ownedChannel && typeof ownedChannel.sendSet === "function") {
        const outcome = await ownedChannel.sendSet({
          slotId: MOUTH_CLOSE_SLOT_ID,
          value: 0,
          ttlMs: MOUTH_CLOSE_TTL_MS
        });
        if (!(outcome && outcome.result === "accepted")) {
          emit(onDiagnostic, {
            type: `${diagnosticType}MouthCloseRejected`,
            slotId: MOUTH_CLOSE_SLOT_ID,
            error: outcome && outcome.error != null ? outcome.error : null
          });
        }
      } else {
        emit(onDiagnostic, {
          type: `${diagnosticType}MouthCloseError`,
          slotId: MOUTH_CLOSE_SLOT_ID,
          message: "channel has no sendSet"
        });
      }
    } catch (err) {
      emit(onDiagnostic, {
        type: `${diagnosticType}MouthCloseError`,
        slotId: MOUTH_CLOSE_SLOT_ID,
        message: errMessage(err)
      });
    }
  };

  /**
   * この Fire の声の差し替え口。snapshot が engine を持てばそれ、無ければ speakDeps から AivisSpeech の engine
   * を作る（同じ speakDeps には同じ engine）。
   * @param {any} resources
   */
  const resolveEngine = (resources) => {
    if (resources?.engine) return resources.engine;
    const deps = resources?.speakDeps ?? speakDeps;
    let engine = defaultEngines.get(deps);
    if (!engine) {
      engine = createVoiceEngine(DEFAULT_VOICE_ENGINE_KIND, deps);
      defaultEngines.set(deps, engine);
    }
    return engine;
  };

  /**
   * SpeechStreamer が中断・失敗のあとに呼ぶ口の release。barge-in / kill は従来と同じ診断名
   * （bargeIn… / kill…）で握り、それ以外（失敗・dispose）は診断を増やさず静かに送る。
   * @param {any} resources
   */
  const streamReleaseMouth = (resources) => async (/** @type {{ cause: string }} */ info) => {
    if (info?.cause === "barge-in") return releaseMouth("bargeIn", resources);
    if (info?.cause === "killed") return releaseMouth("kill", resources);
    const ownedChannel = resources?.channel ?? channel;
    if (!ownedChannel || typeof ownedChannel.sendSet !== "function") return;
    await ownedChannel.sendSet({ slotId: MOUTH_CLOSE_SLOT_ID, value: 0, ttlMs: MOUTH_CLOSE_TTL_MS });
  };

  /** Fire-local passive trace; values supplied below are deliberately content-free. */
  const trace = (/** @type {string} */ event, /** @type {Record<string, unknown>} */ fields = {}) => {
    if (currentFire) {
      try {
        currentFire.timing.observe(event, fields);
      } catch {
        // 遅延の計測で発火経路を壊さない。
      }
      // 声が鳴り始めた = 最初の文の STARTED（voice.player.started・文ごと/一括の両方・engine に依存しない名前）。
      if (event === "voice.player.started" && currentFire.timing.hasVoiceStarted()) emitLatencyOnce(true);
    }
    emit(onTrace, { event, ...fields });
  };

  const emitProgressiveTerminalOnce = (outcome) => {
    if (!outcome || reportedProgressiveGenerations.has(outcome.generationId)) return;
    reportedProgressiveGenerations.add(outcome.generationId);
    const owner = progressiveProjectionOwners.get(outcome.generationId);
    progressiveProjectionOwners.delete(outcome.generationId);
    if (
      owner &&
      outcome.status !== "completed" &&
      outcome.completedSentenceCount > 0 &&
      typeof outcome.playedText === "string" &&
      outcome.playedText.length > 0
    ) {
      const text = `${outcome.playedText}\n${PROGRESSIVE_INTERRUPTION_NOTE}`;
      const appended = owner.buffer.append({ startMs: 0, endMs: 0, text, speaker: "soul" });
      if (appended && appended.appended && appended.entry) {
        emit(onSoulTranscript, withFireId(appended.entry, owner.fireId));
        // Commit only after the canonical visible projection exists. The next
        // actual ask consumes this once; pre-ask capture/resource failures do not.
        pendingProgressiveCorrection = Object.freeze({ sourceGenerationId: outcome.generationId });
        trace("progressive.partial.projected", {
          generationId: outcome.generationId,
          playedChars: outcome.playedText.length,
          completedSentenceCount: outcome.completedSentenceCount,
          terminalCause: outcome.terminalCause
        });
      }
    }
    emit(onProgressiveTerminal, outcome);
  };

  /** 黙って渡す前置き（deferInstruction）を次の ask で 1 回だけ使い切る。 */
  const consumeDeferredInstructions = (content) => {
    if (pendingDeferredInstructions.length === 0) return content;
    const notes = pendingDeferredInstructions;
    pendingDeferredInstructions = [];
    trace("deferred.instruction.consumed", { count: notes.length });
    return prependInstruction(content, notes.join("\n\n"));
  };

  const consumeProgressiveCorrection = (content) => {
    const correction = pendingProgressiveCorrection;
    if (correction == null) return content;
    pendingProgressiveCorrection = null;
    trace("progressive.continuity.consumed", {
      sourceGenerationId: correction.sourceGenerationId
    });
    return prependInstruction(content, PROGRESSIVE_CONTINUITY_INSTRUCTION);
  };

  /**
   * One accepted Fire owns one incremental boundary. App Server delta text enters
   * this pure Wave 1B buffer exactly once. Safe completed sentences are exposed
   * immediately through a synchronous enqueue seam; playback ownership remains
   * intentionally outside C1.
   */
  const createProgressiveBoundary = (delivery = null) => {
    const incremental = createIncrementalSentenceTagBuffer();
    let sawDelta = false;
    let flushed = false;
    let stopped = false;
    let blocked = false;
    let sentenceCount = 0;
    let safeChars = 0;

    /** @param {{ sentences: string[]; tags?: Array<{ recalls?: Array<{ request: string }> }> }} output @param {boolean} final */
    const enqueue = (output, final) => {
      // 思い出しの目印（逐次の部品が読んだ tags）。声とは別に、この発火の拾い場所へ積む。
      if (currentFire && Array.isArray(output.tags)) {
        for (const tag of output.tags) {
          for (const recall of tag.recalls ?? []) currentFire.recall.streamed.push({ request: recall.request });
        }
      }
      for (const text of output.sentences) {
        if (stopped) break;
        // The sentence was assembled by the pure buffer, so this catches an NG
        // word even when the source word was fragmented across transport deltas.
        if (containsNgWord(text)) {
          stopped = true;
          blocked = true;
          delivery?.abort("ng-blocked");
          trace("progressive.boundary.blocked", { sentenceCount, safeChars });
          break;
        }
        const index = sentenceCount;
        sentenceCount += 1;
        safeChars += text.length;
        if (index === 0) trace("progressive.first_safe_sentence", { speechChars: text.length, final });
        trace("progressive.sentence.enqueued", { index, speechChars: text.length, final });
        delivery?.enqueue({ text, index, final });
        if (typeof onProgressiveSentence === "function") {
          onProgressiveSentence({ text, index, final });
        }
      }
    };

    return {
      /** @param {string} delta */
      append(delta) {
        if (!sawDelta) trace("llm.first_delta", { deltaChars: delta.length });
        sawDelta = true;
        // 締めた（本文の揃った agentMessage で flush した）後に本文が続いた（次の agentMessage）。最後にもう一度締める。
        flushed = false;
        trace("llm.delta.received", { deltaChars: delta.length });
        enqueue(incremental.append(delta), false);
      },
      /** 締め（残りを最後の文として出す）。締めた後に本文が続かなければ、2 回目は何もしない。 */
      flush() {
        if (flushed) return;
        flushed = true;
        enqueue(incremental.flush(), true);
        trace("progressive.boundary.flushed", { sentenceCount, safeChars, blocked });
      },
      stop() {
        stopped = true;
      },
      snapshot() {
        return { sawDelta, flushed, stopped, blocked, sentenceCount, safeChars };
      }
    };
  };

  /**
   * Shared normal/vision ask seam. Passing options is additive for Claude (its
   * one-argument implementation ignores them) and reaches App Server through
   * Cockpit's transparent session proxy for the Codex brains.
   * @param {string | Array<any>} content
   */
  const askIncrementally = async (content, resources, buffer) => {
    // Production snapshots identify Claude explicitly. Its full-result session
    // keeps the legacy one-shot path; the Codex brains own delta delivery.
    // 2026-10-16: Claude Opus 5.5（"claude-opus-55"）も同じ llm-session（onTextDelta を受けない）なので
    // Claude 既定と同じ one-shot 経路に倒す。
    const configuredBrain = resources.configuration?.brain;
    const progressiveEligible = configuredBrain !== "claude" && configuredBrain !== "claude-opus-55";
    const delivery = progressivePlayback && progressiveEligible
      ? speechStreamerFactory({
          generationId: `fire-${++nextProgressiveGeneration}`,
          engine: resolveEngine(resources),
          channel: resources.channel,
          player: resources.player,
          releaseMouth: streamReleaseMouth(resources),
          onTrace: (event, fields) => trace(event, fields),
          onPlaybackStarted: () => setState("speaking"),
          nowImpl,
          setTimeoutImpl,
          clearTimeoutImpl
        })
      : null;
    currentProgressiveDelivery = delivery;
    if (delivery) {
      progressiveProjectionOwners.set(delivery.snapshot().generationId, { buffer, fireId: currentFire?.fireId ?? null });
    }
    if (delivery && typeof delivery.whenSettled === "function") {
      void delivery.whenSettled().then(emitProgressiveTerminalOnce);
    }
    const boundary = createProgressiveBoundary(delivery);
    currentProgressiveBoundary = boundary;
    try {
      // 先頭から: progressive correction → 黙って渡す前置き（思い出し）→ この 1 発の内部指示（コメント反応・
      // 思い出しの結果）→ 会話窓（+ 画像）。
      const askContent = consumeProgressiveCorrection(
        consumeDeferredInstructions(currentFireInstruction ? prependInstruction(content, currentFireInstruction) : content)
      );
      // 締めの合図（応答の遅れの直し・latency-fix-plan.md §2-2）: Codex は本文の揃った agentMessage の item/completed
      // （commentary を除く）で onTextDone を呼ぶ。turn/completed（ask の戻り）を待たずに残りを最後の文として声に回す。
      // 速さの段（操縦席の fast・Codex の頭のときだけ受理の時点の設定が configuration に載る）。送った段は
      // turn/start の直後に知らされ、遅延の行（onLatency）に載せる。載っていない（Claude 等）なら渡さない。
      const configuredServiceTier =
        typeof resources.configuration?.serviceTier === "string" ? resources.configuration.serviceTier : null;
      const askFire = currentFire;
      const asked = await resources.session.ask(askContent, {
        onTextDelta: (delta) => boundary.append(delta),
        onTextDone: () => boundary.flush(),
        ...(configuredServiceTier
          ? {
              serviceTier: configuredServiceTier,
              onTurnStarted: (/** @type {any} */ meta) => {
                if (askFire) askFire.serviceTier = typeof meta?.serviceTier === "string" ? meta.serviceTier : null;
              }
            }
          : {})
      });
      // delta を出さない頭（Claude）の「LLM 最初の文字」は session が測った ttftMs を使う（fire-latency.mjs）。
      if (currentFire && asked && typeof asked === "object") currentFire.timing.noteTtft(/** @type {any} */ (asked).ttftMs);
      // A successful terminal result owns exactly one final remainder flush. 締めの合図で済んでいれば何もしない
      // （二重に flush しない）。合図の後に本文が続いたときだけ、その残りをここで締める。
      boundary.flush();
      const progressive = boundary.snapshot();
      if (currentFire) currentFire.recall.sawDelta = progressive.sawDelta;
      const deliveryOutcome = delivery ? await delivery.finish() : null;
      return { asked, progressive, deliveryOutcome };
    } catch (error) {
      if (delivery) {
        delivery.abort("llm-failed");
        const deliveryOutcome = await delivery.finish();
        if (error instanceof Error) /** @type {any} */ (error).progressiveDelivery = deliveryOutcome;
      }
      throw error;
    } finally {
      if (currentProgressiveBoundary === boundary) currentProgressiveBoundary = null;
      if (currentProgressiveDelivery === delivery) currentProgressiveDelivery = null;
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
  const applyExpressions = async (events, resources) => {
    const ownedChannel = resources?.channel ?? channel;
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
          trace("expression.request.started", { kind: "intent.envelope", slotId: payload.slotId });
          if (!ownedChannel || typeof ownedChannel.sendEnvelope !== "function") {
            rejected += 1;
            trace("expression.request.failed", { kind: "intent.envelope", slotId: payload.slotId, failure: "unsupported" });
            emit(onDiagnostic, { type: "expressionSendError", slotId: payload.slotId, message: "channel has no sendEnvelope" });
            return;
          }
          const outcome = await ownedChannel.sendEnvelope(payload);
          if (outcome && outcome.result === "accepted") {
            applied += 1;
            trace("expression.request.completed", { kind: "intent.envelope", slotId: payload.slotId, result: "accepted" });
          } else {
            rejected += 1;
            trace("expression.request.completed", { kind: "intent.envelope", slotId: payload.slotId, result: "rejected" });
            emit(onDiagnostic, {
              type: "expressionRejected",
              slotId: payload.slotId,
              error: outcome && outcome.error != null ? outcome.error : null
            });
          }
        } catch (err) {
          rejected += 1;
          trace("expression.request.failed", {
            kind: "intent.envelope",
            slotId: payload.slotId,
            failureName: err instanceof Error ? err.name : typeof err
          });
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
   * @param {any} [progressiveDelivery] C2 settled queue outcome; null keeps legacy one-shot delivery.
   * @returns {Promise<object>}
   */
  const processAskedReply = async (buffer, asked, vision, extra, progressiveDelivery = null, resources = currentFireResources) => {
    // usage 計器（wave 計画 §2 裁定 2・blocking）: 通常 Fire・視覚発火の両方で通知する。
    if (asked && asked.usage != null) {
      emit(onUsage, { usage: asked.usage, vision });
    }
    const replyText = asked && typeof asked.replyText === "string" ? asked.replyText : "";

    // パーサ: replyText → speechText（読み上げ・会話ログ）+ 演出イベント列 + 診断。
    const parsed = parseExpressionTags(replyText);
    const speechText = parsed.speechText;
    const events = parsed.events;
    // 思い出しの目印（一括の読み上げの拾い場所）。渡すのは fire() が結果を返す直前。
    if (currentFire) currentFire.recall.final = parsed.recalls.map((recall) => ({ request: recall.request }));
    trace("llm.response.parsed", {
      modelOutputChars: replyText.length,
      speechChars: speechText.length,
      expressionCount: events.length
    });
    // 未知タグ・壊れタグ診断は expression 接頭辞で onDiagnostic へ（声にも演出にも出さない）。
    for (const d of parsed.diagnostics) {
      emit(onDiagnostic, { ...d, type: `expression${capitalize(d.type)}` });
    }
    // S8: in-flight キル検査（ask を撃った後にキルされたケース）。speak せず・soul 追記せず・演出も
    // 適用せず畳む。診断は破棄した「事実」のみ（type だけ）——speechText 本文はどこにも載せない（秘匿）。
    if (killed) {
      emit(onDiagnostic, { type: "killDiscarded" });
      if (currentFire) currentFire.recall.discard = true;
      return { fired: false, reason: "killed-inflight", ...extra };
    }

    // S8: NG 最終検査（Domain C・キル検査と同じ検問所）。命中したら丸ごと没にする——speak せず・
    // speechText 本文はどこにも載せない（soul 本文・診断・戻り値・ログのいずれにも秘匿）。正本へは
    // 固定の事実文字列 NG_BLOCKED_NOTE（本文なし）だけを append する。containsNgWord("") は false
    // ゆえ空の speechText（この後の hasSpeech 判定より前）はここを素通りする。
    if (containsNgWord(speechText)) {
      // 没にした返事の目印も渡さない（返事を丸ごと捨てる）。
      if (currentFire) currentFire.recall.discard = true;
      if (progressiveDelivery && progressiveDelivery.completedSentenceCount > 0) {
        emit(onDiagnostic, { type: "ngBlocked" });
        return {
          fired: false,
          reason: "ng-blocked",
          progressive: progressivePublicState(progressiveDelivery),
          ...extra
        };
      }
      const appended = buffer.append({ startMs: 0, endMs: 0, text: NG_BLOCKED_NOTE, speaker: "soul" });
      if (appended && appended.appended && appended.entry) {
        emit(onSoulTranscript, withFireId(appended.entry));
      }
      emit(onDiagnostic, { type: "ngBlocked" });
      return { fired: false, reason: "ng-blocked", ...extra };
    }

    const hasSpeech = speechText.length > 0;
    const hasEvents = events.length > 0;

    // C3 zero-spoken failures retain the established Fire error projection so
    // Cockpit's existing fireError ghost remains visible. Keep this deliberately
    // narrow: intentional cancelled controls (kill/barge/dispose) and NG have
    // their accepted cause-specific branches and must not be remapped here.
    if (
      progressiveDelivery &&
      progressiveDelivery.status === "failed" &&
      progressiveDelivery.completedSentenceCount === 0 &&
      progressiveDelivery.terminalCause !== "ng-blocked"
    ) {
      throw withDiagnostic(
        new Error(`progressive speech delivery failed (${progressiveDelivery.terminalCause ?? "unknown"}).`),
        "progressive_delivery_failed",
        "progressive.delivery"
      );
    }

    if (progressiveDelivery && progressiveDelivery.status !== "completed") {
      return {
        fired: false,
        reason: progressiveDelivery.status === "cancelled" ? progressiveDelivery.terminalCause : "progressive-delivery-failed",
        progressive: progressivePublicState(progressiveDelivery),
        ...extra
      };
    }
    const hasProgressiveAudio = progressiveDelivery && progressiveDelivery.enqueuedSentenceCount > 0;
    if (hasProgressiveAudio && progressiveDelivery.playedText !== speechText) {
      throw withDiagnostic(
        new Error(
          `progressive delivery/final speech mismatch (${progressiveDelivery.playedText.length} != ${speechText.length}).`
        ),
        "progressive_speech_mismatch",
        "progressive.delivery.verify"
      );
    }

    // 発話も演出も無い（空応答 / 未知タグのみ）→ 既存 fireEmptyReply 経路。
    if (!hasSpeech && !hasEvents) {
      emit(onDiagnostic, { type: "fireEmptyReply" });
      return { fired: false, reason: "empty-reply" };
    }

    if (hasProgressiveAudio) {
      const expressions = hasEvents ? await applyExpressions(events, resources) : [];
      if (!hasSpeech) {
        return { fired: false, reason: "expression-only", expressed: true, expressions, ...extra };
      }
      // Every queued sentence has reached matching ENDED. Commit the final
      // tag-free answer once; sentence audio was already delivered by C2.
      const appended = buffer.append({ startMs: 0, endMs: 0, text: speechText, speaker: "soul" });
      if (appended && appended.appended && appended.entry) {
        const latencyMs = asked && typeof asked.elapsedMs === "number" ? asked.elapsedMs : null;
        emit(onSoulTranscript, { ...withFireId(appended.entry), latencyMs });
      }
      return {
        fired: true,
        replyText: speechText,
        expressions,
        progressive: progressivePublicState(progressiveDelivery),
        ...extra
      };
    }

    // speaking → 演出（発話開始と同時に一括送出・speak と独立に走る・throw しない）。
    setState("speaking");
    const expressionPromise = hasEvents ? applyExpressions(events, resources) : Promise.resolve([]);

    // 発話なし・演出のみ（タグのみ応答）→ speak せず soul 追記せず envelope だけ実行。
    if (!hasSpeech) {
      const expressions = await expressionPromise;
      return { fired: false, reason: "expression-only", expressed: true, expressions, ...extra };
    }

    // 発話あり → 口 + 声（speechText のみ）。鳴らし始める前の失敗（合成・器の拒否・送信失敗）は
    // speakImpl が投げ、呼び出し元の catch（fireError）へ。遅延の「声」の終わりは STARTED
    // （voice.player.started のトレース・trace() が拾う）。
    const spoken = await speakImpl(speechText, {
      ...resources.speakDeps,
      engine: resolveEngine(resources),
      channel: resources.channel,
      player: resources.player,
      generationId: `fire-${++nextProgressiveGeneration}`,
      releaseMouth: streamReleaseMouth(resources),
      onTrace: (event, fields) => trace(event, fields),
      nowImpl,
      setTimeoutImpl,
      clearTimeoutImpl
    });

    // S6: 再生実区間を追跡し、その間 speaking を保つ。soul 追記は完了時 or 中断時の 1 回だけ。
    // 完了は speakImpl の返りの ended（player の ENDED）。切断点の材料は snapshot()（累積の時間割と
    // STARTED 時刻）、持たない返りは返りの timeline / playbackStartedAtMs。
    const timeline = spoken && Array.isArray(spoken.timeline) ? spoken.timeline : [];
    const playbackStartedAtMs =
      spoken && typeof spoken.playbackStartedAtMs === "number" && Number.isFinite(spoken.playbackStartedAtMs)
        ? spoken.playbackStartedAtMs
        : nowImpl();

    // 再生中は speaking のまま。ended（鳴り終わり/失敗）か interrupt()/kill()/dispose() のどちらかで resolve する。
    const completion = await new Promise((resolve) => {
      const pb = {
        buffer,
        speechText,
        spoken,
        timeline,
        playbackStartedAtMs,
        interrupted: false,
        appended: false,
        resolve
      };
      currentPlayback = pb;
      const ended = spoken && spoken.ended;
      if (!ended || typeof ended.then !== "function") {
        // ended を持たない返り = 返った時点で鳴り終わった（偽物・計測用）。
        resolve({ interrupted: false });
        return;
      }
      ended.then(
        (/** @type {any} */ outcome) => {
          if (currentPlayback !== pb || pb.interrupted) return;
          if (outcome && typeof outcome.status === "string" && outcome.status !== "completed") {
            resolve({
              interrupted: false,
              failed: true,
              error: outcome.error,
              cause: outcome.cause ?? null,
              atMs: typeof outcome.atMs === "number" && Number.isFinite(outcome.atMs) ? outcome.atMs : nowImpl()
            });
            return;
          }
          resolve({ interrupted: false });
        },
        (/** @type {unknown} */ error) => {
          if (currentPlayback !== pb || pb.interrupted) return;
          resolve({ interrupted: false, failed: true, error, cause: "error", atMs: nowImpl() });
        }
      );
    });

    // window を閉じる（現在発話をクリア）。
    currentPlayback = null;

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

    // 鳴らし始めた後の失敗（player の ERROR・異常終了・見張りの時間切れ等）。口は SpeechStreamer が
    // release 済み。文ごとの読み上げと同じく「鳴った分 + 中断注記」で soul に正本化する（Undine 裁定
    // 2026-10-18）。鳴った分は止まる前の snapshot()（累積の時間割と STARTED 時刻）と失敗の時刻から
    // computeSpokenPrefix で求める。STARTED 前・鳴った分が 0 文字なら、今どおり fireError へ（文ごとの
    // 読み上げで 1 文も鳴り終わらずに失敗したときと同じ）。
    if (completion.failed) {
      const partial = spokenBeforeFailure(spoken, speechText, timeline, completion.atMs);
      if (partial) {
        const text = `${partial.prefix}
${PROGRESSIVE_INTERRUPTION_NOTE}`;
        const appended = buffer.append({ startMs: 0, endMs: 0, text, speaker: "soul" });
        if (appended && appended.appended && appended.entry) {
          emit(onSoulTranscript, withFireId(appended.entry));
        }
        trace("speech.partial.projected", {
          playedChars: partial.charsSpoken,
          totalChars: speechText.length,
          terminalCause: completion.cause ?? null
        });
        const expressions = await expressionPromise;
        return {
          fired: false,
          reason: "speech-playback-failed",
          charsSpoken: partial.charsSpoken,
          elapsedMs: partial.elapsedMs,
          expressions,
          ...extra
        };
      }
      await expressionPromise;
      throw withDiagnostic(
        completion.error instanceof Error
          ? completion.error
          : new Error(`speech playback failed (${completion.cause ?? "unknown"}).`),
        "speech_playback_failed",
        "speech.playback"
      );
    }

    // 自然完了 → 全文を soul 記録（**speechText のみ**・startMs/endMs=0）。broadcast は onSoulTranscript 経由。
    // S5: 視覚発火でも画像は一切積まない（会話ログの正本は speechText のみ・ディスク非保存の流儀）。
    const appended = buffer.append({ startMs: 0, endMs: 0, text: speechText, speaker: "soul" });
    if (appended && appended.appended && appended.entry) {
      // 多頭化 Domain C: 応答レイテンシの実値化（wave-plan §3 Domain C・blocking #7 は不変=検問所
      // ロジック自体は 1 行も触っていない・ここは自然完了パスのみへの additive な通知配線）。
      // asked.elapsedMs（知性契約 MindSessionAskResult・brains.mjs）を entry のコピーへ乗せて通知する
      // （transcriptBuffer 正本の Object.freeze entry は直接変更しない・スプレッドで新規オブジェクト化）。
      const latencyMs = asked && typeof asked.elapsedMs === "number" ? asked.elapsedMs : null;
      emit(onSoulTranscript, { ...withFireId(appended.entry), latencyMs });
    }

    const expressions = await expressionPromise;
    return { fired: true, replyText: speechText, expressions, ...extra };
  };

  /**
   * 再生中の魂発話を強制切断する共有ヘルパ（S6 interrupt / S8 kill 共通・DRY）。pb.interrupted=true →
   * ① 声を止める（speakImpl の返りの stop(cause)＝SpeechStreamer が player.stop を**同期に**呼び、合成中の
   * engine へ signal で中止を伝え、② 器の口を閉じる＝mouth-open intent.set value=0・短 ttl を送る。stop を
   * 持たない返りでは、ここで player.stop() と口閉じを直接行う）→ ③ 切断点算出（computeSpokenPrefix・累積の
   * 時間割 × STARTED からの経過）→ ④ soul へ「接頭辞 + note」を 1 回追記 → ⑤ onDiagnostic({type: diagnosticType, ...})
   * → pb.resolve()（await 中の processAskedReply を解放）。stop/set の失敗は診断に握って落とさない。呼び出し元
   * （interrupt/kill）が pb（currentPlayback の null/interrupted チェック済み）を渡す。診断 type は
   * `${diagnosticType}...` で bargeIn/kill を区別する（bargeIn 呼び出しは既存の type 名と 1 ビットも変わらない）。
   * @param {object} pb  currentPlayback（呼び出し元チェック済み・null でない・interrupted でない）。
   * @param {string} note  soul 追記の末尾注記（BARGE_IN_NOTE または KILL_NOTE）。
   * @param {string} diagnosticType  onDiagnostic の最終 type（"bargeIn" または "kill"）。
   * @param {number} [atMs]  切断時刻（既定 nowImpl()）。切断点は atMs − STARTED 時刻で算出（STARTED 前は 0）。
   * @returns {Promise<{ interrupted: true; elapsedMs: number; charsSpoken: number; prefix: string }>}
   */
  const severSpeaking = async (pb, note, diagnosticType, atMs) => {
    const resources = currentFireResources;
    pb.interrupted = true;
    const spoken = pb.spoken;

    // 切断点の材料は止める前に読む（累積の時間割と STARTED 時刻）。
    let timeline = pb.timeline;
    /** @type {number | null} */
    let startedAtMs = pb.playbackStartedAtMs;
    if (spoken && typeof spoken.snapshot === "function") {
      try {
        const snap = spoken.snapshot();
        timeline = snap && Array.isArray(snap.timeline) ? snap.timeline : timeline;
        startedAtMs =
          snap && typeof snap.startedAtMs === "number" && Number.isFinite(snap.startedAtMs) ? snap.startedAtMs : null;
      } catch {
        // 材料が読めなくても中断は続ける（保守側の 0 文字に倒れる）。
      }
    }

    // ①② 声を止め、器の口を閉じる。失敗は診断に握る（落とさない）。
    if (spoken && typeof spoken.stop === "function") {
      try {
        await spoken.stop(diagnosticType === "kill" ? "killed" : "barge-in");
      } catch (err) {
        emit(onDiagnostic, { type: `${diagnosticType}StopError`, message: errMessage(err) });
      }
    } else {
      try {
        if (resources?.player && typeof resources.player.stop === "function") {
          resources.player.stop();
        }
      } catch (err) {
        emit(onDiagnostic, { type: `${diagnosticType}StopError`, message: errMessage(err) });
      }
      //    rejected/throw/未対応はすべて診断に握る（口が閉じ切らなくても中断処理は続ける）。
      await releaseMouth(diagnosticType, resources);
    }

    // ③ 切断点算出（モーラタイムライン × 再生経過・過大評価しない純関数）。
    const severAtMs = typeof atMs === "number" && Number.isFinite(atMs) ? atMs : nowImpl();
    const elapsedMs = startedAtMs == null ? 0 : severAtMs - startedAtMs;
    const cut = computeSpokenPrefix({
      speechText: pb.speechText,
      timeline,
      elapsedMs
    });

    // ④ soul 追記（接頭辞 + note・1 回・上書きせず append）。broadcast は onSoulTranscript 経由。
    const soulText = cut.prefix + note;
    const appended = pb.buffer.append({ startMs: 0, endMs: 0, text: soulText, speaker: "soul" });
    pb.appended = true;
    if (appended && appended.appended && appended.entry) {
      emit(onSoulTranscript, withFireId(appended.entry));
    }

    // ⑤ 診断（切断発生・切断点・声に出た文字数）。
    emit(onDiagnostic, {
      type: diagnosticType,
      elapsedMs,
      charsSpoken: cut.charsSpoken,
      totalChars: pb.speechText.length,
      prefix: cut.prefix
    });

    const info = { interrupted: /** @type {true} */ (true), elapsedMs, charsSpoken: cut.charsSpoken, prefix: cut.prefix };
    // processAskedReply の await を解放（この後 finally が idle へ戻す）。
    pb.resolve(info);
    return info;
  };

  /**
   * barge-in 中断（S6・外部の VAD 結線が確定時に呼ぶ）。speaking 中の魂発話を止め、器の口を閉じ、
   * 切断点を正直に算出して「接頭辞 + 中断注記」を soul へ 1 回追記し、bargeIn 診断を出す。
   * speaking 中でなければ no-op（冪等・dispose 後も安全）。stop/set の失敗は診断に握って落とさない。
   * @param {number} [atMs]  中断時刻（既定 nowImpl()）。切断点は atMs − playbackStartedAtMs で算出。
   * @returns {Promise<{ interrupted: boolean; reason?: string; elapsedMs?: number; charsSpoken?: number; prefix?: string }>}
   */
  const interrupt = async (atMs) => {
    const progressive = currentProgressiveDelivery;
    if (progressive) {
      const before = progressive.snapshot();
      if (before.hasAudiblyStarted !== true) {
        return { interrupted: false, reason: "not-speaking" };
      }
      const interrupted = progressive.bargeIn();
      if (!interrupted) return { interrupted: false, reason: "already-interrupted" };
      currentProgressiveBoundary?.stop();
      // 鳴っていた文は SpeechStreamer が player.stop → 口の release（bargeIn… の診断名）まで済ませる。
      await progressive.whenSettled();
      const after = progressive.snapshot();
      emit(onDiagnostic, {
        type: "bargeIn",
        charsSpoken: after.playedText.length,
        totalChars: after.playedText.length,
        prefix: after.playedText
      });
      return { interrupted: true, charsSpoken: after.playedText.length, prefix: after.playedText };
    }
    const pb = currentPlayback;
    if (!pb || pb.interrupted) {
      // 発話中でない・既に中断済み → 何もしない（冪等）。
      return { interrupted: false, reason: pb ? "already-interrupted" : "not-speaking" };
    }
    return severSpeaking(pb, BARGE_IN_NOTE, "bargeIn", atMs);
  };

  /**
   * キル（S8・全発火 OFF + 声の即切断）。`killed=true` を立てる（以後の fire() は全経路で拒否される・
   * fire() 冒頭ガードが唯一の合流点で弾く）。再生中（currentPlayback があり未 interrupted）なら
   * interrupt() 相当の即切断を severSpeaking 経由で行う（player.stop 同期呼び・口閉じ・切断点算出・
   * soul へ prefix + KILL_NOTE 追記・onDiagnostic({type:"kill"})）。idle/thinking 中（再生していない）
   * の kill は severance が no-op（currentPlayback null）で killed フラグだけ立てる。二度呼んでも安全
   * （冪等）。ears 系（transcript-buffer 等）には一切触れない（耳の不干渉）。
   * @param {number} [atMs]  切断時刻（既定 nowImpl()）。再生中でなければ無視される。
   * @returns {Promise<{ killed: true; severed: boolean; elapsedMs?: number; charsSpoken?: number; prefix?: string }>}
   */
  const kill = async (atMs) => {
    killed = true;
    const progressive = currentProgressiveDelivery;
    if (progressive) {
      const before = progressive.snapshot();
      const changed = progressive.kill();
      if (changed) currentProgressiveBoundary?.stop();
      // 鳴っていた文は SpeechStreamer が player.stop → 口の release（kill… の診断名）まで済ませる。
      if (changed) await progressive.whenSettled();
      const after = progressive.snapshot();
      emit(onDiagnostic, { type: "kill", charsSpoken: after.playedText.length, prefix: after.playedText });
      return {
        killed: true,
        severed: changed && before.activePlaybackId != null,
        charsSpoken: after.playedText.length,
        prefix: after.playedText
      };
    }
    const pb = currentPlayback;
    if (!pb || pb.interrupted) {
      // 再生中でない・既に中断/キル済み → severance は no-op（killed フラグだけ立てる）。
      return { killed: true, severed: false };
    }
    const info = await severSpeaking(pb, KILL_NOTE, "kill", atMs);
    return { killed: true, severed: true, elapsedMs: info.elapsedMs, charsSpoken: info.charsSpoken, prefix: info.prefix };
  };

  /**
   * キル解除（S8）。`killed=false` に戻すだけ（残留状態を作らない）。kill の切断は severSpeaking →
   * pb.resolve という既存 interrupt と同じ経路を通って finally で idle へ戻るため、revive はフラグを
   * 倒すだけで次の fire() が普通に動く。killed でないときの revive も安全（冪等・no-op）。
   * @returns {void}
   */
  const revive = () => {
    killed = false;
  };

  /**
   * 視覚 ask の共通コア（キャプチャ成功後）: 「見た」通知 → 会話窓 + 視覚指示 + 画像先行 content → ask →
   * processAskedReply（vision:true）。手動視覚 Fire（fireVision）と自発 preferred の成功時が共有する。
   * **呼び出し元が thinking 遷移・accept emit・失敗の握り（fireError）・finally idle を持つ**（この関数は
   * throw しうる。それを catch するのは呼び出し元の責務）。S5 の元インライン実装と完全に同一の外形。
   * @param {{ all: Function; append: Function }} buffer
   * @param {{ jpegBase64: string; width: number; height: number; elapsedMs: number }} captured
   * @param {string} title
   * @returns {Promise<object>}
   */
  const askWithVision = async (buffer, captured, title, resources) => {
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
    const { injection, windowMode } = buildInjection(buffer, resources, nowMs);
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
    emitAsk(injection, true);
    const askStartedAt = performance.now();
    trace("llm.ask.started", { vision: true, injectedChars, includedCount });
    let asked;
    let progressive;
    let deliveryOutcome;
    try {
      ({ asked, progressive, deliveryOutcome } = await askIncrementally(contentBlocks, resources, buffer));
    } catch (error) {
      throw withDiagnostic(error, "llm_ask_failed", "llm.ask");
    }
    commitInjection(resources, injection, windowMode);
    emitAskRecord(asked, resources, true, windowMode, injection, injectedChars);
    trace("llm.ask.completed", {
      vision: true,
      modelOutputChars: typeof asked?.replyText === "string" ? asked.replyText.length : 0,
      elapsedMs: typeof asked?.elapsedMs === "number" ? asked.elapsedMs : null,
      durationMs: performance.now() - askStartedAt,
      streamed: progressive.sawDelta,
      progressiveSentenceCount: progressive.sentenceCount,
      progressiveBlocked: progressive.blocked
    });
    const result = await processAskedReply(
      buffer,
      asked,
      true,
      { injectedChars, includedCount, vision: true },
      progressive.sawDelta ? deliveryOutcome : null,
      resources
    );
    trace("fire.completed", { fired: result.fired === true, reason: result.reason ?? null });
    return result;
  };

  /**
   * 通常 Fire（画像なし）の ask コア。窓収集→空窓ガード→（新規受理なら）thinking + accept emit→ask→
   * processAskedReply（vision:false）。手動 Fire（新規受理）と、preferred の対象未設定/劣化フォールバックが
   * 共有する。`alreadyAccepted=false` は元インライン実装（fire() の通常経路）と完全に同一の外形。
   * @param {{ all: Function; append: Function }} buffer
   * @param {{ alreadyAccepted: boolean; resources?: object }} opts
   *   false: 新規の通常 Fire（空窓は onFire{accepted:false,reason:"empty-window"} で正直に中止・受理で
   *          thinking + onFire{accepted:true,...} を emit）。手動 Fire・preferred の対象未設定が使う。
   *   true : 既に thinking かつ onFire{accepted:true,vision:true} 済みの**劣化フォールバック**（accept を
   *          再 emit しない = 二重 accept を避ける・空窓でも onFire は出さず reason:"empty-window" を返すだけ）。
   * @returns {Promise<object>}
   */
  const fireNormalCore = async (buffer, { alreadyAccepted, resources: acceptedResources }) => {
    // 3. 直近窓を収集。空窓なら ask を無駄撃ちしない。
    const nowMs = nowImpl();
    // 空窓の判定は従来どおり直近 5 分の全体で行う（増えた分が 0 でも、窓に行があれば発火する）。
    const fullWindow = formatFireInjection(buffer.all(), { nowMs, windowMs, maxChars });
    if (fullWindow.includedCount === 0) {
      if (!alreadyAccepted) {
        emit(onFire, { accepted: false, reason: "empty-window", ...(currentFire?.cause != null ? { cause: currentFire.cause } : {}) });
      }
      return { fired: false, reason: "empty-window" };
    }

    let resources = acceptedResources;
    if (!alreadyAccepted) {
      try {
        resources = await acquireResources();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emit(onDiagnostic, { type: "fireError", message });
        return { fired: false, reason: "error", message };
      }
      currentFireResources = resources;
    }

    // 実際に渡す窓（同じ会話が続いていれば増えた分だけ・頭のセッションが決まってから作る）。
    const { injection, windowMode } = buildInjection(buffer, resources, nowMs, fullWindow);
    const injectedText = injection.text;
    const injectedChars = injection.charCount;
    const includedCount = injection.includedCount;

    // 4. Snapshot acquired → thinking → accepted publication.
    if (!alreadyAccepted) {
      setState("thinking");
      emit(onFire, { accepted: true, injectedChars, includedCount, atMs: nowMs, ...acceptedTags() });
      trace("fire.accepted.context", { injectedChars, includedCount, vision: false, ...resources.metadata });
    }

    try {
      emitAsk(injection, false);
      const askStartedAt = performance.now();
      trace("llm.ask.started", { vision: false, injectedChars, includedCount });
      let asked;
      let progressive;
      let deliveryOutcome;
      try {
        ({ asked, progressive, deliveryOutcome } = await askIncrementally(injectedText, resources, buffer));
      } catch (error) {
        throw withDiagnostic(error, "llm_ask_failed", "llm.ask");
      }
      commitInjection(resources, injection, windowMode);
      emitAskRecord(asked, resources, false, windowMode, injection, injectedChars);
      trace("llm.ask.completed", {
        vision: false,
        modelOutputChars: typeof asked?.replyText === "string" ? asked.replyText.length : 0,
        elapsedMs: typeof asked?.elapsedMs === "number" ? asked.elapsedMs : null,
        durationMs: performance.now() - askStartedAt,
        streamed: progressive.sawDelta,
        progressiveSentenceCount: progressive.sentenceCount,
        progressiveBlocked: progressive.blocked
      });
      const result = await processAskedReply(
        buffer,
        asked,
        false,
        { injectedChars, includedCount },
        progressive.sawDelta ? deliveryOutcome : null,
        resources
      );
      trace("fire.completed", { fired: result.fired === true, reason: result.reason ?? null });
      return result;
    } catch (error) {
      // 失敗の握り: サーバを殺さず診断に落とす。
      const message = error instanceof Error ? error.message : String(error);
      emit(onDiagnostic, { type: "fireError", message });
      trace("fire.failed", {
        stage: typeof error?.diagnosticStage === "string" ? error.diagnosticStage : "fire.processing.unknown",
        failureName: error instanceof Error ? error.name : typeof error,
        failureCode: typeof error?.code === "string" ? error.code : "fire_processing_unknown"
      });
      return { fired: false, reason: "error", message };
    } finally {
      if (currentFireResources === resources) currentFireResources = null;
      // どの経路でも idle へ戻す（詰まりを残さない）。冪等 setState ゆえ二重発火なし。
      setState("idle");
    }
  };

  /**
   * 視覚発火（S5「目が開く」・手動視覚 Fire = fire({vision:true})・自発 silence が使う）。busy 判定・耳未起動
   * 判定は呼び出し元（fire()）で通常 Fire と共有済み。**「見えなければ中止」を維持**（対象未設定・キャプチャ
   * 失敗はいずれも session.ask を呼ばず中止＝盲目のまま撃たない）。
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
      emit(onFire, {
        accepted: false,
        reason: "vision-no-target",
        vision: true,
        ...(currentFire?.cause != null ? { cause: currentFire.cause } : {})
      });
      emit(onDiagnostic, {
        type: "fireVisionError",
        kind: "no-target",
        message: "vision target window is not set"
      });
      return { fired: false, reason: "vision-no-target" };
    }

    let resources = null;
    try {
      resources = await acquireResources();
      currentFireResources = resources;
      setState("thinking");
      emit(onFire, { accepted: true, vision: true, atMs: nowImpl(), ...acceptedTags() });
      trace("fire.accepted.context", { vision: true, ...resources.metadata });
      // キャプチャ。失敗（{error}）なら session.ask を呼ばずに正直に中止する（成功を捏造しない）。
      trace("vision.capture.started");
      const captured = await captureImpl(title);
      if (captured && captured.error) {
        trace("vision.capture.failed", { kind: captured.error.kind ?? null });
        const { kind, message } = captured.error;
        emit(onDiagnostic, { type: "fireVisionError", kind, message });
        trace("fire.completed", { fired: false, reason: "vision-capture-failed" });
        return { fired: false, reason: "vision-capture-failed", kind };
      }
      trace("vision.capture.completed", {
        width: typeof captured?.width === "number" ? captured.width : null,
        height: typeof captured?.height === "number" ? captured.height : null,
        elapsedMs: typeof captured?.elapsedMs === "number" ? captured.elapsedMs : null
      });
      return await askWithVision(buffer, captured, title, resources);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit(onDiagnostic, { type: "fireError", message });
      trace("fire.failed", {
        stage: typeof error?.diagnosticStage === "string" ? error.diagnosticStage : "fire.processing.unknown",
        failureName: error instanceof Error ? error.name : typeof error,
        failureCode: typeof error?.code === "string" ? error.code : "fire_processing_unknown"
      });
      return { fired: false, reason: "error", message };
    } finally {
      if (currentFireResources === resources) currentFireResources = null;
      setState("idle");
    }
  };

  /**
   * 視覚優先発火（S6 追撃・自発 call/turn-end 用 = fire({vision:"preferred"})）。fireVision との違いは
   * **「見えなくても中止せず画像なしの通常 Fire へ劣化」**（裁定 1/2）: 対象未設定 → 通常 Fire・キャプチャ
   * 失敗 → 通常 Fire + 劣化診断。誰もボタンを押していない自発発火ゆえ盲目でも嘘にならない。busy/耳未起動
   * 判定は呼び出し元（fire()）で共有済み。
   * @param {{ all: Function; append: Function }} buffer
   * @returns {Promise<object>}
   */
  const firePreferred = async (buffer) => {
    // 対象解決（状態遷移前）。未設定は通常 Fire へフォールバック（中止しない・vision-no-target とは違う）。
    let title = null;
    try {
      title = typeof getVisionTarget === "function" ? await getVisionTarget() : null;
    } catch {
      title = null; // 解決関数の throw も「対象未設定」扱い（通常 Fire へ劣化）。
    }
    if (typeof title !== "string" || title.length === 0) {
      // 対象未設定 → 画像なしの通常 Fire（新規受理経路・空窓ガードも通常どおり効く）。
      return fireNormalCore(buffer, { alreadyAccepted: false });
    }

    let resources = null;
    try {
      resources = await acquireResources();
      currentFireResources = resources;
      setState("thinking");
      emit(onFire, { accepted: true, vision: true, atMs: nowImpl(), ...acceptedTags() });
      trace("fire.accepted.context", { vision: true, preferred: true, ...resources.metadata });
      trace("vision.capture.started", { preferred: true });
      const captured = await captureImpl(title);
      if (captured && captured.error) {
        // キャプチャ失敗 → 画像なしの通常 Fire へ静かに劣化（中止しない）。痕跡は診断で必ず残す（ゴースト行）。
        const { kind, message } = captured.error;
        trace("vision.capture.failed", { kind: kind ?? null, preferred: true });
        emit(onDiagnostic, { type: "fireVisionDegraded", kind, message });
        // 既に thinking + accept 済みなので再 emit しない。この後 fireNormalCore の finally が idle へ戻す。
        return await fireNormalCore(buffer, { alreadyAccepted: true, resources });
      }
      // 成功 → 手動視覚 Fire と完全共通の視覚 ask。
      trace("vision.capture.completed", {
        width: typeof captured?.width === "number" ? captured.width : null,
        height: typeof captured?.height === "number" ? captured.height : null,
        elapsedMs: typeof captured?.elapsedMs === "number" ? captured.elapsedMs : null,
        preferred: true
      });
      return await askWithVision(buffer, captured, title, resources);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit(onDiagnostic, { type: "fireError", message });
      trace("fire.failed", {
        stage: typeof error?.diagnosticStage === "string" ? error.diagnosticStage : "fire.processing.unknown",
        failureName: error instanceof Error ? error.name : typeof error,
        failureCode: typeof error?.code === "string" ? error.code : "fire_processing_unknown"
      });
      return { fired: false, reason: "error", message };
    } finally {
      if (currentFireResources === resources) currentFireResources = null;
      // fireNormalCore(alreadyAccepted:true) 経路では二重 idle になるが冪等ゆえ無害。
      setState("idle");
    }
  };

  /**
   * この発火の返事の中の思い出しの目印を渡す。逐次の読み上げ（delta を受けた）なら逐次の部品が読んだもの、
   * そうでなければ最後の parser の結果。ask が返らなかった・キル・NG・dispose の返事は渡さない。
   * @param {NonNullable<typeof currentFire>} fire  @param {any} result
   */
  const emitRecallRequests = (fire, result) => {
    const recall = fire.recall;
    if (recall.final === null || recall.discard || disposed || killed) return;
    if (result && (result.reason === "disposed" || result.reason === "killed-inflight" || result.reason === "ng-blocked")) return;
    const found = recall.sawDelta ? recall.streamed : recall.final;
    const requests = found.filter((r) => typeof r.request === "string" && r.request.length > 0);
    if (requests.length === 0) return;
    trace("recall.requested", { count: requests.length });
    for (const r of requests) emit(onRecallRequest, { request: r.request, fireId: fire.fireId ?? null });
  };

  /** 黙って渡す前置きの上限（古い方から捨てる）。 */
  const MAX_DEFERRED_INSTRUCTIONS = 3;

  return {
    /**
     * Fire 1 発を処理する（Promise を返す・テストが await 可能）。
     * @param {{ vision?: boolean | "preferred"; instruction?: string; cause?: object }} [fireOptions]  省略/未指定時は従来どおり通常 Fire（完全不変）。
     *   `cause` はきっかけ（結線層が作る本文なしの小さなオブジェクト・受理・棄却・遅延の通知にそのまま載る）。
     *   `instruction` はこの 1 発だけ ask の先頭に付ける内部指示（コメント反応でどのコメントかを明示する・
     *   会話ログには残らない）。vision の各モードと併用できる。
     *   `{ vision: true }` で視覚発火（S5・見えなければ中止）。`{ vision: "preferred" }` で視覚優先発火
     *   （S6 追撃・自発 call/turn-end 用・対象あれば画像付き・無/失敗なら画像なしの通常 Fire へ劣化）。
     * @returns {Promise<object>}
     */
    async fire(fireOptions) {
      if (disposed) {
        return { fired: false, reason: "disposed", state };
      }
      // きっかけ（結線層が作る小さなオブジェクト・ここでは解釈しない）。棄却の通知にも載せる（無ければ従来の形）。
      const cause =
        fireOptions != null && fireOptions.cause != null && typeof fireOptions.cause === "object" ? fireOptions.cause : null;
      const rejectTags = cause != null ? { cause } : {};
      // S8: キル中は全発火経路を閉じる（manual・視覚・自発 preferred すべてがこの合流点を通る）。
      if (killed) {
        emit(onFire, { accepted: false, reason: "killed", ...rejectTags });
        return { fired: false, reason: "killed", state };
      }
      // 1. busy 中の Fire は無視（重ね発火は S4/S6 の領分・視覚発火も同一判定を共有）。
      if (state !== "idle" || fireClaimed) {
        emit(onFire, { accepted: false, reason: "busy", ...rejectTags });
        return { fired: false, reason: "busy", state };
      }
      // 2. 耳未起動（会話ログが無い）。視覚発火も会話窓の注入に buffer を要するため共有。
      const buffer = getBuffer();
      if (buffer == null) {
        emit(onFire, { accepted: false, reason: "ears-not-running", ...rejectTags });
        return { fired: false, reason: "ears-not-running" };
      }

      fireClaimed = true;
      const fire = {
        fireId: /** @type {number | null} */ (null),
        cause,
        vision: false,
        timing: createFireTiming({ nowImpl: monotonicNowImpl }),
        latencyEmitted: false,
        /** @type {string | null} その返事の turn/start に送った速さの段（Codex の頭・onTurnStarted で知る）。 */
        serviceTier: /** @type {string | null} */ (null),
        recall: {
          sawDelta: false,
          streamed: /** @type {Array<{ request: string }>} */ ([]),
          final: /** @type {Array<{ request: string }> | null} */ (null),
          discard: false
        }
      };
      currentFire = fire;
      // コメント反応: この 1 発だけの内部指示（空・非文字列は無し = 従来と同じ ask）。
      currentFireInstruction =
        fireOptions != null && typeof fireOptions.instruction === "string" && fireOptions.instruction.trim().length > 0
          ? fireOptions.instruction
          : null;
      try {
        // S5/S6: 視覚系は別フローへ振り分ける。通常 fire()（fireOptions 省略 = vision undefined）の挙動は
        // 完全不変（無退行・fireNormalCore へ抽出しただけ）。
        //  - vision:true      → 手動視覚 Fire・自発 silence（見えなければ中止）。
        //  - vision:"preferred" → 自発 call/turn-end（対象あれば画像付き・無/失敗なら画像なし通常発火へ劣化）。
        const visionMode = fireOptions != null ? fireOptions.vision : undefined;
        /** @type {any} */
        let result;
        if (visionMode === true) {
          result = await fireVision(buffer);
        } else if (visionMode === "preferred") {
          result = await firePreferred(buffer);
        } else {
          // 3./4. 通常 Fire（画像なし）: 元インライン実装をコア関数へ抽出（挙動不変）。
          result = await fireNormalCore(buffer, { alreadyAccepted: false });
        }
        // 声が鳴らないまま終わった返事（空・NG・キル・失敗・表情だけ）も、ask した回は遅延を 1 回通知する。
        emitLatencyOnce(!!(result && result.fired === true));
        // 思い出しの目印: 返事が終わったあと（状態は idle に戻っている）に、頼みごとごとに結線層へ渡す。
        emitRecallRequests(fire, result);
        // 受理した発火の戻り値には番号を載せる（結線層の selfFire 結果と結ぶ）。
        return fire.fireId != null && result && typeof result === "object" ? { ...result, fireId: fire.fireId } : result;
      } finally {
        fireClaimed = false;
        currentFireInstruction = null;
        if (currentFire === fire) currentFire = null;
      }
    },

    /** barge-in 中断（S6・外部の VAD 結線が呼ぶ）。詳細は interrupt の JSDoc。 */
    interrupt,

    /** キル（S8・全発火 OFF + 声の即切断）。詳細は kill の JSDoc。 */
    kill,

    /** キル解除（S8）。詳細は revive の JSDoc。 */
    revive,

    /** 現在のキル状態（テスト・結線層向け）。 */
    getKilled() {
      return killed;
    },

    /** 現在の状態（idle/thinking/speaking）。 */
    getState() {
      return state;
    },

    /**
     * 次の ask の先頭に 1 回だけ黙って前置きする内部の文を積む（記憶の作り直し Wave 3・思い出した中身を
     * 「今は言わない」とき）。会話ログには残らない。空・非文字列・dispose 後は積まない（false）。
     * @param {string} text
     * @returns {boolean}
     */
    deferInstruction(text) {
      if (disposed || typeof text !== "string" || text.trim().length === 0) return false;
      pendingDeferredInstructions = [...pendingDeferredInstructions, text].slice(-MAX_DEFERRED_INSTRUCTIONS);
      return true;
    },

    /** 畳む（以後の fire を拒否）。session/channel/player は所有しない = ここでは畳まない。 */
    dispose() {
      disposed = true;
      if (currentProgressiveDelivery?.dispose()) currentProgressiveBoundary?.stop();
      // 発話再生中に畳まれたら、await 中の processAskedReply を安全に解放する（詰まりを残さない）。
      // 鳴っている一括の読み上げは止める（SpeechStreamer が player.stop → 口の release）。
      const pb = currentPlayback;
      if (pb && !pb.interrupted) {
        pb.interrupted = true;
        if (pb.spoken && typeof pb.spoken.stop === "function") {
          Promise.resolve()
            .then(() => pb.spoken.stop("disposed"))
            .catch(() => {});
        }
        pb.resolve({ interrupted: false, disposed: true });
      }
    }
  };
}

/**
 * ask の内容の先頭に内部指示を付ける（文字列はそのまま前置・content 配列は最初の text ブロックに前置）。
 * progressive correction とコメント反応の指示が共有する。
 * @param {string | Array<any>} content
 * @param {string} instruction
 * @returns {string | Array<any>}
 */
function prependInstruction(content, instruction) {
  if (typeof content === "string") {
    return `${instruction}

${content}`;
  }
  if (Array.isArray(content)) {
    let applied = false;
    return content.map((block) => {
      if (applied || block?.type !== "text" || typeof block.text !== "string") return block;
      applied = true;
      return { ...block, text: `${instruction}

${block.text}` };
    });
  }
  return content;
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

/** Keep public Fire results content-free while C3 receives the full internal outcome hook. */
/**
 * 一括の読み上げが鳴らし始めた後に失敗したとき、声に出た分を求める（純関数・過大評価しない）。
 * 材料は speakImpl の返りの snapshot()（累積の時間割と STARTED 時刻）。読めなければ返りの timeline。
 * STARTED 前（startedAtMs が無い）・0 文字なら null（呼び出し元は今どおり fireError にする）。
 * @param {any} spoken  speakImpl の返り。
 * @param {string} speechText
 * @param {ReadonlyArray<{ timeMs: number }>} fallbackTimeline
 * @param {number} failedAtMs  失敗の時刻（STARTED と同じ時計）。
 * @returns {null | { prefix: string; charsSpoken: number; elapsedMs: number }}
 */
function spokenBeforeFailure(spoken, speechText, fallbackTimeline, failedAtMs) {
  if (!spoken || typeof spoken.snapshot !== "function") return null;
  /** @type {any} */
  let snap = null;
  try {
    snap = spoken.snapshot();
  } catch {
    return null;
  }
  const startedAtMs = snap && typeof snap.startedAtMs === "number" && Number.isFinite(snap.startedAtMs) ? snap.startedAtMs : null;
  if (startedAtMs == null || typeof failedAtMs !== "number" || !Number.isFinite(failedAtMs)) return null;
  const timeline = snap && Array.isArray(snap.timeline) ? snap.timeline : fallbackTimeline;
  const elapsedMs = Math.max(0, failedAtMs - startedAtMs);
  const cut = computeSpokenPrefix({ speechText, timeline, elapsedMs });
  if (!(cut.charsSpoken > 0) || cut.prefix.length === 0) return null;
  return { prefix: cut.prefix, charsSpoken: cut.charsSpoken, elapsedMs };
}

function progressivePublicState(outcome) {
  return {
    generationId: outcome.generationId,
    status: outcome.status,
    terminalCause: outcome.terminalCause,
    enqueuedSentenceCount: outcome.enqueuedSentenceCount,
    completedSentenceCount: outcome.completedSentenceCount,
    playedChars: typeof outcome.playedText === "string" ? outcome.playedText.length : 0
  };
}

/** @param {unknown} error @param {string} code @param {string} diagnosticStage */
function withDiagnostic(error, code, diagnosticStage) {
  if (error instanceof Error) {
    if (typeof /** @type {any} */ (error).code !== "string") /** @type {any} */ (error).code = code;
    if (typeof /** @type {any} */ (error).diagnosticStage !== "string") {
      /** @type {any} */ (error).diagnosticStage = diagnosticStage;
    }
    return /** @type {any} */ (error);
  }
  const failure = new Error(String(error));
  /** @type {any} */ (failure).code = code;
  /** @type {any} */ (failure).diagnosticStage = diagnosticStage;
  return failure;
}
