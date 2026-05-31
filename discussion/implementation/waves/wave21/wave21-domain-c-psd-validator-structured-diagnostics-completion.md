# Wave 21 Domain C Completion: PSD Validator Structured Diagnostics

## Status

pass

## Delegation

- Orch-Sylph: current context.
- Gnome implementation: `Gnome the 6th` (`019e7cbf-e6cd-7682-8a8e-74f714df7017`).
- Review-Sylph: `Sylph the 7th` (`019e7cdb-cae5-7223-bd3d-ca9b78de1363`).
- Review report: `discussion/implementation/reviews/wave21/wave21-domain-c-psd-validator-structured-diagnostics-review.md`.

## Changed Files

Domain C source and tests:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/psd-source-profile.ts`
- `packages/validator-core/src/validators/psd-source-profile-structured.ts`
- `packages/validator-core/src/psd-source-profile.test.ts`

Domain C notes and review artifacts:

- `discussion/implementation/waves/wave21/wave21-domain-c-psd-validator-structured-diagnostics-implementation.md`
- `discussion/implementation/reviews/wave21/wave21-domain-c-psd-validator-structured-diagnostics-review.md`
- `discussion/implementation/waves/wave21/wave21-domain-c-psd-validator-structured-diagnostics-completion.md`

Existing or parallel workspace changes outside Domain C remain present, including Domain A package-format artifacts and Domain B operation/authoring artifacts. They were not reverted or attributed to Domain C.

## Behavior Outcome

Validator-core now consumes structured `SourceAsset.psdProfile` when present and emits deterministic, AI-readable diagnostics for:

- adapter diagnostics via `asset.psd.adapterDiagnostic`
- document/group/layer unsupported feature details via `asset.psd.unsupportedFeature`
- structured profile missing with flattened compatibility evidence via `asset.psd.structuredProfileMissing`
- structured-vs-flattened unsupported feature conflicts via `asset.psd.flattenedFallbackMismatch`
- PSD profile metadata on a non-PSD source via `asset.psd.structuredProfileMismatch`

Compatibility behavior:

- Wave 20 flattened `sourceLayer.unsupportedFeatures[]` remains active when `psdProfile` is absent.
- Split PNG source assets without PSD profile metadata stay on the existing compatible path.
- Structured profile takes precedence when present, with flattened fields treated as fallback compatibility evidence.

Boundary behavior:

- No PSD bytes are read.
- No decode, raster extraction, file picker, or external parser dependency was added.
- No runtime-core PSD schema or PSD-specific runtime DTO was introduced.
- `packages/validator-core/src/index.ts` remains barrel-only.

## Verification

Gnome verification:

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-source-profile.test.ts`
  - pass, 12 tests
- `pnpm.cmd exec vitest run packages/validator-core/src`
  - pass, 6 files / 40 tests
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- packages/validator-core discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`
  - pass; Git emitted LF/CRLF working-copy warnings only
- dependency manifest diff check
  - pass; no manifest or lockfile diffs
- forbidden source scope check for editor/runtime
  - pass; no `apps/editor` or `packages/runtime-core` diffs

Orch-Sylph verification:

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-source-profile.test.ts`
  - pass, 12 tests
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- packages/validator-core discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`
  - pass; Git emitted LF/CRLF working-copy warnings only
- `git diff --name-only -- apps/editor packages/runtime-core package.json pnpm-lock.yaml pnpm-workspace.yaml packages/*/package.json`
  - pass; no output

Review-Sylph verification:

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-source-profile.test.ts`
  - pass, 12 tests
- `pnpm.cmd exec vitest run packages/validator-core/src`
  - pass, 6 files / 40 tests
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- packages/validator-core discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21`
  - pass; Git emitted LF/CRLF working-copy warnings only
- dependency manifest diff check
  - pass; no manifest or lockfile diffs
- editor/runtime diff check
  - pass; no `apps/editor` or `packages/runtime-core` diffs

Operation/authoring diffs are present in the workspace from parallel Domain B scope. They were observed, left untouched, and are not Domain C changes.

## Review Result

Review-Sylph status: pass.

Findings: none at blocking, high, medium, or low severity.

Review confirmed:

- validator contract fit and status/severity separation
- structured adapter/group/layer/fallback diagnostics are deterministic and AI-readable
- flattened fallback compatibility is preserved
- split PNG compatibility remains intact
- runtime-core non-leakage holds
- source organization and barrel-only entrypoint policy are compliant
- tests cover structured happy path, missing structured profile fallback, conflicting flattened fields, unsupported feature detail, Wave 20 compatibility, and split PNG compatibility

## Residual Risks

- New validator check IDs are implemented in validator-core but not yet mirrored in `discussion/design/module-contracts/validator-contract.md`. This is documentation drift for a later contract refresh, not a Domain C blocker.
- Structured-vs-flattened unsupported feature comparison is deterministic and order-sensitive by source manifest order. A future producer policy could choose set comparison if order becomes non-authoritative.
- Fixture JSON updates remain Domain D scope.

## Downstream Gate

Domain C is pass.

From Domain C's side, Domain D/E can proceed after Domain B also passes. Domain C does not leave validator-side blockers for fixture or editor projection work.
