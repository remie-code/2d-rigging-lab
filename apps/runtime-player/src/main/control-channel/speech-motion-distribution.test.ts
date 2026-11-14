import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSpeechMotionSnapshot, type SpeechMotionSnapshot } from "./speech-motion-assets";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import definition from "../../../../../discussion/ai-cohost/experiments/speech-motion-brief-relief-variants-v1/definition.json";
import wryDefinition from "../../../../../discussion/ai-cohost/experiments/speech-motion-wry-headshake-v1/definition.json";
import recoilDefinition from "../../../../../discussion/ai-cohost/experiments/speech-motion-startled-recoil-v1/definition.json";
import recoilEvidence from "../../../../../discussion/ai-cohost/experiments/speech-motion-startled-recoil-v1/evidence.json";
import partnerLaughter from "../../../../../discussion/ai-cohost/experiments/speech-motion-shared-laughter-partner-v1/definition.json";
import viewersLaughter from "../../../../../discussion/ai-cohost/experiments/speech-motion-shared-laughter-v2/definition.json";
import { parseSpeechMotionRequest, SpeechMotionState } from "./speech-motion-state";

let snapshot: SpeechMotionSnapshot;
let profile: string;
beforeAll(async () => {
  profile = await mkdtemp(join(tmpdir(), "motion-asset-catalog-"));
  await cp(new URL("../../../assets/speech-motions", import.meta.url), join(profile, "speech-motions"), { recursive: true });
  snapshot = await loadSpeechMotionSnapshot(profile, () => {});
});
afterAll(async () => {
  await rm(profile, { recursive: true, force: true });
});

function clipFor(performanceId: string, attentionTargetId: string) {
  const resolved = snapshot.resolve(performanceId, attentionTargetId);
  if ("reason" in resolved) throw new Error(resolved.reason);
  return resolved.clip;
}

const key = { generation: 1, sectionIndex: 0 };
const pair = { performanceId: "brief-relief", attentionTargetId: "partner" };

function fixture() {
  const state = new SpeechMotionState();
  function send(op: string, time: number, payload = {}, owner = 1, section = key) {
    const request = parseSpeechMotionRequest({ ...section, op, ...payload }, undefined, snapshot);
    if (!request) throw new Error("Invalid motion fixture");
    state.apply(request, owner, time);
  }
  return { state, send };
}

describe("speech motion distribution assets", () => {
  it("resolves thirteen adopted pairs from seven performances", () => {
    expect(snapshot.catalog.pairs).toHaveLength(13);
    expect(Object.keys(snapshot.catalog.performances)).toHaveLength(7);
    expect(new Set(snapshot.catalog.pairs.map(({ performanceId, attentionTargetId }) =>
      clipFor(performanceId, attentionTargetId))).size).toBe(10);
    expect(parseSpeechMotionRequest({ ...key, op: "play", presetId: "receive" }, undefined, snapshot)).toBeNull();
  });

  it("preserves the adopted wry headshake with one clip for game and viewers", () => {
    const clip = clipFor("wry-headshake", "game");
    expect(clipFor("wry-headshake", "viewers")).toBe(clip);
    expect(snapshot.resolve("wry-headshake", "partner")).toEqual({ reason: "unproduced-pair" });
    expect(clip.durationMs).toBe(wryDefinition.durationMs);
    expect(clip.stage?.y).toEqual(wryDefinition.stageY);
    expect(Object.keys({ ...clip.tracks, ...clip.fixed }).sort()).toEqual(Object.keys(wryDefinition.tracks).sort());
    for (const [id, points] of Object.entries(wryDefinition.tracks)) {
      if (clip.fixed?.[id] !== undefined) expect(points.every(([, value]) => value === clip.fixed?.[id])).toBe(true);
      else expect(clip.tracks?.[id]).toEqual(points);
    }
    const { state, send } = fixture();
    const base = { param_mouth_open: 0.6, param_eyeball_x: 0.7 };
    send("begin", 0);
    send("play", 0, { performanceId: "wry-headshake", attentionTargetId: "game" });
    send("end", 200);
    expect(state.sampleModelParameters(1700, base)).toMatchObject({
      param_wry_smile: 1, param_face_angle_x: -10, param_eyeball_x: 0, param_mouth_open: 0.6
    });
    expect(state.sampleModelParameters(6400, base)).toEqual(base);
  });

  it("replays the accepted recoil pose, Y and zoom curves at the authored times", () => {
    expect(clipFor("startled-recoil", "game").stage?.y).toEqual(recoilDefinition.stageY);
    const { state, send } = fixture();
    const base = { param_mouth_open: 0.6, param_eye_left_open: 0.3, param_eyeball_y: 0.8 };
    state.sampleModelParameters(-1, base);
    send("begin", 0);
    send("play", 0, { performanceId: "startled-recoil", attentionTargetId: "viewers" });
    send("end", 200);
    for (const frame of recoilEvidence.frames) {
      const pose = state.sampleModelParameters(frame.timeMs, base);
      for (const [id, value] of Object.entries(frame.values)) {
        expect(pose[id]).toBeCloseTo(id === "param_mouth_open" ? 0.6 : value, 8);
      }
      expect(state.sampleStageScale(frame.timeMs)).toBeCloseTo(frame.stageRenderedScale, 8);
      expect(state.sampleStageY(frame.timeMs)).toBeCloseTo(frame.stageRenderedPanYPx, 8);
    }
    expect(state.sampleStageScale(6400)).toBe(1);
    expect(state.sampleModelParameters(6400, base)).toEqual(base);
  });

  it.each(["cancel", "disconnect", "new section"])("releases displayed recoil zoom and expression on %s", (event) => {
    const { state, send } = fixture();
    const base = { param_eye_left_open: 0.3, param_eyeball_y: 0.8 };
    send("begin", 0);
    send("play", 0, { performanceId: "startled-recoil", attentionTargetId: "game" });
    const peak = state.sampleStageScale(1200);
    expect(peak).toBeLessThan(0.96);
    if (event === "cancel") send("cancel", 1200);
    else if (event === "disconnect") state.disconnect(1200, 1);
    else send("begin", 1200, {}, 1, { ...key, sectionIndex: 1 });
    expect(state.sampleStageScale(1200)).toBe(peak);
    expect(state.sampleStageScale(1400)).toBeCloseTo((peak + 1) / 2, 9);
    expect(state.sampleModelParameters(1400, base).param_startled).toBeCloseTo(0.5);
    expect(state.sampleStageScale(1600)).toBe(1);
    expect(state.sampleStageY(1600)).toBe(0);
    expect(state.sampleModelParameters(1600, base)).toEqual(base);
  });

  it.each([
    ["partner", partnerLaughter],
    ["game", viewersLaughter],
    ["viewers", viewersLaughter]
  ])("plays the accepted %s curves and overrides live gaze and blink from the first frame", (attentionTargetId, original) => {
    const clip = clipFor("shared-laughter", attentionTargetId);
    for (const [id, points] of Object.entries(original.tracks)) {
      if (clip.fixed?.[id] !== undefined) expect(points.every(([, value]) => value === clip.fixed?.[id])).toBe(true);
      else expect(clip.tracks?.[id]).toEqual(points);
    }
    expect(clip.stage?.y).toEqual(original.stageY);
    expect(Object.keys(clip.tracks ?? {}).some((id) => id.startsWith("param_mouth_"))).toBe(false);
    const { state, send } = fixture();
    const base = {
      param_eyeball_x: -0.3, param_eyeball_y: 0.65,
      param_eye_left_open: 0.2, param_eye_right_open: 0.4,
      param_mouth_open: 0.6, param_mouth_vowel_a: 0.24
    };
    const fixed = { param_eyeball_x: 0, param_eyeball_y: 0, param_eye_left_open: 1, param_eye_right_open: 1 };
    state.sampleModelParameters(-1, base);
    send("begin", 0);
    send("play", 0, { performanceId: "shared-laughter", attentionTargetId });
    send("end", 100);
    const times = [...new Set([
      ...Array.from({ length: original.durationMs / 50 }, (_, index) => index * 50),
      ...Object.values(original.tracks).flatMap((points) => points.map(([time]) => time!))
    ])].sort((a, b) => a - b);
    for (const time of times) {
      const sampled = state.sampleModelParameters(time, base);
      expect(sampled).toMatchObject({
        ...fixed, param_mouth_open: 0.6, param_mouth_vowel_a: 0.24
      });
      for (const [id, points] of Object.entries(original.tracks)) {
        const authored = points.find(([keyTime]) => keyTime === time)?.[1];
        if (authored !== undefined) expect(sampled[id]).toBeCloseTo(authored, 9);
      }
    }
    for (const [time, value] of clip.stage?.y ?? []) expect(state.sampleStageY(time! + 180)).toBeCloseTo(value!, 9);
    expect(state.sampleModelParameters(original.durationMs, base).param_shared_laughter).toBe(0);
    expect(state.sampleModelParameters(original.durationMs + 400, base)).toEqual(base);
  });

  it("returns the interrupted laugh and eye control to the current base within 400ms", () => {
    const { state, send } = fixture();
    const base = { param_eyeball_y: 0.6, param_eye_left_open: 0.2, param_eye_right_open: 0.2 };
    send("begin", 0);
    send("play", 0, { performanceId: "shared-laughter", attentionTargetId: "viewers" });
    const peak = state.sampleModelParameters(1500, base);
    expect(peak.param_shared_laughter).toBe(1);
    send("cancel", 1500);
    expect(state.sampleModelParameters(1500, base)).toEqual(peak);
    expect(state.sampleModelParameters(1700, base)).toMatchObject({
      param_shared_laughter: 0.5, param_eyeball_y: 0.3, param_eye_left_open: 0.6
    });
    expect(state.sampleModelParameters(1900, base)).toEqual(base);
  });

  it.each([
    ["none", "unknown", "unsupported-performance"],
    ["brief-relief", "unknown", "unknown-attention-target"],
    ["startled-recoil", "partner", "unproduced-pair"],
    ["ask", "game", "unproduced-pair"]
  ])("distinguishes %s × %s as %s", (performanceId, attentionTargetId, reason) => {
    expect(snapshot.resolve(performanceId, attentionTargetId)).toEqual({ reason });
  });

  it("matches the archived tracks and preserves every authored keyframe with neutral entry", () => {
    for (const original of definition.variants) {
      const clip = clipFor("brief-relief", original.id);
      expect(clip.tracks).toEqual(original.tracks);
      expect(clip.stage?.y).toEqual(original.stageY);
      const { state, send } = fixture();
      send("begin", 0);
      send("play", 0, { ...pair, attentionTargetId: original.id });
      send("end", 70);
      const base = { param_mouth_open: 0.6 };
      const times = [...new Set(Object.values(clip.tracks ?? {}).flatMap((points) => points.map(([time]) => time!)))].sort((a, b) => a - b);
      for (const time of times) {
        const result = state.sampleModelParameters(time, base);
        expect(result.param_mouth_open).toBe(0.6);
        for (const [id, points] of Object.entries(clip.tracks ?? {})) {
          const expected = points.find(([keyTime]) => keyTime === time)?.[1];
          if (expected !== undefined) expect(result[id]).toBeCloseTo(expected, 9);
        }
      }
      for (const [time, value] of clip.stage?.y ?? []) expect(state.sampleStageY(time! + 180)).toBeCloseTo(value!, 9);
      expect(state.sampleModelParameters(4900, base)).toEqual(base);
      expect(state.sampleStageY(4900)).toBe(0);
    }
  });

  it.each(["cancel", "disconnect", "new section"])("releases the tail on %s and ignores late old plays", (event) => {
    const { state, send } = fixture();
    const base = { param_body_angle_x: 2, param_face_angle_x: 12, param_mouth_open: 0.6 };
    state.sampleModelParameters(-10, base);
    send("begin", 0);
    send("play", 0, pair);
    expect(state.sampleModelParameters(0, base)).toMatchObject(base);
    send("end", 70);
    expect(state.sampleModelParameters(1320, base).param_body_angle_x).toBe(-5.8);
    const stageY = state.sampleStageY(1510);
    expect(stageY).toBe(14);
    if (event === "cancel") send("cancel", 1510);
    else if (event === "disconnect") state.disconnect(1510, 1);
    else send("begin", 1510, {}, 1, { ...key, sectionIndex: 1 });
    send("play", 1511, pair);
    expect(state.sampleStageY(1510)).toBe(stageY);
    expect(state.sampleStageY(1710)).toBe(7);
    expect(state.sampleStageY(1910)).toBe(0);
    expect(state.sampleModelParameters(1910, base)).toEqual(base);
  });

  it("protects a reconnected owner's new clip from stale controls and clears model swaps", () => {
    const { state, send } = fixture();
    send("begin", 0);
    send("play", 0, pair);
    send("begin", 500, {}, 2);
    send("play", 500, pair, 2);
    send("cancel", 750);
    send("begin", 760, {}, 1, { generation: 999, sectionIndex: 999 });
    state.disconnect(770, 1);
    expect(state.sampleStageY(2010)).toBe(14);
    state.clear();
    send("play", 2100, pair, 2);
    expect(state.sampleStageY(2400)).toBe(0);
    expect(state.sampleModelParameters(2400, {})).toEqual({});
  });
});
