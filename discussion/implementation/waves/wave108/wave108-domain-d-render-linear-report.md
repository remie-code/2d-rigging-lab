# Wave108 Domain D `wave108-render-linear` 実装レポート

テクスチャフィルタを NEAREST → LINEAR（bilinear）へ変更。WebGL2 と software renderer を
同一の LINEAR + CLAMP_TO_EDGE 数理で定義し、premultiplied 空間補間による真の透明端 AA を実現した。

## 判定

完了。変更パッケージ（render-software / render-webgl2）のテスト全件パス、型チェック 0 エラー。
`textureFiltering="linear-v1"` 宣言と実装が本改修で一致した。

## 変更ファイル一覧

- `packages/render-webgl2/src/webgl2-textures.ts`
  - line 43-44: レイヤーソーステクスチャの `TEXTURE_MIN_FILTER` / `TEXTURE_MAG_FILTER` を
    `this.gl.NEAREST` → `this.gl.LINEAR` に変更。WRAP_S/T は CLAMP_TO_EDGE 据置。
- `packages/render-software/src/raster/texture-sampler.ts`
  - `sampleTextureNearest` を `sampleTextureLinear` に改名し、bilinear（4テクセル双線形補間）へ書き換え。
  - 補間ヘルパ `bilerpChannel` を追加。`prepareTexture` の premultiply/正規化ロジックと dim<=0 ガードは不変。
  - doc コメントを LINEAR 仕様へ更新（`prepareTexture` の `NEAREST` 記述含む）。
- `packages/render-software/src/raster/triangle-rasterizer.ts`
  - import と唯一の呼び出し元（旧 line 152）を `sampleTextureLinear` へ更新。関数 doc コメントを LINEAR 記述へ更新。
- `packages/render-software/src/software-renderer.ts`
  - line 58: `compositeScene` の doc コメント `NEAREST + CLAMP_TO_EDGE texture sampling` →
    `LINEAR (bilinear) + CLAMP_TO_EDGE texture sampling`（挙動無関係の doc 追随更新。レビュー指摘対応）。
- `packages/render-software/src/raster/texture-sampler.test.ts`
  - LINEAR 仕様へ全面更新。補間検証・透明端 AA 検証・dim<=0 ガード検証テストを追加。
- `packages/render-software/src/software-renderer.test.ts`
  - golden テスト名 `... NEAREST sampling ...` → `... LINEAR sampling ...`。golden バイトは不変
    （出力ピクセル中心が texel 中心に一致し LINEAR のフラクショナル重みが 0 になるため）。コメント追記のみ。
- `packages/render-software/src/test-support/scene-fixtures.ts`
  - `createFourColorTexture` の doc コメントを `NEAREST` → `LINEAR` に更新（挙動変更なし）。
- `packages/render-webgl2/src/webgl2-renderer.test.ts`
  - モック GL でソーステクスチャの MIN/MAG=LINEAR・WRAP=CLAMP_TO_EDGE を表明する新規テストを追加。

> 注: `git status` に現れる `authoring-core/src/mesh-generation-*` 等の変更は本タスク着手前からの
> 既存 WIP（mesh-autogen v6/v7）であり、本ドメインは一切触れていない。

## software LINEAR 数理

GL LINEAR + CLAMP_TO_EDGE、top-left UV 原点（RenderUvSpace `layer-local-top-left-0-1-v1`）に厳密準拠:

- 各軸のサンプル座標: `coord = uv * dim - 0.5`（texel 中心が整数インデックスに載る）
- `i0 = floor(coord)`, `i1 = i0 + 1`, `frac = coord - i0`
- **CLAMP_TO_EDGE**: `i0`, `i1` をそれぞれ `[0, dim-1]` にクランプ（既存 `clampInt` を流用）
- bilinear: x 方向で 2 テクセルを `frac` で lerp、y 方向で lerp（`bilerpChannel` を RGBA 各チャンネルに適用）
- 補間は **premultiplied 正規化 float 空間**で実施。`prepareTexture` の premultiply
  （straight は `round(c*a/255)` でバイト一致）と正規化は現状維持。
- `dim <= 0` は `{0,0,0,0}` を返すガードを維持。

premultiplied 空間補間のため、透明 padding `(0,0,0,0)` をまたぐと色が alpha と歩調を合わせて
透明側へ減衰し、暗い/白い fringe を出さない（straight 空間で補間する場合の未定義色の混入がない）。

## webgl2 変更点

- 変更は `webgl2-textures.ts:43-44`（レイヤーソーステクスチャ upload の texParameter）のみ。
- `webgl2-renderer.ts:168-171`（オフスクリーンのマスク/FBO target テクスチャ。既に LINEAR）は**未変更**。対象外として一切触れていない。
- WRAP=CLAMP_TO_EDGE 据置。

## `textureFiltering="linear-v1"` 宣言と実装の整合

- `packages/authoring-core/src/runtime-export-materialization.ts:626` は既に `textureFiltering: "linear-v1"` を宣言。
- 本改修で両レンダラの実装が LINEAR となり、これまでの「宣言 linear / 実装 NEAREST」の食い違いが解消。宣言と実装が一致した。
- 宣言側のコード変更は不要（背景どおり）。`runtime-export-assembly.test.ts`（16 tests）はパスし、宣言経路に無退行。

## 追加/変更したテスト

render-software `texture-sampler.test.ts`（計 7 件）:
- premultiply 一致 / premultiplied 源そのまま（既存を LINEAR API へ更新、単一テクセルは全近傍クランプで同値）
- texel 中心で厳密テクセル値を返す（LINEAR がテクセルに退化）
- **補間検証（新規）**: 2 テクセル中点 `uv=(0.5,0.25)` で red↔green の平均 `(0.5,0.5,0,1)`、
  2x2 中心 `uv=(0.5,0.5)` で 4 テクセル平均 `(0.5,0.5,0.5,1)`。フラクショナル補間が効いている証拠。
- CLAMP_TO_EDGE 境界（uv>=1, uv<0, uv=1.0）の LINEAR 挙動（両近傍がエッジテクセルへクランプ、wrap 漏れなし）
- **透明端 AA（新規）**: 2x1（opaque red + 透明 padding）中点で `a=0.5`, `r=0.5`, `r/a=1`。
  暗い fringe（r<a）も白い fringe（r>a）も出ないことを検証。
- **dim<=0 ガード（新規）**: 0 次元テクスチャで `{0,0,0,0}`。

render-software `software-renderer.test.ts`:
- golden テスト名を LINEAR へ修正、golden バイト不変（無退行）。

render-webgl2 `webgl2-renderer.test.ts`:
- **新規**: マスク無しレンダで MIN/MAG_FILTER=LINEAR、NEAREST 不使用、WRAP_S/T=CLAMP_TO_EDGE を表明。

## テスト実行コマンドと結果

- `npx vitest run packages/render-software packages/render-webgl2`
  → 8 ファイル / **47 tests 全 pass**。
- `npx vitest run packages/authoring-core`（影響範囲確認）
  → 283 中 280 pass、3 fail。**3 fail は全て mesh-generation 系（`mesh-generation.test.ts`,
    `mesh-generation-v7-margin-contour.test.ts`）で、本タスク着手前からの既存 WIP に起因**。
    render/materialization には無関係。`runtime-export-assembly.test.ts`（16 tests）はパス。
- `npx tsc --noEmit` → **0 error**（全ワークスペース）。
- lint: リポジトリに専用 lint スクリプトなし（root scripts は typecheck/test/check:deps/check:source）。

## パリティ（webgl2 ⇔ software 数理一致）の担保

- webgl2 テストは実 GPU 比較ではなくモック GL。したがってパリティは「両レンダラを同じ GL LINEAR
  数理で定義する」ことで担保。software renderer が数理の参照実装。
- software 側は GL LINEAR + CLAMP_TO_EDGE（coord=uv*dim-0.5 / floor+1 / clamp[0,dim-1] / frac 双線形）
  を厳密実装し、premultiplied 空間で補間。webgl2 側は同一の premultiplied upload
  （`createUploadBytes`）に対し GL_LINEAR + CLAMP_TO_EDGE を設定。両者が同一入力に同一数理を適用する。
- webgl2 テストは MIN/MAG=LINEAR・WRAP=CLAMP_TO_EDGE の設定を表明し、software テストは
  その数理の数値挙動を表明する（役割分担でパリティを担保）。

## 裁量判断（設計未定義を合理的に埋めた箇所）

- webgl2 パリティ表明テストは「マスク無しレンダ経路ではソーステクスチャ upload のみが
  MIN/MAG_FILTER を設定する」性質を利用し、`webgl2-renderer.test.ts` の既存モック GL 流儀で追加。
  `webgl2-textures.ts` 単体テストファイルは新設せず既存テスト構造に合わせた（FBO 経路の LINEAR と
  混同しないようマスク無しシーンを使用）。
- `dim<=0` ガードの明示テストを追加（既存挙動の固定化。仕様には明記されていないが回帰防止として妥当）。
- software golden テスト（four-color）はピクセル中心が texel 中心に一致し LINEAR で値不変のため、
  golden バイトを据え置き、テスト名とコメントのみ更新（背景の指示どおり）。

## 質問・不明点

なし。設計指示の範囲で完結。
（参考: authoring-core の mesh-generation 3 fail は既存 WIP 由来で本ドメイン外。必要なら別途対応。）
