# Wave 17 Domain D Completion: editor mesh vertex controls UI

## Verdict

`pass`

Drawable authoring UI に最小 mesh vertex controls を追加し、generated drawable / mesh 作成後に vertex row から x/y nudge を実行できるよう app shell と editor app に接続した。UI は Domain C の view model が提供する command をそのまま callback へ渡し、operation payload は UI で再構築していない。

## Context Separation Evidence

- Gnome implementation context: `019e7898-52d8-7a31-8f89-28ceb6dd3d76` (`Gnome the 14th`)
- Review-Sylph context: `019e789f-52ae-7af2-af27-fd4ffada7be9` (`Sylph the 15th`)
- Orch-Sylph は source implementation files / tests を編集していない。Orch-Sylph の書き込みは、この completion report の分離証跡・統合結果追記のみ。
- Review-Sylph は Gnome とは別コンテキストで、basis documents、指定 diff、untracked source の直接読解、focused verification の再実行に基づいてレビューした。

## Review Result

- Review report: `discussion/implementation/reviews/wave17/wave17-editor-mesh-vertex-controls-ui-review.md`
- Review verdict: `pass`
- Blocking findings: none
- Warnings: none
- Review lanes: Design / Development Compliance Review、Test Adequacy Review、UI / Accessibility smoke review

## Changed Files

Drawable authoring UI:

- `apps/editor/src/ui/drawable-authoring/mesh-vertex-controls.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`

App shell / app wiring:

- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/app/editor-app.ts`

UI support:

- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/styles/editor.css`

Report:

- `discussion/implementation/waves/wave17/wave17-editor-mesh-vertex-controls-ui-completion.md`

## Implementation Summary

- `createMeshVertexControls` を追加し、selected mesh、editable vertex count、nudge step、last mesh edit result、editable vertex rows を表示するようにした。
- 各 vertex row に `-X` / `+X` / `-Y` / `+Y` nudge buttons を追加し、button click は `viewModel.meshEdit.editableVertices[].nudgeCommands` の command object をそのまま `onNudgeMeshVertex` に渡す。
- `DrawableAuthoringPanelOptions` に `onNudgeMeshVertex` を追加し、generated drawable UI、Wave16 layer controls、mesh vertex controls、drawable list を同じ drawable authoring panel 内に収めた。
- `EditorAppShellOptions` と `mountEditorApp` に mesh nudge callback を追加し、`workflow.nudgeMeshVertex(command)` 実行後に render し直すことで embedded preview visual と mesh edit status が更新されるようにした。
- Domain E 用に固定 test id `meshVertex.controls` / `meshVertex.status` と、動的 row / nudge button test id factory を追加した。
- `aria-labelledby`、`role="status"`、nudge button `aria-label` を追加し、E2E / a11y smoke が安定して対象を取れるようにした。

## Verification Results

- `pnpm.cmd exec vitest run apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts`
  - sandbox: Vitest `node_modules` read が `EPERM`
  - escalated rerun: pass, 3 files / 20 tests
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - sandbox: TypeScript `node_modules` read が `EPERM`
  - first escalated run: test callback の `onNudgeMeshVertex` 不足を検出して修正
  - final escalated run: pass
- `pnpm.cmd run check:source`: pass
- `git diff --check -- apps/editor/src/ui/drawable-authoring apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/app/editor-app.ts apps/editor/src/styles apps/editor/src/editor-state/editor-test-ids.ts discussion/implementation/waves/wave17/wave17-editor-mesh-vertex-controls-ui-completion.md`: pass, LF/CRLF warning only
- `git diff --check -- apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`: pass, LF/CRLF warning only

Orch-Sylph integration verification:

- `pnpm.cmd exec vitest run apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts`
  - sandbox: Vitest `node_modules` read が `EPERM`
  - escalated rerun: pass, 3 files / 20 tests
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - sandbox: TypeScript `node_modules` read が `EPERM`
  - escalated rerun: pass
- `pnpm.cmd run check:source`: pass
- `git diff --check -- apps/editor/src/ui/drawable-authoring apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/app/editor-app.ts apps/editor/src/styles apps/editor/src/editor-state/editor-test-ids.ts discussion/implementation/waves/wave17/wave17-editor-mesh-vertex-controls-ui-completion.md`: pass, LF/CRLF warning only

Focused UI tests cover:

- Mesh vertex controls の表示、status、row test id、nudge button accessible label。
- Nudge button が view-model command をそのまま callback に渡すこと。
- App shell から mesh vertex nudge callback が呼ばれること。
- Workflow nudge 後に preview visual の polygon points と mesh edit status が更新されること。
- 既存 drawable create UI、Wave16 layer visibility / move controls、preview panel regressions。

## Source Organization Notes

- `apps/editor/src/ui/drawable-authoring/index.ts` は編集せず、barrel-only を維持した。
- Mesh vertex controls は `mesh-vertex-controls.ts` に分離し、`drawable-authoring-panel.ts` は composition に留めた。
- `editor-test-ids.ts` は fixed / dynamic test id 定義の追加のみ。
- `editor.css` は既存 drawable authoring / responsive table pattern に合わせた最小 style 追加のみ。

## Remaining Risks / User Decision Points

- Full canvas editor、drag selection、multi-vertex edit、UV / topology edit は Wave17 方針どおり未実装。
- Nudge step は Domain C view model の固定値を表示するだけで、UI から変更する step input は追加していない。step 変更 action は現時点の Domain C 契約外。
- E2E / save-load browser smoke は Domain E の責務。Domain D は stable test id / accessible label と focused UI coverage までを実装した。
- Blocking user decision point はなし。
