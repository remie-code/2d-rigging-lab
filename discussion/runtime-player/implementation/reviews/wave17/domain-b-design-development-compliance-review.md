# Wave17 Domain B Design / Development Compliance Re-Review

Verdict: pass

Review lane: design / development compliance only.

## Basis Used

- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-a-runtime-core-render-frame-api-report.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-test-adequacy-review.md`
- Prior `discussion/runtime-player/implementation/reviews/wave17/domain-b-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Files / Diff Reviewed

Directly reviewed:

- `git status --short -uall`
- `git diff -- packages/runtime-core/src/keyform-target-application.ts packages/runtime-core/src/rig-control-evaluation.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-profiling.ts packages/runtime-core/src/snapshot-static-templates.ts packages/runtime-core/src/snapshot.ts`
- `Get-Content -Raw -Encoding UTF8 packages/runtime-core/src/runtime-drawable-evaluation.ts`
- `rg -n "materializeRuntimeRenderFrameDrawableSnapshots|materializeRuntimeRenderFrameDrawables|EvaluatedDrawableDto|RuntimeDrawableEvaluationBase|vertexHash|bounds|vertexCount|diagnostics|createRuntimeSnapshot|RuntimeSnapshotDto|@private-2d-rigging-lab/package-format|RuntimeExport|package-format" packages/runtime-core/src`

Changed runtime-core source/test scope:

- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-profiling.ts`
- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/runtime-drawable-evaluation.ts` (new untracked file, inspected directly)

`git status --short -uall` also showed discussion/report/map artifacts, including this review file and Wave17 reports. No package manifest, lockfile, Runtime Export package-format, Editor, or Runtime Player source change was present in the reviewed Domain B source scope.

## Findings

No blocking design/development findings.

The previous blocker is fixed in code, not merely renamed. The render-frame path no longer calls or defines `materializeRuntimeRenderFrameDrawableSnapshots(...)`, and the current render-frame path does not materialize `EvaluatedDrawableDto[]`.

Evidence:

- `packages/runtime-core/src/runtime-core.ts:260` measures render-frame output through `runtimeCoreRenderFrameOutputDurationMs`, then calls `createRuntimeRenderFrame(...)` with `evaluateRuntimeRenderDrawables(...)`, not `createRuntimeSnapshot(...)`.
- `packages/runtime-core/src/snapshot.ts:325` defines `evaluateRuntimeRenderDrawables(...)`, which evaluates `evaluateRuntimeDrawableFrame<RuntimeDrawableEvaluationBase>(...)` at `packages/runtime-core/src/snapshot.ts:334`.
- `packages/runtime-core/src/snapshot-static-templates.ts:149` defines `materializeRuntimeRenderFrameDrawables(...)`, returning `RuntimeDrawableEvaluationBase[]`; it copies only `drawableId`, `meshId`, `visible`, `opacity`, `baseDrawOrder`, `evaluatedDrawOrder`, and optional cloned `vertices` at `packages/runtime-core/src/snapshot-static-templates.ts:152`.
- `packages/runtime-core/src/runtime-drawable-evaluation.ts:7` defines the internal base drawable shape. It intentionally excludes public/debug snapshot fields such as public `bounds`, `vertexCount`, `vertexHash`, public texture DTOs, per-drawable `diagnostics`, masks, parts, and mesh evidence.
- The explicit public snapshot path remains separate. `packages/runtime-core/src/snapshot.ts:193` defines `createRuntimeSnapshot(...)`, records public materialization at `packages/runtime-core/src/snapshot.ts:212`, and uses `materializeRuntimeDrawableSnapshots(...)` at `packages/runtime-core/src/snapshot.ts:227`.
- Generic keyform application preserves the public path while keeping the render-frame path narrow. `withUpdatedVertices(...)` only computes public `bounds`, `vertexCount`, `vertexHash`, and texture reconciliation if the input drawable already has public geometry fields at `packages/runtime-core/src/keyform-target-application.ts:329`; render-frame drawables from `RuntimeDrawableEvaluationBase` do not.
- Generic rig-control evaluation similarly avoids public geometry recomputation for render-frame drawables. `withRigControlTransformedVertices(...)` returns only opacity and vertices unless public geometry fields are already present at `packages/runtime-core/src/rig-control-evaluation.ts:429`.
- `RuntimeRenderFrameDrawable` exposes renderer-facing dynamic fields only at `packages/runtime-core/src/runtime-model.ts:79`.
- `createRuntimeRenderFrame(...)` maps only drawable id, stable index, cloned vertices, opacity, draw order, and visibility at `packages/runtime-core/src/runtime-core.ts:295`, with frame-owned vertex clones at `packages/runtime-core/src/runtime-core.ts:305`.

## Passing Design Checks

- Pass: render-frame evaluation bypasses `evaluateFrame(...)`, `createRuntimeSnapshot(...)`, public `RuntimeSnapshotDto`, and public `EvaluatedDrawableDto[]` construction.
- Pass: public snapshot compatibility remains explicit. `createRuntimeSnapshot(...)` still owns public snapshot DTO materialization, masks, draw list, parameters, dynamics, rig controls, parts, diagnostics, and validation.
- Pass: public/debug-only per-drawable fields are not produced by the render-frame base materializer. Remaining references to `bounds`, `vertexCount`, `vertexHash`, and per-drawable `diagnostics` are either public snapshot schema/path code or guarded generic helper branches for public drawables.
- Pass: render-frame output exposes frame-owned renderer fields, and vertex arrays are cloned before exposure.
- Pass: runtime-core remains independent of Runtime Export/package-format and app/editor layers. A production-source `rg` check for package-format/downstream imports and `RuntimeExport` found no matches; `dependency-boundary.test.ts` also passed.
- Pass: metrics are runtime-core scoped and low-cost. Profiling counters are gated by profiling enablement in `packages/runtime-core/src/runtime-profiling.ts:82`, and render-frame output has a dedicated duration field at `packages/runtime-core/src/runtime-profiling.ts:7`.
- Pass: source scope is bounded to runtime-core fast output internals and focused tests. No broad app/editor/schema/dependency refactor was found.
- Pass: the keyform and rig-control refactors are maintainable enough for this wave. They generalize existing helpers over `RuntimeDrawableEvaluationBase`, preserve public geometry update behavior through explicit type guards, and keep renderer-only drawables narrow.

## Verification Considered / Run

Considered Gnome loop 2 evidence:

- `pnpm.cmd typecheck` passed.
- Focused 9-file Vitest command passed: 9 files / 38 tests.
- `git diff --check` passed with CRLF warnings only; new file no-index check had no whitespace findings.

Independently run in this re-review:

- `git status --short -uall`
- `git diff -- <reviewed runtime-core files>`
- `Get-Content -Raw -Encoding UTF8 packages/runtime-core/src/runtime-drawable-evaluation.ts`
- `rg` checks for prior blocker names, public DTO types, public/debug fields, package-format imports, and `RuntimeExport`
- `git diff --check -- <reviewed tracked runtime-core files>`
  - No whitespace findings; CRLF warnings only.
- `git diff --no-index --check -- NUL packages/runtime-core/src/runtime-drawable-evaluation.ts`
  - No whitespace findings; command returned normal no-index difference status with CRLF warning only.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/keyform-target-application.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/texture-projection.test.ts packages/runtime-core/src/rig-control-compiled-topology.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 9 files / 38 tests.

## Residual Risks

- Render-frame profiling still reuses some existing internal phase names such as `drawableSnapshotCreationDurationMs` for narrow render drawable work inside `evaluateRuntimeDrawableFrame(...)`. This is not public DTO materialization, but Domain D/report integration should label or distinguish fast-path metrics clearly.
- The render-frame path still clones vertex arrays for frame-owned output. This is compliant with the current Wave17 plan, but typed/reusable render buffers may remain a later performance target.
- Domain C must continue to preserve target-local runtime instances and must not share mutable render output between Native Stage and Browser Source.
- Real OBS Browser Source performance improvement remains unproven until the later Runtime Player connection/diagnostics domains and the manual real-model capture.
