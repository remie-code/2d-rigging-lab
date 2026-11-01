// @ts-check
// Discord モード Domain F: cockpit.mjs の側（discord-mode.md §3.4・§12.3）。
//  - 同じ日に配信と通話があっても、記憶の本体のファイル名は場ごとに別になる（createRoleMemoryPlaces の beginStream →
//    createStreamRecordIdentity → resolveStreamRecordBaseName。一時フォルダで、配信が先 / 通話が先 / 3 つ目の場）。
//  - Discord の場の①: 体験の教え（skills/venue-discord.md）が最後に足され、思い出すの教えは通話の語で差される。配信の①は今のまま。
//  - cockpit.mjs が作る Discord の体験の口（createDiscordVenueExperience）が通話の語の組・Discord の教え・Discord の判定の組を持つ。
// 書き込むのは os.tmpdir() の下の一時フォルダだけ（後片付けあり）。記憶のフォルダの準備（git init・種）は差し替える。実データ・
// 本物の LLM・外部 API・Discord・鍵には触れない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
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

/**
 * ②が本体を書いたことにする（トピックのフォルダに `<baseName>.md`）。
 * @param {string} dir @param {string} topic @param {string} baseName
 */
function writeBody(dir, topic, baseName) {
  mkdirSync(path.join(dir, topic), { recursive: true });
  writeFileSync(path.join(dir, topic, `${baseName}.md`), "本体\n");
}

test("同じ日の配信と通話: 配信が先なら通話の本体は `-2`・次の場は `-3`（場ごとに別のファイル名・前の本体に混ざらない）", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "discord-f-memory-"));
  try {
    const places = makePlaces(root);
    // 配信（昼）: 最初の保存でファイル名が決まり、②が本体を書く。
    places.beginStream(NOON_JST);
    const stream = /** @type {any} */ (places.place());
    await stream.ready;
    const streamName = stream.streamRecord.get();
    assert.deepEqual(streamName, { dateJst: "2026-11-01", baseName: "2026-11-01" });
    writeBody(stream.dir, "elden-ring", streamName.baseName);
    // 通話（夕方・同じ日）: 新しい場なので置き場を作り直し、ファイル名は別。
    places.beginStream(EVENING_JST);
    const call = /** @type {any} */ (places.place());
    await call.ready;
    assert.notEqual(call, stream);
    assert.equal(call.dir, stream.dir, "記憶の置き場（ロールのフォルダ）は同じ");
    const callName = call.streamRecord.get();
    assert.deepEqual(callName, { dateJst: "2026-11-01", baseName: "2026-11-01-2" });
    writeBody(call.dir, "zatsudan", callName.baseName);
    // 同じ場の中では同じ名前（何度聞いても）。
    assert.deepEqual(call.streamRecord.get(), callName);
    // 3 つ目の場（夜にまた配信）も別。
    places.beginStream(NIGHT_JST);
    const third = /** @type {any} */ (places.place());
    await third.ready;
    assert.equal(third.streamRecord.get().baseName, "2026-11-01-3");
    assert.deepEqual(readdirSync(path.join(stream.dir, "elden-ring")), ["2026-11-01.md"], "配信の本体はそのまま");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("同じ日の配信と通話: 通話が先でも次の配信は `-2`（場の種類によらず、同じ日付の本体の最大の番号の次）", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "discord-f-memory-"));
  try {
    const places = makePlaces(root);
    places.beginStream(NOON_JST);
    const call = /** @type {any} */ (places.place());
    await call.ready;
    assert.equal(call.streamRecord.get().baseName, "2026-11-01");
    writeBody(call.dir, "zatsudan", "2026-11-01");
    places.beginStream(EVENING_JST);
    const stream = /** @type {any} */ (places.place());
    await stream.ready;
    assert.equal(stream.streamRecord.get().baseName, "2026-11-01-2");
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
