# Wave29 Domain F Editor Canvas Mesh Workflow UX Design Review

Date: 2026-06-02
Reviewer: Review-Sylph
Target: `wave29-editor-canvas-mesh-workflow-ux`
Review lane: Design / Development Compliance

## Findings

No blocking, high, medium, or low-severity findings.

## Verdict

`pass`

## Scope Reviewed

Reviewed the requested Domain F implementation files and focused tests:

- `apps/editor/src/editor-state/editor-state-file.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-state/layer-tree-draft-state.ts`
- `apps/editor/src/editor-state/layer-tree-draft-state.test.ts`
- `apps/editor/src/editor-state/mesh-canvas-selection-state.ts`
- `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts`
- `apps/editor/src/editor-state/mesh-edit-state.ts`
- `apps/editor/src/editor-state/mesh-edit-view-model.ts`
- `apps/editor/src/editor-session/mesh-vertex-command.ts`
- `apps/editor/src/editor-workflow/mesh-canvas-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`
- `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts`
- `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`
- `apps/editor/src/ui/preview-panel/preview-summary.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`
- Supporting report: `discussion/implementation/waves/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md`

The worktree also contains Wave29 A-E package/runtime/validator/fixture changes. I treated those as upstream state after checking the existing A-E review artifacts, and did not include them as Domain F implementation scope except where Domain F depends on their contracts.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave29-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Wave29 A-E reports and reviews under `discussion/implementation/waves/wave29/**` and `discussion/implementation/reviews/wave29/**`

## Design / Development Compliance

Pass.

- Scope containment is acceptable for Domain F. The new workflow implementation is centered in focused Editor files, especially `apps/editor/src/editor-workflow/mesh-canvas-workflow.ts:96` and `apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts:18`. No package-format, parser, file picker, image decode, archive I/O, dependency manifest, or lockfile change was introduced by Domain F; `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml ...` was empty.
- `index.ts` files remain barrel-only: `apps/editor/src/editor-state/index.ts` and `apps/editor/src/editor-workflow/index.ts` contain only re-exports.
- Operation lifecycle integration is narrow and uses the existing `moveMeshVertex` path. Canvas move drafts are converted to `adapter.commitMoveMeshVertex` with `vertexDeltas` and caller-supplied `lockedTargetIds` at `apps/editor/src/editor-workflow/mesh-canvas-workflow.ts:119`. Row nudge compatibility is retained and now carries the same locked-target bridge at `apps/editor/src/editor-workflow/workflow-controller.ts:707` and `apps/editor/src/editor-workflow/workflow-controller.ts:723`.
- Lock/editor-hide semantics match the Wave29 boundary. Mesh edit state resolves `editorHidden` before `locked`, then blocks editable moves at `apps/editor/src/editor-state/mesh-edit-state.ts:353`; editor-hidden selected meshes expose no canvas hit targets at `apps/editor/src/editor-state/mesh-edit-state.ts:315`, while locked meshes keep disabled/read-only hit targets at `apps/editor/src/editor-state/mesh-edit-state.ts:320`. Focused tests cover locked/editor-hidden draft blocking and disabled hit targets at `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:361`.
- Locked layers block authoring edits without committing operations. The workflow test verifies canvas move returns `blocked`, row nudge returns `not_editable`, and operation log count stays unchanged at `apps/editor/src/editor-workflow/workflow-controller.test.ts:722`.
- Save/load uses the existing optional editor-state file surface without altering package schema. `activeTool: "meshEdit"` plus selected vertex IDs are projected by `apps/editor/src/editor-state/editor-state-file.ts:5`, loaded by `apps/editor/src/editor-state/editor-state-projections.ts:121`, and preserved across workflow save/load at `apps/editor/src/editor-workflow/workflow-controller.test.ts:649`. The package schema already had optional `activeTool` (`packages/package-format/src/model-files.ts:211`).
- Preview and Viewer evidence is semantic and truthful. Preview projection receives editor-state mesh selection and runtime mesh evidence at `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts:352`; Viewer validation/projection does the same at `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts:135`. UI summaries report counts, selected/moved refs, topology, and hashes rather than pixel/full-renderer claims at `apps/editor/src/ui/preview-panel/preview-summary.ts:55` and `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts:202`.
- Source organization is acceptable for this domain. The new mesh workflow and canvas editor are focused files. `workflow-controller.ts` is large pre-existing central wiring, but the Domain F diff only delegates to the focused mesh workflow, adds controller surface methods, and switches save-state projection; it does not place mesh editing implementation logic into the controller.

## Verification Performed

Passed:

- `pnpm.cmd typecheck`
  - root and editor typecheck passed.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/layer-tree-draft-state.test.ts apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts`
  - 5 files passed, 71 tests passed.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/editor-session apps/editor/src/app/editor-app.ts apps/editor/src/ui/drawable-authoring apps/editor/src/ui/app-shell apps/editor/src/ui/preview-panel/preview-summary.ts apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts discussion/implementation/waves/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md`
  - No whitespace errors; Git emitted LF-to-CRLF working-copy warnings only.
- Dependency manifest diff check over root/editor/package manifests and lockfile was empty.

## Residual Risks

- Browser-level pointer drag behavior, mobile layout, and accessibility smoke were not rerun in this review lane. That matches the Wave29 plan assigning browser persistence smoke to Domain G, but Domain G should specifically exercise SVG pointer drag, not just controller-level `dragMeshCanvasSelection`.
- The UI drag handler uses pointer down/up deltas from client coordinates. The controller and operation lifecycle are covered, but browser smoke should confirm that rendered SVG scaling feels acceptable in desktop and mobile viewports.

## User-Decision Points

None.

## Report Path

`discussion/implementation/reviews/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-design-review.md`
