# Wave 12 Domain D Review: Runtime Snapshot Keyform Integration

> Wave: `runtime-keyform-evaluation-foundation`
> Domain: `wave12-runtime-snapshot-keyform-integration`
> Reviewer: Review-Sylph
> Verdict: `pass`

## Scope Reviewed

- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/snapshot-keyform-integration.test.ts`
- `packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts`
- `packages/runtime-core/src/snapshot-comparison.test.ts`

Dependency shapes reviewed:

- `packages/runtime-core/src/keyform-sampling.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/keyform-evaluation-types.ts`
- `packages/runtime-core/src/drawable-geometry.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/contracts/src/runtime-diff.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave12-plan.md`
- `discussion/implementation/waves/wave12/wave12-runtime-keyform-binding-identity-and-parameter-resolution-completion.md`
- `discussion/implementation/waves/wave12/wave12-runtime-keyform-sampling-foundation-completion.md`
- `discussion/implementation/waves/wave12/wave12-runtime-keyform-target-application-completion.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings

| Severity | Finding | Resolution |
|---|---|---|
| Non-blocking | Snapshot integration directly tested application diagnostics but did not directly test sampling diagnostics flowing through `createRuntimeSnapshot`. Sampling diagnostics were covered at module level and implementation accumulated them, so this was not blocking. | Added `runtime-keyform-snapshot-integration.test.ts` coverage for a missing target sampling diagnostic flowing through `evaluateRuntimeFrame` / snapshot output. |

No blocking or needs-change findings remained.

## Design / Development Compliance

- Pass.
- `evaluateRuntimeFrame` reaches `createRuntimeSnapshot`; snapshot creation integrates parameter resolution, keyform sampling, target patch application, sample output, accumulated diagnostics, and trace phases.
- Keyform sample ordering preserves `compositionOrder` and original binding order.
- Runtime snapshot comparison observes mesh bounds/hash changes and runtime-visible drawable state changes.
- `index.ts` remains barrel-only and unchanged.
- No Domain B/C module rewrite was needed.
- No out-of-scope source changes were introduced by Domain D.

## Test Adequacy

- Pass.
- Tests cover:
  - successful mesh keyform sampling and application,
  - keyform sample metadata,
  - trace phase visibility,
  - keyform-less snapshot behavior,
  - sampling and application diagnostic accumulation,
  - mesh diff observation,
  - opacity / visibility / draw order / drawList comparison behavior,
  - broad runtime-core regression coverage.

## Verification Reviewed

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/snapshot-keyform-integration.test.ts packages/runtime-core/src/snapshot-comparison.test.ts` | Passed, 3 files / 7 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | Passed, 15 files / 38 tests |
| `pnpm.cmd typecheck` | Passed |
| `git diff --check -- packages\runtime-core\src\snapshot.ts packages\runtime-core\src\snapshot-comparison.ts packages\runtime-core\src\runtime-keyform-snapshot-integration.test.ts packages\runtime-core\src\snapshot-comparison.test.ts packages\runtime-core\src\snapshot-keyform-integration.test.ts` | Passed; emitted only CRLF working-copy warnings |

## Remaining Issues

- Runtime diff represents drawList changes through the existing `parameterChanges` field because `RuntimeDiffSchema` has no dedicated drawList field. This is semantically coarse but avoids an out-of-scope contracts change.

## User-Decision Points

- None.

## Provisional Assumptions

- Coarse runtime-visible drawable diff signaling is acceptable for the Wave 12 foundation.
- A dedicated runtime diff contract expansion for drawList / opacity / visibility / draw order can be considered in a later contract wave.
