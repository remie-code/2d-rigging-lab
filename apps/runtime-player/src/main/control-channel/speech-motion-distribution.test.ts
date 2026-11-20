import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSpeechMotionSnapshot, type MotionClip, type SpeechMotionSnapshot } from "./speech-motion-assets";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import searchAsset from "../../../assets/speech-motions/search-nuances.json";
import { parseSpeechMotionRequest, SpeechMotionState } from "./speech-motion-state";

let snapshot: SpeechMotionSnapshot;
let profile: string;
beforeAll(async () => {
  profile = await mkdtemp(join(tmpdir(), "motion-asset-catalog-"));
  await cp(new URL("../../../assets/speech-motions", import.meta.url), join(profile, "speech-motions"), { recursive: true });
  snapshot = await loadSpeechMotionSnapshot(profile, () => {});
});
afterAll(async () => {
  await snapshot?.archiveSettled;
  await rm(profile, { recursive: true, force: true });
});

function clipFor(performanceId: string, attentionTargetId: string) {
  const resolved = snapshot.resolve(performanceId, attentionTargetId);
  if ("reason" in resolved) throw new Error(resolved.reason);
  return resolved.clip;
}

function sampleOriginalTrack(points: readonly (readonly [number, number])[], time: number) {
  for (let index = 1; index < points.length; index++) {
    const [start, from] = points[index - 1]!;
    const [end, to] = points[index]!;
    if (time > end!) continue;
    const t = (time - start!) / (end! - start!);
    return from! + (to! - from!) * (t * t * t * (t * (t * 6 - 15) + 10));
  }
  return points.at(-1)![1];
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
  it("resolves 36 adopted pairs from 11 sources with 24 selectable performances", async () => {
    expect(await readdir(join(profile, "speech-motions"))).toHaveLength(11);
    expect(snapshot.catalog.pairs).toHaveLength(36);
    expect(Object.keys(snapshot.catalog.performances)).toHaveLength(24);
    expect(new Set(snapshot.catalog.pairs.map(({ performanceId, attentionTargetId }) =>
      clipFor(performanceId, attentionTargetId))).size).toBe(28);
    expect(parseSpeechMotionRequest({ ...key, op: "play", presetId: "receive" }, undefined, snapshot)).toBeNull();
  });

  it("publishes all six search variations for game and archives their parent once", async () => {
    const selectionIds = Object.keys(searchAsset.nuances).map((nuanceId) => `search-nuances--${nuanceId}`);
    expect(snapshot.catalog.performances).not.toHaveProperty("search-nuances");
    expect(snapshot.resolve("search-nuances", "game")).toEqual({ reason: "unsupported-performance" });
    for (const [nuanceId, nuance] of Object.entries(searchAsset.nuances)) {
      const performanceId = `search-nuances--${nuanceId}`;
      expect(snapshot.catalog.performances[performanceId]).toBe(`${searchAsset.description}\n${nuance.description}`);
      expect(snapshot.catalog.pairs.filter((pair) => pair.performanceId === performanceId))
        .toEqual([{ performanceId, attentionTargetId: "game", clipId: nuance.targets.game }]);
      expect(snapshot.resolve(performanceId, "partner")).toEqual({ reason: "unproduced-pair" });
      expect(snapshot.resolve(performanceId, "viewers")).toEqual({ reason: "unproduced-pair" });
    }
    await snapshot.archiveSettled;
    const archive = snapshot.catalog.definitionArchive!;
    const entries = selectionIds.map((id) => archive.definitions[id]!);
    const { sha256 } = entries[0]!;
    expect(entries).toEqual(selectionIds.map(() => ({ sha256, status: "saved" })));
    expect(await readdir(archive.directory)).toHaveLength(11);
    const content = await readFile(join(archive.directory, sha256 + ".json"), "utf8");
    expect(createHash("sha256").update(content).digest("hex")).toBe(sha256);
    expect(JSON.parse(content)).toEqual(searchAsset);
  });

  it("replays each reviewed clip for every registered target, leaving the mouth to speech", async () => {
    const experiments = new URL("../../../../../discussion/ai-cohost/experiments/", import.meta.url);
    const takes = new URL("motion-library-astra-62/takes/", experiments);
    const expected = new Map<string, MotionClip>();
    for (const filename of await readdir(takes)) {
      const entries: Record<string, { clip: MotionClip } | { previous: string }> =
        JSON.parse(await readFile(new URL(filename, takes), "utf8"));
      for (const [id, take] of Object.entries(entries)) {
        if ("clip" in take) expected.set(id, take.clip);
        else {
          const study = new URL(take.previous, experiments);
          const { remake } = JSON.parse(await readFile(study, "utf8"));
          const performance = JSON.parse(await readFile(new URL("performance.json", study), "utf8"));
          expected.set(id, performance.clips[remake]);
        }
      }
    }
    expect(new Set(snapshot.catalog.pairs.map(p => p.clipId))).toEqual(new Set(expected.keys()));
    for (const { performanceId, attentionTargetId, clipId } of snapshot.catalog.pairs) {
      const original = expected.get(clipId!)!;
      expect(clipFor(performanceId, attentionTargetId)).toEqual(original);
      const { state, send } = fixture();
      const base = { param_mouth_open: 0.6, param_mouth_vowel_a: 0.24 };
      send("begin", 0);
      send("play", 0, { performanceId, attentionTargetId });
      send("end", 70);
      const tracks = Object.entries(original.tracks ?? {});
      const times = new Set(tracks.flatMap(([, points]) => points.map(([t]) => t)));
      for (let t = 0; t <= original.durationMs; t += 50) times.add(t);
      for (const t of [...times].sort((a, b) => a - b)) {
        const pose = state.sampleModelParameters(t, base);
        expect(pose).toMatchObject({ ...original.fixed, ...base });
        for (const [id, points] of tracks) expect(pose[id]).toBeCloseTo(sampleOriginalTrack(points, t), 8);
        const stage = original.stage;
        expect(state.sampleStageScale(t)).toBeCloseTo(stage?.scale ? sampleOriginalTrack(stage.scale, t) : 1, 8);
        expect(state.sampleStageY(t)).toBeCloseTo(stage?.y ? sampleOriginalTrack(stage.y, t) : 0, 8);
      }
      expect(state.sampleModelParameters(original.durationMs + 400, base)).toEqual(base);
    }
  });

  it.each(["cancel", "disconnect", "new section"])("releases active recoil zoom, gaze and expression on %s", event => {
    const { state, send } = fixture();
    const base = { param_eyeball_y: 0.6, param_eye_left_open: 0.2 };
    state.sampleModelParameters(-1, base);
    send("begin", 0);
    send("play", 0, { performanceId: "startled-recoil", attentionTargetId: "game" });
    const scale = state.sampleStageScale(650);
    expect(scale).toBeLessThan(0.98);
    expect(state.sampleModelParameters(650, base)).toMatchObject({ param_startled: 1, param_eye_left_open: 1 });
    if (event === "cancel") send("cancel", 650);
    else if (event === "disconnect") state.disconnect(650, 1);
    else send("begin", 650, {}, 1, { ...key, sectionIndex: 1 });
    expect(state.sampleStageScale(650)).toBe(scale);
    expect(state.sampleStageScale(850)).toBeCloseTo((scale + 1) / 2, 9);
    expect(state.sampleModelParameters(850, base)).toMatchObject({ param_startled: 0.5, param_eyeball_y: 0.3, param_eye_left_open: 0.6 });
    expect(state.sampleStageScale(1050)).toBe(1);
    expect(state.sampleModelParameters(1050, base)).toEqual(base);
  });

  it.each([
    ["none", "unknown", "unsupported-performance"],
    ["brief-relief", "unknown", "unknown-attention-target"],
    ["startled-recoil", "partner", "unproduced-pair"],
    ["ask", "game", "unproduced-pair"]
  ])("distinguishes %s × %s as %s", (performanceId, attentionTargetId, reason) => {
    expect(snapshot.resolve(performanceId, attentionTargetId)).toEqual({ reason });
  });

  it.each(["cancel", "disconnect", "new section"])("releases the tail on %s and ignores late old plays", (event) => {
    const { state, send } = fixture();
    const base = { param_body_angle_x: 2, param_face_angle_x: 12, param_mouth_open: 0.6 };
    state.sampleModelParameters(-10, base);
    send("begin", 0);
    send("play", 0, pair);
    expect(state.sampleModelParameters(0, base)).toMatchObject(base);
    send("end", 70);
    expect(state.sampleModelParameters(1320, base).param_face_angle_x).toBeLessThan(-10);
    const stageY = state.sampleStageY(1510);
    expect(stageY).toBeGreaterThan(2);
    if (event === "cancel") send("cancel", 1510);
    else if (event === "disconnect") state.disconnect(1510, 1);
    else send("begin", 1510, {}, 1, { ...key, sectionIndex: 1 });
    send("play", 1511, pair);
    expect(state.sampleStageY(1510)).toBe(stageY);
    expect(state.sampleStageY(1710)).toBeCloseTo(stageY / 2);
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
    expect(state.sampleStageY(2010)).toBeGreaterThan(2);
    state.clear();
    send("play", 2100, pair, 2);
    expect(state.sampleStageY(2400)).toBe(0);
    expect(state.sampleModelParameters(2400, {})).toEqual({});
  });
});
