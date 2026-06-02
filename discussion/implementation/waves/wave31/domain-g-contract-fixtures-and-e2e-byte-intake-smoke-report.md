# Wave31 Domain G Report: Contract Fixtures And E2E Byte Intake Smoke

## Verdict

pass

## Domain

- Domain: `wave31-contract-fixtures-and-e2e-byte-intake-smoke`
- Purpose: add and harden deterministic contract fixture coverage plus desktop/mobile e2e smoke for actual byte intake -> metadata/evidence -> save/load truthfulness -> reupload or missing-byte diagnostics.
- Upstream gates: Domains A-F treated as pass prerequisites.
- Domain F gate note: Undine explicitly approved the narrow `apps/editor/src/ui/app-shell/app-shell.ts` callback bridge before Domain G started.

## Child-Agent Flow

- Gnome implementation agent: `019e86b0-8543-7e52-95b1-15138a859026`
- Review-Sylph clean review agent: `019e86bd-f6f8-7bd1-9f45-ebf789431ad7`
- Separation preserved: yes
- Orch-Sylph source implementation: none
- Fix loops used: 0 of 2

## Files Changed By Domain G Agent

- `apps/editor/e2e/byte-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `packages/package-format/src/wave31-byte-sample-characterization-fixture.test.ts`

Report artifacts:

- `discussion/implementation/waves/wave31/domain-g-contract-fixtures-and-e2e-byte-intake-smoke-report.md`
- `discussion/implementation/reviews/wave31/domain-g-contract-fixtures-and-e2e-byte-intake-smoke-review.md`

## Implementation Summary

- Added a focused byte-only fixture test for `fixtures/contracts/wave31-byte-sample-characterization/**`.
- The fixture test verifies `test_data/sample_model.psd` byte length and SHA-256 against the expected fixture JSON without PSD parsing, image decode, raster extraction, header/layer semantic claims, or public distribution claims.
- Added `apps/editor/e2e/byte-intake-smoke.mjs` to select `test_data/sample_model.psd` through the Source Intake file input.
- The e2e smoke verifies selected-file metadata, digest/byte length, rights/provenance wording, current-session byte availability, browser-local save/load metadata-only truthfulness, and post-reload `requiresReupload`.
- Integrated the byte-intake smoke into the full desktop/mobile editor e2e runner.
- No production source/UI implementation changes were made by Domain G.

## Pass Evidence Achieved

- `test_data/sample_model.psd` is selected as an actual browser file input in e2e.
- E2E verifies byte metadata, validator-facing availability state, operation/session evidence, save/load metadata persistence, and reupload diagnostics.
- E2E asserts that persisted browser-local project data does not contain raw byte payload fields such as base64 bytes, array buffers, pixel data, decoded image size, or raster data.
- E2E checks UI text for unsupported parser/decode/archive/full-renderer/pixel-oracle claims.
- Desktop and mobile smoke coverage is included through the main e2e runner.
- Fixture evidence remains deterministic and local-test truthful: sample bytes are not copied into the fixture, byte evidence is SHA-256 plus byte length, and rights/provenance is recorded as user-provided rights-cleared local test fixture metadata.
- No dependency, manifest, lockfile, parser, image decode, archive, drag-drop, File System Access API, full renderer, pixel oracle, or Cubism compatibility work was added.

## Review Findings And Fix Loop

Review-Sylph returned `pass`.

Findings:

- None. No development/design compliance or test adequacy blockers were found.

Fix loops:

- None required.

Review evidence:

- The reviewer confirmed e2e file input selection of `test_data/sample_model.psd`.
- The reviewer confirmed byte metadata, digest/byte length, validator availability, save/load metadata-only persistence, and reupload-state coverage.
- The reviewer confirmed desktop/mobile full smoke integration.
- The reviewer confirmed the focused fixture test is byte-only and deterministic.
- The reviewer confirmed `index.ts` files remain barrel-only.
- The reviewer confirmed dependency manifests/lockfiles have no diff.

## Verification

Gnome implementation reported:

- `pnpm.cmd exec vitest run packages/package-format/src/wave31-byte-sample-characterization-fixture.test.ts`: pass.
- `node apps\\editor\\e2e\\byte-intake-smoke.mjs`: pass, desktop and mobile.
- `pnpm.cmd test:e2e`: pass, desktop and mobile, including adjacent source-intake smoke.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- Scoped `git diff --check -- apps/editor/e2e packages/package-format/src/wave31-byte-sample-characterization-fixture.test.ts`: pass.
- Manifest/lockfile check: no `package.json`, `apps/editor/package.json`, or `pnpm-lock.yaml` diffs.

Review-Sylph reported:

- `Get-FileHash` and `Get-Item` confirmed `test_data/sample_model.psd`: 22,406,225 bytes, SHA-256 `44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5`.
- `node --check` passed for new/changed e2e files.
- `pnpm.cmd exec vitest run packages/package-format/src/wave31-byte-sample-characterization-fixture.test.ts`: pass, 1 test.
- `node apps/editor/e2e/byte-intake-smoke.mjs`: pass, desktop and mobile.
- `pnpm.cmd test:e2e`: pass, desktop and mobile full editor smoke.
- `pnpm.cmd typecheck`: pass.
- Scoped `git diff --check`: pass, CRLF warnings only.
- Forbidden-scope scan found only explicit non-goal/negative assertions plus pre-existing preview image decode helper text, not new parser/decode/renderer work.

Review-Sylph did not rerun the full unit suite or `check:source` / `check:deps`; Gnome had already run `check:source` and `check:deps`, and the reviewer judged focused fixture, full e2e, typecheck, dependency diff check, and source inspection sufficient for Domain G.

Orch-Sylph independently checked:

- Scoped Domain G diff/status and dependency manifest diff.
- New e2e and fixture-test file contents.
- Adjacent source-intake smoke integration context.
- No package manifest or lockfile diff.

## Remaining Issues

No Domain G implementation correctness, review, scope, dependency, non-goal, or test adequacy blockers remain.

Domain H still needs final integration review and Wave31 final reporting.

## User-Decision Points For Undine

None.
