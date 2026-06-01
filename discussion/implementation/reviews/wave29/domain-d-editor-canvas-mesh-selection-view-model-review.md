# Wave29 Domain D Review: Editor Canvas Mesh Selection View Model

## Verdict

needs_fix

## Scope Reviewed

- `apps/editor/src/editor-state/mesh-edit-state.ts`
- `apps/editor/src/editor-state/mesh-canvas-selection-state.ts`
- `apps/editor/src/editor-state/mesh-edit-view-model.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts`
- Compatibility tests listed by Orch-Sylph
- Gnome report: `discussion/implementation/waves/wave29/domain-d-editor-canvas-mesh-selection-view-model-gnome-report.md`

Other changed files are present in the shared worktree, including runtime, validator, preview, and other review artifacts. I treated those as parallel Wave29 work and did not review them as Domain D source scope.

## Findings

### 1. Major: `applyCommittedOperationSummary` drops mesh edit state for editor-state-only reprojection

- Source: `apps/editor/src/editor-state/editor-state-projections.ts:154`
- Source: `apps/editor/src/editor-state/editor-state-projections.ts:166`
- Source: `apps/editor/src/editor-state/editor-state-projections.ts:169`
- Source: `apps/editor/src/editor-state/mesh-edit-state.ts:87`
- Source: `apps/editor/src/editor-state/mesh-edit-state.ts:128`

`CommittedOperationSummaryInput` allows `editorState` to be provided without `meshes`. The new reprojection branch now treats `input.editorState !== undefined` as a reason to rebuild `meshEdit`, but passes `input.meshes ?? []` into `projectMeshEditState`. If only layer selection / lock / editor-hidden state changes are summarized, this rebuilds against an empty mesh list and returns an empty mesh edit state, losing the selected mesh, editable vertices, hit targets, and normalized selected vertex IDs.

This fails the explicit review check for preserving / reprojecting mesh edit state deterministically when layer selection / lock / editor-hidden state changes. `projectLoadedPackageState` correctly passes `layerTreeDraft` and the loaded mesh list, but `applyCommittedOperationSummary` is not safe for the partial input shape it declares.

Recommended fix: either preserve/reproject from existing `state.meshEdit` when `input.meshes` is omitted, or require the full mesh list for any `editorState` reprojection and make that contract explicit in types/tests. Add a focused test that calls `applyCommittedOperationSummary` with `editorState` only, plus one with full drawables/meshes/editorState, covering layer selection, locked, editor-hidden, and selected vertex preservation/normalization.

### 2. Medium: Required edge-case tests are missing

- Source: `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:94`
- Source: `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:124`
- Source: `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:165`

The new tests cover basic runtime-hidden vs editor-hidden vs locked projection, simple hit selection, vertex-order normalization for reversed selected IDs, ready draft commands, invalid zero delta, no selected vertices, and view-model projection. They do not explicitly cover several test cases requested for this review lane:

- hit tie-breaking when two targets are at the same hit distance;
- invalid target normalization, including unknown IDs, blank/trimmed IDs, duplicate IDs, and replace-vs-add behavior for invalid targets;
- draft blocking for locked and editor-hidden selected meshes;
- hit selection behavior for disabled locked targets with and without `includeDisabledTargets`;
- preservation/reprojection through `applyCommittedOperationSummary` when layer state changes.

Because the implementation contains tie-breaking and blocked-state logic in pure helpers, these can be covered without workflow or app integration. The current passing compatibility tests do not exercise those branches.

## Design / Development Compliance

- `index.ts` remains barrel-only for Domain D; the change is a single export line.
- Domain D source changes are contained to `apps/editor/src/editor-state/**` plus the Domain D test file and Gnome report. I did not see Domain D edits to workflow source, session source, app source, package manifests, lockfiles, e2e config, or CI workflows.
- No dependency or manifest changes were introduced by the reviewed Domain D files.
- Runtime-hidden, editor-hidden, and locked states are represented as distinct editor-state/view-model fields. Runtime-hidden drawables remain selectable/editable in the projection, while editor-hidden drawables produce no canvas hit targets and locked drawables produce read-only hit targets.
- Canvas drag/nudge outputs are operation-shaped draft objects only. I found no operation commit, session, workflow, or app wiring in the new Domain D helper.

## Test Adequacy

Current tests are not sufficient for the required Domain D test lane because of Finding 2. The core happy-path and compatibility coverage is useful, but the requested edge cases and `applyCommittedOperationSummary` reprojection behavior need explicit tests before this domain should pass.

## Verification Run

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-state/layer-tree-draft-state.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts`
  - pass: 7 files / 72 tests
- `pnpm.cmd typecheck`
  - pass

Both commands were run from `C:/workspace/remie/code/ai-native-live2d-editor`.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave29-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/implementation/waves/wave28/wave28-final-report.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave29/domain-d-editor-canvas-mesh-selection-view-model-gnome-report.md`

## Remaining Issues

- Findings 1 and 2 require a fix/re-review loop.
- Domain D remains intentionally state/view-model only; workflow/session/app integration should remain for later Wave29 domains unless Orch-Sylph changes the scope.

## User-Decision Points

None.

## Review Artifact

`discussion/implementation/reviews/wave29/domain-d-editor-canvas-mesh-selection-view-model-review.md`
