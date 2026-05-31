# Wave 22 Domain E Review: Binary Asset Fixtures And Contract Evidence

> Target: `wave22-binary-asset-fixtures-and-contract-evidence`
> Review agent: Review-Sylph independent reviewer
> Date: 2026-05-31
> Verdict: `pass`

## Verdict

`pass`.

Domain E adds deterministic binary asset contract fixtures plus focused package-format, operation-core, and validator-core fixture tests. The reviewed artifacts stay in fixture/test/report scope, do not add production logic, dependency manifests, editor changes, real PSD/image bytes, file picker/archive/image decode/raster behavior, or third-party image content.

Domain G can proceed only after Domain F also passes, which matches the Wave 22 plan gate.

## Findings

| Severity | Finding | Required action | Status |
|---|---|---|---|
| Blocking | None. | n/a | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | None. | n/a | pass |

## Review Evidence

| Area | Result | Evidence |
|---|---|---|
| Upstream gates | pass | Wave 22 plans Domain E after Domain C and D and limits it to fixtures/contracts plus fixture tests, with actual PSD/PNG/third-party bytes forbidden at `discussion/implementation/orchestration/wave22-plan.md:258` and `:267`. Domain B, C, and D completion notes are `pass`, and Domain D's independent review is `pass`. |
| Fixture byte policy | pass | `fixture-manifest.json:47` records generated deterministic test bytes, rights-clean status, and no actual PSD/PNG/third-party image binary files. `deterministic-test-bytes.json:10` states not PSD, not PNG, not image, not third-party, and not copied from `test_data/sample_model.psd`. The package-format fixture test verifies these claims and rejects PSD/PNG signatures at `packages/package-format/src/binary-asset-fixture.test.ts:22`. |
| No committed image/PSD binary files | pass | `rg --files fixtures/contracts/binary-asset-package-local-reference` with PSD/PNG/JPEG/WebP/GIF/sample PSD patterns returned no file paths. The fixture uses JSON integer arrays at `deterministic-test-bytes.json:40` and `:72`, materialized to `Uint8Array` only inside tests at `packages/package-format/src/binary-asset-fixture.test.ts:185`. |
| Package-local binary evidence | pass | Source and texture refs include package-local paths, digest, byte length, media type, storage status, provenance ID, and rights asset ID at `package-document.json:126` and `:152`. The binary asset index carries source and texture entries at `binary-asset-index.json:4` and `:20`. The expected package summary pins index count, storage statuses, media types, rights/provenance IDs, byte lengths, digests, and verification status at `expected/package-binary-evidence-summary.json:11`. |
| Operation fixture coverage | pass | The request fixture carries source and texture preview binary refs without byte payloads at `request/import-split-png-source-commit.request.json:14` and `:50`. The operation fixture test parses the request, commits it through operation-core, compares materialized source/texture refs to `package-document.json`, and asserts no `bytesBase64` or `decodedImageSize` claims at `packages/operation-core/src/binary-asset-fixture.test.ts:23` and `:54`. |
| Validator fixture coverage | pass | Validator tests cover valid stored refs, missing bytes, and digest mismatch diagnostics at `packages/validator-core/src/binary-asset-fixture.test.ts:22`, `:34`, and `:57`. The missing/mismatch tests assert AI-readable evidence for `sourceAsset.binaryAssetRef`, `textureAtlas.textures.binaryAssetRef`, `binaryAssetIndex.assets`, verification issue codes, expected digest/media type, and no decode/parser/raster wording at `:45` and `:70`. |
| Test focus | pass | Added tests are focused fixture tests only: package-format parse/file-set/digest checks, operation metadata materialization checks, and validator diagnostic evidence checks. No broad production changes are part of Domain E's changed-file list. |
| Source organization | pass | Domain E status is limited to `fixtures/contracts/binary-asset-package-local-reference/**`, three `binary-asset-fixture.test.ts` files, and its completion note. Public `index.ts` files remain barrel-only exports in package-format, operation-core, and validator-core. |
| Dependency and boundary policy | pass | No root/package manifests or lockfiles are changed. Boundary scan over Domain E fixtures/tests found no file picker, archive, image decode, parser, raster extraction, or new dependency implementation; matches were explicit non-claims, tests, or existing model coordinate field names. |
| Completion report accuracy | pass | The completion report's file list, verification claims, no-real-binary/no-dependency/no-editor statements, residual risks, and Domain G gate statement match current evidence. `discussion/implementation/waves/wave22/wave22-domain-e-binary-asset-fixtures-and-contract-evidence-completion.md:70` correctly says Domain G waits for Domain F. |

## Verification

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/package-format/src/binary-asset-fixture.test.ts packages/operation-core/src/binary-asset-fixture.test.ts packages/validator-core/src/binary-asset-fixture.test.ts` | pass | Sandboxed run hit `EPERM` reading Vitest from `node_modules`; escalated rerun passed 3 files / 7 tests. |
| `pnpm.cmd exec vitest run packages/package-format/src/binary-asset.test.ts packages/package-format/src/package-binary-file-set.test.ts packages/package-format/src/binary-asset-fixture.test.ts packages/operation-core/src/binary-asset-fixture.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/validator-core/src/binary-asset-validator.test.ts packages/validator-core/src/binary-asset-fixture.test.ts` | pass | Escalated run passed 8 files / 49 tests. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck completed. |
| `git diff --check -- fixtures/contracts packages/package-format packages/operation-core packages/validator-core discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | Exit 0. Git emitted LF/CRLF working-copy warnings for upstream tracked files only. |
| PSD/image/sample path guard | pass | No PSD/PNG/JPEG/WebP/GIF fixture file paths and no `sample_model.psd` path copy under Domain E fixture paths. |
| Dependency manifest guard | pass | `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/package-format/package.json packages/operation-core/package.json packages/validator-core/package.json` returned no output. |
| Editor scope guard | pass with parallel-work note | `git status --short -uall -- apps/editor` shows existing parallel Domain F editor changes; Domain E artifacts do not reference or require editor files. |
| Supplemental untracked whitespace scan | pass with note | Only Markdown hard-break spaces in the Domain E completion header were found; no fixture JSON or test-file trailing whitespace was found. |

## Files Reviewed

- `fixtures/contracts/binary-asset-package-local-reference/fixture-manifest.json`
- `fixtures/contracts/binary-asset-package-local-reference/deterministic-test-bytes.json`
- `fixtures/contracts/binary-asset-package-local-reference/baseline-package.json`
- `fixtures/contracts/binary-asset-package-local-reference/package-document.json`
- `fixtures/contracts/binary-asset-package-local-reference/binary-asset-index.json`
- `fixtures/contracts/binary-asset-package-local-reference/request/import-split-png-source-commit.request.json`
- `fixtures/contracts/binary-asset-package-local-reference/expected/binary-operation-summary.json`
- `fixtures/contracts/binary-asset-package-local-reference/expected/binary-validation-summary.json`
- `fixtures/contracts/binary-asset-package-local-reference/expected/package-binary-evidence-summary.json`
- `packages/package-format/src/binary-asset-fixture.test.ts`
- `packages/operation-core/src/binary-asset-fixture.test.ts`
- `packages/validator-core/src/binary-asset-fixture.test.ts`
- `discussion/implementation/waves/wave22/wave22-domain-e-binary-asset-fixtures-and-contract-evidence-completion.md`

## Residual Risks

- The fixture proves in-memory package file-set and validator behavior only. It does not prove archive/filesystem persistence of binary entries, by Wave 22 scope.
- The operation fixture uses the existing split PNG metadata operation path while deliberately using `.bytes` package-local paths and `application/octet-stream`; this is acceptable for metadata materialization evidence but should not be read as a real PNG import fixture.
- Digest verification continues to depend on the Domain B Web Crypto availability behavior; unsupported environments follow the existing digest-unsupported path.
- The workspace includes upstream Domain A-D changes and parallel Domain F editor changes; this review treated only the listed Domain E fixture/test/report artifacts as Domain E implementation.

## User Decision Points

None.
