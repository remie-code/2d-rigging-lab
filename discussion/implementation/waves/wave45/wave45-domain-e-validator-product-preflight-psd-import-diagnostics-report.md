# Wave45 Domain E Report: Validator / Product Preflight PSD Import Diagnostics

> Target: `wave45-validator-product-preflight-psd-import-diagnostics`
> Role: Gnome implementation agent
> Date: 2026-06-05
> Verdict: `pass`

## Verdict

`pass`

Validator-core now has a parser-free browser PSD import evidence diagnostic bridge, and Product Preflight now keeps PSD not-evaluated evidence as `not_evaluated` claims instead of flattening them into generic warnings.

No direct PSD parser import, parser implementation, Editor UI workflow, persisted/exported Product Preflight artifact, release/demo gate, public demo asset, renderer/pixel oracle, full compositing, Cubism, archive/filesystem, drag-drop, or repair/LLM scope was added.

## Files Changed

- `packages/validator-core/src/psd-import-preflight-diagnostics.ts`
- `packages/validator-core/src/psd-import-preflight-diagnostics.test.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/product-preflight-report.test.ts`
- `packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts`
- `packages/validator-core/src/index.ts`
- `discussion/implementation/waves/wave45/wave45-domain-e-validator-product-preflight-psd-import-diagnostics-report.md`

No `apps/editor/src/**`, `packages/operation-core/src/**`, `packages/package-format/src/**`, `package.json`, `pnpm-lock.yaml`, dependency registry, parser source, or Product Preflight persistence/export path was edited by Domain E.

## Implementation Summary

- Added `buildBrowserPsdImportPreflightValidationReport` and `createBrowserPsdImportPreflightChecks`.
- The helper accepts parser-free browser/session evidence shapes, including Domain B-style bridge status/source/parser/layer tree/materialization/feature/error evidence and Domain C-style adapter-result summaries by structural shape.
- Browser parse success emits existing PSD diagnostics:
  - `asset.psd.parserEvidence`
  - `asset.psd.layerTreeEvidence`
  - `asset.psd.materializationEvidence`
- Oversize and parser failure use the existing `asset.psd.adapterDiagnostic` validator diagnostic with adapter-side evidence such as `browserPsdParser.sizeCapExceeded` or `browserPsdParser.parse.failed`.
- Missing current bytes and reparse-required states use existing formal byte diagnostics:
  - `byteAvailability.currentSessionBytes.missing`
  - `byteAvailability.requiresReupload`
- Unsupported PSD feature evidence uses `asset.psd.featureUnsupported`.
- Not-evaluated PSD feature evidence uses `asset.psd.featureNotEvaluated`.
- Missing selected materialization evidence uses `asset.psd.materializationEvidenceMissing`.
- Product Preflight now maps `asset.psd.featureNotEvaluated` and `asset.psd.materializationEvidenceMissing` to `not_evaluated` claims. Other non-not-evaluated diagnostics remain in `diagnosticRefs`.
- `index.ts` remains barrel-only.

## Boundary Notes

- Validator-core records parser-free evidence only; it does not import or execute `@webtoon/psd`.
- `asset.psd.adapterDiagnostic` is reused for browser bridge parse failure and size-cap rejection so no new diagnostic ID namespace is introduced for parser internals.
- Product Preflight status remains session-generated/read-only and is still built from validation reports/evidence refs.
- Source materialization evidence remains digest/byte-length metadata only. Raw PSD bytes, raw RGBA bytes, visual bytes, public screenshots, public exports, and public demo material are not persisted or claimed.
- Existing Wave44 PSD materialization regression was updated so `asset.psd.featureNotEvaluated` is represented as a Product Preflight `not_evaluated` claim while pass diagnostics remain visible in `diagnosticRefs`.

## Review-Sylph Loop 1 Fix

Review-Sylph found that parsed Domain B materialization failures could be dropped because parsed evidence did not inspect `errorEvidence` or adapter diagnostics.

Applied narrow fix:

- Parsed browser PSD evidence now treats any of these as missing selected materialization evidence:
  - top-level `failureKind: "materializationFailure"`
  - `errorEvidence[].failureKind = "materializationFailure"`
  - `diagnostics[].checkId = "browserPsdParser.materialization.failed"`
  - `adapterResult.diagnostics[].checkId = "browserPsdParser.materialization.failed"`
- The resulting validator check remains `asset.psd.materializationEvidenceMissing`, which Product Preflight already maps to a `not_evaluated` `sourceMaterialization` claim.
- Added a Domain B-shaped regression test where the PSD parse succeeds but selected-layer materialization returns `browserPsdParser.materialization.failed` and `materializationFailure` evidence.
- No parser import or renderer/full-compositing/pixel claim was added.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-import-preflight-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts`
  - Initial Domain E pass: 3 files, 16 tests.
  - After Review-Sylph loop 1 fix: passed 3 files, 17 tests.
- `pnpm.cmd typecheck`
  - Passed root TypeScript and Editor TypeScript checks.
  - Re-run after Review-Sylph loop 1 fix also passed.
- `pnpm.cmd run check:source`
  - Passed: `Source organization guard passed.`
- Parser import scan under `packages/**`
  - No matches for direct static imports:
    - `from "@webtoon/psd"`
    - `from '@webtoon/psd'`
  - No matches for direct dynamic import / require forms:
    - `import("@webtoon/psd")`
    - `import('@webtoon/psd')`
    - `require("@webtoon/psd")`
    - `require('@webtoon/psd')`
- `git diff --check -- packages/validator-core/src/index.ts packages/validator-core/src/product-preflight-report.ts packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts`
  - Passed; Git reported LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages/validator-core/src/psd-import-preflight-diagnostics.ts`
  - No whitespace findings; command exited nonzero as expected for a no-index comparison against `NUL`, with LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL packages/validator-core/src/psd-import-preflight-diagnostics.test.ts`
  - No whitespace findings; command exited nonzero as expected for a no-index comparison against `NUL`, with LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion/implementation/waves/wave45/wave45-domain-e-validator-product-preflight-psd-import-diagnostics-report.md`
  - No whitespace findings; command exited nonzero as expected for a no-index comparison against `NUL`, with LF-to-CRLF warning only.

## Remaining Issues

- None blocking in Domain E source.
- Domain D/F still own Editor UI projection and end-to-end workflow regression. Domain E did not edit Editor source.
- `discussion/design/module-contracts/validator-contract.md` still lists only representative PSD IDs. Domain E intentionally reused existing catalog-backed IDs instead of expanding the contract surface.

## User-Decision Points

None for Domain E.

Future user decisions remain required before widening to public demo assets, public sample PSD visual distribution, archive/filesystem/drag-drop/File System Access API, full renderer/pixel oracle, Cubism compatibility, or repo-side repair/LLM/autofix scope.

## Early Escape Status

No early escape trigger was encountered. The implementation stayed inside validator-core and Wave45 report scope.
