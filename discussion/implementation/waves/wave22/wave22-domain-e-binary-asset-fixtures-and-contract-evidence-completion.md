# Wave 22 Domain E Completion: Binary Asset Fixtures And Contract Evidence

> Target: `wave22-binary-asset-fixtures-and-contract-evidence`  
> Implementer: Gnome  
> Date: 2026-05-31  
> Status: `pass`

## Summary

Domain E added a rights-clean deterministic binary asset contract fixture and focused package-format, operation-core, and validator-core fixture tests.

The fixture does not commit PSD, PNG, image, or third-party binary files. It stores deterministic integer arrays in JSON and materializes `Uint8Array` values only inside tests. The bytes use `application/octet-stream`, do not begin with PSD or PNG signatures, and are documented as synthetic test bytes not copied or derived from `test_data/sample_model.psd`.

## Changed Files

| File | Responsibility |
|---|---|
| `fixtures/contracts/binary-asset-package-local-reference/fixture-manifest.json` | Fixture manifest and explicit deterministic byte / no PSD / no PNG / no third-party policy. |
| `fixtures/contracts/binary-asset-package-local-reference/deterministic-test-bytes.json` | Fixture-local deterministic byte recipe, SHA-256 digests, byte lengths, media type, storage status, rights/provenance IDs, and non-image policy evidence. |
| `fixtures/contracts/binary-asset-package-local-reference/baseline-package.json` | Minimal pre-import package for operation materialization coverage. |
| `fixtures/contracts/binary-asset-package-local-reference/package-document.json` | Post-import package evidence with source and texture package-local binary refs. |
| `fixtures/contracts/binary-asset-package-local-reference/binary-asset-index.json` | Binary asset index entries for source and texture refs. |
| `fixtures/contracts/binary-asset-package-local-reference/request/import-split-png-source-commit.request.json` | Operation fixture request proving source and texture binary ref materialization without byte decode. |
| `fixtures/contracts/binary-asset-package-local-reference/expected/*.json` | Expected package, operation, and validator summaries. |
| `packages/package-format/src/binary-asset-fixture.test.ts` | Fixture parse, byte recipe policy, mixed file-set roundtrip, digest/length/media type verification. |
| `packages/operation-core/src/binary-asset-fixture.test.ts` | Operation request parse and source/texture binary ref materialization fixture coverage. |
| `packages/validator-core/src/binary-asset-fixture.test.ts` | Valid, missing bytes, and digest mismatch validation report evidence for embedded refs and binary index entries. |
| `discussion/implementation/waves/wave22/wave22-domain-e-binary-asset-fixtures-and-contract-evidence-completion.md` | This completion note. |

## Evidence

- Package-local source binary ref: `bin_binary_fixture_source` at `assets/sources/binary-fixture/source.bytes`.
- Package-local texture binary ref: `bin_binary_fixture_texture` at `assets/textures/binary-fixture/body.texture-bytes`.
- Deterministic byte lengths and SHA-256 digests are pinned in the fixture and verified by package-format tests.
- `storageStatus` is `stored-package-local-v1` for both refs.
- `mediaType` is `application/octet-stream`; no fixture media type claims PSD, PNG, or image content.
- Rights/provenance links are pinned through `rightsAssetId=src_binary_fixture` and `provenanceId=prov_import_binary_fixture`.
- Validator fixture tests cover pass, missing byte diagnostics, and digest mismatch diagnostics with `referenceSource` evidence for source refs, texture refs, and binary asset index entries.
- Operation fixture test proves operation-core materializes source and texture binary refs as metadata without byte payload fields, image decode, raster extraction, file picker, or archive behavior.

## Verification

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/package-format/src/binary-asset-fixture.test.ts packages/operation-core/src/binary-asset-fixture.test.ts packages/validator-core/src/binary-asset-fixture.test.ts` | pass | Escalated rerun passed 3 files / 7 tests after the sandbox denied Vitest access to `node_modules`. |
| `pnpm.cmd exec vitest run packages/package-format/src/binary-asset.test.ts packages/package-format/src/package-binary-file-set.test.ts packages/package-format/src/binary-asset-fixture.test.ts packages/operation-core/src/binary-asset-fixture.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/validator-core/src/binary-asset-validator.test.ts packages/validator-core/src/binary-asset-fixture.test.ts` | pass | Escalated run passed 8 files / 49 tests. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed after a narrow test helper undefined guard. |
| `git diff --check -- fixtures/contracts packages/package-format packages/operation-core packages/validator-core discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | Exit 0. Git emitted LF/CRLF working-copy warnings for upstream Domain A-D files only. |
| No PSD/PNG/image binary files in Domain E fixture | pass | `rg --files fixtures/contracts/binary-asset-package-local-reference \| Select-String -Pattern '\\.(psd\|png\|jpg\|jpeg\|webp\|gif)$\|sample_model\\.psd'` returned no output. |
| No `test_data/sample_model.psd` copy or derivation | pass | New file paths contain no `sample_model.psd`; fixture policy explicitly records that bytes are not copied from it. |
| No dependency manifest changes by Domain E | pass | `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/package-format/package.json packages/operation-core/package.json packages/validator-core/package.json` returned no output. |
| No `apps/editor/**` changes by Domain E | pass with parallel-work note | `git status --short -uall -- apps/editor` shows existing parallel Domain F editor changes. Domain E touched only fixture files, three focused tests, and this report. |

## Explicit Non-Claims

- No actual PSD bytes.
- No actual PNG bytes.
- No third-party image bytes.
- No `test_data/sample_model.psd` copy or derivative.
- No image decode, PSD parser, raster extraction, texture rendering, file picker, archive import/export, filesystem I/O, or dependency addition.
- No editor implementation by Domain E.

## Residual Risks

- Binary bytes are generated from JSON integer arrays during tests. This proves package/file-set/validator behavior, not archive or filesystem persistence.
- The operation fixture uses the current split PNG metadata operation because it is the existing source/texture materialization path. The fixture still uses `.bytes` package-local paths and `application/octet-stream` so it does not imply real PNG bytes.
- Validator digest checks still depend on Domain B's Web Crypto availability behavior. Unsupported environments produce the existing digest-unsupported path.
- Current verification ran against a shared uncommitted workspace that also contains upstream Domain A-D changes and parallel Domain F editor changes.

## Domain G Gate

Domain E is `pass`.

Domain G can proceed after Domain F also passes.
