import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { parseSpeechMotionRequest, SpeechMotionState } from "../../../../apps/runtime-player/src/main/control-channel/speech-motion-state";
import { deriveStagePresenceStageMotionSettings } from "../../../../apps/runtime-player/src/main/presence/stage-presence-drive";
import { loadRuntimeExportDirectory } from "../../../../apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader";
import { RuntimePlayerStageMotionRuntime } from "../../../../apps/runtime-player/src/main/stage-motion/stage-motion-runtime";
import { runtimePlayerDefaultStageMotionSettings } from "../../../../apps/runtime-player/src/main/window-state/window-state-stage-motion-settings";
import { createEvaluatedRuntimeExportStageRenderInput } from "../../../../apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene";
import { RuntimeExportEvaluationCache } from "../../../../apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache";
import { RuntimeExportRuntimeModelInstanceCache } from "../../../../apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache";
import { renderSceneToPng } from "../../../../packages/render-software/src/render-scene-to-png";

type Track = [timeMs: number, value: number][];
const source = dirname(fileURLToPath(import.meta.url));
const out = resolve(source, "../../../../tmp/speech-motion/brief-relief-variants-v1-reproduction");
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const settings = deriveStagePresenceStageMotionSettings({ enabled: false, strength: 1 });
const baseTransform = {
  coordinateSpace: "stage-viewport-px-v1" as const,
  pan: { x: 0, y: 0 },
  zoomScale: 1
};
const owner = 0;
const key = { generation: 0, sectionIndex: 0 };
const sampleStagePan = (runtime: RuntimePlayerStageMotionRuntime, timeMs: number, offsetPx: number) =>
  runtime.update({
    baseTransform,
    settings: runtimePlayerDefaultStageMotionSettings,
    trackingFrame: null,
    inputProfile: null,
    sessionNeutral: null,
    drive: {
      settings, horizontalInput: 0, depthInput: 0, timestampMs: timeMs, stageYOffsetPx: offsetPx
    }
  }).browserSourceTransform.pan.y;

function sampleTrack(points: Track, timeMs: number) {
  for (let i = 1; i < points.length; i += 1) {
    const [end, to] = points[i];
    if (timeMs > end) continue;
    const [start, from] = points[i - 1];
    const t = Math.max(0, (timeMs - start) / (end - start));
    return from + (to - from) * t ** 3 * (t * (t * 6 - 15) + 10);
  }
  return points.at(-1)![1];
}

test("replays the saved relief pose and independent Stage Y in r804", async () => {
  const definition = readJson(resolve(source, "definition.json"));
  const provenance = readJson(resolve(source, "provenance.json"));
  const approvedPartner = readJson(resolve(source, "approved-partner-reference.json"));
  assert.equal(createHash("sha256").update(JSON.stringify(definition.variants.find((v: { id: string }) => v.id === "partner"))).digest("hex"), approvedPartner.variantSha256);
  const model = process.env.R804_MODEL ?? provenance.sourceModel;
  for (const file of provenance.files) {
    const hash = createHash("sha256").update(readFileSync(resolve(model, file.path))).digest("hex");
    assert.equal(hash, file.sha256, file.path);
  }

  const { payload } = await loadRuntimeExportDirectory(model);
  assert.equal(payload.summary.packageRevision, definition.modelRevision);
  const { view, fps, durationMs } = definition;
  const allSamples: Record<string, unknown> = {};
  let neutralPng: Buffer | undefined;
  for (const variant of definition.variants) {
  if (process.env.ONLY_VARIANT && variant.id !== process.env.ONLY_VARIANT) continue;
  const stageY = new SpeechMotionState();
  const play = parseSpeechMotionRequest({ ...key, op: "play", stageY: variant.stageY });
  assert.ok(play);
  stageY.apply({ ...key, op: "begin" }, owner, 0, {}, {});
  stageY.apply(play, owner, 0, {}, {});
  const evaluationCache = new RuntimeExportEvaluationCache();
  const runtimeModelInstanceCache = new RuntimeExportRuntimeModelInstanceCache();
  const runtime = new RuntimePlayerStageMotionRuntime();
  const folder = resolve(out, "frames", variant.id);
  mkdirSync(folder, { recursive: true });
  const deltaTimeMs = 1000 / fps;
  const samples = [];
  for (let frameIndex = 0; frameIndex < durationMs / deltaTimeMs; frameIndex += 1) {
    const timeMs = frameIndex * deltaTimeMs;
    const values = Object.fromEntries(
      Object.entries(variant.tracks as Record<string, Track>)
        .map(([name, points]) => [name, sampleTrack(points, timeMs)])
    );
    assert.ok(Math.abs(values.param_face_angle_x) <= 24);
    const { scene } = createEvaluatedRuntimeExportStageRenderInput(payload, {
      evaluationCache, runtimeModelInstanceCache, authoredParameterValues: values,
      frameIndex, deltaTimeMs, resetReasons: frameIndex ? [] : ["packageLoad"]
    });
    const panY = sampleStagePan(runtime, timeMs, stageY.sampleStageY(timeMs));
    const file = String(frameIndex).padStart(3, "0") + ".png";
    const offset = panY * view.stageViewport.height / view.outputHeight;
    const shiftedView = { ...view, stageViewport: { ...view.stageViewport, minY: view.stageViewport.minY - offset } };
    const png = renderSceneToPng(scene, shiftedView).png;
    if (frameIndex === 0) {
      assert.ok(Object.values(values).every(v => v === 0));
      if (neutralPng) assert.deepEqual(png, neutralPng);
      neutralPng = png;
    }
    if (variant.id === "partner") assert.equal(createHash("sha256").update(png).digest("hex"), approvedPartner.frames[file], `approved partner frame ${file}`);
    writeFileSync(resolve(folder, file), png);
    samples.push({ timeMs, file, panY, values });
  }
  assert.ok(samples.every(({ panY }) => Number.isFinite(panY) && panY >= 0 && panY <= 16));
  assert.equal(samples.at(-1)!.panY, 0);
  assert.equal(stageY.sampleStageY(durationMs + 1000), 0);
  allSamples[variant.id] = samples;
  }
  writeFileSync(resolve(out, "evidence.json"), JSON.stringify({ provenance, stagePresenceEnabled: false, samples: allSamples }, null, 2) + "\n");
}, 480_000);
