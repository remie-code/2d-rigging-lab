# Wave89 Domain B Report: Viewer Atlas Runtime Scope + Original Perf Guard

## Verdict

Verdict: `pass`.

Domain B `wave89-viewer-atlas-runtime-scope-original-perf-guard` is safe for final integration.

The implementation limits Viewer `Atlas Runtime` rendering and placement requirements to runtime graph / atlas-packable drawables, omits unbound Drawable Pool drawables from the Atlas Runtime projection, keeps `Original` on the current authoring/original projection including unbound drawables, and avoids target-selection/source-signature work on `Original` projections.

## Basis Coverage Self-Report

Gnome reported reading all assigned Domain B basis documents:

- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/reviews/wave88/wave88-final-clean-integration-review.md`

Deferred basis items: none.

Orch-Sylph independently read the orchestration/context-hygiene skills, Wave89 plan/map, Domain B design/policy/baseline docs, and the implemented source/test diffs before accepting review results.

## Current-State Confirmation

Before implementation, Domain B confirmed:

- `apps/editor/src/workspace/viewer/viewer-render-source.ts` resolved full Atlas Runtime availability even when requested mode was `Original`.
- That path performed `selectTextureAtlasTargets()` and `createTextureAtlasSourceSignature()` during Original projections.
- The previous missing-placement check scanned every renderable drawable in the original projection, so an unbound Drawable Pool drawable could disable `Atlas Runtime`.
- `selectTextureAtlasTargets()` already exposes the runtime-bound atlas target oracle through `packableTargets` and `boundDrawableIds`, with unbound drawables classified as Drawable Pool exclusions.

## Implementation Summary

Changed files:

- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`

Behavior implemented:

- `Original` requested mode returns the original projection and avoids target selection, source-signature creation, and source-signature comparison.
- `Original` still performs only static atlas artifact checks for the Runtime Controls availability state.
- `Atlas Runtime` requested mode still performs full target/source-signature validation.
- Runtime placement checks are scoped to `selectTextureAtlasTargets().packableTargets`.
- Atlas Runtime projection filters drawables, selected drawable ids, mask relations, mesh overlays, and deformer child drawable ids to runtime drawable ids.
- Runtime-bound missing placement still returns deterministic `missingPlacement` and falls back to `Original`.
- The implementation does not mutate `session.graph`, authoring `Drawable.textureId`, authoring mesh UVs, or mesh topology.

## Performance Bottleneck Trace

Resolved Domain B bottleneck:

- Previous Original projections entered full Atlas Runtime validation and recomputed atlas target selection/source signature.
- Current Original projections do not call the heavy target/source-signature hooks.
- Focused test coverage injects throwing spies for `selectTextureAtlasTargets`, `createTextureAtlasSourceSignature`, and `sameTextureAtlasSourceSignature`, then requests Original mode and verifies none are called.

Remaining intentional behavior:

- `Atlas Runtime` requested mode still recomputes target/source-signature state to detect stale artifacts and invalid placements.
- Original mode reports static atlas availability only; stale source detection occurs when Atlas Runtime is requested.

## Stale Preview Trace

Domain B did not own Texture Atlas Task stale preview behavior. No Atlas Task files were modified by Domain B.

Viewer stale artifact behavior remains:

- `Atlas Runtime` requested mode still detects stale source signatures and falls back to `Original`.
- Existing missing-layout and stale-source tests remain present and passing.

## Apply Computation Trace

Domain B did not modify Apply Atlas, Operation Core, authoring-core atlas mutation semantics, or generated atlas bytes. Concurrent Domain A changes exist in atlas/authoring/operation areas and are outside this Domain B report.

## Viewer Runtime Scope Trace

Runtime scope now follows the same atlas target oracle used by Texture Atlas selection:

- Unbound Drawable Pool drawables are excluded from `selectTextureAtlasTargets().packableTargets`.
- Atlas Runtime builds its runtime drawable set from those packable runtime targets.
- Projection remapping omits drawables outside that runtime set.
- Missing placement is required only for current packable runtime targets.

Focused tests cover:

- Original mode still renders an unbound Drawable Pool drawable after atlas commit.
- Atlas Runtime remains available when an unbound Drawable Pool drawable has no placement.
- Atlas Runtime projection omits the unbound Drawable Pool drawable.
- A runtime-bound drawable with missing placement still disables Atlas Runtime.

## Review Results

Independent Review-Sylph lanes all passed:

- `discussion/implementation/reviews/wave89/wave89-domain-b-spec-compliance-review.md`: `pass`.
- `discussion/implementation/reviews/wave89/wave89-domain-b-design-development-review.md`: `pass`.
- `discussion/implementation/reviews/wave89/wave89-domain-b-test-adequacy-review.md`: `pass`.

No fix loop was required.

## Verification

Commands run by Orch-Sylph:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - sandbox result: failed with known Vite/esbuild `spawn EPERM`.
  - escalated rerun result: passed, 3 files / 40 tests.
- `pnpm.cmd typecheck`
  - passed.
- `node scripts/check-source-organization.mjs`
  - passed.
- `node scripts/check-dependencies.mjs`
  - passed.
- `git diff --check -- apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - exit 0; CRLF working-copy warnings only.

Gnome and all three Review-Sylph lanes reported the same focused Viewer Vitest result: sandbox `spawn EPERM`, escalated rerun pass, 3 files / 40 tests.

## Must-Not Compliance Evidence

Domain B did not:

- run `pnpm install`;
- add dependencies;
- modify package dependency files;
- modify `apps/editor/src/workspace/atlas/**`;
- modify `packages/operation-core/src/operations/apply-texture-atlas-preview*.ts`;
- introduce Canvas atlas mode;
- introduce workspace export, workerization, manual atlas editing, multi-page atlas, camera capture, or screenshot/export workflow;
- change mesh generation, deformer, keyform, dynamics, import, renderer/shader, or unrelated UI behavior.

## Residual Risks

- Original mode intentionally uses static atlas availability only. Stale source-signature and runtime-bound missing-placement validation happens when Atlas Runtime is requested, not continuously while Original is selected.
- Evidence is projection/unit-level; no browser pixel proof was added. Wave89 lists browser pixel proof as out of scope.
- Runtime-scope correctness depends on the shared `selectTextureAtlasTargets()` runtime-bound oracle. If future runtime graph semantics broaden beyond rig-bound drawables, the shared oracle should be updated rather than adding Viewer-local target logic.
- Concurrent Domain A changes were present in atlas/authoring/operation files and were not reviewed for Domain B correctness.

## User-Decision Points

None for Domain B.

## Final Integration Readiness

Domain B is safe for Wave89 final integration.

