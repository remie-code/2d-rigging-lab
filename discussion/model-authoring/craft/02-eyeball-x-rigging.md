# レシピ 02: 眼球 X rigging（ワープデフォーマ + 移動キー）

Eyeball X パラメータで両眼の虹彩が左右に動くようにする。閉問題 01 でユーザー満点 gate を通過した手順の蒸留。

## 前提状態

- 両虹彩（irides-l/r）にメッシュあり（レシピ 01）
- 巻尺で rest bbox 取得済み: 虹彩 L/R、白目 L/R（`inspectEvaluatedGeometry`）

## 設計（★数値判断。すべて巻尺の数値から導出する）

- **振幅 T** = おおよそ `(白目.width − 虹彩.width) / 2`（左右で違えば大きい方の眼を基準に対称値を採る。はみ出しはレシピ 03 のクリッピングが刈るから、多少の超過は許容——むしろ視線の可動域はそれで生きる）。閉問題 01 実測: 白目 w70/75、虹彩 w53 → T=11
- **横幅スケール s** = 0.92（極値での遠近 squash。subtle でよい）
- **方向規約**: `param_eyeball_x` は preset カタログ定義で min=画面左視線 / max=画面右視線。stage +x = 画面右。よって max キーの移動は +T

## 操作列（片眼ずつ×2）

### 1. ワープデフォーマ作成 `createWarpDeformer`

```json
{ "displayName": "Eyeball L Warp",
  "childDrawableIds": ["<irides-l の drawableId>"],
  "domainBounds": { "x": <白目.x − T − 5>, "y": <白目.y − 5>,
                    "width": <白目.width + 2T + 10>, "height": <白目.height + 10> },
  "transformColumns": 5, "transformRows": 4, "bezierColumns": 2, "bezierRows": 2 }
```

domain は「白目 bbox を振幅+マージン分広げた矩形」。rigControlId は displayName から自動導出される（例: `rig_eyeball_l_warp`）。commit 後に `<PKG>/model/rig-controls.json` から `restControlPoints`（5×4=20 点、domain 上の一様グリッド）を読む。

### 2. パラメータは**作らない**（罠）

`param_eyeball_x` は preset カタログ（`packages/package-format/src/parameter-presets.ts`）に常在。createParameter は `duplicateParameter` で reject される。preset をそのまま使う。createParameter はカスタムパラメータ専用。

### 3. 三点キー `editKeyformKey` action `createEndsCenter`（罠込み）

**罠: warpLattice2d に `targetProperty:"translation"` は打てない**（rotation2d 専用で reject）。移動は `controlPointOffsets` に畳み込む:

各 rest 格子点 p に対し `offset(p) = { x: T_key + (s−1)·(p.x − cx), y: 0 }`（cx = domainBounds の x 中心）。restControlPoints から点ごとに計算するので保存順に依存しない。

```json
{ "action": "createEndsCenter",
  "target": { "kind": "rigControl", "id": "rig_eyeball_l_warp" },
  "targetProperty": "controlPointOffsets",
  "parameterId": "param_eyeball_x",
  "interpolation": "linear-1d-v1",
  "statePatches": {
    "min":     { "propertyPath": "controlPointOffsets", "value": [<T_key=−T で20点分>] },
    "default": { "propertyPath": "controlPointOffsets", "value": [<全点 {x:0,y:0}>] },
    "max":     { "propertyPath": "controlPointOffsets", "value": [<T_key=+T で20点分>] } } }
```

value の要素数は必ず格子点数（列×行）と一致（不一致は reject）。**移動と横幅スケールが 1 keyform set で済む**のがこの畳み込みの利点。

## 完了チェック（三段）

1. **数値**: `inspectEvaluatedGeometry` に `parameterOverrides:{param_eyeball_x:±1}` を付けて虹彩 bbox を測る。期待値: 左端 = `cx + s·(rest頂点minX − cx) ± T`、幅 = `s × rest頂点幅`、y 不変。※rest の計測 bounds は宣言値・変形時は評価済み頂点範囲なので、比較の基底には**変形式から逆算した rest 頂点範囲**を使うこと
2. **視覚 ★**: `renderView` に `sweep:{parameterId:"param_eyeball_x", steps:5}` + 両眼を含む `stageViewport` → コンタクトシートで「-1 = 左寄り / 0 = rest / +1 = 右寄り、両眼同期、白目・まつげ不動」を自分の目で確認
3. **【ユーザー gate】**: ユーザーが Editor スライダーで動きを確認（動きの満足は最終的に人間の判定）

## エスカレーション条件

- createEndsCenter が `duplicateKey` で reject → パラメータの min/default/max が相異なるか確認（同値だと三点キーは打てない仕様）
- sweep で白目やまつげまで動く → childDrawableIds の結線ミス。git 巻き戻しからやり直し

---

## 眼球 Y への転置（2周目 gate 通過・3周目再実証 2026-07-12。蒸留漏れを3周目で回収）

- **振幅 T_y**: 高さ差式 `(白目.h − 虹彩.h)/2` は**アニメ目（虹彩が縦に目一杯）のモデルで 0 以下に退化する**。その場合は**アスペクト比縮約**で置く: `T_y = T × (白目.h / 白目.w)`（大きい方の眼基準。実証: T=11 → T_y=7.7）
- **方向規約**: preset eyeball.y は max=上視線 → y-down では **max キー = −T_y**。縦スケール s_y = 0.92（s の転置）
- **実装構造 = Y 専用ワープを wrapChildren で入れ子新設**（X ワープと虹彩の間に挿入。1デフォーマ=1パラメータ原則——同一ワープへの複数パラメータ keyform 合成は未保証）。X の keyformSet が per-set sha で無傷なこと・**挿入後の X 回帰レンダ（sweep 画素同一）**が必須の検証
- **Y はクリッピング（レシピ03）とセットでないと成立しない**: 縦は隙間ゼロで全量はみ出す。上視線 = 虹彩上縁がまぶたに留まり下に白目が三日月状に覗く「見上げ」の絵——クリップ前提の設計が正
- 状態セット（半目等）の眼球にも**視線の一致**で同じ T・T_y を使う（共有不変量）

## 同族の小物: 眉（3周目確立。レシピ空白の回収）

- 眉の上下（brow_left_y / right_y）= 本レシピの骨格の平行移動転置: 眉1本 = ワープ1基（5×4）、三点キー `{x:0, y:∓T_brow}`（max=上げ。preset 意味論を parameter-presets.ts で確認してから）
- T_brow は眉〜まつげの間隙から安全振幅を取る。**間隙は bbox でなく alpha 列間隙で測る**（bbox は角の見かけで偽陽性停止を生む）
- **brow form（形状）系は参照素材が無ければ実装しない**が既定（形状の発明は人間仕上げ領分。gate の残ダイヤルとして提示）
