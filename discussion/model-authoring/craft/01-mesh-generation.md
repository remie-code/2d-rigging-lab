# レシピ 01: メッシュ生成

drawable にレンダリング可能なメッシュを与える。新規モデルでは事実上の必須第一工程（レシピ 00 参照: インポート直後は全 drawable が頂点 0）。

## 前提状態

- レシピ 00 完了（実行系・標的 drawableId・現在の packageRevision を把握済み）
- 対象 drawable の選定基準: これから動かす部品 + その動きの視覚判定に要る文脈部品（例: 眼球を動かすなら face・まつげ・白目にもメッシュが要る。真っ白な背景では誰も動きを判定できん）

## 操作

op スペック（apply-op.mjs に渡す形）:

```json
{
  "operationId": "op_<模型>_mesh_<部品>",
  "operationType": "generateMesh",
  "basePackageRevision": <現在値>,
  "payload": {
    "drawableId": "<対象>",
    "method": "auto-outline-v6d-adaptive-contour-constrainautor",
    "densityHint": "medium"
  }
}
```

- method + densityHint の組は Editor UI の「Standard」プリセットと同一（出典: `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:70`）。★大きく変形する部品は `high`、剛体は `low` を検討（Editor の Large Motion / Low Motion 相当）
- 複数部品は 1 部品ずつ順に commit（revision が 1 ずつ進む）。各 commit 後に作業ワークスペースで git commit

## 完了チェック

- `<PKG>/model/meshes.json` で対象の `vertices.length > 0` かつ `triangles.length > 0`
- レンダ確認: `renderView` `{view:{kind:"drawableFocus",drawableId:"<face等の大きい部品>"}, outDir, outputName}` → メッシュを与えた部品が描かれている（★重なり順・欠けの異常が無いか自分の目で見る）

## 既知の罠

- 生成済みメッシュへの再 generateMesh は通る（wave103 実証）が、既存の keyform・デフォーマ結線がある部品では影響を考えてから
- 眼球級の小部品で頂点 30 前後・三角形 40 前後が medium の相場（閉問題 01 実測: 53×52 の虹彩で 32 頂点/44 三角形）
- **strict validate は生成メッシュ全数に `mesh.uvCoordinateOutOfBounds` error を必ず出す**（3周目=claude-chan 周回で発見・裁定）。生成器は輪郭に約2pxの covering margin を張り UV を [0,1] にクランプしない設計（Wave108/Option E）のため、越境は仕様。GUI の Standard プリセットでも同一。この error は validatePackage レポート専用で commit・export のどこも塞がず、レンダラは CLAMP_TO_EDGE で越境 UV を透明ガターへ落とす。**確認すべきは error の消去ではなくガターの実在**: `assets/textures/texture-atlas.json` の全テクスチャで `contentInset` ≥ 2px（マージン幅）を機械確認すれば安全は閉じる。`mesh.orphanedVertex`（三角形非参照頂点）も同様に生成器由来・非描画・実害なし。validate を出口基準に使う場合は「blocking 0 + error はこの既知2クラスのみ」と書く
- レンダ画素のシルエットは境界の凸区間で実頂点境界より2〜3px 痩せる（マージン頂点が透明ガターへ減衰するため）。**シルエット実測の正はメッシュ境界**であり、レンダ画素を使わない

## エスカレーション条件

- dry-run が reject を返し、診断の checkId から原因が特定できない → 診断 JSON を添えてユーザーへ
