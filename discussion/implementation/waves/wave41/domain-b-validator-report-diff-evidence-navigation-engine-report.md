# Wave41 Domain B: Validator Report Diff Evidence Navigation Engine

## Verdict

`done`

## Files Changed

- `packages/validator-core/src/product-preflight-report-diff.ts`
- `packages/validator-core/src/product-preflight-report-diff-changes.ts`
- `packages/validator-core/src/product-preflight-report-diff.test.ts`
- `packages/validator-core/src/index.ts`
- `discussion/implementation/waves/wave41/domain-b-validator-report-diff-evidence-navigation-engine-report.md`

## Implementation Summary

- Added `buildProductPreflightReportDiff` in validator-core.
- The builder validates both input reports with `ProductPreflightReportDtoSchema`, requires the same `packageId`, and returns `ProductPreflightReportDiffDtoSchema.parse(...)`.
- Diff output is deterministic:
  - generated diff ids use `preflightDiff_<beforeReportId>_<afterReportId>` when no id is supplied,
  - generated time defaults to the after report `createdAt` rather than current wall-clock time,
  - category transitions follow `PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS`,
  - item changes are sorted by stable ids or diagnostic keys.
- Returned report/category transition and change surfaces include:
  - report-level before/after status and severity summary,
  - all category status/severity transitions,
  - blocking reason added/removed/changed changes,
  - diagnostic ref added/removed/changed changes with explicit diagnostic keys,
  - evidence ref added/removed/changed changes with explicit before/after refs,
  - recommended action added/removed/changed changes,
  - unsupported claim added/removed/changed changes,
  - not-evaluated claim added/removed/changed changes.
- Unsupported, not-evaluated, and manual-required cases are not classified as improvements and no repair actions are generated. The diff engine only compares actions already present in the reports.
- Split collection/change diffing into `product-preflight-report-diff-changes.ts` so the public builder file stays focused. `index.ts` remains barrel-only.

## Verification

- `pnpm.cmd exec vitest run packages/validator-core/src/product-preflight-report-diff.test.ts`: pass, 1 file / 6 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src/product-preflight-report-diff.test.ts packages/validator-core/src/product-preflight-report.test.ts`: pass, 2 files / 13 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/validator-core/src/product-preflight-report-diff.ts packages/validator-core/src/product-preflight-report-diff-changes.ts packages/validator-core/src/product-preflight-report-diff.test.ts packages/validator-core/src/index.ts discussion/implementation/waves/wave41`: pass, with only Git's LF/CRLF working-copy warning for `packages/validator-core/src/index.ts`.
- Trailing whitespace scan over the new validator-core files: pass.
- `packages/validator-core/src/index.ts` final check: barrel-only re-export.

Verification commands required escalation because sandboxed PowerShell continued to fail with `windows sandbox: spawn setup refresh`.

## Source Organization

- `product-preflight-report-diff.ts`: public builder, report-scope validation, category transition construction, summary derivation, generated diff id.
- `product-preflight-report-diff-changes.ts`: deterministic indexed collection comparison and change record generation.
- `product-preflight-report-diff.test.ts`: focused validator-core Product Preflight diff coverage.
- No implementation logic was added to `index.ts`.

Line counts after split:

- `product-preflight-report-diff.ts`: 234 lines.
- `product-preflight-report-diff-changes.ts`: 507 lines.
- `product-preflight-report-diff.test.ts`: 543 lines.

## Remaining Issues / User Decision Points

- None for Domain B.
- The diff contract has a single `scope.packageId`, so validator-core rejects report pairs with different package ids instead of inventing cross-package semantics.

## Intentionally Not Touched

- `packages/contracts/src/**`: Domain A owns the contract and was already pass.
- `packages/ai-interface/src/**`: Domain C owns AI command implementation.
- `apps/editor/src/**`: Domain C / later editor domains own editor-session and UI wiring.
- No manifests, lockfiles, parser/image/archive/renderer/Cubism work, persisted/exported Product Preflight artifacts, release/demo gates, repair candidate generation, LLM, natural-language repair, auto-fix, or automatic commit behavior were added.

## Observed Unrelated Worktree Changes

`git status --short -uall` also showed existing/unrelated changes under:

- `apps/editor/src/editor-workflow/**`
- `packages/ai-interface/src/**`
- `packages/contracts/src/**`
- Wave41 planning/review artifacts from Domain A
- implementation maps/backlog

These were left untouched except for the allowed Domain B files listed above.
