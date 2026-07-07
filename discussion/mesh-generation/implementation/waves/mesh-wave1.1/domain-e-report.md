# Domain E Report — v7 境界パディング + 密度再調整

> Domain id: `mesh-wave1_1-v7-padding-density`
> 実装: Gnome(opus) / 委任元: Orch-Sylph → Undine(L0)
> 日付: 2026-07-07
> 結果: 完了(全 gate 満たす。escalate なし)

## 1. 実装サマリ

評価往復1で確定した欠陥2件を単一ドメインで修正した。

### 修正1: 境界非クランプ(仮想パディング)

v7 パイプラインの全ピクセル空間工程(二値化 → soft blur → dilation → 連結成分 → 輪郭追跡 → Douglas-Peucker → 再サンプル → chamfer 距離変換 → 内部点サンプリング → CDT → Lloyd)を、元テクスチャを全周 `pad` ピクセル拡張した仮想キャンバス(`paddedWidth × paddedHeight`、余白=透明)上で実行するように変更した。膨張マスクが元テクスチャ端で切り立たず、余白へ広がれるようになったため、輪郭がキャンバス端の直線に張り付く欠陥が解消される。

処理後、出力座標(輪郭点・内部点・全頂点・`alphaBoundsPixels`)を pad オフセットだけ差し引いて元テクスチャ座標系へ unpad する。pad 領域に出た頂点は unpad 後に負値や `width/height` 超過となるが、これは「被覆マージンがテクスチャ端の外へ広がった」正しい状態。

- **ステージ座標写像**: `mesh-generation-v7-margin-contour.ts` の `mapPixelPointToStagePoint`(`bounds.x + bounds.width*(pixel/textureWidth)`)は既に線形で、負値/超過ピクセルを元 bounds 外のステージ座標へ自然に写す。写像式そのものは無改修(pipeline が unpad 済み座標を渡す構造にした)。
- **bounds 拡張**: `unionStageAlphaBounds` は各島の pixel bounds を min/max 合成するのみで、pad 領域に出た bounds を包含する形で元 drawable bounds の外へ自然に拡張する。**v6d の `unpadVirtualPixelBounds`(元 bounds へ clamp して戻す)は踏襲していない**(これが v6d との決定的相違点。v7 契約どおり bounds は外へ広げる)。
- **UV**: `mapPixelPointToUv` は従来どおり `clamp(pixel/textureSize, 0, 1)`。pad 領域に出た頂点(unpad 後 pixel<0 や >width)は UV が自然に 0 or 1 へ張り付く。無改修。

### 修正2: 密度定数の更新

`V7_VERTEX_SPACING_PIXELS` を `{ high: 12, medium: 18, low: 28 }` → **`{ high: 28, medium: 42, low: 64 }`** に変更。high<medium<low(密→粗)の単調性は不変。r・ε の導出式(`r=clamp(0.012×最大辺,4,16)`、`ε=0.8r`)は据え置き。JSDoc の根拠コメントを新値へ更新し、**「評価往復1でユーザー確定(2026-07-07)」の出典を明記**した。

## 2. pad の実効値の根拠

`pad = ⌈r + soft-mask growth⌉`。

- **r**(`marginRadiusPixels`): `deriveV7Parameters` で `Math.round(clamp(0.012×最大辺, 4, 16))` により**既に整数**。
- **soft-mask growth = 2px**: `createSoftAlphaMask`(`mesh-geometry/alpha-mask.ts`)を精読して特定した実効ぼかし/成長半径。二値化前に不透明領域が dilation 半径 r とは別に外側へ広がりうる分:
  - `blurAlphaAt`: 3×3 加重平均(`dx,dy ∈ [-1,1]`)。**カーネル半径 = 1px**。soft alpha 閾値(0.18)により、真の不透明境界の 1px 外の背景ピクセルが on になりうる。
  - `closeSinglePixelCracks`: 3×3 近傍(5個以上の不透明隣接で穴埋め)。**さらに最大 1px** 成長しうる。
  - `removeIsolatedAlphaNoise` は縮小方向なので成長には寄与しない。
  - よって dilation 前の pre-spread の安全側上限を **2px** とした(定数 `V7_SOFT_MASK_GROWTH_PIXELS = 2`)。
- 実装: `deriveV7VirtualPaddingPixels(marginRadiusPixels) = Math.ceil(marginRadiusPixels + 2)`。r が整数のため ⌈⌉ は実質恒等だが、設計意図と堅牢性のため `Math.ceil` を残置。
- **実測**: 200px 長辺のテクスチャで r=4(下限クランプ)→ **pad=6**。輪郭が元 bounds の外(x=-5, y=-5 等)へ確実に出ることをテストで確認。pad(6) > r(4) を検証するアサートも追加(膨張マスクが pad 端で切り立たない余裕を担保)。

## 3. 変更ファイル一覧

- `packages/authoring-core/src/mesh-generation-v7-parameters.ts`
  - `V7_VERTEX_SPACING_PIXELS` を 28/42/64 へ更新 + 出典コメント
  - `V7_SOFT_MASK_GROWTH_PIXELS = 2`(新)+ `deriveV7VirtualPaddingPixels`(新、pad 導出関数)を追加
- `packages/authoring-core/src/mesh-generation-v7-pipeline.ts`
  - `createPaddedRgba` を import、pad 導出 → 全工程を padded 座標系で実行、出力を unpad
  - `V7PipelineDiagnostics` に `virtualPaddingPixels` を追加(観測用)
  - unpad ヘルパ 3種(`unpadPixelPoint` / `unpadPixelPointWithRole` / `unpadPixelBounds`)を追加
- `packages/authoring-core/src/mesh-geometry/alpha-mask.ts`
  - **追加のみ**: `PaddedRgba` 型 + `createPaddedRgba`(全周ゼロ埋め RGBA 生成の中立ヘルパ)。既存関数のシグネチャ・数値挙動は一切不変(v6 バイト同一ゲート維持)
- `packages/authoring-core/src/mesh-generation-v7-margin-contour.test.ts`
  - 既存の L 期待値を新値へ更新 + gate テスト7件を追加(下記)
- `discussion/mesh-generation/implementation/waves/mesh-wave1.1/domain-e-report.md`(本ファイル)

`mesh-generation-v7-margin-contour.ts` は**無改修**(pipeline が unpad 済み座標を返す設計にしたため、写像層の変更不要)。

## 4. 追加/更新したテスト一覧と意図

`mesh-generation-v7-margin-contour.test.ts`(16件 → 23件、+7件)。

### 境界非クランプ(核) — describe "v7 boundary non-clamp"(200×160 全ブリード矩形)

- **(a) `pushes outline vertices OUTSIDE the original bounds`**: 輪郭頂点の過半数が元 bounds 外、かつ輪郭の bbox が四辺すべてで元キャンバスを厳密に超える(minX<0, minY<0, maxX>width, maxY>height)ことをアサート。**クランプ下では原理的にゼロ**なので、修正の効果を直接証明する。
- **(b) `removes the border-line vertex wall`**: 各元エッジ線(x=0/x=width/y=0/y=height)上の頂点数が `< 3` であることをアサート。クランプ下では全ブリード側が丸ごとエッジ線に乗り ⌈辺長/L⌉≈5個の壁ができるが、パディング下では輪郭が軸を横切る孤立点(≤2)のみ残る。**張り付き(壁)の消失を定量的に検証**。
- **(c) `still covers every opaque pixel`**: 端接触形状で被覆保証(全不透明ピクセルが三角形内)を維持。`assertEveryOpaquePixelCovered` の全走査。
- **`runs under pad = ceil(r + soft-mask growth)`**: `diagnostics.virtualPaddingPixels === Math.ceil(r + 2)` かつ pad > r を検証。

**「修正前は再現、修正後は消える」の実証**: pad 導出を一時的に `0` に上書きして全 v7 スイートを実行 → **(a)・(b)・pad値・bounds拡張の4件が fail、(c) coverage は pass** することを確認した(coverage はクランプ下でも成立するのが正しい)。その後 pad を復旧。これらのテストが旧欠陥を確かに捕捉することを担保している。

### bounds 拡張の整合 — describe "v7 bounds expansion"

- **`expands the MeshDto alpha bounds outside ... and encloses every vertex`**: 全ブリード形状で、(i) 少なくとも1頂点が元 drawable bounds 矩形の外にある、(ii) `alphaBounds` が元 bounds の外へ拡張されている(clamp で戻していない = v6d との決定的相違)、(iii) 全頂点が拡張後 `alphaBounds` に包含される(pad 補正の内部整合)。
- **`keeps UVs clamped to [0,1] even for vertices pushed outside`**: pad 外頂点でも UV∈[0,1]、かつ全ブリードで UV の端値 0/1 が現れることを検証。

### 密度整合と単調性 — describe "v7 boundary spacing tracks L"

- **`has a median boundary spacing near each preset L, monotone across presets`**: 半径80の円(200×200)で、輪郭頂点の連続間隔の中央値が各プリセット L の `[0.5L, 1.2L]` 帯に入り、high<medium<low の単調性を保つことを検証。新 L(28/42/64)を実測間隔で確認する。

### 更新した既存テスト

- `moves only L across presets`: `V7_VERTEX_SPACING_PIXELS` の期待値を `{high:28, medium:42, low:64}` へ更新(意味論・単調性アサートは不変)。

**意味論の緩和なし**: 被覆保証(全走査)・決定性・UV∈[0,1]・零面積なし・多島・穴埋めの既存アサート強度は一切落としていない。

## 5. 全テスト結果

| 対象 | 件数 | 結果 |
|---|---|---|
| v7 テスト(`mesh-generation-v7-margin-contour.test.ts`) | 23 | **全 pass**(16既存 + 7新規) |
| authoring-core 全体(35ファイル) | 283 | **全 pass** |
| うち v6 回帰(`mesh-generation.test.ts`、v6a〜v6f 決定性・境界・多島含む) | 76 | **全 pass** |
| mesh-geometry smoke | 12 | **全 pass**(alpha-mask 追加変更が v6 中立部品を壊していない) |

- typecheck(`tsc --noEmit`、リポジトリ全体): **pass**(exit 0)
- `check:source`(`node scripts/check-source-organization.mjs`): **pass**（Source organization guard passed）
- `check:deps`(`node scripts/check-dependencies.mjs`): **pass**（Dependency guard passed）

コミット・`pnpm install`・依存変更はしていない(統制点を尊重)。

## 6. 裁量判断(設計未定義だが合理的に決めた点)

1. **soft-mask growth = 2px**: concept-design §2-1 の pad 式「⌈r + ぼかし半径⌉」の「ぼかし半径」を、`createSoftAlphaMask` の実装から `blurAlphaAt`(半径1)+ `closeSinglePixelCracks`(1)= 2px と解釈した。安全側の上限。named constant `V7_SOFT_MASK_GROWTH_PIXELS` として単一箇所に根拠付きで定義。
2. **pad を pipeline 内部に閉じ、unpad して返す設計**: pad の張り方(仮想 RGBA)と unpad(座標補正)を `runV7MarginContourPipeline` に閉じ込め、`mesh-generation-v7-margin-contour.ts`(写像層)は無改修とした。v6d は写像層で unpad+clamp するが、v7 は clamp しないため写像層を触らない方が意味論が明快で、既存の線形写像(bounds 外へ自然に伸びる)がそのまま活きる。
3. **`createPaddedRgba` を alpha-mask.ts に追加**: pad 付き RGBA 生成は二値化前段の中立操作であり、alpha-mask モジュール(二値化の入口)に置くのが自然と判断。v6d の `createAdaptiveContourVirtualInput` を構造の参考にしたが、v6 ファイルは import せず v7 側/中立モジュールに自前実装(pad 量固定4pxではなく r 由来、bounds clamp なし)。
4. **`virtualPaddingPixels` を diagnostics に追加**: 観測・テスト用。preview スキーマには触れない(provenance-only 方針を維持)。
5. **(b) の壁閾値 = 3**: 実測でパディング下は各エッジ線 ≤2、クランプ下は最小でも ≈4(160px辺/L=42)。両レジームを明確に分離する `<3` を採用。

## 7. 質問(呼び出し元/ユーザー判断が要る点)

なし(設計オラクルで全論点が確定していた)。念のため確認事項として1点:

- **soft-mask growth の値(2px)**は上記 §2 の解釈に基づく裁量。もし将来 `createSoftAlphaMask` のカーネルを拡大する等の変更が入れば `V7_SOFT_MASK_GROWTH_PIXELS` の見直しが必要になる(single-site edit で対応可)。現行実装では 2px で十分な余裕(pad>r を担保)。

## 8. escalate / 環境問題

- **escalate**: なし。「bounds 外拡張を reject する消費側構造」は探索したが発見せず(`boundsOutOf|vertexOutOfBounds|outsideBounds` 等の grep でヒットなし)。pre-wave-inventory §2/§4 の記述(レンダラ・previewMesh 検証・validator は bounds 外頂点を許容、UV[0,1]外のみ error)と矛盾する新構造は見つからなかった。UV は 0..1 クランプを厳守しているため validator の `mesh.uvCoordinateOutOfBounds` にも抵触しない。
- **環境問題**: なし。既存 node_modules で全コマンドが動作。`pnpm install` 不要。
