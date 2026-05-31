# Wave 22 Domain A Review: Binary Asset Contract And I/O Policy Basis

> Target: `wave22-binary-asset-contract-and-io-policy-basis`  
> Review agent: Review-Sylph independent reviewer  
> Date: 2026-05-31  
> Verdict: `pass`

## Verdict

`pass`.

The Domain A implementation stays inside the package-format metadata contract boundary. It adds binary asset entry/reference/index schemas, optional source/texture hooks, focused tests, and a policy artifact without adding binary byte storage, byte loading, parser/decode work, file picker/archive work, external dependencies, runtime-core detail, or binary fixtures.

Domain B can start from this schema without redesigning Domain A. The expected remaining work is file-set integration, byte-backed digest/length verification, and validator diagnostics in later Wave 22 domains.

## Findings

| Severity | Finding | Required action | Status |
|---|---|---|---|
| Blocking | None. | n/a | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | None. | n/a | pass |

## Review Evidence

| Rubric | Result | Evidence |
|---|---|---|
| Binary boundary truthfulness | pass | `packages/package-format/src/binary-asset.ts` contains Zod DTO schemas only. Production forbidden-scope scan found no file reads/writes, File API, archive dependency, parser, decode, raster extraction, `Buffer`, or `Uint8Array` implementation in the changed production files. Existing matches were metadata names such as `texture-raster-v1`, `rasterizeCandidate`, and `canvas`. The policy explicitly states metadata/contract only at `discussion/implementation/waves/wave22/wave22-asset-io-boundary-policy.md:12` and no status performs file/archive/File API/parser/decode/raster work at `:41`. |
| Contract completeness | pass | `BinaryAssetReferenceSchema` includes `binaryAssetId`, `packageRelativePath`, `digest`, `byteLength`, `mediaType`, `storageStatus`, `provenanceId`, and `rightsAssetId` at `packages/package-format/src/binary-asset.ts:68`. `BinaryAssetEntrySchema` carries the same core fields plus role/source/texture/operation hooks at `:81`. `BinaryAssetIndexFileSchema` is present at `:97`. |
| Package-local bytes representation without loading | pass | Package paths are constrained by `BinaryAssetPackageRelativePathSchema` at `packages/package-format/src/binary-asset.ts:25`. Tests parse entry/reference/index metadata without binary payload fields at `packages/package-format/src/binary-asset.test.ts:22`, and reject payload-like decode fields at `:136`. |
| Rights / provenance | pass | Binary references require `provenanceId` and `rightsAssetId` at `packages/package-format/src/binary-asset.ts:74`; entries require them at `:89`. Source/texture association is tested at `packages/package-format/src/binary-asset.test.ts:89`. The policy records metadata-level auditability without decode at `discussion/implementation/waves/wave22/wave22-asset-io-boundary-policy.md:45`. |
| Dependency policy | pass | `git status --short -uall` and targeted dependency-manifest status checks showed no package/lock/workspace manifest changes. No external import was added beyond existing `zod` and local package/contracts imports. |
| Fixture policy | pass | No new `.psd`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.zip`, or `.wasm` files were found under `discussion/implementation/waves/wave22` or `packages/package-format/src`. `binary-asset.test.ts` uses synthetic metadata strings and reads only existing JSON fixture files for text-package compatibility at `packages/package-format/src/binary-asset.test.ts:141`. |
| Source organization | pass | `packages/package-format/src/index.ts:5` is a barrel-only re-export. `binary-asset.ts` owns a cohesive binary asset schema family and is small enough for this contract scope. No catch-all or broad source file was introduced. |
| Backward compatibility | pass | `SourceAssetSchema.binaryAssetRef` is optional at `packages/package-format/src/source-manifest.ts:184`; `TextureAtlasEntrySchema.binaryAssetRef` is optional at `packages/package-format/src/texture-atlas.ts:66`. Existing `source-manifest` and `package-file-set` tests passed with the new schema. |
| Downstream usability for Domain B | pass | `BinaryAssetIndexFileSchema` and package-local reference metadata provide the expected basis for a text + binary package file-set foundation. The lack of actual file-set serialization is explicitly a Domain B residual, not a Domain A blocker. |
| Orchestration compliance | pass | This review used an independent Review-Sylph context, inspected basis docs/diff/tests directly, did not edit source, and wrote only this review report under `discussion/implementation/reviews/wave22/`. |

## Verification

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/package-format/src/binary-asset.test.ts packages/package-format/src/source-manifest.test.ts packages/package-format/src/package-file-set.test.ts` | pass | Initial sandbox run failed with `EPERM` reading `node_modules`; escalated rerun passed 3 files / 16 tests. |
| `pnpm.cmd typecheck` | pass | Escalated run passed root and editor typecheck. |
| `git diff --check -- packages/package-format discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | Exit 0; Git emitted LF/CRLF working-copy warnings only. |
| `git status --short -uall` | pass | Changed/untracked files are limited to Domain A package-format files and Wave 22 discussion artifacts before this review report. |
| Forbidden scope status check | pass | No diffs under `packages/operation-core`, `packages/validator-core`, `apps/editor`, `packages/runtime-core`, dependency manifests, lockfiles, or workspace manifest. |
| Parser/file-picker/archive/decode scan | pass | Changed production files contain no parser/file-picker/archive/decode/raster/binary byte implementation. Test/doc matches are metadata examples or explicit non-claims. |

## Residual Risks

- `BinaryAssetIndexFileSchema` is not yet integrated into `PackageFileSet`; this is expected Domain B work.
- Digest and byte length are metadata-only in Domain A. Calculation and verification from bytes belong to later file-set/validator domains.
- Duplicate binary asset IDs, entry/reference consistency, media-type mismatch, digest mismatch, and missing provenance diagnostics are not validated yet; these are expected validator/file-set follow-ups.
- Review was run against the current uncommitted workspace, not a clean checkout replay.

## Domain B Start

Domain B can start.

The Domain A schema is sufficient for a package binary file-set foundation to add in-memory binary entries and deterministic digest/size/media type helpers while keeping parser, file picker, archive, and decode work out of scope.
