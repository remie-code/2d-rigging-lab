# Closed Problem 01: API Requirements

> 問い A「この問題を解くために Fable に必要な API は何か」への事実層。2026-07-02 Sylph 調査（A / A2、モデル: sonnet）の L0 統合。証拠パス付きリポジトリ事実。

## 操作対応表

| 工程 | 状態 | operation | 呼び出し形の概形 | 証拠 |
|---|---|---|---|---|
| 1. メッシュ生成 | **exists** | `generateMesh` | `{drawableId, method: MESH_GENERATION_METHOD_IDS のいずれか, densityHint?: "low"\|"medium"\|"high", previewMesh?}`。ヘッドレスでは previewMesh 省略で生成させる。UI の「3プリセット」は `densityHint` 対応が有力（未確定、method の値集合は authoring-core 側で未確認） | `packages/operation-core/src/operations/generate-mesh.ts:34-45`, `payloads/model-edit.ts:334-349` |
| 2. ワープデフォーマ作成 | **exists** | `createWarpDeformer`（上位）/ `createWarpLattice2dRigControl`（低レベル） | `transformColumns`/`transformRows` は**必須・デフォルト無し**。bezier 系引数も必須。親子指定は 3 モード排他（`wrapChildren` / `insertBeforeChild` / 直接指定）。保存 kind は両方 `warpLattice2d` | `create-warp-deformer.ts:73, 275-276, 308-331` |
| 3. keyform 打ち | **exists** | `editKeyformKey` `action: "createEndsCenter"` | パラメータの min/default/max の 3 点一括作成。`statePatches: {min, default, max}`。パラメータ自体が無ければ `createParameter`（`{displayName, valueSource, min, max, default, ...}`）で作成 | `edit-keyform-key.ts`, `edit-keyform-key.test.ts:201-251`, `create-parameter.ts` |
| 4. 平行移動 + 横幅スケール | **exists**（表現に注意） | 工程 3 の statePatch の中身 | target kind `"rigControl"`。**平行移動**: `targetProperty: "translation"`, value は `{x, y}`。**横幅スケール**: 専用プロパティは未発見 → `targetProperty: "controlPointOffsets"`（`Vec2[]`、格子点数と一致必須、左右列の X を外側に広げる等で表現）。確認済み targetProperty は translation / angleDegrees / controlPointOffsets / opacityMultiplier の 4 種 | `model-edit.ts:31-39, 433-438`, `edit-keyform-key.test.ts:286-404` |
| 5. 反対側の眼球 | — | 工程 4 と同一 operation の適用 | | |
| 6. クリッピング | **exists** | `setMaskRelation` | `{maskDrawableIds: [白目 drawableId], targetDrawableIds: [眼球 drawableId], enabled: true}`。`maskRelationId` は省略時自動導出。保存先 `/model/masks/`。selfMask / emptyRelation は reject | `set-mask-relation.ts:32-43, 121-136`, `model-edit.ts:512-518` |

**6 操作すべてに対応する operation が存在する。** 操作面の欠落は無い。

## 実行ライフサイクル（横断事実）

- 正規フロー: `AiCommandExecutor.execute()` → `dryRunOperation`（要 `dryRunEdit` capability）→ 承認記録 → `commitOperation`（要 `approvedDryRunCommandId`。無ければ `needs_approval` で reject）。**ワンショット commit は不可、dry-run → 承認 → commit の 2 段階が強制される**。（`ai-command-executor.ts:68-149`）
- operation-core の各 handler は `dryRun()` / `commit()` の 2 メソッドを持つ。

## ギャップ（実装が必要な欠落。事実として）

1. **ヘッドレスホストが存在しない（apps/ 含め全域で確定）。** `AiOperationCommandHost` は 2 メソッドのインターフェースのみで、実装はテストの Fake だけ。`ai-interface` は dependency-boundary テストで `package-format` / `node:fs` 等の import を**明示的に禁止された純ロジック層**であり、ディスク I/O・AuthoringSession 保持・operation-core 接続はすべてホスト側の責務。追調査により **apps/editor・apps/runtime-player にも実装・依存宣言・使用箇所が皆無**（`ai-interface` への依存宣言すら無い）と確定。wave40-41 期の proposal review UI は wave57 の React 全面リセット以降に再実装されていないと推測される。（`ai-command-host.ts:3-6`, `dependency-boundary.test.ts:44-62`, apps/ 全域 grep 0 件）
   - 関連事実: **Editor 自身は ai-interface を経由せず operation-core を直接呼ぶ**（`apps/editor/src/features/editor-session/model/editor-session-commands.ts:539` の `operationCore.commitOperation(session, request)`）。ヘッドレスホストの設計には「ai-interface 層（承認ライフサイクル・transcript・capability 制御込み）を通す」「Editor 同様 operation-core 直叩き」の 2 案が存在する（→ 承認 gate 分岐と連動するユーザー議論事項）。
2. **Validate の外部入口が無い。** `validatePackage` コマンドは `not_implemented` 固定。`ai-validation-command.ts` に型定義のみ存在しディスパッチ未接続。product-preflight 系 3 コマンドは生成済み report の観測・差分のみ。（`ai-command-executor.ts:79, 161-178, 228-258`）
3. **CLI / スクリプトのエントリポイントが無い。** ai-interface を叩く scripts は 0 件。ライブラリとしてのみ存在。

## 解消済みの不確実性（Wave103 Domain A で実証、2026-07-02）

- **`createEndsCenter` の keyform set 未存在からの単独実行 → 動作する（committed）**。実証: `apps/authoring-host/src/closed-problem-01-smoke.test.ts:132-181`（事前 `keyformSets: []` アサート → CLI 経由単独実行 → 新規 keyformSet 1 件・3 キー生成）。注意: parameter の min/default/max は**相異なる値が前提**（同値は `operation.editKeyformKey.duplicateKey` で reject される既存仕様）。Eyeball_X のレンジ設計時に留意。
- **6 操作すべてが CLI ホスト経由でヘッドレス実行可能**。5 operation スモーク（generateMesh → createWarpDeformer → createParameter → createEndsCenter → setMaskRelation）が全件 committed。

## 残る不確実性

- `MESH_GENERATION_METHOD_IDS` の値集合（authoring-core 側、未読）。UI 3 プリセットとの対応確定に必要
- 横幅スケールの専用プロパティ（scaleX 等）の有無（確認済み 4 種以外）
- 承認の自動化可否と ai-interface 層の要否: `approveDryRunCommand` を誰が呼ぶか、自己承認ポリシーが許されるか、そもそもホストが ai-interface 層を通すか operation-core 直叩きか（**設計分岐 → ユーザー議論事項**）
