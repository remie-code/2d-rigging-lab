# Wave40 Domain C Final Re-review After Fix Loop 2: Dry-Run Diff and Rerun Validation Bridge

## verdict

`pass`

## review mode

- Clean-context final Review-Sylph re-review after fix loop 2.
- Source implementation was not edited by this reviewer.
- Basis documents, target files, current status/diff, prior Domain C review artifacts, focused tests, typecheck, and scope checks were inspected directly.

## prior finding verification

- Fixed: present proposal package id mismatch blocks preview against the wrong session package. The guard rejects `proposal.packageContext.packageId` when it differs from `session.packageIdentity.packageId` in `packages/operation-core/src/codex-proposal-preview.ts:241`; focused coverage is in `packages/operation-core/src/codex-proposal-preview.test.ts:163`.
- Fixed: present proposal package id vs post-commit `stateBinding.packageId` mismatch blocks before Product Preflight evidence. The guard is in `packages/validator-core/src/codex-proposal-rerun-validation.ts:212`; focused coverage is in `packages/validator-core/src/codex-proposal-rerun-validation.test.ts:204`.
- Fixed: omitted proposal package id previews are bound to a concrete preview/session package id. Ready diff-preview evidence passes `previewSession.packageIdentity.packageId` at `packages/operation-core/src/codex-proposal-preview.ts:188`, and the evidence ref target records that package id at `packages/operation-core/src/codex-proposal-preview.ts:424`; focused coverage is in `packages/operation-core/src/codex-proposal-preview.test.ts:202`.
- Fixed: omitted proposal package id preview-scoped rerun validation rejects wrong-package same-revision evidence. Rerun validation resolves expected package id from proposal package id or diff-preview package evidence at `packages/validator-core/src/codex-proposal-rerun-validation.ts:428`, and freshness rejects package-id mismatch at `packages/validator-core/src/codex-proposal-rerun-validation.ts:286`; focused coverage is in `packages/validator-core/src/codex-proposal-rerun-validation.test.ts:96`.
- Fixed: omitted proposal package id post-commit rerun evidence target preserves explicit `stateBinding.packageId`. The resolved expected package id feeds the top-level rerun evidence target at `packages/validator-core/src/codex-proposal-rerun-validation.ts:377`; focused coverage is in `packages/validator-core/src/codex-proposal-rerun-validation.test.ts:173`.

## findings

No new findings.

## review lanes covered

### Design / Development Compliance Review

- Preview diff remains deterministic for the inspected proposal sequence and uses cloned preview state, existing dry-run handlers, `previewOnly: true`, and `committed: false`.
- The committed input session is not mutated in success, stale revision, package mismatch, and omitted-package-id preview coverage.
- Rerun validation/Product Preflight evidence is tied to preview package evidence or explicit post-commit state and rejects stale or mismatched package revision/id evidence before embedding Product Preflight reports.
- Domain A contracts were consumed but not rewritten by Domain C.
- `packages/ai-interface/src/**` is outside Domain C scope. The worktree contains concurrent Domain B ai-interface changes, but Domain C target files do not edit ai-interface.
- `packages/operation-core/src/index.ts` and `packages/validator-core/src/index.ts` are barrel-only re-export additions.
- No package manifest or lockfile changes were present for root or touched package manifests.
- Forbidden-scope scan found no repo-side proposal generation, candidate ranking, LLM/provider/prompt integration, natural-language repair, auto-fix/automatic commit, approval bypass, external transport, parser/image decode/archive/filesystem/renderer/pixel oracle/Cubism implementation, or external dependency addition in Domain C files. Keyword hits were expected dry-run candidate-session plumbing, schema diagnostic fields, test assertions, and report prose.

### Test Adequacy Review

- Covered by focused tests: preview success, aggregate model diff, invalid validation blocking, stale committed package revision blocking, present-package-id preview mismatch blocking, omitted-package-id preview evidence binding, committed state non-mutation, preview-scoped rerun Product Preflight construction, stale preview evidence rejection, omitted-package-id wrong-package same-revision rejection, explicit post-commit state, omitted-package-id post-commit evidence target binding, present-package-id post-commit mismatch blocking, and missing rerun evidence as `not_evaluated`.
- The original Domain C pass criteria and both prior review cycles' package-binding concerns now have direct coverage.

## verification performed

- `git status --short -uall`: reviewed current worktree. Domain C files are untracked/new plus barrel modifications; concurrent Domain A/B files are also present.
- `git diff -- packages/operation-core/src packages/validator-core/src discussion/implementation/waves/wave40 discussion/implementation/reviews/wave40`: tracked diff showed the two barrel re-exports; untracked Domain C files and reports were read directly.
- `pnpm.cmd exec vitest run packages/operation-core/src/codex-proposal-preview.test.ts packages/validator-core/src/codex-proposal-rerun-validation.test.ts`: pass, 2 files / 12 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/codex-proposal-preview.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/validator-core/src/codex-proposal-rerun-validation.test.ts packages/validator-core/src/product-preflight-report.test.ts`: pass, 4 files / 36 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/operation-core/src packages/validator-core/src discussion/implementation/waves/wave40 discussion/implementation/reviews/wave40`: pass with LF-to-CRLF working-copy warnings for the two tracked barrel files.
- `Select-String` trailing-whitespace scan over Domain C new files and report: no matches.
- Manifest/lockfile status check for `package.json`, `pnpm-lock.yaml`, `packages/operation-core/package.json`, `packages/validator-core/package.json`, `packages/ai-interface/package.json`, and `packages/contracts/package.json`: no output, no changes.

## remaining issues / user-decision points

- No remaining Domain C review issues.
- No user decision points.
