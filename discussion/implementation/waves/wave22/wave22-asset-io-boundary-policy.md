# Wave 22 Asset I/O Boundary Policy

> Target domain: `wave22-binary-asset-contract-and-io-policy-basis`
> Status: Domain A implementation artifact
> Date: 2026-05-31
> Scope: package-format binary asset DTO boundary and future I/O separation

## Purpose

This artifact fixes the Wave 22 Domain A boundary for binary assets before real parser, file picker, archive, or image decode work begins.

The implemented boundary is metadata and contract only. It lets package-format describe package-local binary assets and references with digest, byte length, media type, storage status, provenance, and rights association without loading, decoding, extracting, or storing binary payloads in this domain.

## Implemented Boundary

Domain A implements package-format DTO/Zod contracts for:

- `BinaryAssetDigestSchema`: SHA-256 digest metadata using lowercase hex.
- `BinaryAssetByteLengthSchema`: nonnegative safe integer byte length.
- `BinaryAssetMediaTypeSchema`: lowercase media type without parameters.
- `BinaryAssetStorageStatusSchema`: package storage availability state.
- `BinaryAssetEntrySchema`: package binary asset catalog entry.
- `BinaryAssetReferenceSchema`: package-local reference that can be embedded from source or texture metadata.
- `BinaryAssetIndexFileSchema`: metadata index shape for future package file-set integration.

Implemented source metadata hooks:

- `SourceAssetSchema.binaryAssetRef` is optional.
- `TextureAtlasEntrySchema.binaryAssetRef` is optional.

Existing text-only source manifests, texture metadata, and package document fixtures remain valid because binary refs are optional and no existing field became required.

## Storage Status Semantics

| Status | Meaning in this wave | Does it prove bytes are loaded? |
|---|---|---|
| `stored-package-local-v1` | The package contract expects bytes at the package-local path and records digest/length/media type metadata. | No. This is a reference contract; byte loading belongs to later file-set I/O. |
| `missing-package-local-bytes-v1` | Metadata expects package-local bytes, but the current file set or workflow does not have the bytes available. | No. |
| `storage-unsupported-v1` | The current workflow can describe the binary asset but cannot store or materialize the bytes yet. | No. |

No status in Domain A performs file reads, archive reads/writes, browser File API work, PSD parsing, PNG decoding, raster extraction, or texture materialization.

## Rights And Provenance

Every binary asset entry and binary asset reference carries:

- `provenanceId`: links to `assets/provenance.json`.
- `rightsAssetId`: links to `assets/rights.json` by asset ID.

This means rights/provenance can be audited for a binary asset reference even when bytes are missing, unsupported, or not loaded. The association is metadata-level and does not depend on image decode, PSD structure extraction, or binary payload inspection.

## Package-Local Path Boundary

Binary asset package paths are constrained to package-relative paths under:

- `assets/sources/`
- `assets/textures/`
- `assets/thumbnails/`

The contract rejects absolute paths, path traversal, backslashes, external URLs, and package paths outside those asset directories.

## Future Work Outside Domain A

The following work is explicitly future scope:

- Package file-set read/write of actual binary entries.
- Digest calculation from bytes.
- Byte length verification from bytes.
- Media type verification from bytes or file signatures.
- OS file picker or browser File API import.
- Archive or ZIP import/export.
- PSD parser integration.
- PNG/image decode.
- Raster extraction, texture preview generation, atlas packing, or rendering.
- Actual PSD/PNG/third-party binary fixtures.

Later domains may consume the Domain A contract, but they must not reinterpret the reference metadata as proof that bytes were decoded or materialized.

## Fixture Policy

Domain A adds only TypeScript contract tests with synthetic metadata. It does not add binary fixture files.

Future binary fixture work must use rights-clean deterministic test bytes, not real PSD/PNG art, third-party images, or copied files from `test_data/sample_model.psd`.

## Review Checklist

- Binary refs include digest, byte length, media type, storage status, provenance, and rights fields.
- Binary refs can be parsed without byte payload fields.
- Existing text package fixtures still parse.
- No dependency manifest or lockfile changes are needed.
- No parser, file picker, archive, decode, raster, or runtime-core implementation detail is introduced.
