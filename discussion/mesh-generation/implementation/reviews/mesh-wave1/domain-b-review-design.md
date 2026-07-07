# Mesh Wave 1 / Domain B レビュー(レーン1: 設計適合) — v7 コア

> レビュー担当: Review-Sylph(設計適合レーン)。委任元: Orch-Sylph(Domain B)。
> 日付: 2026-07-07
> 判定基準: concept-design.md(設計オラクル・唯一の正)§2-6 / mesh-wave1-plan.md §6
> 対象: `mesh-generation-v7-{parameters,pipeline,margin-contour}.ts` / `-constrainautor-runtime.{js,d.ts}` / `mesh-generation-contract.ts`(V7追記差分) / `mesh-generation.ts`(v7分岐差分)

## 判定

**合格(要修正なし)**

concept-design.md §2-4 のパイプライン全工程・§3 不変条件3つ・§5-6 構造制約・契約のV7系統分離・UV/零面積・preview非変更 のすべてが実装に逐条で反映されていることを、対象ファイルを自分で読み、テストとtypecheck/check:sourceを自分で実行して確認した。設計との食い違いは検出されなかった。Gnome の完了レポートの主張は裏取りの結果すべて事実だった。

---

## 逐条適合状況

### §2 パイプライン全工程(膨張マスクだけを見る骨格)

| 工程 | 適合 | 確認方法 |
|---|---|---|
| マスク膨張(半径r・8px上限解除) | ✓ | pipeline.ts:138-154。`createSoftAlphaMask`→`expandMask(softMask.mask,…,expansionPixels)`。ceiling は `V7_MAX_MASK_EXPANSION_PIXELS=16`(parameters.ts:94)を `resolveMaskExpansionPixels` に渡す。中立 alpha-mask.ts:28,164-170 で v6 の 8px クランプがパラメータ化されており、v7 は 16 を渡して解除している(v6 は既定8で不変)。膨張は element-neutralに元マスクを包含する 4近傍反復 dilation(alpha-mask.ts:177-207) |
| 輪郭抽出 | ✓ | pipeline.ts:158-172。膨張マスク→`findOpaqueComponents`→`selectMainComponent`→`createComponentMask`→`traceBoundaryLoops`→`selectOuterLoop`。全工程が膨張後の主成分マスクだけを入力にしている(元アルファ境界を再参照しない) |
| DP簡略化(ε) | ✓ | pipeline.ts:182-189。`simplifyContourLoop(preRoundedLoop, { simplifyEpsilon, contourVertexCap })` |
| 間隔L再サンプル | ✓ | pipeline.ts:190-193。`sampleBoundaryLoop(simplifiedLoop, { boundarySpacing: vertexSpacing, … })` |
| 内部点(間隔R・境界R/2クリアランス・細長除外) | ✓ | pipeline.ts:205-225。細長抑制(下記§3)を通した thick 成分に対してのみ `sampleInteriorSteinerPoints` を呼ぶ。R=`interiorSpacing`、クリアランス=`interiorBoundaryClearance`(R/2)を明示で渡す。interior-point-sampling.ts:51 で `boundaryDistance >= interiorBoundaryClearance` を強制 |
| CDT(refinementなし) | ✓ | pipeline.ts:470-528 `triangulateConstrained`。boundary を制約辺、interior を Steiner 点として Delaunator+Constrainautor で三角形化し、境界内の三角形のみ残す。品質駆動の頂点追加(refinement)は一切ない |
| 内部点のみ Lloyd 2〜3回 | ✓ | pipeline.ts:432-463(`triangulateWithLloyd`, パス数=`lloydRelaxationPasses`=2)。pipeline.ts:535-581(`relaxInteriorPoints`)は `vertexIndex < boundaryCount` の頂点(=境界)をスキップし内部点だけ移動。毎パス CDT 再構築 |

「膨張マスクだけを見る」骨格: 主成分マスク(`componentMask`)確定後、輪郭・内部点・距離変換のすべてがそのマスク由来。元 RGBA は膨張前の二値化(§2.1)以降どこにも再参照されない。設計の骨格に合致。

### §3 不変条件3つ

| 不変条件 | 適合 | 確認方法 |
|---|---|---|
| 被覆保証(膨張で構成的担保) | ✓ | 構成: 輪郭は膨張マスク由来で元シルエットの r 外側。テストで全不透明ピクセルを**全走査**(サンプルでない)して各点-三角形包含を実検査(test.ts:461-483 `assertEveryOpaquePixelCovered`、塗り潰し円 test.ts:100-115 + 毛先 fixture test.ts:117-133)。自分で `vitest run …v7-margin-contour.test.ts` 実行→16/16 pass |
| ε < r 結合則(全プリセット) | ✓ | 定数: `r=clamp(0.012×max(texW,texH),4,16)`(parameters.ts:29-31,128-134)、`ε=0.8r`(parameters.ts:42,135)。テスト test.ts:62-73 が high/medium/low × 5テクスチャサイズ(16/64/256/1024/4096)全行で `ε < r` を assert。r/ε がプリセット不変・L のみ可変(test.ts:75-87)も確認 |
| 決定性(乱数不使用) | ✓ | `grep Math.random\|Date.\|crypto` を v7 全ファイルに実行→**0件**。距離変換=決定的2パスチャンファ(pipeline.ts:321-386)、Lloyd=三角形順走査(pipeline.ts:541 コメントどおり)、内部点=明示tie-break付き farthest-point(interior-point-sampling.ts:145-148 `comparePoint`)、stableId=決定的連番(margin-contour.ts:174-191 `stableOrder`/`triangleIndex`/`componentOrder`)。DP 前に `roundCoordinate` で座標丸め(pipeline.ts:182-185)。テスト test.ts:141-174 が2回実行の vertices/uvs/triangles/両stableId 完全一致を assert |

### §4 修正済み判断

| 判断 | 適合 | 確認方法 |
|---|---|---|
| 内部点=間隔R明示制御付き farthest-point | ✓ | interior-point-sampling.ts:118-143(min-distance 最大化=Poisson-disk-like 貪欲)。`interiorSpacing`(R)を明示パラメータ化。v7 は parameters 由来の R を渡す(pipeline.ts:216-224) |
| 穴は全部埋める(穴ループを制約に渡さない) | ✓ | pipeline.ts:171-172 で **外周ループのみ**(`selectOuterLoop`)を制約辺化。三角形は重心が境界多角形内なものだけ残す(pipeline.ts:599-628 `filterTrianglesInsideBoundary`+`isPointInsidePolygon`)ため穴内部も充填。donut テスト test.ts:374-394 が穴中心(21,21)被覆を assert |
| 多島=valid全島を独立サブメッシュ化(1 MeshDto併置) | ✓ | margin-contour.ts:95-117 で `filterAlphaIslands` の keptIslands 全島にパイプライン実行、offset して1 MeshDto に併置(結合でなく連結)。多島時 stableId に `_island_<componentOrder>` を挿入(margin-contour.ts:172,179-190)。単一島も同一経路(1島)。テスト test.ts:329-368 が2島の独立スコープ+両島の全ピクセル被覆(stage空間)を assert |

### §5-6 実装方針(構造制約・最重要)

| 制約 | 適合 | 確認方法 |
|---|---|---|
| v7 が v6系ファイルを import しない | ✓ | v7 全ファイルの `from "./…"` を grep。import 先は `mesh-geometry/*`・`mesh-generation-contract.js`・`mesh-generation-v7-*`・`mesh-quality-metrics.js`・`delaunator`・v7所有シムのみ。**`mesh-generation-v6-*` / `mesh-outline-*` / 各v6バックエンドへの依存は0件** |
| 依存が mesh-geometry と delaunator+constrainautor のみ | ✓ | 上記grep。唯一の追加は `mesh-quality-metrics.js`(下記「裁量判断の妥当性」で評価。統合層の共有ヘルパで v6バックエンドではない) |
| v6の密度設計・パラメータ表を参照/コピーしない | ✓ | parameters.ts の全定数(r/ε/L/クリアランス/細長閾値/Lloyd/上限)が本文書 §2 由来の根拠コメント付きで独自導出。v6 の数値表・密度関数を import も転記もしていない(v6 ファイル依存0件により機械的に担保) |
| L0裁定 pointKey: 事前 roundCoordinate 丸め→中立非丸めDP | ✓ | pipeline.ts:182-185 で outerLoop 各点を `roundCoordinate`(=1e-6, geometry-primitives)で丸めた `preRoundedLoop` を作り、中立 `simplifyContourLoop` に渡す。中立DP の `pointKey`(polyline-simplification.ts:253 `${x}:${y}`)は**非丸め**のまま(モジュール冒頭コメント L11-15 が丸めない旨を明記)。丸め付きpointKey版の新設・中立DP変更はしていない |

### 契約の V7系統分離

| 項目 | 適合 | 確認方法 |
|---|---|---|
| method/source/backend/dependency ID を V7 別系統で新設 | ✓ | contract.ts:147-183(diff HEAD)。`V7_MESH_GENERATION_{METHOD,SOURCE,BACKEND,DEPENDENCY_PACKAGE}_IDS`+型+`V7_MESH_GENERATION_CANDIDATES` を新設 |
| candidate/fallback reason/helper が V6と別系統 | ✓ | `MeshGenerationV7FallbackReason`(4種)を新設し union へ合流。`isV7MeshGenerationMethod`/`getV7MeshGenerationCandidate` を新設。合流は既存配列/union へのスプレッド追記のみ |
| 既存 V6/その他の定数・型を変更していない | ✓ | **`git diff HEAD -- …contract.ts` で確認**(Domain B の実変更を分離)。差分はV7追加行のみ。V6 定数/型/candidate の本体変更なし。※`git diff master` には `v6d-invalid-constraint-input`/`-untriangulated-points` の2 V6理由が見えるが、これは先行コミット `c811bdd5`(wave85)由来で Domain B 非起因(`git log -S` で確認)。master が古いための見かけ差分 |

### UV 0..1クランプ / 零面積三角形禁止

| 項目 | 適合 | 確認方法 |
|---|---|---|
| UV 0..1 クランプ | ✓ | margin-contour.ts:269-276 `mapPixelPointToUv` が `clamp(point.x/texW, 0, 1)`。テスト test.ts:279-284 が全UVの [0,1] を assert |
| 零面積三角形禁止 | ✓ | pipeline.ts:612 で `|area| <= TRIANGLE_AREA_EPSILON(1e-6)` の三角形を除外、pipeline.ts:681-682 で重複頂点三角形も除外。テスト test.ts:290-297 が全三角形 signedArea ≠ 0 を assert |

### preview スキーマ非変更

| 項目 | 適合 | 確認方法 |
|---|---|---|
| `model-edit.ts` の v6Metrics枠を変更していない | ✓ | `git diff HEAD/master -- packages/operation-core/src/payloads/model-edit.ts` が**両方とも空**。v7 診断は provenance のみ: margin-contour.ts:220-228 で qualityMetrics は `computeMeshQualityMetrics(mesh,{refinementIterationCount:0})` の純幾何のみ、`v6Metrics`/`triangulationMode` を渡さない(mesh-quality-metrics.ts:369 で両者 optional・未指定なら付与されないことを確認) |

---

## 差分(設計と実装の食い違い)

**なし。**

---

## 裁量判断の妥当性評価

1. **constrainautor runtime シム(v7所有)** — 妥当。`@kninnug/constrainautor` を直 import すると tsc がライブラリソースを型検査して壊れるため、v6 と同じ「default 再エクスポート `.js`+`.d.ts`」パターンを **v7名前空間で自前新設**(runtime.js:1 / .d.ts:1-15)。v6 シムを import していない(v7所有)ので系統分離を損なわず、将来の v6一括削除時に独立して残る。新規外部依存・lockfile 変更なし。`.d.ts` は pipeline が使う `untriangulatedPoints()`/`constrainAll()`/`del.triangles` を過不足なく宣言。typecheck 自分で実行→pass。

2. **距離変換方式(2パスチャンファ)** — 妥当。concept-design §2.3 は「距離変換(で判定)」を要求し方式を固定していない。決定的な前進+後退2パス(重み1/√2, pipeline.ts:321-386)は標準的で、`局所幅≈2×dist`・`dist>=R/2` を厚さ判定に用いる(pipeline.ts:290-296)。設計の許容範囲内。細長 fixture で内部点0(test.ts:181-201)・太い領域で>0(test.ts:203-218)を実測で確認。

3. **provenance 焼き込み先** — 妥当。ユーザー判断「v7診断は provenance のみ」に整合。qualityMetrics を純幾何に留め、source ID(`outline-v7-margin-contour-rgba`)経由で operation 層が transformHistory に記録する既存機構に載せる。preview スキーマ非変更の制約を守る唯一の合理的接続先。

4. **フォールバック接続先** — 妥当。mesh-generation.ts(diff)`createV7FallbackToV6Chain` が既定 `createV6DAdaptiveContourConstrainautorMeshResult` を再利用し、v7ステップを `fallbackSteps` 先頭に差し込む。v7分岐は v6分岐の**前**に置かれ(dispatcher L144-150)、textureBytes欠如/生成失敗のいずれでも v7ステップが provenance に残る。テスト test.ts:400-437 が alpha空(`v7-margin-contour-alpha-empty`)・texture欠如(`texture-bytes-unavailable`)の両フォールバックで v7ステップ先頭記録を assert。

---

## 自分で実行した検証

- `vitest run …mesh-generation-v7-margin-contour.test.ts` → **16/16 pass**
- `vitest run …mesh-generation.test.ts`(v6決定性回帰の核) → **76/76 pass**(v6座標同一が維持されている証左)
- `pnpm run typecheck` → **pass**
- `pnpm run check:source` → **pass**(全v7ファイル1200行以下: parameters 150 / pipeline 696 / margin-contour 305 / test 722 / .d.ts 15)
- `git diff HEAD` による Domain B 実変更の分離(contract は V7追加のみ・model-edit.ts は無変更)

---

## 質問(Orch-Sylph 経由でユーザー/L0 へ)

1. **`mesh-quality-metrics.ts` の位置づけ確認**: v7 backend が `computeMeshQualityMetrics`(mesh-quality-metrics.ts)を import している。これは V6型を参照する共有統計ヘルパだが、v6"バックエンド"ではなく統合層の quality メトリクス計算部(§6 の「統合層=読んで従う」に属する)。v7 は純幾何オプションのみ渡し v6Metrics 系は一切触れないため設計適合と判断したが、「v7 は mesh-geometry と外部ライブラリのみに依存」という §5-6 の文言を厳密に取ると、この共有ヘルパ依存の可否を wave レベルで明示確認しておきたい(将来の v6一括削除時、この共有ヘルパは V6型定義を持つため v6削除の対象になり得るか=v7が孤立しないか、の観点)。**現状は設計違反と判断していない**(統合層ヘルパであり v6アルゴリズム流用ではないため)が、系統分離の厳密性についての裁定があれば申し送りたい。

2. **Gnome 申し送りの pointKey 丸め解釈**: L0裁定どおり実装済み(事前 `roundCoordinate` 丸め→中立非丸めDP、丸め版新設・中立DP変更なし)を本レビューでも確認した。追加対応不要という Gnome の解釈は設計適合レーンとして妥当と判断する。この確認結果を L0 へ返して差し支えないか。

(モノレポ横断の既存12 fail / check:deps 既存fail は本レーンの設計適合観点の対象外。Domain D ゲートの申し送りとして Gnome レポートに記載済み。)
