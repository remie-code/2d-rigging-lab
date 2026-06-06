# Wave47 Domain E Review: Validator / Product Preflight Batch Diagnostics

> Target: `wave47-validator-product-preflight-batch-diagnostics`
> Role: Review-Sylph independent review
> Verdict: `pass`

## Verdict

`pass`

Fix-loop re-review passes. The two prior P1 findings are resolved: Product Preflight availability now fails malformed successful batch evidence with inconsistent entry statuses/counts, and `asset.psd.materializedBatchEntryMissing` is registered in the check catalog and covered by regression tests.

The implementation remains parser-free, stays in `packages/validator-core/src/**`, does not add dependencies, keeps `index.ts` barrel-only, and does not create a persisted/exported Product Preflight artifact.

This review does not approve all-layer import, recursive group import, Editor UX, operation-core/package-format changes, renderer or pixel oracle proof, Photoshop compositing proof, public demo asset use, dependency changes, or persisted/exported Product Preflight artifacts.

## Prior Findings Resolved

Both prior P1 findings are retained here for traceability. The fix-loop re-review found no remaining blocking or non-blocking issues.

### Resolved P1: Product Preflight can mark non-success batch entries as available

- `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:269`
- `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:281`
- `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:284`
- `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:495`

`validateBatchEvidence` emits `asset.psd.materializedBatchAvailable` when there is no `fail` or `needs_review` check and `aggregateStatus === "success"`. But `validateBatchEntry` returns no checks for any entry whose `status` is not `"success"`, including `"preflightReady"` and `"preflightBlocked"`, and aggregate validation only checks `successCount <= selectedLayerCount` / `failureCount <= selectedLayerCount`. It does not require:

- all entries to have `status === "success"` when `aggregateStatus === "success"`;
- `successCount` to equal the number of successful entries;
- `failureCount` to equal the number of failed/preflight-blocked entries;
- `successCount + failureCount` to match `selectedLayerCount`.

Impact: malformed or stale session batch evidence can truthfully parse, skip per-layer byte/provenance/scaffold validation, and still produce `materializedBatchAvailable`. That violates the Domain E requirement that Product Preflight map batch checks to available/warning/blocking/not_evaluated truthfully.

Expected fix: treat inconsistent aggregate/status/count evidence as `asset.psd.materializedBatchEvidenceMismatch` or another registered blocking diagnostic, and add focused regression coverage for `aggregateStatus: "success"` with non-success entries and inconsistent counts.

Fix-loop result: resolved. `validateBatchAggregateStatus` now compares `successCount` and `failureCount` to actual entry statuses, fails success aggregates with non-success entries, and emits `asset.psd.materializedBatchEvidenceMismatch` before availability can be emitted. Regression coverage at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:228` asserts no `asset.psd.materializedBatchAvailable` check and Product Preflight `assetBytes=fail`.

### Resolved P1: `asset.psd.materializedBatchEntryMissing` is emitted but not registered

- `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:511`
- `packages/validator-core/src/check-catalog.ts:796`
- `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:108`

When a successful batch entry has no matching per-layer materialization evidence, the validator emits `asset.psd.materializedBatchEntryMissing`. That ID is not registered in `defaultCheckCatalog`, is not listed in the Domain E report's diagnostic list, and is not included in the catalog-registration test. `rg` found the ID only at the emitting source line.

Impact: this creates an uncataloged validator diagnostic on an MVP/Product Preflight path, which conflicts with the diagnostic policy requirement that active formal diagnostics remain catalog-backed and traceable.

Expected fix: either register and test `asset.psd.materializedBatchEntryMissing`, or reuse an existing registered batch diagnostic such as `asset.psd.materializedBatchEvidenceMismatch` / `asset.psd.materializedBatchBytesMissing` if that is the intended classification.

Fix-loop result: resolved. `asset.psd.materializedBatchEntryMissing` is registered in `packages/validator-core/src/check-catalog.ts:828`, included in catalog-registration coverage at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:118`, and covered by a regression at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:260`.

## Review Lanes

### Design / Development Compliance

- Pass: No direct `@webtoon/psd` or `ag-psd` import/require was found under `packages/validator-core`.
- Pass: The new validator reads parser-free operation evidence through a local Zod schema and does not import operation-core or parser implementation.
- Pass: Product Preflight changes are limited to not-evaluated mapping for required missing batch evidence; no persisted/exported Product Preflight artifact was added.
- Pass: `packages/validator-core/src/index.ts` remains barrel-only.
- Pass: Product Preflight availability now blocks inconsistent successful batch evidence with `asset.psd.materializedBatchEvidenceMismatch`.
- Pass: All emitted `asset.psd.materializedBatch*` diagnostics are catalog-backed and covered by catalog-registration tests.

### Test Adequacy

- Pass: Existing focused tests cover valid two-layer batch evidence, source-current-byte warning, stale/mismatch package evidence, duplicate/collision/preflight block, missing evidence not_evaluated, missing private/local provenance, and public demo blocking through existing diagnostics.
- Pass: Fix-loop tests cover malformed `aggregateStatus: "success"` evidence with non-success entries and inconsistent success/failure counts.
- Pass: Fix-loop tests cover the successful-entry/materialization-missing path that emits `asset.psd.materializedBatchEntryMissing`.

## Verification Performed

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/psd-import-preflight-diagnostics.test.ts`: pass, 5 files / 47 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- Direct parser import scan under `packages/validator-core`: no matches for direct `@webtoon/psd` / `ag-psd` import or require; `rg` exited `1`.
- `git diff --check -- packages/validator-core/src discussion/implementation/waves/wave47/wave47-domain-e-validator-product-preflight-batch-diagnostics-report.md`: CRLF warnings only, no whitespace findings.
- `git diff --no-index --check -- NUL` for the new Domain E source, test, report, and review files: expected no-index exit `1`, CRLF warnings only, no whitespace findings.
- Targeted persistence/export search found no new write/export path for Product Preflight artifacts in the Domain E validator changes; batch evidence remains session-only.

Sandboxed PowerShell reads initially failed with `windows sandbox: spawn setup refresh`; review reads and verification commands were rerun with approved escalation.

## Files Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave47-plan.md`
- `discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md`
- `discussion/implementation/waves/wave47/wave47-domain-c-package-operation-batch-intake-part-scaffold-bridge-report.md`
- `discussion/implementation/reviews/wave47/wave47-domain-c-package-operation-batch-intake-part-scaffold-bridge-review.md`
- `discussion/implementation/waves/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-orch-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave47/wave47-domain-e-validator-product-preflight-batch-diagnostics-report.md`
- `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts`
- `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- Narrow Domain C source reads for operation diagnostic shape.

## Files Changed By Reviewer

- `discussion/implementation/reviews/wave47/wave47-domain-e-validator-product-preflight-batch-diagnostics-review.md`

No source implementation, dependency manifest, lockfile, fixture byte, raw visual byte, public demo asset file, Editor file, operation-core file, or package-format file was edited by this reviewer.

## Remaining Issues

No remaining Domain E issues.

## User-Decision Points

None. These are implementation correctness and diagnostic-catalog consistency fixes within the existing Domain E scope.

## Gnome Fix Loop

Required: no.
