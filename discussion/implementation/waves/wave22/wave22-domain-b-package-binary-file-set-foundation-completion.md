# Wave 22 Domain B Completion: Package Binary File Set Foundation

> Target: `wave22-package-binary-file-set-foundation`
> Implementer: `019e7d56-ddc4-7463-9d20-045ce515ff4e` / Gnome the 3rd
> Reviewer: `019e7d60-f257-7962-8c77-b216e91e8c0b` / Sylph the 4th
> Date: 2026-05-31
> Status: `pass`

## Summary

Domain B added an in-memory package file-set foundation that can hold existing text entries and package-local binary entries without implementing archive, filesystem, file picker, PSD/PNG decode, or external dependency work.

Existing `PackageFileSet` remains text-only for compatibility. The new mixed file-set API lives in `package-binary-file-set.ts` and can extract the text file set for existing package document parsing.

Independent Review-Sylph review passed with no blocking, high, or medium findings:
[wave22-domain-b-package-binary-file-set-foundation-review.md](../../reviews/wave22/wave22-domain-b-package-binary-file-set-foundation-review.md).

## Changed Files

| File | Responsibility |
|---|---|
| `packages/package-format/src/package-binary-file-set.ts` | In-memory text + binary entry model, binary entry creation/read helpers, SHA-256 digest helper, byte length helper, and binary asset verification reports. |
| `packages/package-format/src/package-binary-file-set.test.ts` | Focused tests for text compatibility, binary storage/readback, digest/byte length/media type verification, missing bytes, and mismatch issue representation. |
| `packages/package-format/src/index.ts` | Barrel-only re-export for the new binary file-set module. |
| `discussion/implementation/waves/wave22/wave22-domain-b-package-binary-file-set-foundation-completion.md` | This completion note. |

## Evidence

- `PackageInMemoryFileSet` can contain both `PackageTextFileEntry` and `PackageBinaryFileEntry`.
- `extractPackageTextFileSet` and `parsePackageDocumentFromInMemoryFileSet` preserve existing text package behavior.
- `computePackageBinarySha256Digest` uses platform `globalThis.crypto.subtle` when available and reports unsupported digest verification when it is not available.
- `verifyPackageBinaryAssetBytes` compares actual bytes to Domain A `BinaryAssetReferenceDto` / `BinaryAssetEntryDto` metadata for byte length, SHA-256 digest, and media type.
- Verification issue codes represent `binary.bytes.missing`, `binary.digest.mismatch`, `binary.mediaType.mismatch`, and related binary file-set mismatches.

## Verification

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/package-format/src/package-file-set.test.ts packages/package-format/src/binary-asset.test.ts packages/package-format/src/package-binary-file-set.test.ts` | pass | Initial sandbox run hit `EPERM` reading `node_modules`; escalated rerun passed 3 files / 16 tests. |
| `pnpm.cmd typecheck` | pass | Initial sandbox run hit `EPERM` reading TypeScript under `node_modules`; escalated rerun passed root and editor typecheck after a test helper branded-ID fix. |
| `git diff --check -- packages/package-format discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | Git emitted LF/CRLF working-copy warnings only. |
| New-file trailing whitespace scan | pass | Checked the new binary file-set source, test, and Domain B completion artifact. |
| Dependency manifest status check | pass | No changes under root manifests, lockfile, workspace manifest, or `packages/package-format/package.json`. |
| Forbidden implementation scope status check | pass | No changes under `packages/operation-core`, `packages/validator-core`, `packages/runtime-core`, or `apps/editor`. |
| Parser/file-picker/archive/decode scan | pass | Production implementation matches are limited to `Uint8Array` / `ArrayBuffer` in-memory bytes and Web Crypto digest verification; doc/test matches are explicit non-claims or fixture reading in tests. |

## Review Result

| Review | Result | Notes |
|---|---|---|
| Review-Sylph independent review | pass | No blocking, high, or medium findings. Low non-blocking note: `verifyPackageBinaryAssetBytes` supports `BinaryAssetEntryDto`, but tests directly exercise only `BinaryAssetReferenceDto`; add entry-based regression when Domain D consumes binary asset index entries directly. |

## Explicit Non-Claims

- No ZIP/archive import or export.
- No OS filesystem picker or browser File API UI.
- No filesystem read/write implementation.
- No PSD/PNG decode, image sniffing, raster extraction, or parser work.
- No external dependency or manifest/lockfile change.
- No operation-core, validator-core, runtime-core, or editor implementation.

## Residual Risks

- SHA-256 calculation depends on platform Web Crypto availability. When unavailable, verification returns an unsupported digest issue instead of using a Node-only or dependency-backed fallback.
- Media type verification compares declared in-memory entry metadata to Domain A DTO metadata. It does not sniff or decode bytes.
- Archive/filesystem persistence of binary entries remains future scope.
- Direct `BinaryAssetEntryDto` verification coverage is not present in Domain B tests. This is non-blocking because the reference path and required missing/mismatch behavior are covered, and entry-index validation is expected in Domain D.

## Downstream Start

Domain C and Domain D can start in parallel.

The package-format foundation now provides package-local binary refs, in-memory binary entries, deterministic digest/length/media type verification reports, and missing/mismatch issue codes without crossing the parser/file/archive/decode/dependency boundary.
