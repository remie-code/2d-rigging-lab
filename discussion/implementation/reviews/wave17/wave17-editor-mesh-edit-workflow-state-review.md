# Wave 17 Domain C Review: editor mesh edit workflow state

- verdict: `pass`
- reviewer: Review-Sylph
- target: `wave17-editor-mesh-edit-workflow-state`

## Review Context Separation Evidence

本レビューは Domain C 実装担当 Gnome とは別の Review-Sylph コンテキストで実施した。Gnome implementation context は `019e7884-ee57-7873-9ee0-3147e8fc70ea` (`Gnome the 12th`) と指定されており、本レビューでは Gnome summary だけを根拠にせず、basis docs、actual diff、untracked new source files、completion report を直接確認した。

レビュー中、source implementation files / tests は編集していない。書き込みはこのレビュー報告書のみ。

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave17-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave16/wave16-final-report.md`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave17/wave17-mesh-vertex-operation-foundation-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/implementation/waves/wave17/wave17-editor-mesh-edit-workflow-state-completion.md`

## Changed Files / Diff Reviewed

Scoped diff reviewed with:

- `git diff -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/editor-state discussion/implementation/waves/wave17/wave17-editor-mesh-edit-workflow-state-completion.md`

Tracked modified files reviewed:

- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-view-model.test.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`

Untracked / new source files read directly:

- `apps/editor/src/editor-session/mesh-vertex-command.ts`
- `apps/editor/src/editor-state/mesh-edit-state.ts`
- `apps/editor/src/editor-state/mesh-edit-view-model.ts`
- `apps/editor/src/editor-state/view-model-format.ts`
- `discussion/implementation/waves/wave17/wave17-editor-mesh-edit-workflow-state-completion.md`

Worktree status also contains Domain A / B and orchestration changes outside Domain C scope. They were treated as pre-existing or adjacent Wave17 basis and were not reviewed as Domain C implementation changes.

## Verification Considered

Orch-Sylph / Gnome reported verification considered:

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/editor-view-model.test.ts`
  - sandbox: Vitest `node_modules` read `EPERM`
  - escalated rerun: pass, 3 files / 33 tests
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - sandbox: TypeScript `node_modules` read `EPERM`
  - first escalated run found one `mesh-edit-state.ts` Map key type error
  - final escalated run: pass
- `pnpm.cmd run check:source`: pass
- New-file trailing whitespace check: pass

Reviewer spot verification:

- `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/editor-state discussion/implementation/waves/wave17/wave17-editor-mesh-edit-workflow-state-completion.md`: pass, LF/CRLF warnings only.

Focused tests / typecheck were not independently rerun in this clean review context because the supplied results already include the required escalated reruns.

## Findings

Blocking findings: none.

Warnings: none that should block Domain D/E.

## Design / Development Compliance Assessment

`pass`.

- Editor session has a scoped command builder and adapter path for `moveMeshVertex`: `createMoveMeshVertexOperationRequest` builds an `OperationRequestSchema` payload in `apps/editor/src/editor-session/mesh-vertex-command.ts:30`, and `commitMoveMeshVertex` is exposed and wired through `apps/editor/src/editor-session/session-adapter.ts:66` and `apps/editor/src/editor-session/session-adapter.ts:205`.
- The mutation boundary remains operation-core. Domain C builds GUI-surface requests and calls the existing adapter/core path; it does not implement mesh mutation logic inside editor session/workflow/state.
- Editor workflow adds a minimal nudge action without UI implementation. `nudgeMeshVertex` validates selected mesh, editable vertex, and finite non-zero delta before committing through the session adapter in `apps/editor/src/editor-workflow/workflow-controller.ts:390`.
- View model gives Domain D command-ready data. `projectMeshEditViewModel` exposes selected mesh, editable rows, per-direction command payloads, enabled state, labels, and last mesh edit result in `apps/editor/src/editor-state/mesh-edit-view-model.ts:66`; the root workflow view model includes it at `apps/editor/src/editor-state/editor-view-model.ts:148`.
- Selected mesh ownership is deterministic and narrow: `projectMeshEditState` maps current ordered drawables to meshes and selects the first mesh with schema-valid editable vertices, falling back to a non-editable mesh when needed in `apps/editor/src/editor-state/mesh-edit-state.ts:37`.
- Operation evidence includes `moveMeshVertex`, so committed editor operations stay on the runtime / validation artifact path and package file set path in `apps/editor/src/editor-session/evidence-provider.ts`.
- Public `index.ts` files remain barrel-only: `apps/editor/src/editor-session/index.ts:6`, `apps/editor/src/editor-state/index.ts:12`, and `apps/editor/src/editor-state/index.ts:13` only add re-exports.
- No `apps/editor/src/ui/**`, `apps/editor/e2e/**`, package source, contracts, runtime-core, validator-core, or unrelated report files were changed by the scoped Domain C diff.

## Test Adequacy Assessment

`pass`.

- Session commit path, operation log, package file set, generated evidence path, and reloaded mesh coordinates are covered by `apps/editor/src/editor-session/session-adapter.test.ts:323`.
- Workflow nudge, generated drawable mesh edit, operation log persistence, and save/load coordinate restoration are covered by `apps/editor/src/editor-workflow/workflow-controller.test.ts:221`.
- Domain D-facing view model fields and nudge command shape are covered by `apps/editor/src/editor-state/editor-view-model.test.ts:419`.
- Existing generated drawable workflow remains covered by `apps/editor/src/editor-session/session-adapter.test.ts:248` and `apps/editor/src/editor-workflow/workflow-controller.test.ts:42`.
- Existing layer controls and preview slider / preview-state behavior remain covered by `apps/editor/src/editor-workflow/workflow-controller.test.ts:94`, `apps/editor/src/editor-workflow/workflow-controller.test.ts:339`, and the existing view model preview tests.
- Existing save/load and AI approval regressions remain in `apps/editor/src/editor-workflow/workflow-controller.test.ts`, including load/save tests starting at `apps/editor/src/editor-workflow/workflow-controller.test.ts:9`.

The focused coverage is sufficient for Domain C. Browser UI and e2e coverage are correctly deferred to Domain D/E.

## Remaining Risks / Open Verification Items

- Domain C intentionally provides a deterministic single selected mesh projection, not a full explicit selection model. Richer UI selection is still future Domain D or later scope.
- The editable list relies on generated meshes having schema-valid `vtx_` stable IDs. Legacy sample vertices with non-`vtx_` IDs remain non-editable by design.
- Runtime vertex hash / dedicated runtime diff and validation evidence semantics are owned by Domain B and should be checked in Wave17 integration.
- End-to-end browser interaction and mobile layout are not expected in Domain C; they remain Domain D/E responsibilities.

## Verdict

`pass`. Domain C meets the editor session / workflow / state requirements and does not need a Gnome fix loop before Domain D.
