# Wave47 Domain E Report: Validator / Product Preflight Batch Diagnostics

> Target: `wave47-validator-product-preflight-batch-diagnostics`
> Role: Gnome
> Verdict candidate: `pass`

## Verdict Candidate

`pass`

Domain E added parser-free validator/Product Preflight diagnostics for explicit multi-layer PSD selected-layer batch materialized asset evidence from Domain C. The implementation stays inside `packages/validator-core/src/**`, adds no dependency, imports no PSD parser, and does not create a persisted/exported Product Preflight artifact. Batch evidence is accepted only as session input to validator-core validation report construction.

This work does not claim all-layer import, recursive group import, drag-drop/archive/filesystem, Photoshop compositing correctness, renderer/pixel oracle proof, texture sampling correctness, Cubism compatibility, public demo asset status, or source PSD byte persistence.

## Implementation Summary

- Added `validatePsdMaterializedBatchDiagnostics` as a named validator concern for Wave47 batch evidence.
- Added optional session-only `psdLayerMaterializationBatchEvidence` and `requirePsdLayerMaterializationBatchEvidence` inputs to `validatePackageRuntime` / `validatePackageRuntimeWithBinaryAssets`.
- Added Product Preflight `not_evaluated` mapping for required-but-missing batch materialization evidence.
- Registered Wave47 batch diagnostic IDs in `defaultCheckCatalog`.
- Added focused tests for valid two-layer generated part scaffold evidence, missing source current bytes warning, stale/missing/mismatched bytes, duplicate/collision/preflight blocking, missing batch evidence `not_evaluated`, missing private/local provenance, and existing `publicDemoAsset=true` blocking behavior.

The validator-side batch evidence schema is a local parser-free Zod reader for Domain C's JSON evidence shape. It does not import `operation-core`, does not import parser code, and does not persist operation evidence into package data.

## Fix Loop Notes

Review-Sylph returned `needs_fix` with two P1 findings. The fix loop resolved both:

- Availability truthfulness: `aggregateStatus: "success"` now requires entry statuses and summary counts to agree. A success aggregate with non-success entries, mismatched `successCount`, or mismatched `failureCount` emits `asset.psd.materializedBatchEvidenceMismatch` and does not emit `asset.psd.materializedBatchAvailable`.
- Catalog traceability: `asset.psd.materializedBatchEntryMissing` is now registered in `defaultCheckCatalog`, covered by the catalog-registration test, and listed below.

Focused regressions now cover malformed success aggregate evidence and successful entries with no matching per-layer materialization evidence.

## Diagnostic IDs / Product Preflight Mapping

Batch availability:

- `asset.psd.materializedBatchAvailable` -> pass / Product Preflight `assetBytes=pass`
- `asset.psd.materializedBatchSourceCurrentBytesMissing` -> warning / Product Preflight `assetBytes=warn`
- `asset.psd.materializedBatchEvidenceMissing` -> needs_review / Product Preflight `assetBytes=not_evaluated`

Batch blocking:

- `asset.psd.materializedBatchEvidenceMismatch`
- `asset.psd.materializedBatchBytesMissing`
- `asset.psd.materializedBatchEntryMissing`
- `asset.psd.materializedBatchSourceStale`
- `asset.psd.materializedBatchAssetMismatch`
- `asset.psd.materializedBatchProvenanceBlocked`
- `asset.psd.materializedBatchDestinationParentInvalid`
- `asset.psd.materializedBatchGeneratedScaffoldMismatch`
- `asset.psd.materializedBatchDuplicateLayer`
- `asset.psd.materializedBatchGeneratedScaffoldCollision`
- `asset.psd.materializedBatchPreflightBlocked`
- `asset.psd.materializedBatchPartialFailure`

Existing Wave46/package-schema diagnostics still cover per-layer single materialization checks and `publicDemoAsset=true` schema rejection through `asset.psd.materializedProvenanceBlocked`.

## Files Changed

- `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts`
- `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `discussion/implementation/waves/wave47/wave47-domain-e-validator-product-preflight-batch-diagnostics-report.md`

No `apps/editor/**`, `packages/operation-core/**`, `packages/package-format/**`, `scripts/**`, dependency manifest, lockfile, parser implementation, or Product Preflight artifact export/persistence file was edited by this Domain E implementation.

## Verification Performed

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/psd-import-preflight-diagnostics.test.ts`
  - Passed after fix loop: 5 files / 47 tests.
- `pnpm.cmd typecheck`
  - Passed after fix loop.
- `pnpm.cmd run check:source`
  - Passed.
- `pnpm.cmd run check:deps`
  - Passed.
- Parser import scan under `packages/validator-core`:
  - `rg -n --glob '*.ts' --glob '*.tsx' 'from\s+[''"](@webtoon/psd|ag-psd)[''"]|require\(\s*[''"](@webtoon/psd|ag-psd)[''"]\s*\)' packages\validator-core`
  - No matches; `rg` exited `1`, meaning no direct parser import/require hits.
- `git diff --check -- packages\validator-core\src discussion\implementation\waves\wave47`
  - Passed with CRLF warnings only; no whitespace findings.

Sandboxed PowerShell commands initially failed with `windows sandbox: spawn setup refresh`; required reads and verification commands were run with approved escalation.

## Remaining Issues

- Domain E does not validate persisted operation logs or export Product Preflight artifacts. Batch evidence remains session input, matching the assigned scope.
- Future decisions outside this domain remain: larger batch caps, hidden-layer support, all-layer/recursive import, renderer or pixel oracle proof, encoded texture media types, and public demo asset policy changes.

## User-Decision Points

None.
