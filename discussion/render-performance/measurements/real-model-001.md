# 実モデル計測 001

> Status: Recorded(2026-07-07)
> 計測者: ユーザー(DevTools コンソール手順、domain-pa-report §5)
> モデル: ユーザーの実制作モデル(規模諸元は未記録)。計測条件: Canvas でのパラメータ操作。**Viewer は画面に出ていない**(ユーザー証言 2026-07-07)

## 生データ(console.table)

| key | count | totalMs | maxMs |
|---|---|---|---|
| canvas.evaluation.keyform.ms | 72 | 364.2 | 8.4 |
| canvas.evaluation.deformerVertex.ms | 72 | 1381.5 | 25.4 |
| canvas.evaluation.ms | 72 | 8102.1 | 131.2 |
| canvas.projection.ms | 72 | 8218.5 | 133.0 |
| canvas.renderSceneAdapter.ms | 36 | 11.1 | 0.5 |

## 導出値(1評価あたり平均)

| 区間 | avg | evaluation 比 |
|---|---|---|
| evaluation 全体 | **112.5ms** | 100% |
| deformerVertex(仮説A計測区間) | 19.2ms | **17%** |
| keyform(仮説B) | 5.1ms | 4.5% |
| **計測区間外(gap)** | **≈88ms** | **≈78%** |
| projection(evaluation 内包とみられる) | 114.1ms | — |
| renderSceneAdapter | 0.3ms | — |

## 所見

1. **1評価 平均112ms(max 131ms)** — スライダー操作が体感で破綻する水準(≈9fps 相当)。症状と整合
2. **合成ベンチとプロファイルが乖離**: 合成 heavy では deformerVertex が 86% を占めたが、実モデルでは **17%** に留まり、**evaluation 内の計測区間外(≈78%)が支配的**。区間外の候補は index Map 構築 / rig control 評価 / artworkBounds / 計測区間外のクローン(perf-wave1 の既知の粒度限界)。合成ベンチは実モデルのコスト構造を再現できていない
3. **evaluation の count(72)が renderSceneAdapter(36)の2倍** — Viewer 非表示のユーザー証言により「2 surface 説」は棄却方向。**単一経路(Canvas のみ)で1描画あたり評価が2回走っている疑いが濃厚** = 事実なら設計以前に約2倍の即効改善源。確定は Perf Wave 1.2 の呼び出し元タグで行う(別の消費者〔インスペクタ等〕が評価を回している可能性も同タグで判別)

## 次の含意

- 改善設計の前に**gap の内訳計測(計測区間の細分化)**が必要 — 仮説Aの区間だけでは実モデルの支配項を特定できていない
- 二重評価の正体(2 surface か 1 surface 2回か)の切り分けが必要
