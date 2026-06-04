# Wave40 Domain B: Operation Catalog / Proposal Validation

## Verdict

- Implementation verdict: `fixed`
- Date: 2026-06-04
- Domain: `wave40-operation-catalog-proposal-validation`

## Scope Implemented

- Added deterministic Codex proposal operation catalog construction in `packages/ai-interface`.
- Added explicit unsupported boundary catalog records for all Domain A required boundary kinds.
- Added proposal validation helper that returns `CodexProposalValidationResultDto` data for:
  - malformed proposal schema,
  - invalid or unavailable catalog operations,
  - operation-core payload schema failures,
  - catalog-required target refs and payload fields,
  - supplied Product Preflight context mismatch/staleness,
  - preflight `fail`, `not_supported`, `not_evaluated`, and `warn` states.
- Validation marks unsupported, not-evaluated, and user-decision-required cases as non-approval-ready. It does not generate repair candidates, ranking, natural-language repairs, or fake actions.

## Fix Loop

- Fixed Review-Sylph high finding: catalog `targetKinds` now match valid proposal target-ref kinds used by handlers for the reviewed operations:
  - `addKeyform`: `drawable`, `mesh`, `rigControl`.
  - `addKeyformGrid2d`: `drawable`, `mesh`, `rigControl` for the same keyform target oracle boundary.
  - `setRuntimeVisibility`: `drawable` only.
- Fixed Review-Sylph medium finding: focused validation tests now cover supplied Product Preflight `fail`, `not_supported`, and `not_evaluated` states as non-previewable / non-approval-ready outcomes.

## Files Changed

- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`
- `packages/ai-interface/src/ai-codex-proposal-validation.ts`
- `packages/ai-interface/src/ai-codex-proposal-validation.test.ts`
- `packages/ai-interface/src/index.ts` (barrel-only re-exports)
- `discussion/implementation/waves/wave40/wave40-domain-b-operation-catalog-proposal-validation-report.md`

## Verification

- `pnpm.cmd exec vitest run packages/ai-interface/src/ai-codex-proposal-validation.test.ts packages/ai-interface/src/ai-codex-proposal-command.test.ts`: pass, 2 files / 16 tests.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd typecheck`: pass.
- Targeted trailing-whitespace scan over touched Domain B files: pass.
- `packages/ai-interface/src/index.ts` barrel-only check: pass; export-only lines.

## Boundary Notes

- No shared Domain A contracts were changed.
- No repo-side proposal generation, repair candidate generation, candidate ranking, LLM/provider/prompt, natural-language repair, auto-fix, automatic commit, external transport, parser/image decode, archive/filesystem, renderer/pixel oracle, or Cubism behavior was added.
- No diff/rerun validation execution and no Editor UI implementation was added.
- No dependency manifest or lockfile changes were made.

## Remaining Issues / User-Decision Points

- No Domain B user-decision point identified.
