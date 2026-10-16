// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createSpeakNowController,
  buildSpeakNowInput,
  buildSpeakNowInstructions,
  buildSpeakNowChoices,
  speakNowQuestion,
  speakNowPersonaLine,
  SPEAK_NOW_CONTEXT_MS,
  SPEAK_NOW_CHOICE_LABELS
} from "./speak-now.mjs";

// speak-now 部品の機械テスト。judge は fake（実 API に繋がない）・バッファ/busy/identity も注入。

/** 手動で解決できる判定（並行・順序入れ替えの検証用）。 */
function makeManualJudge() {
  /** @type {Array<{ request: any; resolve: (r: any) => void; reject: (e: any) => void }>} */
  const calls = [];
  const judge = (/** @type {any} */ request) =>
    new Promise((resolve, reject) => {
      calls.push({ request, resolve, reject });
    });
  return { judge, calls };
}

const result = (choice, p = 0.6, latencyMs = 800) => ({
  choice,
  probs: { wait: 0.1, backchannel: 0.1, respond: 0.1, initiate: 0.1, [choice]: p },
  latencyMs
});

/** microtask を流す。 */
const flush = () => new Promise((r) => setImmediate(r));

function makeHarness(over = {}) {
  const { judge, calls } = makeManualJudge();
  const state = { busy: false, active: true, name: "チャッピー", verbosity: "normal", now: 200_000 };
  /** @type {any[]} */
  const entries = [];
  /** @type {any[]} */ const fires = [];
  /** @type {any[]} */ const judgments = [];
  /** @type {any[]} */ const errors = [];
  const ctl = createSpeakNowController({
    judge,
    getEntries: () => entries,
    isBusy: () => state.busy,
    isActive: () => state.active,
    getName: () => state.name,
    getVerbosity: () => state.verbosity,
    onFire: (r) => fires.push(r),
    onJudgment: (j) => judgments.push(j),
    onError: (e) => errors.push(e),
    nowImpl: () => state.now,
    ...over
  });
  /** you の転写を 1 件積んで食わせる（ear-pipeline の onAppend と同順: append → onTranscript）。 */
  const say = (text, speaker = "you") => {
    const entry = { speaker, text, appendedAtMs: state.now };
    entries.push(entry);
    ctl.handleTranscript(entry);
  };
  return { ctl, calls, state, entries, fires, judgments, errors, say };
}

// ── 問い・選択肢・入力（合意 §1）────────────────────────────────────────────

test("問い・性格・選択肢は probe（問い C・PERSONAS・CHOICES_V2）の「チャッピー」を名前に差し替えたもの", () => {
  const probe = readFileSync(new URL("../../scripts/probe-decisions-speak-now.mjs", import.meta.url), "utf8");
  assert.ok(probe.includes(speakNowQuestion("チャッピー")), "問い C");
  for (const mode of ["quiet", "normal", "chatty"]) {
    assert.ok(probe.includes(speakNowPersonaLine(mode, "チャッピー")), `PERSONAS.${mode}`);
  }
  for (const c of buildSpeakNowChoices("チャッピー")) {
    assert.ok(probe.includes(c.description), `CHOICES_V2 ${c.value}`);
  }
  assert.deepEqual(buildSpeakNowChoices("コーディ").map((c) => c.value), ["wait", "backchannel", "respond", "initiate"]);
  assert.match(buildSpeakNowChoices("コーディ")[0].description, /コーディに向けた発言ではない/);
});

test("buildSpeakNowInstructions: 性格の 1 文（口数）+ 問い C・名前は identity・未知の口数は normal", () => {
  const s = buildSpeakNowInstructions({ name: "コーディ", verbosity: "chatty" });
  assert.equal(s, `${speakNowPersonaLine("chatty", "コーディ")} ${speakNowQuestion("コーディ")}`);
  assert.match(s, /^コーディは話好きなおしゃべりな性格/);
  assert.match(s, /AI Tuber「コーディ」として/);
  assert.match(s, /配信者の話がまだ途中なら待ち、話し終えていればどう反応するかを選ぶ。$/);
  assert.equal(speakNowPersonaLine("bogus", "X"), speakNowPersonaLine("normal", "X"));
  assert.match(speakNowPersonaLine("quiet", "チャッピー"), /^チャッピーは聞き役に徹する/);
});

test("buildSpeakNowInput: 直近 3 分の you/soul を「配信者: …」「{名前}: …」で並べる・viewer と空行は入れない・行数上限なし", () => {
  assert.equal(SPEAK_NOW_CONTEXT_MS, 180_000);
  const now = 1_000_000;
  const entries = [
    { speaker: "you", text: "古い話", appendedAtMs: now - 180_001 },
    { speaker: "you", text: "ぎりぎり", appendedAtMs: now - 180_000 },
    { speaker: "soul", text: "うんうん", appendedAtMs: now - 100_000 },
    { speaker: "viewer", displayName: "a", text: "コメント", appendedAtMs: now - 50_000 },
    { speaker: "you", text: "   ", appendedAtMs: now - 40_000 },
    ...Array.from({ length: 30 }, (_, i) => ({ speaker: "you", text: `行${i}`, appendedAtMs: now - 30_000 + i }))
  ];
  const input = buildSpeakNowInput(entries, { nowMs: now, soulName: "チャッピー" });
  const lines = input.split("\n");
  assert.equal(lines[0], "配信者: ぎりぎり");
  assert.equal(lines[1], "チャッピー: うんうん");
  assert.equal(lines.length, 2 + 30, "20 行の上限は無い");
  assert.equal(input.includes("コメント"), false);
  assert.equal(input.includes("古い話"), false);
  assert.equal(buildSpeakNowInput([], { nowMs: now, soulName: "X" }), "");
});

test("SPEAK_NOW_CHOICE_LABELS: 表示名（待つ/相槌/応答/自発）", () => {
  assert.deepEqual({ ...SPEAK_NOW_CHOICE_LABELS }, { wait: "待つ", backchannel: "相槌", respond: "応答", initiate: "自発" });
});

// ── 判定と発火（合意 §1〜§3）─────────────────────────────────────────────

test("you の転写 1 件ごとに判定を呼ぶ（soul/viewer では呼ばない）・入力と問いは今の identity と口数", async () => {
  const h = makeHarness();
  h.state.name = "コーディ";
  h.state.verbosity = "quiet";
  h.say("ひとりごと", "soul");
  h.say("コメント", "viewer");
  assert.equal(h.calls.length, 0);
  h.say("これどう思う？");
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].request.input, "コーディ: ひとりごと\n配信者: これどう思う？");
  assert.equal(h.calls[0].request.instructions, buildSpeakNowInstructions({ name: "コーディ", verbosity: "quiet" }));
  assert.deepEqual(h.calls[0].request.choices, buildSpeakNowChoices("コーディ"));
});

test("応答・自発 → 発火（不応期・確率なし）／相槌・待つ → 発火しない・判定は毎回 onJudgment", async () => {
  const h = makeHarness();
  for (const choice of ["respond", "initiate", "backchannel", "wait", "respond"]) {
    h.say(`発言 ${choice}`);
    h.calls.at(-1)?.resolve(result(choice, 0.45, 700));
    await flush();
  }
  assert.deepEqual(h.fires, [{ choice: "respond" }, { choice: "initiate" }, { choice: "respond" }], "連続しても毎回発火（不応期なし）");
  assert.deepEqual(h.judgments.map((j) => [j.choice, j.action]), [
    ["respond", "fire"],
    ["initiate", "fire"],
    ["backchannel", "none"],
    ["wait", "none"],
    ["respond", "fire"]
  ]);
  assert.equal(h.judgments[1].probability, 0.45);
  assert.equal(h.judgments[1].latencyMs, 700);
  assert.equal(h.judgments[1].trigger, "transcript");
});

test("判定中に次の発言が来たら並行で呼ぶ・結果到着時に空いていれば発火、忙しければ捨てる", async () => {
  const h = makeHarness();
  h.say("一つ目");
  h.say("二つ目");
  assert.equal(h.calls.length, 2, "前の判定を待たずに並行");
  assert.equal(h.ctl.inFlight(), 2);
  // 二つ目が先に返る → 発火（以後チャッピーは忙しい）。
  h.calls[1].resolve(result("initiate"));
  await flush();
  assert.equal(h.fires.length, 1);
  h.state.busy = true;
  // 一つ目が後から返る → 忙しいので捨てる（判定行は出す）。
  h.calls[0].resolve(result("respond"));
  await flush();
  assert.equal(h.fires.length, 1);
  assert.equal(h.judgments.at(-1).action, "drop-busy");
  assert.equal(h.ctl.inFlight(), 0);
});

test("忙しい間は判定を呼ばず数える → 空いたとき 1 件以上なら 1 回だけ判定（after-busy）", async () => {
  const h = makeHarness();
  h.state.busy = true;
  h.say("喋ってる間の一言");
  h.say("もう一言");
  assert.equal(h.calls.length, 0);
  assert.equal(h.ctl.pendingWhileBusy(), 2);
  h.ctl.notifyIdle(); // まだ忙しい → 何もしない。
  assert.equal(h.calls.length, 0);
  h.state.busy = false;
  h.ctl.notifyIdle();
  assert.equal(h.calls.length, 1, "1 回だけ");
  assert.equal(h.calls[0].request.input, "配信者: 喋ってる間の一言\n配信者: もう一言");
  h.ctl.notifyIdle();
  assert.equal(h.calls.length, 1, "積み残しは消費済み");
  h.calls[0].resolve(result("respond"));
  await flush();
  assert.equal(h.judgments[0].trigger, "after-busy");
  assert.equal(h.fires.length, 1);
});

test("忙しい間に you の発言が無ければ、空いても判定しない", () => {
  const h = makeHarness();
  h.state.busy = true;
  h.say("独り言", "soul");
  h.state.busy = false;
  h.ctl.notifyIdle();
  assert.equal(h.calls.length, 0);
});

test("isActive 偽（モード外・自発 OFF・KILL）は判定を呼ばない・積まない・結果到着時に偽なら発火しない", async () => {
  const h = makeHarness();
  h.state.active = false;
  h.say("呼ばれない");
  assert.equal(h.calls.length, 0);
  h.state.busy = true;
  h.say("積まれない");
  assert.equal(h.ctl.pendingWhileBusy(), 0);
  h.state.busy = false;
  h.state.active = true;
  h.say("呼ばれる");
  h.state.active = false; // 判定待ちの間に OFF。
  h.calls[0].resolve(result("respond"));
  await flush();
  assert.equal(h.fires.length, 0);
  assert.equal(h.judgments[0].action, "drop-inactive");
  // 忙しい間に積んだあと OFF になったら、空いても判定しない（積み残しは捨てる）。
  h.state.active = true;
  h.state.busy = true;
  h.say("積む");
  h.state.active = false;
  h.state.busy = false;
  h.ctl.notifyIdle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.ctl.pendingWhileBusy(), 0);
});

test("判定の失敗は onError（発火しない）・reset で積み残しを捨てる・dispose 後は無視", async () => {
  const h = makeHarness();
  h.say("失敗する");
  const err = Object.assign(new Error("タイムアウト（3 秒）"), { latencyMs: 3000 });
  h.calls[0].reject(err);
  await flush();
  assert.deepEqual(h.errors, [{ trigger: "transcript", message: "タイムアウト（3 秒）", latencyMs: 3000 }]);
  assert.equal(h.fires.length, 0);
  // judge が同期 throw しても onError に落ちる。
  const sync = makeHarness({
    judge: () => {
      throw new Error("sync boom");
    }
  });
  sync.say("x");
  await flush();
  assert.equal(sync.errors[0].message, "sync boom");

  h.state.busy = true;
  h.say("積む");
  h.ctl.reset();
  h.state.busy = false;
  h.ctl.notifyIdle();
  assert.equal(h.calls.length, 1, "reset 済みなので判定しない");

  h.say("最後");
  h.ctl.dispose();
  h.calls.at(-1)?.resolve(result("respond"));
  await flush();
  assert.equal(h.fires.length, 0);
  h.say("無視");
  assert.equal(h.calls.length, 2);
});

test("窓に会話が無ければ判定しない（材料なし）", () => {
  const h = makeHarness();
  const old = { speaker: "you", text: "昔の話", appendedAtMs: 0 };
  h.entries.push(old);
  h.state.busy = true;
  h.ctl.handleTranscript(old);
  h.state.busy = false;
  h.ctl.notifyIdle();
  assert.equal(h.calls.length, 0);
});
