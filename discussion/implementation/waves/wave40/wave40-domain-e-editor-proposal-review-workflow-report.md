# Wave40 Domain E: Editor Proposal Review Workflow

## Verdict

- Implementation verdict: `implemented`
- Date: 2026-06-04
- Domain: `wave40-editor-proposal-review-workflow`

## Scope Implemented

- Added Editor state projection for Codex proposal review:
  - proposal metadata and operation sequence,
  - proposal validation result and issues,
  - diff preview status and preview-only safety label,
  - rerun validation / Product Preflight summary,
  - approval request / approval / manual commit eligibility.
- Added Editor workflow wiring for pasted Codex proposal JSON:
  - parses a Codex-submitted proposal,
  - runs existing Product Preflight for current editor state,
  - calls existing Domain B proposal validation,
  - calls existing Domain C diff preview helper, including blocked previews,
  - runs preview-scoped Product Preflight for ready diff preview sessions,
  - calls existing Domain C rerun validation with preview-scoped validation report and Product Preflight evidence,
  - calls existing Domain D approval lifecycle only through explicit request / record approval / commit methods.
- Added Editor Product Preflight evidence completion needed for proposal review:
  - supplies byte-availability evidence when a package has no binary asset refs,
  - supplies tutorial-readiness evidence by using the existing tutorial readiness validation report.
- Added a full-width `Codex Proposal Review` panel in the Editor app shell, placed after Product Preflight and before AI Approval / Transcript.
- Reused existing panel CSS classes because `apps/editor/src/styles/**` was outside the delegated write scope.

## Review Fix Summary

- Review finding 1, high: fixed. Ready diff previews now run Product Preflight against `preview.previewSession`, and `createCodexProposalRerunValidationResult()` receives the preview validation report plus preview Product Preflight report. A focused workflow test now proves review -> valid validation/preflight -> ready diff -> pass rerun validation -> request approval -> record approval -> approved commit.
- Review finding 2, medium: fixed. `commitApprovedCodexProposalReview()` keeps the pre-commit review DTO snapshot and uses it to project the final committed approval response after shared commit projection clears stale preview state.
- The positive workflow test proves package revision does not advance during review, approval request, or approval recording, and advances only after the explicit approved commit action. It also checks `automaticCommitAllowed === false` throughout.

## Files Changed

- `apps/editor/src/editor-state/codex-proposal-review-state.ts`
- `apps/editor/src/editor-state/codex-proposal-review-state.test.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts` (barrel-only export)
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts`
- `apps/editor/src/editor-workflow/codex-proposal-preview-preflight.ts`
- `apps/editor/src/editor-workflow/product-preflight-workflow.ts`
- `apps/editor/src/editor-workflow/product-preflight-workflow.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/index.ts` (barrel-only export)
- `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts`
- `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.test.ts`
- `apps/editor/src/ui/codex-proposal-review/index.ts` (barrel-only export)
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/app/editor-app.ts`
- `discussion/implementation/waves/wave40/wave40-domain-e-editor-proposal-review-workflow-report.md`

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/product-preflight-workflow.test.ts apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts apps/editor/src/editor-state/codex-proposal-review-state.test.ts apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`: pass, 5 files / 33 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui apps/editor/src/app apps/editor/src/editor-workflow discussion/implementation/waves/wave40`: pass; Git emitted LF-to-CRLF working-copy warnings only.
- Barrel-only check:
  - `apps/editor/src/editor-state/index.ts`: export-only.
  - `apps/editor/src/editor-workflow/index.ts`: export-only.
  - `apps/editor/src/ui/codex-proposal-review/index.ts`: export-only.
- Forbidden-claim scan over touched Editor files found only `automatic commit disabled` status text and negative `auto-fix` test assertions.

## Boundary Notes

- The UI accepts pasted Codex proposal JSON for review. It does not create, rank, or generate proposal candidates.
- Commit-related UI is split into explicit request approval, record approval, and commit approved proposal actions. Automatic commit remains disabled.
- The workflow preserves blocked / not-evaluated states instead of converting them into repair actions.
- Product Preflight changes are limited to Editor workflow evidence assembly. No proposal validation engine, diff engine, Product Preflight engine package, parser, image decode, archive/filesystem, renderer, pixel oracle, Cubism behavior, external transport, dependency, manifest, or lockfile work was added.

## Residual Risks

- The browser sample Product Preflight can still fail when tutorial readiness checks fail. In that case the proposal review surface shows invalid validation and blocked diff preview, and approval request remains blocked until existing evidence is pass-ready.
- The panel provides pasted JSON intake only. External transport for Codex proposal submission remains out of scope.

## User Decision Points

- None for Domain E implementation.
