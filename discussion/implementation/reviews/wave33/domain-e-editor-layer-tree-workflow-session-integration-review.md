# Wave33 Domain E Review: Editor Layer Tree Workflow / Session Integration

Date: 2026-06-02

Verdict: `pass`

## Scope Reviewed

- Target: `wave33-editor-layer-tree-workflow-session-integration`
- Review mode: clean Review-Sylph re-review, loop 1
- Primary loop 1 files:
  - `apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts`
  - `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - `apps/editor/src/editor-state/layer-tree-direct-manipulation-view-model.ts`
  - `apps/editor/src/editor-state/layer-tree-view-model.test.ts`
  - `discussion/implementation/waves/wave33/domain-e-editor-layer-tree-workflow-session-integration-gnome-report.md`
- Full Domain E integration path remained in scope for regression checks.

## Findings

No blocking findings.

## Previous Finding Resolution

Resolved.

The initial blocking finding was that a direct manipulation batch could use a same-batch pending-delete part as a reparent or drawable-assignment target, commit earlier operations, then hit a predictable `deletePart` rejection.

Loop 1 now rejects those contradictory batches before any operation commit:

- `apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts:219` returns `status: "rejected"` with `committedCount: 0`, `results: []`, `latestResult: null`, `latestSessionPersistenceResult: null`, and the original state when batch preflight issues exist.
- `apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts:351` detects `editor.layerTreeDirectDraft.reparentToPendingDelete`.
- `apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts:405` detects `editor.layerTreeDirectDraft.drawablePartToPendingDelete`.
- `apps/editor/src/editor-workflow/workflow-controller.ts:617` only updates `latestSessionPersistenceResult` when the workflow outcome includes a non-null persistence result.

Focused regression coverage is present:

- `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:275` covers reparent-to-pending-delete rejection and asserts no new operation log entry, no latest persistence change, and unchanged persisted graph state.
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:331` covers drawable-assignment-to-pending-delete rejection with the same no-partial-commit assertions.
- `apps/editor/src/editor-state/layer-tree-direct-manipulation-view-model.ts:226` and `apps/editor/src/editor-state/layer-tree-direct-manipulation-view-model.ts:302` disable pending-delete parts as parent/drawable-part options.
- `apps/editor/src/editor-state/layer-tree-view-model.test.ts:263` verifies pending-delete parts remain visible but disabled as parent and drawable-part targets.

## Regression Checks

- No-op / reverted drafts: the commit planner still skips no-change drafts and clears direct drafts after successful commit or all-no-op planning. Mixed no-op coverage remains in `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:141`.
- Pending delete UX: row options now carry disabled state into the actual DOM select options, and submit handlers block disabled selected options in `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:595` and `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:749`.
- Save/load: `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:251` verifies transient direct drafts are not persisted while committed layer state survives browser-local save/load.
- Operation evidence: `apps/editor/src/editor-session/evidence-provider.ts:187` adds `deletePart` support, and `apps/editor/src/editor-session/session-adapter.test.ts:893` verifies empty-leaf delete reloads graph evidence and validation artifacts.
- Viewer/validation coherence: the workflow test checks Preview and Viewer projections after rename/reparent/drawable reassignment/texture assignment/delete in `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:191`.
- Source organization: `apps/editor/src/editor-workflow/index.ts` and `apps/editor/src/editor-state/index.ts` remain barrel-only. The large `layer-tree-panel.ts` source organization risk remains a non-blocking inherited concern from Domain D, not a loop 1 regression.
- Non-goals: no native drag-and-drop, recursive delete, multi-select bulk operation, renderer/pixel oracle, Cubism, PSD/image decode, archive/File System Access, dependency, manifest, or lockfile expansion was found in the reviewed Domain E path.

## Verification Run

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/layer-tree-view-model.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`
  - Passed: 4 files / 44 tests.
- `pnpm.cmd typecheck`
  - Passed: root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.
- `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/app apps/editor/src/ui/app-shell apps/editor/src/editor-state apps/editor/src/ui/layer-tree discussion/implementation/waves/wave33 discussion/implementation/reviews/wave33`
  - Passed with LF-to-CRLF working-copy warnings only.

## Remaining Issues / Decisions

- No Domain E user-decision points.
- Domain F should still add fixture/e2e smoke coverage for the production path, including the pending-delete preflight regression path.
