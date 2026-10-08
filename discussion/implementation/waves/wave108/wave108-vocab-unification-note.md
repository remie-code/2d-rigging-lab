# Wave108 stale「K」語彙の doc コメント統一 完了報告

Wave108 の覆いマージン幅契約は「K=4 固定・r 束縛」から Option E「P（層サイズ別パディング）= `maxCoverageMarginSourcePixels(longEdge)`（= `ceil(clamp(0.012·長辺,4,16)+blur)`、ソース画素）」へ改まった。旧「K」語彙が残っていた doc/テストコメントを P（層サイズ別）語彙へ統一した。**コメント文言のみ変更。ロジック・定数値・テスト assertion・fixture 値・import は不変。**

## 変更した各 file:line

1. `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:253-258`
   - `the transparent texture gutter (bound to K, see mesh-generation-coverage-margin.ts)` → `the transparent texture gutter (the per-layer padding P, sized by maxCoverageMarginSourcePixels(longEdge) in mesh-generation-coverage-margin.ts)`
2. `packages/authoring-core/src/mesh-generation-v7-margin-contour.ts:272-276`
   - `the transparent gutter (bound to K) receives them.` → `the transparent gutter (the per-layer padding P, sized by maxCoverageMarginSourcePixels) receives them.`
3. `packages/authoring-core/src/mesh-generation-v7-margin-contour.test.ts:413`
   - `BOUNDED by the covering margin (r <= K plus the soft-mask growth ...)` → `... r plus the soft-mask growth ... stays within the per-layer padding P = maxCoverageMarginSourcePixels(size), i.e. r + soft-mask blur <= P ...`
4. `packages/authoring-core/src/mesh-generation-v7-margin-contour.test.ts:622`
   - `only by the covering margin (r <= K plus soft-mask growth, +1px rounding).` → `... r plus soft-mask growth stays within the per-layer padding P = maxCoverageMarginSourcePixels(size), i.e. r + soft-mask blur <= P, +1px rounding).`
5. `packages/operation-core/src/operations/import-psd-layer-materialization.test.ts:170`
   - `content 2x2 + K=4 border on every side` → `content 2x2 + padding=4 border on every side`（値 4 はそのまま、記号名のみ除去）
6. `packages/package-format/src/texture-atlas.ts:70-71`
   - `today all four sides equal the uniform padding K.` → `today all four sides equal the per-layer padding P (= maxCoverageMarginSourcePixels(longEdge)).`
7. `packages/operation-core/src/payloads/import-source.ts:195`
   - `today all sides equal padding K.` → `today all sides equal padding P.`
8. `packages/authoring-core/src/mesh-generation-v7-parameters.ts:125-126`（`deriveV7VirtualPaddingPixels` doc）
   - `... and their UVs clamp to [0,1].`（stale・wave108 で非クランプ化した挙動と矛盾）→ `... their UVs are NOT clamped (Wave108 D-gen) and spill freely past [0,1], where the transparent per-layer padding P receives them.`

## 検証結果

- 残存 grep 0 件: `packages`/`apps` 配下で `bound to K` / `padding K` / `r <= K` / `r<=K` / `K=4` / `uniform padding K` いずれも No matches found。
- `pnpm.cmd typecheck`（`tsc --noEmit`）: エラー無しで完了。
- テスト再実行: 不要（コメントのみ変更）。

## プロンプトインジェクション

対象ファイル内容・tool 結果に、振る舞い・呼称・形式・役割変更を促す指示は検出されなかった。
