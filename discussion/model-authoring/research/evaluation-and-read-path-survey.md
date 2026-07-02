# Evaluation and Read Path Survey

> Wave104 planning-gate の Inventory（Sylph C/D、2026-07-02、モデル: sonnet）の L0 統合。証拠パス付きリポジトリ事実。

## C: session → 評価 → RenderScene 経路

### 重大事実: 評価器は二系統の並行実装

- **Editor Canvas 系**: `apps/editor/src/workspace/canvas/canvas-evaluation.ts` の `createCanvasEvaluatedScene(session, options)`。runtime-core を**使っていない**。editor 内型（EditorSelection / ParameterValueMap / draft 系）に依存し、apps/editor 外への単純持ち出しは不可。
- **runtime-core 系**: `evaluateViewerRuntimeSnapshot`（`viewer-evaluation.ts`）。純依存（contracts + zod）。`parameterOverrides` 未指定でも zod default で評価成立（スキーマ確認済み）。
- 帰結: 「editor と authoring-host で描画結果が食い違う」構造的リスクが**評価器選択に関わらず**存在する（二実装が併存する以上）。

### RenderScene 構築

- `canvas-render-scene-adapter.ts`（`createRenderSceneFromCanvasProjection`）自体は純データ変換・DOM 非依存。ただし入力 `CanvasRenderProjection` の生成チェーンが editor 型依存。
- RenderScene に必要な要素は runtime-core の `RuntimeSnapshotDto` から取得可能な見込み: evaluatedMesh / draw order / opacity / visible / masks（`viewer-evaluation.ts:314-335`）/ texture 参照（`:326-327`）。**snapshot.ts のフィールド正式名は未読 → 実装時の bounded 確認事項**。
- `evaluateViewerRuntimeSnapshot` は `NormalizedRuntimeGraph` を要求する。`AuthoringGraph → NormalizedRuntimeGraph` の変換（`normalized-runtime-graph.ts`）の呼び出し形は未読 → 同上。

### テクスチャ供給

- render-software の `RenderRgba8TextureSource`: `{kind:"rgba8", textureId, width, height, bytes, alphaMode, contentSignature}`。テストは全合成で、session からの変換例は無い。
- **`session.binaryAssets.fileEntries` は width/height を持たない**（`package-binary-file-set.ts:27-32`）。寸法の出どころ: (a) `textureAtlas.textures[].dimensions`（正式・整合性チェックあり）(b) PSD レイヤー/mesh bounds からの推定（editor 方式、`canvas-projection.ts:344-359`）。いずれも AuthoringGraph 側の情報。
- 通常テクスチャ経路には `byteLength === width*height*4` 検証が存在しない（アトラス経路のみ、`viewer-render-source.ts:339-350`）→ host 側で新規に書く必要。

### 空 parameters の rest pose

- スキーマ上は評価成立（確認済み）。`graph.parameters` 空での深部挙動（`runtime-core.ts` / `normalized-runtime-graph.ts`）は未読・推測レベル → 実装時の bounded 確認事項。

## D: ai-interface の read 系接続点

### 重大事実: 完成済み・未接続の read 機構が存在する

- `ai-read-command.ts` の `AiReadCommandHost` + `executeAiReadCommand()`（`:31-39, 76-197`）は、`validatePackage` を含む read 系の host 委譲・capability チェック・ok/not_implemented/permission_denied 応答を**完全実装済み**。しかし `AiCommandExecutor.execute()` からも apps からも呼ばれていない孤立コード（grep 使用箇所ゼロ）。
- 現行 executor は read 系 9 コマンドすべてを `#unsupportedReadCommand` → `not_implemented` 固定で返す（`ai-command-executor.ts:76-85, 161-178`）。

### boundary / 依存

- dependency-boundary の禁止リスト（`:44-45`）に runtime-core / validator-core / render-core / render-software は**含まれない**。
- ただし package.json 依存は厳密一致検証（`:33-39`）: contracts / operation-core / runtime-core / validator-core / zod の 5 つのみ。**runtime-core は宣言済みだが production source で未使用**。render-core / render-software を足すには boundary テストの allowlist 更新が必要。

### validatePackage / transcript / capability

- `ValidatePackagePayloadSchema` = `{profile, packageRevision?}`。実データは host 側保持前提。
- validator-core に単一の統合エントリポイントは無い: 個別バリデータ群（`validators/*.ts`）+ `buildValidationReport`（`report-builder.ts:43`）+ `getValidationProfileConfig` の組み合わせを host / 新規層がオーケストレーションする形。
- transcript は read / validate / operation を問わず記録する共通構造。
- capability: `["read", "dryRunEdit", "commitWithApproval", "validate", "runScenario"]`。`validatePackage` は `validate`、他 read は `read`。**render 系 capability と `renderView` コマンド名は存在しない → 新設が前提**。

## L0 裁定（Wave104 計画に反映）

1. **知覚の評価器は runtime-core（`evaluateViewerRuntimeSnapshot`）を正とする。** 理由: (a) 決定論評価器のオーナーシップは runtime-core に統合済み（wave84 の accepted 方針）(b) モデルの出荷先（Player）の意味論と一致する——Fable の目は「エディタでどう見えるか」ではなく「モデルが実行時に何であるか」を見るべき (c) 純依存で Node に持ち込める。Editor Canvas 系の移植はしない。二実装の乖離リスクは既存の構造的事実であり、本 wave のスコープ外として記録する。
2. **read コマンドは `ai-read-command.ts` を正式経路として executor に統合する**（孤立機構の接続）。再実装はしない。
3. **`renderView` は新規 AiCommandName + 新規 capability として追加し、実処理は host 側に置く**（ai-interface には純 zod スキーマのみ。render-software 依存を ai-interface に足さない → boundary allowlist 無変更）。
