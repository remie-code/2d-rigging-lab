# Wave18 Domain D 完了報告: Editor Source Import Workflow Integration

## Verdict

`pass`

Domain D の許可範囲内で、editor session / workflow から `importSplitPngSourceAsset` と `setRightsMetadata` を commit できるようにし、commit 後の imported source asset / layer を createDrawable workflow の既定選択へ接続した。blocked rights draft は operation precondition rejection として扱い、successful import にはしていない。

## 対象

- Domain: `wave18-editor-source-import-workflow-integration`
- 実装担当: Gnome 別コンテキスト
- 実装 agent id: `019e78df-bf62-7d72-8d6b-87230ba82675` (`Gnome the 28th`)
- レビュー担当: Review-Sylph 別コンテキスト
- レビュー agent id: `019e78ec-de57-7a40-921c-67c086c5da48` (`Sylph the 30th`)
- Review artifact: `discussion/implementation/reviews/wave18/wave18-editor-source-import-workflow-integration-review.md`
- Review verdict: `pass`
- Date: 2026-05-30
- Orch-Sylph source 実装: なし。Orch-Sylph は source implementation files / tests を編集せず、source implementation は Gnome 別コンテキストへ委譲し、review は別 Review-Sylph コンテキストへ委譲した。

## 変更ファイル

Editor session:

- `apps/editor/src/editor-session/source-import-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`

Editor workflow:

- `apps/editor/src/editor-workflow/source-intake-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`

Editor state / view model:

- `apps/editor/src/editor-state/create-drawable-form-state.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`

Domain C UI との最小接続:

- `apps/editor/src/ui/source-assets/source-intake-panel.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`

Report:

- `discussion/implementation/waves/wave18/wave18-editor-source-import-workflow-integration-completion.md`

## 実装概要

- `source-import-command.ts` を追加し、GUI actor/surface の `importSplitPngSourceAsset` / `setRightsMetadata` request builder を作成した。
- `EditorSessionAdapter` に `commitImportSplitPngSourceAsset` と `commitSetRightsMetadata` を追加した。
- Editor evidence provider に import / rights metadata operation の runtime-validation evidence capture を追加し、committed operation が editor persistence path で失敗しないようにした。
- Workflow controller に `commitSourceIntakeDraft` と `commitSetRightsMetadata` を追加した。
- confirmed source intake draft を Domain A payload shape へ変換し、draft notes は provenance `transformHistory` へ反映するようにした。
- Commit 後の `sourceManifest.sourceAssets` を editor semantic state に保持し、`importSplitPngSourceAsset committed` 時は first editable imported layer を `pendingCreateDrawable` の source selection に反映するようにした。
- Source Intake panel に imported source asset list を追加し、generated fixture source は imported list から除外した。
- Save/load は package file set から source manifest / provenance / rights / mapped drawable relation を復元する workflow regression で確認した。

## 検証結果

Pass:

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-state/source-intake-draft-state.test.ts`
  - sandbox では Vitest の `node_modules` 読み取りが `EPERM`。
  - escalated rerun: pass, 5 files / 45 tests。
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - sandbox では TypeScript の `node_modules` 読み取りが `EPERM`。
  - escalated rerun 中に test literal の型不一致を検出し修正。
  - final rerun: pass。
- `pnpm.cmd run check:source`
  - pass, Source organization guard passed。
- `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/editor-state apps/editor/src/ui/source-assets discussion/implementation/waves/wave18/wave18-editor-source-import-workflow-integration-completion.md`
  - pass。LF/CRLF working-copy warnings のみで whitespace error なし。

## レビュー結果

- Review-Sylph agent id: `019e78ec-de57-7a40-921c-67c086c5da48` (`Sylph the 30th`)
- Review artifact: `discussion/implementation/reviews/wave18/wave18-editor-source-import-workflow-integration-review.md`
- Review verdict: `pass`
- Blocking findings: なし。
- Review lanes:
  - Design / Development Compliance Review
  - Test Adequacy Review
  - Workflow / Persistence Integrity Review

## Pass Evidence

- Editor session から split PNG source import を commit し、`assets/sources/source-manifest.json`、`assets/provenance.json`、`assets/rights.json`、`operations/log.jsonl` に反映されることを `session-adapter.test.ts` で確認した。
- Editor session から import 後の `setRightsMetadata` を commit し、rights record と provenance `relatedOperationIds` が更新されることを確認した。
- Imported source layer を `commitCreateDrawablePreset` に渡し、`createDrawable` / `generateMesh` が既存 workflow のまま committed になることを確認した。
- Workflow では source draft import -> rights update -> imported layer createDrawable -> save/load の一連を確認し、source manifest / provenance / rights / mapped drawable relation / operation log が復元されることを確認した。
- blocked rights draft は `operation.importSplitPngSourceAsset.blockedRights` diagnostic を持つ rejected result になり、operation log と source asset list に追加されないことを確認した。
- `index.ts` 変更は re-export のみ。新規実装は `source-import-command.ts` と `source-intake-workflow.ts` に責務分割した。

## 残リスク / Orch-Sylph 判断点

- `apps/editor/src/app/editor-app.ts` は Domain D の allowed write scope 外として編集していない。そのため mounted app の `onConfirmSourceIntakeDraft` callback は Domain C 時点の app-local draft confirm のまま。Domain F で browser GUI から form submit を直接 import commit へつなぐ場合は、app-level callback wiring の許可が必要。
- Real PNG bytes、file picker、PNG decode、texture atlas generation、actual texture rendering は Wave18 non-goal のまま。
- `setRightsMetadata` operation payload は notes を持たない。Domain D では draft notes を import provenance `transformHistory` に残す範囲に留めた。

## User Decision Points

Domain D の session / workflow integration 完了を妨げる user decision point はなし。
