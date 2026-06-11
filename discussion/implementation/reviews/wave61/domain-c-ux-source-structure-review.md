# Wave61 Domain C UX / Source Structure Review

- verdict: pass

## scope reviewed

- Domain: `wave61-mesh-tool-initial-generation-v0`
- Lane: UX / Mesh Tool / source-structure review
- Role: independent Review-Sylph; no source implementation performed.

Basis documents inspected:

- `discussion/implementation/orchestration/wave61-plan.md`
- `discussion/implementation/waves/wave61/domain-c-gnome-report.md`
- `discussion/implementation/waves/wave61/domain-a-gnome-report.md`
- `discussion/implementation/reviews/wave61/domain-a-ux-source-structure-review.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`

Source and tests inspected:

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
- `apps/editor/src/workspace/workspace-data.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`

## findings

No blocking, high, or medium findings.

### Low: Mesh Tool projection helpers are duplicated / unused

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:75`, `:108`, and `:161` export `createMeshStatusProjection`, `collectMeshDrawableCandidates`, and `parseMeshGenerationPresetId`.
- Current `rg` evidence finds those helpers only in the same file; the live Inspector path implements target/candidate projection locally in `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:259` through `:367`.
- This is not a pass blocker because the responsibilities are still scoped and `node scripts/check-source-organization.mjs` passes. It is a small maintainability risk for the next Mesh Tool wave.

### Low: Stale legacy helper remains in editor session commands

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts:312` through `:334` defines `commitTreeDrawOrderSync()`.
- Current `rg` evidence finds no callers. This does not affect Domain C UX behavior and does not reintroduce old order reads, but it leaves stale source surface after Domain A's mixed-order move path.

## AC coverage notes

- Active Mesh Tool switches Inspector to mesh workflow: `apps/editor/src/workspace/panels/inspector-panel.tsx:24` renders `<MeshToolInspector />` when `activeTool === "mesh"`. Toolbox activation is wired at `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:56` through `:59`, with the Mesh item defined at `apps/editor/src/workspace/workspace-data.ts:35`.
- Drawable selected workflow is present: `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:124` through `:239` shows target status, preset buttons, preview/regenerate, Apply, Cancel, vertex/triangle counts, source, and generated/replacement-draft status.
- Container selected workflow is present: `mesh-tool-inspector.tsx:76` through `:104` shows a Drawable picker. Candidate traversal uses Domain A mixed-order authority via `getPartOrderedChildren()` at `mesh-tool-inspector.tsx:319`, not `childPartIds` then `drawableIds`.
- None/project selected empty state is short: `mesh-tool-inspector.tsx:109` through `:119` shows `Select a Drawable`.
- Draft preview is editor/session state only before Apply: `apps/editor/src/features/editor-session/editor-session-context.tsx:117` stores `meshDraft`; preview generation writes only that state at `:257` through `:279`. `packages/authoring-core/src/mesh-generation.test.ts:77` through `:98` confirms drawable generation reads bytes without mutating the session.
- Apply commits the previewed geometry: `editor-session-context.tsx:284` through `:309` passes the stored draft mesh to `commitGenerateMesh()`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:257` through `:271` sends it as `previewMesh`, and `packages/operation-core/src/operations/generate-mesh.ts:95` through `:99` commits that provided geometry with operation provenance.
- Regenerate keeps the committed mesh until Apply: `mesh-tool-inspector.tsx:210` through `:217` creates a replacement draft, while `resolveWorkflowStatus()` at `:369` through `:375` distinguishes `Replacement draft` from committed `Generated`. The focused E2E covers Apply, Regenerate, Cancel, and committed status at `apps/editor/e2e/psd-import.e2e.spec.ts:208` through `:217`.
- Cancel / tool close / target change discard draft without confirmation: `editor-session-context.tsx:132` through `:148` clears drafts on tool/selection changes; `:241` through `:255` clears on explicit part selection / target change / Cancel; `mesh-tool-inspector.tsx:54` through `:58` cancels on Mesh Tool inspector unmount or target change.
- Canvas overlay shows selected Drawable mesh only: `apps/editor/src/workspace/canvas/canvas-projection.ts:179` through `:236` resolves draft first, then selected committed mesh; no part/all-drawable overlay path is introduced.
- Overlay toggle is display-only: `apps/editor/src/state/editor-ui-store.ts:17` through `:33` stores `meshOverlayVisible` in UI state; `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:430` through `:437` toggles only that display state.
- Hidden Drawable editing preview is temporary: `canvas-preview-panel.tsx:110` through `:119` passes `meshPreviewDrawableId` only while Mesh Tool is active on a selected Drawable; `canvas-projection.ts:139` and `:158` make only that projected drawable visible. `canvas-projection.test.ts:256` through `:279` verifies model `runtimeVisibility` remains false.
- Out-of-scope UI was not introduced: focused source search found no batch generation UI, manual vertex edit UI, add/delete vertex UI, split-count UI, advanced quality tuning UI, or pixel/screenshot oracle additions. `apps/editor/playwright.config.ts:11` keeps screenshots off.
- Source placement matches policy: Mesh Tool state lives under editor-session model, UI under workspace panels, canvas projection/rendering under workspace/canvas, and package generation/operation logic under authoring-core / operation-core. No dependency manifest or lockfile changes were found.

## verification performed

- Inspected the basis docs, Domain A/C reports, existing Domain A review, target source, target tests, and relevant focused diff/status.
- `node scripts/check-source-organization.mjs`
  - Result: pass (`Source organization guard passed.`)
- `git diff --check -- apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/features/editor-session/model/editor-session-commands.ts apps/editor/src/features/editor-session/model/mesh-tool-state.ts apps/editor/src/state/editor-ui-store.ts apps/editor/src/workspace/canvas/canvas-projection.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-renderer.ts apps/editor/src/workspace/panels/canvas-preview-panel.tsx apps/editor/src/workspace/panels/inspector-panel.tsx apps/editor/src/workspace/panels/mesh-tool-inspector.tsx apps/editor/e2e/psd-import.e2e.spec.ts packages/authoring-core/src/mesh-generation.ts packages/operation-core/src/operations/generate-mesh.ts packages/operation-core/src/payloads/model-edit.ts`
  - Result: exit 0; LF/CRLF replacement warnings only.
- `rg -n "[ \t]+$" apps/editor/src/features/editor-session/model/mesh-tool-state.ts apps/editor/src/workspace/panels/mesh-tool-inspector.tsx packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Result: no trailing-whitespace hits in the untracked Domain C files/tests checked.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - Sandbox result: failed with Vite/esbuild `spawn EPERM`.
  - Escalated rerun result: pass, 3 files / 17 tests.
- `rg -n "toHaveScreenshot|screenshot|pixel oracle|visual regression|expect\(.*screenshot|page\.screenshot" apps/editor/e2e apps/editor/src/workspace apps/editor/playwright.config.ts`
  - Result: no screenshot/pixel assertions; only `apps/editor/playwright.config.ts:11` screenshot `off`.
- `rg -n "batch|Batch|manual vertex|Manual vertex|add vertex|Add vertex|delete vertex|Delete vertex|split count|Split count|quality tuning|Quality tuning|Topology|UV Edit|vertex drag|nudge" apps/editor/src/workspace/panels/mesh-tool-inspector.tsx apps/editor/src/features/editor-session/model/mesh-tool-state.ts apps/editor/e2e/psd-import.e2e.spec.ts`
  - Result: no forbidden Mesh Tool UI hits.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/authoring-core/package.json packages/operation-core/package.json`
  - Result: no dependency manifest / lockfile diff for this lane.

## residual risks

- Alpha-aware generation depends on tightly packed RGBA8 bytes whose byte length matches the rounded mesh bounds. `packages/authoring-core/src/mesh-generation.ts:78` through `:108` intentionally falls back to bounds-grid generation when bytes are missing or dimension-incoherent.
- Final integrated Wave61 verification remains Domain D responsibility because the worktree includes Domain A/B/C mixed dirty changes.
- The two low source hygiene findings should be cleaned in a future focused maintenance pass if Mesh Tool work continues.

## user-decision points

- None.
