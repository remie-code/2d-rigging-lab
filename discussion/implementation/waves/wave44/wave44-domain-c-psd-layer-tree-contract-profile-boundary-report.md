# Wave44 Domain C Report: PSD Layer Tree Contract / Profile Boundary

> Target: `wave44-psd-layer-tree-contract-profile-boundary`
> Drafted by: Gnome implementation agent
> Review status: pass after independent Review-Sylph re-review; fix loop 1 resolved F1

## Verdict

`pass`

Domain C implemented additive, parser-free contract/profile boundary changes for real PSD parse result intake. The source schema can now carry real PSD layer tree evidence, feature support evidence, and selected layer materialization evidence without storing parser-private layer objects.

## Files Changed

- `packages/contracts/src/product-preflight-report.ts`
- `packages/contracts/src/product-preflight-report.test.ts`
- `packages/package-format/src/psd-source-evidence.ts`
- `packages/package-format/src/source-manifest.ts`
- `packages/package-format/src/source-manifest.test.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.test.ts`
- `discussion/implementation/waves/wave44/wave44-domain-c-psd-layer-tree-contract-profile-boundary-report.md`

## Contract / Profile Changes

- Added `psd-source-evidence.ts` as a focused package-format schema owner for:
  - `psd-parser-evidence-v1`
  - `psd-layer-tree-evidence-v1`
  - `psd-feature-support-evidence-v1`
  - `psd-layer-materialization-evidence-v1`
- Extended `LayeredCharacterPsdProfileSchema` additively with optional:
  - `adapter.adapterVersion`
  - `adapter.intakeKind`
  - `adapter.parser`
  - `featureSupportEvidence`
  - per-group and per-layer `featureSupportEvidence`
  - `layerTreeEvidence`
  - `materializationEvidence`
- Extended `PsdAdapterResultSchema` additively so operation-core can accept the same parser-free evidence DTOs and preserve them into source manifest metadata.
- Added Product Preflight artifact kind/ref `sourceMaterialization` with generated path `generated/source-materialization/*.json`.

## Compatibility Evidence

- Existing parser-free PSD adapter result compatibility is preserved: previous adapter-only fixtures still parse and tests continue to pass.
- Existing flattened fallback fields remain unchanged:
  - `sourceAsset.diagnostics`
  - `sourceLayer.unsupportedFeatures`
  - `LayeredCharacterPsdProfile.compatibility`
- New real parse metadata is optional. No schema-breaking rename was introduced.
- Public schema records parser identity/version/options only. Parser-private raw layer objects remain rejected by strict Zod schemas.
- No `@webtoon/psd`, `ag-psd`, or other parser dependency import was added in Domain C source.

## Unsupported / Not-Evaluated Evidence

- Unsupported and not-evaluated Photoshop features are represented through `psd-feature-support-evidence-v1` with status values:
  - `unsupported`
  - `notEvaluated`
- Tests cover `psd.layerEffects` as unsupported evidence and `psd.fullCompositing` as not-evaluated evidence.
- No full compositing, renderer, pixel oracle, Cubism compatibility, or public demo asset claim was added.

## Materialization Evidence Boundary

`psd-layer-materialization-evidence-v1` records:

- source layer ref: `sourceAssetId`, `sourceLayerId`, optional `sourceLayerPath`
- `mediaType`
- `byteLength`
- SHA-256 `digest`
- optional `binaryAssetRef`
- optional `textureId`
- provenance including source path, source byte length/digest/media type, privacy label, and `notPublicDistributable`
- optional parser evidence
- optional extraction options

This is evidence shape only. Domain C did not implement raster extraction or claim Photoshop-style compositing.

## Verification Performed

- `pnpm.cmd exec vitest run packages/contracts/src/product-preflight-report.test.ts packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts`
  - Result: passed, 23 tests before and after fix loop 1.
- `pnpm.cmd typecheck`
  - Result: passed before and after fix loop 1.
- `pnpm.cmd run check:source`
  - Result: passed before and after fix loop 1.
- `git diff --check -- packages\contracts\src packages\package-format\src packages\operation-core\src`
  - Result: passed; Git reported LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL packages\package-format\src\psd-source-evidence.ts`
  - Result: no whitespace findings; exit code was non-zero because no-index compares an empty device to a real file. Git reported LF-to-CRLF warning only.
- Fixed-string searches for parser dependency imports in Domain C source:
  - `from "@webtoon/psd"`: no matches.
  - `import("@webtoon/psd")`: no matches.
  - `from "ag-psd"`: no matches.
  - `import("ag-psd")`: no matches.

Fix loop 1 added explicit assertions that materialization evidence preserves source digest, source byte length, source media type, derived artifact path, generator id, and materialization-local parser evidence in both package-format serialization and operation-core profile materialization tests.

Independent Review-Sylph final verdict: `pass`. Review artifact:

- `discussion/implementation/reviews/wave44/wave44-domain-c-psd-layer-tree-contract-profile-boundary-review.md`

## Observed External Changes

The final working tree also shows changes outside Domain C scope, including:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `scripts/wave44-psd-parser-smoke.mjs`
- Wave44 Domain B report
- existing Wave44 orchestration / Domain A discussion artifacts
- capability map / backlog / orchestration map updates

Domain C did not edit those files and did not revert them.

## Remaining Issues

- Domain D still needs to populate materialization evidence from actual selected layer raster extraction.
- Domain E still needs validator/Product Preflight diagnostics over parsed PSD, materialization, and unsupported/not-evaluated evidence.
- `sourceMaterialization` Product Preflight refs define generated evidence refs only; they do not imply persisted package artifact export or renderer correctness.

## User-Decision Points

- None for Domain C.
- A future user decision remains required before any `test_data/sample_model.psd` derived visual bytes can be treated as public distributable demo material.

## Early Escape

No early escape trigger was hit.
