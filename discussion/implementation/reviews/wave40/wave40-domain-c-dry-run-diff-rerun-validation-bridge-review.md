# Wave40 Domain C Review: Dry-Run Diff and Rerun Validation Bridge

## verdict

`needs_changes`

## review mode

- Clean-context Review-Sylph review.
- Source implementation was not edited.
- Basis documents, target source files, git status/diff, and focused tests were inspected directly.

## findings

### High: preview can run a proposal against the wrong package when only the revision matches

- File: `packages/operation-core/src/codex-proposal-preview.ts:236`
- File: `packages/operation-core/src/codex-proposal-preview.ts:401`
- File: `packages/operation-core/src/codex-proposal-preview.test.ts:129`

`evaluatePreviewReadiness` rejects stale package revisions, but it never compares
`proposal.packageContext.packageId` with `input.session.packageIdentity.packageId`.
If a proposal names `pkg_other` with the same `basePackageRevision` as the current
session, `previewCodexProposalDiff` will dry-run it against the current session,
return `status: "ready"`, and emit diff-preview evidence targeted to the proposal's
package id rather than the actual preview session package. That mixes proposal state
and committed/preview state, which violates Domain C's core requirement that preview
state and committed state not be confused.

The focused preview tests cover stale revision but only with matching package ids, so
this package-binding path is currently untested.

Expected fix: when `proposal.packageContext.packageId` is present and differs from
`session.packageIdentity.packageId`, return a blocked preview diagnostic and add a
focused test proving no preview session/operation results are produced.

### High: post-commit rerun binding can override a proposal package id with another package

- File: `packages/validator-core/src/codex-proposal-rerun-validation.ts:406`
- File: `packages/validator-core/src/codex-proposal-rerun-validation.test.ts:95`

For `stateScope: "postCommit"`, `getExpectedPackageId` prefers
`stateBinding.packageId` over `proposal.packageContext.packageId`. If a proposal is
for `pkg_a`, a caller can pass a post-commit binding for `pkg_b`; fresh validation or
Product Preflight evidence for `pkg_b` will pass the freshness check. That lets rerun
validation/Product Preflight results be tied to an explicit post-commit state that is
not the proposal's package.

Expected fix: if both ids are present and differ, return a blocking mismatch
diagnostic before embedding Product Preflight evidence. Keep the caller-supplied id
path only for proposals whose package context has no package id. Add focused coverage.

## review lanes covered

### Design / Development Compliance Review

- Preview implementation is deterministic for the inspected operation sequence and
uses `cloneAuthoringSession`, existing dry-run handlers, and `previewOnly: true` /
`committed: false`.
- Preview does not use commit lifecycle or operation log append paths.
- Rerun validation distinguishes `preview` and `postCommit` state scopes and rejects
stale evidence by package revision/id where the expected package id is correctly
bound.
- Domain A DTOs are consumed; no contract files were changed by Domain C.
- `packages/operation-core/src/index.ts` and `packages/validator-core/src/index.ts`
are barrel-only re-export additions.
- No package manifests or lockfiles changed.
- No repo-side proposal generation, candidate ranking, LLM/provider/prompt,
natural-language repair, auto-fix/automatic commit, external transport,
parser/image/archive/filesystem, renderer/pixel oracle, or Cubism implementation was
found in the Domain C source files.
- Global worktree includes concurrent Domain B `packages/ai-interface/src/**` changes;
those were treated as forbidden scope for Domain C and ignored as instructed.

### Test Adequacy Review

- Covered by tests: preview success, invalid validation blocking, stale revision
blocking, non-mutation of committed session, aggregate model diff shape, preview-scoped
rerun binding, post-commit binding, stale evidence rejection, and missing rerun
evidence as `not_evaluated`.
- Missing coverage: package id mismatch for preview and post-commit rerun binding.

## verification performed

- `git status --short -uall`: showed Domain C new files plus concurrent Domain A/B
  untracked/modified files; no manifest/lockfile changes.
- `git diff -- packages/operation-core/src packages/validator-core/src discussion/implementation/waves/wave40`: tracked diff showed only two barrel re-exports because Domain C implementation files are untracked; untracked files were read directly.
- `pnpm.cmd exec vitest run packages/operation-core/src/codex-proposal-preview.test.ts packages/validator-core/src/codex-proposal-rerun-validation.test.ts`: pass, 2 files / 7 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/codex-proposal-preview.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/validator-core/src/codex-proposal-rerun-validation.test.ts packages/validator-core/src/product-preflight-report.test.ts`: pass, 4 files / 31 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/operation-core/src packages/validator-core/src discussion/implementation/waves/wave40 discussion/implementation/reviews/wave40`: pass with LF-to-CRLF working-copy warnings for the two tracked barrel files.
- `rg -n "[ \t]+$" ...Domain C new files...`: no trailing-whitespace matches.
- Manifest/lockfile status check for root and touched package manifests: no output, no changes.

## remaining issues / user-decision points

- No user decision is required. The bounded fix is implementation-side package id
  binding and tests in Domain C scope.
