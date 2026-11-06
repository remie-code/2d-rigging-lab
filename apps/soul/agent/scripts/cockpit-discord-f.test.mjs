// @ts-check
// Discord モード Domain F: cockpit.mjs の側（discord-mode.md §3.4・§12.3）。
//  - 同じ日に配信と通話があっても、場の保存の持ち回りは場ごとに別になる（createRoleMemoryPlaces の beginStream →
//    createStreamRecordLog。記憶の整理 Domain A から本体の名前は②が決めるので、魂が場ごとに分けるのは「この場で書いた
//    ファイル」と場の日付だけ。配信が先 / 通話が先 / 3 つ目の場）。
//  - Discord の場の①: 体験の教え（skills/venue-discord.md）が最後に足され、思い出すの教えは通話の語で差される。配信の①は今のまま。
//  - cockpit.mjs が作る Discord の体験の口（createDiscordVenueExperience）が通話の語の組・Discord の教え・Discord の判定の組を持つ。
// 書き込むのは os.tmpdir() の下の一時フォルダだけ（後片付けあり）。記憶のフォルダの準備（git init・種）は差し替える。実データ・
// 本物の LLM・外部 API・Discord・鍵には触れない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createRoleMemoryPlaces, venueSoulWords, listVenueSoulSkills, buildRoleSessionSystemPrompt, createDiscordVenueExperience } from "./cockpit.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { CALL_WORDING } from "../src/mind/venue-wording.mjs";
import { DISCORD_SPEAK_NOW_QUESTIONS } from "../src/mind/speak-now.mjs";
import { DISCORD_RECALL_AVOID_QUESTIONS } from "../src/mind/recall.mjs";
import { loadSoulSkills, soulSkillNamesForBody } from "../src/mind/soul-skills.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";

/** 2026-11-01 の日本時間 12:00 / 18:00 / 21:00。 */
const NOON_JST = Date.UTC(2026, 10, 1, 3, 0, 0);
const EVENING_JST = Date.UTC(2026, 10, 1, 9, 0, 0);
const NIGHT_JST = Date.UTC(2026, 10, 1, 12, 0, 0);

/** @param {string} root */
function makePlaces(root) {
  return createRoleMemoryPlaces({
    root,
    currentRole: () => ({ id: "chappy", name: { canonical: "チャッピー" } }),
    startedAtMs: NOON_JST,
    // 記憶のフォルダの準備（git init・`_conventions.md` の種）は走らせない（フォルダだけ作る）。
    prepareImpl: async ({ dir }) => {
      mkdirSync(dir, { recursive: true });
      return { ok: true };
    }
  });
}

test("同じ日の配信と通話: 場ごとに別の持ち回り（前の場で書いたファイルは次の場の頼みに載らない・3 つ目の場も別）", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "discord-f-memory-"));
  try {
    const places = makePlaces(root);
    // 配信（昼）: ②が書いた本体を持ち回りに足す（writeStreamRecord が足すのと同じ口）。
    places.beginStream(NOON_JST);
    const stream = /** @type {any} */ (places.place());
    await stream.ready;
    assert.equal(stream.streamRecord.dateJst, "2026-11-01");
    stream.streamRecord.note(["elden-ring/2026-11-01.md"]);
    assert.deepEqual(stream.streamRecord.files(), ["elden-ring/2026-11-01.md"]);
    // 通話（夕方・同じ日）: 新しい場なので置き場を作り直し、持ち回りは空から。
    places.beginStream(EVENING_JST);
    const call = /** @type {any} */ (places.place());
    await call.ready;
    assert.notEqual(call, stream);
    assert.equal(call.dir, stream.dir, "記憶の置き場（ロールのフォルダ）は同じ");
    assert.notEqual(call.streamRecord, stream.streamRecord);
    assert.equal(call.streamRecord.dateJst, "2026-11-01");
    assert.deepEqual(call.streamRecord.files(), [], "前の場で書いたファイルは載らない");
    call.streamRecord.note(["zatsudan/2026-11-01-2.md"]);
    // 同じ場の中では同じ持ち回り（何度聞いても）。
    assert.equal(/** @type {any} */ (places.place()).streamRecord, call.streamRecord);
    assert.deepEqual(call.streamRecord.files(), ["zatsudan/2026-11-01-2.md"]);
    // 3 つ目の場（夜にまた配信）も別。
    places.beginStream(NIGHT_JST);
    const third = /** @type {any} */ (places.place());
    await third.ready;
    assert.deepEqual(third.streamRecord.files(), []);
    assert.deepEqual(stream.streamRecord.files(), ["elden-ring/2026-11-01.md"], "前の場の持ち回りはそのまま（混ざらない）");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("同じ日の配信と通話: 通話が先でも、次の配信は空の持ち回りから・場の日付は場の始まりの日本時間（日付をまたぐ場は翌日）", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "discord-f-memory-"));
  try {
    const places = makePlaces(root);
    places.beginStream(NOON_JST);
    const call = /** @type {any} */ (places.place());
    await call.ready;
    call.streamRecord.note(["zatsudan/2026-11-01.md"]);
    places.beginStream(EVENING_JST);
    const stream = /** @type {any} */ (places.place());
    await stream.ready;
    assert.deepEqual(stream.streamRecord.files(), []);
    assert.equal(stream.streamRecord.dateJst, "2026-11-01");
    // 日本時間 00:30（UTC 15:30）に始めた場は翌日の日付。
    places.beginStream(Date.UTC(2026, 10, 1, 15, 30, 0));
    const late = /** @type {any} */ (places.place());
    await late.ready;
    assert.equal(late.streamRecord.dateJst, "2026-11-02");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Discord の場の①: venue-discord の教えが最後・思い出すの教えは通話の語・配信の①は今のまま", () => {
  const venue = venueSoulWords({ experience: "discord", wording: CALL_WORDING, teaching: "venue-discord" });
  assert.deepEqual(venue, { wording: CALL_WORDING, teaching: "venue-discord" });
  /** @type {string[]} */
  const warnings = [];
  const skills = listVenueSoulSkills({ body: true, venue: /** @type {any} */ (venue), onWarning: (w) => void warnings.push(w) });
  assert.deepEqual(warnings, []);
  assert.deepEqual(
    skills.map((s) => s.name),
    [...soulSkillNamesForBody(true), "venue-discord"]
  );
  const recall = skills.find((s) => s.name === "recall");
  assert.ok(recall?.body.startsWith("過去の配信や通話の記録を思い出したいときは、"));
  const prompt = buildRoleSessionSystemPrompt(MODEL_IDENTITIES.chappy, undefined, skills.map((s) => s.body).join("\n\n"));
  assert.ok(prompt.endsWith(skills[skills.length - 1].body));
  assert.ok(prompt.includes("Discord のボイスチャンネルで通話をしています。"));
  // 配信（場の言葉が無い）は今の道（venueSoulWords が null）・①に Discord の教えは入らない。
  assert.equal(venueSoulWords({ experience: "stream", wording: null, teaching: null }), null);
  const streamPrompt = buildRoleSessionSystemPrompt(MODEL_IDENTITIES.chappy, undefined, loadSoulSkills({ names: soulSkillNamesForBody(true) }));
  assert.equal(streamPrompt.includes("Discord"), false);
});

test("createDiscordVenueExperience: Discord の体験の口は通話の語の組・Discord の教え・Discord の判定の組を持つ（作るだけ・開かない）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "discord-f-cockpit-"));
  try {
    const discord = /** @type {any} */ (
      createDiscordVenueExperience({
        settings: createFileSettingsStore({ path: path.join(dir, "s.json") }),
        currentKeyFile: () => ".env.discord.local",
        write: () => {},
        loadToken: () => ({ ok: false, reason: "テストでは鍵を読まない" })
      })
    );
    assert.equal(discord.wording, CALL_WORDING);
    assert.equal(discord.teaching, "venue-discord");
    assert.equal(discord.judgeSet.speakNow, DISCORD_SPEAK_NOW_QUESTIONS);
    assert.equal(discord.judgeSet.recallAvoid, DISCORD_RECALL_AVOID_QUESTIONS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
