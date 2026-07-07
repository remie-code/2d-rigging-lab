# Mesh Wave 1 / Domain A レビュー: 中立部品抽出

> Domain id: `mesh-wave1-neutral-geometry`
> レビュー担当: Review-Sylph(Opus 4.8)。呼び出し元: Orch-Sylph(Domain A)。
> 日付: 2026-07-07
> 検証方法: Gnome レポートの主張に依存せず、`git diff` の全読、各中立モジュールの実ファイル通読、元コードとの逐条突合、テストの自己再実行による独立検証。

## 判定

**合格**

v6系ファイルに埋まっていたアルゴリズム中立部品が新設 `packages/authoring-core/src/mesh-geometry/**` へ抽出され、v6系3ファイルは import 切替(委譲)に変更されている。抽出は「純粋な移動 + 委譲」に限られ、数値挙動を変える改変(丸め・tie-break・スコアリング・近傍列挙・fallback)の混入は**確認されなかった**。合格条件の核である決定性回帰(座標同一)は自己再実行で全 green を確認した。write scope・命名規約も遵守。要修正なし。

## 1. v6挙動バイト同一の検証結果(最重要 / diff を読んだ上での結論)

`git diff` で v6系3ファイルの全変更を読み、各中立モジュールを元コードと逐条突合した。結論: **挙動改変の混入なし。純粋な移動+委譲**。

### 中立モジュールの元コード同一性(全9モジュールを実読・突合)

| モジュール | 元の所在 | 突合結果 |
|---|---|---|
| `geometry-primitives.ts` | v6-contour-pipeline 末尾の private ヘルパー群 | `roundCoordinate`(1e-6丸め・-0正規化)/ `roundPixelPoint` / `pointKey`(**1e-6丸め付き**)/ `comparePoint` / `clamp` / `clampInt`(Math.trunc)/ `distance`(hypot)/ `getFourNeighbors` / `mustGet` / `distanceToSegment` / `distanceToClosedPolyline` / `polygonPerimeter` / `polygonSignedArea` / `isPointInsideMask` / `isOpaqueAt` すべて**バイト同一**。エラーメッセージ文言のみ `v6 contour pipeline internal...` → `mesh-geometry internal...` に変更(throw パスのみ・数値挙動に無影響) |
| `alpha-mask.ts` | v6-contour-pipeline `createSoftAlphaMask` 系 | `createSoftAlphaMask` / `blurAlphaAt`(3x3重み4-2-1)/ `closeSinglePixelCracks`(近傍≥5)/ `removeIsolatedAlphaNoise`(α<0.5 かつ近傍≤1)/ `countOpaqueNeighbors` / `expandMask`(反復4近傍膨張)すべて**バイト同一**。閾値 `0.18` は第5引数デフォルト値として保持、v6は省略呼びで従来通り |
| `connected-components.ts` | v6-contour-pipeline `findOpaqueComponents` 系 | flood fill / `selectMainComponent`(面積降順→bounds tie-break)/ `createComponentMask` / `countHoleLikeRegions`(touchesBounds判定)すべて**バイト同一** |
| `boundary-tracing.ts` | v6-contour-pipeline `traceBoundaryLoops` 系 | エッジ列挙順・outgoingEdges の `comparePoint(end)` ソート・unused 最小 start ソート・ループ縫合・`normalizeLoop` / `rotateLoopToStableStart`(comparePoint最小回転)/ `ensurePositiveLoopOrientation` / `selectOuterLoop`(|符号面積|降順→lexicographic tie-break)すべて**バイト同一** |
| `boundary-resampling.ts` | v6-contour-pipeline `sampleBoundaryLoop` 系 | `targetCount` クランプ式・周長沿い等間隔サンプル・4軸極値アンカー・`distance`昇順+`comparePoint` tie-break・`dedupeOrderedPoints`(丸めキー)すべて**バイト同一** |
| `interior-point-sampling.ts` | v6-contour-pipeline `sampleInteriorSteinerPoints` 系 | 格子候補生成(step/2オフセット)・クリアランスfilter・`Math.max(64, max*24)` スライス・farthest-point 貪欲(`selectNextInteriorCandidateIndex` の score=min(boundaryDist, selectedDist)、tie で `compareInteriorCandidates`)・`selectBestInteriorPixelCenter` fallback すべて**バイト同一** |
| `alpha-island-components.ts` | v6-alpha-islands 全体 | `detectRawAlphaIslands` / `filterAlphaIslands` / `createAlphaIslandRgbaBytes` / `allocateAlphaIslandBudgets` / `unionAlphaIslandPixelBounds` / `isAlphaIslandTinyNoise`(8定数閾値)/ `calculateIslandBudgetWeight` / `allocateIntegerBudgets`(fractional remainder の `fraction→weight→componentOrder` tie-break)/ `roundMetric` すべて**バイト同一**。名前のみ `V6_` 前置除去 |
| `polyline-simplification.ts` | mesh-outline-generation `simplifyContourLoop` 系(v1〜v4世代) | 再帰DP `simplifyOpenPolyline` / `simplifyContourLoop`(凹点保護)/ `collectProtectedConcavityPointKeys` / `removeCollinearPoints`(cross閾値1e-7)/ `capContourVertices` / `rotatePoints` / `findLexicographicPointIndex` / `findFarthestPointIndex` / `pointToSegmentDistance` すべて**バイト同一**。**`pointKey = `${x}:${y}`(非丸め)を元コード通り保持** — これはバイト同一保存として正しい判断(下記§5・質問1参照) |

抽出時に「丸め・tie-break ソート・近傍列挙・スコアリング・fallback」を1文字も変えていないことを、9モジュール全ての逐条読で確認した。Gnome の「実装をそのまま移設」の主張は事実。

### v6系ファイルの委譲切替の健全性

- **`mesh-generation-v6-contour-pipeline.ts`**: 内部ヘルパー実装を全削除し、`mesh-geometry/{alpha-mask,connected-components,boundary-tracing,boundary-resampling,interior-point-sampling,geometry-primitives}` から import。オーケストレーション本体(`createV6ContourCandidateInput` 分岐・診断構築)は据え置き。`V6ContourPoint`/`V6ContourPixelBounds` は中立 `GeometryPoint`/`PixelBounds` の **type alias 再定義**(構造同一)。v6固有の `getDensityParameters`・`createConstraintEdges`・`createV6ContourPipelineProvenance`・`pixelBoundsToStageRect` は残置。**唯一の呼び出しシグネチャ変更**は `sampleInteriorSteinerPoints({..., densityParameters})` → `sampleInteriorSteinerPoints({..., parameters})` のプロパティ名リネームだが、渡す値は同一の `V6ContourDensityParameters` であり、中立側は `input.parameters.{interiorSpacing,maxInteriorVertices,interiorBoundaryClearance}` を参照(構造的部分集合として適合)。**挙動不変**。
- **`mesh-generation-v6-alpha-islands.ts`**: 実装全体を中立モジュールへ移動、当ファイルは `V6...` 名の type alias + const 再割当(委譲)に薄化。唯一の消費者 `mesh-generation-v6d-adaptive-contour-constrainautor.ts` が使う7シンボル(`V6RawAlphaIslandDescriptor` / `V6_ALPHA_ISLAND_NOISE_FILTER_CONSTANTS` / `detectV6RawAlphaIslands` / `filterV6AlphaIslands` / `createV6AlphaIslandRgbaBytes` / `allocateV6AlphaIslandBudgets` / `unionV6AlphaIslandPixelBounds`)が**全て保持**されていることを grep で確認。
- **`mesh-outline-generation.ts`**: 自前DPを削除し `mesh-geometry/polyline-simplification.ts` へ切替。DP専用に閉じていた未使用化ヘルパー7件を削除。他所で使う `removeConsecutiveDuplicatePoints` / `comparePoints` / `polygonArea` / `pointKey` / `pointsEqual` / `squaredDistance` / `clampInt` は**残置を確認**。呼び出し `.map((loop) => simplifyContourLoop(loop, config))` は無変更。`OutlineConfig`(`simplifyEpsilon`/`interiorDivisions`/`minInteriorSpacing`/`contourVertexCap`)は `ContourSimplificationConfig`(`simplifyEpsilon`/`contourVertexCap`)の構造的上位集合であり、そのまま渡って挙動不変(typecheck pass が裏付け)。

## 2. expandMask パラメータ化の v6不変

契約 Required(「上限8pxクランプは中立版でパラメータ化して解除・v6経路は既存値を渡して挙動不変」)を満たすことを確認。

- 中立 `resolveMaskExpansionPixels(value, maxExpansionPixels = DEFAULT_MAX_MASK_EXPANSION_PIXELS)`、`DEFAULT_MAX_MASK_EXPANSION_PIXELS = 8`。
- v6経路は `resolveMaskExpansionPixels(input.maskExpansionPixels)` と**第2引数省略**で呼ぶ → 上限8に解決 → 従来 `clampInt(Math.round(value), 0, 8)` と**完全一致**。
- 上限クランプの解除形: `expandMask` 自体は反復回数 = `expansionPixels` の純関数で、クランプは `resolveMaskExpansionPixels` 側に分離済み。将来 v7 は第2引数に広い上限を渡せる(smoke テスト L97-100 が `resolveMaskExpansionPixels(20, 32)===20` / `(100, 32)===32` で解除可能性を検証)。契約の Required を正しく実装している。

## 3. farthest-point 間隔R制御の v6不変

- 中立 `sampleInteriorSteinerPoints` は `InteriorSamplingParameters { interiorSpacing, maxInteriorVertices, interiorBoundaryClearance }` を受け、**間隔R = `interiorSpacing` として既に明示パラメータ**。追加のシグネチャ拡張なしで R 明示制御を満たす(契約の「追加できるシグネチャ」を充足)。
- v6経路は v6 の `V6ContourDensityParameters`(同名3フィールドを含む)をそのまま渡す。候補生成順・スコアリング・tie-break・fallback は移設で完全保存 → v6 の選択座標は不変。決定性回帰 v6d(mesh-generation.test.ts:1909)の exact 座標 pass がこれを担保。

## 4. 多島の中立化

`mesh-generation-v6-alpha-islands.ts` の再エクスポート委譲で、唯一の消費者 `mesh-generation-v6d-adaptive-contour-constrainautor.ts` が使う `V6...` シンボルが全て保持されていることを grep で確認済み(§1参照)。中立 `alpha-island-components.ts` の実装は元とバイト同一。typecheck pass が参照整合を裏付け。

## 5. write scope 遵守 / 命名・構成規約

- **write scope**: `git diff --name-only` の変更は v6系3ファイル(`mesh-generation-v6-contour-pipeline.ts` / `mesh-generation-v6-alpha-islands.ts` / `mesh-outline-generation.ts`)のみ。新設は `packages/authoring-core/src/mesh-geometry/**`(9ファイル)と discussion 配下(wave/review)。**Forbidden scope への抵触なし**: `mesh-generation-contract.ts` 無変更 / `apps/**` 無変更 / `pnpm-lock.yaml` 無変更(git status/porcelain で lockfile 変更ゼロを確認)/ 新規外部依存なし。
- **命名・構成**: `mesh-geometry/` 配下に禁止 catch-all 名(types/schemas/utils/helpers)なし。ファイル名に v6/v7 を含まない中立命名。`check:source` pass(禁止名・1200行上限に抵触なし)。全ファイルは 1200 行を大きく下回る。

## 6. 自己再実行したテスト結果

すべてリポジトリルートで**自分で実行**(Gnome の報告値と一致することを独立に確認)。

| 検証 | コマンド | 結果 |
|---|---|---|
| **決定性回帰(合格条件の核)** | `pnpm exec vitest run packages/authoring-core/src/mesh-generation.test.ts` | **76/76 passed**。決定性回帰**14個**が全 green: v1(auto-outline)L758 / v2 L135 / v2 regression L232 / v2.5 L264 / v2.6 L399 / v3 L525 / v4 L632 / v6 contour candidate L1209 / v6a L1327 / v6b L1444 / v6b thin L1513 / v6c L3407 / v6d L1909 / v6d support-rings L2771。exact 座標 `toMatchObject` / `toEqual` 検証で1座標でも動けば fail する構造 → **座標同一保存を担保**。**DP抽出の影響を受ける v1〜v4 系(L758/135/232/264/399/525/632)が含まれる**点が polyline-simplification のバイト同一を裏付ける |
| authoring-core 全体 | `pnpm exec vitest run packages/authoring-core` | **260/260 passed(34 files)**。中立 smoke 12件を含む |
| operation層(統合) | `pnpm exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts` | **34/34 passed** |
| 型 | `pnpm run typecheck`(tsc --noEmit) | **pass** |
| 構成 | `pnpm run check:source` | **pass** |
| 依存 | `pnpm run check:deps` | **fail(Domain A 非起因を独立確認)**。下記参照 |

### check:deps の fail が Domain A 非起因であることの独立確認

`pnpm run check:deps` は `pnpm-lock.yaml: lockfile mentions forbidden dependency class (Cubism cmo3 parser/runtime dependency)` で fail する。Domain A 非起因の判断は妥当:

- `git status --porcelain | grep lock` で lockfile への変更が**ゼロ**であることを確認した(Domain A は lockfile を一切触っていない)。
- fail 理由は Cubism cmo3 パーサ/ランタイム依存であり、メッシュ生成(mesh-geometry 抽出)とは**別領域**。抽出変更集合(v6系3ファイル + mesh-geometry/)のいずれもこの依存に関与しない。
- 変更ファイル集合に lockfile が含まれない以上、この fail は Domain A の成果物と論理的に独立。Gnome の git stash 再現主張(baseline でも同一 fail)と整合する。回避工作の痕跡なし。

## 7. 裁量判断の妥当性評価

1. **index.ts バレル無変更**: 妥当。中立モジュールはパッケージ内相対 import で v6/v7 が共有する内部実装であり公開 API に載せる必要がない。`geometry-primitives.ts` の `PixelBounds` export は既存 `mesh-generation-v6d-contour-constrainautor.ts` の `PixelBounds` と名前衝突するため、`export *` でバレルに載せると曖昧再エクスポートを招く。v6 の既存公開面(`V6...` 名)は従来通り re-export されており公開 API は不変。契約「re-export が必要な場合のみ index.ts 追記可」に照らし、必要が生じない以上の無変更は正しい。
2. **`mesh-outline-generation.ts` からの dead helper 削除7件**: 妥当。DP 移設で未使用化した private ヘルパーの機械的整理であり、削除対象は全て移設先に取り込み済み。`noUnusedLocals` 通過に必要。v2.5/v3 が持つ別コピーの `simplifyContourLoop` に触れていないのも write scope とバイト同一保存の観点で正しい(それらは v1〜v4 別経路で本 wave スコープ外)。typecheck pass と v1〜v4 決定性回帰 pass が挙動不変を裏付ける。
3. **中立化の粒度**: 妥当。v6固有の密度パラメータ表(`getDensityParameters`)・provenance 文字列・`createConstraintEdges` を「アルゴリズム中立部品ではなく v6 の統合/密度設計」として残置した判断は concept-design §6(v6系の密度設計・サンプリング方針は中立部品でない)に整合。

## 8. escalate(設計未定義でユーザー判断が要る漏れ)

**なし**。本ドメインの範囲(中立部品抽出 + v6挙動バイト同一保存)は設計・契約で完結しており、実装で埋めた設計分岐は見当たらない。部品はすべて v6 固有ロジックと分離可能で、「移動だけで挙動が変わる構造」も見つからなかった(escalate 条件に該当せず)。

## 9. 質問(Orch-Sylph 経由での申し送り)

Gnome が挙げた2件の質問は、いずれも**本ドメインの合格を妨げない**が、後続ドメインへの申し送りとして妥当。Review-Sylph としても以下の見解を添える:

1. **`polyline-simplification.ts` の `pointKey` 非丸め仕様(Domain B への申し送り要否)**: 中立DPは元 outline generator に合わせ `pointKey = `${x}:${y}`(**丸めなし**)を採用。contour-pipeline 系の `pointKey` は 1e-6 丸め付きで、両者は**意図的に別実装**(コメント L11-15 に明記あり)。**本ドメインでは元挙動のバイト同一保存を優先した非丸め維持が正しい**(v1〜v4 決定性回帰 pass が裏付け)。ただし将来 v7 が DP を使い、かつ v7 の輪郭座標が非整数になり得る場合、`x:y` の文字列キーが浮動小数の表記揺れで衝突・非衝突を誤り得る。**丸め方針の統一要否は Domain B(v7コア)の設計判断**として申し送るのが妥当。Review-Sylph の見解: Domain B が DP を流用する際は、v7 側で座標を事前丸めしてから渡すか、丸め付き `pointKey` 版を別途用意するかを concept-design §2 の決定性要求(座標丸めイディオム)と突き合わせて判断すべき。
2. **check:deps の既存 fail(wave レベルでの是正責任)**: 本ドメイン非起因(§6で独立確認済み)。Domain D(Final Integration)の全体 green 確認ゲートに影響するため、lockfile の Cubism cmo3 依存を「誰が是正するか / 既知の受容状態か」を wave レベルで確認されたい。**これは Domain A の合格判定には影響しない**が、Domain D で全体 green を主張する際に必ず露見する既存状態のため、wave 計画側での取り扱い明確化を推奨。

---

**総括**: Domain A の実装は契約の合格条件(v6挙動バイト同一・決定性回帰全 green)を満たし、expandMask パラメータ化 / farthest-point R制御 / 多島委譲の各 v6不変も担保されている。write scope・命名規約遵守。挙動改変の混入なし。**合格**と判定する。要修正事項なし。上記2件の質問は後続ドメインへの申し送りとして残す。
