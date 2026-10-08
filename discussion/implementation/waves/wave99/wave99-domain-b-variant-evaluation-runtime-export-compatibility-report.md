# Wave99 Domain B Report: Variant Evaluation / Runtime Export Compatibility

## Verdict

Domain id: `wave99-variant-evaluation-runtime-export-compatibility`

Verdict: `done` from Gnome perspective.

Domain B source implementation is complete in the allowed `authoring-core` and narrow `package-format` Runtime Export schema scope. No Editor UI, Runtime Player UI/hotkey/protocol, Runtime Core, render packages, dependency manifest, lockfile, or Texture Atlas packing algorithm files were edited.

## Changed Files

Variant evaluation:

- `packages/authoring-core/src/variant-evaluation.ts`
- `packages/authoring-core/src/variant-evaluation.test.ts`
- `packages/authoring-core/src/index.ts` (barrel export only)

Runtime Export schema:

- `packages/package-format/src/runtime-export.ts`
- `packages/package-format/src/runtime-export.test.ts`

Runtime Export materialization / atlas policy tests:

- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/authoring-core/src/runtime-export-assembly.test.ts`

Report:

- `discussion/implementation/waves/wave99/wave99-domain-b-variant-evaluation-runtime-export-compatibility-report.md`

## Implementation Summary

- Added pure Variant evaluation helpers:
  - `resolveDefaultVariantActiveSelections`
  - `createVariantVisibilityPredicate`
  - `resolveVariantVisibilityForDrawable`
- Predicate behavior:
  - missing/empty Variant groups return `true`;
  - Variant-neutral drawables return `true`;
  - assigned drawables use membership intersection against active selection;
  - `singleSelect` and `multiToggle` are both supported.
- Added optional Runtime Export `model.variants` section:
  - `schemaVersion: "runtime-export-variants-v0"`;
  - structured `variantGroups`;
  - explicit `defaultActiveSelections`;
  - schema enforces group/default selection consistency.
- Runtime Export materialization now:
  - omits `model.variants` when there are no Variant groups;
  - includes Variant metadata/default active selection when Variant groups exist;
  - computes initial `drawables[].visible` as existing runtime visibility AND default-active Variant predicate.

## Tests Run

Passed:

- `pnpm.cmd exec vitest run packages/authoring-core/src/variant-evaluation.test.ts packages/package-format/src/runtime-export.test.ts packages/authoring-core/src/runtime-export-assembly.test.ts`
  - 3 files, 28 tests passed.
- `pnpm.cmd typecheck`
  - Initial run found local Domain B type issues; fixed and reran successfully.
- `pnpm.cmd exec vitest run packages/authoring-core/src/variant-evaluation.test.ts packages/package-format/src/runtime-export.test.ts packages/authoring-core/src/runtime-export-assembly.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts`
  - 4 files, 36 tests passed.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts`
  - 1 file, 14 tests passed; read-only compatibility verification.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check -- packages/authoring-core/src packages/package-format/src discussion/implementation/waves/wave99`
  - Exit 0; Git emitted existing CRLF conversion warnings only.

Fix Loop 1 / TA-B-001:

- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts`
  - 1 file, 8 tests passed.

## Variant-Free Runtime Export Compatibility Evidence

- `RuntimeExportModelSchema` keeps `variants` optional, so existing Runtime Export model artifacts without Variant metadata still parse.
- `runtime-export.test.ts` verifies the minimal old-style Runtime Export model parses with `variants === undefined`.
- `runtime-export-assembly.test.ts` verifies a variant-free authoring session still materializes without `model.variants`.
- `runtime-export-materialization.ts` only adds `model.variants` when `session.graph.variantGroups` is non-empty.
- Runtime Player directory loader tests still pass because the loader uses `package-format` parse helpers.

## Fix Loop 1 / TA-B-001 Closure

- Fix scope was tests-only plus this report; `packages/package-format/src/runtime-export.ts` was not changed.
- Added negative Runtime Export Variant metadata schema coverage for:
  - missing `defaultActiveSelections`;
  - explicit selection referencing a missing group;
  - group `defaultActive` and explicit default selection mismatch;
  - explicit selection kind not matching the Variant Group mode;
  - explicit selection referencing a missing Variant.
- The test asserts stable issue paths so the schema consistency branches remain covered, not just a generic parse failure.

## Texture Atlas Evidence

- `selectTextureAtlasTargets` was not changed; it still derives included drawables from `rigControls[].childDrawableIds`.
- `texture-atlas-source-signature.ts` was not changed; Variant membership/default active are not signature inputs.
- `runtime-export-assembly.test.ts` adds coverage that default-hidden Variant drawables remain included when bound.
- `runtime-export-assembly.test.ts` adds coverage that adding/changing Variant membership and default active selection alone does not make Runtime Export preflight stale.
- Existing `texture-atlas-mutations.test.ts` passed, preserving source-signature freshness behavior.

## Basis Coverage Self-Report

- Pure predicate helper from groups + active selection + drawable id: covered.
- Missing/empty variants resolve `true`: covered.
- Unassigned drawables resolve `true`: covered.
- Assigned drawables resolve according to active selection: covered.
- `singleSelect` and `multiToggle`: covered.
- Default active selection resolver: covered.
- Runtime Export metadata/default active inclusion: covered.
- Existing exports without variants parse: covered.
- Variant-free Runtime Export materialized shape remains compatible: covered.
- Default active selection affects initial exported visibility: covered.
- Atlas target selection remains bound Drawable based: covered.
- Variant membership/default active change alone does not stale atlas/runtime export preflight: covered.

## Deferred Basis Items

- Canvas preview predicate integration is Domain C.
- Editor Variant Manager UI, Add Drawables picker, preview active session state, and Parameter Bar behavior are Domain C.
- Runtime Player Variant switching UI/hotkeys/Browser Source protocol remain out of Wave99 Domain B.
- No `packages/runtime-core` helper was needed; future runtime predicate composition can consume exported metadata later.

## Source Organization / Dependency Notes

- New source is isolated in `variant-evaluation.ts`; `index.ts` is barrel-only.
- Runtime Export schema additions stay in the existing Runtime Export schema responsibility file.
- No dependency additions, package manifest changes, or lockfile changes.
- Source organization and dependency guards passed.

## Residual Risks

- Runtime Export now duplicates default active selection inside each group and in `defaultActiveSelections`; schema enforces consistency to avoid ambiguous runtime metadata.
- Existing Runtime Player can load the new schema through `package-format`, but it does not implement Variant switching UI. Domain B mitigates this by baking default active selection into initial `drawables[].visible`.
- Variant operations from Domain A can still create targets that are not runtime-bound; Domain C picker is expected to prevent this in UI. Domain B does not broaden Atlas target selection to compensate.
