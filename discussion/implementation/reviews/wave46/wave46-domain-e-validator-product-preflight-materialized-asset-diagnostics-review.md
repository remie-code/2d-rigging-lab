# Wave46 Domain E Review: Validator / Product Preflight Materialized Asset Diagnostics

> Target: `wave46-validator-product-preflight-materialized-asset-diagnostics`
> Date: 2026-06-05
> Reviewer: Review-Sylph independent post-fix review agent
> Review mode: clean, source-and-test-grounded post-fix review

## Verdict

`pass`

The prior blocking findings are fixed. The implementation remains parser-free under `packages/validator-core`, recognizes valid package-local raw RGBA materialized selected-layer bytes with source/layer provenance, and maps Product Preflight status honestly to the existing pass/warn/fail/not_evaluated vocabulary.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave46-plan.md`
- `discussion/implementation/waves/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-review.md`
- `discussion/implementation/waves/wave46/wave46-domain-c-package-operation-texture-intake-part-mapping-bridge-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-c-package-operation-texture-intake-part-mapping-bridge-review.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Scope Reviewed

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/validators/package-schema.ts`
- `packages/validator-core/src/validators/psd-source-profile.ts`
- `packages/validator-core/src/validators/psd-materialized-asset-diagnostics.ts`
- `packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts`
- This review artifact

Other uncommitted Wave46 domain changes were present in the worktree and treated as out of scope.

## Findings

No blocking or non-blocking findings.

## Prior Findings Rechecked

- Fixed: destination texture identity is now checked against the materialized binary asset reference. `validateDestinationMapping` calls materialized texture identity checks, and `createTextureMaterializedBinaryMismatchReasons` compares texture file path, content hash, provenance id, binary asset id, package path, digest, byteLength, mediaType, storage status, provenance id, and rights asset id against `materialization.binaryAssetRef` in `packages/validator-core/src/validators/psd-materialized-asset-diagnostics.ts:460` and `packages/validator-core/src/validators/psd-materialized-asset-diagnostics.ts:564`. The focused regression at `packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts:235` mutates the texture atlas to unrelated bytes and verifies `asset.psd.materializedDestinationMappingMissing` fails and `asset.psd.materializedAssetAvailable` is not emitted.
- Fixed: Wave46 raw RGBA media type is enforced before availability. `validateMaterializedByteReference` now emits `materialized-media-type-not-wave46-raw-rgba` and `binary-media-type-not-wave46-raw-rgba` mismatch reasons in `packages/validator-core/src/validators/psd-materialized-asset-diagnostics.ts:199` and `packages/validator-core/src/validators/psd-materialized-asset-diagnostics.ts:202`. The regression at `packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts:277` verifies matching non-raw `image/png` metadata still fails and does not get the available check.

## Passing Review Points

- Parser boundary: no direct `@webtoon/psd` or `ag-psd` import/require was found under `packages/validator-core`. Fixed-string hits were parser evidence strings in tests only.
- Diagnostics are parser-free and raw-parser-object-free. The new diagnostics import only package/contract DTO types and emit `validatorBoundary=no-parser-execution`, `rawParserObject=notPersisted`, and `rawMaterializedBytes=notInlined` evidence.
- Valid package-local materialized selected-layer bytes are recognized as available only after byte ref, raw RGBA media type, source provenance, parser/extraction/layer ref, private/local provenance, texture, drawable, and part mapping checks have no failing or not-evaluated issue. See `packages/validator-core/src/validators/psd-materialized-asset-diagnostics.ts:142`, `:247`, `:343`, `:414`, `:460`, and `:618`.
- Missing materialized binary refs, non-package-local storage, digest/byteLength/mediaType/path mismatches, raw RGBA byteLength/dimension mismatch, stale source digest/byteLength, missing current source bytes, parser/extraction/layer mismatch, private/local provenance gaps, and `publicDemoAsset=true` are diagnosed.
- Schema-level `publicDemoAsset=true` remains visible as `asset.psd.materializedProvenanceBlocked` even though the package schema rejects that value, via `packages/validator-core/src/validators/package-schema.ts:91` and `packages/validator-core/src/validators/package-schema.ts:138`.
- PSD layer drawable provenance accepts the new private/local materialized layer provenance path without requiring the drawable provenance record to be a source asset record, while still requiring matching source asset/layer and `publicDemoAsset=false` at `packages/validator-core/src/validators/psd-source-profile.ts:160`.
- Product Preflight maps failing diagnostics to `fail`, warning diagnostics to `warn`, and absent destination mapping to `not_evaluated` with `sourceMaterialization` evidence in `packages/validator-core/src/product-preflight-report.ts:737` and `packages/validator-core/src/product-preflight-report.ts:745`. No persisted/exported Product Preflight artifact was added.
- Source organization is acceptable. The new diagnostics file is a named validator concern, no catch-all file was added, no implementation-heavy barrel was added, and `pnpm.cmd run check:source` passed.
- Scope stayed within Domain E allowed paths: validator-core source/tests and this review artifact. No Editor UI, parser implementation, dependency manifest, lockfile, renderer, or Product Preflight export/persistence area was edited by Domain E.

## Test Adequacy

Focused coverage is adequate for this domain. The new test file covers catalog registration, valid raw RGBA package-local availability, missing current source bytes as Product Preflight warning, stale source and materialized metadata, parser/extraction/layer-ref mismatch, destination mapping absence as Product Preflight not_evaluated, destination texture binary mismatch, non-raw media mismatch, missing private/local provenance, and `publicDemoAsset=true`.

Related existing Product Preflight and PSD profile tests also pass, covering the changed status mapping and source profile integration.

## Verification Performed

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts`: pass, 8 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/psd-source-profile.test.ts`: pass, 23 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- Parser string scan under `packages/validator-core`: fixed-string `@webtoon/psd` hits were evidence/test strings only; no `ag-psd` hits.
- `rg -n "require\s*\(" packages\validator-core`: no hits.
- `git diff --check -- packages/validator-core/src/check-catalog.ts packages/validator-core/src/product-preflight-report.ts packages/validator-core/src/validators/package-schema.ts packages/validator-core/src/validators/psd-source-profile.ts packages/validator-core/src/validators/psd-materialized-asset-diagnostics.ts packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts discussion/implementation/reviews/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-review.md`: pass with LF/CRLF warnings only before this artifact rewrite.
- `git diff --check --no-index -- NUL packages/validator-core/src/validators/psd-materialized-asset-diagnostics.ts`: no whitespace findings; exit code 1 was expected for no-index diff, output was LF/CRLF warning only.
- `git diff --check --no-index -- NUL packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts`: no whitespace findings; exit code 1 was expected for no-index diff, output was LF/CRLF warning only.
- `git diff --check --no-index -- NUL discussion/implementation/reviews/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-review.md`: no whitespace findings before this artifact rewrite; final artifact whitespace was rechecked after writing.

## Remaining Issues / User-Decision Points

None for Domain E.

Future product decisions remain outside this domain: encoded texture media types, public/demo asset policy, all-layer PSD import, drag-drop/archive/filesystem workflows, renderer/pixel oracle, advanced topology/UV/atlas work, and Cubism policy reconsideration.

## Review Separation

I did not edit source files and did not rely on the implementer's summary as the source of truth. This review inspected basis documents, source, tests, diffs, and verification output directly. The only file written by this reviewer is this review artifact.
