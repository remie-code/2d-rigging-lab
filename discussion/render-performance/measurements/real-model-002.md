# 実モデル計測 002(Perf Wave 1.2 の新スパン+呼び出し元カウンタ)

> Status: Recorded(2026-07-07)
> 計測者: ユーザー(domain-pb-report §6 手順)。Canvas でのスライダー操作、Viewer 非表示(001と同条件)

## 生データ

timings(count 92 = 評価回数):

| key | count | totalMs | maxMs | avg | evaluation比 |
|---|---|---|---|---|---|
| indexBuild | 92 | 49.5 | 7.8 | 0.54ms | 0.4% |
| keyform | 92 | 525.7 | 16.6 | 5.7ms | 4.5% |
| rigControlEval | 92 | 274.7 | 7.2 | 3.0ms | 2.3% |
| deformerVertex | 92 | 1985.1 | 40.4 | 21.6ms | 17.0% |
| **artworkBoundsAndAssembly** | 92 | **8868.8** | 129.0 | **96.4ms** | **75.8%** |
| evaluation 全体 | 92 | 11706.5 | 159.9 | 127.2ms | 100% |
| projection | 92 | 11908.2 | 162.2 | 129.4ms | — |
| renderSceneAdapter | **46** | 18.6 | 0.7 | 0.4ms | — |

counters(抜粋): `canvas.evaluation.caller.canvas = 92`(viewer系・unknown は**出現なし**)/ webgl2.meshUploads 1610・bufferDataCalls 3220・meshUploadVertexBytes 約3.5MB / parameterBar.slider.rawEvents 34・coalescedUpdates 7

## 確定事項

1. **gap 主犯 = `artworkBoundsAndAssembly`(75.8%)で確定**。合成 rigHeavy probe(77.3%)と構造一致し、被覆率も99.98%(内訳合計11703.8 vs 全体11706.5)。区間内の容疑は `createCanvasEvaluatedRigControls`(rig control 全量再構築+cloneVec2) — 内部分離計測(Perf Wave 1.3)で確定させる
2. **単一経路の二重評価が確定**: caller は `canvas` のみで 92 = renderSceneAdapter(46)のちょうど2倍。Viewer 系・unknown はゼロ。**Canvas 経路が1描画あたり評価を2回実行しとる** → 根本原因の特定(読み取り調査)で修正可能なら即効≈2倍
3. 実効フレームコスト ≈ 2評価 × 127ms ≈ **254ms/フレーム(≈4fps)**。二重評価解消で≈127ms、artworkBoundsAndAssembly 解消でさらに大幅短縮の余地
4. 副次観測: webgl2.meshUploads 1610 ≈ 35メッシュ × 46フレーム — 全メッシュを毎フレーム再アップロードしとる(バイト量は小さく現状の主犯ではないが、設計時の副次項目)

## 次

- Perf Wave 1.3: artworkBoundsAndAssembly の内部分離計測(rigHeavy probe で分解値を取得)
- 並行: 二重評価の根本原因の読み取り調査
- 両方の結果が揃い次第、改善設計の対話へ
