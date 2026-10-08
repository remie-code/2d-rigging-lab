# Wave102 Domain A Runtime Export Variant Visibility Foundation Report

## Verdict

`pass`

## Changed Files

- `packages/package-format/src/runtime-export.ts`
- `packages/package-format/src/runtime-export.test.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/authoring-core/src/runtime-export-assembly.test.ts`
- `discussion/implementation/waves/wave102/wave102-domain-a-runtime-export-variant-visibility-foundation-report.md`

## Implementation Summary

- Added optional `baseVisible` to Runtime Export drawable schema.
  - Legacy Runtime Export drawables without `baseVisible` remain parseable.
  - Existing `visible` remains required and keeps its backward-compatible meaning as default-active evaluated initial visibility.
- Updated Runtime Export materialization to emit both visibility fields for every new exported Drawable:
  - `baseVisible = normalizedDrawable.visible`
  - `visible = baseVisible && variantVisibilityPredicate(defaultActiveSelection, drawableId)`
- Added Runtime Export model-level validation that `model.variants.variantGroups[].targetDrawableIds` and `memberships[].drawableId` reference exported `model.drawables`.
- Added export-time Variant metadata sanitization:
  - Variant Group definitions, variants, mode, and default active selection are preserved.
  - `targetDrawableIds` and `memberships` are filtered to the exported Drawable id set after Runtime Export target filtering.
  - If all target rows are filtered from a group, the group remains as a deterministic no-target group with its default selection intact.

## Basis Coverage Self-Report

- `baseVisible` / pre-variant visibility: covered by schema and materialization changes.
- Backward-compatible `visible`: preserved as required schema field and default-active evaluated initial visibility.
- Legacy parse without `baseVisible`: covered by package-format test.
- New exports include `baseVisible`: covered by authoring-core assembly test.
- Default-inactive Variant Drawable: covered by `DRAW_BODY`, where `baseVisible=true` and `visible=false`.
- Non-Variant Drawable / no Variant Groups: covered by no-variant Runtime Export assembly test where base and visible match.
- Runtime Export Variant metadata presence: existing assembly test retained and extended.
- Variant target/membership consistency against exported Drawable ids: covered by package-format rejection test and authoring-core filtering test.
- Existing no-Variant Runtime Export validity: covered by existing package-format and authoring-core tests.
- Runtime Player compatibility: focused loader/runtime-evaluation tests passed; no Runtime Player source changes were made.

## Deferred Basis Items

- Runtime Player active Variant switching remains future scope.
- Live Controller UI, bridge/IPC messages, Browser Source state transport, hotkeys, and Player last-active selection persistence remain future scope.
- Legacy Runtime Exports without `baseVisible` remain loadable but do not gain runtime Variant switching capability.

## Tests / Commands Run

- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts packages/package-format/src/package-document.test.ts`
  - First sandboxed run failed before tests with Vite/esbuild `spawn EPERM`.
  - Escalated rerun passed: 2 files, 21 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-assembly.test.ts`
  - Passed: 1 file, 16 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/runtime-export-loader apps/runtime-player/src/stage/runtime-evaluation`
  - Passed: 4 files, 27 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check`
  - Passed with LF-to-CRLF working-copy warnings only.

Not run:

- Full repository test suite.
- `pnpm install`, per instruction.
- `packages/authoring-core/src/runtime-export-materialization.test.ts`, because that file is not present in the current tree; coverage is in `runtime-export-assembly.test.ts`.

## Conditional Write Scope Justification

No conditional write scope was used.

No files under `packages/runtime-core/src/**`, `packages/render-core/src/**`, or `packages/render-webgl2/src/**` were changed.

## Forbidden-Scope Statement

No Runtime Player Live Controller UI, Runtime Player active Variant selection state, bridge/IPC Variant messages, Stage Window / Browser Source render behavior changes, Player last-active Variant persistence, Editor Variant Manager changes, Editor Viewer Variant switching changes, Texture Atlas packing/target selection changes, Runtime Export directory UX changes, Workspace Save / Portable JSON changes, dependency changes, lockfile changes, or manifest changes were implemented.

`hiddenAtApply` and atlas placement metadata were not used as Runtime Export base visibility.

## Residual Risks

- Runtime Export keeps no-target Variant Groups after filtering all target/membership rows. This preserves group/default metadata deterministically, but future Player UI may choose to hide or disable no-target groups.
- Legacy Runtime Exports without `baseVisible` remain valid but lack the pre-variant visibility layer needed for future runtime Variant switching.
- Verification was focused; full repository tests and browser/e2e tests were not run.
