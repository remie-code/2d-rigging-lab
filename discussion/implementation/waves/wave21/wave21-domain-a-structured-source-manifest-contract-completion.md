# Wave 21 Domain A Completion: PSD Structured Source Manifest Contract

## Status

pass

## Delegation

- Orch-Sylph: current context.
- Gnome implementation: `Gnome the 2nd` (`019e7ca4-6e6e-78e1-9e79-1662ff7f0bed`).
- Review-Sylph: `Sylph the 3rd` (`019e7caf-8153-7de2-a1b2-6c3dba1a7225`).
- Review report: `discussion/implementation/reviews/wave21/wave21-domain-a-structured-source-manifest-contract-review.md`.

## Changed Files

- `packages/package-format/src/source-manifest.ts`
- `packages/package-format/src/source-manifest.test.ts`
- `discussion/implementation/reviews/wave21/wave21-domain-a-structured-source-manifest-contract-review.md`
- `discussion/implementation/waves/wave21/wave21-domain-a-structured-source-manifest-contract-completion.md`

Existing workspace changes outside this domain remain present:

- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave21-plan.md`

Those were not reverted or treated as Domain A implementation changes.

## Contract Outcome

Domain A adds optional structured PSD profile persistence to the source manifest while preserving existing flattened fields.

The new `psdProfile` contract can persist:

- adapter evidence
- canvas dimensions and bounds
- source groups
- source layers
- layer/group bounds, opacity, visibility, and blend mode metadata
- target part and texture relation metadata
- structured unsupported feature details
- structured adapter diagnostics
- explicit flattened compatibility policy

Compatibility policy:

- structured profile precedence: `structured-profile-preferred-v1`
- flattened diagnostics fallback: `sourceAsset.diagnostics-summary-fallback-v1`
- flattened unsupported feature fallback: `sourceLayer.unsupportedFeatures-feature-id-fallback-v1`

`psdProfile` is optional, so existing Wave 20 flattened PSD manifests and split PNG manifests remain loadable.

## Verification

- `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts`
  - pass, 5 tests
- `pnpm.cmd exec vitest run packages/package-format/src`
  - pass in Gnome verification, 5 files / 22 tests
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- packages/package-format discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`
  - pass; Git reported LF/CRLF warning only
- dependency manifest check
  - pass; no changes to `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or `packages/package-format/package.json`
- forbidden implementation scope check
  - pass; no diffs under `packages/operation-core`, `packages/validator-core`, `apps/editor`, or `packages/runtime-core`
- parser/decode/raster/file-picker/dependency scan over changed package-format source/tests
  - pass in Review-Sylph verification

## Review Result

Review-Sylph status: pass.

Findings: none at blocking, high, medium, or low severity.

Review confirmed:

- structured persistence is represented without parser/dependency/binary work
- backward compatibility with flattened diagnostics and unsupported feature IDs is preserved
- parser-free truthfulness is maintained
- source organization and allowed write scope are compliant
- tests cover parse/serialize, Wave 20 flattened PSD compatibility, split PNG compatibility, and fallback policy

## Residual Risks

- `SourceAssetSchema` is not a discriminated union, so invalid combinations such as non-PSD assets carrying `psdProfile` remain a validator responsibility for Domain C.
- Domain B still needs to materialize the structured profile from adapter results.
- Domain C still needs to consume the structured profile for diagnostics while keeping flattened fallback behavior.
- Editor projection and e2e persistence are out of scope for Domain A and remain for later domains.

## Downstream Gate

Domain B and Domain C can start in parallel.

