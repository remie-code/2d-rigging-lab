# Wave 21 Domain B Completion: PSD Operation Structured Materialization

## Status

pass

## Delegation

- Orch-Sylph: current context.
- Gnome implementation: `Gnome the 5th` (`019e7cbf-b15c-70e3-92ce-a1cf1cf3b589`).
- Review-Sylph: `Sylph the 6th` (`019e7cd3-6b4b-7e11-8437-443ac2c715bc`).
- Review report: `discussion/implementation/reviews/wave21/wave21-domain-b-psd-operation-structured-materialization-review.md`.

## Changed Files

Domain B source and test changes:

- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.test.ts`
- `packages/authoring-core/src/source-asset-mutations.test.ts`

Domain B reports:

- `discussion/implementation/waves/wave21/wave21-domain-b-psd-operation-structured-materialization-implementation.md`
- `discussion/implementation/reviews/wave21/wave21-domain-b-psd-operation-structured-materialization-review.md`
- `discussion/implementation/waves/wave21/wave21-domain-b-psd-operation-structured-materialization-completion.md`

Existing or parallel changes outside Domain B remain present and were not reverted. The workspace includes Domain A package-format changes and parallel Domain C validator-core changes.

## Outcome

`importPsdSourceAsset` now materializes a Domain A structured PSD profile into `sourceAsset.psdProfile` from the trusted adapter result.

The materialized profile includes:

- `schemaVersion: layered-character-psd-profile-v1`
- adapter evidence and adapter result schema version
- canvas metadata
- source groups and source layers
- structured unsupported feature records
- adapter diagnostics
- blend mode metadata when supplied by the adapter result
- compatibility policy:
  - `structured-profile-preferred-v1`
  - `sourceAsset.diagnostics-summary-fallback-v1`
  - `sourceLayer.unsupportedFeatures-feature-id-fallback-v1`

Backward compatibility is preserved:

- `sourceAsset.diagnostics` remains available as a flattened summary.
- `sourceAsset.layers[].unsupportedFeatures` remains available as feature IDs.
- Existing requested layer role overrides still affect the flattened source layer summary.

Texture preview and mapping traceability is preserved through:

- `psdProfile.sourceLayers[].texturePreviewReference`
- `psdProfile.sourceLayers[].textureId`
- `psdProfile.sourceLayers[].targetPartId`
- existing texture atlas preview metadata with matching source asset and source layer IDs

Parser-free truthfulness is preserved. Domain B added no PSD byte read, decode, raster extraction, binary storage, file picker, external parser dependency, runtime-core PSD DTO, or editor UI implementation.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/operation-core/src/operation-schemas.test.ts packages/authoring-core/src/source-asset-mutations.test.ts`
  - pass, 3 files / 14 tests
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- packages/operation-core packages/authoring-core discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`
  - pass; Git emitted LF/CRLF working-copy warnings only
- dependency manifest diff check
  - pass; no dependency manifest or lockfile changes from Domain B
- forbidden scope check
  - pass for Domain B; no Domain B edits under `packages/validator-core/**`, `apps/editor/**`, or `packages/runtime-core/**`

Notes:

- Gnome initially observed a transient `pnpm.cmd typecheck` failure in parallel validator-core work. Orch-Sylph reran `pnpm.cmd typecheck` after review and it passed.
- Current `git diff --name-only` over forbidden scope still shows `packages/validator-core/**` changes owned by parallel Domain C, not Domain B.

## Review Result

Review-Sylph status: pass.

Findings: none at blocking, high, medium, or low severity.

Review confirmed:

- structured PSD profile is materialized from adapter result into source asset metadata
- parser-free truthfulness is maintained
- flattened diagnostics and unsupported feature summaries remain compatible
- source layer, texture preview, texture ID, and target part mapping remain traceable
- source organization and allowed write scope are compliant
- focused operation and authoring tests cover Domain B risks
- no dependency manifest, editor, runtime-core, or `index.ts` implementation changes were introduced by Domain B

## Residual Risks

- Parallel Domain C validator-core changes are outside this Domain B pass and still need their own completion/review gate.
- Contract fixture expected outputs may need Domain D updates because structured profile persistence changes the downstream validation evidence.
- `sourceAsset.psdProfile` remains optional by contract; semantic mismatch checks remain validator responsibility per Domain A/Domain C.

## Downstream Gate

Domain B is pass.

Domain D and Domain E can proceed after Domain C also passes.
