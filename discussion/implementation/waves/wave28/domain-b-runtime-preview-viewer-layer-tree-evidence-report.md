# Wave28 Domain B Completion Report: Runtime / Preview / Viewer Layer Tree Evidence

## Verdict

done

## Scope

- Target: `wave28-runtime-preview-viewer-layer-tree-evidence`
- Agent: Gnome
- Date: 2026-06-01

## Files Changed

Runtime-core:

- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/layer-tree-evidence.ts`
- `packages/runtime-core/src/layer-tree-evidence.test.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/index.ts`

Editor Preview:

- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/preview-layer-state.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `apps/editor/src/editor-preview/runtime-diff-summary.ts`
- `apps/editor/src/editor-preview/texture-preview-resolution.ts`
- `apps/editor/src/editor-preview/preview-projection.test.ts`
- `apps/editor/src/editor-preview/texture-preview-resolution.test.ts`

Report:

- `discussion/implementation/waves/wave28/domain-b-runtime-preview-viewer-layer-tree-evidence-report.md`

## Implementation Summary

- Added optional normalized part metadata and drawable `partId` to runtime graph inputs.
- Added runtime layer-tree evidence helpers that produce deterministic evaluated parts with hierarchy path, depth, drawable membership, and runtime-visible drawable counts.
- Runtime snapshots now include part hierarchy evidence when graph parts are provided, and evaluated drawables carry part membership.
- Runtime diff comparison now emits stable field paths for:
  - `/parts/{partId}` and part hierarchy/member changes.
  - `/drawables/{drawableId}/partId`.
  - `/drawables/{drawableId}/texture/...`.
- Viewer runtime evidence now exposes part hierarchy and drawable layer evidence with runtime visibility and texture assignment status.
- Editor Preview projection now exposes part tree projection and drawable layer state overlay for runtime-visible, editor-hidden, locked, selected, texture unresolved, and texture-backed states.
- Texture preview asset resolution refreshes drawable layer texture state when a preview asset makes the texture backed.

Editor-only state remains outside runtime-core snapshot semantics; `selection`, `lockedIds`, and `editorHiddenIds` are projected in Editor Preview only.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/runtime-core/src/layer-tree-evidence.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts`
- `pnpm.cmd exec vitest run packages/runtime-core/src/layer-tree-evidence.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/runtime-evidence-artifacts.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/texture-projection.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`

Result: 12 files, 43 tests passed in the final focused/compatibility run.

Typecheck:

- `pnpm.cmd typecheck` was run after fixes.
- It still fails in out-of-scope Domain A/C files:
  - `packages/operation-core/src/operations/create-part.ts`
  - `packages/operation-core/src/operations/set-drawable-part.ts`
  - `packages/operation-core/src/operations/update-part.ts`
  - `packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
- No remaining typecheck errors were reported for the Domain B runtime-core or editor-preview files after the local exact optional property fixes.

## Residual Risks

- Full `pnpm typecheck` cannot pass until parallel Domain A/C changes are fixed.
- Runtime-core evidence intentionally does not evaluate editor-only hidden/locked/selected state; Preview overlays it from editor state input.
- This is semantic evidence only. No pixel renderer, image decode, texture sampling, file picker, archive, or external dependency was added.

## User Decision Points

None for Domain B.
