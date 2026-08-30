// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createTtsPlaybackCoordinator } from "./tts-playback-coordinator.mjs";

/** @returns {Promise<void>} */
function microtasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("TTS 準備が逆順に終わっても job identity と FIFO playback order を守る", async () => {
  const prepared = new Map();
  const played = [];
  const queue = createTtsPlaybackCoordinator({ play: (start) => played.push(start) });
  queue.enqueue({ jobId: "job-1", prepare: () => new Promise((resolve) => prepared.set("job-1", resolve)) });
  queue.enqueue({ jobId: "job-2", prepare: () => new Promise((resolve) => prepared.set("job-2", resolve)) });
  await microtasks();
  prepared.get("job-2")("wav-2");
  await microtasks();
  assert.deepEqual(played, []);
  prepared.get("job-1")("wav-1");
  await microtasks();
  assert.deepEqual(played.map((entry) => [entry.jobId, entry.artifact]), [["job-1", "wav-1"]]);
  assert.equal(queue.handleTerminal({ type: "ENDED", playbackId: played[0].playbackId }), true);
  assert.deepEqual(played.map((entry) => [entry.jobId, entry.artifact]), [["job-1", "wav-1"], ["job-2", "wav-2"]]);
});

test("active playback は常に最大一つで、自然 ENDED 一回だけが次を開始する", async () => {
  const played = [];
  const queue = createTtsPlaybackCoordinator({ play: (start) => played.push(start) });
  queue.enqueue({ jobId: "one", prepare: () => "one.wav" });
  queue.enqueue({ jobId: "two", prepare: () => "two.wav" });
  await microtasks();
  assert.equal(played.length, 1);
  const first = played[0].playbackId;
  assert.equal(queue.handleTerminal({ type: "ENDED", playbackId: first }), true);
  assert.equal(played.length, 2);
  assert.equal(queue.handleTerminal({ type: "ENDED", playbackId: first }), false, "duplicate old ENDED is ignored");
  assert.equal(played.length, 2);
});

test("late ENDED/ERROR/STOPPED/timer は新しい playback generation を進めない", async () => {
  const played = [];
  const queue = createTtsPlaybackCoordinator({ play: (start) => played.push(start) });
  queue.enqueue({ jobId: "one", prepare: () => "one.wav" });
  queue.enqueue({ jobId: "two", prepare: () => "two.wav" });
  queue.enqueue({ jobId: "three", prepare: () => "three.wav" });
  await microtasks();
  const oldId = played[0].playbackId;
  queue.handleTerminal({ type: "ENDED", playbackId: oldId });
  const activeId = played[1].playbackId;
  assert.equal(queue.handleTerminal({ type: "ERROR", playbackId: oldId }), false);
  assert.equal(queue.handleTerminal({ type: "STOPPED", playbackId: oldId }), false);
  assert.equal(queue.handleTimer(oldId), false);
  assert.equal(queue.handleTimer(activeId), false);
  assert.equal(played.length, 2);
  assert.equal(queue.snapshot().activePlaybackId, activeId);
});

test("STOPPED/ERROR と prepare failure は後続 work を clear し、late preparation を resurrect しない", async () => {
  const played = [];
  const terminals = [];
  const queue = createTtsPlaybackCoordinator({
    play: (start) => played.push(start),
    onTerminal: (event) => terminals.push(event)
  });
  let lateResolve;
  queue.enqueue({ jobId: "one", prepare: () => "one.wav" });
  queue.enqueue({ jobId: "two", prepare: () => new Promise((resolve) => { lateResolve = resolve; }) });
  await microtasks();
  const id = played[0].playbackId;
  assert.equal(queue.handleTerminal({ type: "ERROR", playbackId: id, error: new Error("player") }), true);
  lateResolve("two.wav");
  await microtasks();
  assert.equal(played.length, 1);
  assert.equal(queue.snapshot().closed, true);
  assert.deepEqual(terminals.map((event) => event.jobId), ["one", "two"]);
});

test("prepare rejection と active STOPPED は同じ generation を閉じ、後続 job を開始しない", async () => {
  const failedPlayed = [];
  const failed = createTtsPlaybackCoordinator({ play: (start) => failedPlayed.push(start) });
  failed.enqueue({ jobId: "bad", prepare: () => Promise.reject(new Error("tts unavailable")) });
  failed.enqueue({ jobId: "later", prepare: () => "later.wav" });
  await microtasks();
  await microtasks();
  assert.equal(failed.snapshot().closed, true);
  assert.deepEqual(failedPlayed, []);

  const stoppedPlayed = [];
  const stopped = createTtsPlaybackCoordinator({ play: (start) => stoppedPlayed.push(start) });
  stopped.enqueue({ jobId: "one", prepare: () => "one.wav" });
  stopped.enqueue({ jobId: "two", prepare: () => "two.wav" });
  await microtasks();
  assert.equal(stopped.handleTerminal({ type: "STOPPED", playbackId: stoppedPlayed[0].playbackId }), true);
  assert.equal(stopped.snapshot().closed, true);
  assert.equal(stoppedPlayed.length, 1);
});

test("kill/barge-in/dispose は queue を clear し、stop は active に一回だけ送る", async () => {
  for (const method of ["kill", "bargeIn", "dispose"]) {
    const played = [];
    let stops = 0;
    const queue = createTtsPlaybackCoordinator({ play: (start) => played.push(start), stop: () => { stops += 1; } });
    queue.enqueue({ jobId: "one", prepare: () => "one.wav" });
    queue.enqueue({ jobId: "two", prepare: () => "two.wav" });
    await microtasks();
    assert.equal(queue[method](), true, method);
    assert.equal(queue[method](), false, `${method} is idempotent`);
    assert.equal(stops, 1);
    assert.deepEqual(queue.snapshot().queuedJobIds, []);
    assert.throws(() => queue.enqueue({ jobId: "late", prepare: () => "late.wav" }), /closed/);
  }
});

test("cancel 後に完了した artifact は cleanup され、temp resource を残さない", async () => {
  let resolvePreparation;
  const cleanups = [];
  const queue = createTtsPlaybackCoordinator({ play: () => {} });
  queue.enqueue({
    jobId: "late",
    prepare: () => new Promise((resolve) => { resolvePreparation = resolve; }),
    cleanup: (event) => cleanups.push(event)
  });
  await microtasks();
  queue.dispose();
  resolvePreparation({ wavPath: "temp.wav" });
  await microtasks();
  assert.deepEqual(cleanups, [{ jobId: "late", artifact: { wavPath: "temp.wav" }, cause: "late-preparation" }]);
});

test("旧 coordinator の全 late signal と play rejection/preparation は新 generation を進めない", async () => {
  const oldPlayed = [];
  let rejectOldPlay;
  let resolveOldPreparation;
  const oldCleanups = [];
  const old = createTtsPlaybackCoordinator({
    play: (start) => {
      oldPlayed.push(start);
      return new Promise((_resolve, reject) => { rejectOldPlay = reject; });
    }
  });
  old.enqueue({ jobId: "old-active", prepare: () => "old.wav", cleanup: (event) => oldCleanups.push(event) });
  old.enqueue({
    jobId: "old-late",
    prepare: () => new Promise((resolve) => { resolveOldPreparation = resolve; }),
    cleanup: (event) => oldCleanups.push(event)
  });
  await microtasks();
  const staleId = oldPlayed[0].playbackId;
  old.kill();

  const newPlayed = [];
  const fresh = createTtsPlaybackCoordinator({ play: (start) => newPlayed.push(start) });
  fresh.enqueue({ jobId: "new-active", prepare: () => "new.wav" });
  fresh.enqueue({ jobId: "new-next", prepare: () => "new-next.wav" });
  await microtasks();
  const freshId = newPlayed[0].playbackId;
  assert.notEqual(freshId, staleId);

  rejectOldPlay(new Error("old play rejected"));
  resolveOldPreparation({ wavPath: "old-temp.wav" });
  await microtasks();
  for (const type of ["ENDED", "ERROR", "STOPPED"]) {
    assert.equal(fresh.handleTerminal({ type, playbackId: staleId }), false, type);
  }
  assert.equal(fresh.handleTimer(staleId), false);
  assert.equal(fresh.snapshot().activePlaybackId, freshId);
  assert.equal(newPlayed.length, 1);
  assert.deepEqual(oldCleanups.map((event) => event.jobId), ["old-active", "old-late"]);
});

test("terminal/clear paths clean ready and active artifacts exactly once", async () => {
  const completedCleanups = [];
  const completedPlayed = [];
  const completed = createTtsPlaybackCoordinator({ play: (start) => completedPlayed.push(start) });
  completed.enqueue({ jobId: "done", prepare: () => "done.wav", cleanup: (event) => completedCleanups.push(event) });
  await microtasks();
  const doneId = completedPlayed[0].playbackId;
  completed.handleTerminal({ type: "ENDED", playbackId: doneId });
  completed.handleTerminal({ type: "ENDED", playbackId: doneId });
  assert.deepEqual(completedCleanups, [{ jobId: "done", artifact: "done.wav", cause: "completed" }]);

  for (const type of ["ERROR", "STOPPED"]) {
    const cleanups = [];
    const played = [];
    const queue = createTtsPlaybackCoordinator({ play: (start) => played.push(start) });
    queue.enqueue({ jobId: "active", prepare: () => "active.wav", cleanup: (event) => cleanups.push(event) });
    queue.enqueue({ jobId: "ready", prepare: () => "ready.wav", cleanup: (event) => cleanups.push(event) });
    await microtasks();
    queue.handleTerminal({ type, playbackId: played[0].playbackId });
    assert.deepEqual(cleanups.map((event) => [event.jobId, event.cause]), [["active", type.toLowerCase()], ["ready", type.toLowerCase()]]);
  }

  const clearCleanups = [];
  const clearPlayed = [];
  const cleared = createTtsPlaybackCoordinator({ play: (start) => clearPlayed.push(start) });
  cleared.enqueue({ jobId: "active", prepare: () => "active.wav", cleanup: (event) => clearCleanups.push(event) });
  cleared.enqueue({ jobId: "ready", prepare: () => "ready.wav", cleanup: (event) => clearCleanups.push(event) });
  await microtasks();
  cleared.bargeIn();
  assert.deepEqual(clearCleanups.map((event) => [event.jobId, event.cause]), [["active", "barge-in"], ["ready", "barge-in"]]);
});

test("prepare failure while active and synchronous/asynchronous play failure clean artifacts without timers/listeners", async () => {
  const prepareCleanups = [];
  const preparePlayed = [];
  let rejectPreparation;
  const prepareFailure = createTtsPlaybackCoordinator({ play: (start) => preparePlayed.push(start) });
  prepareFailure.enqueue({ jobId: "active", prepare: () => "active.wav", cleanup: (event) => prepareCleanups.push(event) });
  prepareFailure.enqueue({ jobId: "bad", prepare: () => new Promise((_resolve, reject) => { rejectPreparation = reject; }) });
  prepareFailure.enqueue({ jobId: "ready", prepare: () => "ready.wav", cleanup: (event) => prepareCleanups.push(event) });
  await microtasks();
  rejectPreparation(new Error("tts failed"));
  await microtasks();
  assert.equal(preparePlayed.length, 1);
  assert.deepEqual(prepareCleanups.map((event) => [event.jobId, event.cause]), [["active", "prepare-failed"], ["ready", "prepare-failed"]]);

  for (const mode of ["throw", "reject"]) {
    const cleanups = [];
    const failing = createTtsPlaybackCoordinator({
      play: () => mode === "throw" ? (() => { throw new Error("play failed"); })() : Promise.reject(new Error("play failed"))
    });
    failing.enqueue({ jobId: mode, prepare: () => `${mode}.wav`, cleanup: (event) => cleanups.push(event) });
    await microtasks();
    await microtasks();
    assert.equal(failing.snapshot().closed, true);
    assert.deepEqual(cleanups.map((event) => [event.jobId, event.cause]), [[mode, "play-failed"]]);
    // This primitive allocates no child listeners or timers; timer signals are
    // explicit no-ops and cannot retain or advance the failed generation.
    assert.equal(failing.handleTimer("anything"), false);
  }
});
