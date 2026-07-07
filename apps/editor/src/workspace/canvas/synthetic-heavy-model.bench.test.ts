import {
  getLive2dPerformanceStats,
  resetLive2dPerformanceStats,
  type Live2dPerformanceStats
} from "@private-2d-rigging-lab/render-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCanvasRenderProjection } from "./canvas-projection";
import { createRenderSceneFromCanvasProjection } from "./canvas-render-scene-adapter";
import {
  createSyntheticHeavyModelSession,
  SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES,
  type SyntheticHeavyModelScale
} from "./synthetic-heavy-model";

type Live2dPerformanceTestGlobal = typeof globalThis & {
  __LIVE2D_PERF__?: boolean;
};

// The heavy timing sweep is opt-in so CI does not pay the cost on every run. Enable with
// `RUN_PERF_BENCH=1` (see discussion/render-performance/measurements/baseline-synthetic.md).
const runPerfBench = readEnvFlag("RUN_PERF_BENCH");

const BENCH_SCALES: readonly { readonly label: string; readonly scale: SyntheticHeavyModelScale }[] = [
  {
    label: "light",
    scale: { drawableCount: 8, verticesPerMesh: 16, deformerChainDepth: 1, keyformSetCount: 8 }
  },
  {
    label: "medium",
    scale: { drawableCount: 40, verticesPerMesh: 64, deformerChainDepth: 3, keyformSetCount: 40 }
  },
  {
    label: "heavy",
    scale: { drawableCount: 120, verticesPerMesh: 256, deformerChainDepth: 6, keyformSetCount: 120 }
  },
  // gap-reproduction probe (Perf Wave 1.2 Required impl #3): starve per-drawable vertex work
  // (which dominates deformerVertex) while inflating rig-control count (drawableCount * chainDepth
  // = 200*8 = 1600) to see whether the deformerVertex-external spans (rigControlEval +
  // artworkBoundsAndAssembly) can overtake deformerVertex the way the real model's ~78% gap does.
  {
    label: "rigHeavy",
    scale: { drawableCount: 200, verticesPerMesh: 4, deformerChainDepth: 8, keyformSetCount: 200 }
  }
];

const BENCH_ITERATIONS = 20;

describe("synthetic heavy model generator", () => {
  it("is deterministic: identical scale parameters produce byte-identical sessions", () => {
    const scale: SyntheticHeavyModelScale = {
      drawableCount: 12,
      verticesPerMesh: 40,
      deformerChainDepth: 3,
      keyformSetCount: 12
    };

    const first = createSyntheticHeavyModelSession(scale);
    const second = createSyntheticHeavyModelSession(scale);

    expect(serializeSessionShape(second)).toEqual(serializeSessionShape(first));
  });

  it("reflects the requested scale in the generated graph", () => {
    const scale: SyntheticHeavyModelScale = {
      drawableCount: 10,
      verticesPerMesh: 25,
      deformerChainDepth: 4,
      keyformSetCount: 7
    };
    const session = createSyntheticHeavyModelSession(scale);

    expect(session.graph.drawables).toHaveLength(scale.drawableCount);
    expect(session.graph.meshes).toHaveLength(scale.drawableCount);
    expect(session.graph.keyformSets).toHaveLength(scale.keyformSetCount);
    // Each drawable owns a chain of exactly `deformerChainDepth` warp rig controls.
    expect(session.graph.rigControls).toHaveLength(
      scale.drawableCount * scale.deformerChainDepth
    );
    for (const mesh of session.graph.meshes) {
      expect(mesh.vertices.length).toBe(scale.verticesPerMesh);
    }
    // One binary entry per drawable so the render-scene adapter can materialize every drawable.
    expect(session.binaryAssets?.fileEntries).toHaveLength(scale.drawableCount);
  });

  it("produces a session whose drawables survive projection and reach the render scene", () => {
    const session = createSyntheticHeavyModelSession({
      drawableCount: 4,
      verticesPerMesh: 16,
      deformerChainDepth: 2,
      keyformSetCount: 4
    });

    const projection = createCanvasRenderProjection(session, null, {
      parameterValues: SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES
    });
    const scene = createRenderSceneFromCanvasProjection(projection);

    expect(projection.drawables).toHaveLength(4);
    // If bounds/byte sizing were wrong the adapter would drop the drawables; assert they survive.
    expect(scene.drawables.length).toBe(4);
  });

  it("does not mutate the generated session during evaluation", () => {
    const session = createSyntheticHeavyModelSession({
      drawableCount: 4,
      verticesPerMesh: 16,
      deformerChainDepth: 2,
      keyformSetCount: 4
    });
    const before = serializeSessionShape(session);

    createRenderSceneFromCanvasProjection(
      createCanvasRenderProjection(session, null, {
        parameterValues: SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES
      })
    );

    expect(serializeSessionShape(session)).toEqual(before);
  });
});

describe("evaluation caller counters", () => {
  beforeEach(() => {
    (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__ = true;
    resetLive2dPerformanceStats();
  });

  afterEach(() => {
    delete (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__;
    resetLive2dPerformanceStats();
  });

  it("records the forwarded caller tag once per evaluation and never alters the projection", () => {
    const session = createSyntheticHeavyModelSession({
      drawableCount: 4,
      verticesPerMesh: 16,
      deformerChainDepth: 2,
      keyformSetCount: 4
    });

    // Same session evaluated with vs. without the caller tag must yield an identical projection.
    const untagged = createCanvasRenderProjection(session, null, {
      parameterValues: SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES
    });
    const tagged = createCanvasRenderProjection(session, null, {
      evaluationCaller: "canvas",
      parameterValues: SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES
    });
    expect(JSON.stringify(tagged)).toEqual(JSON.stringify(untagged));

    const stats = getLive2dPerformanceStats();
    // Two evaluations ran: one untagged ("unknown") + one tagged ("canvas").
    expect(stats?.counters["canvas.evaluation.caller.canvas"]).toBe(1);
    expect(stats?.counters["canvas.evaluation.caller.unknown"]).toBe(1);
    // The caller counters sum to the whole-evaluation count (no evaluation is left untagged).
    const callerTotal = Object.entries(stats?.counters ?? {})
      .filter(([name]) => name.startsWith("canvas.evaluation.caller."))
      .reduce((sum, [, value]) => sum + value, 0);
    expect(callerTotal).toBe(stats?.timings["canvas.evaluation.ms"]?.count);
  });

  it("routes each of the three caller tags to its own counter", () => {
    const session = createSyntheticHeavyModelSession({
      drawableCount: 3,
      verticesPerMesh: 9,
      deformerChainDepth: 1,
      keyformSetCount: 3
    });

    createCanvasRenderProjection(session, null, {
      evaluationCaller: "canvas",
      parameterValues: SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES
    });
    createCanvasRenderProjection(session, null, {
      evaluationCaller: "viewerRuntime",
      parameterValues: SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES
    });
    createCanvasRenderProjection(session, null, {
      evaluationCaller: "viewerCleanStage",
      parameterValues: SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES
    });

    const stats = getLive2dPerformanceStats();
    expect(stats?.counters["canvas.evaluation.caller.canvas"]).toBe(1);
    expect(stats?.counters["canvas.evaluation.caller.viewerRuntime"]).toBe(1);
    expect(stats?.counters["canvas.evaluation.caller.viewerCleanStage"]).toBe(1);
  });
});

describe.skipIf(!runPerfBench)("synthetic heavy model phase benchmark", () => {
  beforeEach(() => {
    (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__ = true;
    resetLive2dPerformanceStats();
  });

  afterEach(() => {
    delete (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__;
    resetLive2dPerformanceStats();
  });

  for (const { label, scale } of BENCH_SCALES) {
    it(`measures phase breakdown for the ${label} scale`, () => {
      const session = createSyntheticHeavyModelSession(scale);
      resetLive2dPerformanceStats();

      for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
        const projection = createCanvasRenderProjection(session, null, {
          parameterValues: SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES
        });
        createRenderSceneFromCanvasProjection(projection);
      }

      const stats = getLive2dPerformanceStats();
      expect(stats).toBeDefined();
      reportBenchStats(label, scale, stats);

      // Sanity: the phase breakdown was actually collected for every evaluation sub-span.
      expect(stats?.timings["canvas.evaluation.ms"]?.count).toBe(BENCH_ITERATIONS);
      expect(stats?.timings["canvas.evaluation.indexBuild.ms"]?.count).toBe(BENCH_ITERATIONS);
      expect(stats?.timings["canvas.evaluation.keyform.ms"]?.count).toBe(BENCH_ITERATIONS);
      expect(stats?.timings["canvas.evaluation.rigControlEval.ms"]?.count).toBe(BENCH_ITERATIONS);
      expect(stats?.timings["canvas.evaluation.deformerVertex.ms"]?.count).toBe(BENCH_ITERATIONS);
      expect(stats?.timings["canvas.evaluation.artworkBoundsAndAssembly.ms"]?.count).toBe(
        BENCH_ITERATIONS
      );
      // Perf Wave 1.3: the three child spans that break down artworkBoundsAndAssembly must each be
      // recorded once per evaluation (rigControls + artworkBounds + rest of assembly).
      expect(stats?.timings["canvas.evaluation.assembly.rigControls.ms"]?.count).toBe(
        BENCH_ITERATIONS
      );
      expect(stats?.timings["canvas.evaluation.assembly.artworkBounds.ms"]?.count).toBe(
        BENCH_ITERATIONS
      );
      expect(stats?.timings["canvas.evaluation.assembly.rest.ms"]?.count).toBe(BENCH_ITERATIONS);
    });
  }
});

function reportBenchStats(
  label: string,
  scale: SyntheticHeavyModelScale,
  stats: Live2dPerformanceStats | undefined
): void {
  if (stats === undefined) {
    return;
  }

  // Ordered so the five evaluation sub-spans (indexBuild + keyform + rigControlEval +
  // deformerVertex + artworkBoundsAndAssembly) sit between the whole-evaluation span and the
  // downstream projection/adapter spans. Their totalMs sum is compared against the whole span to
  // derive coverage (see baseline-synthetic-v2.md). These five partition the evaluation and never
  // overlap, so only they enter the whole-evaluation coverage sum.
  const evaluationSpanKeys = [
    "canvas.evaluation.indexBuild.ms",
    "canvas.evaluation.keyform.ms",
    "canvas.evaluation.rigControlEval.ms",
    "canvas.evaluation.deformerVertex.ms",
    "canvas.evaluation.artworkBoundsAndAssembly.ms"
  ];
  // Perf Wave 1.3: three child spans nested INSIDE artworkBoundsAndAssembly. They are excluded from
  // the whole-evaluation coverage sum above (they are a sub-partition of one span already counted),
  // and are instead measured against their parent (inner coverage) below.
  const assemblyChildSpanKeys = [
    "canvas.evaluation.assembly.rigControls.ms",
    "canvas.evaluation.assembly.artworkBounds.ms",
    "canvas.evaluation.assembly.rest.ms"
  ];
  const keys = [
    "canvas.evaluation.ms",
    ...evaluationSpanKeys,
    ...assemblyChildSpanKeys,
    "canvas.projection.ms",
    "canvas.renderSceneAdapter.ms"
  ];
  const rows = keys.map((key) => {
    const timing = stats.timings[key];
    return {
      phase: key,
      count: timing?.count ?? 0,
      totalMs: round3(timing?.totalMs ?? 0),
      avgMs: round3(timing === undefined ? 0 : timing.totalMs / Math.max(1, timing.count)),
      maxMs: round3(timing?.maxMs ?? 0)
    };
  });

  const wholeTotalMs = stats.timings["canvas.evaluation.ms"]?.totalMs ?? 0;
  const breakdownTotalMs = evaluationSpanKeys.reduce(
    (sum, key) => sum + (stats.timings[key]?.totalMs ?? 0),
    0
  );
  const residualMs = wholeTotalMs - breakdownTotalMs;
  const coveragePct = wholeTotalMs <= 0 ? 0 : (breakdownTotalMs / wholeTotalMs) * 100;

  // Perf Wave 1.3: inner coverage = (three child spans) / parent artworkBoundsAndAssembly.
  const parentTotalMs = stats.timings["canvas.evaluation.artworkBoundsAndAssembly.ms"]?.totalMs ?? 0;
  const childBreakdownMs = assemblyChildSpanKeys.reduce(
    (sum, key) => sum + (stats.timings[key]?.totalMs ?? 0),
    0
  );
  const childResidualMs = parentTotalMs - childBreakdownMs;
  const innerCoveragePct = parentTotalMs <= 0 ? 0 : (childBreakdownMs / parentTotalMs) * 100;

  const callerRows = Object.entries(stats.counters)
    .filter(([counterName]) => counterName.startsWith("canvas.evaluation.caller."))
    .map(([counterName, value]) => ({ counter: counterName, count: value }));

  // eslint-disable-next-line no-console -- benchmark reporting is the purpose of this opt-in path.
  console.log(
    `\n[synthetic-heavy-bench] scale=${label} ` +
      `drawables=${scale.drawableCount} verticesPerMesh=${scale.verticesPerMesh} ` +
      `chainDepth=${scale.deformerChainDepth} keyformSets=${scale.keyformSetCount} ` +
      `rigControls=${scale.drawableCount * scale.deformerChainDepth} ` +
      `iterations=${BENCH_ITERATIONS}`
  );
  // eslint-disable-next-line no-console -- benchmark reporting is the purpose of this opt-in path.
  console.table(rows);
  // eslint-disable-next-line no-console -- benchmark reporting is the purpose of this opt-in path.
  console.log(
    `[synthetic-heavy-bench] coverage: breakdownTotalMs=${round3(breakdownTotalMs)} / ` +
      `wholeTotalMs=${round3(wholeTotalMs)} => ${round3(coveragePct)}% covered, ` +
      `residualMs=${round3(residualMs)} (${round3(100 - coveragePct)}% uncovered)`
  );
  // eslint-disable-next-line no-console -- benchmark reporting is the purpose of this opt-in path.
  console.log(
    `[synthetic-heavy-bench] assembly inner-coverage: childBreakdownMs=${round3(childBreakdownMs)} / ` +
      `artworkBoundsAndAssemblyMs=${round3(parentTotalMs)} => ${round3(innerCoveragePct)}% covered, ` +
      `childResidualMs=${round3(childResidualMs)} (${round3(100 - innerCoveragePct)}% uncovered)`
  );
  // eslint-disable-next-line no-console -- benchmark reporting is the purpose of this opt-in path.
  console.table(callerRows);
}

function serializeSessionShape(session: ReturnType<typeof createSyntheticHeavyModelSession>): string {
  return JSON.stringify(session, (_key, value) =>
    value instanceof Uint8Array ? { __bytes: Array.from(value) } : value
  );
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function readEnvFlag(name: string): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.[name];
  return value === "1" || value === "true";
}
