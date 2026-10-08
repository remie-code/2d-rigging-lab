# Wave17 Domain B Test Adequacy Re-Review

- Verdict: pass
- Review lane: test adequacy
- Date: 2026-06-26
- Reviewer: Review-Sylph
- Context: re-review after Gnome fix loop 2 narrowed the render-frame drawable intermediate to an internal runtime drawable shape.

## Basis Used

Basis documents:

- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-a-runtime-core-render-frame-api-report.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-b-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

Reviewed commands, diffs, and files:

- `git status --short -uall`
- `git diff -- packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-profiling.ts packages/runtime-core/src/snapshot.ts packages/runtime-core/src/snapshot-static-templates.ts packages/runtime-core/src/keyform-target-application.ts packages/runtime-core/src/rig-control-evaluation.ts`
- `Get-Content -Raw -Encoding UTF8 packages/runtime-core/src/runtime-drawable-evaluation.ts`
- `rg -n "evaluateRenderFrame|publicSnapshotMaterializationCount|runtimeSnapshotCreationDurationMs|snapshotValidationDurationMs|runtimeCoreRenderFrameOutputDurationMs|nested warp|rest-bind|dynamics|visibility|drawOrder|opacity|RuntimeDrawableEvaluationBase|materializeRuntimeRenderFrameDrawables" packages/runtime-core/src`
- `packages/runtime-core/src/runtime-drawable-evaluation.ts` (new untracked file)
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-profiling.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`

## Findings

No blocking test adequacy findings.

The existing Domain B parity, materialization-counter, and freshness tests still exercise the final implementation after loop 2. The previous design blocker was specifically about a public drawable DTO-like intermediate. The final diff now introduces a narrow internal drawable shape and the render-frame path uses that shape before projecting to renderer-facing output. This boundary is covered by direct source/diff verification plus behavioral parity tests; it is not solely inferred from Gnome's report.

## Test Adequacy Checklist

- Pass - final render-frame internals no longer build public drawable DTOs on the fast path. The new internal shape is `RuntimeDrawableEvaluationBase` with only renderer/evaluation fields at `packages/runtime-core/src/runtime-drawable-evaluation.ts:7`. Render-frame base drawables are created by `materializeRuntimeRenderFrameDrawables(...)` at `packages/runtime-core/src/snapshot-static-templates.ts:149`; that helper omits public snapshot-only fields such as `bounds`, `vertexCount`, `vertexHash`, `texture`, and `diagnostics`. The render path calls this helper through `evaluateRuntimeRenderDrawables(...)` at `packages/runtime-core/src/snapshot.ts:325`, while the public snapshot path still uses `materializeRuntimeDrawableSnapshots(...)` through `createRuntimeSnapshot(...)` at `packages/runtime-core/src/snapshot.ts:193`.
- Pass - the shared helper boundary is exercised by tests, not just compiled. `evaluateRuntimeDrawableFrame<TDrawable>` is generic over `RuntimeDrawableEvaluationBase` at `packages/runtime-core/src/snapshot.ts:362`; the render path instantiates it with the narrow shape at `packages/runtime-core/src/snapshot.ts:334`, applies keyforms at `packages/runtime-core/src/snapshot.ts:433`, and runs rig-control evaluation at `packages/runtime-core/src/snapshot.ts:443`. The parity tests call `RuntimeModelInstance#evaluateRenderFrame(...)`, so they traverse the narrow render-frame branch rather than the public snapshot branch.
- Pass - keyform-driven vertices, opacity, and draw order match the public snapshot path. The main parity fixture starts at `packages/runtime-core/src/runtime-core.test.ts:579`, defines mesh vertex keyforms at `runtime-core.test.ts:705`, draw-order keyforms at `runtime-core.test.ts:720`, and dynamics-driven opacity keyforms at `runtime-core.test.ts:734`. It compares the whole render-frame drawable array to full public snapshot-derived render values at `runtime-core.test.ts:812` and asserts the deformed body drawable at `runtime-core.test.ts:822`.
- Pass - dynamics-driven parameter changes still affect render output where deterministic fixtures allow. The fixture defines a dynamics group at `packages/runtime-core/src/runtime-core.test.ts:604`, drives it via input at `runtime-core.test.ts:759`, asserts rendered opacity `0.9` at `runtime-core.test.ts:822`, and checks updated dynamics state at `runtime-core.test.ts:830`. The focused run also included existing dynamics snapshot coverage in `packages/runtime-core/src/dynamics-evaluation.test.ts`.
- Pass - nested warp/rest-bind semantics remain covered on the render-frame path. The new fast-path test starts at `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts:46`, evaluates `evaluateRenderFrame(...)` at `rig-control-nested-warp-rest-bind-semantics.test.ts:71`, compares render vertices to full public snapshot vertices at `rig-control-nested-warp-rest-bind-semantics.test.ts:88`, and asserts no public snapshot materialization at `rig-control-nested-warp-rest-bind-semantics.test.ts:91`.
- Pass - public snapshot freshness and render-frame isolation remain covered. Existing compiled snapshot freshness coverage starts at `packages/runtime-core/src/snapshot-static-templates.test.ts:85`. Domain B also keeps a direct isolation test at `packages/runtime-core/src/runtime-core.test.ts:843`, preserving a previous public snapshot before evaluating a render frame and asserting both snapshot equality and distinct vertex array references at `runtime-core.test.ts:899`.
- Pass - render-frame evaluation does not increment the public snapshot materialization counter. `createRuntimeSnapshot(...)` records public materialization at `packages/runtime-core/src/snapshot.ts:212`; the render-frame path is measured as `runtimeCoreRenderFrameOutputDurationMs` at `packages/runtime-core/src/runtime-core.ts:260` and uses `evaluateRuntimeRenderDrawables(...)` at `runtime-core.ts:262`. Tests assert the public path count is `1` and the render-frame path count is `0` at `packages/runtime-core/src/runtime-core.test.ts:835`, and the nested warp fast-path test asserts the same boundary at `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts:91`.
- Pass - public snapshot path remains the owner of public DTO details and validation. `createRuntimeSnapshot(...)` still finalizes public drawables, masks, draw list, dynamics, rig controls, and optional schema validation at `packages/runtime-core/src/snapshot.ts:238` and `snapshot.ts:263`. The render-frame path returns only `RuntimeRenderDrawableEvaluationDto` fields at `packages/runtime-core/src/snapshot.ts:353`, then `createRuntimeRenderFrame(...)` clones renderer vertices and exposes `drawableId`, stable `index`, `vertices`, `opacity`, `drawOrder`, and `visible` at `packages/runtime-core/src/runtime-core.ts:291`.
- Pass with residual risk - keyform-driven visibility behavior is covered by existing keyform-target unit coverage at `packages/runtime-core/src/keyform-target-application.test.ts:118` and is compared as a renderer field in the parity assertion at `packages/runtime-core/src/runtime-core.test.ts:812`, but there is no dedicated render-frame parity fixture whose visibility field itself is keyform-driven. This is acceptable for Domain B because the render-frame path and public snapshot path share `applySamplesInEvaluationOrder(...)` at `packages/runtime-core/src/snapshot.ts:562`, and the visibility patch branch is independent of public geometry fields.
- Pass - runtime-core variant coverage is not applicable in this domain. `rg -n "variant|activeVariant|Variant" packages/runtime-core/src` returned no runtime-core matches. Variant switching remains a Runtime Player integration concern for later Wave17 domains.

## Verification Considered / Run

Considered Gnome loop-2 evidence:

- `pnpm.cmd typecheck` passed.
- Focused 9-file Vitest command passed: 9 files / 38 tests.
- `git diff --check` passed with CRLF warnings only.
- New-file no-index whitespace check had no whitespace findings.

Reviewer-run verification:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/keyform-target-application.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/rig-control-compiled-topology.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Initial sandbox run failed while loading Vitest config with `spawn EPERM`.
  - Escalated rerun passed: 9 files / 38 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-profiling.ts packages/runtime-core/src/snapshot.ts packages/runtime-core/src/snapshot-static-templates.ts packages/runtime-core/src/keyform-target-application.ts packages/runtime-core/src/rig-control-evaluation.ts packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
  - No whitespace findings; CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages/runtime-core/src/runtime-drawable-evaluation.ts`
  - No whitespace findings; command returned normal no-index diff status with a CRLF working-copy warning only.
- `rg -n "RuntimeExport|package-format|@private-2d-rigging-lab/package-format|EvaluatedDrawableDto\\[\\]|materializeRuntimeRenderFrameDrawableSnapshots" packages/runtime-core/src/runtime-drawable-evaluation.ts packages/runtime-core/src/snapshot-static-templates.ts packages/runtime-core/src/snapshot.ts packages/runtime-core/src/keyform-target-application.ts packages/runtime-core/src/rig-control-evaluation.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-model.ts`
  - No package-format or old render-frame drawable snapshot helper matches. `EvaluatedDrawableDto[]` remains only in public snapshot/finalization paths.

## Residual Risks

- The absence of public snapshot-only fields in the fast-path internal drawable is verified by source/diff inspection, not by a black-box runtime assertion. This is acceptable for this re-review because those fields are intentionally internal and not observable in `RuntimeRenderFrame`, but a future hardening test could directly assert `materializeRuntimeRenderFrameDrawables(...)` omits `bounds`, `vertexCount`, `vertexHash`, `texture`, and `diagnostics`.
- Render-frame parity for a keyform-driven visibility toggle is inferred from the shared generic keyform application path plus existing keyform-target visibility tests, not from a dedicated render-frame visibility fixture.
- Domain B is runtime-core only. Runtime Player Variant switching, Native Stage / Browser Source target separation, and copied Performance Diagnostics report presentation remain later Wave17 domain responsibilities.
- `publicSnapshotMaterializationCount` proves `createRuntimeSnapshot(...)` was not called during render-frame evaluation. It does not, by itself, prove that every future internal allocation is narrow; source review remains the required companion check for this boundary.
