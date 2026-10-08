# 合成ヘビーモデル ベースライン計測（Perf Wave 1）

> Status: Recorded（2026-07-07）
> 計測担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph）。挙動不変・計測のみ。
>
> 本ファイルは**決定的合成モデル**での内訳実測。実モデルの数値ではないが、評価ホットパス
> （`createCanvasRenderProjection` → `createCanvasEvaluatedScene`）は Editor Canvas / Editor
> Viewer が共有する実経路そのものなので、フェーズ内訳の**相対比**は実モデルにそのまま読み替え
> られる。絶対値は環境・規模依存。

## 1. 実行環境

| 項目 | 値 |
|------|----|
| OS | Microsoft Windows 11 Home（Windows_NT） |
| CPU | AMD Ryzen 7 5700X 8-Core（16 論理プロセッサ） |
| Node | v22.14.0 |
| ランナー | vitest 3.1.4（environment=node） |
| 計測フラグ | `globalThis.__LIVE2D_PERF__ = true` |
| 反復回数 | 各 scale 20 回（totalMs は 20 回合計、avgMs = totalMs/20） |

計測終端は `createRenderSceneFromCanvasProjection`（= 既存 `canvas.renderSceneAdapter.ms`）まで。
WebGL2 の実描画 submit は node 環境で実行不可のため**ベンチには含まれない**（後述 §5）。

## 2. 再現手順

```
# apps/editor のテストは root の pnpm test に含まれないため対象ファイルを直接指定する。
# 重い計測は既定 skip（RUN_PERF_BENCH を立てた時のみ実行）。

# 決定性・非破壊の単体テストのみ（計測は skip・CI 相当）
npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts

# 内訳計測を実行（PowerShell）
$env:RUN_PERF_BENCH = "1"; npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts

# 内訳計測を実行（bash）
RUN_PERF_BENCH=1 npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts
```

計測値は `console.table` で標準出力に出る（phase / count / totalMs / avgMs / maxMs）。

規模パラメータ（`SyntheticHeavyModelScale`）:

| scale | drawableCount | verticesPerMesh | deformerChainDepth | keyformSetCount |
|-------|--------------|-----------------|--------------------|-----------------|
| light  | 8   | 16  | 1 | 8   |
| medium | 40  | 64  | 3 | 40  |
| heavy  | 120 | 256 | 6 | 120 |

heavy は「症状が出る」規模を狙った（chain 深 6 × 頂点 256 × drawable 120）。

## 3. 実測値（totalMs は 20 反復合計 / avgMs は 1 評価あたり）

### light（drawables=8, verticesPerMesh=16, chainDepth=1, keyformSets=8）

| phase | count | totalMs | avgMs | maxMs |
|-------|-------|---------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 16.556 | 0.828 | 1.616 |
| canvas.evaluation.keyform.ms | 20 | 0.604 | 0.030 | 0.127 |
| canvas.evaluation.deformerVertex.ms | 20 | 8.094 | 0.405 | 0.582 |
| canvas.projection.ms | 20 | 19.099 | 0.955 | 1.713 |
| canvas.renderSceneAdapter.ms | 20 | 1.154 | 0.058 | 0.279 |

### medium（drawables=40, verticesPerMesh=64, chainDepth=3, keyformSets=40）

| phase | count | totalMs | avgMs | maxMs |
|-------|-------|---------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 248.596 | 12.430 | 14.094 |
| canvas.evaluation.keyform.ms | 20 | 1.554 | 0.078 | 0.100 |
| canvas.evaluation.deformerVertex.ms | 20 | 175.101 | 8.755 | 10.510 |
| canvas.projection.ms | 20 | 259.030 | 12.951 | 14.657 |
| canvas.renderSceneAdapter.ms | 20 | 4.630 | 0.231 | 0.761 |

### heavy（drawables=120, verticesPerMesh=256, chainDepth=6, keyformSets=120）

| phase | count | totalMs | avgMs | maxMs |
|-------|-------|---------|-------|-------|
| canvas.evaluation.ms（全体） | 20 | 3734.763 | 186.738 | 203.785 |
| canvas.evaluation.keyform.ms | 20 | 5.262 | 0.263 | 0.634 |
| canvas.evaluation.deformerVertex.ms | 20 | 3229.528 | 161.476 | 180.512 |
| canvas.projection.ms | 20 | 3808.215 | 190.411 | 206.930 |
| canvas.renderSceneAdapter.ms | 20 | 50.520 | 2.526 | 9.043 |

## 4. 支配項の読み（仮説 A/B/C との対応）

| 観測 | 読み |
|------|------|
| **deformerVertex が evaluation 全体の 85〜86% を全 scale で一貫して占める**（light 49% → medium 70% → heavy 86%）。scale を上げるほど支配度が増す（O(Σ 頂点数 × chain 深) と整合） | **仮説A（頂点変形 × 多重クローン × toFixed 正規化）が支配的**。これが処方の第一標的。 |
| **keyform は全 scale で 0.03〜0.26ms、evaluation 全体の 0.1〜0.3% にすぎない** | **仮説B（keyform 全量再サンプリング）は本ベンチ規模では実質無関係**。keyformSet 数を drawable と同数まで増やしても効かない。projection 側の全量再構築（仮説Bのもう半分）は下記の evaluation↔projection 差に含まれるが、それも小さい（§6）。 |
| adapter は heavy でも 2.5ms（全体の 1.3%）。マスク無しモデルなので FBO 再レンダリングは発生しない | **仮説C（描画 + マスク FBO）は本ベンチでは測っていない**（node のため WebGL2 submit 不可・マスク未使用）。実モデルで別途 webgl2 カウンタでの観測が必要（§5・report 参照）。 |

**結論**: 合成ベンチの範囲では **仮説A が圧倒的に支配的**、仮説B はほぼ寄与せず、仮説C は本ベンチの
射程外。処方は「頂点変形本体（chain 各段 × 全頂点の新規オブジェクト生成 + `normalizeTransformNumber`
の `toFixed` 文字列往復 + 評価→projection→adapter の多重クローン）」に集中投下するのが妥当、という
実測上の読み。ただし確定はユーザー実モデル計測（§5・report）と合わせて。

## 5. ベンチで測れないもの（実モデル計測で補う）

- **描画 submit（WebGL2 の bufferData / drawElements / マスク FBO 再レンダリング）**: node 環境では
  実行不可。実モデルでは `webgl2.bufferDataCalls` / `webgl2.textureCacheHits` 等のカウンタで観測。
- **マスク付き drawable の毎フレーム FBO 再描画（仮説C）**: 合成モデルはマスク未使用。実モデルで
  マスク多用時のみ効く。
- 実モデルでの内訳計測手順は domain report
  （`discussion/render-performance/implementation/waves/perf-wave1/domain-pa-report.md`）の
  「ユーザー実モデル計測手順」を参照。

## 6. 内訳の整合性と粒度限界

- **keyform + deformerVertex < evaluation 全体**: heavy で 0.263 + 161.476 = 161.7ms に対し全体
  186.7ms。差 **約 25ms（13%）は deformerVertex 区間の外**にある処理 — 冒頭の index Map 群構築、
  `createEvaluationRigControls`（rig control 評価 + `createWarpRestControlPoints`）、
  `createCanvasEvaluatedRigControls`（rig control ごとの chain 適用）、`unionRects`（artworkBounds）。
  これらも同じ `normalizeTransformNumber` / clone を使うため仮説A系のコストで、deformerVertex に
  数えていないだけ。二重計上ではない。
- **projection 全体 > evaluation 全体**: projection は内部で evaluation を呼び、その後 projection 側の
  `cloneEvaluatedMesh` / `structuredClone(bounds)` / `createProjectionContentKey` を足す。heavy で
  190.4 − 186.7 = **約 3.7ms** が projection 固有の上乗せ。小さい（仮説Aの多重クローンの3段目に相当
  するが、頂点変形本体に比べれば軽い）。
- **clone を deformerVertex から切り分けられていない**: 頂点変形本体（`applyRigControlChainToVertices`）
  と `cloneMesh` / `cloneVec2` は drawable ごとの `.map()` の内側で密結合しており、その内側で
  start/record を呼ぶと計測 OFF 時にも drawable 数ぶんの関数呼び出しが乗る（OFF時ゼロコストが崩れる）。
  よって **deformerVertex は「頂点変形 + clone を含む一括値」** として測り、clone 単独の内訳は取って
  いない。これは契約（無理な計測用リファクタで挙動を変えるより粒度限界を正直に報告する）に従った
  意図的な選択。clone 単独の寄与を分離するには評価ロジック（packages 側含む）の非自明な変更が要り、
  本 wave のスコープ外（最適化の先行実装にもなる）。
