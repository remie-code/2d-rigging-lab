# Wave 21 Domain A Review: PSD Structured Source Manifest Contract

> Target: `wave21-psd-structured-source-manifest-contract`
> Review agent: Review-Sylph
> Date: 2026-05-31
> Status: `pass`

## Scope

Reviewed Domain A changes only:

- `packages/package-format/src/source-manifest.ts`
- `packages/package-format/src/source-manifest.test.ts`

Basis checked independently:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave21-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/implementation/current-capability-map.md`
- Wave 20 PSD matrix, sample characterization, final report, and clean integration review.

## Findings

| Severity | Finding | File / line | Status |
|---|---|---|---|
| Blocking | None. | n/a | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | None. | n/a | pass |

## Review Notes

Structured persistence is represented in package-format without PSD parsing or runtime-core DTO leakage. `LayeredCharacterPsdProfileSchema` stores adapter evidence, canvas, source groups, source layers, unsupported feature details, adapter diagnostics, and compatibility policy at `packages/package-format/src/source-manifest.ts:162`. Source layers include bounds, opacity, visibility, blend metadata, unsupported feature details, preview reference, texture ID, and target part ID at `packages/package-format/src/source-manifest.ts:143`.

Backward compatibility is preserved by keeping flattened `SourceAsset.diagnostics` and `SourceLayer.unsupportedFeatures` and making `SourceAsset.psdProfile` optional at `packages/package-format/src/source-manifest.ts:174`. Tests cover structured parse/serialize, flattened fallback policy, Wave 20 flattened PSD compatibility, split PNG compatibility, and materializing Wave 20 adapter result details at `packages/package-format/src/source-manifest.test.ts:12`.

Parser-free truthfulness holds for this domain. Changed production code defines schemas only. The only file read in the new test reads an existing JSON request fixture, not PSD bytes, at `packages/package-format/src/source-manifest.test.ts:408`.

Source organization is acceptable for Domain A. `packages/package-format/src/index.ts` remains barrel-only, and the new implementation stays in the source-manifest responsibility file.

Domain B/C can consume the contract from package-format exports without depending on runtime-core PSD structures. Operation materialization can write `psdProfile`; validator diagnostics can prefer structured fields and fall back to flattened diagnostics/unsupported feature IDs using the explicit compatibility policy.

## Verification

| Check | Result | Notes |
|---|---|---|
| `git status --short -uall` | pass with unrelated discussion/orchestration artifacts present | Source changes were limited to `packages/package-format/src/source-manifest.ts` and new `packages/package-format/src/source-manifest.test.ts`. Existing discussion map and Wave21 plan changes are outside Domain A source implementation. |
| `git diff -- packages/package-format/src/source-manifest.ts packages/package-format/src/source-manifest.test.ts` | reviewed | `source-manifest.test.ts` is untracked, so it was read directly with line numbers. |
| `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts` | pass | 1 file / 5 tests passed. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed. |
| `git diff --check -- packages/package-format discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21` | pass | Exit 0. Git emitted LF/CRLF working-copy warnings only. |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json` | pass | No dependency manifest or lockfile changes. |
| parser/decode/raster/dependency scan over target source/test | pass | Matches were schema terms, metadata strings, fixture JSON read, or truthful `rasterizeCandidate` metadata. No parser/file picker/decode/raster extraction implementation or new dependency claim found. |

## Residual Risks

- `SourceAssetSchema` remains permissive rather than a discriminated union, so semantic mismatches such as `psdProfile` on a non-PSD asset are still a validator-domain concern. This matches the existing package-format style and is not blocking for Domain A.
- Operation and validator behavior is not implemented in Domain A. Domain B/C must still materialize and consume the new structured fields, and should preserve the flattened fallback paths.
- The workspace currently contains discussion map / Wave21 plan changes outside the Domain A source scope. I did not review those as implementation changes for this domain.

## Parallel Readiness

Domain B and Domain C can start in parallel after this Domain A pass. The package-format contract is exported, typed, parser-free, dependency-free, and covered by focused parse/serialize/compatibility tests.
