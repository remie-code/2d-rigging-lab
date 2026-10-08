# Wave102 Domain A Spec Compliance Review

Lane: Spec Compliance Review

## Verdict

`pass`

## Reviewed Files

- `discussion/implementation/orchestration/wave102-plan.md`
- `discussion/runtime-player/screens/live-controller-page.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave92/wave92-final-integration-report.md`
- `discussion/implementation/waves/wave99/wave99-final-integration-report.md`
- `discussion/implementation/waves/wave100/wave100-final-integration-report.md`
- `discussion/implementation/waves/wave101/wave101-final-integration-report.md`
- `discussion/implementation/waves/wave102/wave102-domain-a-runtime-export-variant-visibility-foundation-report.md`
- `packages/package-format/src/runtime-export.ts`
- `packages/package-format/src/runtime-export.test.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/authoring-core/src/runtime-export-assembly.test.ts`
- Narrow compatibility scope: `apps/runtime-player/src/main/runtime-export-loader/**`, `apps/runtime-player/src/stage/runtime-evaluation/**`, plus runtime-player forbidden-scope diff checks.

## Source Evidence

- Runtime Export Drawable now accepts optional `baseVisible` while keeping required `visible`: `packages/package-format/src/runtime-export.ts:335`, `packages/package-format/src/runtime-export.ts:336`.
- Legacy parse compatibility is preserved through `parseRuntimeExportModel` using `RuntimeExportModelSchema.safeParse`: `packages/package-format/src/runtime-export.ts:849`.
- New materialization derives `baseVisible` from pre-variant runtime drawable visibility and keeps `visible` as default-active evaluated visibility: `packages/authoring-core/src/runtime-export-materialization.ts:146`, `packages/authoring-core/src/runtime-export-materialization.ts:155`.
- Runtime Export materialization filters Variant groups against included exported Drawable ids before resolving defaults and predicates: `packages/authoring-core/src/runtime-export-materialization.ts:93`, `packages/authoring-core/src/runtime-export-materialization.ts:94`, `packages/authoring-core/src/runtime-export-materialization.ts:343`.
- Runtime Export emits `model.variants` when Variant Groups remain present: `packages/authoring-core/src/runtime-export-materialization.ts:225`.
- Assembly validates materialized artifacts through `assertRuntimeExportV0SinglePageArtifacts`: `packages/authoring-core/src/runtime-export-assembly.ts:289`.
- Existing group/mode/default/membership consistency validation remains in `VariantGroupSchema`: `packages/package-format/src/model-variants.ts:63`, `packages/package-format/src/model-variants.ts:104`, `packages/package-format/src/model-variants.ts:112`, `packages/package-format/src/model-variants.ts:132`, `packages/package-format/src/model-variants.ts:142`.
- Runtime Export variants default-selection consistency remains validated: `packages/package-format/src/runtime-export.ts:523`, `packages/package-format/src/runtime-export.ts:577`, `packages/package-format/src/runtime-export.ts:587`.
- Runtime Export model validation rejects Variant target/membership references to non-exported drawables: `packages/package-format/src/runtime-export.ts:731`, `packages/package-format/src/runtime-export.ts:742`.
- Tests cover new and legacy `baseVisible` parsing: `packages/package-format/src/runtime-export.test.ts:128`.
- Tests cover non-exported Variant target/membership rejection: `packages/package-format/src/runtime-export.test.ts:266`.
- Tests cover materialized `baseVisible`, default-active evaluated `visible`, metadata presence, default selections, and exported-id filtering: `packages/authoring-core/src/runtime-export-assembly.test.ts:93`, `packages/authoring-core/src/runtime-export-assembly.test.ts:122`, `packages/authoring-core/src/runtime-export-assembly.test.ts:157`.
- Runtime Player forbidden scope has no diff under `apps/runtime-player/src/control`, `apps/runtime-player/src/main`, `apps/runtime-player/src/preload`, or `apps/runtime-player/src/stage`; `apps/runtime-player/src/control/live-controller-page.tsx` does not exist.
- `hiddenAtApply` is not used in Runtime Export materialization as base visibility. Targeted search found it only in test/fixture contexts, not in the production materialization path.

## Test / Command Evidence

- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts packages/package-format/src/package-document.test.ts`
  - Pass: 2 files, 21 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-assembly.test.ts`
  - Pass: 1 file, 16 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/runtime-export-loader apps/runtime-player/src/stage/runtime-evaluation`
  - Pass: 4 files, 27 tests.
- `pnpm.cmd typecheck`
  - Pass.
- `git diff --name-only -- apps/runtime-player/src/control apps/runtime-player/src/main apps/runtime-player/src/preload apps/runtime-player/src/stage package.json pnpm-lock.yaml pnpm-workspace.yaml`
  - No output.
- `git diff -- packages/package-format/src/runtime-export.ts packages/package-format/src/runtime-export.test.ts packages/authoring-core/src/runtime-export-materialization.ts packages/authoring-core/src/runtime-export-assembly.test.ts`
  - Reviewed directly.
- `rg` forbidden-scope checks for Live Controller, active Variant switching, `baseVisible`, and `hiddenAtApply`
  - No production Runtime Player implementation of UI/switching found.

## Spec Compliance Checklist

1. New Runtime Export drawables include `baseVisible` or equivalent pre-variant visibility in new exports: pass.
2. Existing `visible` remains present and remains default-active evaluated initial visibility: pass.
3. Legacy Runtime Export without `baseVisible` still parses: pass.
4. Runtime Export `model.variants` metadata remains present when Variant Groups exist: pass.
5. Variant target/membership references to exported Drawable ids are deterministic and valid, or deterministically sanitized with tests: pass.
6. Default active selections remain present and valid for every exported Variant Group: pass.
7. Existing package-format validation for group/mode/default consistency remains intact: pass.
8. Runtime Player Live Controller UI is not implemented: pass.
9. Player active Variant switching is not implemented: pass.
10. Stage Window / Browser Source render behavior is not changed: pass.
11. `hiddenAtApply` is not used as Runtime Export base visibility: pass.

## Findings

None.

## Residual Risks / Open Verification Items

- Full repository tests, browser E2E, and visual verification were not run in this review lane.
- The new filtering test covers partial filtering of non-exported Variant targets/memberships. A dedicated all-targets-filtered materialization test would further document the no-target group behavior reported by Domain A, but the current schema allows empty `targetDrawableIds` / `memberships` and assembly validates artifacts.
