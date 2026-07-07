# Mesh Wave 1 / Domain A 実装レポート: 中立部品抽出

> Domain id: `mesh-wave1-neutral-geometry`
> 実装担当: Gnome(Opus 4.8)。呼び出し元: Orch-Sylph(Domain A)。
> 日付: 2026-07-07

## 判定

**completed**

v6系ファイルに埋まっていたアルゴリズム中立部品を新設 `packages/authoring-core/src/mesh-geometry/**` へ抽出し、v6系ファイルを import 切替(委譲)に変更した。抽出は「純粋な移動 + 委譲」のみで、v6 の数値挙動は座標同一のまま保存されている。合格ゲート(v6 決定性回帰14個を含む `mesh-generation.test.ts` 全 green・座標同一)を満たす。

## 新設した中立モジュール一覧

すべて `packages/authoring-core/src/mesh-geometry/` 配下。命名に v6/v7 を含めず、禁止 catch-all 名(types/schemas/utils/helpers)も未使用。各ファイルは 1200 行上限を大きく下回る。

| ファイル | 担う部品 |
|---|---|
| `geometry-primitives.ts` | 共有プリミティブ: `roundCoordinate`(1e-6丸め・-0正規化)/ `roundPixelPoint` / `pointKey`(丸め付き)/ `comparePoint` / `clamp` / `clampInt` / `distance` / `getFourNeighbors` / `mustGet` / `distanceToSegment` / `distanceToClosedPolyline` / `polygonPerimeter` / `polygonSignedArea` / `isPointInsideMask` / `isOpaqueAt`。型 `GeometryPoint` / `PixelBounds` |
| `alpha-mask.ts` | 二値化 + soft blur(`createSoftAlphaMask`)/ 裂け目埋め / ノイズ除去(内部) / `expandMask`(反復4近傍膨張) / `resolveMaskExpansionPixels`(上限クランプをパラメータ化) / 定数 `DEFAULT_MAX_MASK_EXPANSION_PIXELS`(=8) |
| `connected-components.ts` | 不透明連結成分検出(`findOpaqueComponents`)/ 決定的な主成分選択(`selectMainComponent`)/ 成分マスク生成(`createComponentMask`)/ 穴様領域計数(`countHoleLikeRegions`)。型 `OpaqueComponent` |
| `boundary-tracing.ts` | ピクセル境界エッジ列挙 → 決定的ループ縫合 → 正規化 / 安定始点回転 / 正方向化(`traceBoundaryLoops`)/ 外周ループ選択(`selectOuterLoop`) |
| `boundary-resampling.ts` | 周長沿い等間隔再サンプル + 軸極値アンカー + 順序 dedupe(`sampleBoundaryLoop`)。パラメータ型 `BoundaryResampleParameters` |
| `interior-point-sampling.ts` | 格子候補生成 → 境界クリアランス除外 → farthest-point 貪欲選択(決定的)(`sampleInteriorSteinerPoints`)。パラメータ型 `InteriorSamplingParameters`(`interiorSpacing`=R を明示制御) |
| `alpha-island-components.ts` | 多島(連結成分)検出 / 微小ノイズフィルタ / 頂点予算配分 / 島別RGBA分離 / bounds union(中立名: `detectRawAlphaIslands` / `filterAlphaIslands` / `createAlphaIslandRgbaBytes` / `allocateAlphaIslandBudgets` / `unionAlphaIslandPixelBounds` / 定数 `ALPHA_ISLAND_NOISE_FILTER_CONSTANTS`) |
| `polyline-simplification.ts` | 自前 Douglas-Peucker: 開ポリライン再帰DP(`simplifyOpenPolyline`)+ 閉ループ用ラッパー(凹点保護 + 頂点キャップ、`simplifyContourLoop`)。パラメータ型 `ContourSimplificationConfig` |
| `mesh-geometry-smoke.test.ts` | 中立モジュールの smoke テスト(12件) |

## v6系ファイルの委譲切替内容

- **`mesh-generation-v6-contour-pipeline.ts`**: 内部ヘルパー実装(soft mask / 連結成分 / 境界追跡・再サンプル / farthest-point 内部点 / 幾何プリミティブ)を削除し、`mesh-geometry/{alpha-mask,connected-components,boundary-tracing,boundary-resampling,interior-point-sampling,geometry-primitives}` から import して委譲。公開面(`createV6ContourCandidateInput` / `mapV6ContourPointToStagePoint` / `mapV6ContourPointToUv` / 全 export 型)とオーケストレーション本体(`createV6ContourCandidateInput` の分岐・診断構築・provenance)は据え置き。`V6ContourPoint` / `V6ContourPixelBounds` は中立 `GeometryPoint` / `PixelBounds` の別名として再定義(構造同一)。`getDensityParameters`(v6固有の密度表)/ `createConstraintEdges` / `createV6ContourPipelineProvenance` / `pixelBoundsToStageRect` は v6 固有ロジックとして当ファイルに残置。
- **`mesh-generation-v6-alpha-islands.ts`**: 実装全体を `mesh-geometry/alpha-island-components.ts`(中立名)へ移動し、当ファイルは `V6...` 名の型別名 + 値の再エクスポート(委譲)に薄化。唯一の消費者 `mesh-generation-v6d-adaptive-contour-constrainautor.ts` が import する `V6...` シンボルは全て保持。
- **`mesh-outline-generation.ts`**: 自前DP(`simplifyContourLoop` / `simplifyOpenPolyline` / `collectProtectedConcavityPointKeys`)を削除し `mesh-geometry/polyline-simplification.ts` へ移設・import に切替。DP専用に閉じていた未使用化ヘルパー(`findLexicographicPointIndex` / `findFarthestPointIndex` / `rotatePoints` / `pointToSegmentDistance` / `capContourVertices` / `removeCollinearPoints` / `clamp`)は移設先に取り込まれたため当ファイルから削除(`noUnusedLocals` 対応)。他所で使われる `removeConsecutiveDuplicatePoints` / `polygonArea` / `pointKey` / `pointsEqual` / `comparePoints` / `squaredDistance` / `clampInt` は残置。呼び出し側 `.map((loop) => simplifyContourLoop(loop, config))` は無変更(`OutlineConfig` は `ContourSimplificationConfig` の構造的上位集合のためそのまま渡る)。

### 委譲切替が index.ts バレルに及ばなかった理由(裁量判断)

新中立モジュールは v6/v7 が**パッケージ内相対 import** で共有する内部実装であり、公開パッケージ API に載せる必要はない。加えて `geometry-primitives.ts` の export `PixelBounds` は既存 export(`mesh-generation-v6d-contour-constrainautor.ts` の `PixelBounds`)と名前衝突するため、`export *` でバレルに載せると tsc の曖昧再エクスポートを招く。契約は「re-export が必要な場合のみ index.ts 追記可」であり、必要が生じないため index.ts は無変更とした。v6 の既存公開面(`V6...` 名)は当ファイル群からこれまで通り re-export されており、公開 API に破壊的変更はない。

## expandMask のパラメータ化方針(v6経路不変の担保)

- 中立 `alpha-mask.ts` の `resolveMaskExpansionPixels(value, maxExpansionPixels = DEFAULT_MAX_MASK_EXPANSION_PIXELS)` として上限をパラメータ化。`DEFAULT_MAX_MASK_EXPANSION_PIXELS = 8` は v6 の従来上限を中立既定値として保持。
- v6経路(`mesh-generation-v6-contour-pipeline.ts`)は `resolveMaskExpansionPixels(input.maskExpansionPixels)` と**第2引数を渡さず**呼ぶため、上限は既定の 8 に解決 = 従来の `clampInt(round(value), 0, 8)` と 1ビットも変わらない。
- 将来 v7 は第2引数に広い上限(または呼び出し側でクランプ責務を持つ)を渡すことで 8px の壁を解除できる。`expandMask` 自体は反復回数 = `expansionPixels` の純関数で、クランプは呼び出し側責務に分離済み。

## farthest-point の間隔R制御追加方針(v6経路不変の担保)

- 中立 `interior-point-sampling.ts` の `sampleInteriorSteinerPoints` は `InteriorSamplingParameters { interiorSpacing, maxInteriorVertices, interiorBoundaryClearance }` を受ける。間隔 R は `interiorSpacing` として**既に明示パラメータ**であり、格子刻み・境界クリアランス・上限がすべて呼び出し側から制御可能。追加のシグネチャ拡張なしで R 明示制御を満たす。
- v6経路は従来通り v6 の `V6ContourDensityParameters`(`interiorSpacing` / `maxInteriorVertices` / `interiorBoundaryClearance` を含む)をそのまま渡す(構造的部分集合として適合)。候補生成順・スコアリング・tie-break・fallback は移設で完全保存しており、v6 が呼ぶときの選択座標は不変。
- 将来 v7 は `interiorSpacing` に設計の R を直接渡せる。

## テスト結果

すべてリポジトリルートで実行。

| 検証 | コマンド | 結果 |
|---|---|---|
| **v6決定性回帰(核)** | `pnpm exec vitest run packages/authoring-core/src/mesh-generation.test.ts` | **76/76 passed**。`toMatchObject` による exact vertex/triangle 座標検証を含む**決定性回帰14個が座標同一のまま全 green**(抽出前 baseline も 76/76・同一)。1座標の変化もなし |
| authoring-core 全体 | `pnpm exec vitest run packages/authoring-core` | **260/260 passed(34 files)**。抽出前 248 + 追加した中立 smoke 12 |
| 中立モジュール smoke | `pnpm exec vitest run packages/authoring-core/src/mesh-geometry/mesh-geometry-smoke.test.ts` | **12/12 passed** |
| operation層(統合) | `pnpm exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts` | **34/34 passed** |
| 型 | `pnpm run typecheck`(モノレポ tsc --noEmit) | **pass** |
| 構成 | `pnpm run check:source` | **pass**(禁止名・1200行上限に抵触なし) |
| 依存 | `pnpm run check:deps` | **fail(既存・本ドメイン非起因)**。下記参照 |

### v6回帰14個の座標同一確認

抽出は各中立モジュールへ**実装をそのまま移設**し(丸め・tie-break ソート・近傍列挙・スコアリングの1文字も変えず)、v6 側は同一引数で委譲するのみ。`mesh-generation.test.ts` の決定性回帰14個は exact 座標を `toMatchObject` で検証するため、いずれかの中立化で1座標でも動けば即 fail する。全 green = v6 出力が座標同一で保存されたことの担保。

### check:deps の fail について(質問/blocker ではなく事実報告)

`pnpm run check:deps` は `pnpm-lock.yaml: lockfile mentions forbidden dependency class (Cubism cmo3 parser/runtime dependency)` で fail する。これは**本ドメインの変更に非起因の既存状態**である。検証手順:

1. 当方は lockfile・package.json・依存宣言を一切変更していない(`git status` で `pnpm-lock.yaml` に変更なし)。
2. 当方の変更を `git stash` で退避し pristine baseline に戻して `pnpm run check:deps` を実行 → **同一の fail を再現**。
3. 退避を `git stash pop` で復元済み。

よって環境操作(install / lockfile 変更)は行っておらず、この fail は Domain A の成果物とは独立。回避工作は行っていない。後続レビューで環境差として露呈しないよう、事実として明記する。

## 作成/変更ファイル一覧

新規(untracked):
- `packages/authoring-core/src/mesh-geometry/geometry-primitives.ts`
- `packages/authoring-core/src/mesh-geometry/alpha-mask.ts`
- `packages/authoring-core/src/mesh-geometry/connected-components.ts`
- `packages/authoring-core/src/mesh-geometry/boundary-tracing.ts`
- `packages/authoring-core/src/mesh-geometry/boundary-resampling.ts`
- `packages/authoring-core/src/mesh-geometry/interior-point-sampling.ts`
- `packages/authoring-core/src/mesh-geometry/alpha-island-components.ts`
- `packages/authoring-core/src/mesh-geometry/polyline-simplification.ts`
- `packages/authoring-core/src/mesh-geometry/mesh-geometry-smoke.test.ts`
- `discussion/mesh-generation/implementation/waves/mesh-wave1/domain-a-report.md`(本レポート)

変更(委譲切替のみ):
- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`
- `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts`
- `packages/authoring-core/src/mesh-outline-generation.ts`

## 裁量判断・質問

### 裁量判断(escalate 不要と判断したもの)

1. **index.ts バレル無変更**: 上記「委譲切替が index.ts バレルに及ばなかった理由」の通り。`PixelBounds` の既存 export 衝突回避 + 中立モジュールは内部相対 import 共有で足りるため。公開 API は不変。
2. **`mesh-outline-generation.ts` からの dead helper 削除**: DP 移設で未使用化した private ヘルパー7件を削除した。これは「純粋な移動」に伴う機械的整理であり挙動不変(削除対象は移設先モジュールに取り込み済み)。`noUnusedLocals` を通すために必要。v2.5/v3 が持つ**別コピー**の `simplifyContourLoop` は当ドメインの write scope 外かつ本 wave のスコープ外のため一切触れていない(v6 挙動には無関係)。
3. **中立化の粒度**: v6固有の密度パラメータ表(`getDensityParameters`)や provenance 文字列(`v6-contour-*`)、`createConstraintEdges` は「アルゴリズム中立部品」ではなく v6 の統合/密度設計に属すると判断し、中立モジュールへ移さず v6 ファイルに残置した(concept-design §6「v6系の密度設計・サンプリング方針は中立部品ではない」に整合)。

### 質問(呼び出し元 Orch-Sylph 経由で確認したい点)

1. **`polyline-simplification.ts` の `pointKey` 非丸め仕様**: 中立DPモジュールは元の outline generator に合わせ `pointKey = \`${x}:${y}\``(**丸めなし**)を採用した(contour-pipeline 系の `pointKey` は 1e-6 丸め付きで、両者は意図的に別実装)。これは元コードのバイト同一保存のため正しいが、将来 v7 が DP を使う場合、v7 の座標が非整数になり得るなら丸め方針の統一要否が Domain B の設計判断になり得る。本ドメインでは元挙動保存を優先し統一しなかった。Domain B へ申し送りが要るか。
2. **check:deps の既存 fail**: 上記の通り本ドメイン非起因。Domain D(Final Integration)の全体 green 確認ゲートに影響するため、lockfile の既存状態を誰が是正するか(または既知の受容状態か)を wave レベルで確認されたい。
