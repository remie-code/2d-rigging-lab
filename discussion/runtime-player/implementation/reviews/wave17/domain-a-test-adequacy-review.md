# Wave17 Domain A Test Adequacy Review

- Verdict: pass
- Review lane: test adequacy
- Date: 2026-06-26

## Reviewed Basis And Files

Basis documents:

- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

Reviewed diffs/files:

- `git diff -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/dependency-boundary.test.ts`
- `packages/runtime-core/src/snapshot-static-templates.test.ts`

## Findings

No findings.

The test additions are adequate for Domain A's intended boundary: an additive runtime-core render frame API and preservation of public snapshot compatibility. The implementation currently derives render frames via full snapshot evaluation; the tests do not claim fast-path materialization avoidance, which is correctly left to Domain B.

## Test Adequacy Checklist

- pass - API exists and can evaluate a deterministic graph: `runtime-core.test.ts:422` calls `compileRuntimeModel(...).createInstance().evaluateRenderFrame(...)` and asserts the method exists plus deterministic output values.
- pass - Render frame output includes renderer dynamic fields: `runtime-core.test.ts:422` asserts drawable id, stable index, vertices, opacity, draw order, and visibility for two drawables, including keyform-driven opacity and draw order.
- pass - Existing public snapshot tests still pass: `runtime-core.test.ts` remains passing, and reviewer also reran `snapshot-static-templates.test.ts`, including legacy full snapshot equality and nested freshness checks at `snapshot-static-templates.test.ts:22` and `snapshot-static-templates.test.ts:85`.
- pass - `evaluateFrame(...)` / `evaluateRuntimeFrame(...)` compatibility remains covered: `runtime-core.test.ts:369` deep-equals compiled `evaluateFrame(...)` against legacy `evaluateRuntimeFrame(...)`; existing runtime-core tests also cover public result shape, sequence evaluation, profiling, and validation behavior.
- pass - Render frame API does not mutate a previously returned public snapshot: `runtime-core.test.ts:575` captures a full public snapshot, evaluates a render frame on the same instance, and verifies the prior snapshot is unchanged and vertices are not the same array.
- pass - Boundary test covers no package-format imports: `dependency-boundary.test.ts:8` scans runtime-core source for forbidden downstream/sibling implementation imports including `package-format`; direct `rg` found no production package-format imports.
- pass - Typecheck was run: reviewer reran `pnpm.cmd typecheck`, and it passed.
- pass - Coverage is focused for Domain A and leaves Domain B to later: tests cover API shape, deterministic renderer fields, compatibility, public snapshot isolation, and dependency boundary. They intentionally do not prove public snapshot bypass, render/public parity across all deformers/dynamics/clipping/variants, or fast-path counters.

## Verification Considered / Run

Considered Gnome evidence:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Initial sandbox attempt failed with `spawn EPERM`.
  - Escalated rerun passed: 2 files / 12 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
  - Passed with CRLF working-copy warnings only.

Reviewer-ran verification:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 2 files / 12 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/snapshot-static-templates.test.ts`
  - Passed: 1 file / 2 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
  - No whitespace findings; CRLF working-copy warnings only.

## Residual Risks / Domain B Notes

- Domain A tests do not prove render frame evaluation avoids public snapshot DTO materialization. Current implementation still routes through `evaluateFrame(...snapshotDetail: "full")`; Domain B must add and test the actual fast output internals.
- Domain A tests do not establish full render/public parity for dynamics, deformers, clipping, variants, or nested warp/rest-bind behavior. Those are Domain B parity and preservation responsibilities.
- Domain A tests do not cover reusable mutable output buffers or previous render frame output stability across later render frame evaluations. That is acceptable for this API-shell domain and should be revisited if Domain B introduces reusable output.
