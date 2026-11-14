import { fork, type ChildProcess } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

import { expect, it } from "vitest";
import { loadSpeechMotionSnapshot } from "./speech-motion-assets";
import type { RuntimePlayerMappingSlot, RuntimePlayerMappingSlotId } from "../../preload/model-mapping-bridge-contract";
import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { createAutonomousFrameHeart } from "../role-composition/autonomous-frame-heart";
import { RuntimePlayerControlChannelServer } from "./channel-server";
import { createControlChannelWebSocketUrl } from "./channel-url";
import { RuntimePlayerControlChannelOverlayStore } from "./control-channel-overlay-store";
import { deriveStagePresenceStageMotionSettings } from "../presence/stage-presence-drive";
import { RuntimePlayerStageMotionRuntime } from "../stage-motion/stage-motion-runtime";
import { runtimePlayerDefaultStageMotionSettings } from "../window-state/window-state-stage-motion-settings";

const driverPath = fileURLToPath(new URL("../../../../soul/agent/src/test-support/speech-intent-motion-driver.mjs", import.meta.url));

function slot(slotId: RuntimePlayerMappingSlotId, min: number, max: number): RuntimePlayerMappingSlot {
  return {
    slotId, label: slotId, group: "head", enabled: true, invert: false, strength: 1,
    status: "mapped", warningMessages: [],
    target: { parameterId: slotId, displayName: slotId, min, max, default: 0 }
  };
}

const slots: RuntimePlayerMappingSlot[] = [
  ...(["head-horizontal", "head-vertical", "head-tilt"] as const).map((id) => slot(id, -30, 30)),
  ...(["gaze-horizontal", "gaze-vertical"] as const).map((id) => slot(id, -1, 1)),
  ...(["body-x", "body-z"] as const).map((id) => slot(id, -10, 10)),
  ...(["eye-blink-left", "eye-blink-right", "mouth-smile", "mouth-open", "mouth-vowel-a", "mouth-vowel-i",
    "mouth-vowel-u", "mouth-vowel-e", "mouth-vowel-o"] as const).map((id) => slot(id, 0, 1))
];

function section(sectionId: string, generation: number, sectionIndex: number) {
  return {
    sceneId: "fixture-scene", utteranceId: "fixture-utterance-" + generation,
    generation, sectionId, sectionIndex, intent: "intent " + sectionId,
    text: "本文 " + sectionId, context: [{ speaker: "partner", text: "直前の文脈" }]
  };
}

function reply(child: ChildProcess): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const exited = () => reject(new Error("Soul fixture exited before replying."));
    child.once("exit", exited);
    child.once("message", (message: { result?: unknown; error?: string }) => {
      child.removeListener("exit", exited);
      if (message.error) reject(new Error(message.error));
      else resolve(message.result);
    });
  });
}

it("composes Soul motion, expression and speech through the live WebSocket and frame heart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "speech-intent-none-"));
  const children: ChildProcess[] = [];
  let now = 10000;
  let onTick: (() => void) | undefined;
  let frame: RuntimePlayerLiveParameterFrame | undefined;
  let currentSlots = slots;
  const assetProfile = await mkdtemp(join(tmpdir(), "speech-intent-assets-"));
  await cp(new URL("../../../assets/speech-motions", import.meta.url), join(assetProfile, "speech-motions"), { recursive: true });
  const speechMotionSnapshot = await loadSpeechMotionSnapshot(assetProfile, () => {});
  const gestureParameters = {
    "head-horizontal": "param_face_angle_x", "head-vertical": "param_face_angle_y", "head-tilt": "param_face_angle_z",
    "gaze-horizontal": "param_eyeball_x", "gaze-vertical": "param_eyeball_y",
    "body-x": "param_body_angle_x", "body-z": "param_body_angle_z"
  } as Record<string, string>;
  const mapGestureSlots = (items: RuntimePlayerMappingSlot[]) => items.map((entry) => {
    const parameterId = gestureParameters[entry.slotId];
    return parameterId && entry.target ? { ...entry, target: { ...entry.target, parameterId } } : entry;
  });
  currentSlots = mapGestureSlots(slots);
  const mappingTargets = () => currentSlots.flatMap(({ target }) => target ? [target] : []);
  let parameters = mappingTargets();
  let liveEyeInputs = {};
  const store = new RuntimePlayerControlChannelOverlayStore();
  const server = new RuntimePlayerControlChannelServer({
    speechMotionSnapshot,
    overlayStore: store, token: "speech_motion_fixture_token", port: 0,
    getCurrentSlots: () => currentSlots, getMotionParameters: () => parameters, nowMs: () => now
  });
  const heart = createAutonomousFrameHeart({
    liveParameters: { publishFrame: (published) => { frame = published; } },
    now: () => now,
    setIntervalFn: (handler) => {
      onTick = handler;
      return 1 as unknown as ReturnType<typeof setInterval>;
    },
    clearIntervalFn: () => {},
    createGenerator: () => ({ behaviorIds: [], sample: () => ({ "head-horizontal": 0.1, ...liveEyeInputs }) }),
    getChannelOverlay: (time, base, previous) => store.snapshot(time, base, previous),
    getSpeechStageYOffsetPx: (time) => store.sampleStageYOffsetPx(time),
    getSpeechStageScale: (time) => store.sampleStageScale(time),
    resolveSpeechMotionModelParameters: (time, parameters) => store.resolveSpeechMotionModelParameters(time, parameters)
  });
  function tick(elapsed = 0) {
    now += elapsed;
    onTick?.();
    if (!frame) throw new Error("Frame heart did not publish.");
    return frame.parameterValues;
  }

  try {
    const opened = await server.open();
    if (opened.kind !== "open") throw new Error("Control Channel failed to open.");
    const url = createControlChannelWebSocketUrl({ port: opened.port, token: "speech_motion_fixture_token" });
    async function connect() {
      const child = fork(driverPath, [url, directory], { execArgv: [] });
      children.push(child);
      expect(await reply(child)).toBe("ready");
      return (command: string, input: object = {}) => {
        const response = reply(child);
        child.send({ command, input });
        return response;
      };
    }
    const drive = await connect();
    heart.start({
      payload: { summary: { packageId: "fixture", packageRevision: 1 } } as RuntimeExportLoadedPayload,
      slots: currentSlots, seed: 7
    });
    expect(tick().param_face_angle_x).toBeCloseTo(3);

    await drive("send", { request: { op: "begin", generation: 0, sectionIndex: 0 } });
    expect(await drive("send", { request: { op: "play", generation: 0, sectionIndex: 0, stageY: [[10, 50]] } }))
      .toMatchObject({ result: "rejected", error: { code: "invalidPayload" } });
    expect(await drive("send", {
      request: { op: "play", generation: 0, sectionIndex: 0, stageY: [[0, -60], [360, 60]] }
    })).toMatchObject({ result: "accepted" });
    expect(await drive("mouth")).toEqual(["accepted", "accepted", "accepted"]);
    const stageAndPose = tick(540);
    expect(stageAndPose.param_face_angle_x).toBeCloseTo(3);
    expect(stageAndPose["mouth-open"]).toBeGreaterThan(0);
    expect(stageAndPose["mouth-vowel-a"]).toBeGreaterThan(0);
    expect(stageAndPose).not.toHaveProperty("stageYOffsetPx");
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBe(60);
    await drive("send", { request: { op: "cancel", generation: 0, sectionIndex: 0 } });
    tick(200);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBe(30);
    tick(200);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBe(0);

    await drive("prepare", { section: section("late", 1, 0) });
    expect(await drive("start", { id: "late" })).toEqual({ kind: "accepted" });
    expect(await drive("mouth")).toEqual(["accepted", "accepted", "accepted"]);
    expect(tick(110)["mouth-open"]).toBeGreaterThan(0);
    expect(tick().param_face_angle_x).toBeCloseTo(3);

    await drive("prepare", { section: section("ask", 1, 1) });
    await drive("start", { id: "ask" });
    await drive("expression");
    expect(await drive("decide", { id: "ask", choice: "ask" })).toMatchObject({ kind: "selected", performanceId: "ask" });
    expect(await drive("result", { id: "ask" })).toEqual({ kind: "accepted" });
    expect(await drive("decide", { id: "late", choice: "receive" })).toMatchObject({ kind: "selected", performanceId: "receive" });
    expect(await drive("result", { id: "late" })).toEqual({ kind: "skipped" });

    expect(tick().param_face_angle_x).toBeCloseTo(3);
    const combined = tick(1000);
    expect(combined.param_face_angle_x).toBeCloseTo(-24);
    expect(combined.param_eyeball_x).toBeCloseTo(-0.52);
    expect(combined.param_face_angle_z).toBeCloseTo(-3.9963737994610407);
    expect(combined["mouth-smile"]).toBeCloseTo(0.8);
    expect(combined["mouth-open"]).toBeGreaterThan(0);
    expect(combined["mouth-vowel-a"]).toBeGreaterThan(0);

    expect(await drive("send", { request: { op: "play", generation: 1, sectionIndex: 1, presetId: "invalid" } }))
      .toMatchObject({ result: "rejected", error: { code: "invalidPayload" } });
    await drive("send", { request: { op: "play", generation: 1, sectionIndex: 1, performanceId: "receive", attentionTargetId: "partner" } });
    expect(tick().param_face_angle_x).toBeCloseTo(-24);
    expect(tick(2500).param_face_angle_x).toBeCloseTo(-24);
    await drive("finish", { id: "ask" });
    expect(tick(600).param_face_angle_x).toBeCloseTo(-24);

    const none = section("none", 1, 2);
    const { text } = none;
    await drive("prepare", { section: none });
    await drive("start", { id: "none" });
    expect(tick().param_face_angle_x).toBeCloseTo(-24);
    expect(await drive("decide", { id: "none", choice: "none", attention: "unknown" }))
      .toMatchObject({ kind: "unsupported", reason: "unsupported-performance" });
    expect(await readdir(directory)).toHaveLength(0);
    expect(await drive("finalize", { id: "none", text })).toMatchObject({ kind: "saved" });
    expect(await drive("result", { id: "none" })).toMatchObject({ kind: "no-motion", reason: "unsupported-performance" });
    expect(tick(200).param_face_angle_x).toBeCloseTo(-10.5);
    expect(tick(200).param_face_angle_x).toBeCloseTo(3);
    const files = await readdir(directory);
    expect(files).toHaveLength(1);
    expect(JSON.parse(await readFile(join(directory, files[0]!), "utf8"))).toMatchObject({
      ...none, version: 3, result: "unsupported", playbackState: "playing",
      reason: "unsupported-performance", performanceId: "none", attentionTargetId: "unknown"
    });

    await drive("prepare", { section: section("interrupted", 2, 0) });
    await drive("start", { id: "interrupted" });
    await drive("finish", { id: "interrupted", interrupted: true });
    await drive("prepare", { section: section("new-generation", 3, 0) });
    await drive("start", { id: "new-generation" });
    await drive("decide", { id: "interrupted", choice: "ask" });
    expect(await drive("result", { id: "interrupted" })).toEqual({ kind: "skipped" });
    await drive("send", { request: { op: "begin", generation: 2, sectionIndex: 20 } });
    await drive("send", { request: { op: "play", generation: 2, sectionIndex: 20, performanceId: "ask", attentionTargetId: "partner" } });
    expect(tick(1000).param_face_angle_x).toBeCloseTo(3);
    await drive("decide", { id: "new-generation", choice: "interest" });
    expect(await drive("result", { id: "new-generation" })).toEqual({ kind: "accepted" });
    expect(tick(1150).param_face_angle_x).toBeCloseTo(-19.5555555556);

    const disconnected = new Promise<void>((resolve) => {
      const unsubscribe = server.onEvent((event) => {
        if (event.kind === "disconnected") { unsubscribe(); resolve(); }
      });
    });
    await drive("close");
    await disconnected;
    expect(tick().param_face_angle_x).toBeCloseTo(-19.5555555556);
    expect(tick(400).param_face_angle_x).toBeCloseTo(3);

    const next = await connect();
    await next("prepare", { section: section("receive", 0, 0) });
    await next("start", { id: "receive" });
    await next("decide", { id: "receive", choice: "receive" });
    expect(await next("result", { id: "receive" })).toEqual({ kind: "accepted" });
    expect(tick(540).param_face_angle_y).toBeCloseTo(-8);

    for (const [sectionIndex, reason] of ["refusal", "network"].entries()) {
      const failed = section(reason, 0, sectionIndex + 1);
      await next("prepare", { section: failed });
      await next("start", { id: reason });
      const decision = reason === "refusal" ? { choice: "ask", attention: "refusal" } : { choice: "network" };
      expect(await next("decide", { id: reason, ...decision })).toMatchObject({ kind: "failure", reason });
      expect(await next("result", { id: reason })).toMatchObject({ kind: "failure", source: "decision", reason });
      expect(await next("finalize", { id: reason, text: failed.text })).toBeNull();
    }
    parameters = parameters.filter(({ parameterId }) => parameterId !== "param_body_angle_x");
    const mismatch = section("mismatch", 0, 3);
    await next("prepare", { section: mismatch });
    await next("start", { id: "mismatch" });
    expect(await next("decide", { id: "mismatch", choice: "brief-relief", attention: "game" }))
      .toMatchObject({ kind: "selected", performanceId: "brief-relief" });
    expect(await next("result", { id: "mismatch" })).toMatchObject({
      kind: "failure", source: "channel-reply", op: "play", reason: "motionModelMismatch"
    });
    expect(await next("finalize", { id: "mismatch", text: mismatch.text })).toBeNull();
    expect(await readdir(directory)).toEqual(files);

    const unsupportedPairs = [
      { attention: "unknown", reason: "unknown-attention-target" },
      { attention: "viewers", reason: "unproduced-pair" }
    ];
    for (const [index, { attention, reason }] of unsupportedPairs.entries()) {
      const unsupported = section(attention, 0, index + 4);
      await next("prepare", { section: unsupported });
      await next("start", { id: attention });
      expect(await next("decide", { id: attention, choice: "ask", attention }))
        .toMatchObject({ kind: "unsupported", reason, performanceId: "ask", attentionTargetId: attention });
      expect(await next("result", { id: attention })).toEqual({ kind: "no-motion", reason });
      await next("finish", { id: attention });
      const saved = await next("finalize", { id: attention, text: unsupported.text }) as { kind: string; path: string };
      expect(saved.kind).toBe("saved");
      expect(JSON.parse(await readFile(saved.path, "utf8"))).toMatchObject({
        version: 3, result: "unsupported", reason, performanceId: "ask", attentionTargetId: attention,
        finalPlaybackState: "ended"
      });
      files.push(...(await readdir(directory)).filter((name) => !files.includes(name)));
    }

    parameters = mappingTargets();

    // Wave 2 feeds controlled model deltas into production Fire and SpeechStreamer.
    // The synth and physical audio sink are fixtures. Channel and frame composition are real.
    const tagged = "答えを待ちたい";
    const unmatched = "言いよどみを隠したい";
    expect(await next("fireStart")).toContain("<intent");
    await next("fireDelta", { text: "<int" });
    expect(await next("decisionInput", { intent: tagged })).toBeNull();
    expect(await next("fireDelta", { text: `ent ${tagged}>最初の文。` })).toEqual(["最初の文。"]);
    expect(await next("decisionInput", { intent: tagged })).toMatchObject({
      intent: `<intent ${tagged}>`, text: "最初の文。",
      context: { transcript: expect.stringContaining("合成入力の会話文脈") },
      questions: [{ name: "speech_intent_performance" }, { name: "speech_intent_attention" }]
    });
    const firstJob = await next("fireTrace", { event: "speech.playback.input_completed" }) as { playbackId: string };
    await next("firePlayer", { type: "started", id: firstJob.playbackId });
    await next("expression"); // A later request on this socket also confirms previous mouth frames reached Runtime.
    const early = tick(180);
    expect(early["mouth-open"]).toBeGreaterThan(0);
    expect(early["mouth-smile"]).toBeCloseTo(0.8);
    expect(early.param_face_angle_x).toBeCloseTo(3);
    await next("firePlayer", { type: "ended", id: firstJob.playbackId });
    await next("fireDecide", { intent: tagged, choice: "ask" });
    await next("fireTrace", { event: "intent.decision.completed", fields: { sectionIndex: 0 } });
    expect(tick(1000).param_face_angle_x).toBeCloseTo(3); // Still generating, but no active audio job.

    await next("fireDelta", { text: `二文目。<smile><intent ${unmatched}>対応がない文。中断した文。未開始の文。` });
    const secondJob = await next("fireTrace", { event: "speech.playback.input_completed" }) as { playbackId: string };
    expect(secondJob.playbackId).not.toBe(firstJob.playbackId);
    await next("firePlayer", { type: "started", id: secondJob.playbackId });
    expect(await next("fireTrace", { event: "intent.motion.ready", fields: { sectionIndex: 0 } }))
      .toMatchObject({ playbackId: secondJob.playbackId });
    expect(await next("fireTrace", { event: "intent.motion.reply", fields: { sectionIndex: 0 } }))
      .toMatchObject({ kind: "accepted" });
    expect(tick(1000).param_face_angle_x).toBeCloseTo(-24);
    await next("firePlayer", { type: "ended", id: secondJob.playbackId });
    await next("fireTrace", { event: "voice.player.ended", fields: { playbackId: secondJob.playbackId } });
    expect(tick(200).param_face_angle_x).toBeCloseTo(-24); // Natural question end retains attention.

    const noneJob = await next("fireTrace", { event: "speech.playback.input_completed" }) as { playbackId: string };
    await next("firePlayer", { type: "started", id: noneJob.playbackId });
    await next("fireDecide", { intent: unmatched, choice: "none" });
    const noneMotion = await next("fireTrace", { event: "intent.motion.reply", fields: { sectionIndex: 1 } }) as {
      kind: string; generation: number; sectionIndex: number;
    };
    expect(noneMotion).toMatchObject({ kind: "no-motion", reason: "unsupported-performance" });
    expect(tick(400).param_face_angle_x).toBeCloseTo(3);
    await next("firePlayer", { type: "ended", id: noneJob.playbackId });
    const interruptedJob = await next("fireTrace", { event: "speech.playback.input_completed" }) as { playbackId: string };
    await next("firePlayer", { type: "started", id: interruptedJob.playbackId });
    await next("fireDelta", { text: "まだ途中" });
    expect(await next("send", {
      request: {
        op: "play", generation: noneMotion.generation, sectionIndex: noneMotion.sectionIndex,
        performanceId: "brief-relief", attentionTargetId: "partner"
      }
    })).toMatchObject({ result: "accepted" });
    expect(tick(1320).param_body_angle_x).toBe(-5.8);
    const beforeKill = tick(190);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBe(14);
    expect(await next("fireKill")).toMatchObject({ killed: true, severed: true });
    await next("expression"); // Round trip after Fire's cancel on the same connection.
    expect(tick(200).param_body_angle_x).toBeCloseTo(beforeKill.param_body_angle_x! / 2);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBe(7);
    expect(tick(200).param_body_angle_x ?? 0).toBe(0);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBe(0);
    expect(await next("fireDelta", { text: "<intent 終了後に届いた意図>声に出さない。" }))
      .not.toContain("声に出さない。");
    await next("fireReply", {
      replyText: `<intent ${tagged}>最初の文。二文目。<smile><intent ${unmatched}>対応がない文。中断した文。未開始の文。まだ途中`
    });
    expect(await next("fireDone")).toMatchObject({ fired: false, reason: "killed-inflight" });
    expect(await next("fireTrace", { event: "intent.recording.completed", fields: { sectionIndex: 1 } }))
      .toMatchObject({ kind: "saved" });
    const recordedFile = (await readdir(directory)).find((name) => !files.includes(name));
    expect(recordedFile).toBeDefined();
    expect(JSON.parse(await readFile(join(directory, recordedFile!), "utf8"))).toMatchObject({
      version: 3,
      result: "unsupported",
      reason: "unsupported-performance",
      performanceId: "none",
      attentionTargetId: "partner",
      intent: unmatched,
      rawIntentTag: `<intent ${unmatched}>`,
      text: "対応がない文。中断した文。未開始の文。まだ途中",
      decisionInput: { text: "対応がない文。", start: 0, end: 7 },
      context: { transcript: expect.stringContaining("合成入力の会話文脈") },
      playbackState: "playing",
      finalPlaybackState: "interrupted",
      audioPlayback: { ranges: [
        { start: 0, end: 7, state: "completed" },
        { start: 7, end: 13, state: "started-incomplete" },
        { start: 13, end: 19, state: "not-started" },
        { start: 19, end: 23, state: "not-enqueued" }
      ] }
    });

    // A full response has the whole section available, including its final
    // remainder. Its first audio job can start while the decision is held.
    await next("fireRevive");
    await next("fireStart");
    const batchIntent = "ゲーム画面を見て短く息を抜く";
    await next("fireReply", { replyText: `<intent 本文なし><intent ${batchIntent}>間に合った。ふぅ` });
    const batchFirst = await next("fireTrace", {
      event: "speech.playback.input_completed", fields: { jobId: "fire-3:sentence-1" }
    }) as { playbackId: string };
    expect(await next("decisionInput", { intent: "本文なし" })).toBeNull();
    expect(await next("decisionInput", { intent: batchIntent })).toMatchObject({
      intent: `<intent ${batchIntent}>`, text: "間に合った。ふぅ"
    });
    await next("firePlayer", { type: "started", id: batchFirst.playbackId });
    await next("expression");
    expect(tick(180)["mouth-open"]).toBeGreaterThan(0);
    expect(tick().param_face_angle_y ?? 0).toBe(0);
    await next("fireDecide", { intent: batchIntent, choice: "brief-relief", attention: "game" });
    expect(await next("fireTrace", {
      event: "intent.motion.reply", fields: { generation: 3, sectionIndex: 1 }
    })).toMatchObject({ kind: "accepted" });
    await next("firePlayer", { type: "ended", id: batchFirst.playbackId });
    const batchSecond = await next("fireTrace", {
      event: "speech.playback.input_completed", fields: { jobId: "fire-3:sentence-2" }
    }) as { playbackId: string };
    await next("firePlayer", { type: "started", id: batchSecond.playbackId });
    await next("firePlayer", { type: "ended", id: batchSecond.playbackId });
    expect(await next("fireDone")).toMatchObject({ fired: true, replyText: "間に合った。ふぅ" });
    await next("expression");
    expect(tick(1340).param_face_angle_y).toBeCloseTo(-7.6);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBeCloseTo(12.5);
    expect(tick(3160).param_face_angle_y).toBeCloseTo(-1.8);
    expect(tick(400).param_face_angle_y ?? 0).toBe(0);

    await next("fireStart");
    const bargeIntent = "見ているみんなに短く安堵を伝える";
    const bargeReply = `<intent ${bargeIntent}>みんな、ふぅ、間に合ったね。`;
    await next("fireDelta", { text: bargeReply });
    const bargeJob = await next("fireTrace", {
      event: "speech.playback.input_completed", fields: { jobId: "fire-4:sentence-1" }
    }) as { playbackId: string };
    await next("firePlayer", { type: "started", id: bargeJob.playbackId });
    await next("fireDecide", { intent: bargeIntent, choice: "brief-relief", attention: "viewers" });
    expect(await next("fireTrace", {
      event: "intent.motion.reply", fields: { generation: 4, sectionIndex: 0 }
    })).toMatchObject({ kind: "accepted" });
    const beforeBarge = tick(1560);
    expect(beforeBarge.param_eyeball_y).toBeCloseTo(0.48);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBeCloseTo(12);
    expect(await next("fireInterrupt")).toMatchObject({ interrupted: true });
    await next("expression");
    expect(tick(200).param_eyeball_y).toBeCloseTo(beforeBarge.param_eyeball_y! / 2);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBeCloseTo(6);
    expect(tick(200).param_eyeball_y ?? 0).toBe(0);
    await next("fireReply", { replyText: bargeReply });
    expect(await next("fireDone")).toMatchObject({ fired: false, reason: "barge-in" });

    // A result delivered after normal end may be recorded, but cannot start
    // a new clip, including through a later connection.
    const afterEnd = section("after-end", 5, 0);
    await next("prepare", { section: afterEnd });
    await next("start", { id: "after-end" });
    await next("finish", { id: "after-end" });
    await next("decide", { id: "after-end", choice: "brief-relief", attention: "viewers" });
    expect(await next("result", { id: "after-end" })).toEqual({ kind: "skipped" });
    const afterDisconnect = section("after-disconnect", 5, 1);
    await next("prepare", { section: afterDisconnect });
    await next("start", { id: "after-disconnect" });
    await next("close");
    const replacement = await connect();
    await replacement("expression");
    await next("decide", { id: "after-disconnect", choice: "brief-relief", attention: "viewers" });
    expect(await next("result", { id: "after-disconnect" })).toEqual({ kind: "skipped" });
    expect(tick(1180).param_face_angle_y ?? 0).toBe(0);

    liveEyeInputs = { "gaze-horizontal": -0.4, "gaze-vertical": 0.6, "eye-blink-left": 0.3, "eye-blink-right": 0.2 };
    const eyes = {
      "eye-blink-left": "param_eye_left_open", "eye-blink-right": "param_eye_right_open"
    } as Record<string, string>;
    currentSlots = currentSlots.map((entry) => {
      const parameterId = eyes[entry.slotId];
      return parameterId && entry.target ? { ...entry, target: { ...entry.target, parameterId, default: 1 } } : entry;
    });
    parameters = [
      ...mappingTargets(),
      ...["param_shared_laughter", "param_startled"].map((parameterId) => ({ parameterId, displayName: parameterId, min: 0, max: 1, default: 0 }))
    ];
    heart.start({
      payload: { summary: { packageId: "other-fixture", packageRevision: 825 } } as RuntimeExportLoadedPayload,
      slots: currentSlots, seed: 7
    });
    const baseline = tick(3500);
    expect(baseline.param_eyeball_y).toBeCloseTo(0.6);
    expect(baseline.param_eye_left_open).toBeLessThan(1);
    for (const [sectionIndex, attention] of ["partner", "game", "viewers"].entries()) {
      const id = "laugh-" + attention;
      await replacement("prepare", { section: section(id, 0, sectionIndex) });
      await replacement("start", { id });
      expect(await replacement("decide", { id, choice: "shared-laughter", attention }))
        .toMatchObject({ kind: "selected", performanceId: "shared-laughter", attentionTargetId: attention });
      expect(await replacement("result", { id })).toEqual({ kind: "accepted" });
      const fixed = { param_eyeball_x: 0, param_eyeball_y: 0, param_eye_left_open: 1, param_eye_right_open: 1 };
      expect(tick()).toMatchObject(fixed);
      tick(1350);
      await replacement("mouth");
      await replacement("expression");
      const combinedLaugh = tick(130);
      expect(combinedLaugh).toMatchObject({ ...fixed, param_shared_laughter: 1 });
      expect(combinedLaugh["mouth-open"]).toBeGreaterThan(0);
      expect(combinedLaugh["mouth-vowel-a"]).toBeGreaterThan(0);
      expect(heart.getLatestStageMotionSignal().stageYOffsetPx).not.toBe(0);
      const interrupted = attention === "partner";
      await replacement("finish", { id, interrupted });
      if (interrupted) {
        expect(tick(200).param_shared_laughter).toBeCloseTo(0.5);
        tick(200);
      } else {
        expect(tick(400).param_shared_laughter).toBeGreaterThan(0.9);
        tick(4720);
      }
      const released = tick();
      expect(released).not.toHaveProperty("param_shared_laughter");
      expect(released.param_eyeball_y).toBeCloseTo(baseline.param_eyeball_y!);
      expect(released.param_eye_left_open).toBeCloseTo(interrupted ? 0.35 : baseline.param_eye_left_open!);
      expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBe(0);
    }

    const stage = new RuntimePlayerStageMotionRuntime();
    const settings = deriveStagePresenceStageMotionSettings({ enabled: false, strength: 1 });
    const baseTransform = { coordinateSpace: "stage-viewport-px-v1", pan: { x: 0, y: 0 }, zoomScale: 1 } as const;
    function stageFrame() {
      const signal = heart.getLatestStageMotionSignal();
      return stage.update({
        baseTransform, settings: runtimePlayerDefaultStageMotionSettings,
        trackingFrame: null, inputProfile: null, sessionNeutral: null,
        drive: { settings, horizontalInput: signal.horizontal, depthInput: signal.depth,
          timestampMs: signal.timestampMs, stageYOffsetPx: signal.stageYOffsetPx,
          ...(signal.speechStageScale === undefined ? {} : { speechStageScale: signal.speechStageScale }) }
      });
    }
    for (const [offset, attention] of ["game", "viewers", "partner"].entries()) {
      const id = "recoil-" + attention;
      const current = section(id, 0, 3 + offset);
      await replacement("prepare", { section: current });
      await replacement("start", { id });
      const decision = await replacement("decide", { id, choice: "startled-recoil", attention });
      if (attention === "partner") {
        expect(decision).toMatchObject({ kind: "unsupported", reason: "unproduced-pair" });
        expect(await replacement("result", { id })).toEqual({ kind: "no-motion", reason: "unproduced-pair" });
        await replacement("finish", { id });
        const saved = await replacement("finalize", { id, text: current.text }) as { kind: string; path: string };
        expect(saved.kind).toBe("saved");
        expect(JSON.parse(await readFile(saved.path, "utf8"))).toMatchObject({
          reason: "unproduced-pair", performanceId: "startled-recoil", attentionTargetId: "partner"
        });
        expect(tick()).not.toHaveProperty("param_startled");
        continue;
      }
      expect(decision).toMatchObject({ kind: "selected", performanceId: "startled-recoil" });
      expect(await replacement("result", { id })).toEqual({ kind: "accepted" });
      expect(tick()).toMatchObject({ param_eyeball_y: 0, param_eye_left_open: 1 });
      tick(1000);
      await replacement("mouth");
      const peak = tick(130);
      expect(peak).toMatchObject({ param_startled: 1, param_eyeball_y: 0, param_eye_left_open: 1 });
      expect(peak["mouth-open"]).toBeGreaterThan(0);
      const displaced = stageFrame();
      expect(displaced.browserSourceTransform.zoomScale).toBeLessThan(0.96);
      expect(displaced.browserSourceTransform.pan.y).toBeGreaterThan(3);
      expect(displaced.nativeDisplayTransform).toEqual(displaced.browserSourceTransform);
      const interrupted = attention === "game";
      await replacement("finish", { id, interrupted });
      if (interrupted) expect(tick(200).param_startled).toBeCloseTo(0.5);
      else expect(tick(200).param_startled).toBe(1);
      const released = tick(interrupted ? 200 : 5070);
      expect(released).not.toHaveProperty("param_startled");
      expect(released.param_eyeball_y).toBeCloseTo(baseline.param_eyeball_y!);
      expect(stageFrame()).toEqual({ browserSourceTransform: baseTransform, nativeDisplayTransform: null });
    }
  } finally {
    heart.stop();
    await server.close();
    await Promise.all(children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }));
    await rm(assetProfile, { recursive: true, force: true });
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
