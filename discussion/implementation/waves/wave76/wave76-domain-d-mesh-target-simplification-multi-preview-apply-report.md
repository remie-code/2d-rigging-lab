# Wave76 Domain D Report: Mesh Target Simplification + Multi Preview Apply

- Verdict candidate: pass
- Domain: `wave76-mesh-target-simplification-multi-preview-apply`
- Date: 2026-06-16
- Implementer: Gnome

## Basis Coverage Self-Report

Reviewed before editing:

- `discussion/implementation/orchestration/wave76-plan.md`, especially sections 3.4, 7.4, 12, 15, 17, 18, and 19.
- `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`
- `discussion/implementation/reviews/wave76/wave76-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave76/wave76-domain-c-test-adequacy-review.md`
- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

Implemented Domain D requirements:

- Mesh Inspector Target now renders only target Drawable names for single Drawable, generated/edit, and Drawable-set targets.
- Target diagnostic/stat rows were removed from the Target section: status, preset, vertices, triangles, source, alpha bounds, max edge, max area, min angle, max valence, refinement, generation result, contour counts, fallback steps, contour regions, filtered triangles, constraint quality, and missing constraints.
- Single-selection Mesh preview/apply remains usable, including the existing single selected generated-mesh regenerate route.
- Drawable-set Mesh mode lists selected Drawable names in selection order.
- Batch eligibility is explicit: missing mesh or empty scaffold mesh is eligible; generated/non-empty mesh is excluded by default.
- Excluded generated meshes are shown in a warning section.
- `Generate preview` creates drafts for all eligible selected Drawables and ignores excluded Drawables.
- `Generate preview` has a running state and disables while generation is in progress.
- `Apply mesh` is enabled only when previews for the current target exist.
- `Apply mesh` commits eligible batch drafts only, with an apply-time eligibility recheck to avoid overwriting generated/non-empty meshes.
- `Cancel` clears all current Mesh drafts.
- Canvas projection, evaluation, and renderer can represent and draw multiple selected mesh draft overlays.

## Deferred Basis Items

- Existing mesh overwrite/regenerate in batch Mesh mode remains out of scope and was not added.
- Mesh generation algorithm, topology expansion, and manual topology editing were not changed.
- Rig batch create, RigControl partId schema changes, Deformer Tree multi-select, Canvas Shift/Ctrl multi-select, and WebGL clipping were not changed.
- No package-format, operation schema, persistence schema, or dependency changes were made.

## Files Changed

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `discussion/implementation/waves/wave76/wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md`

## Implementation Summary

- Added Mesh batch target helpers in `mesh-tool-state.ts` to centralize eligibility and generated-mesh exclusion.
- Reworked editor session Mesh draft state from one draft to an array, while keeping `meshDraft` as a compatibility value for existing single-draft consumers.
- Added `commitMode: "single" | "batchEligible"` so batch apply can recheck eligibility and skip generated/non-empty meshes without blocking single Drawable regenerate behavior.
- Simplified Mesh Inspector Target to name-only content and moved workflow status into a separate Preview section.
- Added Drawable-set Mesh Inspector handling, selected-name rendering, generated-mesh warning, batch preview generation, and batch apply/cancel wiring.
- Extended Canvas evaluation/projection to index multiple mesh drafts by Drawable id and to expose `meshOverlays` while preserving `meshOverlay` for existing status/data consumers.
- Updated Canvas renderer to draw every projected mesh overlay.
- Updated PSD import E2E coverage to exercise Drawable multi-select into Mesh Tool preview/cancel without depending on new panel attributes outside the allowed scope.

## Validation Commands / Results

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts` | passed after escalation, 6 files / 51 tests |
| `pnpm.cmd typecheck` | passed |
| `node scripts/check-source-organization.mjs` | passed |
| `node scripts/check-dependencies.mjs` | passed |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts --grep "generates an initial mesh draft|multi-selects Drawable rows"` | passed after escalation, 11 Playwright tests. Existing script argument shape ran the whole PSD import spec. |
| `git diff --check -- <Domain D tracked touched files>` | passed; CRLF normalization warnings only |
| `rg -n "[ \t]+$" apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts discussion/implementation/waves/wave76/wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md` | no trailing whitespace matches for new untracked files |

## Negative-Scope Proof

- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` was inspected and has no final diff from Domain D.
- Batch apply does not overwrite generated/non-empty meshes:
  - batch drafts use `commitMode: "batchEligible"`;
  - `previewMeshDrafts` only creates drafts for eligible targets;
  - `applyMeshDraft` rechecks `isMeshGenerationEligible` against the current session before each batch commit.
- Single selected generated Drawable regenerate remains a single-selection route only; Drawable-set generated meshes are excluded and warned.
- No mesh generation algorithm, density behavior, or topology data structure was changed.
- No package-format, operation schema, portable bundle schema, dependency manifest, or lockfile file was changed.
- No Rig batch create, Deformer Tree multi-select, Canvas modifier multi-select, or WebGL clipping work was performed.

## Residual Risks

- The Mesh generation running state is represented in UI state, but generation remains synchronous, so the visible disabled interval may be very short.
- E2E confirms multi-select Mesh preview and cancel through existing Canvas overlay status, while exact multi-overlay count is covered by projection and renderer unit tests.
- The shared worktree remains dirty from Wave76 Domains A/B/C and planning/review artifacts; this domain did not revert or normalize those changes.

## User Decision Points

None.

## Blockers

None.
