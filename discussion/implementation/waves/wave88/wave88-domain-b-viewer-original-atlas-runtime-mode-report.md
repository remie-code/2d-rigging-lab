# Wave88 Domain B Report: Viewer Original / Atlas Runtime Mode

## Verdict / Status

done

Implemented Viewer render source modes `Original` and `Atlas Runtime`. Original keeps the existing clean-stage Canvas projection. Atlas Runtime validates the committed texture atlas artifact, recomputes the Domain A source signature, and remaps the Viewer projection texture refs/bytes/dimensions/UVs without mutating `session.graph`. Runtime Controls now shows the mode control above parameter search and disables Atlas Runtime with a deterministic short reason when unavailable.

## Basis Coverage Self-Report

Read and applied:

- `discussion/implementation/orchestration/wave88-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave88/wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md`
- `discussion/implementation/reviews/wave88/wave88-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave88/wave88-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave88/wave88-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/reviews/wave87/wave87-final-clean-integration-review.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Deferred basis items:

- Design doc updates remain Domain C scope.
- Workspace Directory Export remains out of scope.

## Current-State Confirmation

- Confirmed Domain A source-signature helpers are exported from `packages/authoring-core/src/index.ts`.
- Confirmed Viewer clean stage used `createViewerCleanStageProjection()` -> `createCanvasRenderProjection()` -> `renderCanvasProjection()`.
- Confirmed `CanvasRenderProjection.drawables[]` already carries `textureId`, binary ref fields, raw `renderBytes`, render dimensions, and evaluated mesh UVs.
- Confirmed Canvas projection reads authoring drawable texture refs and mesh UVs; no Canvas render mode was added.
- Confirmed existing Atlas UI test still had Wave87 destructive Apply expectations; updated only that test expectation to match Domain A artifact-only Apply.

## Viewer Original Trace

- `apps/editor/src/workspace/viewer/viewer-render-source.ts` defines `ViewerRenderSourceMode = "original" | "atlasRuntime"` with labels `Original` and `Atlas Runtime`.
- `createViewerCleanStageProjection()` still defaults to Original and returns the existing clean-stage projection behavior.
- Tests assert Original keeps authoring texture refs, 2x2 original dimensions, and original unit UVs after a committed atlas exists.

## Viewer Atlas Runtime Projection Trace

- `createViewerCleanStageRenderSourceProjection()` builds the original Canvas projection, then applies Viewer-only render source resolution.
- Atlas Runtime requires:
  - committed `textureAtlas.layoutSummary`;
  - first layout page;
  - generated atlas texture entry;
  - atlas `binaryAssetRef`;
  - loaded atlas bytes in `session.binaryAssets.fileEntries`;
  - valid page/entry dimensions and `page.width * page.height * 4` byte length;
  - existing `layoutSummary.sourceSignature`;
  - source signature match against current `selectTextureAtlasTargets()` + `createTextureAtlasSourceSignature()`;
  - valid placements for current packable targets and renderable projection drawables.
- Remap changes only the temporary Viewer projection:
  - drawable `textureId` becomes the atlas texture id;
  - binary id/path and render bytes/dimensions become the generated atlas binary;
  - UVs are projected into placement `uvRect`.
- Tests assert atlas texture id, binary id/path, byte object, dimensions, and UVs match the committed placement.
- Tests snapshot `session.graph` before projection and assert it is unchanged after Atlas Runtime projection.

## Missing / Stale Policy Trace

- Missing layout disables Atlas Runtime with `Apply a texture atlas first.`
- Missing page, texture entry, binary ref, loaded bytes, invalid dimensions, invalid byte length, missing source signature, stale source signature, invalid placement, and missing placement each return deterministic unavailable codes/reasons.
- If requested `Atlas Runtime` is invalid, the effective render source falls back to `Original`.
- Tests cover missing atlas, stale mesh UV/source input, and missing placement.
- Tests mutate deformer rest angle, add keyform data, and add dynamics-only data; Atlas Runtime remains available because the source signature excludes those non-source inputs.

## Canvas Preservation Trace

- Canvas projection code was not changed.
- `viewer-render-source.test.ts` asserts Canvas projection still uses original drawable texture ids and original mesh UVs after atlas commit.
- `texture-atlas-task-screen.test.ts` was narrowly updated so Operation-backed Apply expects original drawable texture ids and mesh UVs, matching Domain A artifact-only Apply.

## Runtime Controls UI Trace

- `RuntimeControls` now renders the render source segmented control above parameter search.
- The control uses labels `Original` and `Atlas Runtime`.
- Atlas Runtime button is disabled when unavailable, with the short reason shown in Runtime Controls only.
- Viewer primary content remains clean; no detailed atlas diagnostics were added to the stage.
- Tests assert mode control ordering, labels, disabled reason, and invalid selected mode fallback.

## Must-not Compliance Evidence

- Did not mutate authoring `Drawable.textureId`, `Mesh.uvs`, or `Mesh.topologyRevision`.
- Did not change Canvas user-facing behavior or add a Canvas atlas mode.
- Did not change `render-webgl2` shader/renderer behavior.
- Did not route through runtime-core for atlas materialization.
- Did not add dependencies.
- Did not implement Workspace Directory Export, manual atlas editing, multi-page atlas, camera capture, mesh generation, Deformer/keyform/dynamics feature changes, playback expansion, or Cubism compatibility/format claims.
- Did not touch `packages/render-core/src/**` or `packages/authoring-core/src/**`.

## Changed Files

- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `discussion/implementation/waves/wave88/wave88-domain-b-viewer-original-atlas-runtime-mode-report.md`

## Validation Commands and Results

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts`
  - sandbox attempt failed with known Vitest/esbuild `spawn EPERM`;
  - escalated rerun passed: 4 files, 40 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
  - sandbox attempt failed with known Vitest/esbuild `spawn EPERM`;
  - first escalated run exposed stale Wave87 destructive Apply expectation;
  - after narrow test update, escalated rerun passed: 1 file, 8 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
  - escalated rerun passed: 5 files, 48 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed with CRLF working-copy warnings only.

## Residual Risks

- Atlas Runtime availability recomputes source signatures in Viewer render projection creation; this is deterministic but may be a future performance optimization point for large assets.
- The Viewer policy is strict: a renderable projection drawable without a committed placement disables Atlas Runtime rather than rendering it unchanged.
- Old persisted atlas layout summaries without `sourceSignature` are treated as unavailable and require regeneration; no migration was added.
- No browser pixel screenshot was added; evidence is projection/UI-level focused tests.

## User-Decision Points

- Decide later whether old atlas artifacts without `sourceSignature` should be migrated or always regenerated.
- Decide later whether strict missing-placement disablement should remain the long-term Viewer policy for renderable unplaced drawables.
