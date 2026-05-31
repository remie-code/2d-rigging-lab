# Wave 21 Domain B Implementation: PSD Operation Structured Materialization

## Status

needs_review

## Scope

Target: `wave21-psd-operation-structured-materialization`

Implemented in allowed Domain B scope only:

- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.test.ts`
- `packages/authoring-core/src/source-asset-mutations.test.ts`

No Domain B edits were made under:

- `packages/validator-core/**`
- `apps/editor/**`
- `packages/runtime-core/**`
- dependency manifests or lockfiles

The workspace already contains parallel validator-core changes from another domain. Those remain untouched.

## Implementation Notes

`importPsdSourceAsset` now materializes `sourceAsset.psdProfile` from the trusted `adapterResult` at the same time it writes the existing flattened source asset metadata.

Structured profile materialization includes:

- `schemaVersion: layered-character-psd-profile-v1`
- adapter evidence with adapter name, adapter result schema version, source profile, and `adapter-supplied-metadata-v1`
- canvas metadata
- source groups
- source layers
- structured unsupported feature records
- adapter diagnostics
- Domain A compatibility policy:
  - `structured-profile-preferred-v1`
  - `sourceAsset.diagnostics-summary-fallback-v1`
  - `sourceLayer.unsupportedFeatures-feature-id-fallback-v1`

Flattened compatibility is preserved:

- `sourceAsset.diagnostics` is still produced by `createPsdSourceAssetDiagnostics`.
- `sourceAsset.layers[].unsupportedFeatures` still stores feature IDs only.
- requested layer role overrides still affect the flattened `sourceAsset.layers[]` summary.
- `psdProfile.sourceLayers[]` preserves the adapter-supplied role and full structured metadata.

Traceability is preserved:

- adapter `texturePreviewReference`, `textureId`, and `targetPartId` are copied into `psdProfile.sourceLayers[]`
- existing texture preview materialization continues to write texture atlas and preview asset metadata with matching `sourceAssetId` and `sourceLayerId`
- group/layer target part IDs remain included in operation target collection and deterministic diagnostics

Minimal payload contract alignment:

- Added optional `blendMode` metadata to PSD adapter source groups and layers so operation-core does not drop the Domain A structured profile blend mode fields during request parsing.
- No parser, PSD byte read, decode, raster extraction, file picker, or external dependency was added.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/operation-core/src/operation-schemas.test.ts packages/authoring-core/src/source-asset-mutations.test.ts`
  - pass, 3 files / 14 tests
- `git diff --check -- packages/operation-core packages/authoring-core discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`
  - pass; Git emitted LF/CRLF working-copy warnings only
- dependency manifest diff check
  - pass; no diff in root/workspace/app/package manifests or lockfile
- forbidden implementation scan over changed Domain B production files
  - pass; matches are existing metadata fields / diagnostics for `rasterizeCandidate` and rejected `generated://texture-preview` references, not parser/decode/raster implementation

Additional checks run with known external blockers:

- `pnpm.cmd typecheck`
  - fail in `packages/validator-core/src/psd-source-profile.test.ts` because `expectPsdProfile` is undefined
  - validator-core is forbidden for Domain B and currently has parallel Domain C changes, so this was not edited here
- `pnpm.cmd exec vitest run packages/operation-core/src/psd-import-contract-fixtures.test.ts`
  - fail because structured `psdProfile` now causes validator structured PSD diagnostics to appear, while existing fixture expected validation JSON still reflects Wave20 flattened expectations
  - fixture expected-output updates are owned by later fixture/validator domains, not Domain B

## Residual Risks

- Root typecheck cannot be used as Domain B pass evidence until the parallel validator-core test helper issue is resolved by its owning domain.
- Existing PSD contract fixture expected validation reports are stale after structured materialization triggers structured validator diagnostics. Updating those fixtures is outside Domain B ownership.
- `sourceAsset.psdProfile` is optional and semantic mismatches remain validator responsibility per Domain A.
