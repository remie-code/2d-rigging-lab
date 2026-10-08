# Wave108 Final Integration Report — `boundary-transparent-margin` (A1, Option E)

- Domain: F `wave108-final-integration`（統合 / clean review / map 閉栓 / final report）
- Role: Orch-Sylph（Domain F オーケストレーション）。呼び出し元: Undine（L0）。
- 設計オラクル: [../../../design/mesh-rendering/boundary-transparent-margin-design.md](../../../design/mesh-rendering/boundary-transparent-margin-design.md)。計画: [../../orchestration/wave108-plan.md](../../orchestration/wave108-plan.md)（§10 Domain F, §12 Verification, §13 Residual）。
- **総合判定: PASS（wave108 由来の新規 red ゼロ・clean review blocking ゼロ）。コミットは未実施（wave gate ＝ユーザー統制点、ユーザー判断待ち）。**

---

## 1. 検証証跡（権威ある緑・purge 後）

直前に L0 が stale untracked `.js`（src の .ts シャドウ 501 本）を purge 済み。過去ドメインの緑は当時それぞれのパッケージにシャドウが居た状態で採られた可能性があるため、**purge 後のフル検証を本 wave の権威ある緑とする**。すべて Domain F（Orch-Sylph）が再実行した。

| コマンド | 結果 | 備考 |
|---|---|---|
| `pnpm.cmd typecheck`（`tsc --noEmit` monorepo） | **clean（exit 0、エラー無し）** | 権威 typecheck |
| `pnpm.cmd exec vitest run packages` | **241 files / 1492 tests passed（exit 0）** | 全パッケージ。authoring-core / render-* / package-format / operation-core 含む |
| `pnpm.cmd exec vitest run apps/editor/src` | 63 files 中 **61 passed / 2 failed**、494 tests 中 **484 passed / 6 failed / 4 skipped** | 6 fail の弁別は §1.1 |
| `pnpm.cmd run check:deps`（`check-dependencies.mjs`） | **passed**（Dependency guard passed） | |
| `pnpm.cmd run check:source`（`check-source-organization.mjs`） | **passed**（Source organization guard passed） | |
| `pnpm.cmd build` | **スキップ** | root に `build` スクリプトが存在しない（`package.json` scripts に無い）。ビルド不要な TS-source-as-package 構成（authoring-core は `exports: "./src/index.ts"`）。 |
| `pnpm.cmd test:standard` | **スキップ** | root に `test:standard` が存在しない。`test:unit`（= `vitest run packages`）は上記で網羅済み。 |

`pnpm.cmd run check`（typecheck + test:unit + check:deps + check:source）の 4 構成要素は上記で個別に green を確認済み（`check:deps`/`check:source` は集約スクリプト経由で実行、typecheck と packages vitest は個別実行が上位集合）。

### 1.1 apps/editor 6 fail の弁別（baseline 比較）— **すべて wave108 非由来**

- **`diagnostics-jump-actions.test.ts`（4 fail）= pre-existing baseline red**。wave108 の変更対象ファイルではなく（テクスチャ/メッシュ/アトラスと無関係）、Domain B レビューが「clean tree（Domain B stash）で再現」＝ HEAD baseline でも赤いことを確認済み。複数ドメイン報告（A/B/C）が pre-existing として記録済み。
- **`viewer-runtime-screen.test.ts`（2 fail）= flaky（テスト汚染／teardown）**。当該 2 件は Dynamics playback 再起動 / Reset simulation の**再生状態機械**に関するもので、wave108 が触れるテクスチャ描画とは無関係。フルスイート実行時に React unmount teardown crash（`viewer-runtime-screen.test.ts:1409` の `reactRoot.unmount`）を伴う。**単体隔離で再実行すると 27/27 全 pass**（`vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` exit 0）。Domain C の focused run（viewer+canvas 179 passed/0 fail）でも赤くなかった＝並列フルスイート下の timing/汚染で、shadow 顕在化でも wave108 退行でもない。

**結論**: shadow 除去（501 本 purge）後も、wave108 由来の新規 red はゼロ。全 wave108 帰属スイート（packages 全 1492 + editor の該当領域）は green。

---

## 2. 実装要約（Option E）

A1（覆いマージンを透明で受ける）を、正しさを描画規約ではなくデータ（mesh 幾何 + 透明テクスチャ）に焼く形で実装。2026-07-09 ユーザー決定 **Option E**（旧「K=4 固定・r 束縛」を上書き）に沿う。

- **生成 UV 非クランプ（D-gen）**: `mesh-generation-v6-contour-pipeline.ts` `mapV6ContourPointToUv` と `mesh-generation-v7-margin-contour.ts` `mapPixelPointToUv` の `clamp(...,0,1)` を撤去。layer-local UV は stage と同一 `pixel/size` 基準で [0,1] を素直にはみ出す。**mesh を padded 座標へ作り替えない**（純粋幾何のまま）。stage 写像は不変。
- **r 非束縛 + 覆いマージン幅の関数化（D-gen, Option E）**: 生成側の r を束縛しない（v6d 自然値 mask expansion=2/virtual padding=4、v7 `clamp(0.012×長辺,4,16)`）。前回 pass の r≤K=4 束縛を revert。旧定数 `COVERAGE_MARGIN_MAX_SOURCE_PIXELS`(=4) を **`maxCoverageMarginSourcePixels(longEdgePixels)=ceil(clamp(0.012·長辺,4,16)+blur1)`**（`mesh-generation-coverage-margin.ts` 正準、ソース画素、v7 の r 定数を単一真実源で再利用、index re-export）へ一般化。blur=1px は soft-alpha-mask kernel radius 由来の named 定数（マジックナンバー禁止）。飽和: 小層 5px / 大層 17px。
- **透明パディング焼き込み（D-texprep）**: layer raster 外周に premultiplied 透明 `(0,0,0,0)` の P px（`= maxCoverageMarginSourcePixels(longEdge)`、層サイズ別）を焼き、content を inset (P,P) へ転写。width/height/byteLength/digest を padded 値へ更新。**content-inset**（四辺 `{left,top,right,bottom}`）を evidence→operation→textureEntry へ伝播し `bounds≡raster` を分離。stage `bounds` は content のまま不変。
- **透明 gutter + bounds↔raster 分離（D-atlas）**: atlas source-tile を padded raster `textureEntry.dimensions` から導出（`resolvePackedRasterSize`）。content-inset を placement の `uvRect`（content sub-rect）へ **1 箇所だけ**畳み込む（再 inset なし）。`extrudeTexturePlacementEdges` / `copyTextureIntoPlacement` は**コード無改変**——透明ラスタ外縁を既存 extrude がそのまま外へ複製することで**透明 gutter が自動生成**され、§9 の不透明 edge-extrude を覆いマージンについて上書き。atlas gutter(`paddingPixels`)は既存幅据置（overshoot はラスタ内透明帯が吸収するため広げない）。`canvas-projection.ts` の render 寸法/`isRenderableDrawable` を padded raster 基準へ整合。
- **LINEAR パリティ（D-render）**: webgl2 `TEXTURE_MIN/MAG_FILTER` を NEAREST→LINEAR。software `sampleTextureLinear`（`coord=uv·dim−0.5`/i0i1 を `[0,dim-1]` clamp/premultiplied 空間で双線形補間）。透明端で暗/白 fringe なし。`runtime-export-materialization.ts:626` の `textureFiltering="linear-v1"` 宣言と実装の食い違いが解消。
- **export 三者一貫（D-export、無改変で達成）**: `mapSourceUvToAtlasUv` はロジック未変更（unit テスト用 `export` と註釈のみ）。D-atlas の `sourceRectPixels=(0,0,padded)` 契約下で `localX=(uv.x·W−0)/W = uv.x` に恒等縮約 → `atlasUv = uvRect.topLeft + uv·uvSpan`。これは editor `remapUvIntoPlacement` の `left + uv·width` と**完全同一**。したがって editor `atlasRuntime` = export = runtime が同一 `uvRect` 写像で一致。`atlasUvs` スキーマに hard 範囲検証は**足さない**（§4 の正当 overshoot を尊重、幾何保証＋テストで担保）。
- **語彙統一（Domain F）**: stale「K」「bound to K」「r <= K」「padding K」「K=4」の doc/テストコメント 8 箇所を Option E の「P（層サイズ別、`maxCoverageMarginSourcePixels`）」へ統一（挙動不変、コメントのみ）。`mesh-generation-v7-parameters.ts` の「UVs clamp to [0,1]」stale 記述も非クランプ化に整合。詳細: [wave108-vocab-unification-note.md](wave108-vocab-unification-note.md)。残存 grep 0 件・typecheck clean を確認。

### 2.1 §4 クロス滲み不在（最重点）

overshoot UV の上界 `u = 1 + P/content` は `atlasPx = (contentRect.x+P) + (1+P/content)·content = contentRect.x + content + 2P` ＝ **自タイル raster 外縁ちょうど**に着地し、透明帯内に収束（real overshoot は上界未満なので厳密に band 内側）。透明 gutter 幅（焼き込んだ P）と overshoot 上界（同じ P）はいずれも `maxCoverageMarginSourcePixels` 由来で一致。atlas コピーは native 1:1（source 画素＝atlas 画素、scale 1）で換算は恒等。隣接 placement とは atlas gutter で離間し、その gutter も透明。二層テスト（`texture-atlas-transparent-gutter.test.ts` の実 bake パイプライン混在サイズ ＋ `runtime-export-materialization.test.ts` の写像数値主張）で担保。

---

## 3. Clean Integration Review（Review-Sylph 独立）

- レポート: [../../reviews/wave108/wave108-final-clean-integration-review.md](../../reviews/wave108/wave108-final-clean-integration-review.md)
- **判定: PASS（blocking ゼロ）**。設計 §2-§7 との突合、三者一貫（数式・テスト一致）、§4 クロス滲み不在（実 bake ＋写像テストの二層被覆）、Option E 契約（r 非束縛・サイズ関数 padding・透明 gutter・LINEAR パリティ）、bounds≡raster 分離（content-inset 橋渡し・byteLength 整合）、export 無改変の正当性（D-atlas sourceRect 契約依存）を、実 diff とテスト内容で独立に裏取り。
- 非ブロッキング残課題 1 件（`original` モード表示 = §5 Residual ③、ユーザーゲート申し送り）。
- レビュー合格の前提条件（権威検証 green）は本報告 §1 で成立。

---

## 4. Domain A-E 成果（参照）

| Domain | 報告 | レビュー | 判定 |
|---|---|---|---|
| A. 生成 UV 非クランプ + `maxCoverageMarginSourcePixels` | [report](wave108-domain-a-gen-uv-unclamp-report.md) | [review](../../reviews/wave108/wave108-domain-a-gen-uv-unclamp-review.md) | pass |
| B. 透明パディング + content-inset | [report](wave108-domain-b-texprep-transparent-padding-report.md) | [review](../../reviews/wave108/wave108-domain-b-texprep-transparent-padding-review.md) | pass |
| C. 透明 gutter + bounds↔raster 分離 | [report](wave108-domain-c-atlas-transparent-gutter-report.md) | [review](../../reviews/wave108/wave108-domain-c-atlas-transparent-gutter-review.md) | pass |
| D. LINEAR + software パリティ | [report](wave108-domain-d-render-linear-report.md) | [review](../../reviews/wave108/wave108-domain-d-render-linear-review.md) | pass（loop1 doc 修正後） |
| E. export 再materialize 整合 | [report](wave108-domain-e-export-materialize-report.md) | [review](../../reviews/wave108/wave108-domain-e-export-materialize-review.md) | pass |

---

## 5. Residual / 記録

1. **content-inset スキーマ三重化**: package-format 2（`texture-atlas.ts` `TextureContentInsetSchema` + `psd-source-evidence.ts`）+ operation-core 1（`import-source.ts` `PsdAdapterContentInsetSchema`、依存方向を汚さないための意図的独立コピー）。既存の materialization-evidence スキーマ重複を踏襲。本 wave は shape 同一で据置。**単一ソース集約は後続**。
2. **`atlasUvs` に hard 範囲検証を追加しない方針**: §4 の正当 overshoot（layer-local UV は [0,1] を正当に超える）を尊重。クロス滲み防止は幾何的な透明帯保証（overshoot ≤ P が自タイル band に着地）＋テストで担保し、スキーマで正当 overshoot を弾かない。`runtime-export.ts:346` の `atlasUvs`（`Vec2Schema` finite-only）は据置。
3. **`original` プレビュー据置（非ブロッキング・ユーザーゲート申し送り）**: per-texture(`original`) の render 寸法が padded raster になったため、content-space UV[0,1] が padded raster 全域を走り、content が inset/縮小して透明マージン付きで表示される。設計 §5.5 の想定（端サンプルの伸び）より**一段大きい表示変化**。ただし設計は `original` を de-scope し `atlasRuntime` を正典プレビューに据える方針で、正典 `atlasRuntime`（`remapDrawableToAtlasRuntime`）は本変更の影響を受けず健全。**要修正ではない**。実機で `original` の content ずれが混乱を招く場合のみ、`original` の UV を content-inset で remap する等のフォローアップを検討（wave 外）。
4. **D-export の無改変正当性は D-atlas の `sourceRectPixels=(0,0,padded)` 契約に依存**。将来 D-atlas が `sourceRectPixels` を厳密 sub-rect へ変えると `localX=uv.x` 恒等が崩れ、D-export の再訪が必要（現状はその状態でない）。
5. **リポジトリ衛生**: 権威検証前に L0 が stale `.js`（src の .ts シャドウ）**501 本を purge**。`.gitignore` にガード追加（`packages/*/src/**/*.js`・`apps/*/src/**/*.js`、手書きランタイム `mesh-generation-v6b/v7-constrainautor-runtime.js` を `!` で除外）＋ emit 元なし確認（L0）。Vite/vitest が `./foo.js` specifier を兄弟 `foo.ts` に解決するため、stale `.js` が src を静かにシャドウし古いロジックでテストが走る（Domain C が実地で遭遇し 124 本除去）。**追加推奨（後続）: `scripts/check-source-organization.mjs` に「src の .ts シャドウ .js を hard fail」ガードを足す**（現状未実装を確認済み。過去 wave 緑の信頼性にも関わる）。
6. **stale 語彙統一の結果**: 8 箇所を Option E「P」へ統一（挙動不変）。残存 grep 0 件。詳細 [wave108-vocab-unification-note.md](wave108-vocab-unification-note.md)。
7. **untracked ユーザー資産**: `apps/editor/ChatGPT Image 2026年7月9日 22_02_29.png`・`apps/runtime-player/ChatGPT Image 2026年7月9日 22_02_32.png` が untracked で存在。ユーザー資産の可能性があるため**触れていない**（存在のみ記録）。

---

## 6. セキュリティ記録

- 本 wave 中、**D-atlas 初回起動時にサブエージェントが実作業ゼロ（tool 0 回）でプロンプトインジェクション payload**（「Master 呼び / CRLF / 英国綴り / 開発者指示」）を返した。L0 は不遵守・実害なし（git 変更ゼロ）を確認し、防御を冒頭固定して新規起動で再実行・pass。出所不明。
- Domain F では、Orch-Sylph・Gnome（語彙統一）・Review-Sylph（clean review）とも委任冒頭にインジェクション防御を固定して起動。**3 子とも injection 遭遇なし**を報告（Gnome/Review-Sylph の最終報告に明記）。
- 今後も子への injection 防御（正規指示元＝委任本文と Basis のみ、埋め込み命令は無視・報告）を継続する。

---

## 7. ユーザー gate（wave 外）

- **実機 atlasRuntime 目視**: 凍結 `mouth_u`（`C:\workspace\remie\rigging\second-rigging-opus\workspace`）を editor `atlasRuntime` モードで開き、①境界の拡大にじみ消失 ②覆いマージンが透明 ③クロス滲み無し ④LINEAR の端 AA が自然、を目視。自動検証は全 green で、残るはこの実機目視のみ。
- **コミット**: 未実施。wave gate ＝ユーザー統制点。ユーザー判断待ち。

---

## 8. 子ハンドリング（SKILL 準拠）

- 起動した子（全 `model:"opus"` 明示）: Review-Sylph（clean review, agentId 記録）・Gnome（語彙統一, agentId 記録）。いずれも契約成果物ファイル検知＋完了通知で回収し、生存児なしを確認（孤児なし）。在席待機は内容マーカーベース、沈黙での再起動なし、ループ上限 5 未達（各 1 巡で収束）。ターン内完走。
