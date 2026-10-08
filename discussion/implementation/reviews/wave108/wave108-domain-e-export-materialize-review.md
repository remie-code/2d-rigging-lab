# Wave108 Domain E レビュー — export 再materialize 整合（Option E, Batch 3）

- レビュー担当: Review-Sylph
- 対象: `packages/authoring-core/src/runtime-export-materialization.ts`（`mapSourceUvToAtlasUv`）, `packages/authoring-core/src/runtime-export-materialization.test.ts`（4 tests）, `packages/package-format/src/runtime-export.ts:346`（`atlasUvs`）
- 判定: **合格**

## 1. 差分の実体確認（Gnome 主張の裏取り）

- `runtime-export-materialization.ts`: `git diff HEAD` の結果、変更は **7 行のコメント追加 + `const mapSourceUvToAtlasUv` → `export const mapSourceUvToAtlasUv` の 1 行のみ**。関数本体（L563-577）は byte 同一。ロジック無改変を確認。
- `runtime-export.ts`: `git diff HEAD` は **空**。`atlasUvs`（L346）は範囲検証追加なし・無改変を確認。
- テストは新規追加ファイル（untracked）。

## 2. 二重補正の不在（必達）— **合格**

`mapSourceUvToAtlasUv`（L563-577）は `sourceTextureSize` / `sourceRectPixels` / `uvRect` のみを参照。`placement.contentInset` および `contentRectPixels` を**一切参照していない**（grep で 0 件）。`uvRect` を単一真実源として線形消費するのみで、再 inset は存在しない。D-atlas 申し送り（`uvRect` = content sub-rect が唯一の真実源、消費側で再 inset するな）に適合。

## 3. 恒等 local-normalization の正当性 — **合格**

`sourceRectPixels = (0, 0, sourceTextureSize)` の下で
`localX = (uv.x·W − 0) / W = uv.x`（同 y）。
よって `atlasUv = uvRect.topLeft + uv · uvRectSpan`。

実ビルダー `texture-atlas-packing.ts createTextureAtlasPlacement`（L525-593）との照合:
- `sourceTextureSize` = `sourceRectPixels` span = padded raster（透明帯込み）。テストの `makePlacement`（sourceRectPixels=(0,0,padded), sourceTextureSize=padded）と一致。
- `uvRect` = content sub-rect（contentRect を per-side `contentInset` で inset、page 正規化）。テストは uniform inset で同一構成を再現。
- `contentRectPixels` = 全 source raster 配置（透明覆いマージン帯を含む）。テストの `contentRect` と一致。

テストの placement 幾何は実生成を忠実に反映しており、有効なオラクル。数値検算（test 1）:
`(7 + 0.3·17)/128 = 12.1/128` in x、`(4+3+0.7·17)/96` in y — コードの算出と一致。

## 4. 三者一貫（editor atlasRuntime = export = runtime）— **合格**

editor `remapUvIntoPlacement`（`viewer-render-source.ts:507-520`）= `left + uv·span`（同一 `uvRect` 消費）。export `mapSourceUvToAtlasUv` は同一線形消費に還元される。
test 2 が両者の一致を **内点（0,0/1,1/0.5,0.25）+ overshoot（-0.3,1.2 / 1.4,-0.15）** で小/大 2 tile × 12 桁精度で数値表明。三者一貫の必要条件を満たす。

## 5. §4 クロス滲み回避 — **合格**

test 4（overshoot band）の検算:
- tileA（content=17, inset=3, padded=23, rasterX=4, page=128）: `uMax = 1+3/17` → `atlasUv.x·128 = 7 + (1+3/17)·17 = 27` = raster 右端（4+23）。`uMin = -3/17` → `4` = raster 左端。いずれも自 tile の `contentRectPixels`[4,27] 内・page[0,1] 内。
- 隣接 tileB は rasterX=31（gutter 4px gap）。`aMax(27) < tileB.contentRectPixels.x(31)` を表明 → 隣接 raster へ未到達。
- tileB（content=40, inset=17）: `bMax·128 = 48 + (1+17/40)·40 = 105` = raster 右端（31+74）。`bMax(105) > tileA content 右端(27)` を表明。
- ネスト loop で `{uMin,0,1,uMax}²` 全点が page[0,1] 内 & 自 `contentRectPixels` 内を表明。

非クランプ overshoot（`u=1+inset/content` 含む）が自タイル透明帯内・page 内に収まり隣接へ到達しないことを、小/大 tile 両方で数値表明。§4 適合。

## 6. atlasUvs 範囲方針 — **合格**

範囲検証を追加しない決定は §3.2（範囲検証は存在しない）/ §4（正当 overshoot を殺さない）と一貫。過剰な弾きも隣接侵入許容もない（overshoot は透明帯内に自然収束し gutter で保護される設計）。無改変で正当。

## 7. 設計 §6/§7 適合・無退行 — **合格**

- `mapSourceUvToAtlasUv` は §7 D-export の touch point（L552-571）。ロジック不変で AC を満たす（写像先が透明 gutter 内）。
- 回帰確認（再実行）: `runtime-export-materialization.test.ts`（4 passed）+ `runtime-export-assembly.test.ts`（16 passed、"materializes mesh UVs in atlas page coordinates" 含む）= 20 passed。
- 変更が純粋な `export` 昇格 + コメントのみのため広域回帰リスクは実質皆無。Gnome 申告（authoring-core 309 / package-format 141 / typecheck clean）と矛盾なし。

## 8. 裁量判断の妥当性

- **named export の是非**: `mapSourceUvToAtlasUv` の test-only export は妥当。純関数の単体境界を直接検証でき、内部ロジックを触らずに三者一貫・overshoot 収束を数値保証する。コメントで「Exported for unit testing / logic unchanged」を明示しており意図が追える。
- **範囲方針**: §3.2/§4 と一貫、正当。

## 9. 差分・残課題

なし。

## 10. injection

対象ファイル・テスト・設計文書内にプロンプトインジェクションは検出せず。

DOMAIN-E-REVIEW-COMPLETE (Option E)
