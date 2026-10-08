# Wave98 Final Integration Report: Viewer Dynamics Performance Instrumentation + Duplicate Runtime Evaluation Removal

## Verdict

Verdict: `pass`.

Wave98 Domain A has a passing implementation report and all three independent Domain A review lanes passed. Fresh Domain B verification evidence passed, and the final clean integration Review-Sylph report exists with verdict `pass` and no blocking findings.

## Basis

- `discussion/implementation/orchestration/wave98-plan.md`
- `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md`
- `discussion/implementation/waves/wave98/_map.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave98/wave98-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave98/_map.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/implementation/waves/wave97/wave97-final-integration-report.md`
- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

## Domain Verdicts

| Domain | Current state | Evidence |
|---|---|---|
| Domain A: `wave98-viewer-dynamics-performance-instrumentation-duplicate-eval-removal` | `pass` | Domain A report recommends `pass`; spec compliance, design/development compliance, and test adequacy reviews all have verdict `pass`. |
| Domain B: `wave98-final-integration-clean-review` | `pass` | Final integration report is complete; final clean integration review has verdict `pass`, no blocking findings, and passing verification reruns. |

## Domain A Report / Review Lane Presence

Present Domain A artifacts:

- `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave98/wave98-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave98/_map.md`

All three Domain A review lanes report `pass`. The final clean integration review also reports `pass`.

## Files Changed

Wave98 target source/test scope:

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `packages/render-core/src/performance-instrumentation.ts`

Wave98 documentation scope:

- `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md`
- `discussion/implementation/waves/wave98/wave98-final-integration-report.md`
- `discussion/implementation/waves/wave98/_map.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-test-adequacy-review.md`

Domain B document-only changes:

- `discussion/implementation/waves/wave98/wave98-final-integration-report.md`
- `discussion/implementation/waves/wave98/_map.md`
- `discussion/implementation/orchestration/_map.md`

Domain B did not edit implementation source, tests, dependencies, manifests, or lockfiles.

## Integration Summary

- Active Viewer runtime rAF evaluation now carries fresh `parameterValues` into Clean Stage projection through a conservative reusable snapshot.
- Fresh compatible projection reuses that snapshot instead of running a second zero-delta runtime evaluation.
- Missing, stale, incompatible, or no reusable frame conditions preserve the existing fallback path.
- Added Viewer performance metrics remain behind the existing opt-in performance flag policy:
  - `viewer.runtimeFrame.evaluations`
  - `viewer.runtimeFrame.ms`
  - `viewer.runtimeFrame.deltaZeroReevaluationSkipped`
  - `viewer.runtimeFrame.deltaZeroReevaluationFallback`
  - `viewer.cleanStageProjection.ms`
- Runtime-core dynamics group/substep counters were deferred because adding them through the existing helper would require dependency-boundary or manifest changes.
- Wave97 idle stop/restart behavior, Dynamics solver formulas, Runtime Controls, Reset simulation, Original / Atlas Runtime rendering responsibility, Runtime Export, Workspace Save, package-format schema, and Runtime Player app scope are reported unchanged by Domain A and its review lanes.

## Fresh Verification

Fresh Domain B verification performed by Orch-Sylph:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` | Pass: 2 files / 39 tests. |
| `pnpm.cmd exec vitest run packages/render-core/src/render-scene.test.ts` | Pass: 1 file / 5 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass: `Source organization guard passed.` |
| `node scripts/check-dependencies.mjs` | Pass: `Dependency guard passed.` |
| `git diff --check` | Pass. LF-to-CRLF working-copy warnings only. |
| `rg -n "console\\." apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx apps/editor/src/workspace/viewer/viewer-runtime-playback.ts packages/render-core/src/performance-instrumentation.ts` | No matches. |

## Forbidden-Scope Result

Forbidden-scope status: `pass for Wave98 target diff; global worktree still has unrelated dirty state outside Wave98 ownership`.

The Wave98 target source diff is limited to:

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `packages/render-core/src/performance-instrumentation.ts`

The targeted forbidden-scope diff check was empty for:

- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/package-format`
- `apps/editor/src/workspace/runtime-export`
- `apps/editor/src/workspace/save`
- `apps/editor/src/workspace/canvas`
- `packages/render-webgl2`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-source-signature.ts`

No Wave98-owned drift was found in Dynamics solver formula paths, Dynamics preset/default paths, Runtime Export, Workspace Save, Texture Atlas / Atlas Runtime source cache internals, Runtime Player app source, package-format schema, mesh/render architecture, dependency manifests, or lockfile.

The global worktree still contains unrelated dirty state in:

- `apps/runtime-player/**`
- `pnpm-lock.yaml`

Domain A report and reviews classify these as pre-existing, unowned, and unrelated to Wave98. They were not reverted or edited by Domain B and must remain outside the Wave98 pass/fail evidence except as explicit dirty-worktree context.

## Final Clean Review Status

Status: `pass`.

Review path:

- `discussion/implementation/reviews/wave98/wave98-final-clean-integration-review.md`

The final clean Review-Sylph independently verified this report, Domain A artifacts, fresh verification evidence, and forbidden-scope classification. Blocking findings: none.

Final clean Review-Sylph verification rerun:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts packages/render-core/src/render-scene.test.ts` | Pass: 3 files / 44 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `node scripts/check-dependencies.mjs` | Pass. |
| `git diff --check` | Pass. LF-to-CRLF working-copy warnings only. |
| `rg -n "console\\." apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx apps/editor/src/workspace/viewer/viewer-runtime-playback.ts packages/render-core/src/performance-instrumentation.ts` | No matches. |
| Targeted forbidden-scope diff | Empty for runtime-core solver, package-format, export/save/canvas, render-webgl2, and atlas-source internals. |

## Residual Risks / Deferred Bottlenecks

- Runtime-core `runtime.dynamics.groups` and `runtime.dynamics.substeps` counters remain deferred because the current instrumentation helper lives in render-core and adding runtime-core use would require dependency-direction or manifest decisions.
- Browser CPU profiling and pixel proof were not run. Wave98 did not make them blockers, and focused tests cover duplicate-evaluation skip, fallback, behavior preservation, idle stop/restart, and reset paths.
- Clean Stage projection, runtime snapshot creation, parameter resolution, Atlas Runtime dynamic projection remap, render/mask/WebGL phases, and canvas projection may remain next bottlenecks. The new Viewer metrics should be read with existing canvas/render counters to decide any later wave.
- There is no isolated test for a same-model/same-state reusable frame where only the base parameter signature changes. Existing tests cover missing reusable data, stale/incompatible frame fallback, output equality against fallback, no-dynamics behavior, driver-change motion, reset, and idle-loop behavior, so this is non-blocking but worth final-review awareness.
- Unrelated dirty `apps/runtime-player/**` and `pnpm-lock.yaml` state remains in the global worktree and should not be attributed to Wave98.

## User-Decision Points

None blocking.
