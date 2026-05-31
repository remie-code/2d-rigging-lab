# Wave 20 Domain D Review

> Domain: `wave20-psd-profile-validator-diagnostics`
> Reviewer: Review-Sylph independent clean-context review
> Reviewer context id: not exposed in this subagent context
> Implementer context: `019e7b81-f8ea-7410-84a5-e3a9813fe96d` / Gnome the 69th
> Verdict: `pass`

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave20-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- `discussion/implementation/waves/wave20/wave20-domain-b-completion.md`
- `discussion/implementation/reviews/wave20/wave20-domain-b-review.md`

## Files Reviewed

Domain D source files:

- `packages/validator-core/src/validators/psd-source-profile.ts`
- `packages/validator-core/src/psd-source-profile.test.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/index.ts`

Related validator context:

- `packages/validator-core/src/validators/texture-assets.ts`
- `packages/validator-core/src/validators/drawable-provenance.ts`
- `packages/validator-core/src/validators/drawable-references.ts`
- `packages/validator-core/src/validators/asset-rights.ts`
- `packages/validator-core/src/validation-report.ts`
- `packages/validator-core/src/validation-summary.ts`
- `packages/validator-core/src/source-asset-rights-provenance.test.ts`
- `packages/package-format/src/source-manifest.ts`
- `packages/contracts/src/diagnostics.ts`
- `packages/contracts/src/target-ref.ts`

Parallel Domain C files were observed only as typecheck integration noise and were not reviewed as Domain D implementation.

## Files Changed By This Review

- `discussion/implementation/reviews/wave20/wave20-domain-d-review.md`

No source implementation files were changed by this review.

## Diff Reviewed

Directly reviewed:

```powershell
git diff -- packages/validator-core/src/check-catalog.ts packages/validator-core/src/index.ts packages/validator-core/src/validators/package-runtime.ts
Get-Content -Encoding UTF8 packages/validator-core/src/validators/psd-source-profile.ts
Get-Content -Encoding UTF8 packages/validator-core/src/psd-source-profile.test.ts
```

The tracked validator-core diff adds:

- `asset.psd.unsupportedFeature` and `rights.psdLayerProvenanceMissing` catalog entries.
- a barrel-only export from `packages/validator-core/src/index.ts`.
- a `validatePsdSourceProfiles` call inside `validatePackageRuntime`.

The untracked Domain D files add:

- a focused PSD source profile validator in `packages/validator-core/src/validators/psd-source-profile.ts`;
- focused tests in `packages/validator-core/src/psd-source-profile.test.ts`.

Dependency/runtime boundary checks:

```powershell
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/runtime-core
```

Result: no output.

```powershell
rg -n 'psd-source|layered-character|unsupportedFeature|Photoshop|PSD' packages/runtime-core/src packages/runtime-core/package.json
```

Result: no output.

## Verification Performed

```powershell
pnpm.cmd exec vitest run packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/source-asset-rights-provenance.test.ts
```

Initial sandbox result: failed with `EPERM` reading the pnpm-installed Vitest file.

Escalated re-run result: pass, `2` test files and `20` tests passed.

```powershell
pnpm.cmd exec vitest run packages/validator-core/src
```

Initial sandbox result: failed with `EPERM` reading the pnpm-installed Vitest file.

Escalated re-run result: pass, `6` test files and `35` tests passed.

```powershell
pnpm.cmd typecheck
```

Initial sandbox result: failed with `EPERM` reading the pnpm-installed TypeScript file.

Escalated re-run result: root `tsc --noEmit` passed, then editor typecheck failed on parallel Domain C operation-core references:

- `packages/operation-core/src/operation-registry.ts(12,54): Cannot find module './operations/import-psd-source-asset.js'`
- `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts(4,8): Cannot find module './import-psd-source-asset.js'`

This is not a Domain D validator-core failure. It differs from the earlier reported Domain C `JsonValue` errors because the current parallel Domain C worktree has changed, but it remains isolated to operation-core.

```powershell
git diff --check -- packages/validator-core fixtures/contracts discussion/implementation/waves/wave20 discussion/implementation/reviews/wave20
```

Result before this report was written: pass. Output contained only Git LF/CRLF working-copy warnings for tracked validator-core files.

Additional review commands:

- `git status --short -uall`
- `git diff --name-only`
- `rg -n "validatePsdSourceProfiles|isPsdSourceProfile|createUnsupportedFeatureCheck|createMissingLayerProvenanceCheck|asset\\.psd\\.unsupportedFeature|rights\\.psdLayerProvenanceMissing" packages/validator-core/src/validators/psd-source-profile.ts`
- `rg -n "registers PSD|adapter-backed PSD|unsupported PSD|missing PSD layer provenance|missing texture preview|source-layer mismatch|split PNG fallback" packages/validator-core/src/psd-source-profile.test.ts`
- `rg -n "asset\\.psd\\.unsupportedFeature|rights\\.psdLayerProvenanceMissing|validatePsdSourceProfiles|validators/psd-source-profile" packages/validator-core/src/check-catalog.ts packages/validator-core/src/validators/package-runtime.ts packages/validator-core/src/index.ts`
- `rg -n "reports a visible split PNG|reports a visible PSD source-backed|keeps the no-atlas generated|texture source layer metadata" packages/validator-core/src/source-asset-rights-provenance.test.ts`
- `rg -n 'node:fs|readFile|BinaryReader|OpenRead|Photoshop|raster|decode|parser|image data|channel' packages/validator-core/src/validators/psd-source-profile.ts packages/validator-core/src/psd-source-profile.test.ts`

## Findings

No blocking findings.

No non-blocking findings requiring a Domain D source fix.

## Design / Development Compliance Review

Pass.

- Parser-free truthfulness is preserved. `validatePsdSourceProfiles` reads only `PackageDocumentDto` source manifest, drawable, and provenance DTOs. It performs no filesystem IO, binary PSD read, image decode, channel read, raster extraction, parser invocation, or Photoshop rendering claim.
- `asset.psd.unsupportedFeature` is structured and source-targeted. The diagnostic is created from `sourceLayer.unsupportedFeatures[]`, uses `target.kind="sourceAsset"`, targets the exact source manifest path, carries `sourceAssetId`, source kind, import profile, source layer ID, unsupported feature, feature index, AC/scenario traceability, and an impact string that frames the issue as review/future adapter work.
- Missing PSD layer provenance fits existing contract support. The implementation uses `sourceLayer.mappedDrawableIds[]`, `drawable.sourceProvenanceId`, and `assets.provenance.records[]` rather than inventing a PSD-specific runtime path. It emits `rights.psdLayerProvenanceMissing` when a mapped drawable is missing, its provenance record is missing, or its provenance record does not belong to the PSD source asset.
- Missing texture preview and source-layer mismatch remain on the existing texture validator path. PSD tests exercise `ref.texturePreviewMissing` and `ref.textureSourceLayerMismatch`, while existing split PNG and generated fixture tests still cover the compatible non-PSD paths.
- Runtime-core non-leakage is confirmed. `packages/runtime-core` has no diff and no PSD/source-profile references were found. The validator imports package-format DTOs and validator report schemas, not PSD parser or runtime-core PSD structures.
- Source organization is acceptable. `psd-source-profile.ts` is a named validator file with one cohesive responsibility. `index.ts` remains barrel-only and only adds `export * from "./validators/psd-source-profile.js";`.
- Dependency policy is satisfied. No manifest or lockfile diff was observed, and no PSD/image parser dependency or binary PSD handling was introduced.
- Domain D stayed in validator-core scope. Operation, authoring, editor, dependency, and runtime changes observed in the worktree are attributable to parallel Domain C or prior domains, not this Domain D implementation.

## Test Adequacy Review

Pass.

- Valid adapter-backed PSD source profile coverage exists in `packages/validator-core/src/psd-source-profile.test.ts`. The fixture includes PSD source asset metadata, source layer mapping, drawable, texture atlas entry, preview asset, source provenance, texture provenance, and rights records, and validates with no checks.
- Unsupported feature coverage asserts `asset.psd.unsupportedFeature` status, severity, phase, source target path, AC/scenario traceability, and evidence values.
- Missing layer provenance coverage mutates `drawable.sourceProvenanceId`, verifies `rights.psdLayerProvenanceMissing`, and confirms the existing generic drawable provenance diagnostic still appears.
- Missing texture preview coverage removes `textureAtlas.previewAssets` and verifies the existing `ref.texturePreviewMissing` diagnostic remains source-aware for a PSD source asset.
- Source-layer mismatch coverage changes both texture and preview source layer metadata and verifies `ref.textureSourceLayerMismatch` against the expected PSD source layer.
- Split PNG compatibility coverage converts the same fixture to `split-png-set-v1` / `split-png-fallback-v1` and verifies no PSD-specific diagnostics fire.
- Existing `source-asset-rights-provenance.test.ts` still covers split PNG missing texture, PSD missing texture atlas, generated-fixture no-atlas exception, and texture source-layer mismatch.
- Focused and full validator-core Vitest runs passed after sandbox `EPERM` was resolved by escalation.

## Residual Risks

- Full repository `pnpm.cmd typecheck` is currently blocked by parallel Domain C operation-core references, not by Domain D. Integrator should require a clean typecheck after Domain C stabilizes.
- `rights.psdLayerProvenanceMissing` is registered in implementation catalog and covered by tests, but the design contract document does not yet list that exact new check ID. This is acceptable for Domain D, but should be mirrored when the validator contract/check registry docs are refreshed.
- Package-format still stores `unsupportedFeatures` as strings, so Domain D intentionally flattens structured adapter unsupported-feature metadata into `sourceLayer.unsupportedFeatures[]` diagnostics. This is truthful and documented in evidence, but richer unsupported-feature fields remain a future contract/schema decision.
- The validator can only validate adapter/materialized metadata already present in the package document. It does not and should not prove actual PSD layer contents from `test_data/sample_model.psd`.

## Domain Gate

Domain D can pass.
