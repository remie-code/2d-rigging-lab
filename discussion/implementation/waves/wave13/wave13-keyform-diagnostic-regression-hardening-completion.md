# Wave 13 Domain B Completion: Keyform Diagnostic Regression Hardening

> Wave: `runtime-diff-and-grid2d-evidence-hardening`
> Domain: `wave13-keyform-diagnostic-regression-hardening`
> Verdict: `pass`

## Historical Escalation Note

The prior Domain B `escalate` result is superseded.

`wave13-diagnostic-policy-alignment` recorded the accepted basis that `keyform.grid2dDuplicateKey` severity is `error`, while strict and acceptance profile behavior still fails. The older unresolved severity wording remains historical pre-resolution context only.

## Scope Changed

- Added direct regression coverage in:
  - `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts`
  - `packages/runtime-core/src/keyform-grid2d-interpolation.test.ts`
  - `packages/runtime-core/src/keyform-sampling.test.ts`
- Updated this completion report.
- Updated the clean review artifact at `discussion/implementation/reviews/wave13/wave13-keyform-diagnostic-regression-hardening-review.md`.

No production runtime-core files were changed.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave13-plan.md`
- `discussion/implementation/waves/wave13/wave13-diagnostic-policy-alignment-completion.md`
- `discussion/implementation/reviews/wave13/wave13-diagnostic-policy-alignment-review.md`
- `discussion/implementation/waves/wave13/wave13-keyform-diagnostic-regression-hardening-completion.md` historical pre-resolution artifact
- `discussion/implementation/reviews/wave13/wave13-keyform-diagnostic-regression-hardening-review.md` historical pre-resolution artifact
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `packages/runtime-core/src/keyform-sampling.ts`
- `packages/runtime-core/src/keyform-sampling.test.ts`
- `packages/runtime-core/src/keyform-grid2d-interpolation.ts`
- `packages/runtime-core/src/keyform-grid2d-interpolation.test.ts`
- `packages/runtime-core/src/keyform-linear1d-interpolation.ts`
- `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`

## Implementation Summary

Gnome implementation was delegated and returned `pass`.

The implementation is tests-only and adds regression coverage for:

- duplicate linear key reporting with deterministic first-key sampling;
- duplicate Grid2D coordinate reporting with deterministic first-coordinate sampling;
- sampling-level duplicate diagnostics with stable `checkId`, severity, phase, target, and evidence;
- missing Grid2D parameter diagnostics with parameter/value presence evidence;
- unsupported evaluator diagnostics so unknown evaluators are not silently ignored;
- unsupported patch shape diagnostics so unsupported patches are not silently ignored;
- Grid2D key-range clamp diagnostics as distinct from missing surrounding key diagnostics.

`keyform.grid2dDuplicateKey` is asserted with canonical severity `error`.

## Review Findings And Resolution

Clean Review-Sylph was delegated after implementation and returned `pass`.

Design / Development Compliance: `pass`.

- No blocking findings.
- Diff is limited to allowed runtime-core test files.
- No runtime diff, evidence, editor, validator, package metadata, or unrelated docs were edited.
- `keyform.grid2dDuplicateKey` expectations match the aligned severity basis: `error`.
- Unsupported evaluator and unsupported patch shape are covered as emitted diagnostics.
- Grid2D key-range clamp and missing surrounding key behavior are distinguishable.
- `packages/runtime-core/src/index.ts` remains barrel-only.

Test Adequacy: `pass`.

- Direct coverage exists for duplicate linear key, duplicate Grid2D coordinate, missing parameter, unsupported evaluator, unsupported patch shape, Grid2D key-range clamp, and missing surrounding key behavior.
- Assertions cover `checkId`, severity, phase, target, and evidence where practical.
- Non-blocking note: grid-specific unsupported patch shape is not isolated separately, but unsupported patch diagnostics are directly covered through the linear sampling path and shared interpolation problem handling.

No review findings required code changes.

## Files Changed

- `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts`
- `packages/runtime-core/src/keyform-grid2d-interpolation.test.ts`
- `packages/runtime-core/src/keyform-sampling.test.ts`
- `discussion/implementation/waves/wave13/wave13-keyform-diagnostic-regression-hardening-completion.md`
- `discussion/implementation/reviews/wave13/wave13-keyform-diagnostic-regression-hardening-review.md`

## Verification Performed

| Command | Outcome |
| --- | --- |
| `pnpm.cmd exec vitest run packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/keyform-grid2d-interpolation.test.ts packages/runtime-core/src/keyform-sampling.test.ts` | Sandbox run failed with `EPERM` opening `node_modules/.../vitest.mjs`; escalated rerun passed, 3 files / 17 tests. |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | Escalated run passed, 16 files / 49 tests. |
| `pnpm.cmd typecheck` | Escalated run passed. |
| `git diff --check -- packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/keyform-grid2d-interpolation.test.ts packages/runtime-core/src/keyform-sampling.test.ts discussion/implementation/waves/wave13/wave13-keyform-diagnostic-regression-hardening-completion.md discussion/implementation/reviews/wave13/wave13-keyform-diagnostic-regression-hardening-review.md` | Passed with LF/CRLF working-copy warnings only. |

## Remaining Issues

- None for Domain B.

## User-Decision Points

- None.

## Provisional Assumptions

- Linear duplicate key remains a warning under current runtime behavior.
- Unsupported patch shape remains a warning while still being emitted as a diagnostic.
- Non-target changed files currently in the worktree belong to Domain A or alignment work and remain outside this Domain B gate.
