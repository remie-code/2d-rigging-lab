# Wave 13 Domain A Completion: Runtime Diff Contract And Comparison Semantics

> Wave: `runtime-diff-and-grid2d-evidence-hardening`
> Domain: `wave13-runtime-diff-contract-and-comparison-semantics`
> Verdict: `pass`

## Scope Changed

- Added dedicated runtime diff contract fields for drawable runtime state changes and drawList changes.
- Updated snapshot comparison semantics to populate those fields.
- Preserved existing compatibility signals for current runtime-diff-v1 consumers.
- Added focused contract/runtime-core tests.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave13-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave12/wave12-final-report.md`
- `discussion/implementation/waves/wave12/integration-review.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Implementation Summary

- `RuntimeDiffSchema` keeps `schemaVersion: "runtime-diff-v1"` and adds defaulted arrays:
  - `drawableRuntimeStateChanges`
  - `drawListChanges`
- `drawableRuntimeStateChanges` records before/after values for opacity, visible, baseDrawOrder, and evaluatedDrawOrder.
- `drawListChanges` records before/after drawList arrays, membership/order flags, and deterministic position changes.
- `compareRuntimeSnapshots` now emits those dedicated fields.
- Backward compatibility is preserved:
  - runtime-state-only drawable changes still produce a `drawableChanges` entry.
  - drawList changes still produce the existing `/drawList` `parameterChanges` entry.
- Existing mesh bounds / vertexHash behavior remains covered and unchanged.

## Orchestration Summary

- Gnome implementation worker was delegated the bounded contract/comparison implementation.
- Gnome returned `needs_fix` because verification was not run and drawList compatibility still needed integration.
- Orch-Sylph integrated the compatibility fix, added focused tests, ran verification, and fixed one typecheck-only test issue.
- Review-Sylph performed a clean read-only review using basis docs, changed files, diff, and verification summary.
- Review-Sylph verdict: `pass`.

## Review Findings And Resolution

- Gnome finding: drawList had moved out of `parameterChanges`, risking existing consumer/test compatibility.
  - Resolution: restored `/drawList` `parameterChanges` while keeping dedicated `drawListChanges`.
- Gnome finding: focused tests and typecheck had not been run.
  - Resolution: ran focused Vitest and `pnpm.cmd typecheck`; both passed after one test type fix.
- Review-Sylph finding: non-blocking fixture strictness note in `runtime-keyform-contract-fixture.test.ts`.
  - Resolution: left as documented because Domain A did not edit fixture JSON; dedicated new fields are asserted separately.

## Files Changed

- `packages/contracts/src/runtime-diff.ts`
- `packages/contracts/src/diff-envelopes.test.ts`
- `packages/contracts/src/contracts-integration.test.ts`
- `packages/contracts/src/runtime-diff.test.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/snapshot-comparison.test.ts`
- `packages/runtime-core/src/snapshot-keyform-integration.test.ts`
- `packages/runtime-core/src/runtime-keyform-contract-fixture.test.ts`
- `discussion/implementation/reviews/wave13/wave13-runtime-diff-contract-and-comparison-semantics-review.md`
- `discussion/implementation/waves/wave13/wave13-runtime-diff-contract-and-comparison-semantics-completion.md`

## Verification Performed

Focused Vitest:

```powershell
pnpm.cmd exec vitest run packages/contracts/src/diff-envelopes.test.ts packages/contracts/src/runtime-diff.test.ts packages/contracts/src/contracts-integration.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/snapshot-keyform-integration.test.ts packages/runtime-core/src/runtime-keyform-contract-fixture.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/runtime-evidence-artifacts.test.ts
```

Outcome: initial sandbox run failed with `EPERM` opening `node_modules/.pnpm/vitest.../vitest.mjs`; escalated rerun passed. Final rerun passed: 8 test files, 24 tests.

Typecheck:

```powershell
pnpm.cmd typecheck
```

Outcome: initial sandbox run failed with `EPERM` opening `node_modules/.pnpm/typescript.../tsc`; escalated rerun first found `TS2345` in a test expectation, fixed locally; escalated rerun passed.

Tracked diff whitespace:

```powershell
git diff --check -- packages\contracts\src\runtime-diff.ts packages\contracts\src\diff-envelopes.test.ts packages\contracts\src\contracts-integration.test.ts packages\runtime-core\src\snapshot-comparison.ts packages\runtime-core\src\snapshot-comparison.test.ts packages\runtime-core\src\snapshot-keyform-integration.test.ts packages\runtime-core\src\runtime-keyform-contract-fixture.test.ts discussion\implementation\reviews\wave13\wave13-runtime-diff-contract-and-comparison-semantics-review.md discussion\implementation\waves\wave13\wave13-runtime-diff-contract-and-comparison-semantics-completion.md
```

Outcome: passed; only CRLF working-copy warnings.

Domain A untracked files whitespace:

```powershell
$files = @('packages\contracts\src\runtime-diff.test.ts','discussion\implementation\reviews\wave13\wave13-runtime-diff-contract-and-comparison-semantics-review.md','discussion\implementation\waves\wave13\wave13-runtime-diff-contract-and-comparison-semantics-completion.md'); $errors = @(); foreach ($file in $files) { $output = @(git diff --check --no-index -- NUL $file 2>&1); $bad = @($output | Where-Object { $_ -match ':\d+: (trailing whitespace|space before tab)' }); if ($bad.Count -gt 0) { $errors += "[$file]"; $errors += $bad } }; if ($errors.Count -gt 0) { $errors; exit 1 } else { "No whitespace errors in Domain A untracked files." }
```

Outcome: passed for the untracked new test and report files.

## Remaining Issues

- No blocking Domain A issues.
- Non-blocking: Wave 12 fixture JSON was not updated in this domain; the fixture test uses `toMatchObject` for the old stored runtime comparison while separately asserting the new default fields.

## User-Decision Points

- None.

## Provisional Assumptions

- Adding defaulted fields to `runtime-diff-v1` is sufficient backward compatibility and does not require a schema version bump.
- Existing consumers may still rely on `drawableChanges` and `/drawList` `parameterChanges`, so those coarse compatibility signals remain.
- Runtime drawList entries are unique drawable IDs as emitted by runtime snapshots.
