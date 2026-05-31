# Wave 22 Domain D Completion: Binary Asset Validator Diagnostics

> Target: `wave22-binary-asset-validator-diagnostics`
> Implementer: Gnome
> Date: 2026-05-31
> Status: `pass`

## Summary

Domain D added validator-core diagnostics for package-local binary asset metadata and in-memory binary file-set verification.

The implementation stays metadata/file-set only. It does not add binary decode, image sniffing, raster assumptions, file picker, archive/filesystem I/O, runtime-core schema/source changes, external dependencies, package manifest changes, or editor changes.

## Orchestration

| Role | Context | Result |
|---|---|---|
| Gnome implementation | `019e7d68-bcee-7e22-92c2-f31f6b4eb4a3` / Gnome the 7th | `pass` |
| Review-Sylph independent review | `019e7d76-31e3-7f21-bf49-d0d7bd3db4a9` / Sylph the 7th | `pass` |

Review artifact:

- `discussion/implementation/reviews/wave22/wave22-domain-d-binary-asset-validator-diagnostics-review.md`

## Changed Files

| File | Responsibility |
|---|---|
| `packages/validator-core/src/validators/binary-assets.ts` | Binary asset reference/index validation: rights/provenance resolution, owner consistency, storage-status missing bytes, and Domain B verification issue mapping. |
| `packages/validator-core/src/validators/package-runtime.ts` | Added async `validatePackageRuntimeWithBinaryAssets` entrypoint while preserving existing sync `validatePackageRuntime`. |
| `packages/validator-core/src/check-catalog.ts` | Added binary asset and binary rights/provenance check definitions. |
| `packages/validator-core/src/index.ts` | Barrel-only re-export for the new binary validator module. |
| `packages/validator-core/src/binary-asset-validator.test.ts` | Focused coverage for valid refs, missing bytes, mismatch diagnostics, rights/provenance gaps, source/texture consistency, and `BinaryAssetEntryDto` verification path. |
| `discussion/implementation/waves/wave22/wave22-domain-d-binary-asset-validator-diagnostics-completion.md` | This completion note. |

## Implemented Diagnostics

- `binary.bytesMissing`: emitted for `storageStatus=missing-package-local-bytes-v1`, `storage-unsupported-v1`, or absent package-local bytes in the provided in-memory file set.
- `binary.byteLengthMismatch`, `binary.digestMismatch`, `binary.mediaTypeMismatch`, `binary.assetIdMismatch`: mapped from Domain B `verifyPackageBinaryAssetBytes` issues.
- `binary.digestUnsupported`: emitted as `needs_review` when SHA-256 verification is unavailable.
- `binary.referenceMismatch`: emitted for source manifest, texture atlas, or binary asset index owner inconsistencies.
- `rights.binaryProvenanceMissing`, `rights.binaryRightsMissing`, `rights.binaryProvenanceMismatch`: emitted for unresolved or inconsistent binary provenance/rights metadata.

Coverage includes both embedded `BinaryAssetReferenceDto` refs on source/texture metadata and `BinaryAssetEntryDto` entries supplied through a binary asset index input, addressing the Domain B review residual.

## Verification

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/binary-asset-validator.test.ts` | pass | 1 file / 6 tests. Initial sandbox run hit `EPERM` reading `node_modules`; escalated reruns passed. |
| `pnpm.cmd exec vitest run packages/validator-core/src/binary-asset-validator.test.ts packages/validator-core/src/source-asset-rights-provenance.test.ts packages/validator-core/src/psd-source-profile.test.ts` | pass | 3 files / 31 tests. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck completed. Initial sandbox run hit `EPERM`; escalated reruns passed after the Domain D test helper branded-ID fix. |
| `git diff --check -- packages/validator-core discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | Git emitted LF/CRLF working-copy warnings only. |
| Dependency manifest status check | pass | No changes under root manifests, lockfile, workspace manifest, or `packages/validator-core/package.json`. |
| Forbidden scope check | pass for Domain D | Domain D changed only `packages/validator-core/**` and this completion artifact. Current workspace also shows parallel Domain C changes under `packages/operation-core/**` and `packages/authoring-core/**`; Domain D did not edit them. No `apps/editor/**` or `packages/runtime-core/**` changes were present in the scoped status check. |
| Parser/file-picker/archive/decode scan over Domain D files | pass | Matches are test assertions/non-claims (`decode`, `raster`) or existing package coordinate field names (`canvas`); no implementation adds parser, file picker, archive, image decode, raster, or dependency work. |
| Review-Sylph independent review | pass | No blocking, high, medium, or low findings. Confirmed diagnostics, Domain B `BinaryAssetEntryDto` residual coverage, boundary compliance, source organization, test adequacy, and scope/dependency guards. |

## Residual Risks

- The binary-aware package validation entrypoint is async because Domain B digest verification is async. Existing sync `validatePackageRuntime` remains unchanged and does not run binary file-set digest checks.
- Binary asset index is an optional validator input because Domain B did not integrate `BinaryAssetIndexFileDto` into `PackageDocumentDto`.
- Media type validation compares declared metadata only. It does not sniff signatures or decode bytes, by design.
- Digest verification depends on Domain B's Web Crypto availability handling; unsupported environments produce `binary.digestUnsupported` instead of using a Node-only fallback.
- `storage-unsupported-v1` uses the same non-stored diagnostic path as `missing-package-local-bytes-v1`; focused tests pin the missing-bytes branch but do not separately name unsupported storage.
- Current verification ran against the shared uncommitted workspace, which includes parallel Domain C operation/authoring changes outside this domain.

## Domain E/F Gate

Domain D is `pass`. Domain E/F can proceed after Domain C also passes.
