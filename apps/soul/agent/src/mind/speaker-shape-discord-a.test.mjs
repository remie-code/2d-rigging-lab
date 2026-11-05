// @ts-check
/**
 * Discord モード Domain A: 話者の形（discord-mode.md §3.2 案 A + soul は案 a）。
 *
 *  - 種類は you / soul / viewer のまま。名前（displayName）を you と soul にも許し、id（speakerId）を足す。
 *  - 整形は「名前があれば `you(名前): 本文`」（①・判定）。soul はロールの名前と id を持っていても `soul: 本文` のまま。
 *  - id は場の中の記録にだけ持ち、①②④・判定には出ない。soul の名前も①②④・判定に新たに出ない。
 *  - soul の行にはロールの id と名前が載る（orchestrator の getSoulSpeaker）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { formatFireInjection, formatFireInjectionSince } from "./fire-injection.mjs";
import { formatTranscriptForDigest, buildWriterRequest } from "./memory.mjs";
import { formatRecentConversation, buildRecallRequest, buildRecallAvoidInput } from "./recall.mjs";
import { buildSpeakNowInput } from "./speak-now.mjs";
import { buildCommentReactInput } from "./comment-react.mjs";
import { createFireOrchestrator } from "./fire-orchestrator.mjs";

const NOW = 2_000_000;
const SOUL_ID = "role-id-zz9";
const SOUL_NAME = "ロール名ZZ";
const PERSON_ID = "discord-user-77777";
const VIEWER_ID = "viewer-id-55555";

/** 名前と id の入った転写（Discord の通話を模した you と、ロールの名前と id を持つ soul）。 */
function namedTranscript() {
  const buffer = createTranscriptBuffer({ nowImpl: () => NOW - 1000 });
  buffer.append({ startMs: 10, endMs: 20, text: "やあ", speaker: "you", displayName: " たろう ", speakerId: PERSON_ID });
  buffer.append({ startMs: 0, endMs: 0, text: "こんにちは", speaker: "soul", displayName: SOUL_NAME, speakerId: SOUL_ID });
  buffer.append({ startMs: 30, endMs: 40, text: "名前なし", speaker: "you" });
  buffer.append({ startMs: 50, endMs: 60, text: "空白の名前", speaker: "you", displayName: "   " });
  buffer.append({ startMs: 0, endMs: 0, text: "コメント", speaker: "viewer", displayName: "みけ", speakerId: VIEWER_ID });
  return buffer;
}

/** @param {string} text */
function assertNoIdsOrSoulName(text) {
  for (const hidden of [SOUL_ID, PERSON_ID, VIEWER_ID, SOUL_NAME]) {
    assert.equal(text.includes(hidden), false, `${hidden} must not appear in: ${text}`);
  }
}

// ── 正本の形 ─────────────────────────────────────────────────────────────

test("Domain A 話者の形: you と soul にも名前を許し、id を持つ（省略時は undefined）", () => {
  const all = namedTranscript().all();
  assert.deepEqual(
    all.map((e) => [e.speaker, e.displayName, e.speakerId]),
    [
      ["you", " たろう ", PERSON_ID],
      ["soul", SOUL_NAME, SOUL_ID],
      ["you", undefined, undefined],
      ["you", "   ", undefined],
      ["viewer", "みけ", VIEWER_ID]
    ]
  );
  assert.ok(all.every((e) => Object.isFrozen(e)));
});

test("Domain A 話者の形: speakerId が文字列でなければ throw（何も積まない）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  assert.throws(() => buffer.append({ startMs: 0, endMs: 0, text: "x", speakerId: /** @type {any} */ (42) }), TypeError);
  assert.equal(buffer.size(), 0);
});

// ── ① ─────────────────────────────────────────────────────────────────

test("Domain A 整形(①): 名前のある you は `you(名前):`・soul は `soul:` のまま・id と soul の名前は出ない", () => {
  const entries = namedTranscript().all();
  const { text } = formatFireInjection(entries, { nowMs: NOW });
  assert.equal(
    text,
    ["you(たろう): やあ", "soul: こんにちは", "you: 名前なし", "you: 空白の名前", "viewer(みけ): コメント"].join("\n")
  );
  assertNoIdsOrSoulName(text);
  const since = formatFireInjectionSince(entries, { nowMs: NOW, afterSeq: 0 }).text;
  assert.equal(since, ["soul: こんにちは", "you: 名前なし", "you: 空白の名前", "viewer(みけ): コメント"].join("\n"));
  assertNoIdsOrSoulName(since);
});

// ── ②④ ────────────────────────────────────────────────────────────────

test("Domain A 整形(②④): id と soul の名前は②の材料・頼み、④の会話・頼み、避けるかの判定の入力に出ない", () => {
  const entries = namedTranscript().all();
  const digest = formatTranscriptForDigest(entries);
  assertNoIdsOrSoulName(digest);
  assert.ok(digest.includes("soul: こんにちは"));
  assertNoIdsOrSoulName(buildWriterRequest({ transcriptText: digest, dateJst: "2026-10-31", existingFiles: [] }));
  const recent = formatRecentConversation(entries, { nowMs: NOW });
  assertNoIdsOrSoulName(recent);
  assert.ok(recent.includes("soul: こんにちは"));
  assertNoIdsOrSoulName(buildRecallRequest({ request: "前回のこと", recentText: recent }));
  const avoid = buildRecallAvoidInput(entries, { request: "前回のこと", summary: "要約", nowMs: NOW, soulName: "チャッピー" });
  assertNoIdsOrSoulName(avoid);
  assert.ok(avoid.includes("チャッピー: こんにちは"));
});

// ── 判定 ───────────────────────────────────────────────────────────────

test("Domain A 整形(判定): speak-now は名前のある you を「配信者(名前)」・soul は頭の名前のまま・id は出ない", () => {
  const input = buildSpeakNowInput(namedTranscript().all(), { nowMs: NOW, soulName: "チャッピー" });
  assert.equal(
    input,
    ["配信者(たろう): やあ", "チャッピー: こんにちは", "配信者: 名前なし", "配信者: 空白の名前"].join("\n")
  );
  assertNoIdsOrSoulName(input);
});

test("Domain A 整形(判定): コメント反応は名前のある you を「配信者(名前)」・soul は頭の名前のまま・id は出ない", () => {
  const entries = namedTranscript().all();
  const comment = { id: "c-1", seq: 99, text: "届いた", displayName: "みけ", arrivedAtMs: NOW };
  const input = buildCommentReactInput(entries, comment, { nowMs: NOW, soulName: "チャッピー" });
  assert.equal(
    input,
    [
      "これまでの会話:",
      "配信者(たろう): やあ",
      "チャッピー: こんにちは",
      "配信者: 名前なし",
      "配信者: 空白の名前",
      "視聴者(みけ): 「コメント」",
      "",
      "届いたコメント:",
      "視聴者(みけ): 「届いた」"
    ].join("\n")
  );
  assertNoIdsOrSoulName(input);
});

// ── soul の行にロールの id と名前（orchestrator）─────────────────────────────

test("Domain A soul の行: orchestrator は soul の行にロールの id と名前を載せ、次の①では `soul:` のまま渡す", { timeout: 5000 }, async () => {
  const buffer = createTranscriptBuffer();
  buffer.append({ startMs: 100, endMs: 900, text: "ねえ" });
  /** @type {string[]} */
  const asked = [];
  /** @type {any[]} */
  const souls = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    getSoulSpeaker: () => ({ id: SOUL_ID, name: SOUL_NAME }),
    session: {
      async ask(/** @type {any} */ text) {
        asked.push(String(text));
        return { replyText: "はーい" };
      }
    },
    speakImpl: async () => ({ timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "C:/tmp/fake.wav" }),
    channel: { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }) },
    player: { play() {} },
    onSoulTranscript: (/** @type {any} */ e) => souls.push(e)
  });
  try {
    const first = await orch.fire();
    assert.equal(first.fired, true);
    const soul = buffer.all()[1];
    assert.equal(soul.speaker, "soul");
    assert.equal(soul.speakerId, SOUL_ID);
    assert.equal(soul.displayName, SOUL_NAME);
    assert.equal(souls[0].speakerId, SOUL_ID);

    buffer.append({ startMs: 1000, endMs: 1900, text: "それで？" });
    await orch.fire();
    const second = asked[asked.length - 1];
    assert.match(second, /soul: はーい/);
    assertNoIdsOrSoulName(second);
  } finally {
    orch.dispose();
  }
});

test("Domain A soul の行: getSoulSpeaker が無い・投げるときは従来の形（名前も id も載せない）", { timeout: 5000 }, async () => {
  for (const getSoulSpeaker of [undefined, () => { throw new Error("no role"); }]) {
    const buffer = createTranscriptBuffer();
    buffer.append({ startMs: 100, endMs: 900, text: "ねえ" });
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      ...(getSoulSpeaker ? { getSoulSpeaker } : {}),
      session: { ask: async () => ({ replyText: "うん" }) },
      speakImpl: async () => ({ timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "C:/tmp/fake.wav" }),
      channel: { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }) },
      player: { play() {} }
    });
    try {
      await orch.fire();
      const soul = buffer.all()[1];
      assert.equal(soul.speaker, "soul");
      assert.equal(soul.displayName, undefined);
      assert.equal(soul.speakerId, undefined);
    } finally {
      orch.dispose();
    }
  }
});
