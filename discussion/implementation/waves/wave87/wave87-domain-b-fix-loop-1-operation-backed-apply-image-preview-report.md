# Wave87 Domain B Fix Loop 1: Operation-backed Apply and Atlas Image Preview

Date: 2026-06-19
Agent: Gnome implementation agent
Verdict: needs_orch_review

## Basis Coverage Self-report

Read before implementation:

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave87/wave87-domain-b-test-adequacy-review.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Current-state Confirmation

- Domain A atlas APIs were present and used: target selection, preview, raw RGBA atlas bytes, and pure apply mutation.
- Domain B routing already opened the dedicated Texture Atlas task screen.
- The previous Apply path bypassed Operation Core through `commitTextureAtlasPreview()` directly calling Domain A `applyTextureAtlasPreview()`.
- The previous preview rendered placement rectangles but not the generated atlas artwork.
- Operation Core lifecycle was synchronous; Domain A atlas apply remains async because generated binary digest uses async package binary SHA-256.
- Existing dirty/untracked Domain A/B work was preserved; unrelated files were not reverted.

## Implementation Summary

- Added a narrow async Operation Core lifecycle:
  - `OperationHandler.dryRunAsync` and `OperationHandler.commitAsync` are optional.
  - `OperationCore.dryRunOperationAsync()` and `OperationCore.commitOperationAsync()` were added.
  - Existing synchronous lifecycle methods and sync call sites remain available.
- Added `applyTextureAtlasPreview` Operation Core support:
  - operation type, payload schema, id token, registry entry, index export, handler, and focused tests.
  - The payload carries settings, editor hidden part ids, expected layout summary, and locked target ids.
  - The payload does not carry raw source texture bytes or generated atlas bytes.
  - The handler recreates the preview from the current session and payload settings, rejects failed/stale layouts, checks locked targets, and then calls Domain A apply with the resolved operation id.
  - Sync lifecycle calls for this operation reject with `operation.applyTextureAtlasPreview.asyncLifecycleRequired`.
  - The committed result includes model diff fields for generated texture entry, layout summary, generated binary metadata, drawable texture refs, mesh UVs, and topology revisions.
- Routed editor-session Apply through Operation Core:
  - `commitTextureAtlasPreview()` now uses `createOperationCore().commitOperationAsync(...)`.
  - `EditorSessionProvider` passes the current `editorHiddenPartIds` into the operation payload.
  - The GUI-facing API shape remains an async editor-session command and updates history only after the operation-backed commit succeeds.
- Added actual atlas artwork preview:
  - Projection calls Domain A `createTextureAtlasPageRgbaBytes(preview)` for ready previews.
  - The task screen paints those RGBA bytes into a browser canvas via `ImageData`.
  - Placement overlays, labels, hidden indication, and stale warning remain layered above the artwork.
- Added a narrow authoring-core re-export of atlas layout schemas/types from `texture-atlas-packing.ts` so Operation Core can keep using its existing authoring-core dependency without adding a package-format dependency in this fix loop.

## Operation Apply Trace

1. User generates a preview in the Texture Atlas task screen.
2. User clicks Apply Atlas.
3. UI calls `useEditorSession().applyTextureAtlasPreview(preview)`.
4. `EditorSessionProvider` calls `commitTextureAtlasPreview(currentSession, preview, { editorHiddenPartIds })`.
5. `commitTextureAtlasPreview()` clones the session, creates an `applyTextureAtlasPreview` operation request, and calls `createOperationCore().commitOperationAsync(...)`.
6. The Operation Core handler recreates the Domain A preview from the current session/settings/hidden ids.
7. The handler rejects if the recreated preview fails or does not match the expected layout summary.
8. The handler calls Domain A `applyTextureAtlasPreview(session, { preview, operationId })`.
9. Domain A registers generated atlas bytes with the async digest, updates layout/generated texture/provenance/binary metadata/drawable refs/mesh UVs, and records the operation id.
10. Operation Core increments package revision, applies evidence hooks, and appends the operation log entry.

## Actual Image Preview Trace

1. `createTextureAtlasTaskProjection()` builds the ready projection without mutating project state.
2. `createPreviewPage()` calls `createTextureAtlasPageRgbaBytes(preview)`.
3. Projection exposes `previewPage.image` with width, height, RGBA bytes, byte length, and a deterministic signature.
4. `AtlasPreviewImageLayer` paints the bytes into a canvas with `putImageData(new ImageData(...))`.
5. Rect overlays and labels render after the canvas, so placement rectangles and hidden state remain legible on top of the actual generated atlas artwork.

## Tests and Checks

Passed:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
  - 2 files, 14 tests passed.
  - First sandbox run failed with esbuild `spawn EPERM`; rerun with elevated execution passed.
- `pnpm.cmd typecheck`
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`
  - Passed with existing CRLF normalization warnings only.

Focused evidence added:

- Operation Core commit/dry-run tests prove async lifecycle, stale layout rejection, failed preview recreation rejection, generated texture/layout/binary metadata, drawable refs, mesh UV changes, and operation log/model diff evidence.
- Editor Atlas task tests prove the command helper commits through Operation Core and records generated-by operation id/package revision/log payload behavior.
- Atlas projection/render tests prove generated preview exposes actual atlas image data and renders a canvas layer behind placement overlays.

## Forbidden-scope Compliance

- No workspace directory export, ZIP/archive export, or File System Access API work.
- No camera/tracking input work.
- No Viewer, Dynamics, Mesh generation, Deformer, or keyform changes outside atlas apply wiring.
- No manual atlas rect editing.
- No multi-page atlas optimization.
- No new external dependencies.
- No Cubism SDK, `.moc3`, `.model3.json`, or `.physics3.json` compatibility work.
- No unrelated user/other-agent changes were reverted.

## Residual Risks

- Atlas apply is intentionally async-only at Operation Core for digest correctness; accidental sync calls reject instead of applying.
- The operation payload includes expected layout metadata. It avoids raw bytes, but large models can still produce larger placement metadata in operation logs.
- Browser canvas painting is covered by projection/render tests, not by a Playwright screenshot in this fix loop.
- The authoring-core schema re-export is a narrow boundary fix. A later design pass may choose to formalize package-format schema access differently.

## User-decision Points

- Confirm whether the async Operation Core method names should remain `dryRunOperationAsync` / `commitOperationAsync`.
- Confirm whether expected layout summary in the operation payload is acceptable long term, or whether a smaller preview identity should replace it in a later wave.
- Confirm whether to keep the authoring-core schema re-export or make Operation Core formally depend on package-format in a separate dependency-policy decision.
