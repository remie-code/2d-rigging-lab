// @ts-check
/**
 * Discord モード Domain B: 耳の束（ear-bundle.mjs・棚卸し §9-4）。
 * 人ごとの耳の集合を場から 1 つの耳に見せる束。場が使う口は寿命（start / dispose）と userSpeaking だけ。
 * 配信ではマイクの耳 1 本がそのまま束の 1 本になる。ここでは N 本でも動くことを偽の耳で確かめる（本物の耳・マイク・
 * 文字起こしには触れない）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createEarBundle } from "./ear-bundle.mjs";
import { createTranscriptBuffer } from "./transcript-buffer.mjs";

/**
 * 偽の耳（start / dispose を記録する）。
 * @param {string} name @param {string[]} log @param {{ startThrows?: boolean }} [opts]
 */
function makeEar(name, log, opts = {}) {
  const ear = {
    started: 0,
    disposed: 0,
    async start() {
      log.push(`${name}.start`);
      if (opts.startThrows) throw new Error(`${name} failed to start (fake)`);
      ear.started += 1;
    },
    async dispose() {
      log.push(`${name}.dispose`);
      ear.disposed += 1;
    }
  };
  return ear;
}

test("耳の束（1 本 = 配信）: start は耳を起こし、dispose は 1 回だけ畳む（冪等）", async () => {
  /** @type {string[]} */
  const log = [];
  const bundle = createEarBundle();
  const mic = bundle.add("mic", makeEar("mic", log));
  assert.equal(bundle.size(), 1);
  assert.deepEqual(bundle.keys(), ["mic"]);
  await bundle.start();
  assert.equal(mic.started, 1);
  await bundle.dispose();
  await bundle.dispose();
  assert.equal(mic.disposed, 1, "二度目の dispose は何もしない");
  assert.equal(bundle.isDisposed(), true);
  assert.equal(bundle.size(), 0);
  assert.deepEqual(log, ["mic.start", "mic.dispose"]);
  assert.throws(() => bundle.add("late", makeEar("late", log)), /disposed/, "畳んだ束には足せない");
});

test("耳の束（N 本）: userSpeaking はどれか 1 本でも喋っていれば真・VAD は耳の名前つきで場の口へそのまま渡る", () => {
  /** @type {Array<{ type: string; key: string }>} */
  const forwarded = [];
  const bundle = createEarBundle({ onVadEvent: (event, key) => forwarded.push({ type: event.type, key }) });
  bundle.add("alice", makeEar("alice", []));
  bundle.add("bob", makeEar("bob", []));
  const alice = bundle.vadMouth("alice");
  const bob = bundle.vadMouth("bob");
  assert.equal(bundle.userSpeaking(), false);
  alice({ type: "speechStart", tMs: 0 });
  assert.equal(bundle.userSpeaking(), true);
  bob({ type: "speechStart", tMs: 10 });
  alice({ type: "speechEnd", tMs: 20 });
  assert.equal(bundle.userSpeaking(), true, "bob がまだ喋っている");
  bob({ type: "speechCancel", tMs: 30 });
  assert.equal(bundle.userSpeaking(), false);
  bob({ type: "vadProbability", tMs: 40 });
  assert.equal(bundle.userSpeaking(), false, "喋っているかは start / end / cancel だけで決まる");
  assert.deepEqual(forwarded, [
    { type: "speechStart", key: "alice" },
    { type: "speechStart", key: "bob" },
    { type: "speechEnd", key: "alice" },
    { type: "speechCancel", key: "bob" },
    { type: "vadProbability", key: "bob" }
  ]);
});

test("耳の束: 1 本だけ外す（remove は畳まない・drop は畳む）・外した耳は喋っている数に入らない・同じ名前は二重に足せない", async () => {
  /** @type {string[]} */
  const log = [];
  /** @type {string[]} */
  const forwarded = [];
  const bundle = createEarBundle({ onVadEvent: (event, key) => forwarded.push(`${key}:${event.type}`) });
  const alice = bundle.add("alice", makeEar("alice", log));
  const bob = bundle.add("bob", makeEar("bob", log));
  assert.throws(() => bundle.add("alice", makeEar("alice2", log)), /already/);
  const aliceVad = bundle.vadMouth("alice");
  aliceVad({ type: "speechStart" });
  assert.equal(bundle.userSpeaking(), true);
  assert.equal(bundle.remove("alice"), alice);
  assert.equal(alice.disposed, 0, "remove は畳まない（畳むのは外した側）");
  assert.equal(bundle.userSpeaking(), false, "外した耳は喋っている数に入らない");
  aliceVad({ type: "speechEnd" });
  assert.deepEqual(forwarded, ["alice:speechStart", "alice:speechEnd"], "外れた耳の出来事も場へは渡る");
  await bundle.drop("bob");
  assert.equal(bob.disposed, 1);
  assert.equal(bundle.has("bob"), false);
  assert.equal(bundle.remove("nobody"), null);
  await bundle.dispose();
  assert.equal(alice.disposed, 0, "外した耳は束の dispose でも畳まない");
});

test("耳の束: 起きない耳があれば、起きた耳と起こしていない耳を畳んで束を空にし、その例外を投げ直す（起きなかった耳は畳まない）", async () => {
  /** @type {string[]} */
  const log = [];
  const bundle = createEarBundle();
  const a = bundle.add("a", makeEar("a", log));
  const b = bundle.add("b", makeEar("b", log, { startThrows: true }));
  const c = bundle.add("c", makeEar("c", log));
  await assert.rejects(() => bundle.start(), /b failed to start/);
  assert.equal(a.disposed, 1, "起きた耳は畳む");
  assert.equal(b.disposed, 0, "起きなかった耳は自分で畳む約束（ear-pipeline）なので畳まない");
  assert.equal(c.disposed, 1, "まだ起こしていない耳も畳む");
  assert.equal(c.started, 0);
  assert.equal(bundle.size(), 0);
  await bundle.dispose();
  assert.equal(a.disposed + b.disposed + c.disposed, 2, "空になった束の dispose は誰も畳まない");
});

test("耳の束（1 本）: 起きなかったら畳まない（配信の今のふるまい = 起きなかった耳は自分で畳む）", async () => {
  /** @type {string[]} */
  const log = [];
  const bundle = createEarBundle();
  const mic = bundle.add("mic", makeEar("mic", log, { startThrows: true }));
  await assert.rejects(() => bundle.start(), /mic failed to start/);
  await bundle.dispose();
  assert.equal(mic.disposed, 0);
  assert.deepEqual(log, ["mic.start"]);
});

test("耳の束: 耳ごとに同じ正本と同じ耳ごとの口を渡せば、N 本でも 1 行 1 回（購読は場の 1 本・耳ごとの口は自分の行だけ）", async () => {
  const transcript = createTranscriptBuffer({ nowImpl: () => 1000 });
  /** @type {string[]} */
  const venueSeen = [];
  transcript.onAppend((entry) => venueSeen.push(entry.text));
  /** @type {Array<{ text: string; latencyMs: number }>} */
  const earMouth = [];
  const mouth = (/** @type {any} */ entry, /** @type {any} */ meta) => earMouth.push({ text: entry.text, latencyMs: meta.latencyMs });
  const bundle = createEarBundle();
  /** 偽の耳（本物の耳と同じく: 渡された正本に積み、積めたら耳ごとの口を直に呼ぶ）。 @param {number} latencyMs */
  const personEar = (latencyMs) => ({
    async start() {},
    async dispose() {},
    /** @param {string} text */
    hear(text) {
      const r = transcript.append({ startMs: 0, endMs: 100, text, speaker: "you" });
      if (r.appended) mouth(r.entry, { latencyMs });
    }
  });
  const alice = bundle.add("alice", personEar(100));
  const bob = bundle.add("bob", personEar(200));
  await bundle.start();
  alice.hear("アリスの一言");
  bob.hear("ボブの一言");
  assert.deepEqual(venueSeen, ["アリスの一言", "ボブの一言"], "場の購読は 1 行 1 回");
  assert.deepEqual(earMouth, [
    { text: "アリスの一言", latencyMs: 100 },
    { text: "ボブの一言", latencyMs: 200 }
  ]);
  await bundle.dispose();
});
