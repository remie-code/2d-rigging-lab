# Wave76 Domain D Design / Development Compliance Review

- Verdict: `pass`
- Lane: Design / Development Compliance
- Target: `wave76-mesh-target-simplification-multi-preview-apply`
- Date: 2026-06-16
- Reviewer: Review-Sylph

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`, especially sections 3.4, 7.4, 12, 15, 17, 18, and 19.
- `discussion/implementation/waves/wave76/wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md`
- Domain C dependency artifacts:
  - `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`
  - `discussion/implementation/reviews/wave76/wave76-domain-c-spec-compliance-review.md`
  - `discussion/implementation/reviews/wave76/wave76-domain-c-design-development-review.md`
  - `discussion/implementation/reviews/wave76/wave76-domain-c-test-adequacy-review.md`
- Wave75 baseline:
  - `discussion/implementation/orchestration/wave75-plan.md`
  - `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
  - `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- Policies:
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/ux-backed-package-logic-authority.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/operation-policy.md`

## Scope Reviewed

Directly inspected source and test files:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Additional negative-scope and cross-domain checks:

- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- package manifests and lockfile paths via `git diff --name-only`

The worktree is dirty from Wave76 Domains A/B/C/E and planning/review artifacts. Package-format, operation-core, and render-webgl2 diffs are present in the shared worktree, but Domain D's reported and reviewed implementation files are Editor/E2E files only. This review did not attribute parallel-domain package/WebGL changes to Domain D.

## Findings

No blocking findings.

No needs-change findings.

## Development / Design Compliance Notes

### Architecture and Source Organization

- Source organization is acceptable. Batch eligibility is isolated in `mesh-tool-state.ts`, editor-local draft lifecycle and commit behavior stay in `editor-session-context.tsx`, Mesh Tool presentation stays in `mesh-tool-inspector.tsx`, and Canvas representation is split across evaluation, projection, and renderer files.
- No new `index.ts`, catch-all source file, dependency manifest, lockfile, persistence schema, package-format file, operation schema, or package mutation file is part of the Domain D reviewed scope.
- `node scripts/check-source-organization.mjs` passed in this review.
- `node scripts/check-dependencies.mjs` passed in this review.

### State Design

- `MeshToolDraft` now carries `commitMode: "single" | "batchEligible"` and optional compatibility `meshDrafts` at `apps/editor/src/features/editor-session/editor-session-context.tsx:152`.
- Provider state is an array (`meshDrafts`) with a compatibility single value (`meshDraft`) at `apps/editor/src/features/editor-session/editor-session-context.tsx:382`.
- Cleanup is coherent:
  - leaving Mesh Tool clears drafts at `editor-session-context.tsx:434`;
  - selection changes filter drafts to selected Drawable ids at `editor-session-context.tsx:454`;
  - project load clears transient draft/feedback state at `editor-session-context.tsx:467` and resets selection/anchor at `:474`;
  - undo/redo clear transient commit state at `editor-session-context.tsx:521` and `:536`.
- Batch preview only creates drafts for eligible targets through `createMeshDrawableBatchTargets` at `editor-session-context.tsx:920`.
- Batch apply rechecks eligibility against the current session before every `batchEligible` commit at `editor-session-context.tsx:944`. This avoids relying solely on UI state and prevents generated/non-empty mesh overwrite in batch mode.
- Compatibility consumers are preserved by `createMeshToolDraftCompatValue` at `editor-session-context.tsx:1495`, which returns the single draft unchanged or a first-draft object carrying `meshDrafts`.
- Eligibility logic matches the accepted design: missing mesh and empty scaffold are eligible, generated/non-empty mesh is excluded at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:120` and `:134`.

### UI Design

- Mesh Target is name-only for Drawable and Drawable-set targets. The Target section renders only `mesh-tool-target-name` list items at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:177` and `:199`, while status and workflow text moved to the separate Preview section at `:212`.
- Existing target diagnostic/stat rows were removed from the Target section. The new component test asserts absence of status/preset/vertices/triangles/source/alpha/quality wording at `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts:45`.
- Multi-select target names and existing-mesh exclusion warning are rendered from ordered selected Drawable ids at `mesh-tool-inspector.tsx:350` and `:518`.
- Generate/apply/cancel button states are coherent for the accepted scope:
  - batch Generate is disabled when no eligible targets exist at `mesh-tool-inspector.tsx:173`;
  - Apply and Cancel are gated on current target drafts at `mesh-tool-inspector.tsx:176` and `:282`;
  - single-selection regenerate remains available for generated meshes at `mesh-tool-inspector.tsx:276`.
- Single-selection flow remains usable: single empty Drawable still auto-previews at `mesh-tool-inspector.tsx:78`, single generated Drawable still uses the `Regenerate mesh` single route, and batch mode does not introduce an overwrite route for generated selections.

### Canvas Design

- Canvas projection preserves `meshOverlay` compatibility while adding `meshOverlays` at `apps/editor/src/workspace/canvas/canvas-projection.ts:100`.
- Canvas evaluation accepts both compatibility `meshDraft.meshDrafts` and direct `meshDrafts` inputs at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:102` and indexes drafts deterministically by Drawable id at `:827`.
- Projection resolves multiple selected draft overlays without renderer redesign at `canvas-projection.ts:255` and keeps `meshOverlay` as the first compatible overlay at `:264`.
- Renderer changes are narrow: `drawMeshOverlay` now iterates `projection.meshOverlays` and falls back to legacy `projection.meshOverlay` at `apps/editor/src/workspace/canvas/canvas-renderer.ts:590`.
- Multiple-overlay unit evidence exists in `apps/editor/src/workspace/canvas/canvas-projection.test.ts:334`, `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:502`, and `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:440`.

### Cross-Domain and Forbidden Scope

- Domain D consumes Domain C `drawableSet` through the shared selection helpers. `getSelectedDrawableIds`, `getSingleSelectedDrawableId`, and `createDrawableSelection` are defined in `apps/editor/src/features/editor-session/model/editor-selection.ts:36`.
- Parts Tree remains the only modifier multi-select surface. `structure-tree-panel.tsx:57` passes range/toggle options; Deformer Tree calls `selectDrawable(...)` without modifier options at `deformer-tree-view.tsx:140` and `:289`; Canvas hit selection still calls `selectDrawable(hitDrawableId)` without modifier options at `canvas-preview-panel.tsx:499`.
- No Canvas modifier selection, Deformer Tree multi-select, Rig batch behavior, WebGL clipping work, package-format change, operation schema change, dependency addition, or mesh generation algorithm change was found in the Domain D reviewed scope.
- `createMeshToolDraft` still calls the existing `createGeneratedMeshForDrawable` with `DEFAULT_MESH_GENERATION_METHOD` at `editor-session-context.tsx:1450`; this is preview/apply plumbing, not an algorithm change.

## Verification Reviewed / Performed

Performed in this review:

| Command / check | Result |
|---|---|
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `git diff --check -- <Domain D touched files>` | Exit 0; only CRLF normalization warnings. |
| `git diff --name-only HEAD -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json` | No manifest or lockfile output. |
| `git diff --name-only HEAD -- apps/editor/src/workspace/panels/canvas-preview-panel.tsx apps/editor/src/workspace/panels/deformer-tree-view.tsx apps/editor/src/workspace/panels/rig-tool-inspector.tsx` | No negative-scope panel output; warning only for CRLF normalization on `canvas-preview-panel.tsx`. |
| `rg` over Structure Tree, Deformer Tree, and Canvas selection calls | Modifier-aware multi-select is localized to Parts Tree. |

Reviewed from Gnome report and source:

- Focused Vitest command reportedly passed after escalation: 6 files / 51 tests covering Mesh model/context/inspector/canvas changes.
- `pnpm.cmd typecheck` reportedly passed.
- Focused Playwright `psd-import` command reportedly passed and ran 11 tests.
- Source E2E assertions at `apps/editor/e2e/psd-import.e2e.spec.ts:202` cover Drawable-set Mesh Tool target names, preview generation, and cancel cleanup.
- Existing single Mesh E2E assertions at `apps/editor/e2e/psd-import.e2e.spec.ts:300` cover hidden single Drawable preview visibility, Target simplification, apply, regenerate, cancel, and overlay toggle behavior.

I did not rerun Vitest, Playwright, or broad typecheck in this review. The compliance decision is based on direct source/diff inspection, the performed guards/checks above, and the implementation report's focused validation record.

## Residual Risks

- `isGenerating` is represented in React state at `mesh-tool-inspector.tsx:66` and button disabled logic at `:173`, but generation is still synchronous. The browser may not visibly paint the disabled/`Generating preview...` state before synchronous generation completes. This is non-blocking because the event loop prevents duplicate clicks during the synchronous work, but it should be revisited if generation becomes async.
- Multi-preview Canvas routing currently relies on the compatibility `meshDraft.meshDrafts` value passed by `CanvasPreviewPanel` rather than passing `meshDrafts` directly. Projection/evaluation support both forms, and tests cover the compatibility path, but a later cleanup could pass `meshDrafts` directly to make the contract clearer.
- Single hidden Drawable preview visibility remains covered, but hidden Drawable behavior for multi-selected batch previews is not separately proven. This is outside the explicit Domain D requirement as reviewed, but final integration should keep it in mind if hidden batch authoring becomes a user workflow.
- The shared worktree contains parallel-domain package/WebGL/Rig changes. Final integration must re-check combined Wave76 scope before treating this Domain D pass as a whole-wave pass.

## User Decision Points

None.
