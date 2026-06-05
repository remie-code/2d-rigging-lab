# Wave46 Domain E Orch Report: Validator/Product Preflight Materialized Asset Diagnostics

> Target: `wave46-validator-product-preflight-materialized-asset-diagnostics`
> Date: 2026-06-05
> Orchestrator: Orch-Sylph
> Implementation: Gnome in a separate context
> Review: Review-Sylph in separate clean contexts

## Verdict

`pass`

Domain E connected PSD selected-layer materialized asset evidence to validator-core diagnostics and Product Preflight status mapping. The implementation stayed parser-free, used parser-free package/operation evidence from Domain C, and did not create a persisted/exported Product Preflight artifact.

One independent Review-Sylph pass returned `needs_changes`; a bounded Gnome fix loop resolved the findings. The final independent Review-Sylph post-fix review returned `pass`.

## Basis Documents

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave46-plan.md`
- `discussion/implementation/waves/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-review.md`
- `discussion/implementation/waves/wave46/wave46-domain-c-package-operation-texture-intake-part-mapping-bridge-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-c-package-operation-texture-intake-part-mapping-bridge-review.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Files Changed For Domain E

Source and tests:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/validators/package-schema.ts`
- `packages/validator-core/src/validators/psd-source-profile.ts`
- `packages/validator-core/src/validators/psd-materialized-asset-diagnostics.ts`
- `packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts`

Reports:

- `discussion/implementation/waves/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-orch-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-review.md`

Other uncommitted Wave46 changes were present in `apps/editor/**`, `packages/package-format/**`, and `packages/operation-core/**` from other domains. Domain E treated them as out of scope and did not use them as an edit target.

## Implementation Summary

- Added parser-free PSD selected-layer materialized asset diagnostics under validator-core.
- Registered the new diagnostic catalog entries for materialized asset availability, source current-byte warning, mismatch/blocking states, destination mapping availability, provenance blocking, and not-evaluated destination mapping.
- Recognized valid package-local materialized binary asset references with matching digest, byteLength, mediaType, package path, storage status, provenance, rights asset, source PSD digest/byteLength, source layer ref/path/name, parser name/version, extraction options, texture, drawable, and destination part mapping evidence.
- Diagnosed missing current source PSD bytes as warning when materialized package-local bytes remain valid.
- Diagnosed stale source digest/byteLength, stale or missing materialized bytes, digest/byteLength/mediaType/path mismatch, raw RGBA dimension/byteLength mismatch, parser/extraction/layer ref mismatch, missing private/local provenance, `publicDemoAsset=true`, and missing or inconsistent texture/drawable/part destination mapping.
- Mapped Product Preflight through the existing status vocabulary: available evidence to `pass`, warning diagnostics to `warn`, blocking diagnostics to `fail`, and absent destination mapping to `not_evaluated`.
- Kept Product Preflight session-generated/read-only; no persisted/exported Product Preflight artifact was added.

## Review Findings And Fix Loop

Initial Review-Sylph verdict: `needs_changes`.

Findings:

- `validateDestinationMapping` did not prove the texture atlas entry used the same materialized binary/provenance/contentHash as `materialization.binaryAssetRef`.
- Non-raw media types could be marked available when materialization and binary ref metadata agreed; Wave46 raw RGBA was not enforced.

Gnome fix loop:

- Enforced the Wave46 raw RGBA media type `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8` for both materialization and binary asset evidence before availability can pass.
- Tightened destination mapping validation so texture atlas identity must match materialized binary evidence across binary asset ref, path, digest, byteLength, mediaType, provenance, rights asset, package path, storage status, and contentHash where present.
- Added regression tests for unrelated texture bytes and internally consistent non-raw media types.

Final Review-Sylph verdict: `pass`.

The final review found no blocking or non-blocking issues and confirmed both prior findings were fixed.

## Verification Performed

Gnome initial implementation:

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/psd-import-preflight-diagnostics.test.ts`: pass, 4 files / 36 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- Parser import scan under `packages/validator-core/src`: pass, no direct `@webtoon/psd` or `ag-psd` imports/requires.
- `git -c core.autocrlf=false diff --check -- packages/validator-core/src`: pass.
- No-index whitespace checks for new validator-core files: pass.

Initial Review-Sylph:

- Focused validator/Product Preflight tests: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- Parser import scan under `packages/validator-core`: pass.
- Diff whitespace checks: pass.
- `pnpm.cmd typecheck`: failed at that time in out-of-scope `apps/editor/**` Domain D files; the reviewer reported `typecheck:root` passed and did not treat this as a Domain E fix target.

Gnome fix loop:

- Focused validator/Product Preflight tests: pass, 4 files / 38 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- Parser import scan under `packages/validator-core/src`: pass, no direct `@webtoon/psd` or `ag-psd` imports/requires.
- `git -c core.autocrlf=false diff --check -- packages/validator-core/src`: pass.
- No-index whitespace checks for new validator-core files: pass.

Final Review-Sylph:

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts`: pass, 8 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/psd-source-profile.test.ts`: pass, 23 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- Parser scan under `packages/validator-core`: pass, no direct parser imports/requires.
- `git diff --check` for touched files: pass with LF/CRLF warnings only.
- No-index whitespace checks for untracked review/test/source files: pass.

## Orchestration Notes

- Orch-Sylph did not implement source changes.
- Gnome implemented validator-core source/tests in a separate context.
- Review-Sylph reviewed in clean separate contexts and was read-only for source files.
- The first review spawn initially hit `agent thread limit reached` after Gnome completed. Orch-Sylph closed the completed Gnome context, retried, and successfully spawned Review-Sylph.
- Review findings were routed back to Gnome through a bounded fix loop.
- The final review artifact is `discussion/implementation/reviews/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-review.md`.

## Remaining Issues / User-Decision Points

None for Domain E.

Future product decisions remain outside this domain: encoded texture media types, public/demo asset policy, all-layer PSD import, drag-drop/archive/filesystem workflows, renderer/pixel oracle, advanced topology/UV/atlas work, and Cubism policy reconsideration.
