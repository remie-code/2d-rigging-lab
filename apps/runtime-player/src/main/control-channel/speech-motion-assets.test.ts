import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadSpeechMotionSnapshot, speechMotionModelIssue, type MotionClip } from "./speech-motion-assets";
import { SpeechMotionState } from "./speech-motion-state";
import { RuntimePlayerControlChannelServer } from "./channel-server";
import { RuntimePlayerControlChannelOverlayStore } from "./control-channel-overlay-store";
import { createControlChannelWebSocketUrl } from "./channel-url";
import type { RuntimePlayerMappingTarget } from "../../preload/model-mapping-bridge-contract";
import { createAutoMappingSlots } from "../live-mapping/runtime-export-auto-mapping";
import { semanticSlotDefinitions } from "../live-mapping/semantic-slot-definitions";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { fork, type ChildProcess } from "node:child_process";

const asset = {
  version: 1, id: "new-performance", description: "First description", targets: { game: "clip" },
  clips: { clip: { entry: "lead-in", durationMs: 400, tracks: { param_test: [[0, 0], [400, 1]] },
    defaults: { param_test: 0 }, stage: { y: [[0, 0], [400, 10]], scale: [[0, 1], [400, 0.95]] } } }
};
const hierarchicalAsset = {
  version: 2,
  id: "search",
  description: "Search",
  nuances: {
    inspect: { description: "Inspect one place", targets: { game: "clip" } },
    compare: { description: "Compare two places", targets: { game: "clip" } }
  },
  clips: asset.clips
};
const parameter = { parameterId: "param_test", displayName: "Test", min: 0, max: 1, default: 0 };
const key = { generation: 1, sectionIndex: 0 };
const token = "external_speech_motion_test";
const mouthParameters = semanticSlotDefinitions.filter((definition) => definition.group === "mouth")
  .map((definition) => ({
    ...parameter, parameterId: definition.slotId, projectPresetAlias: definition.targetAliases[0],
    runtimeRole: "external-input", externalInput: true, readOnly: false, valueSource: "authoredInput"
  }));
const mouthSlots = createAutoMappingSlots({ artifacts: { model: {
  parameters: mouthParameters,
  inputManifest: {
    externalInputParameterIds: mouthParameters.map(({ parameterId }) => parameterId),
    computedDynamicsOutputParameterIds: [], hiddenDirectControlParameterIds: []
  }
} } } as unknown as RuntimeExportLoadedPayload);

it("supplies live Soul decisions and playback from one startup snapshot across successive servers", async () => {
  const profile = await mkdtemp(join(tmpdir(), "speech-motion-snapshot-"));
  const directory = join(profile, "speech-motions");
  const path = join(directory, "test.json");
  const selection = { performanceId: asset.id, attentionTargetId: "game" };
  let now = 0;
  let parameters: RuntimePlayerMappingTarget[] = [parameter];
  const serve = async (run: (query: () => Promise<unknown>, overlay: RuntimePlayerControlChannelOverlayStore) => Promise<void>) => {
    const overlay = new RuntimePlayerControlChannelOverlayStore();
    const snapshot = await loadSpeechMotionSnapshot(profile, () => {});
    const server = new RuntimePlayerControlChannelServer({
      port: 0, token, overlayStore: overlay, nowMs: () => now,
      speechMotionSnapshot: snapshot,
      getCurrentSlots: () => mouthSlots,
      getMotionParameters: () => parameters,
    });
    const opened = await server.open();
    if (opened.kind !== "open") throw new Error("Control Channel failed to open.");
    const url = createControlChannelWebSocketUrl({ port: opened.port, token });
    const fixtures: ChildProcess[] = [];
    try {
      await run(() => new Promise((resolve, reject) => {
        const driver = fileURLToPath(new URL("../../../../soul/agent/src/test-support/speech-motion-assets-fixture.mjs", import.meta.url));
        const fixture = fork(driver, [url, asset.id], { execArgv: [] });
        fixtures.push(fixture);
        fixture.once("message", resolve);
        fixture.once("error", reject);
        fixture.once("exit", (code) => reject(new Error(`Soul fixture exited ${code}`)));
      }), overlay);
    } finally {
      await server.close();
      for (const fixture of fixtures) fixture.kill();
      await snapshot.archiveSettled;
    }
  };
  try {
    await mkdir(directory);
    await writeFile(path, JSON.stringify(asset));
    await serve(async (query, overlay) => {
      await writeFile(path, JSON.stringify({ ...asset, description: "Edited description" }));
      const first = await query();
      expect(first).toMatchObject({
        description: asset.description, decision: { kind: "selected", ...selection }, result: "accepted",
        archive: { directory: join(profile, "speech-motion-archive"), definitions: {
          [asset.id]: { sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }
        } },
        pair: { ...selection, clipId: "clip" }
      });
      expect(overlay.resolveSpeechMotionModelParameters(580, { param_test: 0, param_mouth_open: 0.7 }))
        .toEqual({ param_test: 1, param_mouth_open: 0.7 });
      expect(overlay.sampleStageYOffsetPx(580)).toBe(10);
      expect(overlay.sampleStageScale(580)).toBe(0.95);
    });
    now = 1000;
    await serve(async (query) => {
      expect(await query()).toMatchObject({
        description: "Edited description", decision: { kind: "selected" }, result: "accepted"
      });
      parameters = [];
      expect(await query()).toMatchObject({
        result: "rejected", error: { code: "motionModelMismatch", message: "Missing writable model parameter: param_test." }
      });
    });
    await rm(path);
    await serve(async (query) => {
      expect(await query()).toMatchObject({
        decision: { kind: "unsupported", reason: "speech-motion-catalog-unavailable" },
        result: "rejected", error: { message: "unsupported-performance" }, speech: "accepted"
      });
    });
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
}, 15_000);

it("excludes invalid and duplicate files while keeping independent assets", async () => {
  const profile = await mkdtemp(join(tmpdir(), "speech-motion-validation-"));
  const directory = join(profile, "speech-motions");
  const diagnostics: string[] = [];
  try {
    await mkdir(directory);
    await Promise.all([
      writeFile(join(directory, "valid.json"), JSON.stringify(asset)),
      writeFile(join(directory, "duplicate.json"), JSON.stringify({ ...asset, targets: { viewers: "missing" } })),
      writeFile(join(directory, "invalid.json"), "{"),
      writeFile(join(directory, "independent.json"), JSON.stringify({ ...asset, id: "independent" }))
    ]);
    const snapshot = await loadSpeechMotionSnapshot(profile, (line) => diagnostics.push(line));
    await snapshot.archiveSettled;
    expect(snapshot.catalog.performances).toEqual({ independent: asset.description });
    expect(snapshot.resolve("independent", "viewers")).toEqual({ reason: "unproduced-pair" });
    expect(diagnostics.join("\n")).toContain(directory);
    expect(diagnostics.join("\n")).toContain("Duplicate speech motion id new-performance");
    expect(diagnostics.join("\n")).toContain("invalid.json");
    expect(diagnostics.join("\n")).toContain("invalid clip reference for target viewers");
    const clip = asset.clips.clip as unknown as MotionClip;
    expect(speechMotionModelIssue(clip, [{ ...parameter, max: 0.5 }], [])).toContain("insufficient range");
    expect(speechMotionModelIssue(clip, [{ ...parameter, default: 0.5 }], [])).toContain("requires default");
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});

it("rejects malformed parents and excludes all sources with colliding selection IDs before merging", async () => {
  const profile = await mkdtemp(join(tmpdir(), "speech-motion-nuances-"));
  const directory = join(profile, "speech-motions");
  await mkdir(directory);
  const invalid = {
    empty: { ...hierarchicalAsset, nuances: {} },
    unknown: { ...hierarchicalAsset, targets: { game: "clip" } },
    child: { ...hierarchicalAsset, nuances: { inspect: { ...hierarchicalAsset.nuances.inspect, extra: true } } },
    length: { ...hierarchicalAsset, nuances: { ["x".repeat(96)]: hierarchicalAsset.nuances.inspect } },
    reference: { ...hierarchicalAsset, nuances: { inspect: { description: "Own clip only", targets: { game: "toString" } } } },
    target: { ...hierarchicalAsset, nuances: { inspect: { description: "Own target only", targets: { constructor: "clip" } } } },
    invalidClip: { ...hierarchicalAsset, clips: { clip: { ...asset.clips.clip, label: "display metadata" } } },
    unused: { ...hierarchicalAsset, clips: { ...asset.clips, unused: asset.clips.clip } }
  };
  try {
    const fixtures = {
      ...Object.fromEntries(Object.entries(invalid).map(([id, value]) => [id, { ...value, id }])),
      search: hierarchicalAsset,
      "search--inspect": { ...asset, id: "search--inspect" },
      "another-parent": { ...hierarchicalAsset, id: "another-parent", nuances: {
        "inspect--more": hierarchicalAsset.nuances.compare
      } },
      "another-parent--inspect": { ...hierarchicalAsset, id: "another-parent--inspect", nuances: {
        more: hierarchicalAsset.nuances.compare
      } },
      independent: asset
    };
    await Promise.all(Object.entries(fixtures).map(([name, value]) =>
      writeFile(join(directory, name + ".json"), JSON.stringify(value))));
    const diagnostics: string[] = [];
    const snapshot = await loadSpeechMotionSnapshot(profile, (line) => diagnostics.push(line));
    await snapshot.archiveSettled;
    expect(Object.keys(snapshot.catalog.performances)).toEqual([asset.id]);
    expect(Object.keys(snapshot.catalog.definitionArchive!.definitions).sort())
      .toEqual(Object.keys(snapshot.catalog.performances).sort());
    for (const name of Object.keys(invalid)) {
      expect(diagnostics.some((line) => line.includes(join(directory, name + ".json")))).toBe(true);
    }
    for (const id of ["search--inspect", "another-parent--inspect--more"]) {
      expect(diagnostics.some((line) => line.includes(`Duplicate speech motion selection id ${id}:`))).toBe(true);
    }
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});

it("archives the loaded definition once per content and retains prior versions after source deletion", async () => {
  const profile = await mkdtemp(join(tmpdir(), "speech-motion-archive-"));
  const sourceDirectory = join(profile, "speech-motions");
  const source = join(sourceDirectory, "asset.json");
  const diagnostics: string[] = [];
  const load = () => loadSpeechMotionSnapshot(profile, (line) => diagnostics.push(line));
  try {
    await mkdir(sourceDirectory);
    await writeFile(source, JSON.stringify(asset));
    const first = await load();
    const firstArchive = first.catalog.definitionArchive!;
    const original = firstArchive.definitions[asset.id]!;
    expect(original.status).toBe("pending");
    const edited = { ...asset, description: "Edited description" };
    await writeFile(source, JSON.stringify(edited));
    const [second, equivalent] = await Promise.all([load(), load()]);
    await Promise.all([first.archiveSettled, second.archiveSettled, equivalent.archiveSettled]);
    expect(first.catalog.definitionArchive!.definitions[asset.id]).toEqual({ sha256: original.sha256, status: "saved" });
    const revision = second.catalog.definitionArchive!.definitions[asset.id]!;
    expect(revision.sha256).not.toBe(original.sha256);
    expect(equivalent.catalog.definitionArchive).toEqual(second.catalog.definitionArchive);
    await rm(source);
    const removed = await load();
    expect(removed.catalog.performances).toEqual({});
    expect((await readdir(firstArchive.directory)).sort()).toEqual([original.sha256, revision.sha256].map((sha) => sha + ".json").sort());
    for (const [digest, expected] of [[original.sha256, asset], [revision.sha256, edited]] as const) {
      const content = await readFile(join(firstArchive.directory, digest + ".json"), "utf8");
      expect(createHash("sha256").update(content).digest("hex")).toBe(digest);
      expect(JSON.parse(content)).toEqual(expected);
    }
    expect(diagnostics.filter((line) => line.includes("Speech motion archive:"))).toEqual([]);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});

it("reports an archive failure and keeps the loaded motion usable", async () => {
  const profile = await mkdtemp(join(tmpdir(), "speech-motion-archive-error-"));
  const diagnostics: string[] = [];
  try {
    await mkdir(join(profile, "speech-motions"));
    await writeFile(join(profile, "speech-motions", "asset.json"), JSON.stringify(asset));
    await writeFile(join(profile, "speech-motion-archive"), "blocked");
    const snapshot = await loadSpeechMotionSnapshot(profile, (line) => diagnostics.push(line));
    expect(snapshot.resolve(asset.id, "game")).toEqual({ clip: asset.clips.clip });
    await snapshot.archiveSettled;
    expect(snapshot.catalog.definitionArchive!.definitions[asset.id]?.status).toBe("failed");
    expect(diagnostics.find((line) => line.includes("Speech motion archive:"))).toContain(asset.id);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});

it.each(["cancel", "disconnect", "next-section"] as const)(
  "continues from the displayed pose and Stage during %s and accepts the next clip", (interruption) => {
    const state = new SpeechMotionState();
    const clip = asset.clips.clip as unknown as MotionClip;
    const base = { param_test: 0.1, param_mouth_open: 0.7 };
    const next = { ...key, sectionIndex: 1 };
    const time = 430;
    state.sampleModelParameters(0, base);
    state.apply({ ...key, op: "begin" }, 1, 0);
    state.apply({ ...key, op: "play", clip, parameters: [parameter] }, 1, 0);
    const before = state.sampleModelParameters(time, base);
    const beforeY = state.sampleStageY(time);
    const beforeScale = state.sampleStageScale(time);
    if (interruption === "cancel") state.apply({ ...key, op: "cancel" }, 1, time);
    if (interruption === "disconnect") state.disconnect(time, 1);
    state.apply({ ...next, op: "begin" }, 1, time);
    state.apply({ ...key, op: "play", clip, parameters: [parameter] }, 1, time);
    state.apply({ ...next, op: "play", clip, parameters: [parameter] }, 1, time);
    expect(state.sampleModelParameters(time, base)).toEqual(before);
    expect(state.sampleStageY(time)).toBe(beforeY);
    expect(state.sampleStageScale(time)).toBe(beforeScale);
    state.apply({ ...next, op: "end" }, 1, time + 50);
    expect(state.sampleModelParameters(time + 580, base).param_test).toBe(1);
    expect(state.sampleStageY(time + 580)).toBe(10);
    expect(state.sampleStageScale(time + 580)).toBe(0.95);
    expect(state.sampleModelParameters(time + 980, base)).toEqual(base);
    expect(state.sampleStageY(time + 980)).toBe(0);
    expect(state.sampleStageScale(time + 980)).toBe(1);
  }
);

it("bounds the Stage channels during preserve-clock entry from an interrupted clip", () => {
  const state = new SpeechMotionState();
  const next = { ...key, sectionIndex: 1 };
  const time = 500;
  state.apply({ ...key, op: "begin" }, 1, 0);
  state.apply({
    ...key, op: "play",
    clip: { entry: "lead-in", durationMs: 1000, stage: {
      scale: [[0, 0.1], [1000, 0.1]], y: [[0, 200], [1000, 200]],
      horizontal: [[0, -1]], depth: [[0, 1]]
    } }
  }, 1, 0);
  state.apply({ ...next, op: "begin" }, 1, time);
  state.apply({
    ...next, op: "play",
    clip: { entry: "preserve-clock", durationMs: 1000, stage: {
      scale: [[0, 10], [1, 0.1], [1000, 0.1]], y: [[0, -200], [1, 200], [1000, 200]],
      horizontal: [[0, 1], [1, -1]], depth: [[0, -1], [1, 1]]
    } }
  }, 1, time);
  for (const frame of [time, time + 1, time + 200, time + 400]) {
    expect(state.sampleStageScale(frame)).toBeCloseTo(0.1);
    expect(state.sampleStageY(frame)).toBe(200);
    expect(state.samplePresenceInput(frame, "horizontal", 0)).toBe(-1);
    expect(state.samplePresenceInput(frame, "depth", 0)).toBe(1);
  }
});

it.each([
  ["preserve-clock", [[0, 0.8]], 1000],
  ["preserve-clock", [[0, 0.8], [100, 0.9]], 100],
  ["lead-in", [[0, 0.8]], 1180]
] as const)("connects %s Stage keys smoothly into natural release", (entry, scale, end) => {
  const state = new SpeechMotionState();
  state.apply({ ...key, op: "begin" }, 1, 0);
  state.apply({
    ...key, op: "play", clip: { entry, durationMs: 1000, stage: { scale } }
  }, 1, 0);
  const finalValue = scale.at(-1)![1];
  expect(state.sampleStageScale(0)).toBe(1);
  expect(state.sampleStageScale(1)).toBeLessThan(1);
  if (entry === "lead-in") {
    expect(state.sampleStageScale(180)).toBe(finalValue);
    expect(state.sampleStageScale(700)).toBe(finalValue);
  }
  expect(state.sampleStageScale(end - 0.001)).toBeCloseTo(finalValue, 9);
  expect(state.sampleStageScale(end)).toBe(finalValue);
  expect(state.sampleStageScale(end + 400)).toBe(1);
});
