# Wave 21 Domain B Review: PSD Operation Structured Materialization

> Target: `wave21-psd-operation-structured-materialization`
> Review agent: Review-Sylph `Sylph the 6th` (`019e7cd3-6b4b-7e11-8437-443ac2c715bc`)
> Date: 2026-05-31
> Status: `pass`

## Scope

Reviewed Domain B changes only:

- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.test.ts`
- `packages/authoring-core/src/source-asset-mutations.test.ts`
- `discussion/implementation/waves/wave21/wave21-domain-b-psd-operation-structured-materialization-implementation.md`

Basis checked independently:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave21-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave20/wave20-final-report.md`
- `discussion/implementation/waves/wave21/wave21-domain-a-structured-source-manifest-contract-completion.md`
- `discussion/implementation/reviews/wave21/wave21-domain-a-structured-source-manifest-contract-review.md`

## Findings

| Severity | Finding | File / line | Status |
|---|---|---|---|
| Blocking | None. | n/a | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | None. | n/a | pass |

## Review Notes

`importPsdSourceAsset` writes `sourceAsset.psdProfile` from the trusted adapter result in `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:31`. The structured materialization includes adapter evidence, canvas metadata, source groups, source layers, structured unsupported features, adapter diagnostics, blend mode metadata, and the Domain A compatibility policy in `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:125`.

Flattened compatibility is preserved. Existing `sourceAsset.diagnostics` is still produced, and `sourceAsset.layers[].unsupportedFeatures` remains a feature-ID summary for old consumers in `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:44` and `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:107`.

Texture preview and mapping traceability remain intact. Structured source layers carry `texturePreviewReference`, `textureId`, and `targetPartId`, and focused tests cover source layer to texture preview and target part evidence in `packages/operation-core/src/operations/import-psd-source-asset.test.ts:78`.

Parser-free truthfulness is maintained. The missing adapter result test still rejects the import with a diagnostic that explicitly says operation-core does not parse PSD bytes in `packages/operation-core/src/operations/import-psd-source-asset.test.ts:194`. No PSD byte read, decode, raster extraction implementation, external parser dependency, binary storage claim, editor/runtime change, or `index.ts` implementation change was found.

The optional adapter `blendMode` payload fields in `packages/operation-core/src/payloads/import-source.ts` are a minimal contract alignment with Domain A structured profile persistence and do not introduce parser behavior.

## Verification

| Check | Result | Notes |
|---|---|---|
| Domain B diff review | pass | Reviewed changed operation-core, authoring-core test, and implementation report files. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-source-asset.test.ts packages/operation-core/src/operation-schemas.test.ts packages/authoring-core/src/source-asset-mutations.test.ts` | pass | 3 files / 14 tests passed. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed in Orch-Sylph verification after review. |
| `git diff --check -- packages/operation-core packages/authoring-core discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21` | pass | Exit 0; Git emitted LF/CRLF working-copy warnings only. |
| dependency manifest diff check | pass | No dependency manifest or lockfile changes from Domain B. |
| forbidden-scope diff check | pass for Domain B | Current workspace contains `packages/validator-core/**` changes from parallel Domain C; those were not reviewed as Domain B changes. |
| truthfulness scan over Domain B changed files | pass | Matches were metadata or truthful diagnostics such as `rasterizeCandidate` and "does not parse PSD bytes". |

## Residual Risks

- The workspace contains parallel Domain C validator changes and Domain A package-format changes. This review did not evaluate Domain C.
- Contract fixture expected outputs likely still need Domain D updates once B and C are both accepted.

## Readiness

Domain B can pass.

Domain D and Domain E can proceed after Domain C also passes.
