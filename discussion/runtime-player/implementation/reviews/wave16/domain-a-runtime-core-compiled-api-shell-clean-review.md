# Runtime Player Wave16 Domain A Clean Review: Runtime-Core Compiled API Shell

- Verdict: pass
- Domain: Runtime-Core API Shell
- Reviewer: Review-Sylph
- Date: 2026-06-26
- Domain B may proceed: yes

## Reviewed Files

Implementation files:

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`

Context files:

- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave15/wave15-final-integration-report.md`
- `tmp/report.log`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `packages/runtime-core/src/index.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/dependency-boundary.test.ts`

## Findings

No blocking or non-blocking implementation findings.

The implementation matches Domain A as an additive API shell. It does not change the legacy frame evaluator signature, does not change snapshot DTO shape, and does not introduce Runtime Player integration, static-template compilation, rig/deformer topology compilation, or performance optimization.

## Rubric Checklist

| Rubric item | Result | Evidence |
|---|---|---|
| Compiled evaluator is first-class runtime-core API, not hidden app cache | Pass | `compileRuntimeModel` is exported from runtime-core and added to `runtimeCore`; no app cache changes were made. See `packages/runtime-core/src/runtime-core.ts:67`, `packages/runtime-core/src/runtime-core.ts:133`, `packages/runtime-core/src/runtime-core.ts:173`. |
| `compileRuntimeModel(graph)` exists as runtime-core API | Pass | Named export exists at `packages/runtime-core/src/runtime-core.ts:133`; package root re-exports runtime-core via `packages/runtime-core/src/index.ts:16`. |
| `CompiledRuntimeModel#createInstance()` exists | Pass | Interface and implementation exist at `packages/runtime-core/src/runtime-model.ts:19` and `packages/runtime-core/src/runtime-model.ts:73`. |
| `RuntimeModelInstance#evaluateFrame(...)` exists and returns compatible frame result shape | Pass | Interface and implementation return `RuntimeFrameEvaluationResult`; v0 delegates to `evaluateRuntimeFrame`. See `packages/runtime-core/src/runtime-model.ts:23` and `packages/runtime-core/src/runtime-model.ts:91`. Test deep-equality is at `packages/runtime-core/src/runtime-core.test.ts:368`. |
| Existing `evaluateRuntimeFrame` remains compatible for current callers | Pass | Its signature/body are unchanged except surrounding additive imports/exports; existing tests still pass. See `packages/runtime-core/src/runtime-core.ts:79`. |
| Runtime-core does not import Runtime Export package-format DTOs | Pass | `runtime-model.ts` depends on `NormalizedRuntimeGraph` and existing runtime-core/contracts types, not package-format DTOs. Dependency-boundary test passed. See `packages/runtime-core/src/runtime-model.ts:1`, `packages/runtime-core/src/runtime-model.ts:5`, and `packages/runtime-core/src/dependency-boundary.test.ts:8`. |
| Compiled model is immutable/shareable at API boundary | Pass with Domain A caveat | The public compiled object exposes only `createInstance` and is frozen at construction. See `packages/runtime-core/src/runtime-model.ts:57`. v0 retains the readonly graph reference rather than deep-freezing or compiling topology; this is acceptable for Domain A shell and remains a Domain B/C design risk. |
| Runtime instance is mutable and target-local by design | Pass | Each `createInstance()` returns a new `CompatibleRuntimeModelInstance`; instance state is private and advances per frame. See `packages/runtime-core/src/runtime-model.ts:73`, `packages/runtime-core/src/runtime-model.ts:84`, and `packages/runtime-core/src/runtime-model.ts:104`. |
| Snapshot output shape is preserved | Pass | Compiled result is tested equal to legacy `evaluateRuntimeFrame`. See `packages/runtime-core/src/runtime-core.test.ts:403` and `packages/runtime-core/src/runtime-core.test.ts:418`. |
| Compiled instance returns fresh snapshot objects across consecutive frames | Pass | Tests assert distinct snapshot and drawable objects. See `packages/runtime-core/src/runtime-core.test.ts:470`. |
| Previously returned snapshots are not mutated by later evaluations | Pass | Test snapshots are serialized before the second frame and compared afterward. See `packages/runtime-core/src/runtime-core.test.ts:457` and `packages/runtime-core/src/runtime-core.test.ts:472`. |
| No behavior changes for dynamics, keyforms, deformers, clipping, variants, or snapshot validation defaults | Pass | Domain A delegates to the existing evaluator path; `snapshotValidation` remains defaulted to `"schema"` at `packages/runtime-core/src/runtime-core.ts:122`. Focused tests and typecheck pass. |
| Domain A did not pull in Domain B/C/D scope | Pass | No static template compilation, rig/deformer topology compilation, Runtime Player integration, or performance optimization was implemented. Changed source files are limited to runtime-core API shell and focused tests. |

## Verification Considered / Run

Read and considered:

- Wave16 plan, Wave15 final integration report, latest `tmp/report.log`, Performance Diagnostics screen doc, wave planning conventions, and Gnome implementation report.
- Changed runtime-core files and relevant package export/dependency-boundary files.

Commands run:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 2 files / 10 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- packages/runtime-core/src discussion/runtime-player/implementation/waves/wave16`
  - Passed with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages/runtime-core/src/runtime-model.ts`
  - No whitespace findings; command returned normal no-index diff status with LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`
  - No whitespace findings; command returned normal no-index diff status with LF-to-CRLF warning only.

`pnpm install` was not run.

## Residual Risks

- Domain A is intentionally an API shell and does not improve the hot path by itself; Browser Source smoothness still depends on Domains B-D and later real-model diagnostics.
- The compiled model currently stores the supplied `NormalizedRuntimeGraph` reference instead of materializing immutable static structures. This is acceptable for Domain A but should be handled carefully when Domains B/C introduce reusable templates or topology.
- Runtime Player target-local instance lifecycle is not implemented in Domain A. Domain D must ensure Native Stage and Browser Source do not share one mutable `RuntimeModelInstance`.
- Snapshot freshness is covered by focused tests for the new shell. Later domains that introduce shared templates or buffers need deeper nested-array and previous-snapshot non-mutation tests.

## Domain B Gate

Domain B may proceed.

Recommended follow-up for Domain B:

- Preserve the legacy-vs-compiled deep-equality test pattern while adding static snapshot/template reuse.
- Add nested output-array non-mutation coverage before sharing any static data or buffers.
- Keep package-format DTO adaptation outside runtime-core.
