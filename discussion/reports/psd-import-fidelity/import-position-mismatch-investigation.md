# PSDインポートのパーツ位置ズレ調査

> 対象: `apps/editor` の PSD インポート。症状「インポート直後・無編集のキャンバスで、パーツ単位に数ピクセル級の位置ズレ(目・首裏の服=襟が微妙に違う)」の原因特定。
> 調査主体: Sylph（調査のみ、プロダクトコード改変なし）。
> 日付: 2026-07-12。

本文書は discussion/_conventions.md §6 に従い、情報種別を明示分離する。各記述の先頭に種別を付す。

---

## 0. 結論(先出し)

- **根本原因(確定): H1**。エディタのライブキャンバス描画は、各レイヤーの **透明パディング入りラスタ（padded raster）** を、**コンテンツ空間の UV 0..1 のまま**そのバウンズ上へ写している。パディング幅 `P` は `contentInset` としてテクスチャに記録されているが、**この描画パスでは UV に反映されていない**。結果、各パーツのコンテンツは自身のバウンズ中心を基準に `w/(w+2P) × h/(h+2P)` だけ縮小され、四辺が約 `P` px 内側へ寄る。`P` はレイヤー長辺依存(5〜17px)で**パーツごとに異なる**ため、隣接パーツが異なる量だけズレ、「全体はほぼ合うがパーツ単位で微妙にズレる」症状に一致する。
- これは偶発的な「inset 引き忘れ」ではなく、コード上に **de-scoped（設計 §5.5 で範囲外）と明記された既知の挙動**である（`canvas-projection.ts` のコメント）。したがって修正はスコープ判断（Undine 領域）を伴う。
- **H2（マスク未適用）: 棄却**。`composite(false,false)` はマスクを適用しないが、本 PSD の各レイヤーには実マスク画素データが存在しない（`realData`/`userMask()` すべて undefined）。
- **H3（可視性・変性レイヤー誤り）: 棄却**。半目/閉じ目グループは hidden で子へ effHidden が正しく伝播。表示されるのは「通常」目 + `mouth_a` のみで PS 既定と一致。
- **H4（グループ移動の非反映=ユーザー仮説）: 棄却**。生レイヤーレコードの `left/top` は整合した絶対座標であり、未適用のグループ変換は存在しない。座標は正しく、誤っているのは描画（UV/inset）側。

---

## 1. リポジトリ事実（コードパス）

座標・テクスチャの流れを bounds→頂点→UV→描画まで通しで確認した。

1. **パース/bounds採用**: `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:305-310`。レイヤー bounds は `child.left/top/width/height` をそのまま採用（絶対座標、コンテンツサイズ）。
2. **ラスタ抽出とパディング焼き込み**: 同ファイル `createLayerMaterializationEvidence`（`:369-463`）。
   - `rgbaBytes = await input.layer.layer.composite(false, false)`（`:377`）。
   - `padding = layerTransparentPaddingSourcePixels(longEdge)`（`:387`）= `maxCoverageMarginSourcePixels(longEdge)`。
   - `padLayerRasterWithTransparentBorder(...)`（`:140-169`）で四辺 `P` px の透明枠を焼き込み。`contentInset = {left,top,right,bottom} = P`（`:162-167`）。
   - materialization の `width/height` は **padded 寸法**、`contentInset` は四辺 P（`:423-425`）。bounds はコンテンツサイズのまま。
3. **パディング幅の定義**: `packages/authoring-core/src/mesh-generation-coverage-margin.ts:92-99`。
   `P = ceil(clamp(0.012 × longEdge, 4, 16) + 1)` → 小レイヤーで 5px、大レイヤーで 17px、中間は長辺比例。
4. **セッションへの取り込み**: `packages/operation-core/src/operations/import-psd-layer-materialization.ts`。
   - テクスチャエントリに `dimensions`(=padded) と `contentInset` を格納（`:248-263`）。
   - メッシュ bounds は `resolveInitialBounds` = `sourceLayer.bounds`（**コンテンツサイズ**、`:1075-1084`）。
   - インポート直後は `createManualEmptyMesh`（頂点・UV とも空、`:300-305` と `mesh-generation.ts:955-971`）。
5. **投影(projection)**: `apps/editor/src/workspace/canvas/canvas-projection.ts`。
   - `resolveDrawableRenderDimensions`（`:360-395`）は `rasterDimensions`（=textureEntry.dimensions=**padded**）を優先し、`renderWidth/renderHeight` に padded 寸法を採用。
   - **同関数コメント `:366-377` に本件が既知・de-scoped と明記**:
     「`original` display may show the content offset by the padding (content-space UV sampled against a padded raster under CLAMP_TO_EDGE). That offset is design §5.5-de-scoped — atlasRuntime is the canonical preview…」
   - `CanvasRenderableDrawable` は `contentInset` を保持していない（UV 補正の材料が下流へ渡っていない）。
6. **描画メッシュ/テクスチャ生成**: `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`。
   - テクスチャソースは **per-drawable の padded ラスタ**そのもの: `width: drawable.renderWidth, height: drawable.renderHeight, bytes: drawable.renderBytes`（`:173-178`）。アトラスページ合成は使っていない。
   - 空メッシュ時は `createBoundsQuadRenderMesh`（`:139-164`）: バウンズ矩形に UV **0..1** を割り当て（`:153-158`）。
   - グリッド/輪郭メッシュでも UV は **コンテンツ空間 0..1**（`mesh-generation.ts:988-997` の grid UV = `column/cells` 等）。
   - UV 空間は `DEFAULT_RENDER_UV_SPACE = "layer-local-top-left-0-1-v1"`（`packages/render-core/src/render-scene.ts:76`）。
7. **アトラス側の正しい扱い（対比）**: `packages/authoring-core/src/texture-atlas-packing.ts:544-587`。アトラスでは `uvRect` を **contentInset ぶん内側のコンテンツ副矩形**にして、レイヤーローカル UV 0/1 をコンテンツ端へ写す。つまり contentInset ブリッジの正しい実装は既にアトラス側に存在する。**エディタのライブキャンバス経路にはこの remap が無い。**

→ すなわち「padded ラスタ」＋「コンテンツ UV 0..1」＋「contentInset 未適用」がライブキャンバス経路に同居している。

---

## 2. 実験結果（実 PSD 解析）

対象: `C:\workspace\remie\code\vtuber\Claudeちゃん\全身.psd`（読み取り専用で解析、リポジトリには何も追加していない）。
スクリプト（scratchpad）:
- `analyze-psd.mjs`（レイヤーツリー全ダンプ + P と H1 縁 inset 量の算出）
- `probe-mask.mjs`（maskData 構造と実マスク有無の確認）
実行: `apps/editor/node_modules/@webtoon/psd/dist/index.js` を直接 import（Node v22, ESM）。

### 2.1 キャンバス/ツリー概要
- キャンバス: `2048 × 3072`、バイト長 `12,515,897`。
- グループ 12、レイヤー 38。可視（effHidden=false）レイヤー 25/38。

### 2.2 H1 定量（縁が内側へ寄る量 ≈ `w·P/(w+2P)` px）
`P = ceil(clamp(0.012×longEdge,4,16)+1)`。観測レイヤーの実測値（抜粋）:

| レイヤー | box(w×h) | P | X縁inset(px) | Y縁inset(px) |
|---|---|---|---|---|
| 表情/通常/eyewhite-l | 66×46 | 5 | 4.34 | 4.11 |
| 表情/通常/irides-r | 46×47 | 5 | ~4.1 | ~4.1 |
| 表情/通常/eyelash-r | 95×58 | 5 | 4.52 | 4.26 |
| face/face | 267×320 | 5 | ~4.8 | ~4.8 |
| back_face_parts/neck_back(=首裏) | 222×80 | 5 | 4.8 | 3.6 |
| ware/topwear(=上衣/襟の主要部) | 818×1964 | **17** | **~16.3** | ~16.3 |
| ware/handwear-l/-r | ~405×1067 | 14 | ~13 | ~13 |
| back hair | 1100×1245 | 16 | ~15 | ~15 |
| front hair | 510×884 | 12 | ~11 | ~11 |
| static_bottoms/legwear | 461×1222 | 16 | ~15 | ~15 |

縁 inset 分布（38レイヤー）: min 1.43 / p25 4.12 / median 4.45 / p75 4.78 / **max 16.32** px。

**解釈**:
- 目周り（`表情/通常/*`, `face/*`）は P=5 で各パーツが約4px 中心方向へ縮む。目は小パーツ複数がそれぞれ自中心へ縮むため、集合として「位置が微妙に違う」に一致。
- 首裏の襟: `neck_back`(P=5,約4px) と、それに隣接する大面積の `topwear`(P=**17**,約16px) が **異なる量**でズレる。襟境界で相対ズレが最大化し、「首裏の服の位置が微妙に違う」に一致。
- P がパーツサイズで 5〜17px と変わるため、隣接パーツ間の相対ズレが症状の本質。全体（重心）はほぼ保たれる（中心対称の縮小のため）。

### 2.3 H2（マスク実在性）
`probe-mask.mjs` で `neck_back / topwear / face / eyewhite-l / irides-l` 等を精査:
- すべて `maskData.realData = undefined`、`userMask() = undefined`（実マスク画素なし）。
- `maskData` の `left/bottom/right` は巨大な不定値で、有効なマスク矩形ではない（既定/空のマスクパラメータブロックが非 null で存在するのみ）。
→ 実マスクは無い。`composite(false,false)` の非マスク抽出は PS 表示と一致し、余分な画素は出ない。

### 2.4 H3（可視性）
- `表情/半目`・`表情/閉じ目` グループは `hidden=true` → 子は effHidden=true（非表示）。
- `表情/通常` は表示。口は `mouth_a` のみ表示、`mouth_i/u/e/o/mouth` は hidden。
→ 変性（バリアント）レイヤーの取捨は PS 既定と一致。誤ったバリアントは表示されない。

### 2.5 H4（座標整合）
- 生レイヤーレコードの `left/top` は部位ごとに整合（目パーツは x≈890–1126,y≈279–338 に集中、衣類は胴体域に展開）。
- @webtoon/psd の `left/top` は `layerFrame.layerProperties` 由来の絶対座標。PSD は保存時にグループ移動を各子レイヤーの絶対座標へ焼き込むため、未適用のグループ変換は存在しない。
→ 座標は正しい。

---

## 3. 仮説判定サマリ

| 仮説 | 判定 | 根拠 |
|---|---|---|
| **H1** contentInset ブリッジ取りこぼし | **確定（根本原因）** | ライブキャンバス経路が padded ラスタを content UV 0..1 で描画し contentInset 未適用（§1-5,6）。実 PSD で縁 inset 4〜16px、P がパーツ依存で相対ズレ（§2.2）。症状と一致。コード上 de-scoped と明記。 |
| **H2** レイヤーマスク未適用 | **棄却** | 実マスク画素なし（`realData`/`userMask()` すべて undefined、§2.3）。 |
| **H3** 可視性/変性レイヤー誤り | **棄却** | hidden 伝播正常、表示は通常目+mouth_a のみで PS 既定一致（§2.4）。 |
| **H4** グループ移動の非反映 | **棄却** | `left/top` は整合した絶対座標、未適用変換なし（§2.5）。座標は正しく描画側が誤り。 |

---

## 4. 修正候補箇所と方針案（実装はしない）

**方針**: エディタのライブキャンバス経路でも、アトラス側（`texture-atlas-packing.ts:544-587`）と同じく contentInset を UV に反映し、コンテンツ UV 0..1 を padded ラスタの**コンテンツ副矩形** `[inset, dim-inset]` へ写す。remap 式（アトラスの `contentUvRect` と同型）:

```
u' = (insetLeft + u * contentW) / paddedW      # contentW = paddedW - insetLeft - insetRight
v' = (insetTop  + v * contentH) / paddedH       # contentH = paddedH - insetTop  - insetBottom
```

**候補箇所（file:line）**:
- `apps/editor/src/workspace/canvas/canvas-projection.ts:232-238, 360-395`
  `textureEntry.contentInset` を読み、`CanvasRenderableDrawable` に `contentInset`(+ padded `dimensions`)を持たせる（現状 contentInset が下流へ渡っていない）。
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:75-93, 139-164`
  `createRenderMeshForDrawable` / `createBoundsQuadRenderMesh` の UV を、上式で padded ラスタのコンテンツ副矩形へ remap する。空メッシュ(bounds quad)・grid・輪郭メッシュのいずれの content UV にも一様に適用可能。
- 代替案（非推奨）: `original` プレビュー専用に padded 枠を切り落としたラスタを別途生成して描画。ただし輪郭メッシュの covering-margin overshoot が透明域へ逃げる利点を失うため、UV remap の方が既存設計と整合。

**スコープ注意（Undine 判断事項）**: この offset は `canvas-projection.ts:366-377` で「§5.5 de-scoped、atlasRuntime が canonical preview」と明記されている。しかし**現状のライブキャンバスは atlasRuntime 経路を持たず、per-texture original 経路のみ**（§1-6、`canvas-evaluation.ts`/`canvas-render-scene-adapter.ts` に atlas 合成・UV remap なし）。したがって「canonical な atlasRuntime が別にあるから編集画面は無視してよい」という前提が現実装と食い違う。編集画面を正とするか、atlasRuntime プレビューを編集画面へ導入するかは設計判断。

---

## 5. 未決事項 / 次の一手

- **未決**: 「atlasRuntime が canonical preview」という設計前提（§5.5）を、編集キャンバスに実際に適用する計画があるか。無いなら original 経路への contentInset UV remap が最小修正。
- **未決**: 縁 inset の許容量。P=5（目）の約4px は軽微だが、P=17（上衣/襟）の約16px は明確に視認され得る。修正優先度は大 P レイヤー(衣類・髪)で高い。
- **次の一手（検証の詰め）**: 修正前後の画素差分での確定確認。scratchpad に
  (a) `psd.composite()` 相当の埋め込み合成、(b) 現行 adapter 手順（composite(false,false)+padding+content UV 0..1 描画）の再構成、(c) contentInset remap 適用版、の3画像を出力し差分を取ると、ズレの局在と修正効果を目視で確定できる（本調査では機序と定量で確定済みのため未実施）。
- **参考テスト**: `apps/editor/src/workspace/canvas/canvas-projection.test.ts`, `packages/package-format/src/texture-content-inset.test.ts`, `packages/authoring-core/src/texture-atlas-transparent-gutter.test.ts` が contentInset の期待仕様を持つ。修正時の回帰基準。

---

## 付録: 参照した scratchpad 成果物（リポジトリ外）

- `…/scratchpad/analyze-psd.mjs` — レイヤーツリー全ダンプ + P/inset 算出。
- `…/scratchpad/probe-mask.mjs` — maskData 構造・実マスク有無の確認。

（PSD および抽出画像はプライベート素材。リポジトリには一切追加していない。）
