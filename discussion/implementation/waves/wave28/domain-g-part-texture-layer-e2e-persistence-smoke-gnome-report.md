# Wave28 Domain G Gnome Report: Part / Texture / Layer E2E Persistence Smoke

## Verdict

escalate

## Files Changed

- `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`

## Implementation Summary

- Added a focused browser smoke for part create -> drawable part reassignment -> existing texture atlas assignment -> layer select/lock/editor-hide -> Preview/Viewer inspection -> save/load -> reinspection.
- The focused smoke runs both desktop and mobile viewports and checks:
  - layer tree accessibility basics and visible/reachable controls
  - no horizontal overflow for the focused workflow
  - package save JSON for `model/graph.json`, `model/drawables.json`, `assets/textures/texture-atlas.json`, and `model/editor-state.json`
  - Preview semantic `data-*` evidence for runtime visible, editor hidden, locked, selected, texture-backed, and texture-resolved state
  - Viewer/Runtime part layer evidence, drawable texture/layer evidence, and validation diagnostics surface presence after load
- Added layer-tree test id mirrors to `apps/editor/e2e/test-ids.mjs`.
- Wired the new smoke into the full editor e2e smoke sequence after the existing Wave27 composition smoke.
- Kept all source implementation outside `apps/editor/e2e/**` unchanged.

## Tests / Verification

Passed:

- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Passed with exit code 0.
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Passed with exit code 0.
  - Desktop smoke passed; screenshot `png base64Length=110704`.
  - Mobile smoke passed; screenshot `png base64Length=52608`.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`
  - Passed with exit code 0.
  - Git emitted existing LF-to-CRLF working-copy warnings for touched e2e files.

Failed / escalation evidence:

- `pnpm.cmd test:e2e`
  - Failed with exit code 1.
  - Desktop full editor smoke passed before the mobile run started.
  - Mobile failed at the existing `post-source-intake` horizontal overflow gate before later adjacent mobile smokes could run.
  - Failure excerpt: `mobile post-source-intake horizontal overflow ... label/select .layer-tree-panel__field/.layer-tree-panel__select ... Texturetex_psd_e2e_face / assets/textures/tex_psd_e2e_face.png ... right 451 ... viewportWidth 390`.

## Skipped Verification

- `pnpm.cmd typecheck` was not run because Domain G changed only e2e JavaScript and this report; no TypeScript/UI source files were edited.
- Full mobile adjacency after source intake was not reached because `pnpm.cmd test:e2e` stops at the layer-tree texture select overflow. Desktop adjacency in the full smoke did run and passed.

## Remaining Issues

- Full e2e cannot pass on mobile until the layer-tree texture `<select>` handles long texture atlas labels without horizontal overflow. Fixing that requires UI layout/source changes outside Domain G's allowed write scope.
- Viewer Runtime currently shows drawable membership in `Part Layer Evidence`, while `Drawable Layer Evidence` still renders `part none` for the drawable row. The focused smoke verifies saved package membership and Viewer part evidence instead of changing runtime/viewer projection in this e2e-only domain.

## User-Decision Points

None. The escalation is a scope-routing issue for Orch-Sylph: permit/delegate a narrow UI layout fix for the layer-tree texture select overflow, or route it back to the editor UI domain.
