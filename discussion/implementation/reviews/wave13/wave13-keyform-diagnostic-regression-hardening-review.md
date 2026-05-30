# Wave 13 Domain B Review: Keyform Diagnostic Regression Hardening

> Wave: `runtime-diff-and-grid2d-evidence-hardening`
> Domain: `wave13-keyform-diagnostic-regression-hardening`
> Review verdict: `pass`

## Historical Escalation Note

The previous `escalate` review was based on a then-unresolved `keyform.grid2dDuplicateKey` severity conflict.

`wave13-diagnostic-policy-alignment` superseded that conflict by recording canonical severity `error`, while preserving strict and acceptance failure behavior. This review uses that aligned basis.

## Scope Reviewed

- `packages/runtime-core/src/keyform-sampling.test.ts`
- `packages/runtime-core/src/keyform-grid2d-interpolation.test.ts`
- `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts`
- Reference source:
  - `packages/runtime-core/src/keyform-sampling.ts`
  - `packages/runtime-core/src/keyform-grid2d-interpolation.ts`
  - `packages/runtime-core/src/keyform-linear1d-interpolation.ts`
  - `packages/runtime-core/src/normalized-runtime-graph.ts`
  - `packages/runtime-core/src/index.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave13-plan.md`
- `discussion/implementation/waves/wave13/wave13-diagnostic-policy-alignment-completion.md`
- `discussion/implementation/reviews/wave13/wave13-diagnostic-policy-alignment-review.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Design / Development Compliance

Verdict: `pass`.

Findings:

- No blocking findings.
- Domain B diff is limited to allowed runtime-core test files.
- Broader workspace changes exist, but they were treated as Domain A/alignment artifacts per the accepted basis.
- `keyform.grid2dDuplicateKey` expectations match the aligned policy: check ID `keyform.grid2dDuplicateKey`, severity `error`, target kind `keyformSet`, and stable coordinate evidence.
- Unsupported evaluator and unsupported patch shape are covered as emitted diagnostics rather than silent ignores.
- Grid2D key-range clamp and missing surrounding key behavior are distinguishable in both interpolation and sampling-level tests.
- `packages/runtime-core/src/index.ts` remains barrel-only.

## Test Adequacy

Verdict: `pass`.

Findings:

- Direct coverage exists for duplicate linear key, duplicate Grid2D coordinate, missing parameter, unsupported evaluator, unsupported patch shape, Grid2D key-range clamp, and missing surrounding key behavior.
- Assertions cover `checkId`, severity, phase, target, and evidence where practical.
- Non-blocking note: grid-specific unsupported patch shape is not isolated separately, but unsupported patch diagnostics are directly covered through the linear sampling path and shared interpolation problem handling.

## Verification Reviewed

| Command | Outcome |
| --- | --- |
| `pnpm.cmd exec vitest run packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/keyform-grid2d-interpolation.test.ts packages/runtime-core/src/keyform-sampling.test.ts` | Passed after sandbox EPERM rerun outside sandbox, 3 files / 17 tests. |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | Passed, 16 files / 49 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `git diff --check -- packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/keyform-grid2d-interpolation.test.ts packages/runtime-core/src/keyform-sampling.test.ts discussion/implementation/waves/wave13/wave13-keyform-diagnostic-regression-hardening-completion.md discussion/implementation/reviews/wave13/wave13-keyform-diagnostic-regression-hardening-review.md` | Passed with LF/CRLF working-copy warnings only. |

## Remaining Issues

- None blocking.

## User-Decision Points

- None.

## Provisional Assumptions

- Linear duplicate key remains a warning under current runtime behavior.
- Unsupported patch shape remains a warning while still being emitted as a diagnostic.
- Non-target changed files currently in the worktree belong to accepted Domain A/alignment work and are outside this Domain B review gate.
