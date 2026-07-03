import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import type {
  InspectEvaluatedGeometryResult,
  RenderViewResult
} from "@private-2d-rigging-lab/ai-interface";
import { RenderViewResultSchema } from "@private-2d-rigging-lab/ai-interface";

import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
import { resolveTextureDimensionSources } from "./perception/texture-resolution.js";
import { runAuthoringHostCommand } from "./run-authoring-host-command.js";

/**
 * Wave104 Domain C — ref/ end-to-end smoke (§3.5).
 *
 * Loads the delivered, rights-cleared `ref/` model READ-ONLY through the same
 * CLI entry point (`runAuthoringHostCommand`) that Domain A/B established, then
 * exercises the real validate + measurement + render read paths against it.
 *
 * Outputs — the ladder-top USER VISUAL GATE artifacts — are written to
 * `discussion/model-authoring/experiments/ref-render-gate/` (OUTSIDE `ref/`):
 *  - `ref-rest-full.png` (+ sidecar): rest pose, whole model framing.
 *  - `ref-face-focus.png` (+ sidecar): rest pose, drawableFocus on the face.
 *  - `ref-eyes-viewport.png` (+ sidecar): rest pose, explicit stage viewport
 *    over the eye region.
 *  - `ref-measurement-gate.json`: evaluated bbox measurements.
 *
 * ref/ per-layer textures carry no declared `dimensions`; rendering uses the
 * §3.4 revised (2026-07-03) `derived-verified` ladder rung — dimensions derived
 * from each drawable's rest mesh bounds and adopted only under the exact
 * `byteLength === width*height*4` check. The sidecars record the source kind
 * per texture so the derivation is never silent.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/authoring-host/src -> repo root
const REPO_ROOT = join(HERE, "..", "..", "..");
const REF_DIR = join(REPO_ROOT, "ref");
const REF_GATE_DIR = join(
  REPO_ROOT,
  "discussion",
  "model-authoring",
  "experiments",
  "ref-render-gate"
);

// Representative, currently-visible drawables discovered from the evaluated ref
// snapshot. `face` contains both eye drawables (verified by containment below),
// so these give a meaningful spatial relation to assert.
const FACE_DRAWABLE_ID = "draw_r0_1cea4f6f_5c3cada6_face";
const IRIDES_L_DRAWABLE_ID = "draw_r0_1cea4f6f_3a8f7081_irides-l";
const EYEWHITE_R_DRAWABLE_ID = "draw_r0_1cea4f6f_3a8f7005_eyewhite-r";

// Explicit stage viewport covering both eyes at rest (from the measured eye
// drawable bounds: eyes span roughly x[885,1110], y[411,475]).
const EYE_REGION_VIEWPORT = { minX: 860, minY: 385, width: 270, height: 115 };

const createdTempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdTempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix));
  createdTempRoots.push(root);
  return root;
};

const makeStateDir = async (): Promise<string> =>
  join(await makeTempRoot("ref-e2e-state-"), "state");

const readCommand = (command: string, payload: object) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: `cmd_ref_${command}`,
  session: { agentId: "agent_ref_e2e", capabilities: ["read", "validate"] },
  basis: { relatedAC: [], relatedScenarios: [] },
  command,
  payload
});

const renderCommand = (commandId: string, payload: object) => ({
  schemaVersion: "ai-command-request-v1",
  commandId,
  session: { agentId: "agent_ref_e2e", capabilities: ["render"] },
  basis: { relatedAC: [], relatedScenarios: [] },
  command: "renderView",
  payload
});

const runRefRender = async (payload: object): Promise<RenderViewResult> => {
  const stateDirectory = await makeStateDir();
  const response = await runAuthoringHostCommand({
    packageDirectory: REF_DIR,
    stateDirectory,
    command: renderCommand("cmd_ref_renderView", payload)
  });
  expect(response.aiCommandStatus).toBe("ok");
  return RenderViewResultSchema.parse(response.aiCommandResponse?.payload);
};

const rectContains = (
  outer: { x: number; y: number; width: number; height: number },
  inner: { x: number; y: number; width: number; height: number }
): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

// The Ware Variant Group (singleSelect) from ref/model/variants.json, read at
// runtime so the gate assertions are derived from the package data — not
// transcribed. The group targets 15 outfit drawables; which ones pass depends on
// the active variant's membership.
interface RefVariantGroup {
  readonly variantGroupId: string;
  readonly mode: string;
  readonly targetDrawableIds: readonly string[];
  readonly memberships: readonly {
    readonly drawableId: string;
    readonly variantIds: readonly string[];
  }[];
  readonly variants: readonly { readonly variantId: string }[];
  readonly defaultActive: { readonly kind: string; readonly variantId?: string };
}

const readRefWareGroup = async (): Promise<RefVariantGroup> => {
  const text = await readFile(join(REF_DIR, "model", "variants.json"), "utf8");
  const file = JSON.parse(text) as { readonly variantGroups: readonly RefVariantGroup[] };
  const group = file.variantGroups.find((candidate) => candidate.variantGroupId === "vgrp_expression");
  if (group === undefined) {
    throw new Error("ref variants.json is missing the vgrp_expression group");
  }
  return group;
};

// The set of target drawables a given variantId passes: membership.variantIds
// contains that variantId. Derived purely from the group data (the same rule the
// pure predicate applies), so the e2e assertion has an INDEPENDENT expectation to
// compare the evaluated snapshot against.
const targetsPassingVariant = (group: RefVariantGroup, variantId: string): Set<string> =>
  new Set(
    group.memberships
      .filter((membership) => membership.variantIds.includes(variantId))
      .map((membership) => membership.drawableId)
  );

const inspectRefGeometry = async (
  targets: readonly { readonly kind: "drawable"; readonly drawableId: string }[],
  variantSelections?: readonly object[]
): Promise<InspectEvaluatedGeometryResult> => {
  const stateDirectory = await makeStateDir();
  const response = await runAuthoringHostCommand({
    packageDirectory: REF_DIR,
    stateDirectory,
    command: readCommand("inspectEvaluatedGeometry", {
      targets,
      includeVertices: false,
      ...(variantSelections === undefined ? {} : { variantSelections })
    })
  });
  expect(response.aiCommandStatus).toBe("ok");
  return response.aiCommandResponse?.payload as InspectEvaluatedGeometryResult;
};

// Which of the group's 15 target drawables the gated snapshot reports visible,
// measured through inspectEvaluatedGeometry (the SAME gated snapshot the render
// consumes). Returns the drawableIds whose measurement flag is visible=true.
const measureVisibleTargets = async (
  group: RefVariantGroup,
  variantSelections?: readonly object[]
): Promise<Set<string>> => {
  const targets = group.targetDrawableIds.map((drawableId) => ({
    kind: "drawable" as const,
    drawableId
  }));
  const result = await inspectRefGeometry(targets, variantSelections);
  const visible = new Set<string>();
  for (const entry of result.results) {
    if (entry.kind !== "drawable") {
      continue;
    }
    expect(entry.found).toBe(true);
    if (entry.visible === true) {
      visible.add(entry.drawableId);
    }
  }
  return visible;
};

describe("ref e2e smoke (read-only)", () => {
  it("loads ref and runs validatePackage (report returned; diagnostics recorded, not gated)", async () => {
    const stateDirectory = await makeStateDir();
    const start = performance.now();

    const response = await runAuthoringHostCommand({
      packageDirectory: REF_DIR,
      stateDirectory,
      command: readCommand("validatePackage", { profile: "strict" })
    });

    const durationMs = performance.now() - start;
    // eslint-disable-next-line no-console
    console.log(`REF_E2E validatePackage duration ${durationMs.toFixed(1)}ms`);

    expect(response.aiCommandStatus).toBe("ok");
    expect(response.command).toBe("validatePackage");
    const payload = response.aiCommandResponse?.payload as
      | { readonly report: { readonly summary: { readonly counts: Record<string, number> } } }
      | undefined;
    expect(payload?.report).toBeDefined();
    // The report exists; its diagnostic content is recorded, not a fail condition (§3.5).
    // eslint-disable-next-line no-console
    console.log(
      "REF_E2E validate counts",
      JSON.stringify(payload?.report.summary.counts ?? {})
    );
  }, 120_000);

  it("resolves derived-verified dimensions for every per-layer texture ref drawables use (§3.4 revised)", async () => {
    const loaded = await loadAuthoringPackageDirectory(REF_DIR);
    const usedTextureIds = [
      ...new Set(loaded.session.graph.drawables.map((drawable) => drawable.textureId))
    ];
    expect(usedTextureIds).toHaveLength(126);

    // The strict ladder: every candidate must satisfy byteLength === w*h*4
    // exactly, or resolution throws. A full pass therefore PROVES the exact
    // byteLength match for all 126 per-layer textures.
    const records = resolveTextureDimensionSources({
      session: loaded.session,
      textureIds: usedTextureIds
    });

    expect(records).toHaveLength(126);
    expect(records.every((record) => record.dimensionSource === "derived-verified")).toBe(
      true
    );
    expect(
      records.every(
        (record) =>
          Number.isInteger(record.width) &&
          Number.isInteger(record.height) &&
          record.width > 0 &&
          record.height > 0
      )
    ).toBe(true);
  }, 120_000);

  it("renders the user visual gate PNGs (rest full + face focus + eye viewport) deterministically", async () => {
    await mkdir(REF_GATE_DIR, { recursive: true });
    const start = performance.now();

    // 1. Rest pose, whole-model framing (view omitted → model bounds).
    const restFull = await runRefRender({
      outDir: REF_GATE_DIR,
      outputName: "ref-rest-full"
    });

    // 2. Face focus (drawableFocus, default 10% margin).
    const faceFocus = await runRefRender({
      view: { kind: "drawableFocus", drawableId: FACE_DRAWABLE_ID },
      outDir: REF_GATE_DIR,
      outputName: "ref-face-focus"
    });

    // 3. Eye region via explicit stage viewport.
    const eyesViewport = await runRefRender({
      view: { kind: "stageViewport", stageViewport: EYE_REGION_VIEWPORT },
      outDir: REF_GATE_DIR,
      outputName: "ref-eyes-viewport"
    });

    const renderDurationMs = performance.now() - start;
    // eslint-disable-next-line no-console
    console.log(`REF_E2E renderView x3 duration ${renderDurationMs.toFixed(1)}ms`);

    for (const result of [restFull, faceFocus, eyesViewport]) {
      const pngBytes = await readFile(result.pngPath);
      expect(pngBytes.byteLength).toBeGreaterThan(0);
      // Stale-image guard: the sidecar revision matches the loaded package.
      expect(result.sidecar.packageRevision).toBe(result.packageRevision);
      // §3.4 revised: the derivation is announced, never silent — every texture
      // the render used is recorded as derived-verified (ref has no declared
      // per-layer dimensions).
      const sources = result.sidecar.textureDimensionSources;
      expect(sources).toBeDefined();
      expect(sources).toHaveLength(126);
      expect(sources!.every((entry) => entry.dimensionSource === "derived-verified")).toBe(
        true
      );
    }

    // Determinism: the identical request rendered into a fresh directory is
    // byte-identical to the gate PNG.
    const rerunDir = await makeTempRoot("ref-e2e-rerun-");
    const rerun = await runRefRender({
      outDir: rerunDir,
      outputName: "ref-rest-full"
    });
    const firstBytes = await readFile(restFull.pngPath);
    const rerunBytes = await readFile(rerun.pngPath);
    expect(rerunBytes.equals(firstBytes)).toBe(true);
  }, 300_000);

  it("measures evaluated geometry deterministically with sound containment, and writes the gate artifact", async () => {
    const stateDirectory = await makeStateDir();

    const targets = [
      { kind: "drawable", drawableId: FACE_DRAWABLE_ID },
      { kind: "drawable", drawableId: IRIDES_L_DRAWABLE_ID },
      { kind: "drawable", drawableId: EYEWHITE_R_DRAWABLE_ID }
    ];

    const start = performance.now();
    const first = await runAuthoringHostCommand({
      packageDirectory: REF_DIR,
      stateDirectory,
      command: readCommand("inspectEvaluatedGeometry", {
        targets,
        includeVertices: false
      })
    });
    const durationMs = performance.now() - start;
    // eslint-disable-next-line no-console
    console.log(`REF_E2E inspectEvaluatedGeometry duration ${durationMs.toFixed(1)}ms`);

    expect(first.aiCommandStatus).toBe("ok");
    const result = first.aiCommandResponse?.payload as InspectEvaluatedGeometryResult;
    expect(result.schemaVersion).toBe("inspect-evaluated-geometry-result-v1");
    expect(result.results).toHaveLength(3);

    const boundsById = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const entry of result.results) {
      if (entry.kind !== "drawable") {
        throw new Error("expected drawable result");
      }
      expect(entry.found).toBe(true);
      const bounds = entry.bounds;
      if (bounds === undefined) {
        throw new Error(`missing bounds for ${entry.drawableId}`);
      }
      for (const value of [bounds.x, bounds.y, bounds.width, bounds.height]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
      boundsById.set(entry.drawableId, bounds);
    }

    const faceBounds = boundsById.get(FACE_DRAWABLE_ID)!;
    const iridesBounds = boundsById.get(IRIDES_L_DRAWABLE_ID)!;
    const eyewhiteBounds = boundsById.get(EYEWHITE_R_DRAWABLE_ID)!;
    // Sound spatial relation: both eye drawables sit inside the face bbox.
    expect(rectContains(faceBounds, iridesBounds)).toBe(true);
    expect(rectContains(faceBounds, eyewhiteBounds)).toBe(true);

    // Determinism: an identical request yields identical numbers.
    const stateDirectory2 = await makeStateDir();
    const second = await runAuthoringHostCommand({
      packageDirectory: REF_DIR,
      stateDirectory: stateDirectory2,
      command: readCommand("inspectEvaluatedGeometry", {
        targets,
        includeVertices: false
      })
    });
    const secondResult = second.aiCommandResponse?.payload as InspectEvaluatedGeometryResult;
    expect(secondResult.results).toEqual(result.results);

    // Write the measurement gate artifact OUTSIDE ref/ (companion to the PNGs).
    await mkdir(REF_GATE_DIR, { recursive: true });
    await writeFile(
      join(REF_GATE_DIR, "ref-measurement-gate.json"),
      `${JSON.stringify(
        {
          schemaVersion: "ref-measurement-gate-v1",
          packageRevision: result.packageRevision,
          note:
            "Evaluated geometry measured against ref/ (read-only) via inspectEvaluatedGeometry. Stage-space rest-pose bounding boxes; see README.md.",
          measurements: result.results
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }, 120_000);

  it("gates the Ware group to the Default outfit at the snapshot level (6 pass / 9 blocked, derived from the package)", async () => {
    const group = await readRefWareGroup();
    // Sanity: the survey's 15 targets and 3 variants, as data.
    expect(group.mode).toBe("singleSelect");
    expect(group.targetDrawableIds).toHaveLength(15);
    expect(group.defaultActive.variantId).toBe("var_expression_default");

    // INDEPENDENT expectation: derive from the group memberships which targets
    // the Default variant should pass. This is computed from the package data,
    // not transcribed from the prompt.
    const expectedDefaultPass = targetsPassingVariant(group, "var_expression_default");
    const expectedDefaultBlocked = group.targetDrawableIds.filter(
      (drawableId) => !expectedDefaultPass.has(drawableId)
    );
    // Guard against a vacuous assertion: the survey's headline numbers.
    expect(expectedDefaultPass.size).toBe(6);
    expect(expectedDefaultBlocked).toHaveLength(9);

    // OBSERVED: what the gated snapshot actually reports visible (measured
    // through the same gated snapshot renderView consumes). Default selection is
    // used when variantSelections is omitted.
    const observedVisible = await measureVisibleTargets(group);

    // The gated snapshot's visible set equals the membership-derived Default set,
    // and every non-member target is blocked.
    expect([...observedVisible].sort()).toEqual([...expectedDefaultPass].sort());
    for (const blockedDrawableId of expectedDefaultBlocked) {
      expect(observedVisible.has(blockedDrawableId)).toBe(false);
    }
  }, 120_000);

  it("changes the passing set when the Rodos variant is selected (override)", async () => {
    const group = await readRefWareGroup();

    const expectedRodosPass = targetsPassingVariant(group, "var_rodos");
    expect(expectedRodosPass.size).toBeGreaterThan(0);

    const observedRodosVisible = await measureVisibleTargets(group, [
      { kind: "singleSelect", variantGroupId: "vgrp_expression", variantId: "var_rodos" }
    ]);

    // Rodos passes its own members exactly...
    expect([...observedRodosVisible].sort()).toEqual([...expectedRodosPass].sort());

    // ...and the passing set genuinely differs from Default (proof the override
    // reshaped the visibility world, not just re-rendered the same outfit).
    const defaultVisible = await measureVisibleTargets(group);
    expect([...observedRodosVisible].sort()).not.toEqual([...defaultVisible].sort());

    // The measurement result echoes the resolved outfit so the reader can prove
    // which selection produced these numbers.
    const oneTarget = [
      { kind: "drawable" as const, drawableId: group.targetDrawableIds[0]! }
    ];
    const rodosResult = await inspectRefGeometry(oneTarget, [
      { kind: "singleSelect", variantGroupId: "vgrp_expression", variantId: "var_rodos" }
    ]);
    expect(rodosResult.variantSelections).toEqual([
      { kind: "singleSelect", variantGroupId: "vgrp_expression", variantId: "var_rodos" }
    ]);
  }, 120_000);

  it("rejects an unknown variant reference deterministically (does not silently fall back to default)", async () => {
    const stateDirectory = await makeStateDir();
    await expect(
      runAuthoringHostCommand({
        packageDirectory: REF_DIR,
        stateDirectory,
        command: readCommand("inspectEvaluatedGeometry", {
          targets: [{ kind: "drawable", drawableId: "draw_r0_1cea4f6f_ea30e9c4_tie" }],
          includeVertices: false,
          variantSelections: [
            {
              kind: "singleSelect",
              variantGroupId: "vgrp_expression",
              variantId: "var_does_not_exist"
            }
          ]
        })
      })
    ).rejects.toThrow();
  }, 120_000);
});
