# Wave108 Implementation Map

> Lightweight map for Wave108 `boundary-transparent-margin` (A1, Option E) implementation artifacts.
> 設計オラクル: [../../../design/mesh-rendering/boundary-transparent-margin-design.md](../../../design/mesh-rendering/boundary-transparent-margin-design.md)。計画: [../../orchestration/wave108-plan.md](../../orchestration/wave108-plan.md)。

## Domain Reports

| Path | Domain | Status |
|---|---|---|
| [wave108-domain-a-gen-uv-unclamp-report.md](wave108-domain-a-gen-uv-unclamp-report.md) | A. 生成側 UV 非クランプ + 覆いマージン幅 `maxCoverageMarginSourcePixels(size)` 関数化（r 非束縛, Option E） | pass |
| [wave108-domain-b-texprep-transparent-padding-report.md](wave108-domain-b-texprep-transparent-padding-report.md) | B. 透明パディング焼き込み + content-inset 伝播（層サイズ別 P） | pass |
| [wave108-domain-c-atlas-transparent-gutter-report.md](wave108-domain-c-atlas-transparent-gutter-report.md) | C. 透明 gutter（§9 上書き）+ bounds↔raster 分離・`uvRect`=content sub-rect | pass |
| [wave108-domain-d-render-linear-report.md](wave108-domain-d-render-linear-report.md) | D. LINEAR 化 + software パリティ（`linear-v1` 宣言と実装整合） | pass |
| [wave108-domain-e-export-materialize-report.md](wave108-domain-e-export-materialize-report.md) | E. export 再materialize 整合（無改変で三者一貫） | pass |
| [wave108-vocab-unification-note.md](wave108-vocab-unification-note.md) | F. stale「K」語彙の doc コメント統一（Option E「P」へ、挙動不変） | complete |
| [wave108-final-integration-report.md](wave108-final-integration-report.md) | F. Final Integration / Clean Review / Map Closeout | final complete / pass |

## Notes

- **Option E**（2026-07-09 ユーザー決定で旧「K=4 固定・r 束縛」を上書き）: 生成側 r を束縛せず、覆いマージン幅の上界を層サイズ関数 `maxCoverageMarginSourcePixels(longEdgePixels)=ceil(clamp(0.012·長辺,4,16)+blur1)` へ一般化（authoring-core `mesh-generation-coverage-margin.ts` 正準、v7 の r 定数を単一真実源で再利用、index re-export）。texprep が import し per-layer 透明パディング P を焼き込む。
- **機構の要**: 生成 UV は非クランプ（純粋幾何、mesh 作り替えなし）。透明パディング P はタイルラスタに焼かれ per-tile `content-inset`（四辺）で運搬。`bounds≡raster` は content-inset で分離し stage `bounds` は content 不変。atlas は padded raster 基準（`resolvePackedRasterSize`）＋ content-inset を placement の `uvRect`（content sub-rect）へ 1 箇所だけ畳み込み、editor remap = export materialize = runtime が同一 `uvRect` を線形消費（再 inset なし）。透明 gutter は透明ラスタ外縁を既存 `extrudeTexturePlacementEdges` がそのまま外へ複製することで**コード無改変**で成立（§9 の不透明 extrude を覆いマージンについて上書き）。
- **§4 クロス滲み不在**: overshoot UV の上界 `u=1+P/content` は自タイル raster 外縁ちょうどに着地（透明帯内に収束）。透明 gutter 幅 P と overshoot 上界 P はいずれも `maxCoverageMarginSourcePixels` 由来で一致。atlas コピーは native 1:1（source 画素＝atlas 画素）。`texture-atlas-transparent-gutter.test.ts`（実 bake パイプライン・混在サイズ）＋ `runtime-export-materialization.test.ts`（写像側数値主張）の二層で担保。
- **LINEAR**: webgl2 `TEXTURE_MIN/MAG_FILTER=LINEAR`、software `sampleTextureLinear`（`coord=uv·dim−0.5`/i0i1 clamp/premultiplied 空間補間）。透明端で暗/白 fringe なし。`linear-v1` 宣言と実装が整合。
- **export 無改変の正当性**: `mapSourceUvToAtlasUv` はロジック未変更（unit テスト用 `export` と註釈のみ）。三者一貫は D-atlas の `sourceRectPixels=(0,0,padded)` 契約下で `localX=uv.x` に恒等縮約することで成立。将来 D-atlas が sourceRect を厳密 sub-rect に変えたら追随要。
- **リポジトリ衛生**: 権威検証前に L0 が stale `.js`（src の .ts シャドウ）501 本を purge。`.gitignore` にガード追加（`packages/*/src/**/*.js`・`apps/*/src/**/*.js`、手書きランタイム `mesh-generation-v6b/v7-constrainautor-runtime.js` を除外）。**後続推奨: `scripts/check-source-organization.mjs` へ「src の .ts シャドウ .js を hard fail」ガード追加**（現状未実装、過去 wave 緑の信頼性にも関わる）。
- **Residual（据置）**: ①content-inset スキーマ三重化（package-format 2 + operation-core 1、既存重複踏襲・単一ソース集約は後続）②`atlasUvs` に hard 範囲検証を追加しない方針（§4 の正当 overshoot 尊重、幾何保証＋テストで担保）③`original` プレビュー: per-texture render 寸法が padded raster になり content が inset/縮小表示（§5.5 想定より一段大きい変化。正典 `atlasRuntime` は健全）。

## Final Gate

- 権威検証 green: `typecheck` clean / `vitest run packages` 241 files 1492 tests / `check:deps` / `check:source`（`build`/`test:standard` は root 未定義のためスキップ）。apps/editor の 6 fail は pre-existing `diagnostics-jump-actions` 4（clean tree で再現確認済み）+ flaky `viewer-runtime-screen` 2（隔離実行で 27/27 pass）で、**wave108 由来の新規 red はゼロ**。
- Final clean integration review recorded `pass`（blocking ゼロ）。Wave108 は final complete / pass。
- **コミットは未実施（wave gate ＝ユーザー統制点、ユーザー判断待ち）**。
- **ユーザー gate（wave 外）**: 凍結 `mouth_u`（`C:\workspace\remie\rigging\second-rigging-opus\workspace`）を editor `atlasRuntime` モードで目視 — 境界の拡大にじみ消失・覆いマージン透明・クロス滲み無し・LINEAR の端 AA 自然。
