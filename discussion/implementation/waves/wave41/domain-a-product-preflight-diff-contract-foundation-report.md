# Wave41 Domain A: Product Preflight Diff Contract Foundation

## Verdict

`done`

## Files Changed

- `packages/contracts/src/product-preflight-report-diff.ts`
- `packages/contracts/src/product-preflight-report-diff.test.ts`
- `packages/contracts/src/index.ts`
- `discussion/implementation/waves/wave41/domain-a-product-preflight-diff-contract-foundation-report.md`

No `packages/validator-core/src/**` changes were required.

## Contract Summary

- Added `ProductPreflightReportDiffDtoSchema` as an additive v0 contract for deterministic comparison of two session-generated Product Preflight report DTOs.
- Added session-report scope metadata with `sessionGeneratedReportsOnly: true` and `persistedArtifactCreated: false`.
- Added category status transition, blocking reason change, diagnostic ref change, evidence ref change, recommended action change, unsupported claim change, and not-evaluated claim change DTOs.
- Report-level `summary.beforeStatus`, `summary.afterStatus`, `summary.beforeHighestSeverity`, and `summary.afterHighestSeverity` are derived from `categoryStatusTransitions` and rejected when contradictory.
- Diff changes are structural `added` / `removed` / `changed` records keyed by deterministic ids or diagnostic keys. They do not include AI judgement, generated repair plans, candidate ranking, or natural-language repair.
- `not_supported` and `not_evaluated` remain explicit neutral statuses in transitions. The contract does not classify them as pass/improvement.
- Added `ProductPreflightRerunAffordanceResponseDtoSchema` for manual or caller-triggered rerun capability. It explicitly records `automaticRerunAllowed: false`, `autoFixAllowed: false`, and `automaticCommitAllowed: false`.

## Review Finding Fix

- Review-Sylph blocking finding: diff summary before/after status and highest severity could contradict `categoryStatusTransitions`.
- Fix: added schema refinement deriving report status from category transitions using Product Preflight status ordering `fail > not_supported > not_evaluated > warn > pass`.
- Fix: added schema refinement deriving highest severity from category transition severities using severity ordering `blocking > error > warning > info`.
- Test coverage: added focused negative tests for mismatched summary before/after status and mismatched summary before/after highest severity.

## Verification

- `pnpm.cmd exec vitest run packages/contracts/src/product-preflight-report-diff.test.ts packages/contracts/src/product-preflight-report.test.ts`: pass, 2 files / 16 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- Scoped `git diff --check` over changed Domain A files: pass; only Git LF/CRLF working-copy warnings.

Verification commands required escalation because sandboxed PowerShell continued to fail with `windows sandbox: spawn setup refresh`.

## Index Classification

- `packages/contracts/src/index.ts`: barrel-only re-export of `./product-preflight-report-diff.js`.
- No implementation logic was added to any `index.ts`.

## Forbidden Scope / Dependency Statement

- No Editor UI, AI command bridge, validator diff engine, persisted/exported Product Preflight artifact, repair generation, auto-fix, automatic commit, parser/image/archive/filesystem/renderer/Cubism work, or release/demo gate implementation was added.
- No dependency manifests or lockfiles were changed.

## Remaining Issues / User Decision Points

- None for Domain A.
- Domain B/C can consume the new contract to implement deterministic diff generation and command/session bridge behavior in their own scoped work.
