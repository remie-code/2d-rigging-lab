// @ts-check
// Discord モード Domain C: cockpit.mjs の側（discord-mode.md §3.4）。
//  - 保存の係（createMemoryRecorder）が、保存を頼んだ時点の場の語の組を②へ渡す（getWording → writeImpl の 3 つ目の引数）。
//  - ①の教えと会話指示の編集画面: 場の言葉（venueSoulWords）が無い（配信・閉じている）なら今の道、あれば体験の教えと語の組で読む
//    （listVenueSoulSkills・createConversationInstructionHooks の 5 つ目の口）。配信の①は一字も変わらない。
//  - ロールの束の④は job.wording をそのまま渡す。
//  - main() の結線（main は export されず走らせられないので、ソースの並びで固定する・前例と同じ流儀）。
// 偽の保存・偽の教えの一覧だけ。実データ・本物の LLM・外部 API・Discord には触れない。ファイルは書かない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createMemoryRecorder,
  createConversationInstructionHooks,
  createInstructionRevisionController,
  createVenueRoleBundle,
  buildRoleSessionSystemPrompt,
  venueSoulWords,
  listVenueSoulSkills
} from "./cockpit.mjs";
import { listSoulSkills, loadSoulSkills, soulSkillNamesForBody } from "../src/mind/soul-skills.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";

const FAKE_WORDING = Object.freeze({
  keeper: "〈仮の置き場〉",
  venue: "〈仮の場〉",
  transcriptKind: "〈仮の材料〉",
  speakers: "〈仮の話者の説明〉。",
  records: "〈仮の記録〉",
  partner: "〈仮の相手〉",
  conventionsNote: "〈仮の決まりの一文〉"
});

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setImmediate(r));
};

// ── 保存の係: 頼んだ時点の語の組 ─────────────────────────────────────────

test("createMemoryRecorder: 保存を頼んだ時点の語の組を writeImpl の 3 つ目に渡す（走る前に場が替わっても頼んだ時の語の組）", async () => {
  /** @type {any[]} */
  const writes = [];
  /** @type {Array<() => void>} */
  const gates = [];
  let wording = /** @type {any} */ (FAKE_WORDING);
  const placeA = { id: "A" };
  const placeB = { id: "B" };
  let place = placeA;
  const recorder = createMemoryRecorder({
    getLiveEntries: () => [],
    getPlace: () => place,
    getWording: () => wording,
    writeImpl: (entries, p, w) => {
      writes.push({ n: entries.length, place: p, wording: w });
      return new Promise((resolve) => gates.push(() => resolve({ written: true })));
    }
  });
  const first = recorder.record([1]);
  // 走っている間に、次の場（配信）で頼む（置き場は場ごとに違う）。
  wording = null;
  place = placeB;
  const second = recorder.record([1, 2]);
  gates.shift()?.();
  await flush();
  gates.shift()?.();
  await Promise.all([first, second]);
  assert.deepEqual(writes, [
    { n: 1, place: placeA, wording: FAKE_WORDING },
    { n: 2, place: placeB, wording: null }
  ]);
});

test("createMemoryRecorder: 待っている 1 件を差し替えるときは新しい方の語の組・getWording が無い / 投げたら null", async () => {
  /** @type {any[]} */
  const writes = [];
  /** @type {Array<() => void>} */
  const gates = [];
  let n = 0;
  const recorder = createMemoryRecorder({
    getLiveEntries: () => [],
    getPlace: () => "same",
    getWording: () => {
      n += 1;
      if (n === 1) throw new Error("boom");
      return n === 2 ? { tag: "old" } : { tag: "new" };
    },
    writeImpl: (entries, _p, w) => {
      writes.push({ n: entries.length, wording: w });
      return new Promise((resolve) => gates.push(() => resolve({ written: true })));
    }
  });
  const a = recorder.record([1]);
  const b = recorder.record([1, 2]);
  const c = recorder.record([1, 2, 3]);
  gates.shift()?.();
  await flush();
  gates.shift()?.();
  await Promise.all([a, b, c]);
  assert.deepEqual(writes, [
    { n: 1, wording: null },
    { n: 3, wording: { tag: "new" } }
  ]);

  /** @type {any[]} */
  const plain = [];
  const legacy = createMemoryRecorder({
    getLiveEntries: () => [],
    writeImpl: async (entries, p, w) => {
      plain.push([entries.length, p, w]);
      return { written: true };
    }
  });
  await legacy.record([1]);
  assert.deepEqual(plain, [[1, undefined, null]], "getWording が無ければ null（= 配信の語の組）");
});

// ── ①の教えと編集画面 ─────────────────────────────────────────────────

test("venueSoulWords: 閉じている・配信（語の組も教えも null）は null・どちらかを持つ場だけ { wording, teaching }", () => {
  assert.equal(venueSoulWords(null), null);
  assert.equal(venueSoulWords(undefined), null);
  assert.equal(venueSoulWords({ experience: "stream", wording: null, teaching: null }), null);
  assert.deepEqual(venueSoulWords({ experience: "discord", wording: FAKE_WORDING, teaching: null }), { wording: FAKE_WORDING, teaching: null });
  assert.deepEqual(venueSoulWords({ experience: "discord", wording: null, teaching: "venue-discord" }), { wording: null, teaching: "venue-discord" });
});

test("listVenueSoulSkills: 体の有無で選ぶ教えの最後に体験の教え・本文はその体験の語で差す", () => {
  /** @type {any[]} */
  const calls = [];
  listVenueSoulSkills({
    body: false,
    venue: { wording: FAKE_WORDING, teaching: "venue-discord" },
    listImpl: (o) => {
      calls.push(o);
      return [];
    }
  });
  assert.deepEqual([...calls[0].names], ["screen", "recall", "venue-discord"]);
  assert.equal(calls[0].wording, FAKE_WORDING);
  const real = listVenueSoulSkills({ body: true, venue: { wording: FAKE_WORDING, teaching: null } });
  assert.deepEqual(real.map((s) => s.name), ["expression", "screen", "recall"]);
  assert.ok(real[2].body.startsWith("〈仮の記録〉を思い出したいときは"));
});

test("①（配信）: 場の言葉が無い道の①の固定の指示は今と同じ（体験の道に語の組も教えも無ければ同じ文字列）", () => {
  const identity = MODEL_IDENTITIES.chappy;
  const streamPath = buildRoleSessionSystemPrompt(identity, "指示", loadSoulSkills({ names: soulSkillNamesForBody(true) }));
  assert.equal(streamPath, buildRoleSessionSystemPrompt(identity, "指示"));
  const venuePath = buildRoleSessionSystemPrompt(
    identity,
    "指示",
    listVenueSoulSkills({ body: true, venue: { wording: null, teaching: null } })
      .map((s) => s.body)
      .join("\n\n")
  );
  assert.equal(venuePath, streamPath, "語の組も教えも無ければ体験の道でも同じ");
});

test("createConversationInstructionHooks: 場の言葉で見せる一覧があればそれを・null なら今の一覧（配信の語）", () => {
  let venueList = /** @type {any} */ (null);
  const hooks = createConversationInstructionHooks(
    { getConversationInstructionProfile: () => ({}) },
    () => "chappy",
    createInstructionRevisionController(),
    () => listSoulSkills({ names: soulSkillNamesForBody(true) }),
    () => venueList
  );
  assert.deepEqual(hooks.getSoulSkills(), listSoulSkills());
  assert.ok(hooks.getSoulSkills().find((s) => s.name === "recall")?.body.includes("過去の配信の記録"), "閉じていれば配信の語（印のままではない）");
  venueList = listVenueSoulSkills({ body: true, venue: { wording: FAKE_WORDING, teaching: null } });
  assert.ok(hooks.getSoulSkills().find((s) => s.name === "recall")?.body.startsWith("〈仮の記録〉"));
  const legacy = createConversationInstructionHooks({ getConversationInstructionProfile: () => ({}) }, () => "chappy");
  assert.deepEqual(legacy.getSoulSkills(), listSoulSkills(), "5 つ目を渡さなければ今まで通り");
});

// ── ロールの束の④ ─────────────────────────────────────────────────────

test("createVenueRoleBundle: ④の job（語の組を含む）をそのまま渡す", async () => {
  /** @type {any[]} */
  const jobs = [];
  const bundle = createVenueRoleBundle({
    currentId: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    streamHooks: {},
    prepareVoice: () => ({ ok: true }),
    startVoiceResources: () => {},
    recallRunner: async (job) => {
      jobs.push(job);
      return { found: false, summary: "" };
    }
  });
  const job = { request: "r", entries: [], nowMs: 0, wording: FAKE_WORDING };
  await bundle.recall?.run(job);
  assert.equal(jobs[0], job);
});

// ── main() の結線（ソースの並び）────────────────────────────────────────

test("場の言葉の結線（main）: ②は頼んだ時点の語の組・④は job.wording・①と編集画面は venueContext から（配信は今の道）", () => {
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const main = source.slice(source.indexOf("async function main()"));
  const writer = main.slice(main.indexOf("const memoryRecorder = createMemoryRecorder"), main.indexOf("const memoryStatus = () =>"));
  assert.match(writer, /getWording: \(\) => server\?\.venueContext\(\)\?\.wording \?\? null,/);
  assert.match(writer, /writeImpl: async \(entries, \/\*\* @type \{ReturnType<typeof memoryPlaces\.place>\} \*\/ place, wording\) => \{/);
  assert.match(writer, /dir: place\.dir,\n\s+wording,\n\s+onWarning: onBrainWarning/);
  assert.match(writer, /const recallRunner = async \(job\) => \{[\s\S]*?wording: job\.wording \?\? null,/);
  assert.match(main, /const sessionVenue = venueSoulWords\(server\?\.venueContext\(\) \?\? null\);/);
  assert.match(
    main,
    /sessionVenue\n\s+\? listVenueSoulSkills\(\{ body: sessionHasBody, venue: sessionVenue, onWarning: onBrainWarning \}\)[\s\S]*?: loadSoulSkills\(\{ names: soulSkillNamesForBody\(sessionHasBody\), onWarning: onBrainWarning \}\)/,
    "配信・場の外は今の道"
  );
  assert.match(
    main,
    /\(\) => listSoulSkills\(\{ names: soulSkillNamesForBody\(currentBody\(\)\) \}\),\n\s+\(\) => \{\n\s+const venue = venueSoulWords\(server\?\.venueContext\(\) \?\? null\);\n\s+return venue \? listVenueSoulSkills\(\{ body: currentBody\(\), venue \}\) : null;/,
    "編集画面はそのときの体験の語（閉じていれば配信の語）"
  );
});
