# Wave32 Domain E Clean Context Review

Target: `wave32-warp-lattice-authoring-operation-session`
Date: 2026-06-02
Reviewer: Review-Sylph clean context
Verdict: `needs_fix`

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave32-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- Wave32 Domain A-D completion reports
- Domain E changed files and adjacent app/UI wiring needed to verify reachability

## Scope Reviewed

- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/keyform-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts`
- `packages/operation-core/src/operations/add-keyform.ts`
- `packages/operation-core/src/operations/add-keyform.test.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/index.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/rig-control-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/editor-workflow/rig-control-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- Adjacent reachability check: `apps/editor/src/ui/app-shell/app-shell.ts`, `apps/editor/src/app/editor-app.ts`, `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts`

## Findings

### Blocking: Production UI does not wire warp lattice draft forms to the new commit path

`apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:62` keeps the warp lattice create/bind/keyform callbacks optional draft callbacks. The submit handlers still fall back to draft-only messages when those callbacks are absent:

- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:269`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:372`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts:519`

The production app shell passes only the existing rotation create and generic bind callbacks into `createRigControlPanel` at `apps/editor/src/ui/app-shell/app-shell.ts:221`; it does not expose or pass callbacks for `commitCreateWarpLattice2dRigControl`, `commitBindWarpLattice2dChild`, or `commitAddWarpLattice2dControlPointOffsetsKeyform`. The top-level app similarly wires only rotation and generic bind at `apps/editor/src/app/editor-app.ts:101` and `apps/editor/src/app/editor-app.ts:105`.

The workflow/controller methods exist (`apps/editor/src/editor-workflow/workflow-controller.ts:304`, `apps/editor/src/editor-workflow/workflow-controller.ts:308`, `apps/editor/src/editor-workflow/workflow-controller.ts:311`), but the user-facing Rig Controls panel cannot reach them. This leaves the Domain D UI in draft-validation mode and prevents the actual app GUI from committing `warpLattice2d` create, draft bind, or `controlPointOffsets` keyform operations. Adapter/controller unit tests exercise the new methods directly, so they do not catch this production wiring gap.

Impact: Domain E's pass evidence says editor/session can commit create/bind/keyform operations for `warpLattice2d`. The lower-level session path can, but the production editor UI path cannot, so operation log, package materialization, runtime/validator evidence, and workflow state are not reachable from the actual panel controls.

Required fix: wire the warp lattice panel callbacks through `EditorAppShellOptions`, `createRigControlPanel`, and `mountEditorApp`, mapping them to the new workflow controller methods. Add an app-shell or app-level test that submits the create/bind/keyform forms and observes the controller callback path rather than only testing adapter/controller direct calls.

## Non-Blocking Notes

- Authoring and operation-core usage of Domain A's `controlPointOffsets` shape is coherent: `controlPointOffsets` keyforms require `warpLattice2d`, `replace` / `additiveDelta`, and Vec2 offset count equal to the target lattice control point count.
- `createWarpLattice2dRigControl` materializes deterministic row-major rest control points from `domainBounds`, `latticeColumns`, and `latticeRows`, matching the upstream contract.
- Editor session evidence provider covers `createWarpLattice2dRigControl` and `addKeyform` by producing runtime snapshots, runtime diff, validation diff, and generated validation reports after commit.
- Public `index.ts` changes are barrel-only re-exports.
- No dependency manifest or lockfile diffs were found.
- No source edit was made by this reviewer.

## Verification Run

- `pnpm.cmd exec vitest run packages/authoring-core/src/rig-control-mutations.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/add-keyform.test.ts packages/operation-core/src/operation-schemas.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts`
  - Passed: 6 files, 77 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- packages/authoring-core/src packages/operation-core/src apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/app`
  - Passed; Git emitted LF/CRLF working-copy warnings only.
- Dependency manifest diff check over package manifests and lockfiles
  - No changed manifest or lockfile paths.
- Forbidden-scope scan over Domain E source paths
  - No new dependency, renderer, parser, archive, image decode, Cubism compatibility, or pixel-oracle implementation was identified. Matches were existing generic `OperationCore` naming or existing negative claims in tests/fixtures.

## Test Adequacy

Focused authoring, operation, session, and workflow tests are strong for the direct API path. They are insufficient for the production UI/app path because no test currently proves the Rig Controls panel's warp lattice forms invoke the new workflow commit methods when mounted through `app-shell` / `editor-app`.

## Remaining Issues / User Decisions

- No user decision is required. The needed fix is implementation wiring within Domain E's allowed app/workflow scope.

