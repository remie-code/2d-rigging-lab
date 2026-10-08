# レシピ 03: 白目クリッピング

虹彩を白目の輪郭で刈る（visibility mask）。眼球移動の可動域を審美的に成立させる仕上げ。

## 前提状態

- 虹彩・白目の両方にメッシュあり（マスク源にもジオメトリが要る）
- 対象の drawableId を名前（displayName の eyewhite-l 等）から同定済み

## 操作（片眼ずつ×2）`setMaskRelation`

```json
{ "operationType": "setMaskRelation",
  "payload": {
    "maskDrawableIds": ["<eyewhite-l の drawableId>"],
    "targetDrawableIds": ["<irides-l の drawableId>"],
    "enabled": true } }
```

- maskRelationId は省略で自動導出。保存先は `<PKG>/model/masks.json`
- selfMask（自分で自分）と空リレーションは reject される

## 完了チェック

- `masks.json` に 2 リレーションが enabled で存在
- **★視覚（罠あり）**: マスク効果は低倍率のコンタクトシートでは**弁別できないことがある**（はみ出しがまつげの陰に隠れる）。検証は次のどちらかで行う:
  1. **ピクセル差分**: マスク前後の同一 sweep レンダを PNG デコードして差分画素を数える（決定論レンダなので、差分 > 0 = マスクが実際に刈っている証拠。閉問題 01 実測: 30,913 px）
  2. **高倍率ズーム**: `renderView` で片眼だけの `stageViewport` + `outputWidth` を大きく取り（~10 倍）、`parameterOverrides` で ±1 に振る → 虹彩の縁が白目のアーモンド輪郭に沿って刈られ、肌に色が溢れていないことを目視

## 補足（レンダラ仕様）

このリポジトリのレンダラはマスク源 drawable を通常描画にも参加させる（WebGL2 忠実 semantics、wave103 承認済み）。白目が普通に見えているのは正常。

## エスカレーション条件

- 高倍率で虹彩が輪郭外に残る → マスク結線の対象取り違え（drawables.json で displayName を再確認）。直せなければ git 巻き戻し + ユーザー報告
