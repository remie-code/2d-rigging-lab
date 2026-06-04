# Wave41 Domain C: AI / Editor Session Preflight Read-Diff Bridge

## Verdict

`done`

## Files Changed

- `packages/ai-interface/src/ai-product-preflight-command.ts`
- `packages/ai-interface/src/ai-product-preflight-command.test.ts`
- `packages/ai-interface/src/index.ts`
- `apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.ts`
- `apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.test.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `discussion/implementation/waves/wave41/domain-c-ai-editor-session-preflight-read-diff-bridge-report.md`

No `apps/editor/src/editor-session/**` edits were required. The narrow bridge lives in `editor-workflow` because it consumes current/previous workflow reports and Codex proposal preview rerun results.

## Implementation Summary

- Added a standalone AI Product Preflight command surface for:
  - `readProductPreflightReport`
  - `diffProductPreflightReports`
  - `getProductPreflightRerunAffordance`
- Kept the new Product Preflight commands out of legacy `AiCommandNameSchema` / `AiCommandRequestSchema`.
- Reused `observeProductPreflightReport` for deterministic read output.
- Wrapped Domain A `ProductPreflightReportDiffDtoSchema` through an injected `ProductPreflightReportDiffProvider`; no diff engine was implemented in Domain C.
- Added deterministic rerun affordance helper output with:
  - `sessionGeneratedReportOnly: true`
  - `persistedArtifactCreated: false`
  - `automaticRerunAllowed: false`
  - `autoFixAllowed: false`
  - `automaticCommitAllowed: false`
- Added an Editor workflow bridge that reads current, previous, and proposal-preview rerun Product Preflight reports, then compares:
  - previous -> current
  - current -> proposal preview
- The Editor bridge only calls the injected diff provider and parses the resulting Domain A diff DTO.

## Verification

- `pnpm.cmd exec vitest run packages/ai-interface/src/ai-product-preflight-command.test.ts apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.test.ts`: pass, 2 files / 5 tests.
- `pnpm.cmd exec vitest run packages/ai-interface/src/ai-product-preflight-command.test.ts packages/ai-interface/src/ai-product-preflight-observation.test.ts packages/ai-interface/src/ai-codex-proposal-command.test.ts apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.test.ts apps/editor/src/editor-workflow/product-preflight-workflow.test.ts apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts`: pass, 6 files / 15 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/ai-interface/src/index.ts apps/editor/src/editor-workflow/index.ts`: pass with Git LF/CRLF working-copy warnings only.
- Trailing whitespace scan over touched Domain C source/test/barrel files: no matches.

Verification commands required escalation because sandboxed PowerShell initially failed with `windows sandbox: spawn setup refresh`.

## Index / Source Organization

- `packages/ai-interface/src/index.ts`: barrel-only; one re-export added.
- `apps/editor/src/editor-workflow/index.ts`: barrel-only; one re-export added.
- New source files are named by responsibility:
  - AI command schema/helper surface: 305 lines.
  - Editor workflow read/diff bridge: 169 lines.
- No catch-all source file or `index.ts` implementation logic was added.

## Forbidden-Scope Statement

- Did not edit `packages/validator-core/src/**`; Domain B owns the Product Preflight diff engine.
- Did not add Editor UI.
- Did not implement a Product Preflight diff algorithm in production Domain C code.
- Did not persist or export Product Preflight reports.
- Did not add release/demo gates.
- Did not add repo-side proposal generation, repair generation, candidate ranking, LLM/provider/prompt work, natural-language repair, auto-fix, automatic rerun, or automatic commit.
- Did not add external transport adapters, dependencies, package manifest changes, lockfile changes, parser/image/archive/filesystem/renderer/Cubism work, or broad contract redesign.

## Remaining Issues / User Decision Points

- None for Domain C.
- Provisional integration assumption: Domain B or a later integration domain will provide a `ProductPreflightReportDiffProvider` adapter backed by the validator diff engine.
