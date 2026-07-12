# Boundary Transparent Margin Design (A1)

> Draft design basis。輪郭メッシュが drawable 境界外へ延ばした頂点付近で「テクスチャが拡大されたようににじむ」問題を、覆いマージンを透明化することで根絶する設計。
>
> 親契約: [mesh-image-rendering-architecture.md](mesh-image-rendering-architecture.md) の Rendering Contract「半透明境界のにじみが出ない」の具体化。§9 Alpha/Blend Policy の「端texel extrude」を覆いマージンについて上書きする。
> 機構の実装先: texture gutter は [../texture-atlas/_map.md](../texture-atlas/_map.md)、UV非クランプは [../mesh-generation/_map.md](../mesh-generation/_map.md)。

## Status

- Status: **Implemented (Wave108, 2026-07-10)** — Option E で全ドメイン実装完了・clean review PASS・権威検証 green（typecheck / packages 全 vitest / check:deps / check:source）。コミットは未実施（wave gate ＝ユーザー統制点）。
- Coordinator: Undine
- 決定はユーザー合意済み。本設計を basis に Wave108（A-F）を実行し統合完了。実装証跡: `discussion/implementation/waves/wave108/wave108-final-integration-report.md`。
- **残ユーザー gate（wave 外）**: 凍結 `mouth_u`（`C:\workspace\remie\rigging\second-rigging-opus\workspace`）を editor `atlasRuntime` モードで目視 ― 境界の拡大にじみ消失・覆いマージン透明・クロス滲み無し・LINEAR の端 AA 自然。この実機目視のみ未完（自動検証は全 green）。
- 凍結再現ケース: `C:\workspace\remie\rigging\second-rigging-opus\workspace` の drawable `mouth_u`（自由に使用可）。

## 1. 症状（リポジトリ事実 + 実験結果）

- apps/editor で、荒い輪郭メッシュを drawable に当てると、drawable 境界付近の一部三角形だけ「テクスチャが拡大されたように」崩れて見える（にじむ）。
- メッシュ形状依存。輪郭がテクスチャ内に収まる「合致」メッシュではほぼ出ない。小さいパーツで面積比により顕著。
- mesh overlay（ワイヤー）を消しても残る＝テクスチャ層の問題。
- 実測（凍結ケース `mouth_u` のメッシュ検屍）: 全16頂点が `contour_boundary`・内部頂点0、`bounds` は `x:992..1009, y:519..535`（17×16px）。**10/16 頂点が bounds の外**にあり、その UV は全て `[0,1]` にクランプされていた。生成式は `UV = clamp((vertex - bounds)/size, 0, 1)`、一方 stage 頂点はクランプ無し。

## 2. 原因（設計判断の根拠）

覆いマージンの構造上の必然と、生成側の非対称クランプが噛み合って生じる。

- メッシュ生成は元 drawable を「覆う」ため、境界頂点を drawable/テクスチャ境界の**外**へ延ばす（覆いマージン）。これは意図的で、変形時に絵の端が欠けない保険。
- 生成側の座標写像が非対称:
  - stage 頂点: `bounds.origin + bounds.size*(pixel/textureSize)` — **クランプ無し**（外へ正しく延びる）。
  - UV: `clamp(pixel/textureSize, 0, 1)` — **[0,1] にクランプ**（テクスチャ端にピン留め）。
- テクスチャサンプリングが `CLAMP_TO_EDGE`。よって、はみ出し頂点と内側頂点を結ぶ三角形は、stage 上は数px幅あるのに UV 幅がほぼ0（端にピン留め）になり、**真のテクスチャ端が overshoot 頂点まで引き伸ばされる＝絵の中身が拡大**する。これが観測される崩れ。
- 「合致すれば出ない」の説明: 輪郭頂点が bounds 上に乗るとクランプが no-op になり伸びない。

### 検討して却下した代替（A2）

フラグメントシェーダで UV が [0,1] 外なら alpha=0 にする案（A2）は却下。理由:
- 交換物（mesh + texture）の正しさを、全消費者（editor / export / runtime / 将来の別バックエンド）が同一の描画規約を実装し続ける前提に**外注**することになる。
- premultiplied + LINEAR での端フィルタリングが native に正しくならず、シェーダで傾斜を捏造する必要が出る。
- 正しさはデータに焼くべき（A1）。これは商用 Live2D パイプラインの標準構造（メッシュは絵の外の透明テクスチャ余白に座る）とも一致する。

## 3. 構造制約（リポジトリ事実 / 三体調査の統合）

A1 を「表示だけの修正」で済ませられない理由。実装は以下を必ず踏まえる。

### 3.1 `bounds ≡ raster` 同一視
- stage 空間の `bounds` と ラスタ画素 `width/height` を「同じ矩形の別単位」とみなす暗黙契約がコード全体を貫く。
- per-texture タイルへ透明パディングを入れて raster を拡げると raster ≠ content bounds になり、この同一視が破れる。波及: `resolveDrawableRenderDimensions`（`apps/editor/src/workspace/canvas/canvas-projection.ts:354-369`）、`isRenderableDrawable`（同`:629-640`, byteLength 検証）、atlas targets（`packages/authoring-core/src/texture-atlas-targets.ts:354-372`）等。
- 対策方向: アーキ文書 §8.3 の意図通り、透明パディングを **Texture Preparation / Allocation 層**に閉じ込め、content bounds（stage）は content のまま保ち、両者を繋ぐ **content-inset（gutter量）** を graph/evidence 上で運ぶ。

### 3.2 runtime/export はアトラス専用
- runtime/export は**常にアトラス1ページ**を描く（per-texture ではない）。`assertRuntimeExportV0SinglePageArtifacts`。
- メッシュ UV は永続 MeshDto の layer-local UV を、export 時に atlas 座標へ再materialize する（`packages/authoring-core/src/runtime-export-materialization.ts:174, 552-571`、`uvSpace: "atlas-normalized-v1"`）。
- editor と runtime は**同一レンダラ** `packages/render-webgl2`（texParameter は `webgl2-textures.ts:41-44` の1箇所、`CLAMP_TO_EDGE` + `NEAREST`）。`packages/render-software/src/raster/texture-sampler.ts` が第三のパリティ実装。
- **UV の範囲検証は存在しない**（`packages/package-format/src/runtime-export.ts:346` の `atlasUvs` は範囲制約なし）。per-texture 経路は `CLAMP_TO_EDGE` が事実上の安全網。

### 3.3 消費経路は二つ、単一 UV ソース
- 単一の真実源 = 永続 MeshDto の layer-local UV。
- (a) editor `original`（per-texture）: 素のタイルを直サンプル。**にじみを観測している経路**。
- (b) editor `atlasRuntime` + export + runtime: UV を atlas へ写像。**runtime は常にこちら**。

### 3.4 既存 gutter は不透明 edge-extrude（A1 と逆）
- アトラスは既に `paddingPixels`（既定4）+ `edgeExtrusion`（端画素を外へ複製 = 不透明）を持つ（`packages/authoring-core/src/texture-atlas-packing.ts:137-153`、`texture-atlas-binary.ts:120-163`）。
- これはアーキ文書 §9 の推奨に由来。A1 は覆いマージンについてこれを**透明**へ上書きする（§6 の決定参照）。

## 4. 危険（実装が必ず回避すべき罠）

**UVクランプを単独で外すと runtime だけ別の壊れ方をする。** クランプを外した layer-local UV は、per-texture 経路(a)では `CLAMP_TO_EDGE` が受けて editor プレビューは正常に見える。しかし同じ UV が atlas 経路(b)へ写像されると、content 矩形+gutter を越えて**隣接 placement のピクセルを拾う＝レイヤー間クロス滲み**。弾く検証は無い。→ **クランプ廃止は「透明gutterを overshoot 以上に確保」と必ず同時**に行う。

## 5. あるべき機構（設計判断）

アーキ文書 §6/§8 の枠に沿って、正しさをデータ（mesh 幾何 + texture）に焼く。

1. **生成（mesh-generation）**: UV クランプを廃止し、layer-local UV が覆いマージン分だけ `[0,1]` を素直にはみ出すことを許容する。**mesh データを padded 座標へ作り替えない**（layer-local UV = 純粋な幾何のまま）。
2. **Texture Preparation（Normalized Texture Source, §8.2）**: layer raster の外周に**透明**な alpha-edge padding を持たせる。premultiplied なので透明画素 `(0,0,0,0)` は正しく生成され、bilinear で暗い fringe を出さない。
3. **Render Texture Allocation / Atlas（texture-atlas, §8.3/§9）**: gutter を**透明**にし（覆いマージンについて §9 の edge-extrude を上書き）、幅を**縛った r 以上**に確保する。layer-local → physical UV 変換が、はみ出し UV を透明gutter へ写す。gutter が overshoot 以上である限り、クロス滲みは起きない。
4. **レンダラ（render-webgl2 + render-software）**: `MAG_FILTER` / `MIN_FILTER` を `NEAREST` → `LINEAR` に戻す。透明gutter が入れば LINEAR が安全になり、エッジの真の AA が得られる。既存の `renderAssumptions.textureFiltering="linear-v1"` 宣言（`runtime-export-materialization.ts:626`）と実装の食い違いも解消する。
5. **`original` プレビュー**: per-texture タイルへの padding（`bounds≡raster` 破壊の重い工事）は**やらない**。ただし表示上は、`original` も **content-inset UV remap** で内容位置を正とする（Mesh Wave 1.2 F, 2026-07-12）。描画時に content 空間 UV 0..1 を padded ラスタの content 副矩形 `[inset, dim-inset]` へアフィン写像するため、パディング枠は見た目から消え、content が `bounds` に整合する（`u' = (insetLeft + u·contentW)/paddedW` 系、アトラス `uvRect` と同型・非クランプ）。はみ出し（覆いマージン overshoot）はパディングの透明域へ落ち、A1 の透明マージンが保存される。`atlasRuntime` は依然として export = runtime 一致検証の正典プレビュー（「見る絵 = ship する絵」）であり、その地位は本 remap で不変。

### 覆いマージン幅契約（Option E: サイズ別パディング。2026-07-09 決定で「K=4 固定・r 束縛」を上書き）
- 外へ頂点を出す稼働生成器: v6d-adaptive-contour（既定, 外向き ≈3px 固定）、v7-margin-contour（`r = clamp(0.012×長辺, 4, 16)` + blur ≈ 実効上限17px, 長辺比例）。他は0px。
- **生成側の r は束縛しない**（v6d・v7 とも自然な値のまま。v7 の将来性・調整中を尊重し、芽を摘まない）。
- **透明パディングを層サイズの関数で焼く**: `padding(layerSize) = ceil(maxOvershoot(layerSize))`。`maxOvershoot` は全方式の最大はみ出しを層サイズで包む上界式（v7 の r 式が上界、v6d は常に内側）。authoring-core が正準関数を持つ（旧 `COVERAGE_MARGIN_MAX_SOURCE_PIXELS` 定数を関数へ一般化）。単位はソース・テクスチャ画素。texprep が import。
- import 時（層サイズ既知）に焼くため方式非依存・再bake不要。**利用前提「メッシュは生成後ほぼ不変」**ゆえサイズ推定で十分。将来方式も `r ≤ maxOvershoot(size)` なら自動でカバー。
- パディングはタイルのラスタに焼き込まれ per-tile `content-inset`（四辺形）で運ばれる。atlas は混在サイズを詰めるだけで、可変gutter専用パッキングは不要。gutter は per-tile content-inset を placement スケールで換算して整合。

## 6. 三者一貫（受け入れの必要条件）

A1 は export 不可侵層（アトラスの bytes/digest/dimensions と materialize 済み UV）を動かす。**再export必須**。以下が同一の約束で描けること:

- editor `atlasRuntime` プレビュー = export = runtime（同一 render-webgl2 + 透明gutter atlas + 非クランプ layer-local UV の atlas 写像）。
- 検証は必ず **editor `atlasRuntime` モード**で行う（runtime 一致の必要条件）。`original` モードだけの確認では runtime の破綻を見逃す（§4）。

## 7. 影響範囲（実装 touch points / wave domain の種）

ドメイン別。write scope はパッケージ境界で概ね割れる。

### D-gen: 生成 UV 非クランプ + r 束縛（`packages/authoring-core`）
- `mesh-generation-v6-contour-pipeline.ts:254-261`（共有 `mapV6ContourPointToUv`, v6d 系が使用）。
- `mesh-generation-v6d-adaptive-contour-constrainautor.ts:1036-1048`（wrapper）, `:51-52`（r/padding 定数）。
- `mesh-generation-v7-margin-contour.ts:269-276`（v7 自前 UV）, `mesh-generation-v7-parameters.ts:163-169`（r clamp）。
- 非稼働 v6a/b/c 自前クランプは A1 必須対象外（整合を取るなら追加）。

### D-texprep: 透明パディング焼き込み + content-inset 伝播
- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`（`createLayerMaterializationEvidence` L296-372: raster padding, width/height/byteLength/digest 更新, content-inset 新フィールド）。
- `packages/operation-core/src/operations/import-psd-layer-materialization.ts`（L651-667 byteLength 検証, L1057-1066 resolveInitialBounds）。
- テクスチャ entry スキーマ（`packages/package-format/src/texture-atlas.ts`）へ raster寸法/inset を持たせるか。

### D-atlas: 透明 gutter（§9 上書き）+ bounds↔raster 分離
- `packages/authoring-core/src/texture-atlas-binary.ts:120-163`（`extrudeTexturePlacementEdges` を覆いマージンについて透明化）, `:96-118`。
- `packages/authoring-core/src/texture-atlas-packing.ts:137-153`（padding/gutter 幅を r 契約へ）, `:516-561`（placement/uvRect）。
- `packages/authoring-core/src/texture-atlas-targets.ts:354-372`（textureSize/byteLength を bounds 由来から raster 由来へ）。
- `apps/editor/src/workspace/viewer/viewer-render-source.ts:507-520`（`remapUvIntoPlacement`）。
- `apps/editor/src/workspace/canvas/canvas-projection.ts:354-369, 629-640`（render 寸法 / renderable 契約の bounds↔raster 分離）。

### D-render: LINEAR 化 + software パリティ
- `packages/render-webgl2/src/webgl2-textures.ts:41-44`（MIN/MAG → LINEAR。WRAP は据置で可）。
- `packages/render-software/src/raster/texture-sampler.ts`（パリティ同期）。
- `packages/authoring-core/src/runtime-export-materialization.ts:626`（`textureFiltering` 宣言整合の確認）。

### D-export: 再materialize 整合
- `packages/authoring-core/src/runtime-export-materialization.ts:174, 552-571`（layer-local はみ出し UV の atlas 写像が透明gutter へ入ること）。
- `packages/package-format/src/runtime-export.ts:346`（`atlasUvs` の範囲前提。必要なら検証追加を検討）。

## 8. 検証観点（設計 AC）

- 凍結ケース `mouth_u` を editor `atlasRuntime` モードで描き、境界三角形の拡大にじみが消えること。
- 覆いマージン領域が**透明**に描かれること（端色の引き伸ばしでない）。
- クロス滲み（隣接 placement のピクセル混入）が無いこと。特に overshoot 最大の v7、または r を縛った上限で確認。
- export → runtime で同一に再現（editor `atlasRuntime` と runtime が一致）。
- LINEAR 化後、高コントラスト細線パーツで端の AA が自然で、白線/黒fringe が出ないこと。
- 合致メッシュ（overshoot 無し）で退行が無いこと。

## 9. 未決事項（Wave108 で解決済み。残は実機 gate のみ）

- （解決済み 2026-07-09 Option E）覆いマージン幅は層サイズの関数 `maxOvershoot(layerSize)`（ソース画素、authoring-core 正準）。生成 r は束縛せず、パディングがそれを包む。v7 は対象に含め、r 束縛せず品質維持。**実装**: `maxCoverageMarginSourcePixels(longEdgePixels)` = `ceil(clamp(0.012·長辺,4,16)+blur1)`（`mesh-generation-coverage-margin.ts`、v7 の r 定数を単一真実源で再利用、index re-export、texprep が import）。
- （解決済み Wave108 D-atlas）atlas の gutter は per-tile content-inset を placement スケールで atlas 画素へ換算して整合。**実装**: atlas コピーは native 1:1（source 画素＝atlas 画素、scale 1）ゆえ換算は恒等。content-inset は placement の `uvRect`（content sub-rect）へ 1 箇所だけ畳み込み、editor remap = export materialize = runtime が同一 `uvRect` を線形消費（再 inset なし）。透明 gutter は padded raster の透明外縁を既存 edge-extrude がそのまま外へ複製することで**コード無改変**で成立（§9 の不透明 extrude を覆いマージンについて実質上書き）。
- （解決済み Wave108・許容判断）ハードクロップ端（不透明が raster 端まで）の ~1px 軟化は **許容**（LINEAR + 透明端、現状タイルは有機的 alpha 端が主で実害薄い）。実機で顕在化すれば final report / 本節へ追記する方針。
- （解決済み Wave108）`bounds≡raster` 分離で生じる各所の `Math.round` 整合は、padded raster（`textureEntry.dimensions`）基準へ統一して解消（`resolvePackedRasterSize`、`resolveDrawableRenderDimensions`、byteLength 検証を padded 同士で整合）。stage `bounds` は content のまま不変。
- （解決済み Wave108）実装 wave は global `discussion/implementation/waves/wave108` に配置。
- （残・ユーザー gate、wave 外）実機 `atlasRuntime` 目視（Status 参照）。**非ブロッキング申し送り**: `original` モードは per-texture render 寸法が padded raster になったため content が inset/縮小表示される（§5.5 想定より一段大きい表示変化）。正典 `atlasRuntime` は影響を受けず健全。実機で `original` の content ずれが混乱を招く場合のみ、`original` の UV を content-inset で remap する等のフォローアップを検討（要修正ではない）。

## 10. 参照

- 親契約: [mesh-image-rendering-architecture.md](mesh-image-rendering-architecture.md)（§4 Rendering Contract, §6 RenderScene Invariants, §8 Texture Preparation, §9 Alpha/Blend Policy）。
- 機構実装先マップ: [../texture-atlas/_map.md](../texture-atlas/_map.md), [../mesh-generation/_map.md](../mesh-generation/_map.md)。
- 決定性の二層分離（表示緩和可 / export 不可侵）は既存の render-performance トピックの方針と同じ緊張感で扱う。
