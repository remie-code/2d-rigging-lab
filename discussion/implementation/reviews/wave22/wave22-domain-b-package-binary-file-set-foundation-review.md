# Wave 22 Domain B Review: Package Binary File Set Foundation

> Target: `wave22-package-binary-file-set-foundation`  
> Review agent: Review-Sylph independent reviewer  
> Date: 2026-05-31  
> Verdict: `pass`

## Verdict

`pass`.

Domain B adds an in-memory package file-set foundation for text plus binary entries while keeping existing `PackageFileSet` text behavior intact. The implementation stays inside `packages/package-format`, uses only `Uint8Array` / `ArrayBuffer` and platform Web Crypto for SHA-256 digest verification, and does not add archive, filesystem, file picker, parser, image decode, raster, dependency, validator, operation, runtime, or editor work.

Domain C and Domain D can start in parallel from this boundary. The only non-blocking residual is that the `BinaryAssetEntryDto` input branch is implemented but not directly exercised by the new tests; the required Domain B reference path, missing-bytes, digest mismatch, byte-length mismatch, and media-type mismatch behavior is covered.

## Findings

| Severity | Finding | Required action | Status |
|---|---|---|---|
| Blocking | None. | n/a | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | `verifyPackageBinaryAssetBytes` accepts both `BinaryAssetReferenceDto` and `BinaryAssetEntryDto`, but the focused tests only exercise the reference DTO path. The entry branch is simple and schema-parsed, so this does not block Domain B. | Add a small entry-based regression when Domain D starts using binary asset index entries directly. | non-blocking |

## Review Evidence

| Rubric | Result | Evidence |
|---|---|---|
| Binary boundary truthfulness | pass | `PackageBinaryBytes` is limited to `Uint8Array | ArrayBuffer` in `packages/package-format/src/package-binary-file-set.ts:25`; binary entries store copied in-memory bytes at `:100` and `:369`. Digest work uses `globalThis.crypto.subtle.digest("SHA-256", ...)` at `:167` and `:179`. Forbidden scan found no production filesystem, archive, File API, parser, decode, raster, canvas, or image-sniffing implementation. Test-only `readFileSync` reads existing JSON fixtures, not binary payloads. |
| No dependency drift | pass | Targeted status checks over root manifests, `pnpm-lock.yaml`, workspace manifest, and `packages/package-format/package.json` returned no output. Production import scan of Domain B files found no peer-core imports and no Node filesystem imports. |
| Existing text file-set compatibility | pass | `packages/package-format/src/package-file-set.ts` is unchanged. `extractPackageTextFileSet` filters mixed entries back to text at `packages/package-format/src/package-binary-file-set.ts:137`, and `parsePackageDocumentFromInMemoryFileSet` delegates to existing text parsing at `:146`. The new test preserves text package parse/roundtrip at `packages/package-format/src/package-binary-file-set.test.ts:27`. |
| In-memory binary store/read | pass | `createPackageBinaryFileEntry` validates package-local binary path, media type, optional ID, and copies bytes at `packages/package-format/src/package-binary-file-set.ts:100`; `createPackageInMemoryFileSet` normalizes entries and checks duplicate paths at `:116`; `readPackageBinaryFileEntry` reads by path or Domain A DTO at `:152`. |
| Deterministic digest / length / media type verification | pass | `getPackageBinaryByteLength` parses actual byte length at `packages/package-format/src/package-binary-file-set.ts:163`; SHA-256 digest result is lower-hex at `:183`; `verifyPackageBinaryAssetBytes` compares byte length, media type, and digest at `:212`, `:232`, and `:261`. Tests pin `abc` SHA-256 and pass verification at `packages/package-format/src/package-binary-file-set.test.ts:22` and `:60`. |
| Failure modes | pass | Issue codes include `binary.bytes.missing`, `binary.digest.mismatch`, and `binary.mediaType.mismatch` at `packages/package-format/src/package-binary-file-set.ts:59`. Missing bytes are emitted at `:200`, media type mismatch at `:234`, and digest mismatch at `:263`. Tests cover missing bytes at `packages/package-format/src/package-binary-file-set.test.ts:86` and combined digest / byte length / media type mismatch at `:102`. |
| Domain A DTO compatibility | pass | `verifyPackageBinaryAssetBytes` parses `BinaryAssetReferenceSchema` or `BinaryAssetEntrySchema` before reading expected metadata at `packages/package-format/src/package-binary-file-set.ts:310`. `source-manifest.ts:184` and `texture-atlas.ts:66` retain optional Domain A binary refs, so existing text packages remain valid while C/D can attach refs. |
| Source organization | pass | `packages/package-format/src/index.ts:5` and `:14` are barrel-only re-exports. New production logic lives in the cohesive `package-binary-file-set.ts`; no catch-all file or implementation logic in `index.ts` was introduced. |
| Forbidden scope | pass | `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps packages/package-format/package.json packages/operation-core packages/validator-core packages/runtime-core apps/editor` returned no output. Domain B did not modify operation-core, validator-core, runtime-core, editor, or dependency manifests. |

## Verification Reviewed / Performed

Reviewed Orch-Sylph verification evidence:

- `pnpm.cmd exec vitest run packages/package-format/src/package-file-set.test.ts packages/package-format/src/binary-asset.test.ts packages/package-format/src/package-binary-file-set.test.ts`: pass after sandbox EPERM escalation, 3 files / 16 tests.
- `pnpm.cmd typecheck`: pass after sandbox EPERM escalation.
- `git diff --check -- packages/package-format discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22`: pass, LF/CRLF warnings only.
- Dependency manifest and forbidden scope status checks: no output.

Performed in this review:

- Read the required basis docs, Domain A policy/completion/review, Domain B completion, changed files, upstream Domain A files, and existing `package-file-set` source/tests.
- `git status --short -uall` to confirm current Wave 22 changed-file surface.
- `git diff -- packages/package-format/src/package-file-set.ts packages/package-format/src/package-file-set.test.ts`: no text file-set source/test diff.
- `git diff --check -- packages/package-format discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22`: exit 0, LF/CRLF warnings only.
- `rg` scans for filesystem, archive, File API, decode, parser, raster, dependency, and forbidden peer-core imports over Domain B production/test/artifact scope.
- `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps packages/package-format/package.json packages/operation-core packages/validator-core packages/runtime-core apps/editor`: no output.

## Residual Risks

- SHA-256 verification depends on platform Web Crypto availability. The implementation reports `binary.digest.unsupported` instead of adding a Node-only or dependency-backed fallback, which matches the no-dependency boundary.
- Media type verification is declared metadata comparison only. It does not sniff signatures or decode bytes, which is correct for this wave but must remain explicit in validator/editor messaging.
- Binary file-set persistence is in-memory only. Archive/filesystem/package export behavior remains future scope.
- Direct `BinaryAssetEntryDto` verification coverage is absent in Domain B tests; add it when binary asset index entries become a validator input.

## Domain C/D Start

Domain C and Domain D can start in parallel.

The package-format foundation now provides package-local binary refs, in-memory binary entries, deterministic digest/length/media type verification reports, and missing/mismatch issue codes without crossing the parser/file/archive/decode/dependency boundary.
