# Wave89 Domain B Test Adequacy Review

## Verdict

Verdict: `pass`.

No blocking test adequacy gaps found for Wave89 / Domain B `wave89-viewer-atlas-runtime-scope-original-perf-guard`.

## Basis Read

- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/reviews/wave88/wave88-final-clean-integration-review.md`

## Scope Reviewed

- Domain B diff: `git diff -- apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- Narrow reference only: `packages/authoring-core/src/texture-atlas-targets.ts` to confirm that the fixture's unbound drawable is excluded because it is not in the rig-bound drawable set. No Domain A adequacy review was performed.

## Findings

| Severity | Finding | Evidence | Required action |
|---|---|---|---|
| none | Required Domain B test coverage is present and focused. | `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:72`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:122`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:159`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:315` cover the new Wave89 behaviors directly. | None. |
| none | Runtime Controls tests do not need Domain B changes. Existing tests still cover mode-control placement, disabled reason display, and Viewer fallback. | `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:325`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:288`; `git diff -- apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` had no diff. | None. |

## Coverage Matrix

| Required evidence | Coverage assessment | Evidence |
|---|---|---|
| Unbound Drawable Pool does not disable Atlas Runtime after Apply. | Covered. The fixture applies a real atlas preview, leaves `DRAW_POOL` outside the rig-bound set, requests `Atlas Runtime`, and expects availability. | Fixture apply: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:333`. Rig-bound fixture excludes pool: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:405`. Test: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:122`. Source checks placements only for selected packable runtime targets: `apps/editor/src/workspace/viewer/viewer-render-source.ts:190`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:209`. |
| Atlas Runtime projection omits unbound Drawable Pool drawable. | Covered. The test asserts the projected drawable list is exactly body and sleeve, and explicitly excludes pool. | `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:129`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:134`. Source filters projection drawables by runtime drawable ids: `apps/editor/src/workspace/viewer/viewer-render-source.ts:376`. |
| Runtime-bound missing placement still disables Atlas Runtime. | Covered. The test removes the sleeve placement; sleeve is rig-bound in the fixture and the result falls back to Original with `missingPlacement`. | `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:315`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:324`. Runtime-bound fixture: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:410`. Source placement guard: `apps/editor/src/workspace/viewer/viewer-render-source.ts:212`. |
| Original mode still includes unbound drawables where applicable. | Covered. Original render-source projection requires the pool drawable and verifies original texture, dimensions, and unit UVs. Canvas preservation also includes pool. | `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:72`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:77`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:139`. Source returns `originalProjection` for Original mode: `apps/editor/src/workspace/viewer/viewer-render-source.ts:171`. |
| Original mode does not recompute atlas target selection or source signature every projection. | Covered. The test injects throwing hooks and asserts they are not called for Original. The source only calls those hooks in the Atlas Runtime branch. | Test: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:159`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:184`. Source Original branch uses static artifact checks only: `apps/editor/src/workspace/viewer/viewer-render-source.ts:165`. Expensive hook calls are in `resolveViewerAtlasRuntimeSource`: `apps/editor/src/workspace/viewer/viewer-render-source.ts:190`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:191`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:198`. |
| Missing/stale artifact tests remain present. | Covered at the policy level that existed for Viewer: missing layout and stale source inputs remain tested, and Viewer screen fallback remains tested. | Missing layout: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:189`. Stale source inputs: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:205`. Viewer fallback: `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:288`. Disabled reason UI: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:325`. |
| Runtime Controls test adequacy. | Existing coverage is enough. Domain B changed projection semantics, not Runtime Controls API or markup. Existing tests cover the render source control, disabled reason, control order, and fallback integration. | `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:325`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:345`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:288`. |
| Tests are not excessively coupled or missing a blocker. | Adequate. The hook-based Original-mode test is intentionally implementation-aware, but this is appropriate for a performance regression guard. It tests the observable contract that injected target-selection/source-signature hooks are not invoked for Original. | `apps/editor/src/workspace/viewer/viewer-render-source.ts:53`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:162`. |

## Verification Assessment

Focused Viewer tests are adequate for Domain B. They use the real atlas preview/apply path for the unbound pool regression, exercise the projection remap path, preserve existing missing/stale availability behavior, and verify Runtime Controls integration remains covered by existing unchanged tests.

The main non-blocking limitation is that missing artifact coverage is not exhaustive for every internal unavailable code such as missing bytes, invalid byte length, missing source signature, or invalid placement. That was not introduced by Wave89, and the current missing-layout plus stale-source tests are sufficient for this Domain B scope.

## Remaining Risks

- No browser pixel proof verifies final rendered pixels after Atlas Runtime filtering; current proof is projection-level.
- Original mode now reports static atlas artifact availability without recomputing the current source signature. This is the intended performance guard, but it means stale detection is proven when Atlas Runtime is requested, not continuously while Original is selected.
- The hook-based performance test would not catch a future direct import call that bypasses the hook seam, but it is a reasonable focused guard for the current implementation.

## Verification Performed

- Read the required basis documents directly.
- Read the Domain B source and test diff directly.
- Read the required Viewer source/tests directly.
- Ran `git diff -- apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`; no diff.
- Ran `git diff --check -- apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts`; passed with CRLF warnings only.
- Ran focused Viewer Vitest command in sandbox; it failed with the known `esbuild` `spawn EPERM`.
- Reran the same focused Viewer Vitest command escalated: passed, 3 files / 40 tests.
