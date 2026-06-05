# Wave44 Domain E Report: PSD Validator Provenance / Security Diagnostics

> Target: `wave44-psd-validator-provenance-security-diagnostics`
> Role: Gnome implementation agent
> Status: implemented

## Verdict

`pass`

Domain E implemented validator-core diagnostics for Wave44 PSD parser evidence, layer tree evidence, feature support evidence, and layer materialization evidence. The implementation reads Domain C DTOs already present in `package-format` and does not import or execute the PSD parser.

## Files Changed

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/product-preflight-report.test.ts`
- `packages/validator-core/src/psd-source-profile.test.ts`
- `packages/validator-core/src/validators/psd-source-evidence-diagnostics.ts`
- `packages/validator-core/src/validators/psd-source-profile-structured.ts`
- `discussion/implementation/waves/wave44/wave44-domain-e-psd-validator-provenance-security-diagnostics-report.md`

## Diagnostic Changes

Added catalog-backed PSD evidence diagnostics:

- `asset.psd.parserEvidence`
- `asset.psd.parserEvidenceUnavailable`
- `asset.psd.layerTreeEvidence`
- `asset.psd.layerTreeEvidenceMissing`
- `asset.psd.layerTreeEvidenceMismatch`
- `asset.psd.featureUnsupported`
- `asset.psd.featureNotEvaluated`
- `asset.psd.materializationEvidence`
- `asset.psd.materializationEvidenceMissing`
- `asset.psd.materializationEvidenceMismatch`

`validators/psd-source-evidence-diagnostics.ts` owns the new evidence validation so `psd-source-profile-structured.ts` stays focused on structured profile unsupported features, adapter diagnostics, and flattened fallback compatibility.

The diagnostics cover:

- parser provenance from `psd-parser-evidence-v1`;
- parsed layer tree counts/intake kind from `psd-layer-tree-evidence-v1`;
- unsupported and not-evaluated Photoshop feature evidence from `psd-feature-support-evidence-v1`;
- selected layer raster materialization digest/byte length/media type/provenance from `psd-layer-materialization-evidence-v1`, with digest DTOs formatted as stable `algorithm:hex` evidence;
- missing real-parser evidence;
- missing real-parser layer tree evidence;
- missing selected-layer raster materialization evidence;
- layer tree count/intake mismatches;
- materialization source asset/source layer mismatches.

Every new diagnostic records boundary evidence such as `validatorBoundary=no-parser-execution`, `photoshopCompositing=notClaimed`, and `rendererPixelOracle=notClaimed`.

Fix loop 1 resolved Review-Sylph F1 by replacing direct digest DTO stringification in materialization diagnostics with the same `algorithm:hex` formatting used by existing validator digest diagnostics. Focused tests now assert `digest=sha256:...` and `sourceDigest=sha256:...`.

## Product Preflight Changes

- `assetBytes` category evidence now accepts `sourceMaterialization` in addition to `byteAvailability`.
- `asset.psd.featureUnsupported` with `status=not_applicable` is treated as a truthful unsupported Product Preflight category outcome.
- `asset.psd.featureNotEvaluated` remains a warning diagnostic reference, not an unsupported claim.

No Product Preflight contract files were edited by Domain E.

## Verification Performed

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/product-preflight-report.test.ts`
  - Passed: 2 files, 23 tests before Review-Sylph fix loop 1.
  - Passed again after F1 digest formatting fix: 2 files, 23 tests.
- `pnpm.cmd typecheck`
  - Passed after fix loop 1.
  - Initial run failed on test helper branded IDs and an optional `evidenceIndex` passed as `undefined`; both were fixed.
- `pnpm.cmd run check:source`
  - Passed after fix loop 1.
- `pnpm.cmd run check:deps`
  - Passed after fix loop 1.
- `git diff --check -- packages\validator-core\src discussion\implementation\waves\wave44\wave44-domain-e-psd-validator-provenance-security-diagnostics-report.md`
  - Passed; Git reported LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages\validator-core\src\validators\psd-source-evidence-diagnostics.ts`
  - No whitespace findings after fix loop 1; command exits nonzero because it compares an empty device to a new file. Git reported LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion\implementation\waves\wave44\wave44-domain-e-psd-validator-provenance-security-diagnostics-report.md`
  - No whitespace findings after fix loop 1; command exits nonzero because it compares an empty device to a new file. Git reported LF-to-CRLF warning only.
- Parser dependency import search in `packages/validator-core/src/**/*.ts`
  - Passed after fix loop 1; no `@webtoon/psd`, `ag-psd`, or `psd` import pattern was found.

## Remaining Issues

- Domain D/F still need real materialization fixture/evidence population. Domain E uses focused synthetic evidence fixtures only.
- Product Preflight can classify `sourceMaterialization` evidence refs and PSD evidence diagnostics, but it does not persist or export Product Preflight artifacts.
- The validator records materialization metadata and digest/byte length only. It does not prove rendered pixel correctness, texture sampling correctness, or Photoshop compositing correctness.

## User-Decision Points

- None for Domain E.
- Future user decision remains required before any `test_data/sample_model.psd` derived visual bytes can be treated as public distributable demo material.

## Forbidden Scope / Dependency Confirmation

- Did not edit `package.json`, `pnpm-lock.yaml`, dependency registry, `scripts/**`, `packages/package-format/src/**`, `packages/contracts/src/**`, or `packages/operation-core/src/**`.
- Did not import `@webtoon/psd`, `ag-psd`, `psd`, or any PSD parser dependency into validator-core.
- Did not implement parser execution, archive/filesystem behavior, editor UI, full renderer, pixel oracle, Photoshop full compositing, Cubism compatibility, or AI repair generation.
