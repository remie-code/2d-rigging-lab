# Wave62 Domain C: Rig Tool Deformer Tree / Warp Deformer Editor v0 Report

## Status

pass

Status note: Domain D closeout aligned this report with the independent Review-Sylph `pass` review in `discussion/implementation/reviews/wave62/wave62-domain-c-rig-tool-deformer-tree-editor-v0-review.md`; no required fixes remain in the review.

## Current-State Findings

- `apps/editor` already had Mesh Tool draft state flowing through `EditorSessionProvider` -> Canvas projection -> Canvas renderer, so Rig draft overlay could follow the same boundary without changing packages.
- The left Structure pane was Parts Tree only; Parts Tree selection and draw-order DnD were already the home for part membership.
- `apps/editor` does not currently depend directly on `@private-2d-rigging-lab/package-format`, so the editor-side read projection mirrors Domain B's `projectWarpDeformerReadModel` fields over stored `warpLattice2d` data instead of adding a new workspace dependency or lockfile change.
- Domain B's `createWarpDeformer` operation is exported through `operation-core` and can be used by the existing editor command wrapper.

## UI / State Flow Implemented

- Added a left-pane `Parts` / `Deformers` toggle near the Structure header.
- Kept the existing Parts Tree behavior unchanged for membership, draw order, visibility, and selection.
- Added a Deformer Tree showing Warp Deformer hierarchy and bound Drawable reference rows.
- Extended selection to include `rigControl` for committed deformer selection.
- Added Rig Tool inspector flow:
  - Project / none: short empty state.
  - Part Container: descendant Drawable target picker.
  - Drawable: create Warp Deformer draft action.
  - Draft: editable name, parent deformer, bound children summary, domain bounds, Transform divisions explicitly labeled as control point counts, Bezier divisions, fixed readonly Bezier edit type, fit/reset, Apply/Cancel.
  - Committed Warp Deformer: read-only summary after Apply.
- Added Canvas Deformer overlay:
  - Draft domain bounds and Transform grid.
  - Bezier guide grid.
  - Committed selection highlight.
  - Draft vs committed visual distinction and state-reflection data attributes for E2E.

## Domain B Contract Usage

- Apply commits through `createWarpDeformer` using Domain B DTO fields:
  - `partId`, `displayName`, `parentRigControlId`, `childDrawableIds`, `childRigControlIds`, `domainBounds`, `transformColumns`, `transformRows`, `bezierColumns`, `bezierRows`, `bezierEditType: "cubicBezierSurfaceV1"`.
- Project state changes only on Apply. Cancel discards the draft.
- Committed read uses `warpLattice2d` storage plus optional `warpDeformer` metadata and preserves the Domain B boundary that committed update-settings is unsupported in v0.

## Changed Files

- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`

## Verification

- `pnpm.cmd --dir apps/editor typecheck`: pass.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`: pass, 3 files / 13 tests. Initial sandbox run failed with esbuild `spawn EPERM`; approved rerun passed.
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`: pass, 5 tests. Initial sandbox run failed with `spawn EPERM`; approved rerun passed.
- `pnpm.cmd typecheck`: pass.
- `git diff --check`: pass; output contained existing CRLF normalization warnings only.
- `node scripts/check-source-organization.mjs`: pass.

## Residual Risks / UX Gaps

- Committed Warp Deformer settings are read-only because Domain B intentionally has no update-settings operation.
- Bezier edit surface is displayed as a guide and persisted on create, but manual Bezier control point editing and Bezier runtime evaluation remain out of scope.
- The editor mirrors the Domain B read projection locally to avoid adding a package-format dependency from `apps/editor`; future dependency cleanup can replace this with direct `projectWarpDeformerReadModel` consumption if the app dependency boundary is approved.
- Deformer Tree shows Drawable references but does not support deformer drag/drop, reparent, or binding edits in v0.
