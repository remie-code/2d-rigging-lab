# Wave40 Domain F Proposal Fixtures Focused Coverage Report

## Summary

- Domain: `wave40-proposal-fixtures-focused-coverage`
- Verdict: pass
- Completed focused registration for `wave40-codex-proposal-fixtures` in fixture manifest and traceability matrix markdown.
- Preserved the existing Domain F fixture/test shape without broad source implementation.
- Fixed a focused `exactOptionalPropertyTypes` issue in the validator fixture test by omitting `packageHash` when the fixture input does not define it.
- No Domain F source or `index.ts` edits were made.

## Changed Files

- `fixtures/contracts/wave40-codex-proposal-fixtures/fixture-manifest.json`
- `fixtures/contracts/wave40-codex-proposal-fixtures/request/proposal-cases.json`
- `fixtures/contracts/wave40-codex-proposal-fixtures/request/product-preflight-pass.json`
- `fixtures/contracts/wave40-codex-proposal-fixtures/request/rerun-validation-report-input.json`
- `fixtures/contracts/wave40-codex-proposal-fixtures/expected/operation-catalog-summary.json`
- `fixtures/contracts/wave40-codex-proposal-fixtures/expected/proposal-validation-outcomes.json`
- `fixtures/contracts/wave40-codex-proposal-fixtures/expected/diff-preview-ready.json`
- `fixtures/contracts/wave40-codex-proposal-fixtures/expected/rerun-validation-summary.json`
- `packages/contracts/src/wave40-codex-proposal-fixtures.test.ts`
- `packages/ai-interface/src/wave40-codex-proposal-fixtures.test.ts`
- `packages/operation-core/src/wave40-codex-proposal-fixtures.test.ts`
- `packages/validator-core/src/wave40-codex-proposal-fixtures.test.ts`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave40/wave40-domain-f-proposal-fixtures-focused-coverage-report.md`

## Scope and Policy Notes

- Fixture data is synthetic semantic JSON only.
- The fixture manifest records no real asset bytes, image decode, external dependency, parser oracle, renderer oracle, pixel oracle, archive/filesystem, or Cubism compatibility oracle.
- The fixture manifest records no repo-side proposal generation, repair candidate generation, candidate ranking, LLM/provider/prompt, natural-language repair, auto-fix, automatic commit, external transport, real parser, or real renderer claim.
- No package manifest, lockfile, external dependency, app source, parser/image/archive/renderer/Cubism code, e2e assertion, or Domain D file was changed by Domain F continuation.
- Existing `index.ts` dirty changes are present in the shared worktree from other Wave40 domains; Domain F continuation did not edit any `index.ts`.

## Verification

- `pnpm.cmd exec vitest run packages/contracts/src/wave40-codex-proposal-fixtures.test.ts packages/ai-interface/src/wave40-codex-proposal-fixtures.test.ts packages/operation-core/src/wave40-codex-proposal-fixtures.test.ts packages/validator-core/src/wave40-codex-proposal-fixtures.test.ts`: pass, 4 files / 8 tests. Final run started at 21:38:37 and completed in 1.61s.
- Registration check for `wave40-codex-proposal-fixtures` and `TC-WAVE40-CODEX-PROPOSAL-FIXTURES-001` in both `discussion/tests/fixtures/fixture-manifest.md` and `discussion/tests/traceability/test-traceability-matrix.md`: pass.
- `pnpm.cmd typecheck`: initial fail on `packages/validator-core/src/wave40-codex-proposal-fixtures.test.ts` because `packageHash: undefined` was passed to `ValidationReportBuildInput` under `exactOptionalPropertyTypes`; fixed in the fixture test. Final rerun: pass for root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.
- `pnpm.cmd run check:source`: pass, `Source organization guard passed.`
- `git diff --check -- fixtures/contracts/wave40-codex-proposal-fixtures packages/contracts/src/wave40-codex-proposal-fixtures.test.ts packages/ai-interface/src/wave40-codex-proposal-fixtures.test.ts packages/operation-core/src/wave40-codex-proposal-fixtures.test.ts packages/validator-core/src/wave40-codex-proposal-fixtures.test.ts discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md discussion/implementation/waves/wave40/wave40-domain-f-proposal-fixtures-focused-coverage-report.md`: pass; Git emitted LF-to-CRLF working-copy warnings for the two touched markdown files only.
- Final scoped `git status --short -uall` for Domain F paths shows the fixture directory, four focused test files, two markdown registrations, and this report.
- `git status --short -- packages/contracts/src/index.ts packages/ai-interface/src/index.ts packages/operation-core/src/index.ts packages/validator-core/src/index.ts` still shows existing modified `index.ts` files from other Wave40 domains; Domain F continuation did not edit them.

## Residual Risks

- Shared dirty worktree includes unrelated Domain A/B/C/D source and report changes. They were not reverted or edited by this Domain F continuation.
- JSON mirrors under `discussion/tests/fixtures/fixture-manifest.json` and `discussion/tests/traceability/test-traceability-matrix.json` were intentionally not edited because the delegated scope requested narrow markdown registration only.
- No remaining Domain F verification gaps.
