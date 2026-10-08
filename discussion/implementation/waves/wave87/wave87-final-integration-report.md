# Wave87 Final Integration Report

## Verdict

pass

Wave87 `texture-atlas-task-v0` is final complete / pass after Domain A pass evidence, Domain B initial escalation, Domain B Fix Loop 1 pass re-reviews, parent final validation, and independent final clean integration review.

## Domain Status Summary

| Domain | Status | Summary |
|---|---|---|
| Domain A: Atlas Core / Schema / Apply Mutation | pass | Added persistent atlas layout summary schema, deterministic target selection, single-page packing preview, generated raw RGBA atlas bytes, apply mutation, and portable bundle round-trip evidence. |
| Domain B: Texture Atlas Task UI / Routing / Preview Workflow | initial escalate, resolved by Fix Loop 1 | Initial UI/routing work passed spec and test review but escalated on the Operation Core mutation boundary. Fix Loop 1 routed Apply through Operation Core async commit and added actual atlas artwork preview. |
| Domain C: Final Integration / Clean Review / Map Closeout | pass | Final validation passed, closeout artifacts were updated, and independent final clean integration review returned `pass`. |

Domain A report:

- [wave87-domain-a-atlas-core-schema-apply-mutation-report.md](wave87-domain-a-atlas-core-schema-apply-mutation-report.md): `pass`.

Domain A review lanes:

- [../../reviews/wave87/wave87-domain-a-spec-compliance-review.md](../../reviews/wave87/wave87-domain-a-spec-compliance-review.md): `pass`.
- [../../reviews/wave87/wave87-domain-a-design-development-review.md](../../reviews/wave87/wave87-domain-a-design-development-review.md): `pass`.
- [../../reviews/wave87/wave87-domain-a-test-adequacy-review.md](../../reviews/wave87/wave87-domain-a-test-adequacy-review.md): `pass`.

Domain B report and escalation:

- [wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md](wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md): implementation `pass`, final Domain B `escalate` because user-facing Apply initially bypassed Operation Core.
- [../../reviews/wave87/wave87-domain-b-design-development-review.md](../../reviews/wave87/wave87-domain-b-design-development-review.md): `escalate`, limited to Operation Core boundary.

Domain B Fix Loop 1:

- [wave87-domain-b-fix-loop-1-operation-backed-apply-image-preview-report.md](wave87-domain-b-fix-loop-1-operation-backed-apply-image-preview-report.md): `needs_orch_review`, resolved by re-reviews.
- [../../reviews/wave87/wave87-domain-b-fix-loop-1-spec-compliance-re-review.md](../../reviews/wave87/wave87-domain-b-fix-loop-1-spec-compliance-re-review.md): `pass`.
- [../../reviews/wave87/wave87-domain-b-fix-loop-1-design-development-re-review.md](../../reviews/wave87/wave87-domain-b-fix-loop-1-design-development-re-review.md): `pass`.
- [../../reviews/wave87/wave87-domain-b-fix-loop-1-test-adequacy-re-review.md](../../reviews/wave87/wave87-domain-b-fix-loop-1-test-adequacy-re-review.md): `pass`.

## Target Selection Semantics

Wave87 uses runtime / rig-bound Drawable membership as the atlas target oracle, not current Canvas visibility.

- Bound visible Drawables are included.
- Bound runtime-hidden Drawables are included and marked with hidden metadata.
- Bound Drawables under editor-hidden Parts Containers are included and marked with hidden metadata.
- Unbound Drawable Pool Drawables are excluded.
- Parts Containers, Deformers, rig controls, editor overlays, handles, preview wireframes, and unreferenced source textures are not atlas targets.

Evidence:

- `selectTextureAtlasTargets()` builds the bound set from rig controls and classifies unbound Drawables as Drawable Pool exclusions.
- Domain A tests cover hidden bound inclusion and unbound Drawable Pool exclusion.
- Domain B UI tests render included/excluded counts, `Currently hidden`, and `Unbound drawable in Drawable Pool`.

## Generated Atlas Asset Behavior

Wave87 generates a single atlas page as raw RGBA bytes using the existing project texture byte convention.

- The generated atlas texture id is `tex_generated_atlas_page_0`.
- The generated binary path is `assets/textures/generated_atlas_page_0.raw-rgba`.
- Texture entry dimensions are persisted.
- Source texture assets are retained.
- Generated atlas bytes are not base64-embedded into package JSON or Operation Core payloads.

Evidence:

- `createTextureAtlasPageRgbaBytes()` creates the atlas page bytes.
- `applyTextureAtlasPreview()` registers the generated texture entry, provenance, rights metadata, binary bytes, and layout summary.
- Operation Core tests assert the operation log payload does not contain raw `atlasBytes`.
- Atlas UI projection exposes generated image bytes for preview rendering.

## Layout Summary Persistence

Wave87 persists `TextureAtlasLayoutSummary` under the existing `texture-atlas-v1` package surface.

Persisted meaning includes:

- layout schema version and layout id;
- atlas texture id;
- page size;
- padding;
- edge extrusion setting;
- algorithm id/version;
- page id;
- per-Drawable placement summary;
- per-Drawable original texture id;
- atlas rect and UV rect;
- hidden-at-apply metadata;
- generated operation id when applied through Operation Core.

Evidence:

- Package schema tests parse layout summary, generated page dimensions, placements, and hidden metadata.
- Authoring tests prove applied atlas metadata and generated raw RGBA bytes survive portable bundle export/import.

## Operation Core Apply Behavior

Domain B's initial Operation Core escalation is resolved by Fix Loop 1.

Current Apply flow:

1. Texture Atlas Task creates a ready preview from Domain A APIs.
2. `Apply Atlas` calls the editor-session atlas apply hook only when the preview is ready and non-stale.
3. `commitTextureAtlasPreview()` clones the session and creates an `applyTextureAtlasPreview` Operation Core request.
4. Operation Core uses `commitOperationAsync()`.
5. The operation handler recreates the preview from the current session/settings/hidden ids, rejects stale or not-ready previews, applies the Domain A mutation, records model-diff evidence, increments package revision, and returns a log entry.
6. The editor session records one history entry only after the operation-backed commit succeeds.

Evidence:

- `applyTextureAtlasPreview` is registered in Operation Core type/payload/registry/index surfaces.
- Sync lifecycle calls reject deterministically; async lifecycle is required because generated atlas binary digesting is async.
- Focused Operation Core tests cover registry wiring, async-only sync rejection, commit, dry run, stale layout rejection, failed preview recreation rejection, generated atlas texture/layout/binary metadata, drawable refs, UV changes, and model-diff/log evidence.

## Actual Image Preview Behavior

Generate Preview now displays actual generated atlas artwork/image data, not only placement rectangles.

- Projection derives atlas preview image bytes from Domain A raw RGBA generation.
- The Atlas screen paints those bytes into a canvas layer with `ImageData` / `putImageData`.
- Placement overlays render above the image layer.
- Tests assert the generated RGBA byte signature, image canvas layer, and placement overlay markup.

Residual note:

- No Playwright/browser pixel screenshot was added to prove real canvas pixels after `putImageData()`. Source and focused tests prove the generated byte path and canvas layer wiring, which is adequate for Wave87 v0 but remains a useful future hardening item.

## Canvas / Viewer And Save/Load Evidence

Save/load and portable bundle:

- Package schema tests pass for texture atlas layout summary.
- Portable package bundle tests pass.
- Authoring portable project bundle tests pass.
- Atlas mutation tests pass and include generated atlas metadata plus generated raw RGBA byte round trip through portable bundle export/import.

Canvas / Viewer:

- Canvas texture-byte projection focused test passed: `apps/editor/src/workspace/canvas/canvas-projection.test.ts -t "projects runtime RGBA bytes"`.
- Viewer runtime route tests passed.
- Viewer clean stage tests passed.
- Canvas and Viewer share the same texture id / mesh UV authoring state after Apply. The final evidence is semantic/projection-level, not a before/after rendered pixel-equivalence oracle.

Observed unrelated test issue:

- A broader run including all `apps/editor/src/workspace/canvas/canvas-projection.test.ts` tests failed one Dynamics preview test: `projects Dynamics preview additive output through Canvas keyform evaluation`, due to `definitionOverridesByGroupId` being undefined in `dynamics-tool-state.ts`.
- That file was not changed by Wave87 and the failing test is not atlas-specific. It is recorded as a residual repository test issue, not a Wave87 atlas blocker.

## UI Workflow Behavior

Texture Atlas Task v0 is connected as a dedicated task screen.

- Toolbox `Texture Atlas` opens the dedicated Atlas screen.
- `activeEntry === "atlas"` routes to `TextureAtlasTaskScreen`.
- Back navigation returns to the authoring workspace route without opening PSD import.
- The task shows a large Atlas Preview area.
- It shows Included / Excluded / Warnings counts and readable lists.
- It exposes page size, padding, and edge extrusion settings.
- `Generate Preview` creates Domain A preview state.
- `Apply Atlas` is disabled before a valid preview and after stale/failed inputs.
- Stale guards cover settings changes and target input drift.
- The UI uses Domain A selection/packing APIs and does not duplicate atlas packing logic.

## Forbidden Scope Compliance

Wave87 did not implement or claim:

- Workspace Directory Export / filesystem directory save;
- ZIP/archive export;
- File System Access API;
- user-visible atlas image export workflow;
- manual atlas placement editor;
- multi-page atlas optimization;
- camera capture or tracking input;
- Cubism SDK / `.moc3` / `.model3.json` compatibility;
- broad renderer rewrite;
- mesh generation, deformer, keyform, dynamics, or visibility behavior changes;
- new external dependencies.

The forbidden-scope search only found accepted non-goal documentation/report mentions and pre-existing archive/filesystem boundary code outside Wave87.

## Validation Commands / Results

Parent final validation:

- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts`:
  - sandbox run failed with known Vitest/esbuild `spawn EPERM`;
  - escalated rerun passed: 10 files, 62 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-projection.test.ts -t "projects runtime RGBA bytes"`:
  - escalated rerun passed: 1 file, 1 test, 17 skipped.
- Broader exploratory Vitest run including all `canvas-projection.test.ts`:
  - escalated run result: 10 files passed, 1 file failed; 79 tests passed, 1 unrelated Dynamics preview test failed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed with LF/CRLF working-copy warnings only.

## Clean Review Result

Final clean integration review: `pass`.

Artifact:

- `discussion/implementation/reviews/wave87/wave87-final-clean-integration-review.md`.

Review result: no blocking findings. The reviewer confirmed accepted UX/plan compliance, target selection semantics, generated atlas asset behavior, layout summary persistence, Operation Core-backed Apply, actual image preview, save/load and Canvas/Viewer evidence, forbidden-scope compliance, map/report trace, and final test adequacy. Residual risks remain non-blocking and are recorded below.

## Residual Risks

- No browser pixel screenshot / Playwright canvas-pixel check proves the actual atlas preview canvas paints pixels in a real browser. The source and focused tests prove generated RGBA bytes and canvas layer wiring.
- Canvas / Viewer parity evidence is semantic/projection-level, not a strict rendered pixel-equivalence oracle for before/after atlas Apply.
- The broad Canvas projection test file currently has one unrelated Dynamics preview failure. Wave87 did not touch that area; future Dynamics work should address it.
- Operation Core atlas apply is async-only. Sync callers reject deterministically, but future callers must use `dryRunOperationAsync()` / `commitOperationAsync()`.
- The Operation Core atlas handler currently relies on a narrow authoring-core re-export of atlas layout schema/types. A later package-boundary cleanup may decide whether Operation Core should formally depend on package-format schema types instead.
- Operation Core atlas `runtimeDiff` and validation refs remain empty unless an evidence provider is supplied. The atlas-specific model diff is meaningful and tested.

## User-Decision Points

- Workspace Directory Export remains explicitly out of Wave87 scope and should be planned separately before any directory picker, filesystem save, ZIP/archive, or user-visible atlas page export workflow is added.
- Decide whether `dryRunOperationAsync()` / `commitOperationAsync()` are the long-term Operation Core API names.
- Decide in a later boundary pass whether the current authoring-core atlas schema re-export is acceptable long term or should be replaced by a formal package-format dependency policy decision.
- Decide whether the next atlas hardening wave should add a browser pixel check for actual atlas preview canvas rendering and/or before/after Canvas/Viewer pixel parity.
