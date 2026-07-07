# Perf Wave 1 — Domain P-A Report（フェーズ計測 + 合成ベンチ）

> Domain: `perf-wave1-instrumentation`
> 実装担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph）
> Status: Implemented（2026-07-07）／ 挙動不変・計測のみ・最適化なし

## 1. 実装サマリ（変更 / 新規ファイル）

| ファイル | 種別 | 役割 |
|---------|------|------|
| `apps/editor/src/workspace/canvas/canvas-evaluation.ts` | 変更 | `createCanvasEvaluatedScene` に内訳フェーズ計測を2点追加（`canvas.evaluation.keyform.ms` / `canvas.evaluation.deformerVertex.ms`）。既存 `canvas.evaluation.ms`（全体）は保持。評価結果・順序・数値は一切不変。 |
| `apps/editor/src/workspace/canvas/synthetic-heavy-model.ts` | 新規 | 規模パラメータから**決定的**に合成 `AuthoringSession` を生成する関数 `createSyntheticHeavyModelSession`。乱数・時刻・環境状態を一切使わない純関数。 |
| `apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts` | 新規 | 合成モデルの決定性・スケール反映・評価パス到達・非破壊の単体テスト（常時実行）＋ 内訳計測ベンチ（`RUN_PERF_BENCH=1` の時のみ実行）。 |
| `discussion/render-performance/measurements/baseline-synthetic.md` | 新規 | 実測値・環境・再現手順・仮説 A/B/C の読み。 |
| `discussion/render-performance/implementation/waves/perf-wave1/domain-pa-report.md` | 新規 | 本レポート。 |

`packages/**` は一切変更していない（計測フックはすべて apps/editor 内に閉じた。受け口となる
`startLive2dPerformanceTiming` / `recordLive2dPerformanceTiming` は既存 export を利用）。

## 2. フェーズ計測の設計

### 挿した stats キー一覧

| stats キー | 測る区間 | 備考 |
|-----------|---------|------|
| `canvas.evaluation.ms`（既存・保持） | `createCanvasEvaluatedScene` 全体 | 内訳と全体の整合確認の基準。 |
| `canvas.evaluation.keyform.ms`（新規） | `createEvaluatedParameterKeyformState(...)` の呼び出し1区間（canvas-evaluation.ts の keyform サンプリング） | 仮説B（keyform 全量再サンプリング）の実測。 |
| `canvas.evaluation.deformerVertex.ms`（新規） | `session.graph.drawables.map(...).filter(...).sort(...)` の全体（= デフォーマ chain 頂点変形 `applyRigControlChainToVertices` + `cloneMesh`/`cloneVec2` clone + bounds 計算を含む） | 仮説A（頂点変形 × 多重クローン × toFixed）の実測。支配項。 |
| `canvas.projection.ms`（既存・流用） | `createCanvasRenderProjection` 全体 | 仮説Bの projection 全量再構築を内包。ベンチは新規計装せず既存値を内訳として拾う。 |
| `canvas.renderSceneAdapter.ms`（既存・流用） | `createRenderSceneFromCanvasProjection` 全体 | 描画 submit 手前までの終端。 |

### OFF 時ゼロコストの構造（ガード位置）

計測は `startLive2dPerformanceTiming()` / `recordLive2dPerformanceTiming()` の既存ペアだけを使う。

- `startLive2dPerformanceTiming()` は OFF 時に `null` を即返す（内部で `isLive2dPerformanceEnabled()`
  1回 → `performance.now()` は呼ばない）。
- `recordLive2dPerformanceTiming(name, startMs)` は `startMs === null` で即 return（`performance.now()`
  も stats 割り当ても行わない）。
- 計測の start / record は **すべてホットループ（`drawables.map(...)` や頂点 `.map(...)`）の外側**に
  置いた。ガード外で配列・オブジェクトを新規割り当てしていない（`timingStart` / `keyformTimingStart`
  / `deformerVertexTimingStart` は `number | null` のスカラのみ）。
- したがって OFF 時の追加コストは **「関数呼び 3回 + null 比較 3回」/ 評価1回**のみ（drawable 数・頂点数
  に依存しない）。これが OFF時ゼロコストの生命線。

コード上の位置（canvas-evaluation.ts）:
- `keyformTimingStart` を keyform 呼び出しの直前で取り、直後に record。
- `deformerVertexTimingStart` を `drawables` 生成の `.map` チェーン直前で取り、`.sort(...)` 直後に record。
- 既存 `timingStart`（全体）/ `recordLive2dPerformanceTiming("canvas.evaluation.ms", ...)` は変更なし。

## 3. 合成ベンチの設計

### 規模パラメータ（`SyntheticHeavyModelScale`）

`{ drawableCount, verticesPerMesh, deformerChainDepth, keyformSetCount }`。仮説A の効き
O(Σ 頂点数 × chain 深) の全因子を独立に振れる。

### 決定性の担保

- 乱数・`Date.now()` 等を一切使わない。全要素を index の数式から生成（頂点はグリッド、bounds は
  index 由来の格子配置、texture bytes は `(index + drawableIndex*7) % 256`、digest hex も seed 文字列
  から決定的）。
- **同一パラメータ → 同一 session** をテストで検証（`serializeSessionShape` で `Uint8Array` も含めて
  JSON 化し `.toEqual`）。時間計測値そのものは変動してよい（検証対象はモデル生成の同一性のみ）。
- スケール反映もテスト（drawables / meshes / keyformSets / rigControls の件数、各 mesh の頂点数、
  binary entry 数がパラメータ通りか）。

### adapter まで到達させる工夫

render-scene adapter は `isRenderableDrawable`（`renderBytes.byteLength === renderWidth*renderHeight*4`）
を要求する。合成モデルは:
- 各 mesh の**宣言 bounds** を固定タイル（4×4）にして `resolveDrawableRenderDimensions` の
  renderWidth/Height を決定的にする（mesh の**頂点**は別途 100×100 相当の広域に配置し、deform コストは
  維持）。
- `binaryAssets.fileEntries` に 4×4×4 = 64 バイトの RGBA を drawable ごとに用意。
これで全 drawable が projection → adapter を生き延び、adapter の計測に意味が出る（テストで
`scene.drawables.length === drawableCount` を検証）。

### 実行手段の選択（既存慣行との整合と理由）

- **テストファイル形式**を選択。既存の計測前例（`viewer-runtime-screen.test.ts`,
  `render-scene.test.ts`）が「`__LIVE2D_PERF__=true` → 対象呼び出し → `getLive2dPerformanceStats()`
  読み」を**テスト内**で行う慣行に最も整合するため。
- ただし**重い内訳計測（heavy scale × 20 反復）は既定 skip**。`describe.skipIf(!runPerfBench)` で
  `RUN_PERF_BENCH=1` の時のみ実行。CI 相当の通常実行（フラグ無し）では決定性・非破壊の軽量テスト4件
  のみ走り、重い計測は走らない。決定性検証は常時テストで担保。
- vitest.config の include（`apps/*/src/**/*.test.ts`）は `.bench.test.ts` にもマッチする（実行確認済み）。

### 実行コマンド

```
# 通常（計測 skip・CI 相当）
npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts

# 計測実行（PowerShell）
$env:RUN_PERF_BENCH = "1"; npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts
# 計測実行（bash）
RUN_PERF_BENCH=1 npx vitest run apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts
```

## 4. 合成ベンチ内訳実測サマリと支配項の読み

（環境: Win11 / Ryzen 7 5700X / Node v22.14.0。totalMs = 20 反復合計、avgMs = 1 評価あたり。全数値は
`measurements/baseline-synthetic.md` に完全版。）

| scale | evaluation 全体 avg | keyform avg | deformerVertex avg | deformerVertex / 全体 | adapter avg |
|-------|--------------------|-------------|--------------------|-----------------------|-------------|
| light  | 0.828ms   | 0.030ms | 0.405ms   | 49% | 0.058ms |
| medium | 12.430ms  | 0.078ms | 8.755ms   | 70% | 0.231ms |
| heavy  | 186.738ms | 0.263ms | 161.476ms | 86% | 2.526ms |

**読み**:
- **仮説A が支配的**。deformerVertex（頂点変形 + 多重クローン + toFixed）が evaluation 全体の
  49→70→86% と、規模拡大につれ支配度を増す（O(Σ 頂点数 × chain 深) と整合）。処方の第一標的。
- **仮説B はほぼ無関係**。keyform は全 scale で 0.3ms 未満・全体の 0.1〜0.3%。keyformSet を drawable と
  同数まで増やしても効かない。projection 側の全量再構築（仮説Bのもう半分）も evaluation↔projection の
  差 heavy で約3.7ms と小さい。
- **仮説C は本ベンチの射程外**。合成モデルはマスク未使用・WebGL2 submit は node で実行不可のため測って
  いない（下記 §5 の実モデル手順で観測する）。

## 5. ユーザー実モデル計測手順（Editor 上で内訳数値を取る）

Editor Canvas / Editor Viewer は本計測の対象パス（`createCanvasRenderProjection`）をそのまま通るため、
計測フラグを立ててスライダーを操作するだけで内訳が溜まる。

### 有効化方法（どちらか）

1. ブラウザ DevTools コンソールで
   ```js
   globalThis.__LIVE2D_PERF__ = true;
   ```
   （その場で有効。リロードで消える。）
2. 永続化したい場合は
   ```js
   localStorage.setItem("live2dPerf", "1");
   ```
   （`isLive2dPerformanceEnabled()` が localStorage も見る。リロード後も有効。）

### 手順

1. 重いと感じる実モデルを Editor で開く。
2. 上記いずれかで計測を有効化。
3. `globalThis.__LIVE2D_PERF_STATS__` が残っていれば、コンソールで
   ```js
   globalThis.__LIVE2D_PERF_STATS__ = undefined; // 直前の集計をリセット（任意）
   ```
4. **重いパラメータのスライダーを数秒スクラブ**する（各 tick で評価+描画が走る）。
5. 集計を読む:
   ```js
   console.table(globalThis.__LIVE2D_PERF_STATS__.timings);
   console.table(globalThis.__LIVE2D_PERF_STATS__.counters);
   ```

### 実モデルで見るべき stats キー一覧

内訳（timings。totalMs / count / maxMs を持つ。avg = totalMs / count で算出）:

| キー | 意味 | 対応仮説 |
|------|------|---------|
| `canvas.evaluation.ms` | 評価1フレーム全体 | 全体基準 |
| `canvas.evaluation.keyform.ms` | keyform 全量再サンプリング区間 | B |
| `canvas.evaluation.deformerVertex.ms` | デフォーマ chain 頂点変形 + clone（支配項候補） | A |
| `canvas.projection.ms` | projection 再構築全体（evaluation 内包） | A+B |
| `canvas.renderSceneAdapter.ms` | render-scene 変換（描画 submit 手前まで） | — |
| `viewer.cleanStageProjection.ms` | Editor Viewer 経路の projection（Viewer で操作した場合） | A+B |

描画側（counters。マスク多用時の仮説C を見る。値は累積回数）:

| キー | 意味 |
|------|------|
| `webgl2.bufferDataCalls` | 頂点/インデックスの毎フレーム再アップロード回数（drawable 数に比例） |
| `webgl2.textureCacheHits` | テクスチャキャッシュヒット（再アップロードが起きていないことの裏取り） |
| `canvas.renderScene.textureSources` | scene のテクスチャ数 |
| `parameterBar.rawEvents` / `.coalescedUpdates` / `.appliedFrames` | 入力コアレシングの効き（入力頻度 vs 実評価回数） |

**読み方の指針**: スクラブ後に `canvas.evaluation.deformerVertex.ms` の totalMs が
`canvas.evaluation.ms` totalMs の大半（合成ベンチでは 85% 超）を占めていれば、合成ベンチの読み（仮説A
支配）が実モデルでも再現していると確認できる。逆に `canvas.projection.ms − canvas.evaluation.ms` や
描画カウンタが大きければ、実モデル固有に仮説B/Cの寄与がある兆候。

## 6. テスト結果

| 対象 | 結果 |
|------|------|
| `synthetic-heavy-model.bench.test.ts`（計測 skip） | 4 passed / 3 skipped |
| `synthetic-heavy-model.bench.test.ts`（`RUN_PERF_BENCH=1`） | 7 passed（計測3件込み） |
| `canvas` ディレクトリ全体（11 ファイル） | 98 passed / 3 skipped |
| ├ canvas-evaluation.test.ts | 16 passed |
| ├ canvas-projection.test.ts | 20 passed |
| ├ canvas-render-scene-adapter.test.ts | 4 passed |
| `viewer` ディレクトリ全体（6 ファイル、evaluation 共有経路） | 68 passed |
| `npx tsc --noEmit`（root typecheck） | pass（TYPECHECK_OK） |
| `node scripts/check-source-organization.mjs`（check:source） | pass（catch-all 名なし・行数上限内） |
| `node scripts/check-dependencies.mjs`（check:deps） | pass |
| `npx tsc --noEmit -p apps/editor/tsconfig.json`（新規ファイル起因エラー） | synthetic-heavy-model.ts 起因 0件（既存 baseline 22件はスコープ外） |

レビュー後修正: `synthetic-heavy-model.ts` の branded 型修正（`drawableIds` / `rigControlRootIds` 配列宣言と
`appendDrawableRigControlChain` パラメータを `string[]` → `DrawableId[]` / `RigControlId[]`）で、
`apps/editor/tsconfig.json` を直接叩いた際の**新規ファイル起因の型エラー 2件（TS2322）を解消（0件に）**。
branded 型は実行時 string と同一表現のため挙動不変・モデル生成の決定性（byte 一致テスト）は維持
（修正後も 4 passed / 3 skipped）。

挙動不変の実証: canvas-evaluation / canvas-projection / canvas-render-scene-adapter を含む既存テストが
すべて green。合成モデルの非破壊テストも green（評価が session を変異させない）。apps/editor の既知
baseline fail（diagnostics-jump-actions 4件）はスコープ外のため未実行。

## 7. 内訳計測の粒度限界

- **clone を deformerVertex から切り分けられていない**（意図的）。`applyRigControlChainToVertices`
  と `cloneMesh`/`cloneVec2` は drawable ごとの `.map()` 内で密結合し、その内側に start/record を置くと
  計測 OFF 時にも drawable 数ぶんの関数呼び出しが乗り、OFF時ゼロコストが崩れる。よって deformerVertex は
  「頂点変形 + clone を含む一括値」。clone 単独の内訳を取るには評価ロジック（packages 側含む）の非自明な
  リファクタが必要で、本 wave のスコープ外（かつ最適化の先行実装に接近する）。契約「無理な計測用
  リファクタで挙動を変えるより粒度限界を正直に報告」に従った選択。
- keyform + deformerVertex は evaluation 全体を下回る（heavy で約13%差）。差は deformerVertex 区間外の
  index Map 構築・rig control 評価・artworkBounds で、いずれも仮説A系コスト。二重計上はない
  （`measurements/baseline-synthetic.md` §6 に詳細）。

## 8. 質問 / escalate

- **escalate: なし**。packages/** の評価ロジック変更は不要だった。環境変更（pnpm install 等）も不要。
- **質問（設計者向け・判断に迷った点）**:
  1. clone 単独の内訳（頂点変形本体 vs cloneMesh vs cloneVec2 の3層）を分離した数値が改善設計に必要か。
     必要なら、計測 OFF 時ゼロコストと両立する形（例: 評価層の構造変更を伴う専用計測ビルド）を別 wave で
     設計する必要がある。本 wave では deformerVertex 一括に留めた。
  2. 実モデル計測は上記 §5 の手順で足りるか。Editor UI 上に計測トグル/表示を出す方が使いやすいなら、
     それは UI 変更（挙動変更）になるため本 wave スコープ外 → 別途判断が必要。
  3. 仮説C（マスク FBO）を定量化するには、マスク付き合成モデル + WebGL2 実行環境（jsdom + headless GL
     など）が要る。現状ベンチは node のため未対応。実モデルの webgl2 カウンタで代替する前提でよいか。
