# Runtime Player Wave16 Domain B: Compiled Snapshot Static Templates

- Verdict recommendation: pass
- Domain: Compiled Snapshot / Static Templates
- Agent: Gnome
- Date: 2026-06-26

## Scope

Moved safe graph-derived snapshot inputs into runtime-core's compiled model while preserving current snapshot DTO compatibility and fresh per-frame output.

This domain did not implement deformer hierarchy topology compilation, Runtime Player integration, Runtime Export format changes, Editor changes, dependencies, lockfile changes, or final render-buffer/typed-array output.

## Files Changed

Domain B source/test/report changes:

- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/snapshot-static-templates.test.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md`

Pre-existing Domain A / orchestration working-tree files were not reverted:

- `packages/runtime-core/src/runtime-core.test.ts`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-a-runtime-core-compiled-api-shell-clean-review.md`

## Implementation Summary

Compiled model ownership:

- `CompiledRuntimeModel` now builds one `RuntimeSnapshotStaticTemplates` bundle at `compileRuntimeModel(graph)` time.
- Each `RuntimeModelInstance` receives the compiled template bundle and passes it through the internal compiled frame evaluator.
- Public `evaluateRuntimeFrame(...)` retains its existing call signature. It still works without compiled templates by building transient templates inside the frame path.

Snapshot static templates:

- Added a focused `snapshot-static-templates.ts` source file for compiling and materializing snapshot static inputs.
- `snapshot.ts` now materializes drawables, reference vertices, and masks from templates instead of rebuilding those structures directly from the graph in the compiled path.
- Legacy/transient snapshot evaluation uses the same materialization logic with transient per-frame templates, preserving output compatibility.

Public output compatibility:

- Snapshot DTO shape is unchanged.
- Final snapshot objects and public nested arrays are still materialized per frame.
- Compiled static templates are internal readonly/frozen structures and are not exposed as public mutable DTO arrays.

## Compiled Data Owned By Compiled Model

`RuntimeSnapshotStaticTemplates` now owns:

- Static drawable templates:
  - `drawableId`, `meshId`, optional `partId`
  - clamped static `opacity`
  - static `visible`
  - static `baseDrawOrder`
  - graph draw-order-derived initial `evaluatedDrawOrder`
  - cloned `bounds`
  - `vertexCount`
  - authored `vertexHash` when present
  - cloned base vertices when present
- Texture / UV projection templates:
  - texture status
  - texture/source asset IDs and source layer ID
  - projection kind
  - UV count and cloned UV coordinates for full-detail materialization
  - diagnostics array
- Reference/base vertex streams:
  - `ReadonlyMap<DrawableId, readonly Vec2Dto[]>` with cloned base vertices
  - used internally by rig-control evaluation and not exposed as a public snapshot array
- Mask topology templates:
  - relation ID
  - cloned source drawable IDs
  - cloned target drawable IDs
  - enabled/clipping intent/resolved status

Not compiled in Domain B:

- Deformer hierarchy/effect-chain topology, which remains Domain C.
- Parts snapshot output.
- Mesh evidence, because bounds/hash/vertices may be frame-dependent after keyforms/deformers.
- Parameter resolution, keyform sampling lookup, dynamics state, and final deformed vertices.

## Snapshot Freshness Strategy

- Compiled templates are readonly/frozen internal structures.
- `materializeRuntimeDrawableSnapshots(...)` creates fresh drawable DTO objects each frame.
- Drawable `bounds`, public `vertices`, texture diagnostics, and full-detail texture UV arrays are cloned into output DTOs.
- `materializeRuntimeMaskRelations(...)` creates fresh mask DTO objects and fresh source/target arrays each frame.
- `drawList` is still computed from the current evaluated drawables each frame, after keyform and deformer application.
- Keyform application still receives materialized drawables and can update opacity, draw order, vertices, bounds, hashes, and texture projection fallback without mutating templates.
- Previous frame snapshots are not reused or mutated by later compiled evaluations.

## Compatibility / Deep Equality Evidence

Added `packages/runtime-core/src/snapshot-static-templates.test.ts`:

- Verifies a full-detail compiled snapshot with static templates is deep-equal to legacy/transient `evaluateRuntimeFrame(...)` output with `snapshotValidation: "skip"`.
- The fixture includes texture UV projection, mask topology, base vertices, opacity keyforms, draw-order keyforms, and mesh vertex keyforms.
- Verifies consecutive compiled evaluations return distinct snapshot/drawable/nested array objects.
- Mutates a previous public snapshot's vertices, texture UVs, mask source IDs, and draw list, then confirms a later compiled frame is unaffected.

## Keyform-Driven Behavior Evidence

Added compiled-vs-legacy coverage for:

- Mesh vertices keyform: full-detail vertices, bounds, vertex count, and vertex hash change correctly.
- Drawable opacity keyform: opacity changes to the sampled value.
- Drawable draw-order keyform: drawables are ordered by evaluated draw order after keyform application.
- Static visibility/draw-list filtering remains compatible in the compiled snapshot path.

Existing focused coverage was rerun:

- `keyform-target-application.test.ts` covers direct drawable visibility patch application, opacity patch application, and draw-order patch application.
- Runtime linear keyform sampling currently supports number / Vec2 / Vec2-array patches, not boolean patches. Domain B did not broaden sampler semantics; visibility behavior remains unchanged and covered at the target-application layer.

## Profiling Phase Interpretation

`runtimeCoreSnapshotCreationDurationMs` remains the outer per-frame snapshot creation phase.

`runtimeCoreDrawableSnapshotCreationDurationMs` remains present, but its compiled-path meaning changed:

- Compiled path: measures per-frame materialization/finalization of drawable DTOs from compiled templates, plus detail stripping / mesh evidence finalization. It excludes one-time graph-derived drawable template compilation and reference vertex stream compilation.
- Legacy/transient path: still measures transient drawable/reference template compilation plus materialization because no compiled model owns the templates.
- Texture projection template construction moves out of the compiled per-frame path. Full-detail UV array cloning remains inside drawable materialization.

`runtimeCoreMaskEvaluationDurationMs` remains present:

- Compiled path: measures fresh mask DTO materialization from compiled mask topology templates.
- Legacy/transient path: measures transient mask template compilation plus materialization.

`runtimeCoreDeformerHierarchyEvaluationDurationMs`, warp/rotation transform phases, keyform phases, and visibility/draw-order phases remain semantically unchanged in Domain B.

Domain E should compare the real Browser Source report with this interpretation: a compiled Runtime Player integration should reduce `runtimeCoreDrawableSnapshotCreationDurationMs` mainly by removing per-frame graph-to-static-drawable/texture/reference/mask reconstruction, while remaining final DTO materialization cost is still expected.

## Verification

- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/texture-projection.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/keyform-target-application.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Initial sandbox run failed with Vite/esbuild `spawn EPERM`.
  - Elevated rerun initially found a test fixture ID typo (`mask_template` did not match `maskrel_*`).
  - After fixing the fixture ID, elevated rerun passed: 7 files / 27 tests.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- packages/runtime-core/src discussion/runtime-player/implementation/waves/wave16`
  - Passed with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL <new/untracked Domain B files>`
  - Checked `packages/runtime-core/src/runtime-model.ts`, `packages/runtime-core/src/snapshot-static-templates.ts`, `packages/runtime-core/src/snapshot-static-templates.test.ts`, and this report.
  - No whitespace findings; commands returned normal no-index diff status with LF-to-CRLF warnings only.

`pnpm install` was not run.

## Residual Risks / Follow-Up

- Domain B does not yet move deformer hierarchy/effect-chain topology out of the frame path. That remains Domain C and is still visible in the latest diagnostics as `runtimeCoreDeformerHierarchyEvaluationDurationMs`.
- Vertex hash generation for graph drawables with vertices but without authored `vertexHash` still depends on per-frame `hashPrecisionDecimals`; Domain B keeps that computation per frame for correctness.
- Final snapshot DTO materialization still allocates fresh public objects and arrays by design. If this remains too expensive after Domains C-D, Wave17 should consider typed/render-buffer or direct render-scene output on top of the compiled evaluator architecture.
- Runtime Player is not connected to `CompiledRuntimeModel` in Domain B. Domain D must ensure Native Stage and Browser Source own separate `RuntimeModelInstance`s.
- Runtime keyform sampling still does not support boolean visibility patches. Domain B preserved that existing behavior rather than changing keyform semantics.

## Source Organization

- Added `snapshot-static-templates.ts` as a focused responsibility file for compiling and materializing snapshot static templates.
- The static template helper remains an internal runtime-core source file and is not re-exported from `index.ts`.
- No source organization exception is requested.
