# Wave89 Domain B Spec Compliance Review

## Verdict

Verdict: `pass`

Blocking findings were not found for Domain B `wave89-viewer-atlas-runtime-scope-original-perf-guard`.

The reviewed Viewer implementation keeps `Original` on the unchanged authoring/original projection, limits `Atlas Runtime` rendering and placement requirements to atlas packable runtime-bound drawables, preserves missing/stale artifact guards for the requested `Atlas Runtime` path, and avoids target selection/source-signature work for `Original` projections.

## Basis Read

- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/reviews/wave88/wave88-final-clean-integration-review.md`

## Scope Reviewed

- Primary Domain B diff:
  - `apps/editor/src/workspace/viewer/viewer-render-source.ts`
  - `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- Relevant callers/tests:
  - `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- Shared atlas/runtime target oracle inspected for semantics:
  - `packages/authoring-core/src/texture-atlas-targets.ts`
  - `packages/authoring-core/src/texture-atlas-source-signature.ts`
  - `packages/authoring-core/src/texture-atlas-packing.ts`
  - `packages/authoring-core/src/texture-atlas-mutations.ts`

Concurrent Domain A changes are present in atlas/authoring/operation files. I inspected them only where needed to understand the current target-selection oracle and forbidden-scope boundaries.

## Findings

| Severity | Finding | Evidence | Required action |
|---|---|---|---|
| none | No blocking spec-compliance findings. | `apps/editor/src/workspace/viewer/viewer-render-source.ts:140` gates full atlas runtime validation to requested `atlasRuntime`; `apps/editor/src/workspace/viewer/viewer-render-source.ts:190` uses `selectTextureAtlasTargets()` only on that path; `apps/editor/src/workspace/viewer/viewer-render-source.ts:376` filters projection drawables by `runtimeDrawableIds`; focused tests passed. | None. |

## Spec Compliance Assessment

### Viewer `Atlas Runtime` renders only runtime graph / rig-bound drawables

Pass.

`resolveViewerAtlasRuntimeSource()` computes the current atlas target selection and builds `runtimeDrawableIds` only from `currentTargetSelection.packableTargets` (`apps/editor/src/workspace/viewer/viewer-render-source.ts:190`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:209`). `remapProjectionToAtlasRuntime()` then filters projection drawables, selected ids, mask relations, mesh overlays, and deformer child drawable ids against that runtime set (`apps/editor/src/workspace/viewer/viewer-render-source.ts:376`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:382`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:392`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:407`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:415`).

The shared atlas oracle treats drawables not bound through rig controls as Drawable Pool exclusions (`packages/authoring-core/src/texture-atlas-targets.ts:105`, `packages/authoring-core/src/texture-atlas-targets.ts:145`).

### Drawable Pool / unbound drawables do not render in `Atlas Runtime` and do not disable it

Pass.

The prior broad missing-placement scan over every renderable original-projection drawable is removed from the Domain B diff. Current placement checks iterate only `currentTargetSelection.packableTargets` (`apps/editor/src/workspace/viewer/viewer-render-source.ts:210`). The projection remap filters out drawables not in `runtimeDrawableIds` (`apps/editor/src/workspace/viewer/viewer-render-source.ts:376`).

Regression coverage creates an unbound Drawable Pool drawable outside the rig control's `childDrawableIds` (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:393`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:405`) and asserts `Atlas Runtime` remains available while omitting that drawable (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:122`).

### Viewer `Original` remains current authoring/original behavior and may include unbound drawables

Pass.

For non-Atlas requested mode, `createViewerRenderSourceProjection()` returns the original projection directly (`apps/editor/src/workspace/viewer/viewer-render-source.ts:165`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:171`). The clean stage still creates the Canvas projection first and passes it through as the original projection (`apps/editor/src/workspace/viewer/viewer-clean-stage.ts:57`, `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:64`).

Tests assert Original mode keeps the unbound Drawable Pool drawable using original texture refs, dimensions, and unit UVs after atlas commit (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:72`).

### Runtime placement checks apply only to runtime graph drawables that should render from the atlas

Pass.

The placement requirement is scoped to `currentTargetSelection.packableTargets` (`apps/editor/src/workspace/viewer/viewer-render-source.ts:210`). This aligns with the Texture Atlas target oracle, which excludes unbound Drawable Pool drawables and only creates packable targets for bound drawables without atlas target warnings (`packages/authoring-core/src/texture-atlas-targets.ts:105`, `packages/authoring-core/src/texture-atlas-targets.ts:130`).

### Runtime-bound missing placement still disables `Atlas Runtime`

Pass.

If a current packable runtime-bound target lacks a placement, `resolveViewerAtlasRuntimeSource()` returns `missingPlacement` (`apps/editor/src/workspace/viewer/viewer-render-source.ts:212`). The focused negative test removes the bound sleeve placement and verifies fallback to Original with `missingPlacement` (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:315`).

### Missing/stale atlas artifact behavior is not improperly removed

Pass.

Static artifact guards remain for missing layout/page/texture/binary ref/bytes, invalid dimensions/byte length, missing source signature, and invalid placements (`apps/editor/src/workspace/viewer/viewer-render-source.ts:245`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:250`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:255`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:267`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:275`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:284`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:300`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:313`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:321`).

When `Atlas Runtime` is requested, the current target selection and source signature are recomputed and stale artifacts still return `staleSourceSignature` (`apps/editor/src/workspace/viewer/viewer-render-source.ts:190`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:197`). Tests cover missing layout and stale source inputs (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:189`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:205`).

### Viewer `Original` mode performance guard

Pass.

`createViewerRenderSourceProjection()` only runs target selection/source-signature recomputation when `requestedMode === "atlasRuntime"` (`apps/editor/src/workspace/viewer/viewer-render-source.ts:140`). The Original path performs only static artifact checks (`apps/editor/src/workspace/viewer/viewer-render-source.ts:165`) and returns the original projection. The focused hook-based test proves Original mode does not call target selection, source-signature creation, or signature comparison (`apps/editor/src/workspace/viewer/viewer-render-source.test.ts:159`).

## Forbidden Scope Assessment

Pass.

- Domain B source diff is scoped to `apps/editor/src/workspace/viewer/viewer-render-source.ts` and `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`.
- `viewer-clean-stage.ts`, `viewer-runtime-screen.test.ts`, and `runtime-controls-state.test.ts` had no diff.
- No dependency manifest/lockfile diff was present.
- Targeted forbidden-scope search over the reviewed Viewer files found no implementation of Workspace Directory Export, File System Access, workerization, Canvas atlas mode, manual atlas editing, multi-page atlas, camera capture, screenshot/export workflow, Cubism `.moc3` / `.model3.json` / `.physics3.json` compatibility, mesh/deformer/dynamics/import changes, or new dependencies.
- Current `git diff --name-only` includes concurrent Domain A files in atlas/authoring/operation areas; those were not treated as Domain B changes for this lane.

## Remaining Risks

- Original mode now reports availability from static artifact checks only. A stale source signature or runtime-bound missing placement may not disable the `Atlas Runtime` button until the user requests `Atlas Runtime`; at that point the requested Atlas Runtime path still falls back deterministically with `staleSourceSignature` or `missingPlacement`. This is an accepted performance tradeoff for Wave89, not a blocker.
- Coverage is projection/unit-level. No browser pixel proof was added for Original versus Atlas Runtime rendering parity; Wave89 explicitly lists browser pixel proof as out of scope.
- Runtime-scope correctness depends on the shared `selectTextureAtlasTargets()` oracle, which currently models runtime membership through rig-control-bound drawables. If future runtime graph semantics broaden beyond that oracle, the shared atlas target helper should be updated rather than adding Viewer-local target logic.

## Verification Performed

- Read all requested basis documents and directly inspected source/tests listed above.
- Ran `git diff -- apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts`.
- Ran focused Viewer tests:
  - sandbox command failed with known Vite/esbuild `spawn EPERM`;
  - escalated rerun passed: `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - result: 3 test files passed, 40 tests passed.
- Ran `git diff --check -- apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts`; exit 0 with CRLF working-copy warnings only.
- Checked dependency manifests/lockfile diff for reviewed scope; no dependency diff.
- Ran targeted forbidden-scope search over reviewed Viewer files; no forbidden implementation terms matched.

