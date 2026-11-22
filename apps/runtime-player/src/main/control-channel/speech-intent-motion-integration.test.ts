import { fork, type ChildProcess } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

import { expect, it } from "vitest";
import { sampleMotionTrack } from "./speech-motion-playback";
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
  function authored(id: string, target: string, channel: string, elapsed: number) {
    const result = speechMotionSnapshot.resolve(id, target);
    if ("reason" in result) throw new Error(result.reason);
    const track = channel === "stageY" ? result.clip.stage?.y : result.clip.tracks?.[channel];
    if (!track) throw new Error("Missing test track: " + channel);
    return sampleMotionTrack(track, elapsed);
  }
  const askAt = (time: number) => authored("ask", "partner", "param_face_angle_x", time);
  const gestureParameters = {
    "head-horizontal": "param_face_angle_x", "head-vertical": "param_face_angle_y", "head-tilt": "param_face_angle_z",
    "gaze-horizontal": "param_eyeball_x", "gaze-vertical": "param_eyeball_y",
    "body-x": "param_body_angle_x", "body-z": "param_body_angle_z",
    "eye-blink-left": "param_eye_left_open", "eye-blink-right": "param_eye_right_open"
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
    expect(combined.param_face_angle_x).toBeCloseTo(askAt(1000));
    expect(combined.param_eyeball_x).toBeCloseTo(authored("ask", "partner", "param_eyeball_x", 1000));
    expect(combined.param_face_angle_z).toBeCloseTo(authored("ask", "partner", "param_face_angle_z", 1000));
    expect(combined["mouth-smile"]).toBeCloseTo(0.8);
    expect(combined["mouth-open"]).toBeGreaterThan(0);
    expect(combined["mouth-vowel-a"]).toBeGreaterThan(0);

    expect(await drive("send", { request: { op: "play", generation: 1, sectionIndex: 1, presetId: "invalid" } }))
      .toMatchObject({ result: "rejected", error: { code: "invalidPayload" } });
    await drive("send", { request: { op: "play", generation: 1, sectionIndex: 1, performanceId: "receive", attentionTargetId: "partner" } });
    expect(tick().param_face_angle_x).toBeCloseTo(askAt(1000));
    expect(tick(2500).param_face_angle_x).toBeCloseTo(askAt(3500));
    await drive("finish", { id: "ask" });
    expect(tick(600).param_face_angle_x).toBeCloseTo(askAt(4100));

    const none = section("none", 1, 2);
    const { text } = none;
    await drive("prepare", { section: none });
    await drive("start", { id: "none" });
    expect(tick().param_face_angle_x).toBeCloseTo(askAt(4100));
    expect(await drive("decide", { id: "none", choice: "none", attention: "unknown" }))
      .toMatchObject({ kind: "unsupported", reason: "unsupported-performance" });
    expect(await readdir(directory)).toHaveLength(0);
    expect(await drive("finalize", { id: "none", text })).toMatchObject({ kind: "saved" });
    expect(await drive("result", { id: "none" })).toMatchObject({ kind: "no-motion", reason: "unsupported-performance" });
    expect(tick(200).param_face_angle_x).toBeCloseTo((askAt(4100) + 3) / 2);
    expect(tick(200).param_face_angle_x).toBeCloseTo(3);
    const files = (await readdir(directory)).filter((name) => name.endsWith(".json"));
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
    expect(tick(1150).param_face_angle_x).toBeCloseTo(authored("interest", "partner", "param_face_angle_x", 1150));

    const disconnected = new Promise<void>((resolve) => {
      const unsubscribe = server.onEvent((event) => {
        if (event.kind === "disconnected") { unsubscribe(); resolve(); }
      });
    });
    await drive("close");
    await disconnected;
    expect(tick().param_face_angle_x).toBeCloseTo(authored("interest", "partner", "param_face_angle_x", 1150));
    expect(tick(400).param_face_angle_x).toBeCloseTo(3);

    const next = await connect();
    await next("prepare", { section: section("receive", 0, 0) });
    await next("start", { id: "receive" });
    await next("decide", { id: "receive", choice: "receive" });
    expect(await next("result", { id: "receive" })).toEqual({ kind: "accepted" });
    expect(tick(445).param_face_angle_y).toBeCloseTo(-8);

    for (const [sectionIndex, reason] of ["refusal", "network"].entries()) {
      const failed = section(reason, 0, sectionIndex + 1);
      await next("prepare", { section: failed });
      await next("start", { id: reason });
      const decision = reason === "refusal" ? { choice: "ask", attention: "refusal" } : { choice: "network" };
      expect(await next("decide", { id: reason, ...decision })).toMatchObject({ kind: "failure", reason });
      expect(await next("result", { id: reason })).toMatchObject({ kind: "failure", source: "decision", reason });
      expect(await next("finalize", { id: reason, text: failed.text })).toBeNull();
    }
    parameters = parameters.filter(({ parameterId }) => parameterId !== "param_face_angle_y");
    const mismatch = section("mismatch", 0, 3);
    await next("prepare", { section: mismatch });
    await next("start", { id: "mismatch" });
    expect(await next("decide", { id: "mismatch", choice: "brief-relief", attention: "game" }))
      .toMatchObject({ kind: "selected", performanceId: "brief-relief" });
    expect(await next("result", { id: "mismatch" })).toMatchObject({
      kind: "failure", source: "channel-reply", op: "play", reason: "motionModelMismatch"
    });
    expect(await next("finalize", { id: "mismatch", text: mismatch.text })).toBeNull();
    expect((await readdir(directory)).filter((name) => name.endsWith(".json"))).toEqual(files);

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
      files.push(...(await readdir(directory)).filter((name) => name.endsWith(".json") && !files.includes(name)));
    }

    parameters = mappingTargets();
    tick(400); // Let the previous section release its received nod before the next response.

    // Real Fire, streaming queue, Control Channel, and frame composition with an emulated audio sink.
    const first = "料理が効いてるね。";
    const second = "お、今の一撃…！";
    const unsupported = "対応がない文。";
    const interrupted = "中断した文。";
    const queued = "未開始の文。";
    const streamedReply = first + second + "<smile>" + unsupported + interrupted + queued;
    const input = (sentence: string) => next("decisionInput", { sentence });
    const decide = (sentence: string, choice: string, attention = "partner") =>
      next("fireDecide", { sentence, choice, attention });
    const event = (type: string, id: string) => next("firePlayer", { type, id });
    const job = async () => (await next("fireTrace", {
      event: "speech.playback.input_completed"
    }) as { playbackId: string }).playbackId;
    const traceMotion = (sectionIndex: number) =>
      next("fireTrace", { event: "intent.motion.reply", fields: { sectionIndex } });
    const record = (generation: number, sectionIndex: number) =>
      next("fireTrace", { event: "intent.recording.completed", fields: { generation, sectionIndex } });
    const newLogDirectory = join(directory, "all-sections");
    const readRecords = async () => Promise.all((await readdir(newLogDirectory))
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => JSON.parse(await readFile(join(newLogDirectory, name), "utf8"))));

    expect(await next("fireStart")).not.toContain("<intent");
    await next("fireDelta", { text: "料理が" });
    expect(await input(first)).toBeNull();
    await next("fireDelta", { text: "効いてるね。" + second });
    expect(await input(first)).toMatchObject({
      sentence: first, precedingSentences: [],
      recentConversation: expect.stringContaining("合成入力の会話文脈"),
      questions: [{ name: "speech_sentence_performance" }, { name: "speech_sentence_attention" }]
    });
    expect(await input(second)).toMatchObject({ sentence: second, precedingSentences: [first] });
    const firstId = await job();
    await event("started", firstId);
    await next("expression");
    expect(tick(180)["mouth-open"]).toBeGreaterThan(0);
    expect(tick().param_face_angle_x).toBeCloseTo(3);
    await event("ended", firstId);
    const secondId = await job();
    await event("started", secondId);
    await decide(second, "ask");
    expect(await traceMotion(1)).toMatchObject({ kind: "accepted", playbackId: secondId });
    expect(tick(1000).param_face_angle_x).toBeCloseTo(askAt(1000));
    await decide(first, "brief-relief");
    expect(await traceMotion(0)).toMatchObject({ kind: "skipped", playbackId: firstId });
    expect(tick().param_face_angle_x).toBeCloseTo(askAt(1000));
    await event("ended", secondId);
    await next("expression");
    expect(tick(200).param_face_angle_x).toBeCloseTo(askAt(1200));

    await next("fireDelta", { text: "<smile>" + unsupported + interrupted + queued });
    const noneId = await job();
    await event("started", noneId);
    await decide(unsupported, "ask", "unknown");
    expect(await traceMotion(2)).toMatchObject({ kind: "no-motion", reason: "unknown-attention-target" });
    await event("ended", noneId);

    const interruptedId = await job();
    await event("started", interruptedId);
    await decide(interrupted, "brief-relief");
    expect(await traceMotion(3)).toMatchObject({ kind: "accepted", playbackId: interruptedId });
    const beforeKill = tick(1510);
    const killY = authored("brief-relief", "partner", "stageY", 1510);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBeCloseTo(killY);
    expect(await next("fireKill")).toMatchObject({ killed: true, severed: true });
    await next("expression");
    expect(tick(200).param_body_angle_z).toBeCloseTo(beforeKill.param_body_angle_z! / 2);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBeCloseTo(killY / 2);
    await decide(queued, "brief-relief");
    expect(await next("fireDelta", { text: "声に出さない。" })).not.toContain("声に出さない。");
    await next("fireReply", { replyText: streamedReply });
    expect(await next("fireDone")).toMatchObject({ fired: false, reason: "killed-inflight" });
    for (let index = 0; index < 5; index += 1) {
      expect(await record(1, index)).toMatchObject({ kind: "saved" });
    }
    const records = (await readRecords()).filter((entry) => entry.generation === 1 && entry.kind === "sentence");
    expect(records).toHaveLength(5);
    expect(records.find((entry) => entry.text === first)).toMatchObject({
      version: 2, decision: { kind: "selected" },
      motionPlayback: { result: "skipped", requests: [] },
      audioPlayback: { ranges: [{ playbackId: firstId, state: "completed" }] }
    });
    expect(records.find((entry) => entry.text === second)).toMatchObject({
      version: 2, decisionInput: { sentence: second, precedingSentences: [first], gameScreenShared: false },
      decision: { kind: "selected", performanceId: "ask", attentionTargetId: "partner" },
      definition: { archiveDirectory: join(assetProfile, "speech-motion-archive"), clipId: expect.any(String) },
      motionPlayback: { result: "accepted", visibility: "unobserved",
        requests: expect.arrayContaining([{ op: "play", status: "accepted" }]) },
      audioPlayback: { ranges: [{ playbackId: secondId, state: "completed" }] }
    });
    expect(records.find((entry) => entry.text === unsupported)).toMatchObject({
      decision: { kind: "unsupported", reason: "unknown-attention-target", effectiveAttentionTargetId: null }
    });
    expect(records.find((entry) => entry.text === interrupted)).toMatchObject({
      interrupted: true, audioPlayback: { ranges: [{ playbackId: interruptedId, state: "started-incomplete" }] }
    });
    expect(records.find((entry) => entry.text === queued)).toMatchObject({
      interrupted: true, audioPlayback: { ranges: [{ state: "not-started" }] }
    });

    await next("fireRevive");
    await next("fireStart", { configuredBrain: "claude", experience: "stream" });
    const batchFirst = "間に合った。";
    const batchSecond = "ふぅ";
    await next("fireReply", { replyText: batchFirst + batchSecond });
    const batchFirstId = await job();
    expect(await input(batchSecond)).toMatchObject({ sentence: batchSecond, precedingSentences: [batchFirst] });
    await event("started", batchFirstId);
    await next("expression");
    expect(tick(180)["mouth-open"]).toBeGreaterThan(0);
    await decide(batchFirst, "brief-relief", "unknown");
    expect(await traceMotion(0)).toMatchObject({ kind: "accepted", playbackId: batchFirstId });
    expect(tick(1340).param_face_angle_y).toBeCloseTo(authored("brief-relief", "game", "param_face_angle_y", 1340));
    await event("ended", batchFirstId);

    const batchSecondId = await job();
    await decide(batchSecond, "brief-relief", "game");
    await event("started", batchSecondId);
    expect(await traceMotion(1)).toMatchObject({ kind: "skipped", reason: "consecutive-motion", playbackId: batchSecondId });
    expect(tick().param_face_angle_y).toBeCloseTo(authored("brief-relief", "game", "param_face_angle_y", 1340));
    await event("ended", batchSecondId);
    expect(await next("fireDone")).toMatchObject({ fired: true, replyText: batchFirst + batchSecond });
    await record(2, 0);
    await record(2, 1);
    const batchRecords = await readRecords();
    expect(batchRecords.find((entry) => entry.text === batchFirst)).toMatchObject({
      decision: { attentionTargetId: "unknown", effectiveAttentionTargetId: "game" },
      decisionInput: { gameScreenShared: true }
    });
    expect(batchRecords.find((entry) => entry.text === batchSecond)).toMatchObject({
      motionPlayback: { result: "skipped", reason: "consecutive-motion", requests: [] }
    });
    expect(tick(1240).param_face_angle_y).toBeCloseTo(-1.5);
    expect(tick(1700).param_face_angle_y ?? 0).toBe(0);

    await next("fireStart");
    const nodFirst = "そこが高台なんだ。";
    const nodSecond = "だから見晴らしがいいんだね。";
    await next("fireDelta", { text: nodFirst + nodSecond });
    const nodFirstId = await job();
    await decide(nodFirst, "receive");
    await decide(nodSecond, "receive");
    await event("started", nodFirstId);
    expect(await traceMotion(0)).toMatchObject({ kind: "accepted", playbackId: nodFirstId });
    const nodPose = tick(360).param_face_angle_y;
    expect(nodPose).toBeCloseTo(authored("receive", "partner", "param_face_angle_y", 360));
    await event("ended", nodFirstId);
    const nodSecondId = await job();
    await event("started", nodSecondId);
    expect(await traceMotion(1)).toMatchObject({ kind: "skipped", reason: "consecutive-motion", playbackId: nodSecondId });
    expect(tick().param_face_angle_y).toBeCloseTo(nodPose);
    await event("ended", nodSecondId);
    await next("fireReply", { replyText: nodFirst + nodSecond });
    expect(await next("fireDone")).toMatchObject({ fired: true, replyText: nodFirst + nodSecond });
    tick(3500);

    await next("fireStart");
    const bargeReply = "みんな、ふぅ、間に合ったね。";
    await next("fireDelta", { text: bargeReply });
    const bargeId = await job();
    await event("started", bargeId);
    await decide(bargeReply, "brief-relief", "viewers");
    expect(await traceMotion(0)).toMatchObject({ kind: "accepted", playbackId: bargeId });
    const beforeBarge = tick(1560);
    expect(beforeBarge.param_eyeball_y).toBeCloseTo(authored("brief-relief", "viewers", "param_eyeball_y", 1560));
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBeCloseTo(authored("brief-relief", "viewers", "stageY", 1560));
    expect(await next("fireInterrupt")).toMatchObject({ interrupted: true });
    await next("expression");
    expect(tick(200).param_eyeball_y).toBeCloseTo(beforeBarge.param_eyeball_y! / 2);
    expect(heart.getLatestStageMotionSignal().stageYOffsetPx).toBeCloseTo(authored("brief-relief", "viewers", "stageY", 1560) / 2);
    expect(tick(200).param_eyeball_y ?? 0).toBe(0);
    await next("fireReply", { replyText: bargeReply });
    expect(await next("fireDone")).toMatchObject({ fired: false, reason: "barge-in" });

    // The venue lease expires at closing, before the asynchronous fold kills audio.
    await next("fireStart", { experience: "stream" });
    const closingSentence = "そろそろ終わるね。";
    await next("fireDelta", { text: closingSentence });
    const closingId = await job();
    await event("started", closingId);
    await next("venueClosing");
    await decide(closingSentence, "brief-relief", "game");
    expect(await traceMotion(0)).toMatchObject({ kind: "skipped", reason: "venue-inactive", playbackId: closingId });
    await next("fireKill");
    await next("fireReply", { replyText: closingSentence });
    expect(await next("fireDone")).toMatchObject({ fired: false, reason: "killed-inflight" });
    expect(await record(5, 0)).toMatchObject({ kind: "saved" });

    // A result delivered after normal end may be recorded, but cannot start
    // a new clip, including through a later connection.
    const afterEnd = section("after-end", 6, 0);
    await next("prepare", { section: afterEnd });
    await next("start", { id: "after-end" });
    await next("finish", { id: "after-end" });
    await next("decide", { id: "after-end", choice: "brief-relief", attention: "viewers" });
    expect(await next("result", { id: "after-end" })).toEqual({ kind: "skipped" });
    const afterDisconnect = section("after-disconnect", 6, 1);
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
      expect(combinedLaugh).toMatchObject(fixed);
      expect(combinedLaugh.param_shared_laughter).toBeCloseTo(authored("shared-laughter", attention, "param_shared_laughter", 1480));
      expect(combinedLaugh["mouth-open"]).toBeGreaterThan(0);
      expect(combinedLaugh["mouth-vowel-a"]).toBeGreaterThan(0);
      expect(heart.getLatestStageMotionSignal().stageYOffsetPx).not.toBe(0);
      const interrupted = attention === "partner";
      await replacement("finish", { id, interrupted });
      if (interrupted) {
        expect(tick(200).param_shared_laughter).toBeCloseTo(combinedLaugh.param_shared_laughter! / 2);
        tick(200);
      } else {
        expect(tick(400).param_shared_laughter).toBeCloseTo(authored("shared-laughter", attention, "param_shared_laughter", 1880));
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
      tick(520);
      await replacement("mouth");
      const peak = tick(130);
      expect(peak).toMatchObject({ param_startled: 1, param_eyeball_y: 0, param_eye_left_open: 1 });
      expect(peak["mouth-open"]).toBeGreaterThan(0);
      const displaced = stageFrame();
      expect(displaced.browserSourceTransform.zoomScale).toBeLessThan(0.98);
      expect(displaced.browserSourceTransform.pan.y).toBeLessThan(-2);
      expect(displaced.nativeDisplayTransform).toEqual(displaced.browserSourceTransform);
      const interrupted = attention === "game";
      await replacement("finish", { id, interrupted });
      if (interrupted) expect(tick(200).param_startled).toBeCloseTo(0.5);
      else expect(tick(200).param_startled).toBeCloseTo(authored("startled-recoil", attention, "param_startled", 850));
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
    await speechMotionSnapshot.archiveSettled;
    await rm(assetProfile, { recursive: true, force: true });
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
