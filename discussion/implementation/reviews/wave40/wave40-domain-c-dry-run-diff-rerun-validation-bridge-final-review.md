# Wave40 Domain C Final Re-review: Dry-Run Diff and Rerun Validation Bridge

## verdict

`needs_changes`

## review mode

- Clean-context final Review-Sylph re-review after bounded fix loop.
- Source implementation was not edited.
- Basis documents, target source files, tests, git status/diff, and the prior Domain C review record were inspected directly.

## prior finding verification

- Fixed: preview now blocks when `proposal.packageContext.packageId` is present and differs from `session.packageIdentity.packageId`. The guard is in `packages/operation-core/src/codex-proposal-preview.ts:236`, and focused coverage is in `packages/operation-core/src/codex-proposal-preview.test.ts:163`.
- Fixed: post-commit rerun validation now blocks when both `proposal.packageContext.packageId` and `stateBinding.packageId` are present and differ. The guard is in `packages/validator-core/src/codex-proposal-rerun-validation.ts:213`, and focused coverage is in `packages/validator-core/src/codex-proposal-rerun-validation.test.ts:130`.

## findings

### High: package-id omission still allows preview-scoped rerun validation to accept another package's Product Preflight evidence

- File: `packages/contracts/src/codex-proposal.ts:58`
- File: `packages/operation-core/src/codex-proposal-preview.ts:406`
- File: `packages/validator-core/src/codex-proposal-rerun-validation.ts:426`
- File: `packages/validator-core/src/codex-proposal-rerun-validation.ts:286`

The fix loop covers mismatches when proposal `packageContext.packageId` is present, but the contract still makes that field optional. Domain B validation also only compares the proposal package id to Product Preflight when the proposal id is present, so a proposal without `packageContext.packageId` can still validate against a current Product Preflight report.

For that valid optional-id path, `previewCodexProposalDiff` runs against a concrete `AuthoringSession`, but `createDiffPreviewEvidenceRef` records `target.id` as the generic fallback `pkg_codexProposalPreview` instead of the session's actual `packageIdentity.packageId`. Later, preview-scoped rerun validation derives `expectedPackageId` only from `proposal.packageContext.packageId`, so it becomes `undefined`; `evaluateReportFreshness` only performs package-id mismatch rejection when `expectedPackageId !== undefined`.

Result: a proposal that omitted package id can be previewed against package A revision N, then rerun validation can embed Product Preflight or validation reports from package B revision N without a stale/mismatch diagnostic. That violates Domain C's requirement that rerun validation/Product Preflight be tied to preview state and reject stale or mismatched evidence.

Expected fix: when previewing a proposal whose package id is omitted, bind the preview evidence to `session.packageIdentity.packageId`; then have preview-scoped rerun validation derive the expected package id from the proposal package id or the diff-preview package evidence target. Add focused tests for omitted proposal package id with same-revision wrong-package rerun evidence.

### Medium: post-commit rerun evidence target drops explicit `stateBinding.packageId` when the proposal package id is omitted

- File: `packages/validator-core/src/codex-proposal-rerun-validation.ts:377`
- File: `packages/validator-core/src/codex-proposal-rerun-validation.ts:426`

For `stateScope: "postCommit"`, freshness now correctly uses `proposal.packageContext.packageId ?? stateBinding.packageId`, so caller-supplied post-commit package ids remain useful when the proposal package id is omitted. However, `createRerunValidationEvidenceRef` still targets `proposal.packageContext.packageId ?? "pkg_codexProposalRerun"`, losing the explicit post-commit package id in the top-level rerun evidence ref.

This is less severe than the preview-scoped issue because freshness still rejects mismatched Product Preflight/validation reports when `stateBinding.packageId` is supplied. It does leave the result evidence less accurately tied to the explicit post-commit state.

Expected fix: target rerun validation evidence at the resolved expected package id for the state binding, not only the proposal package id fallback. Add focused coverage for post-commit state with omitted proposal package id and explicit `stateBinding.packageId`.

## review lanes covered

### Design / Development Compliance Review

- Preview implementation remains deterministic for the inspected operation sequence and uses cloned preview state, existing dry-run handlers, `previewOnly: true`, and `committed: false`.
- The committed input session is not mutated in the covered success and blocking tests.
- Prior package mismatch findings were fixed for the present-package-id paths.
- A remaining optional-package-id path can still lose actual preview package binding and accept same-revision evidence from another package.
- Rerun validation distinguishes `preview` and `postCommit` state scopes and rejects stale revision/package evidence when an expected package id is available.
- No Domain A contract rewrites were made by Domain C.
- No `packages/ai-interface/src/**` edits were made by Domain C; concurrent Domain B changes were read only for boundary context.
- `packages/operation-core/src/index.ts` and `packages/validator-core/src/index.ts` are barrel-only re-export additions.
- No package manifests or lockfiles changed.
- No repo-side proposal generation, repair candidate generation/ranking, LLM/provider/prompt, natural-language repair, auto-fix/automatic commit, external transport, parser/image/archive/filesystem, renderer/pixel oracle, or Cubism implementation was found in Domain C target files.

### Test Adequacy Review

- Covered by focused tests: preview success, invalid validation blocking, stale revision blocking, present-package-id preview mismatch blocking, non-mutation of committed state, aggregate model diff shape, preview-scoped rerun binding, post-commit binding, present-package-id post-commit mismatch blocking, stale evidence rejection, and missing rerun evidence as `not_evaluated`.
- Missing coverage: proposal package id omitted while preview/rerun evidence belongs to another same-revision package.
- Missing coverage: post-commit explicit `stateBinding.packageId` is preserved in rerun validation evidence when proposal package id is omitted.

## verification performed

- `git status --short -uall`: reviewed current worktree. Domain C files are untracked/new plus barrel modifications; concurrent Domain A/B files are also present.
- `git diff -- packages/operation-core/src packages/validator-core/src discussion/implementation/waves/wave40 discussion/implementation/reviews/wave40`: tracked diff shows only the two barrel re-exports; untracked Domain C files were read directly.
- `pnpm.cmd exec vitest run packages/operation-core/src/codex-proposal-preview.test.ts packages/validator-core/src/codex-proposal-rerun-validation.test.ts`: pass, 2 files / 9 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/codex-proposal-preview.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/validator-core/src/codex-proposal-rerun-validation.test.ts packages/validator-core/src/product-preflight-report.test.ts`: pass, 4 files / 33 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/operation-core/src packages/validator-core/src discussion/implementation/waves/wave40 discussion/implementation/reviews/wave40`: pass with LF-to-CRLF warnings for the two tracked barrel files.
- `rg -n "[ \t]+$" ...Domain C new files...`: no trailing-whitespace matches.
- Manifest/lockfile status check for root and touched package manifests: no output, no changes.

## remaining issues / user-decision points

- No user decision is required. The remaining issues are bounded Domain C implementation/test fixes around package-id binding when proposal package id is omitted.
