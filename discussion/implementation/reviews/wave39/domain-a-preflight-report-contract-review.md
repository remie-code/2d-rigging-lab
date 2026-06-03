# Wave39 Domain A Review Notes

## Scope Reviewed

- `packages/contracts/src/product-preflight-report.ts`
- `packages/contracts/src/product-preflight-report.test.ts`
- `packages/contracts/src/index.ts`
- `discussion/design/module-contracts/validator-contract.md`
- Relevant Wave39 plan and source/schema/dependency conventions

## Review Loop

### Initial Clean Review

- Verdict: `needs_changes`
- Reviewer: Review-Sylph clean context
- Findings:
  - Generated evidence artifact refs accepted overly broad `generated/<kind>/*.json`
    paths where accepted suffix conventions already existed.
  - Tests covered unsupported claim masquerade rejection but did not mirror the
    not-evaluated masquerade path.

### Fix Loop 1

- Implementer: Gnome
- Files changed:
  - `packages/contracts/src/product-preflight-report.ts`
  - `packages/contracts/src/product-preflight-report.test.ts`
- Fixes:
  - Narrowed `guiEvidence` refs to `generated/gui-evidence/*.gui-evidence.json`.
  - Narrowed `demoSafePreflight` refs to
    `generated/demo-safe/*.demo-safe-preflight.json`.
  - Added focused suffix acceptance/rejection tests.
  - Added not-evaluated masquerade rejection coverage.

### Clean Re-review

- Verdict: `pass`
- Reviewer: Review-Sylph clean context
- Findings: none
- Confirmed:
  - Prior findings are closed.
  - Domain A contract criteria are met.
  - `index.ts` remains barrel-only.
  - No dependency manifest or lockfile changes were introduced.
  - No forbidden scope or non-goal implementation was observed.

## Verification Recorded

- `pnpm.cmd exec vitest run packages/contracts/src/product-preflight-report.test.ts`: pass, 8 tests
- `pnpm.cmd typecheck`: pass
- `pnpm.cmd run check:source`: pass

The same verification set was rerun by Orch-Sylph after persistent report
creation and remained passing.

## User-Decision Points

- None.
