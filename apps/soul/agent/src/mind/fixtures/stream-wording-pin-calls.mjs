// @ts-check
/**
 * 配信の文字列の固定テスト（stream-wording-pin.test.mjs）の「呼び出し」 — Discord モード Domain A。
 *
 * 期待値（stream-wording-pin-expected.mjs）は HEAD の出力を書き写した文字列で、ブランチの最後まで変えない。
 * ここはその文字列を「今のコードで作る呼び出し」だけを持つ。組み立てが替わったら（Domain C の「共通部分 + 語の組」、
 * `skills/recall.md` の印を配信の語で差す読み込み口など）、**ここの呼び出しだけを合わせる**。期待値には触れない。
 *
 * 各ケースは文字列を返す（オブジェクトの結果は、文面に当たる所を文字列で、数の所は JSON で返す）。
 */

import { formatFireInjection, formatFireInjectionSince } from "../fire-injection.mjs";
import { WRITER_SYSTEM_PROMPT, formatTranscriptForDigest, buildWriterRequest } from "../memory.mjs";
import {
  RECALL_SYSTEM_PROMPT,
  formatRecentConversation,
  buildRecallRequest,
  buildRecallAvoidInput,
  buildRecallFoundInstruction,
  buildRecallNotFoundInstruction,
  buildRecallDeferredNote,
  buildRecallNotFoundDeferredNote,
  buildRecallSilentFoundNote,
  buildRecallFailedInstruction,
  buildRecallFailedDeferredNote
} from "../recall.mjs";
import { buildSpeakNowInput, buildSpeakNowInstructions, buildSpeakNowChoices } from "../speak-now.mjs";
import { buildCommentReactInput } from "../comment-react.mjs";
import { loadSoulSkills } from "../soul-skills.mjs";
import {
  PIN_NOW_MS,
  PIN_TRANSCRIPT,
  PIN_SOUL_NAME,
  PIN_RECALL_REQUEST,
  PIN_RECALL_SUMMARY,
  PIN_EXISTING_FILES,
  PIN_COMMENT_BLANK_NAME,
  PIN_COMMENT_NAMED
} from "./stream-wording-pin-input.mjs";

/** @param {{ text: string } & Record<string, unknown>} r */
function metaOf(r) {
  const { text: _text, ...rest } = r;
  return JSON.stringify(rest);
}

/** @param {ReadonlyArray<{ value: string; description: string }>} choices */
function choicesText(choices) {
  return choices.map((c) => `${c.value}\t${c.description}`).join("\n");
}

/**
 * 固定するケースの一覧（名前 → 文字列を作る呼び出し）。名前は期待値の鍵と同じ。
 * @returns {Array<[string, () => string]>}
 */
export function streamWordingPinCases() {
  const entries = PIN_TRANSCRIPT;
  const nowMs = PIN_NOW_MS;
  const digest = () => formatTranscriptForDigest(entries);
  const recent = () => formatRecentConversation(entries, { nowMs });
  return [
    // ① への行
    ["fire.window.text", () => formatFireInjection(entries, { nowMs }).text],
    ["fire.window.meta", () => metaOf(formatFireInjection(entries, { nowMs }))],
    ["fire.limit.text", () => formatFireInjection(entries, { nowMs, maxChars: 60 }).text],
    ["fire.limit.meta", () => metaOf(formatFireInjection(entries, { nowMs, maxChars: 60 }))],
    ["fire.since.text", () => formatFireInjectionSince(entries, { nowMs, afterSeq: 3 }).text],
    ["fire.since.meta", () => metaOf(formatFireInjectionSince(entries, { nowMs, afterSeq: 3 }))],
    ["fire.sinceNull.text", () => formatFireInjectionSince(entries, { nowMs, afterSeq: null }).text],
    ["fire.sinceNone.text", () => formatFireInjectionSince(entries, { nowMs, afterSeq: 7 }).text],
    ["fire.sinceNone.meta", () => metaOf(formatFireInjectionSince(entries, { nowMs, afterSeq: 7 }))],
    // ② の固定の指示と頼み
    ["writer.systemPrompt", () => WRITER_SYSTEM_PROMPT],
    ["writer.transcript", () => digest()],
    [
      "writer.request.new",
      () => buildWriterRequest({ transcriptText: digest(), dateJst: "2026-10-31", baseName: "2026-10-31", existingFiles: [] })
    ],
    [
      "writer.request.existing",
      () =>
        buildWriterRequest({ transcriptText: digest(), dateJst: "2026-10-31", baseName: "2026-10-31-2", existingFiles: PIN_EXISTING_FILES })
    ],
    // ④ の固定の指示と頼みと結果の文面
    ["recall.systemPrompt", () => RECALL_SYSTEM_PROMPT],
    ["recall.recent", () => recent()],
    ["recall.recent.wide", () => formatRecentConversation(entries, { nowMs, windowMs: 600_001 })],
    ["recall.request", () => buildRecallRequest({ request: PIN_RECALL_REQUEST, recentText: recent() })],
    ["recall.request.empty", () => buildRecallRequest({ request: PIN_RECALL_REQUEST, recentText: "" })],
    ["recall.result.found", () => buildRecallFoundInstruction({ request: PIN_RECALL_REQUEST, summary: PIN_RECALL_SUMMARY })],
    ["recall.result.notFound", () => buildRecallNotFoundInstruction({ request: PIN_RECALL_REQUEST })],
    ["recall.result.deferred", () => buildRecallDeferredNote({ request: PIN_RECALL_REQUEST, summary: PIN_RECALL_SUMMARY })],
    ["recall.result.notFoundDeferred", () => buildRecallNotFoundDeferredNote({ request: PIN_RECALL_REQUEST })],
    ["recall.result.silentFound", () => buildRecallSilentFoundNote({ request: PIN_RECALL_REQUEST, summary: PIN_RECALL_SUMMARY })],
    ["recall.result.failed", () => buildRecallFailedInstruction({ request: PIN_RECALL_REQUEST })],
    ["recall.result.failedDeferred", () => buildRecallFailedDeferredNote({ request: PIN_RECALL_REQUEST })],
    // `skills/recall.md` の本文（①に渡る教えとして読み込まれたもの）
    ["skill.recall", () => loadSoulSkills({ names: ["recall"] })],
    // 判定の入力
    ["judge.speakNow.input", () => buildSpeakNowInput(entries, { nowMs, soulName: PIN_SOUL_NAME })],
    ["judge.speakNow.instructions.normal", () => buildSpeakNowInstructions({ name: PIN_SOUL_NAME, verbosity: "normal" })],
    ["judge.speakNow.instructions.quiet", () => buildSpeakNowInstructions({ name: PIN_SOUL_NAME, verbosity: "quiet" })],
    ["judge.speakNow.instructions.chatty", () => buildSpeakNowInstructions({ name: PIN_SOUL_NAME, verbosity: "chatty" })],
    ["judge.speakNow.choices", () => choicesText(buildSpeakNowChoices(PIN_SOUL_NAME))],
    [
      "judge.commentReact.input.blankName",
      () => buildCommentReactInput(entries, PIN_COMMENT_BLANK_NAME, { nowMs, soulName: PIN_SOUL_NAME })
    ],
    ["judge.commentReact.input.named", () => buildCommentReactInput(entries, PIN_COMMENT_NAMED, { nowMs, soulName: PIN_SOUL_NAME })],
    [
      "judge.recallAvoid.input",
      () => buildRecallAvoidInput(entries, { request: PIN_RECALL_REQUEST, summary: PIN_RECALL_SUMMARY, nowMs, soulName: PIN_SOUL_NAME })
    ],
    [
      "judge.recallAvoid.input.wide",
      () =>
        buildRecallAvoidInput(entries, {
          request: PIN_RECALL_REQUEST,
          summary: PIN_RECALL_SUMMARY,
          nowMs,
          soulName: PIN_SOUL_NAME,
          windowMs: 600_001
        })
    ]
  ];
}
