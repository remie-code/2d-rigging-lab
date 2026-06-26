# Wave17 Domain B Spec Compliance Review

- Verdict: pass
- Review lane: spec compliance
- Date: 2026-06-26
- Reviewer: Review-Sylph

## Review Scope

This is a fresh re-review after Gnome fix loop 2 for Wave17 Domain B only.

Reviewed for:

- render-frame public snapshot bypass;
- the previous loop-1 finding that the fast path must not build public drawable DTOs under another name;
- dynamic renderer output parity for vertices, opacity, draw order, and visibility;
- public snapshot compatibility and freshness;
- Domain B source-scope constraints.

## Basis Used

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
- `discussion/_conventions.md`
- `discussion/_map.md`

## Files And Diff Reviewed

Commands/files reviewed directly:

- `git status --short -uall`
- `git diff -- packages/runtime-core/src/keyform-target-application.ts packages/runtime-core/src/rig-control-evaluation.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-profiling.ts packages/runtime-core/src/snapshot-static-templates.ts packages/runtime-core/src/snapshot.ts`
- `Get-Content -Raw -Encoding UTF8 packages/runtime-core/src/runtime-drawable-evaluation.ts`
- `rg -n "materializeRuntimeRenderFrameDrawableSnapshots|materializeRuntimeRenderFrameDrawables|EvaluatedDrawableDto|RuntimeDrawableEvaluationBase|vertexHash|bounds|vertexCount|diagnostics|createRuntimeSnapshot|publicSnapshotMaterializationCount|runtimeCoreRenderFrameOutputDurationMs" packages/runtime-core/src`
- focused line inspections for `evaluateRuntimeRenderFrameInternal(...)`, `createRuntimeRenderFrame(...)`, `evaluateRuntimeRenderDrawables(...)`, `evaluateRuntimeDrawableFrame(...)`, `materializeRuntimeRenderFrameDrawables(...)`, keyform target application, rig-control transform application, profiling counters, and added tests.

Reviewed changed source/test files:

- `packages/runtime-core/src/runtime-drawable-evaluation.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-profiling.ts`
- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/snapshot.ts`

`git status --short -uall` also showed Wave17 discussion artifacts and `discussion/runtime-player/implementation/_map.md`. No Runtime Player app source, Editor source, Runtime Export/package-format schema, package manifest, lockfile, or dependency change was present in the reviewed Domain B source scope.

## Findings

No spec-compliance findings.

## Spec Compliance Checklist

- Pass - the previous loop-1 public drawable DTO finding is fixed. The old `materializeRuntimeRenderFrameDrawableSnapshots` symbol is absent. The new fast-path drawable work item is the narrow `RuntimeDrawableEvaluationBase` in `packages/runtime-core/src/runtime-drawable-evaluation.ts:7`, and render-frame base materialization uses `materializeRuntimeRenderFrameDrawables(...)` at `packages/runtime-core/src/snapshot-static-templates.ts:149`.
- Pass - render-frame base drawables no longer include public drawable snapshot fields such as `bounds`, `vertexCount`, `vertexHash`, texture DTOs, or per-drawable `diagnostics`. `materializeRuntimeRenderFrameDrawables(...)` copies only `drawableId`, `meshId`, `visible`, `opacity`, draw-order fields, and vertices at `packages/runtime-core/src/snapshot-static-templates.ts:149`.
- Pass - public `EvaluatedDrawableDto` materialization remains on the explicit public snapshot path. `createRuntimeSnapshot(...)` instantiates `evaluateRuntimeDrawableFrame<EvaluatedDrawableDto>(...)` and calls `materializeRuntimeDrawableSnapshots(...)` at `packages/runtime-core/src/snapshot.ts:193` and `packages/runtime-core/src/snapshot.ts:213`; the render-frame path instantiates `evaluateRuntimeDrawableFrame<RuntimeDrawableEvaluationBase>(...)` at `packages/runtime-core/src/snapshot.ts:325` and `packages/runtime-core/src/snapshot.ts:334`.
- Pass - render-frame evaluation does not call `createRuntimeSnapshot(...)`. `evaluateRuntimeRenderFrameInternal(...)` advances state and builds output through `evaluateRuntimeRenderDrawables(...)` at `packages/runtime-core/src/runtime-core.ts:225` and `packages/runtime-core/src/runtime-core.ts:260`; the public snapshot path remains separate at `packages/runtime-core/src/runtime-core.ts:199`.
- Pass - the render-frame API returns the renderer-facing dynamic fields required by Wave17. `createRuntimeRenderFrame(...)` maps output to `drawableId`, stable `index`, cloned `vertices`, `opacity`, `drawOrder`, and `visible` at `packages/runtime-core/src/runtime-core.ts:291`, with outgoing vertex cloning at `packages/runtime-core/src/runtime-core.ts:305`.
- Pass - public snapshot materialization counting distinguishes the paths. `createRuntimeSnapshot(...)` records public materialization at `packages/runtime-core/src/snapshot.ts:212`; render-frame tests assert public path count `1` and render-frame count `0` at `packages/runtime-core/src/runtime-core.test.ts:835`, and nested warp fast-path coverage asserts count `0` at `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts:91`.
- Pass - per-frame public drawable/debug fields are not regenerated by keyform/deformer helpers on the render-frame drawable path. Keyform vertex updates only compute `bounds`, `vertexCount`, `vertexHash`, and texture reconciliation when the input drawable already has public geometry fields at `packages/runtime-core/src/keyform-target-application.ts:318` and `packages/runtime-core/src/keyform-target-application.ts:654`; render-frame base drawables do not. Rig-control transformed vertices similarly update public geometry only when those fields exist at `packages/runtime-core/src/rig-control-evaluation.ts:415` and `packages/runtime-core/src/rig-control-evaluation.ts:447`.
- Pass - keyforms, dynamics, opacity, draw order, and visibility remain semantically aligned with full public snapshot-derived render values in deterministic coverage. The parity test starts at `packages/runtime-core/src/runtime-core.test.ts:579`, compares the full render drawable array at `packages/runtime-core/src/runtime-core.test.ts:812`, and asserts deformed vertices, dynamics-driven opacity, draw order, visibility, and next dynamics state at `packages/runtime-core/src/runtime-core.test.ts:822`.
- Pass - nested warp/rest-bind semantics are preserved for the fast path. The added test at `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts:46` compares render-frame vertices against full snapshot vertices and asserts no public snapshot materialization at `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts:88`.
- Pass - previous public snapshot compatibility and freshness remain intact. The public snapshot path still produces the full snapshot object and public arrays, and the isolation test at `packages/runtime-core/src/runtime-core.test.ts:843` verifies an earlier full public snapshot is not mutated by later render-frame evaluation.
- Pass - target-local mutable buffers are not exposed as public snapshot DTOs. Domain B does not add reusable output-buffer plumbing, and final render-frame vertices are cloned before exposure at `packages/runtime-core/src/runtime-core.ts:295`.
- Pass - runtime-core remains free of Runtime Export/package-format dependencies in the reviewed files. The focused forbidden import search for `@private-2d-rigging-lab/package-format`, `RuntimeExport`, `package-format`, `activeVariant`, and `Variant` returned no matches.
- Pass - Domain B scope was respected. No Runtime Player connection, Runtime Export format change, Editor change, package-format schema change, new dependency, lockfile edit, or `pnpm install` was found.

## Verification Considered / Run

Considered Gnome loop 2 evidence:

- `pnpm.cmd typecheck` passed.
- Focused 9-file Vitest command passed: 9 files / 38 tests.
- `git diff --check` passed with CRLF working-copy warnings only; the new-file no-index check had no whitespace findings.

Independently run during this re-review:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/keyform-target-application.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/rig-control-compiled-topology.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 9 files / 38 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- packages/runtime-core/src/keyform-target-application.ts packages/runtime-core/src/rig-control-evaluation.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-profiling.ts packages/runtime-core/src/snapshot-static-templates.ts packages/runtime-core/src/snapshot.ts`
  - No whitespace findings; CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages/runtime-core/src/runtime-drawable-evaluation.ts`
  - No whitespace findings; command returned normal no-index diff status with a CRLF working-copy warning.
- Forbidden scope/import search over reviewed files for `@private-2d-rigging-lab/package-format`, `RuntimeExport`, `package-format`, `activeVariant`, and `Variant`
  - No matches.

## Residual Risks

- Dedicated render-frame parity for a keyform-driven visibility toggle is inferred from the shared keyform application path plus existing keyform-target tests at `packages/runtime-core/src/keyform-target-application.test.ts:118`; the Domain B parity fixture compares visibility but does not make visibility itself keyform-driven.
- Runtime-core has no active Variant concept in the reviewed files; Variant switching remains a Runtime Player integration responsibility for later Wave17 domains.
- Rig-control internals still carry `EvaluatedRigControlDto` as part of their existing transform/status state even when `includeRigControls: false` prevents public rig-control DTO output. This is not the loop-1 public drawable DTO blocker and is not exposed by the render-frame API, but it remains a possible future performance narrowing target if deformer hierarchy evaluation stays hot.
- Browser Source / Native Stage live-path adoption, target separation, and copied Performance Diagnostics presentation remain for later Wave17 domains.
