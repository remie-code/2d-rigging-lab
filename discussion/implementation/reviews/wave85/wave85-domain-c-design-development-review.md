# Wave85 Domain C Design / Development Compliance Review

## Verdict

pass

## Basis reviewed

- `discussion/implementation/orchestration/wave85-plan.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
- `discussion/implementation/waves/wave85/wave85-domain-c-inline-tree-diagnostics-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- Domain C changed source/tests listed in the assignment, including the Mesh Tool, Dynamics Tool, Structure Tree, Deformer Tree, session tree, rig tool state, and editor session context files.

Reviewer reran after Fix Loop 1:

- `node scripts/check-source-organization.mjs` - passed.
- `node scripts/check-dependencies.mjs` - passed.
- `git diff --check -- apps/editor/src/features/editor-session apps/editor/src/workspace/panels discussion/implementation/waves/wave85 discussion/implementation/reviews/wave85` - exit 0; Windows LF-to-CRLF warnings only.

Vitest/typecheck were not rerun by this re-review lane. Caller-provided post-fix verification records: sandbox focused Vitest failed with esbuild `spawn EPERM`; escalated focused Domain C Vitest passed 7 files / 54 tests; `pnpm.cmd typecheck` passed; source organization guard passed; dependency guard passed; diff-check passed with LF-to-CRLF warnings only.

## Findings

None.

## Post-fix re-review: Fix Loop 1

Current verdict: `pass`.

Re-read directly:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts`
- `discussion/implementation/waves/wave85/wave85-domain-c-inline-tree-diagnostics-integration-report.md`

The narrow fix remains within Domain C design/development constraints. `MeshToolInspector` now passes `draftsForTarget` into diagnostic derivation (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:184`) and falls back from the selected `currentDraft` to the first target draft with fallback or empty-result diagnostics (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:589`, `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:612`, `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:627`). This only broadens which existing Mesh Tool draft metadata reaches the existing inline diagnostic card and copy payload.

The added tests cover drawable-set fallback and 0-triangle draft diagnostics (`apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts:119`, `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts:159`). The Domain C report's Fix Loop 1 section records the same scope and verification (`discussion/implementation/waves/wave85/wave85-domain-c-inline-tree-diagnostics-integration-report.md:7`).

Constraint check: no Validate screen, App Bar, Toolbox, Viewer, badge, or jump-action changes were added in the fix files. The fix does not change mesh generation algorithms, schemas, dependencies, operation payloads, session persistence, or global mesh history. No auto-fix, repair, AI proposal, completion score, or quality judgement controls were introduced.

## Compliance notes by policy/design area

### Source organization

- Domain C kept the new projection consumption in existing responsibility files rather than adding catch-all modules. Tree warning metadata lives with tree row projection (`apps/editor/src/features/editor-session/model/session-tree.ts:18`, `apps/editor/src/features/editor-session/model/session-tree.ts:233`) and Deformer Tree row projection consumes the same compact warning shape (`apps/editor/src/features/editor-session/model/rig-tool-state.ts:125`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:511`).
- `editor-session-context.tsx` is already a large provider, but the added Mesh diagnostic state is narrowly tied to existing mesh draft preview ownership and the Wave85 plan explicitly allowed this file for last mesh generation diagnostic state. The automated source organization guard passed.

### Dependency policy

- No dependency manifest, lockfile, package, Cubism SDK/Core, binary, or authoring-core dependency change was present in the Domain C paths reviewed.
- `node scripts/check-dependencies.mjs` passed.

### Operation policy

- Mesh generation diagnostics are transient editor state, not package graph mutation: the state is declared in the context value (`apps/editor/src/features/editor-session/editor-session-context.tsx:277`), cleared on tool/selection/undo/redo/load/apply/cancel paths (`apps/editor/src/features/editor-session/editor-session-context.tsx:539`, `apps/editor/src/features/editor-session/editor-session-context.tsx:568`, `apps/editor/src/features/editor-session/editor-session-context.tsx:639`, `apps/editor/src/features/editor-session/editor-session-context.tsx:654`, `apps/editor/src/features/editor-session/editor-session-context.tsx:702`, `apps/editor/src/features/editor-session/editor-session-context.tsx:1176`, `apps/editor/src/features/editor-session/editor-session-context.tsx:1276`), and is not saved or committed.
- Existing mutating actions remain routed through existing context operations. Domain C did not add auto-fix, repair, or automatic authoring operation behavior.

### Schema / ID policy

- Domain C did not alter Dynamics schema, Mesh generation schemas, operation payload DTOs, package format, or external contracts.
- New machine-readable values and test IDs use stable no-space identifiers, for example `mesh-tool-diagnostic-card`, `parts-tree-warning-icon`, `deformer-tree-warning-icon`, `dynamics-group-warning-icon`, `mesh.drawableMeshMissing`, and `dynamics.outputKeyformMissing`.

### UI / design compliance

- Mesh Tool inline diagnostics are local to Mesh Tool and cover generation failure, fallback, and zero triangles with copyable details (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:184`, `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:544`, `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:588`, `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:711`).
- Dynamics Tool surfaces Domain A `dynamics` projection items as compact group list warnings and existing group validation summaries, while create/edit validation continues to use `validateDynamicsToolDraft()` (`apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:349`, `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:501`, `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:80`, `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:360`, `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:1399`).
- Parts Tree and Deformer Tree rows add compact `AlertTriangle` icons with `title` / `aria-label` detail and do not add verbose visible row text (`apps/editor/src/workspace/panels/structure-tree-panel.tsx:248`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx:200`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx:384`). Model tests assert warning text stays out of row `name` / `detail` (`apps/editor/src/features/editor-session/model/session-tree.test.ts:254`, `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:684`).
- Domain C did not edit Viewer source, Validate screen, App Bar, Toolbox badge, or jump action files. The existing worktree has unrelated Domain B Validate/badge/Viewer dirty files, but they were outside this review's Domain C compliance basis.

## Residual risks / user-decision points

- Mesh generation failure reason remains coarse when `createGeneratedMeshForDrawable()` returns `undefined`; this matches the Domain C non-algorithm-change boundary.
- Browser visual QA was not rerun by this review lane. The reviewed source and tests satisfy the design/development compliance scope, but layout polish remains for final integration or browser QA if desired.
- No user-decision point is required for Domain C design/development compliance.
