# Wave45 Domain F Report: PSD Import Focused E2E Regression

> Target: `wave45-psd-import-focused-e2e-regression`
> Role: Gnome implementation agent
> Date: 2026-06-05
> Verdict: `pass`

## Verdict

`pass`

The Editor explicit PSD import workflow is now covered by a standalone focused e2e regression for private/local `test_data/sample_model.psd`. The new smoke uploads the PSD through the browser file input, waits for parse success, checks document metadata, layer tree, selected layer materialization digest/byteLength evidence, save/load truthfulness, and confirms raw PSD/materialized bytes are not persisted in browser-local project storage.

## Files Changed

- `apps/editor/e2e/psd-import-focused-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`
- `scripts/focused-e2e-registry.mjs`
- `scripts/check-psd-parser-import-boundary.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave45/wave45-domain-f-psd-import-focused-e2e-regression-report.md`

Pre-existing Wave45 Domain A-E untracked reports/reviews and source changes were left untouched.

## E2E / Regression Evidence

- Added `psdImportFocused` as a standalone focused e2e entry, not included in the aggregate editor e2e script.
- The e2e uploads `test_data/sample_model.psd` and verifies:
  - source byte length `22406225 bytes`
  - browser parser status `PSD parsed in browser session`
  - parser-free source profile `layered-character-psd-profile-v1`
  - parser evidence `webtoonPsd / @webtoon/psd / 0.4.0`
  - parsed document evidence: `20` groups, `126` layers, visible/raster candidate counts
  - selected layer `psd:root/layer[0]` / `headwear`
  - materialization summary `460800 bytes` and SHA-256 `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`
  - `summary only; raw materialized bytes not persisted`
  - persistence facts: parser objects `notPersisted`, PSD bytes `sessionReadOnlyNoRawBytesPersistedByParser`, save/load `sessionEvidenceClearedOnProjectLoadReparseRequiredV1`
- Browser-local save/load regression:
  - saved project storage must not include `sample_model.psd`, parser diagnostics, parser package name, selected-layer materialization digest, source digest, selected file byte prefix, raw RGBA fields, visual bytes, or explicit PSD import state.
  - after reload/load, the explicit PSD import panel returns to `No PSD selected`, `No parsed PSD document metadata`, and `No parsed PSD layer tree`.

## Fixture / Traceability Registration

- Registered `wave45-psd-import-focused-e2e-regression` in `discussion/tests/fixtures/fixture-manifest.md` as warning-gated `rights-provenance`, `guardrail`, and `gui-evidence`.
- Registered `TC-WAVE45-PSD-IMPORT-FOCUSED-E2E-001` in `discussion/tests/traceability/test-traceability-matrix.md`.
- Registration explicitly keeps `test_data/sample_model.psd` private/local, not public-distributable, and not a public demo asset.
- JSON mirrors were intentionally not edited, matching the existing warning-gated markdown-registration pattern for Wave27/Wave28/Wave29/Wave39/Wave40/Wave41/Wave44.

## Parser Import Guard

- Added `scripts/check-psd-parser-import-boundary.mjs`.
- The guard scans `apps/**`, `packages/**`, and `scripts/**` source files for direct `@webtoon/psd` module specifiers, including static import, direct re-export, subpath import, dynamic import, require, and require.resolve usage.
- Approved direct sites are limited to:
  - `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
  - `scripts/wave44-psd-parser-smoke.mjs`
  - `scripts/wave44-psd-layer-materialization.mjs`
- The guard fails any direct parser import under `packages/**`.

## Review-Sylph Fix Loop 1

- Tightened `scripts/check-psd-parser-import-boundary.mjs` so `export ... from "@webtoon/psd"` and `@webtoon/psd/...` subpath direct usage are caught by the same boundary guard.
- Kept approved direct parser usage limited to the Editor browser adapter and Wave44 scripts; `packages/**` direct usage remains rejected.
- Removed the focused e2e UI claim scan's broad `/public distributable/i` pattern to avoid false positives for truthful negative wording such as `not public-distributable`. Private/local and non-public-demo wording remains enforced through fixture/traceability token checks and saved-project payload assertions.

## Review-Sylph Fix Loop 2

- Replaced the remaining phrase-only UI unsupported-claim checks for `public demo asset`, `raw bytes persisted`, and `visual bytes persisted` with a negative-aware positive-claim check.
- Truthful negative UI wording such as `not a public demo asset`, `no raw bytes persisted`, `no visual bytes persisted`, or `no raw or visual bytes persisted` no longer trips the focused e2e claim scan.
- Fixture/traceability token checks were not weakened.
- Parser import guard was left unchanged after Review-Sylph marked it adequate.

## Verification

Review-Sylph fix loop 2 reruns after the negative-aware UI claim-scan fix:

- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
  - Passed desktop focused smoke.
  - Evidence: `byteLength=22406225`, `materializedBytes=460800`, screenshot PNG captured.
- `node scripts/check-focused-e2e-registry.mjs`
  - Passed: `20 entries, 14 aggregate-discoverable, 6 standalone direct`.
- `node scripts/run-focused-e2e.mjs --check`
  - Passed: `20 entries`.
- `git diff --check` for fix-loop paths
  - Passed for tracked changes.
- `git diff --no-index --check -- NUL <new file>` for the untracked focused e2e and report files
  - No whitespace findings; no-index exit `1` was expected for added-file comparisons, with CRLF working-copy warnings only.

Review-Sylph fix loop 1 reruns after the parser-guard and claim-scan fixes:

- `node scripts/check-psd-parser-import-boundary.mjs`
  - Passed: `5` direct import/resolve sites limited to approved adapter and Wave44 scripts.
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
  - Passed desktop focused smoke.
  - Evidence: `byteLength=22406225`, `materializedBytes=460800`, screenshot PNG captured.
- `node scripts/check-focused-e2e-registry.mjs`
  - Passed: `20 entries, 14 aggregate-discoverable, 6 standalone direct`.
- `node scripts/run-focused-e2e.mjs --check`
  - Passed: `20 entries`.
- `pnpm.cmd run check:deps`
  - Passed: `Dependency guard passed.`
- `pnpm.cmd run check:source`
  - Passed: `Source organization guard passed.`
- `git diff --check` for fix-loop paths
  - Passed for tracked changes.
- `git diff --no-index --check -- NUL <new file>` for the untracked focused e2e, guard, and report files
  - No whitespace findings; no-index exit `1` was expected for added-file comparisons, with CRLF working-copy warnings only.

Passed:

- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
  - Passed desktop focused smoke.
  - Evidence: `byteLength=22406225`, `materializedBytes=460800`, screenshot PNG captured.
- `node scripts/check-focused-e2e-registry.mjs`
  - Passed: `20 entries, 14 aggregate-discoverable, 6 standalone direct`.
- `node scripts/run-focused-e2e.mjs --check`
  - Passed: `20 entries`.
- `node scripts/run-focused-e2e.mjs --list --tag psdImport`
  - Listed `psdImportFocused` as standalone direct verification.
- `node scripts/check-psd-parser-import-boundary.mjs`
  - Passed: `5` direct import/resolve sites limited to approved adapter and Wave44 scripts.
- `pnpm.cmd typecheck`
  - Passed root and Editor TypeScript checks.
- `pnpm.cmd run check:source`
  - Passed: `Source organization guard passed.`
- `pnpm.cmd run check:deps`
  - Passed: `Dependency guard passed.`
- `git diff --check -- apps/editor/e2e/test-ids.mjs scripts/focused-e2e-registry.mjs scripts/wave42-focused-e2e-boundary.mjs discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md`
  - Passed with CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL <new file>` for:
  - `apps/editor/e2e/psd-import-focused-smoke.mjs`
  - `scripts/check-psd-parser-import-boundary.mjs`
  - `discussion/implementation/waves/wave45/wave45-domain-f-psd-import-focused-e2e-regression-report.md`
  - No whitespace findings; no-index exit `1` was expected for added-file comparisons, with CRLF working-copy warnings only.

## Remaining Issues / User-Decision Points

None for Domain F.

Future scope still requires separate decisions for drag-drop, archive/filesystem, public sample/demo assets, general PSD materialization, full compositing, renderer/pixel oracle, Cubism compatibility, or repo-side repair/LLM/autofix behavior.
