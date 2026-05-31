# Wave 22 Domain D Review: Binary Asset Validator Diagnostics

> Target: `wave22-binary-asset-validator-diagnostics`  
> Review agent: Review-Sylph independent reviewer  
> Implementer context: `019e7d68-bcee-7e22-92c2-f31f6b4eb4a3` / Gnome the 7th  
> Date: 2026-05-31  
> Verdict: `pass`

## Verdict

`pass`.

Domain D adds validator-core binary asset diagnostics behind a new async package validation entrypoint while preserving the existing sync `validatePackageRuntime` path. The implementation stays inside `packages/validator-core/**`, consumes Domain A/B package-format contracts, and does not add binary decode, image sniffing, raster assumptions, parser/file-picker/archive/filesystem I/O, runtime-core leakage, editor/operation/authoring changes, dependency manifests, or lockfile changes.

Domain E/F can proceed after Domain C also passes.

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
| Upstream gate | pass | Domain A completion is `pass` and fixes binary asset metadata/policy. Domain B completion/review are `pass`; the Domain B residual asked Domain D to cover direct `BinaryAssetEntryDto` verification. |
| Valid refs pass | pass | `validatePackageBinaryAssets` collects source, texture, and binary index targets at `packages/validator-core/src/validators/binary-assets.ts:57` and `:110`. The happy-path test covers stored source, texture, and binary index refs with an empty check list at `packages/validator-core/src/binary-asset-validator.test.ts:42`. |
| Missing bytes | pass | Non-stored storage status emits `binary.bytesMissing` before byte verification at `packages/validator-core/src/validators/binary-assets.ts:69` and `:351`; absent file-set bytes map through Domain B verification at `:373` and `:497`. Tests cover metadata-declared missing bytes and absent bytes at `packages/validator-core/src/binary-asset-validator.test.ts:92`. |
| Byte length / digest / media type / asset ID mismatch | pass | Domain B issue codes map to stable validator check IDs at `packages/validator-core/src/validators/binary-assets.ts:497`. The direct `BinaryAssetEntryDto` test covers `binary.assetIdMismatch`, `binary.byteLengthMismatch`, `binary.digestMismatch`, and `binary.mediaTypeMismatch` at `packages/validator-core/src/binary-asset-validator.test.ts:151`. This addresses the Domain B residual. |
| Rights / provenance gaps | pass | Binary provenance, rights, and provenance-rights mismatch checks are emitted at `packages/validator-core/src/validators/binary-assets.ts:188`. Tests cover missing records and inconsistent provenance/rights asset metadata at `packages/validator-core/src/binary-asset-validator.test.ts:195`. |
| Source / texture / index consistency | pass | Source path, texture path/provenance, and binary index source/texture owner checks live at `packages/validator-core/src/validators/binary-assets.ts:215`, `:253`, `:302`, and `:331`. Tests cover source and texture reference gaps at `packages/validator-core/src/binary-asset-validator.test.ts:248`. |
| Existing sync validator path | pass | `validatePackageRuntime` remains sync and collects the pre-existing reference checks at `packages/validator-core/src/validators/package-runtime.ts:31`; the binary-aware path is explicit and async at `:53`. The completion note accurately records this residual at `discussion/implementation/waves/wave22/wave22-domain-d-binary-asset-validator-diagnostics-completion.md:49`. |
| Check catalog / report quality | pass | New binary check definitions are registered with stable IDs, phase, severity, profile list, AC refs, and descriptions at `packages/validator-core/src/check-catalog.ts:117`, `:125`, `:133`, `:149`, `:157`, `:165`, `:245`, `:253`, and `:261`. Generated checks include `target`, `targetPath`, `evidence`, and `impact` through `ValidationCheckResultSchema.parse` in `packages/validator-core/src/validators/binary-assets.ts:351`, `:373`, `:425`, `:449`, `:473`, and `:487`. |
| Boundary compliance | pass | Production Domain D files import package-format verification helpers only. A forbidden scan over Domain D production/test files found no filesystem/archive/File API/parser/decode/raster/canvas/image dependency implementation; matches were test non-claims and package coordinate fields. |
| Module boundaries | pass | Domain D source changes are limited to `packages/validator-core/**`. Scope guard showed no `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packages/validator-core/package.json`, `apps/editor/**`, or `packages/runtime-core/**` changes. Parallel Domain C changes exist under `packages/operation-core/**` and `packages/authoring-core/**` and are not treated as Domain D implementation. |
| Source organization | pass | `packages/validator-core/src/index.ts:12` is a barrel-only export. Binary implementation is isolated in `validators/binary-assets.ts`; package runtime wiring stays in `validators/package-runtime.ts`. |
| Completion note accuracy | pass | The completion note's changed-file list, async-path residual, scope/dependency guard statement, and Domain E/F gate statement match the current workspace evidence. |

## Verification Performed

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/binary-asset-validator.test.ts` | pass | Sandboxed run failed with `EPERM` reading `node_modules`; escalated rerun passed 1 file / 6 tests. |
| `pnpm.cmd exec vitest run packages/validator-core/src/binary-asset-validator.test.ts packages/validator-core/src/source-asset-rights-provenance.test.ts packages/validator-core/src/psd-source-profile.test.ts` | pass | Sandboxed run failed with `EPERM`; escalated rerun passed 3 files / 31 tests. |
| `pnpm.cmd typecheck` | pass | Sandboxed run failed with `EPERM` reading TypeScript under `node_modules`; escalated rerun passed root and editor typecheck. |
| `git diff --check -- packages/validator-core discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | Exit 0. Git emitted LF/CRLF working-copy warnings only. |
| Dependency manifest guard | pass | `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/package-format/package.json packages/validator-core/package.json` returned no output. |
| Forbidden scope guard | pass | `git status --short -uall -- apps/editor packages/runtime-core packages/operation-core packages/authoring-core` shows only parallel Domain C operation/authoring changes; no editor/runtime changes. |
| Boundary scan | pass | `rg` scan over Domain D production/test files found no forbidden implementation; only test non-claims (`decode`, `raster`), `canvas` coordinate field names, and deterministic test evidence text. |

## Residual Risks

- The binary-aware package validation entrypoint is async. Existing callers of sync `validatePackageRuntime` will not receive binary file-set digest/length/media-type checks until they intentionally switch to `validatePackageRuntimeWithBinaryAssets`.
- `BinaryAssetIndexFileDto` remains an optional validator input because Domain B did not integrate a binary asset index file into `PackageDocumentDto`.
- Media type verification is declared metadata comparison only. It intentionally does not sniff signatures or decode bytes.
- Digest verification depends on Domain B's Web Crypto availability path. Unsupported environments produce `binary.digestUnsupported` / `needs_review` instead of using a Node-only fallback.
- `storage-unsupported-v1` shares the same non-stored branch as `missing-package-local-bytes-v1`; the focused tests pin the missing-bytes branch but do not separately name the unsupported-storage status.
- Verification ran against the current shared uncommitted workspace, which includes parallel Domain C changes outside this review scope.

## Domain E/F Gate

Domain D is `pass`. Domain E/F can proceed after Domain C also passes.
