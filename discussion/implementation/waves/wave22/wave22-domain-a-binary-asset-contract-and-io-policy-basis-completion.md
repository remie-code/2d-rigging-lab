# Wave 22 Domain A Completion: Binary Asset Contract And I/O Policy Basis

> Target: `wave22-binary-asset-contract-and-io-policy-basis`
> Implementer: Gnome
> Date: 2026-05-31
> Status: `pass`

## Summary

Domain A added package-format binary asset metadata contracts and the Wave 22 asset I/O boundary policy artifact.

The implementation is DTO/Zod contract work only. It does not add binary file-set storage, file picker, archive import/export, PSD parser, image decode, raster extraction, external dependencies, runtime-core details, or actual PSD/PNG binary fixtures.

## Changed Files

| File | Responsibility |
|---|---|
| `packages/package-format/src/binary-asset.ts` | Binary asset id, digest, byte length, media type, storage status, entry, reference, and index file schemas. |
| `packages/package-format/src/binary-asset.test.ts` | Focused contract tests for binary asset entry/reference validation, rights/provenance association, and existing text fixture compatibility. |
| `packages/package-format/src/source-manifest.ts` | Optional `SourceAssetSchema.binaryAssetRef` hook. |
| `packages/package-format/src/texture-atlas.ts` | Optional `TextureAtlasEntrySchema.binaryAssetRef` hook. |
| `packages/package-format/src/index.ts` | Barrel-only re-export for `binary-asset.ts`. |
| `discussion/implementation/waves/wave22/wave22-asset-io-boundary-policy.md` | Policy artifact separating implemented metadata boundary from future parser/file/archive/decode work. |
| `discussion/implementation/waves/wave22/wave22-domain-a-binary-asset-contract-and-io-policy-basis-completion.md` | This completion report. |

## Contract Evidence

- `BinaryAssetReferenceSchema` represents package-local binary bytes without loading payloads.
- Reference and entry contracts include `digest`, `byteLength`, `mediaType`, `storageStatus`, `provenanceId`, and `rightsAssetId`.
- Storage status values distinguish `stored-package-local-v1`, `missing-package-local-bytes-v1`, and `storage-unsupported-v1`.
- Binary package paths are constrained to `assets/sources/`, `assets/textures/`, or `assets/thumbnails/`.
- Strict binary entry/reference schemas reject payload-like decode fields such as `bytesBase64` or `decodedImageSize`.
- Existing text-only package fixtures remain compatible because binary refs are optional.

## Verification

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/package-format/src/binary-asset.test.ts packages/package-format/src/source-manifest.test.ts packages/package-format/src/package-file-set.test.ts` | pass | Initial sandbox run hit `EPERM` reading `node_modules`; escalated rerun passed 3 files / 16 tests. |
| `pnpm.cmd typecheck` | pass | Initial sandbox run hit `EPERM` reading TypeScript under `node_modules`; escalated rerun passed root and editor typecheck. |
| `git diff --check -- packages/package-format discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | Git emitted LF/CRLF working-copy warnings only. |
| New-file trailing whitespace scan | pass | Checked new `binary-asset` source/test files and Wave 22 policy/completion artifacts. |
| Forbidden scope status check | pass | No diffs under `packages/operation-core`, `packages/validator-core`, `apps/editor`, `packages/runtime-core`, root manifests, lockfile, workspace manifest, or `packages/package-format/package.json`. |
| Parser/file-picker/archive/decode scan over changed scope | pass | Matches are policy non-claims, test path strings, existing PSD metadata terms, or strict rejection evidence; no implementation was added. |

## Residual Risks

- Binary asset IDs are package-format-local (`bin_*`) because `packages/contracts` was outside this domain write scope.
- `BinaryAssetIndexFileSchema` is not yet integrated into package document/file-set serialization; that is expected to be Domain B work.
- Digest and byte length are metadata fields only in Domain A. Calculation and verification from bytes are future file-set/validator work.
- `SourceAssetSchema.binaryAssetRef` and `TextureAtlasEntrySchema.binaryAssetRef` are optional hooks. Operation materialization and validator diagnostics are future domains.

## Review-Sylph Start

Review-Sylph can start.

Recommended review focus:

- Binary boundary truthfulness: no bytes, parser, decode, file picker, archive, or raster implementation.
- Rights/provenance: refs and entries carry association fields without binary decode.
- Package compatibility: text fixtures and existing package-file-set behavior remain compatible.
- Source organization: `index.ts` stayed barrel-only and `binary-asset.ts` owns the schema family.
