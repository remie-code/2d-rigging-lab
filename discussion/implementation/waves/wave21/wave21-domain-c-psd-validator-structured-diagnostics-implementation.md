# Wave 21 Domain C Implementation: PSD Validator Structured Diagnostics

## Status

done / pending Review-Sylph review

## Scope

Implemented only Domain C validator changes:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/psd-source-profile-structured.ts`
- `packages/validator-core/src/validators/psd-source-profile.ts`
- `packages/validator-core/src/psd-source-profile.test.ts`

Observed parallel/existing workspace changes under package-format, operation-core, authoring-core, and discussion maps were not edited by this domain.

## Behavior

- Validator now reads `SourceAsset.psdProfile` when present and emits structured, AI-readable PSD diagnostics for:
  - adapter diagnostics via `asset.psd.adapterDiagnostic`
  - group/layer/document unsupported feature details via `asset.psd.unsupportedFeature`
  - flattened fallback mismatch via `asset.psd.flattenedFallbackMismatch`
  - PSD profile on non-PSD source asset via `asset.psd.structuredProfileMismatch`
- Wave20 flattened fallback remains compatible:
  - `sourceLayer.unsupportedFeatures[]` still emits `asset.psd.unsupportedFeature` when `psdProfile` is absent.
  - `asset.psd.structuredProfileMissing` is informational and only emitted when flattened PSD profile evidence exists.
- Split PNG fallback remains on the existing no-PSD-profile path.
- No PSD bytes, decode, raster extraction, parser dependency, runtime-core schema, editor, operation, or authoring implementation changes were made by Domain C.

## Verification

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-source-profile.test.ts`
  - pass, 12 tests
- `pnpm.cmd exec vitest run packages/validator-core/src`
  - pass, 6 files / 40 tests
- `pnpm.cmd typecheck`
  - pass

## Residual Risks

- The new check IDs are registered in validator-core but the design contract document has not yet been refreshed to list them.
- Structured-vs-flattened comparison currently checks unsupported feature ID order exactly, matching deterministic source manifest order.
