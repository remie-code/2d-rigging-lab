# Runtime Player Wave3 Domain A: Default Pose Evaluation Adapter Report

## Verdict

pass

## Files Changed

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-a-default-pose-evaluation-adapter-report.md`

## Adapter Contract Shape

- `createRuntimeExportRuntimeGraph(input)` is a pure Stage-local adapter.
- Input:
  - `model: RuntimeExportModelDto`
  - optional `atlas: RuntimeExportAtlasDto`
  - optional `texturePages: RuntimeExportTexturePageMetadataDto[]`
- Output:
  - `graph: NormalizedRuntimeGraph`
  - `renderResources.texturePages`
  - `renderResources.drawableRenderResources`, keyed by drawable id, preserving raw rest vertices, atlas UVs, triangles, mesh id, and texture reference
  - `renderResources.inputManifest`
- `evaluateRuntimeExportDefaultPose(input)` builds the graph, creates reset initial state, and evaluates one full snapshot for default pose.
- `createEvaluatedRuntimeExportStageRenderInput(payload)` maps the full evaluated snapshot to a `RenderScene` contract for Domain B without replacing the current Stage render call yet.

## Runtime Export Fields Consumed

- `sourcePackage.packageId`, `packageRevision`, `packageHash`
- `canvas.coordinateSystem`
- `parameters`: id, display name, semantic role, preset alias, value source, min, max, default
- `inputManifest`: preserved in adapter render resources
- `drawables`: ids, mesh refs, part id, visible, opacity, base draw order, bounds, texture refs
- `meshes`: rest vertices, materialized atlas UVs, triangles, stable ids, topology revision
- `drawOrder`
- `masks`
- `rigControls`: `rotation2d` and `warpLattice2d`
- `keyforms`: `linear-1d-v1` and `parameter-grid-2d-v1`
- `dynamicsSolver.fixedStepMs`
- `dynamicsGroups`
- `renderAssumptions.alphaMode`
- texture page / atlas page metadata for render texture identity

## runtime-core APIs Used

- `NormalizedRuntimeGraph`
- `createInitialRuntimeState`
- `evaluateRuntimeFrame`
- `defaultRuntimeEvaluationOptions`
- `RuntimeSnapshotDto` and evaluated drawable snapshot fields

Default evaluation uses:

- `authoredParameterValues: {}`
- `resetReasons: ["packageLoad"]`
- `deltaTimeMs: 0`
- `snapshotDetail: "full"`
- context `source.surface: "viewer"`
- context `policy.strictness: "interactive"`

## Tests And Commands

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: pass
- Focused test, sandboxed: failed with Vitest/esbuild `spawn EPERM`
- Focused test, elevated: `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`: pass, 1 file / 4 tests
- Runtime Player unit suite, elevated: `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test`: pass, 7 files / 34 tests
- `node scripts/check-source-organization.mjs`: pass
- `node scripts/check-dependencies.mjs`: pass
- `git diff --check -- apps/runtime-player/src/stage discussion/runtime-player/implementation/waves/wave3`: pass

## Loop 2 Test Adequacy Fix

Review finding addressed:

- Strengthened `runtime-export-default-pose-evaluation.test.ts` so the Runtime Export rig-control/deformer adapter path is directly covered.

Added/updated coverage:

- Adapter field coverage now asserts a rotation rig control with `parentId`, `childDrawableIds`, `childRigControlIds`, `opacityMultiplier`, `pivot`, `restAngleDegrees`, `restTranslation`, `restScale`, and `enabled`.
- Adapter field coverage now asserts a warp rig control with `parentId`, `childDrawableIds`, `childRigControlIds`, `opacityMultiplier`, `bindSpace`, `domainBounds`, `latticeColumns`, `latticeRows`, `restControlPoints`, `interpolationMethod`, and `enabled`.
- Added a default-pose evaluation fixture with Runtime Export rig controls and rig-control keyforms.
- The new evaluation test verifies `snapshot.keyformSamples`, `snapshot.rigControls`, rotation opacity multiplier, warp opacity multiplier, rotation-transformed vertices, and warp-deformed vertices, proving the rig controls reach `runtime-core`.

Loop 2 source changes:

- No production source changes were needed. The fix was limited to test fixture/expectation strengthening plus this report update.

## Residual Gaps / Unsupported Export Features

- Current Stage render call is not replaced in Domain A; Domain B can consume `createEvaluatedRuntimeExportStageRenderInput`.
- Runtime Export part hierarchy metadata is not invented because the DTO only carries drawable `partId`; graph `parts` remains omitted.
- Dynamics are reset/default only. No time progression, live input, or playback loop was added.
- The existing preload/main/control IPC/status path was not changed; evaluation diagnostics remain available from the returned snapshot for later surfacing.
- Multi texture page rendering is not exercised by the existing Wave2 payload contract, which currently carries one loaded raw texture page.

## Source Organization Exceptions

None.
