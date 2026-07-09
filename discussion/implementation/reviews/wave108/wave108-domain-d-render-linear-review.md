# Wave108 Domain D `wave108-render-linear` レビュー

- ループ番号: 1
- レビュー担当: Review-Sylph（Orch-Sylph からの委任）
- 判定: **needs_fix**（軽微・doc コメント1行のみ。実装・数理・パリティ・テストはすべて適合）

## 設計適合

適合（doc 1行の齟齬を除く）。

- **MIN/MAG のみ LINEAR、WRAP=CLAMP_TO_EDGE 据置**: `webgl2-textures.ts:41-44` を確認。WRAP_S/T は CLAMP_TO_EDGE のまま、MIN/MAG_FILTER のみ LINEAR に変更。design §5.4 / plan §8 に一致。
- **webgl2 は textures.ts のみ変更、renderer.ts:168-171 は未変更**: 確認済み。`webgl2-renderer.ts:166-171`（マスク/FBO target テクスチャ、TEXTURE1）は既に LINEAR で、今回のブランチでは未変更。Gnome は触れていない。
- **Forbidden scope 不侵**: Domain D の変更は render-webgl2 / render-software / 宣言確認に限定。`git diff --stat` 上の mesh-generation・browser-psd-parser・texture-atlas.ts 等の変更は別ドメイン（D-gen / D-texprep）の並列 WIP であり、Domain D の責務外。生成器・texprep・atlas・export に Domain D 起因の手は入っていない。
- **宣言整合**: `runtime-export-materialization.ts:626` は `textureFiltering: "linear-v1"` を宣言（不変）。実装が LINEAR になり宣言と一致した。宣言側コード変更なし（設計どおり）。

## software LINEAR 数理の正しさ（自分で検算）

`texture-sampler.ts` の `sampleTextureLinear` は GL LINEAR + CLAMP_TO_EDGE に厳密準拠。自分で検算し正しいと確認:

- `coord = uv*dim - 0.5`、`floor(coord)`、`i1 = i0+1`、`frac = coord - floor`（**クランプ前の連続座標**で frac を計算）。GL の重み計算と一致。
- サンプルインデックスのみ `clampInt` で `[0, dim-1]` にクランプ（CLAMP_TO_EDGE）。frac はクランプに影響されない。正しい。
- RGBA 各チャンネルを `bilerpChannel` で双線形補間。x 方向 lerp → y 方向 lerp。
- 補間は `prepareTexture` の premultiplied 正規化 float 空間で実施。`prepareTexture` の premultiply（straight は `round(c*a/255)` でバイト一致）・正規化は不変。
- `dim<=0` ガード維持（`{0,0,0,0}` 返却、`texture-sampler.ts:123-125`）。
- top-left UV 原点整合（`layer-local-top-left-0-1-v1`）。

単一テクセル（width=1）の退化も検算: uv=0 → coordX=-0.5, floorX=-1, x0=x1=clamp→0 で同一テクセル。frac に依らずテクセル値。テスト「uses premultiplied sources as-is」と整合。

## パリティ（webgl2 ⇔ software）

適合。webgl2 upload（`createUploadBytes`, premultiplied）と software `prepareTexture` の premultiply が同一数式（premultiplied 源は素通し、straight は `round(c*a/255)`）で、両者が同一入力に GL LINEAR + CLAMP_TO_EDGE 数理を適用する構図。webgl2 はモック GL のため実 GPU 比較ではなく「同一数理で定義する」規約でパリティを担保（software が参照実装）。この構図は崩れていない。

## 透明端 AA / fringe（自分で検算）

適合。新規テスト「does not produce a dark/white fringe...」（2x1 opaque red + 透明 padding）を検算:

- prepareTexture 後: texel0=(1,0,0,1), texel1=(0,0,0,0)（premult 空間）。
- uv=(0.5,0.5): width=2 → coordX=0.5, fracX=0.5 / height=1 → coordY=0, fracY=0。
- 補間結果 r=0.5, a=0.5, g=b=0 → r/a=1。**premult 空間補間により色が alpha と歩調を合わせ、暗い fringe（r<a）も白い fringe（r>a）も出ない**。期待値・数理ともに正しい。

## 補間検証テストの妥当性（自分で検算）

- **golden バイト不変の主張は正しい**: `software-renderer.test.ts` の four-color 2x2 は出力ピクセル中心が UV 0.25/0.75 → coord=0/1 で frac=0 になり LINEAR がテクセルに退化。バイト不変は数理的に正当。ただしこれ**単独では LINEAR を検証しない**（frac=0 の退化ケース）点も指摘どおり。
- **フラクショナル補間を効かせる新規テストが存在し期待値も正しい**: `texture-sampler.test.ts` の「interpolates the midpoint」。uv=(0.5,0.25)→(0.5,0.5,0,1)、uv=(0.5,0.5)→4テクセル平均(0.5,0.5,0.5,1) を自分で検算し一致確認。CLAMP_TO_EDGE 境界テスト（uv>=1/<0/=1.0）も正しい。
- **死んだ NEAREST 経路**: 関数名（`sampleTextureLinear` に改名）・呼び出し元（`triangle-rasterizer.ts` 更新）・fixtures doc は更新済み。ただし下記の doc コメント1件が未更新（要修正）。

## 差分・要修正

1. **[軽微 / needs_fix] `packages/render-software/src/software-renderer.ts:58` の doc コメントが古い**
   - 現状: `*  - NEAREST + CLAMP_TO_EDGE texture sampling`
   - `compositeScene` の「WebGL2 レンダラと意味論を鏡写しにする」記述の一部。実装は LINEAR になったためこの1行が実態と食い違い、レビュー観点#5「NEAREST を名乗る死んだ doc コメント」に該当。
   - 修正指針: `*  - LINEAR (bilinear) + CLAMP_TO_EDGE texture sampling` へ更新。
   - 影響: 挙動には無関係（コメントのみ）。この file は Gnome の変更一覧に含まれず、更新漏れ。Domain D の render-software 責務内なので本ループで修正可能。

（`webgl2-context.ts:33` の `readonly NEAREST: number;` は WebGl2Like インタフェースの GL 定数宣言で、テストが「NEAREST 不使用」を表明するために使用。残置が正しく、修正不要。）

## 裁量判断（設計未定義を合理的に埋めた箇所）

- Gnome が `dim<=0` ガードの明示テスト・webgl2 パリティ表明テスト（マスク無しシーンで MIN/MAG=LINEAR・NEAREST 不使用・WRAP=CLAMP_TO_EDGE）を既存モック GL 流儀で追加した判断は妥当。回帰防止として合理的。
- golden バイト据え置き＋テスト名/コメント更新の判断も背景指示どおりで妥当。

## テスト結果（自分で実行）

- `npx vitest run packages/render-software packages/render-webgl2`
  → **8 ファイル / 47 tests 全 pass**。
- `npx tsc --noEmit`（全ワークスペース） → **0 error**。
- `npx vitest run packages/authoring-core`（authoring-core 失敗の独立検証）
  → **294 中 293 pass、1 fail**。
  - Gnome は「3 fail」を報告したが、現在は **1 fail**。共有ワークツリー上で並列ドメイン（D-gen 等）が進行し件数が変動したため。件数の差は Domain D とは無関係。
  - **(a) 失敗テストは mesh-generation 系**: `mesh-generation.test.ts > alpha-aware mesh generation > allows v6d adaptive contour-constrainautor vertices outside layer bounds while keeping original texture UVs valid`。スタックは `expectValidMeshDtoAllowingOutsideBounds`（`mesh-generation.test.ts:4580`）→ `:2087`。render / materialization ではない。
  - **(b) Domain D と因果的に無関係**: 失敗メッセージは `expected -0.15 to be greater than or equal to 0`＝UV が [0,1] を外れることに関する検証で、まさに **D-gen（UV 非クランプ）ドメインの進行中作業**に起因。Domain D の変更（webgl2-textures.ts / texture-sampler.ts / triangle-rasterizer.ts / doc）は authoring-core mesh-generation を一切含まず、失敗テストのスタックも render コードを通らない。**回帰ではなく別ドメイン WIP** と独立に確認。
  - `runtime-export-assembly.test.ts` 等の宣言経路に Domain D 起因の退行なし。

## 質問

- Domain D の render-software 責務内として `software-renderer.ts:58` の doc コメントを本ループで Gnome に修正委任する方針で問題ないか。plan §8 の Allowed write scope は `texture-sampler.ts` を明示列挙しているが `software-renderer.ts` は列挙外（ただし同一 render-software パッケージのレンダラ意味論 doc で、NEAREST→LINEAR の当然の追随）。scope 厳格運用なら escalate 相当だが、doc 1行のため本ループ内修正が妥当と判断。Orch 判断を仰ぐ。

## 総括

実装・数理・パリティ・透明端 AA・宣言整合・テスト green・無退行、すべて適合。唯一 `software-renderer.ts:58` の古い NEAREST doc コメント（挙動無関係）が残るため **needs_fix**。この1行を LINEAR へ更新すれば pass 相当。authoring-core の 1 fail は D-gen ドメインの WIP で Domain D と因果無関係（独立検証済み）。
