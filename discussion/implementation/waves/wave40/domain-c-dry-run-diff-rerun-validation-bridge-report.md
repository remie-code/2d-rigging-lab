# Wave40 Domain C: Dry-Run Diff and Rerun Validation Bridge

## Verdict

- Status: done
- Domain: `wave40-dry-run-diff-rerun-validation-bridge`
- Contract changes required: no

## Implementation Summary

- Added `operation-core` Codex proposal preview bridge for already-validated proposal data:
  - builds deterministic preview ids / evidence refs from proposal ids,
  - dry-runs proposal operations as a sequence on cloned preview state,
  - normalizes each preview operation to the current preview package revision,
  - returns Domain A `CodexProposalDiffPreviewResultDto`,
  - returns the preview `AuthoringSession` separately from committed input state,
  - blocks stale committed package revisions before previewing.
- Added standalone aggregate diff output for preview:
  - combines operation model diffs into one proposal-level `model-diff-v1`,
  - carries runtime/validation diff aggregates when operation evidence supplies them,
  - keeps `previewOnly: true` and `committed: false`.
- Added `validator-core` rerun validation bridge:
  - returns Domain A `CodexProposalRerunValidationResultDto`,
  - supports `preview` state via `previewId` / `previewPackageRevision`,
  - supports explicit `postCommit` state via caller-supplied package revision,
  - builds Product Preflight from fresh rerun validation reports when supplied,
  - rejects stale validation/Product Preflight evidence by package revision or package id and omits stale reports from the result.

## Fix Loop Notes

- Review finding 1 fixed: preview readiness now blocks when `proposal.packageContext.packageId` is present and differs from `session.packageIdentity.packageId`. The focused test proves no preview session or operation result is produced and committed/session state is not mutated.
- Review finding 2 fixed: post-commit rerun binding no longer lets `stateBinding.packageId` override `proposal.packageContext.packageId`. If both are present and differ, rerun validation returns a blocking mismatch diagnostic before embedding Product Preflight evidence.

## Fix Loop 2 Notes

- Final review finding 1 fixed: diff-preview evidence is now targeted at the concrete preview/session package id, including proposals that omit `packageContext.packageId`. Preview-scoped rerun validation derives its expected package id from the proposal package id or the diff-preview package evidence target, so same-revision Product Preflight / validation evidence from another package is rejected before embedding.
- Final review finding 2 fixed: rerun validation evidence is now targeted at the resolved state package id. For post-commit reruns with an omitted proposal package id, an explicit `stateBinding.packageId` is preserved in the rerun evidence target.

## Files Changed

- `packages/operation-core/src/codex-proposal-preview.ts`
- `packages/operation-core/src/codex-proposal-preview.test.ts`
- `packages/operation-core/src/index.ts` (barrel re-export only)
- `packages/validator-core/src/codex-proposal-rerun-validation.ts`
- `packages/validator-core/src/codex-proposal-rerun-validation.test.ts`
- `packages/validator-core/src/index.ts` (barrel re-export only)
- `discussion/implementation/waves/wave40/domain-c-dry-run-diff-rerun-validation-bridge-report.md`

## Verification

- `pnpm.cmd exec vitest run packages/operation-core/src/codex-proposal-preview.test.ts packages/validator-core/src/codex-proposal-rerun-validation.test.ts`: pass, 2 files / 12 tests after fix loop 2.
- `pnpm.cmd exec vitest run packages/operation-core/src/codex-proposal-preview.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/validator-core/src/codex-proposal-rerun-validation.test.ts packages/validator-core/src/product-preflight-report.test.ts`: pass, 4 files / 36 tests after fix loop 2.
- `pnpm.cmd typecheck`: pass after fix loop 2.
- `packages/operation-core/src/index.ts` and `packages/validator-core/src/index.ts`: barrel-only; re-export additions only.
- Manifest / lockfile diff check for root and touched package manifests: no output, no changes.

## Scope / Boundary Notes

- No `packages/contracts/src/**` files were edited.
- No `packages/ai-interface/src/**` files were edited.
- No repo-side proposal generation, repair candidate generation, ranking, natural-language repair, LLM provider, prompt integration, auto-fix, automatic commit, external transport, parser/image/archive/filesystem/renderer/pixel oracle/Cubism work was added.
- No dependency, package manifest, or lockfile changes were made.

## Residual Risks

- The rerun bridge consumes caller-supplied rerun validation reports or Product Preflight reports; it does not materialize package documents itself. This preserves existing package dependency boundaries without manifest changes, and it guards freshness by package id/revision before embedding Product Preflight evidence.
