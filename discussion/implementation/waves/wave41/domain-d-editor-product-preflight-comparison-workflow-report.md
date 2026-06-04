# Wave41 Domain D: Editor Product Preflight Comparison Workflow

## Verdict

`done`

## Files Changed

- `apps/editor/src/editor-state/product-preflight-comparison-state.ts`
- `apps/editor/src/editor-state/product-preflight-comparison-state.test.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/product-preflight-comparison-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts`
- `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts`
- `apps/editor/src/ui/product-preflight/product-preflight-panel.ts`
- `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `discussion/implementation/waves/wave41/domain-d-editor-product-preflight-comparison-workflow-report.md`

## Implementation Summary

- Added a focused editor-state projection for Product Preflight deterministic report comparison.
- The projection reads Domain A/B/C DTO outputs without redefining the diff contract or diff engine:
  - current / previous / proposal-preview report slots,
  - diff summary rows,
  - category status/severity transitions,
  - evidence ref change rows,
  - diagnostic ref change rows,
  - rerun affordance rows.
- Added a narrow editor-workflow adapter that calls Domain C `createEditorProductPreflightReadDiffBridge` and injects Domain B `buildProductPreflightReportDiff` as the provider.
- Wired the workflow controller to keep session-only current/previous Product Preflight reports in memory and update comparison state after:
  - manual Product Preflight run,
  - Codex proposal review when preview Product Preflight exists.
- Added Product Preflight panel comparison UI in a separate helper file so the existing panel did not become a large catch-all file.
- UI wording uses `Deterministic report comparison`, `session-generated reports`, and `manual rerun`. It avoids LLM-like, repair-generation, persisted/exported artifact, release/demo gate, parser/image/archive/filesystem/renderer/Cubism claims.
- Rerun affordance UI deliberately does not display the raw AI-interface rerun summary because that summary contains a negative `auto-fix` phrase. The UI shows manual rerun availability and automatic rerun/commit safety flags instead.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/product-preflight-comparison-state.test.ts apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.test.ts`: pass, 4 files / 10 tests.
- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts`: pass, 1 file / 24 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui apps/editor/src/editor-workflow apps/editor/src/app discussion/implementation/waves/wave41`: pass; Git emitted LF/CRLF working-copy warnings only.
- Touched `index.ts` check: `apps/editor/src/editor-state/index.ts` remains barrel-only. `apps/editor/src/editor-workflow/index.ts` was already modified by Domain C and remains barrel-only.
- UI truthfulness / forbidden-claim scan over touched Domain D files: pass. Hits were existing portable export/persisted hash identifiers, negative `automatic commit disabled` wording, and tests asserting `auto-fix` is absent.

Verification commands required escalation because sandboxed PowerShell command spawning continued to fail with `windows sandbox: spawn setup refresh`.

## Source Organization

- `product-preflight-comparison-state.ts`: 334 lines; single responsibility state projection for report comparison UI rows.
- `product-preflight-comparison-section.ts`: 230 lines; single responsibility DOM rendering for comparison UI.
- `product-preflight-comparison-workflow.ts`: 61 lines; narrow bridge/provider adapter.
- No implementation logic was added to `index.ts`.

## Remaining Issues / User Decision Points

- None for Domain D.
- Product Preflight comparison remains session-only UI state and does not create persisted/exported report artifacts.
- The workflow preserves previous report history only in controller memory; package load/import/reset/tutorial package creation clears that history.

## Observed Parallel Worktree Changes

Unrelated parallel Wave41 changes were present under Domain A/B/C and Domain E areas, including `packages/**`, `fixtures/contracts/**`, `discussion/tests/**`, and existing Wave41 reports/reviews. They were not reverted or edited by Domain D except for this Domain D report.
