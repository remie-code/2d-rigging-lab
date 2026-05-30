# Wave 17 Domain C Completion: editor mesh edit workflow state

## Verdict

`pass`

Editor session / workflow / state に `moveMeshVertex` commit path、最小 vertex nudge action、Domain D 向け mesh edit view model を追加した。UI は未実装で、変更は許可された editor session / workflow / state と focused tests に限定した。

## Changed Files

Editor session:

- `apps/editor/src/editor-session/mesh-vertex-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`

Editor workflow:

- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`

Editor state / view model:

- `apps/editor/src/editor-state/mesh-edit-state.ts`
- `apps/editor/src/editor-state/mesh-edit-view-model.ts`
- `apps/editor/src/editor-state/view-model-format.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-state/editor-view-model.test.ts`

Report:

- `discussion/implementation/waves/wave17/wave17-editor-mesh-edit-workflow-state-completion.md`

## Implementation Summary

- `moveMeshVertex` operation request builder を追加し、editor session adapter から commit できるようにした。
- Editor evidence provider に `moveMeshVertex` を追加し、commit 後の operation log / package file set / generated runtime-validation artifacts の保存経路に載せた。
- Editor workflow に `nudgeMeshVertex(command)` を追加し、view model が提供する nudge command をそのまま受けて `moveMeshVertex` に変換するようにした。
- Editor semantic state に mesh edit projection を追加し、drawable -> mesh の所有関係から selected mesh、editable vertices、nudge enabled state を投影するようにした。
- Domain D 用 view model として selected mesh、editable vertex rows、left/right/up/down nudge commands、last mesh edit result label を追加した。UI が operation payload を再構築しなくてよい形にしている。
- Save/load 後に edited mesh vertex coordinate が復元される focused workflow test を追加した。

## Verification Results

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/editor-view-model.test.ts`
  - sandbox: `node_modules` の Vitest 読み取りで `EPERM`
  - escalated rerun: pass, 3 files / 33 tests
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - sandbox: TypeScript `node_modules` 読み取りで `EPERM`
  - first escalated run: `mesh-edit-state.ts` の Map key 型エラーを検出
  - final escalated run: pass
- `pnpm.cmd run check:source`: pass
- `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/editor-state discussion/implementation/waves/wave17/wave17-editor-mesh-edit-workflow-state-completion.md`: pass, LF/CRLF warnings only
- New-file trailing whitespace check with `Select-String`: pass, no matches

Focused tests cover:

- Editor session commit path, operation log, package file set, and reloaded mesh coordinates.
- Workflow nudge action, generated drawable mesh edit, save/load restoration, operation log persistence.
- View model selected mesh, editable vertex rows, nudge command shape, and last mesh edit result.
- Existing generated drawable workflow, layer controls, preview parameter controls, save/load, AI approval regressions in `workflow-controller.test.ts`.

## Source Organization Notes

- `apps/editor/src/editor-session/index.ts` and `apps/editor/src/editor-state/index.ts` remain barrel-only; only re-export lines were added.
- `apps/editor/src/editor-workflow/index.ts` was not edited.
- New session request-building logic lives in `mesh-vertex-command.ts`, not in `session-adapter.ts`.
- Mesh edit state projection lives in `mesh-edit-state.ts`; Domain D view model projection lives in `mesh-edit-view-model.ts`.
- Shared label formatting was moved to `view-model-format.ts` so `editor-view-model.ts` stays as composition rather than absorbing the mesh edit projection body.
- No `apps/editor/src/ui/**`, e2e files, or package source files were edited by this domain.

## Remaining Risks / User-Decision Points

- No blocking user decision remains for Domain C.
- Current selected mesh policy is deterministic: choose the first mesh with schema-valid editable `vtx_` stable vertex IDs, falling back to a non-editable mesh when none exists. A richer explicit selection model remains future UI scope.
- The browser sample mesh still has legacy non-`vtx_` stable IDs, so it is not exposed as nudge-enabled. Generated drawable meshes use `vtx_...` IDs and are editable.
- Runtime vertex-hash / dedicated runtime diff visibility for mesh edits is owned by Domain B; Domain C verifies editor commit, operation log, package file set, and save/load coordinate persistence.
