# Wave 27 Domain C: Validator Composition Diagnostics Report

## Verdict

implemented

## Scope

- Target: `wave27-validator-composition-diagnostics`
- Implemented only validator-core source, validator focused tests, the validator contract check catalog section, and this Wave 27 report.
- No operation handler, runtime evaluator, editor UI, fixture contract, dependency, manifest, or lockfile changes were made by this Domain C implementation.

## Files Changed

- `packages/validator-core/src/validators/mask-composition.ts`
  - New mask relation semantic/runtime evidence validator.
- `packages/validator-core/src/validators/package-runtime.ts`
  - Wires mask composition checks into package runtime validation.
- `packages/validator-core/src/check-catalog.ts`
  - Adds formal mask composition check catalog entries and `mask_resolution` phase.
- `packages/validator-core/src/index.ts`
  - Barrel-only export for the new validator file.
- `packages/validator-core/src/mask-composition-diagnostics.test.ts`
  - Focused deterministic diagnostics coverage.
- `discussion/design/module-contracts/validator-contract.md`
  - Narrow check catalog/rule update to avoid validator contract drift.
- `discussion/implementation/waves/wave27/wave27-validator-composition-diagnostics-report.md`
  - This report.

## Diagnostics Added / Confirmed

- `mask.sourceMissing`
  - Missing mask/source drawable reference.
- `mask.targetMissing`
  - Missing target drawable reference.
- `mask.selfReference`
  - Same drawable used as mask source and target.
- `mask.duplicateRelation`
  - Duplicate mask relation ID or duplicate source-target semantic relation.
- `mask.runtimeEvidenceMissing`
  - Enabled, statically resolvable relation has no matching current runtime snapshot evidence, including stale snapshot identity mismatch.
- `mask.runtimeEvidenceMismatch`
  - Disabled relation appears in runtime evidence, unknown runtime relation appears, runtime evidence is unresolved, or source/target mismatched.
- `mask.opacityEvidenceMissing`
  - Runtime snapshot has matched mask evidence but omits evaluated drawable entries needed to inspect source/target opacity.
- Out-of-range runtime opacity remains covered by existing `runtime.loadBlocking`; out-of-range package drawable opacity remains covered by package schema diagnostics.

## Pass Evidence For Required Cases

- Valid mask relation validates with runtime evidence:
  - `mask-composition-diagnostics.test.ts`: matching enabled relation plus runtime mask evidence produces pass with no checks.
- Missing mask drawable:
  - Emits `mask.sourceMissing`.
- Missing target drawable:
  - Emits `mask.targetMissing`.
- Self-mask:
  - Emits `mask.selfReference`.
- Duplicate relation:
  - Emits `mask.duplicateRelation`.
- Disabled/evidence mismatch:
  - Emits `mask.runtimeEvidenceMismatch` when disabled package relation appears in runtime evidence.
- Runtime evidence gap:
  - Emits `mask.runtimeEvidenceMissing` when enabled relation has no runtime snapshot evidence or the supplied snapshot identity is stale for the validated package.
- Opacity evidence gap:
  - Emits `mask.opacityEvidenceMissing` when runtime mask evidence exists but required evaluated drawable opacity evidence is absent.
- Out-of-range opacity:
  - Confirmed via focused test as `runtime.loadBlocking` for runtime snapshot opacity outside `0..1`.

## Tests Run

- `pnpm.cmd exec vitest run packages/validator-core/src/mask-composition-diagnostics.test.ts`
  - Result: pass, 1 file / 11 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src`
  - Result: pass, 15 files / 87 tests.
- `pnpm.cmd typecheck`
  - Result: pass.
- `pnpm.cmd test:unit`
  - Result: pass, 129 files / 675 tests.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave27`
  - Result: pass; Git printed LF-to-CRLF working-copy warnings only.
- `pnpm.cmd run check:source`
  - Result: pass, source organization guard passed.

## Assumptions

- Runtime mask evidence schema is the current `RuntimeSnapshotDto` shape from runtime-core: `maskRelationId`, `sourceDrawableIds`, `targetDrawableIds`, `enabled: true`, `clippingIntent: "semanticClipping"`, and `resolved`.
- Validator remains a semantic/evidence checker only. It does not evaluate pixel clipping, renderer output, or Cubism compatibility.
- `mask.opacityEvidenceMissing` is intentionally relation-scoped and only checks absence of runtime drawable evidence needed for opacity inspection. It does not introduce a broad opacity evaluator.

## Existing Unrelated Dirty Work Observed

Parallel or pre-existing dirty changes were present outside Domain C, including `discussion/implementation/**`, `packages/authoring-core/**`, `packages/operation-core/**`, and `packages/runtime-core/**`. Domain C did not revert or edit those files, except reading current runtime-core types to align validator checks with the active runtime evidence schema.

## Remaining Issues

- No fixture contract files were changed in Domain C. Domain D should lock cross-module fixture evidence if needed.
- Existing `mask.opacityZeroSource` contract warning remains can-defer and was not implemented here; Domain C only added opacity evidence-gap confirmation required by Wave 27.
- No reviewer conclusion is recorded here; Review-Sylph owns the independent review report.
