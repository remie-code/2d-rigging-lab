# Wave28 Domain G Remediation R2 Gnome Report: Viewer Drawable Part Evidence

## verdict

done

## target

- `wave28-domain-g-remediation-viewer-drawable-part-evidence`
- Date: 2026-06-01

## files changed

- `apps/editor/src/editor-preview/texture-preview-resolution.ts`
- `apps/editor/src/editor-preview/texture-preview-resolution.test.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
- `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `discussion/implementation/waves/wave28/domain-g-remediation-viewer-drawable-part-evidence-gnome-report.md`

## implementation summary

- Fixed the Preview/Viewer projection path that could show a drawable as `part none` even when the same projection already had part hierarchy membership for that drawable.
- `applyEditorPreviewTextureAssets` now builds a drawable-to-part index from `preview.parts` and fills only missing drawable `partId` evidence. Existing drawable `partId` evidence is not overwritten.
- The Viewer surface renders Drawable Layer Evidence from `projection.previewProjection.drawables`, so the hydrated `partId` now reaches Viewer evidence after workflow save/load projection.
- Updated the focused Domain G smoke assertion to expect `${drawableId}: part ${partId} / texture ${textureId}` instead of accepting `part none`.

This keeps editor-only state in Editor Preview projection and does not change runtime-core semantics, operation handlers, validator behavior, UI layout, asset I/O, parser/decode logic, dependencies, or `index.ts` implementation logic.

## why evidence is now truthful

Domain F already enriches Preview/Viewer projection with the current Editor package part hierarchy. The bug was that drawable rows kept the runtime snapshot drawable `partId`, which can be absent while the projection's part hierarchy correctly lists the drawable under the authored part. The fix uses the current projected part membership as the fallback source for missing drawable `partId`, so Viewer Drawable Layer Evidence agrees with the package/model membership instead of reporting `part none`.

## tests and verification

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-preview/texture-preview-resolution.test.ts`
  - 1 file / 3 tests passed.
- `pnpm.cmd exec vitest run apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - 4 files / 15 tests passed.
- `pnpm.cmd typecheck`
  - root and editor typecheck passed.
- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - passed.
- `git diff --check -- apps/editor/src/editor-preview apps/editor/src/editor-workflow apps/editor/e2e discussion/implementation/waves/wave28`
  - passed; Git reported LF-to-CRLF working-copy warnings only.
- Trailing-whitespace scan for touched untracked focused smoke/test files:
  - `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - no matches.

Attempted:

- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - failed before reaching Viewer evidence verification.
  - Failure: desktop `assertPartTextureLayerPanelReachable` reported `createSubmitVisible: false` after scrolling the assignment controls into view.
  - This is separate from the Viewer Drawable Layer Evidence mismatch. The focused unit/workflow tests now cover the evidence projection, and the smoke assertion has been corrected for the next Domain G rerun.

## remaining issues

- The focused Domain G browser smoke still needs a rerun after the layer-tree panel reachability/layout precondition is addressed or stabilized. This pass did not change UI layout because that is outside this remediation scope.
- The earlier Domain G full e2e mobile overflow blocker remains outside this remediation.

## user-decision points

None for this remediation. Remaining e2e/layout routing is an Orch-Sylph coordination point, not an end-user decision.
