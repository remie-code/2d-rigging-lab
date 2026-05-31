# Wave 21 Domain C Review: PSD Validator Structured Diagnostics

> Target: `wave21-psd-validator-structured-diagnostics`
> Review agent: Review-Sylph
> Date: 2026-05-31
> Status: `pass`

## Scope

Reviewed Domain C changes only:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/psd-source-profile.ts`
- `packages/validator-core/src/validators/psd-source-profile-structured.ts`
- `packages/validator-core/src/psd-source-profile.test.ts`
- `discussion/implementation/waves/wave21/wave21-domain-c-psd-validator-structured-diagnostics-implementation.md`

Basis checked independently:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave21-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
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

Domain C fits the validator contract and keeps status/severity separated. The new check IDs are registered with deterministic defaults in `packages/validator-core/src/check-catalog.ts:125`, `packages/validator-core/src/check-catalog.ts:133`, `packages/validator-core/src/check-catalog.ts:141`, and `packages/validator-core/src/check-catalog.ts:149`. Runtime aggregation still derives report status from emitted check status/severity through the existing summary logic in `packages/validator-core/src/validation-summary.ts:42`.

Structured PSD diagnostics are deterministic and AI-readable. `validateStructuredPsdProfile` walks document, group, layer, adapter diagnostic, and fallback compatibility surfaces in stable manifest order at `packages/validator-core/src/validators/psd-source-profile-structured.ts:29`, `packages/validator-core/src/validators/psd-source-profile-structured.ts:43`, `packages/validator-core/src/validators/psd-source-profile-structured.ts:59`, `packages/validator-core/src/validators/psd-source-profile-structured.ts:75`, and `packages/validator-core/src/validators/psd-source-profile-structured.ts:85`. Evidence strings include adapter identity, canvas, group/layer IDs, group path, target part, texture relation, feature IDs, source refs, rasterize/manual-confirm flags, and compatibility policy.

Flattened fallback compatibility is preserved. When `psdProfile` is absent, the validator keeps the Wave 20 `sourceLayer.unsupportedFeatures[]` path at `packages/validator-core/src/validators/psd-source-profile.ts:34` and `packages/validator-core/src/validators/psd-source-profile.ts:44`. Missing structured profile evidence is informational at `packages/validator-core/src/validators/psd-source-profile-structured.ts:99`, and conflicting layer-level flattened unsupported feature IDs produce `asset.psd.flattenedFallbackMismatch` at `packages/validator-core/src/validators/psd-source-profile-structured.ts:197`.

Split PNG compatibility is not pulled into PSD validation. Non-PSD source assets without `psdProfile` return early at `packages/validator-core/src/validators/psd-source-profile.ts:30`, and the focused split PNG compatibility test passes at `packages/validator-core/src/psd-source-profile.test.ts:378`.

Runtime-core non-leakage holds for Domain C. The new structured PSD validator imports package-format DTOs and contracts only at `packages/validator-core/src/validators/psd-source-profile-structured.ts:1`; no runtime-core PSD schema or runtime source edit was introduced. Existing runtime-core imports remain in pre-existing runtime validator/tests, not in the new PSD structured validator.

Source organization is acceptable. `packages/validator-core/src/index.ts` remains barrel-only, and structured PSD diagnostic logic is isolated in a named validator file rather than added to an entrypoint. The larger PSD focused test file remains broad, but it mirrors the PSD validator integration surface and is not a blocking source-organization issue for this domain.

## Test Adequacy

The focused tests cover:

- catalog registration for new check IDs at `packages/validator-core/src/psd-source-profile.test.ts:18`
- structured happy path at `packages/validator-core/src/psd-source-profile.test.ts:27`
- structured layer unsupported feature detail at `packages/validator-core/src/psd-source-profile.test.ts:34`
- structured group unsupported feature detail at `packages/validator-core/src/psd-source-profile.test.ts:95`
- missing structured profile fallback at `packages/validator-core/src/psd-source-profile.test.ts:132`
- structured adapter diagnostics at `packages/validator-core/src/psd-source-profile.test.ts:168`
- conflicting flattened unsupported feature fallback at `packages/validator-core/src/psd-source-profile.test.ts:204`
- PSD profile on split PNG/non-PSD source mismatch at `packages/validator-core/src/psd-source-profile.test.ts:230`
- Wave 20 provenance/texture diagnostics and split PNG compatibility at `packages/validator-core/src/psd-source-profile.test.ts:264`, `packages/validator-core/src/psd-source-profile.test.ts:302`, `packages/validator-core/src/psd-source-profile.test.ts:330`, and `packages/validator-core/src/psd-source-profile.test.ts:378`

This is adequate for Domain C. Fixture JSON updates remain Domain D scope.

## Verification

| Check | Result | Notes |
|---|---|---|
| `git diff -- packages/validator-core discussion/implementation/waves/wave21` | reviewed | Domain C source diff reviewed; untracked `psd-source-profile-structured.ts` was read directly with line numbers. |
| `pnpm.cmd exec vitest run packages/validator-core/src/psd-source-profile.test.ts` | pass | 1 file / 12 tests passed. |
| `pnpm.cmd exec vitest run packages/validator-core/src` | pass | 6 files / 40 tests passed. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed. |
| `git diff --check -- packages/validator-core discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21` | pass | Exit 0; Git emitted LF/CRLF working-copy warnings only. |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json` | pass | No dependency manifest or lockfile diffs. |
| `git diff --name-only -- apps/editor packages/runtime-core` | pass | No editor or runtime-core diffs. |
| Forbidden scope scan for operation/authoring | observed non-Domain-C diffs | Operation/authoring diffs are present in the workspace and match the parallel Domain B scope. They were not reviewed as Domain C changes and are not attributed to this domain. |
| Parser/decode/raster/dependency scan over validator-core | pass | Matches were existing tests, PSD metadata strings, or truthful rasterization-path wording. No new PSD parser, image decode, file picker, dependency, or runtime PSD schema was found. |

## Residual Risks

- The new check IDs are implemented in validator-core but not yet mirrored in `discussion/design/module-contracts/validator-contract.md`. This is documentation drift risk for a later contract refresh, not a Domain C source blocker.
- The structured-vs-flattened comparison intentionally checks layer unsupported feature IDs in manifest order. This is deterministic, but a future compatibility policy could require set comparison if producer order becomes non-authoritative.
- Document-level structured unsupported features are implemented by the shared structured unsupported feature path, but focused tests emphasize group/layer/adapter/fallback behavior. This is acceptable for the current domain because group/layer are the Wave 20 compatibility risk surfaces.

## Verdict

Domain C can pass after this review. No source fix is required.
