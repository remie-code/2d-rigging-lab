# Perf Wave 1.2 — Domain P-B Report（計測細分化 + 呼び出し元タグ）

> Domain: `perf-wave1_2-gap-breakdown`
> 実装担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph, Perf Wave 1.2）
> Status: Implemented（2026-07-07）／ 挙動不変・計測のみ・最適化なし

本 wave の本質: 実モデル計測001で判明した2つの未解明 — evaluation 内の **gap≈78%** の正体と、評価が
描画の2倍走る現象 — を**計測で**確定可能にする。挙動・評価結果・数値・順序は一切変えていない。

## 1. 実装サマリ（変更 / 新規ファイル）

| ファイル | 種別 | 役割 |
|---------|------|------|
| `apps/editor/src/workspace/canvas/canvas-evaluation.ts` | 変更 | evaluation 全体スパンの内側を **5 スパン**に細分化（新規 3: indexBuild / rigControlEval / artworkBoundsAndAssembly）。呼び出し元タグ用に `CanvasEvaluationCaller` 型 + `evaluationCaller` オプションを追加し、`canvas.evaluation.caller.*` カウンタを1回記録。評価結果・順序・数値は一切不変。 |
| `apps/editor/src/workspace/canvas/canvas-projection.ts` | 変更 | `CanvasProjectionOptions` に `evaluationCaller?` を追加し `createCanvasEvaluatedScene` へ受け渡し（未指定時は展開しない = 既存挙動不変）。 |
| `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` | 変更 | Canvas 経路に `evaluationCaller: "canvas"` を設定。 |
| `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx` | 変更 | ViewerRuntime 経路に `evaluationCaller: "viewerRuntime"` を設定。 |
| `apps/editor/src/workspace/viewer/viewer-clean-stage.ts` | 変更 | ViewerCleanStage 経路に `evaluationCaller: "viewerCleanStage"` を設定。 |
| `apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts` | 変更 | 計測面を新 5 スパンに追従（console.table + 被覆率 + caller counter table）。gap 再現 probe（rigHeavy）を BENCH_SCALES に1点追加。常時実行のタグ検証テスト2件を追加。 |
| `discussion/render-performance/measurements/baseline-synthetic-v2.md` | 新規 | 新スパンでの再実測・被覆率・gap 再現結果。 |
| `discussion/render-performance/implementation/waves/perf-wave1.2/domain-pb-report.md` | 新規 | 本レポート（完了の合図）。 |

`packages/**` は一切変更していない（`recordLive2dPerformanceCounter` / `recordLive2dPerformanceTiming` /
`startLive2dPerformanceTiming` は既存 export を利用しただけ）。`synthetic-heavy-model.ts`（fixture 生成）
は無変更（byte 一致テスト維持）。

## 2. gap 細分化の設計

### 挿した stats キー一覧（時系列順）

| # | stats キー | 種別 | 測る区間 |
|---|-----------|------|---------|
| 1 | `canvas.evaluation.indexBuild.ms` | 新規 | 関数冒頭の index/Map 群構築（partsById / meshesById / textureEntriesById / binaryEntriesByPath / createSourceLayerIndex / editorHiddenPartIds / createStructureDrawOrderIndex） |
| 2 | `canvas.evaluation.keyform.ms` | 既存・保持 | `createEvaluatedParameterKeyformState` 1 区間 |
| 3 | `canvas.evaluation.rigControlEval.ms` | 新規 | createEvaluationRigControls + rigControlsById + createRigControlEvaluationOrder + createDirectRigControlByDrawableId + createMaskSourceIndex + createMeshDraftIndex + variantVisibilityPredicate 解決 |
| 4 | `canvas.evaluation.deformerVertex.ms` | 既存・保持 | `session.graph.drawables.map(...).filter(...).sort(...)` 全体（頂点変形 + clone + bounds） |
| 5 | `canvas.evaluation.artworkBoundsAndAssembly.ms` | 新規 | unionRects（artworkBounds）+ 末尾 scene 構築（createCanvasEvaluatedRigControls + maskRelations map） |
| — | `canvas.evaluation.ms` | 既存・保持 | 全体（内訳と全体の整合基準） |

### OFF時ゼロコストのガード位置（構造で示す）

- 追加した start は全て `startLive2dPerformanceTiming()`（OFF 時 `null` 即返し）。record は
  `recordLive2dPerformanceTiming(name, start)`（`start === null` で即 return）。counter は
  `recordLive2dPerformanceCounter(name)`（OFF 時即 return）。全て `packages/**` の既存 export。
- 追加した `indexBuildTimingStart` / `rigControlEvalTimingStart` /
  `artworkBoundsAndAssemblyTimingStart` は**すべて `number | null` のスカラ変数**。ガード外で配列・
  オブジェクトを新規割り当てしていない。
- start / record は**すべてホットループ（`drawables.map(...)` や頂点 `.map(...)`）の外側**に置いた。
  区間 4（deformerVertex）の内側 = clone と密結合するループには一切食い込んでいない。
- caller counter は `` `canvas.evaluation.caller.${options.evaluationCaller ?? "unknown"}` `` の
  テンプレートリテラル1本を全体 record の直前で1回だけ評価。文字列連結は評価1回あたり定数個
  （drawable 数・頂点数に非依存）。**counter helper 自体が OFF 時に即 return するため、OFF 時は
  この文字列連結の結果も stats 割り当ても発生しない**（helper に渡す前の連結は起きるが、O(1) の
  文字列連結1回のみで、ループ非依存・割り当ては短命な文字列1個）。
- したがって OFF 時の追加コストは「関数呼び 3回（新 start）+ 3回（新 record）+ null 比較 + counter
  呼び 1回 + O(1) 文字列連結1回」/ 評価1回のみ。drawable 数・頂点数に非依存。**これが OFF時
  ゼロコストの生命線**。

### 区間の非オーバーラップ実証（隙間ゼロ・二重計上なし）

各スパンの record は次のスパンの start の**直前**に隣接している。canvas-evaluation.ts の実際の縫い目:

```
timingStart = start()                          # 全体 開始
indexBuildTimingStart = start()                # [1] 開始
  … partsById … frontOrderByDrawableId …
record("indexBuild.ms", indexBuildTimingStart) # [1] 終了 ─┐ 隣接
keyformTimingStart = start()                   # [2] 開始 ─┘
  … createEvaluatedParameterKeyformState …
record("keyform.ms", keyformTimingStart)       # [2] 終了 ─┐ 隣接
rigControlEvalTimingStart = start()            # [3] 開始 ─┘
  … createEvaluationRigControls … variantVisibilityPredicate …
record("rigControlEval.ms", rigControlEvalTimingStart) # [3] 終了 ─┐ 隣接
deformerVertexTimingStart = start()            # [4] 開始 ─────────┘
  … drawables.map().filter().sort() …
record("deformerVertex.ms", deformerVertexTimingStart) # [4] 終了 ─┐ 隣接
artworkBoundsAndAssemblyTimingStart = start()  # [5] 開始 ─────────┘
  … unionRects … scene = { …, createCanvasEvaluatedRigControls, maskRelations } …
record("artworkBoundsAndAssembly.ms", artworkBoundsAndAssemblyTimingStart) # [5] 終了
recordCounter("caller.*")
record("evaluation.ms", timingStart)           # 全体 終了
```

- **隣接ペア**: [1] record → [2] start／[2] record → [3] start／[3] record → [4] start／
  [4] record → [5] start。各ペアの間には**新規オブジェクト割り当てを伴う処理は一切ない**（次の
  start を取るだけ）。
- 各区間が重複しないことは、上記のとおり record が次の start より前に来る（時系列で交わらない）
  ことで保証される。**二重計上はない**。
- **被覆率で実証**（baseline-synthetic-v2.md §5）: 5 スパンの totalMs 合計が evaluation 全体の
  **99.28〜99.99%**（全 scale 残余 < 1%）。目標（残余 < 10%）を大幅達成。残余（<1%）は隣接ペア間の
  関数呼び+null 比較 + 末尾の caller counter 記録に相当。

## 3. 被覆率

| scale | breakdownTotalMs | wholeTotalMs | 被覆率 | 残余 |
|-------|-----------------|-------------|-------|------|
| light    | 24.381   | 24.558   | 99.28% | 0.72% |
| medium   | 263.894  | 264.151  | 99.90% | 0.10% |
| heavy    | 3819.625 | 3820.175 | 99.99% | 0.01% |
| rigHeavy | 1343.448 | 1343.920 | 99.97% | 0.03% |

**全 scale で残余 < 1%、目標（<10%）を大幅にクリア**。v1 で heavy 約 13% あった「deformerVertex 区間外の
未計測」は、indexBuild / rigControlEval / artworkBoundsAndAssembly の 3 スパンでほぼ完全に説明された。

## 4. 呼び出し元タグの設計（二重評価の切り分け）

### options のどの層に置いたか

- タグの**受け口は `CanvasEvaluationOptions`**（canvas-evaluation.ts）に `evaluationCaller?:
  CanvasEvaluationCaller`（読み取り専用フィールド）。**評価ロジックの分岐には一切使わず**、全体 record
  直前の `recordLive2dPerformanceCounter` にのみ渡す。
- **中継は `CanvasProjectionOptions`**（canvas-projection.ts）に同名フィールドを追加し、
  `createCanvasEvaluatedScene` へ受け渡す（未指定時は展開しない = 既存挙動不変）。
- 型 `CanvasEvaluationCaller = "canvas" | "viewerRuntime" | "viewerCleanStage"` を canvas-evaluation.ts
  で export し、projection でも import 共有。

### 3 経路のタグ

| 呼び出し箇所 | 設定タグ | counter キー |
|-------------|---------|-------------|
| `canvas-preview-panel.tsx`（createProjection） | `"canvas"` | `canvas.evaluation.caller.canvas` |
| `viewer-runtime-screen.tsx`（originalProjection） | `"viewerRuntime"` | `canvas.evaluation.caller.viewerRuntime` |
| `viewer-clean-stage.ts`（createViewerCleanStageRenderSourceProjection） | `"viewerCleanStage"` | `canvas.evaluation.caller.viewerCleanStage` |
| （タグ未指定の呼び出し・テスト等） | `"unknown"`（既定） | `canvas.evaluation.caller.unknown` |

### count 突合方法

- **`caller.*` カウンタの総和 = `canvas.evaluation.ms` の count** になる（どの評価も1回だけ、いずれかの
  caller に集計され、取りこぼしがない）。突合テストは常時実行の「evaluation caller counters」で実証:
  - タグ有無で projection が byte 一致（`JSON.stringify` 比較）→ タグは評価結果に影響しない。
  - `caller.canvas` = 1 / `caller.unknown` = 1、総和 = evaluation count。
  - 3 経路のタグがそれぞれ専用カウンタに 1 ずつ振り分けられる。

### タグが評価挙動に影響しないことの担保

- `evaluationCaller` は record にしか使わない読み取り専用フィールド。ロジック分岐なし。
- 常時実行テストで「同一 session をタグ有り / 無しで評価 → projection が byte 一致」を検証済み。

## 5. 合成ベンチ v2 の内訳（gap の再現有無・支配項）

詳細は `baseline-synthetic-v2.md` §7。要点:

- **通常 scale（light/medium/heavy）**: deformerVertex が 58.7% → 69.3% → 86.5% と支配。gap の中身は
  artworkBoundsAndAssembly（heavy 10.9%）> rigControlEval（heavy 2.1%）> indexBuild/keyform（各 <0.3%）。
  **実モデルの gap≈78% 構造は再現できない**（合成は頂点コストが常に支配）。
- **rigHeavy probe（drawables=200 / verticesPerMesh=4 / chainDepth=8 / rigControls=1600）**:
  頂点を絞り rig control を最大化した結果、**deformerVertex が 9.9% に陥落、artworkBoundsAndAssembly が
  77.3% で支配項に**（rigControlEval 11.8% と合わせ deformerVertex 外が約 90%）。**実モデルの
  「deformerVertex 17% / gap≈78%」と構造的に一致 = 合成でも gap 構造を再現できた**（重要な発見）。
- **含意**: 実モデルの gap の主犯は、頂点変形本体ではなく **artworkBoundsAndAssembly 区間内の
  `createCanvasEvaluatedRigControls`（rig control 数 × chain 適用 + cloneVec2 の全量再構築）である
  可能性が濃厚**。確定は実モデル計測（§6）で `artworkBoundsAndAssembly` が gap の主犯かを見る。

### fixture 追加検証の結果（Required impl #3）

`SyntheticHeavyModelScale` には rig control 数を独立に増やす軸がなく（rig control 数 = drawableCount ×
deformerChainDepth に連動）、fixture 生成ロジックの拡張はしなかった（byte 一致テスト維持のため）。
代わりに**既存軸の組み合わせで「rig 過多 / 頂点少」の1点（rigHeavy）を追加**し、gap 支配構造の再現に
成功した。「合成は実モデルの gap 構造を再現できない」という v1 の結論は、**通常 scale に限れば真だが、
rig control 過多の条件を与えれば再現できる**と精緻化された。

## 6. ユーザー手順の差分（前回 domain-pa-report §5 との差分だけ）

有効化方法・スクラブ手順・stats 読み出し（`console.table(...timings)` / `console.table(...counters)`）は
domain-pa-report §5 と**同一**。以下が Perf Wave 1.2 での**差分**。

### 差分1: timings に新スパン 3 キーが増えた

`console.table(globalThis.__LIVE2D_PERF_STATS__.timings)` に以下が追加で並ぶ:

| 新キー | 意味 | 読み方 |
|-------|------|-------|
| `canvas.evaluation.indexBuild.ms` | 冒頭 index/Map 群構築 | 通常は小さいはず。ここが大きければ session graph の走査コストが支配 |
| `canvas.evaluation.rigControlEval.ms` | rig control 評価 + 各種 index 構築 | rig control 数が多いと伸びる。gap の一部 |
| `canvas.evaluation.artworkBoundsAndAssembly.ms` | unionRects + createCanvasEvaluatedRigControls + maskRelations | **実モデルの gap の主犯候補**。ここが deformerVertex を上回れば「gap の正体は rig control 再構築系」と確定 |

**被覆率の確認**: `keyform + indexBuild + rigControlEval + deformerVertex + artworkBoundsAndAssembly` の
totalMs 合計が `canvas.evaluation.ms` totalMs の 90% 以上を占めていれば、内訳が全体をほぼ説明できている
（v2 合成では 99% 超）。

**gap の主犯の読み分け**（実モデルで期待される分岐）:
- `deformerVertex` が evaluation 全体の大半（80% 超）→ 合成 heavy と同型（頂点変形支配）。処方は頂点変形へ。
- `artworkBoundsAndAssembly`（+ `rigControlEval`）が deformerVertex を上回る → 合成 rigHeavy と同型。
  実モデル計測001の「deformerVertex 17% / gap 78%」はこちらに該当する見込み。処方は
  createCanvasEvaluatedRigControls（rig control 全量再構築）へ。

### 差分2: counters に呼び出し元カウンタが増えた（二重評価の切り分け）

`console.table(globalThis.__LIVE2D_PERF_STATS__.counters)` に `canvas.evaluation.caller.*` が並ぶ。
実モデル計測001の「evaluation count（72）= renderSceneAdapter（36）の2倍」の正体を、この分布で切り分ける:

| 観測パターン | 結論 |
|-------------|------|
| `caller.canvas` と `caller.viewerRuntime`（or `viewerCleanStage`）が**両方**カウントされ、各々が renderSceneAdapter と同数 | **2 surface**（Canvas と Viewer が別々に評価）。合計が2倍になる |
| **`caller.canvas` だけ**が renderSceneAdapter の**2倍** | **単一経路（Canvas のみ）の二重評価**。約2倍の即効改善源。実モデル計測001の「Viewer 非表示」証言と整合するのはこちら |
| いずれの caller にも該当しない未知の count | 別の消費者（インスペクタ等）が評価を回している |

**突合**: `caller.*` カウンタの総和 = `canvas.evaluation.ms` の count（必ず一致するはず。一致しなければ
タグ未設定の第4の呼び出し経路がある兆候 → `caller.unknown` に出る）。

## 7. テスト結果（全 gate）

| gate | 対象 | 結果 |
|------|------|------|
| 挙動不変 | `canvas` + `viewer` ディレクトリ全体（17 ファイル） | **168 passed / 4 skipped**（fail 0）。canvas-evaluation.test.ts(16) / canvas-projection.test.ts(20) / canvas-render-scene-adapter.test.ts(4) / viewer 全件を含む |
| 挙動不変 | `synthetic-heavy-model.bench.test.ts`（計測 skip） | 6 passed / 3 skipped（caller テスト2件込み） |
| ベンチ計測 | `synthetic-heavy-model.bench.test.ts`（RUN_PERF_BENCH=1） | 10 passed（新スパン count 検証 + gap probe 込み） |
| ベンチ決定性 | byte 一致テスト（is deterministic） | pass（synthetic-heavy-model.ts 無変更・維持） |
| typecheck | `npx tsc --noEmit`（root） | **pass（ROOT_TSC_OK）** |
| typecheck | `npx tsc --noEmit -p apps/editor/tsconfig.json` | 総エラー 22件（既存 baseline）。**変更5ファイル起因の新規エラー 0件**（下記注） |
| check:source | `node scripts/check-source-organization.mjs` | **pass** |
| check:deps | `node scripts/check-dependencies.mjs` | **pass** |

**apps/editor tsconfig エラーの内訳注**: 総エラー 22件はすべて既存 baseline。私が触った5ファイル
（canvas-evaluation.ts / canvas-projection.ts / canvas-preview-panel.tsx / viewer-clean-stage.ts /
viewer-runtime-screen.tsx）起因のエラーは**0件**（フィルタで実証）。viewer-runtime-screen.tsx に2件の
TS2379 が出るが、これは L431 `resolveViewerRuntimeParameterValues` と L444 `createViewerRenderSourceProjection`
の exactOptionalPropertyTypes 起因で、**私の変更前から存在**（git stash 状態で baseline=26件・同2件を確認）。
私の1行追加で行番号が 444→445 にずれただけ。既知 baseline fail（diagnostics-jump-actions 4件）は
スコープ外のため未実行。

## 8. 粒度限界（正直な報告）

- **artworkBoundsAndAssembly は複合区間**（unionRects + createCanvasEvaluatedRigControls +
  maskRelations map）。rigHeavy で支配したのがこの 3 者のどれか（ほぼ確実に createCanvasEvaluatedRigControls
  だが unionRects の可能性も残る）は**分離していない**。分離するには maskRelations map や unionRects の
  `.map()`（ホットループ）内側に計測を刺す必要があり OFF時ゼロコストが崩れる懸念があるため、複合区間に
  留めた。実モデルで artworkBoundsAndAssembly が gap 主犯と確定した場合、その内部分離は次 wave の課題。
- **deformerVertex の clone 単独分離は v1 と同じく未実施**（`applyRigControlChainToVertices` と
  `cloneMesh`/`cloneVec2` は drawable ごとの `.map()` 内で密結合。内側に計測を置くと OFF 時に drawable 数
  ぶんの関数呼びが乗る）。契約「無理な計測リファクタで挙動を変えるより粒度限界を正直に報告」に従った。
- **rigControlEval も複合**（createEvaluationRigControls + 4 つの index 構築 + variantVisibilityPredicate
  解決）。ただし rigHeavy で 11.8% と副次的で、主犯は artworkBoundsAndAssembly 側なので、現状の粒度で
  gap の主犯特定には十分。

## 9. 質問 / escalate

- **escalate: なし**。packages/** の評価ロジック・計測 API 変更は不要（既存 export のみ使用）。環境変更
  （pnpm install 等）も不要。OFF時ゼロコストと被覆率目標（<10%）は両立できた（残余 <1% 達成）。
- **質問（設計者向け・判断に迷った点）**:
  1. **rigHeavy probe を CI 相当の常時テストに含めるべきか**。現状 BENCH_SCALES に入れたので
     `RUN_PERF_BENCH=1` 時のみ実行（決定性・非破壊の軽量テストには影響なし）。改善設計で「rig 過多で
     gap 構造が出る」ことを回帰的に守りたいなら、rigHeavy を軽量な非計測 assertion（例: 特定 scale で
     artworkBoundsAndAssembly > deformerVertex）として常時テスト化する案があるが、時間計測ベースの
     assertion は環境依存で fragile なため本 wave では見送った。判断を仰ぐ。
  2. **artworkBoundsAndAssembly の内部分離（createCanvasEvaluatedRigControls 単独計測）を次 wave で
     やるか**。実モデルでこの区間が gap 主犯と確定した場合に必要。OFF時ゼロコストと両立するには、
     createCanvasEvaluatedRigControls を独立関数化して呼び出しの外側で1区間計測する形（rigControls 配列
     の `.map()` はその関数の内側なのでガード外の割り当てなしで計測可能）が有力。これは計測用の軽い
     構造変更で挙動不変にできる見込みだが、本 wave のスコープ外。
  3. **実モデルでの読み分け（§6 差分2）で `caller.unknown` に count が出た場合**、タグ未設定の第4の
     評価経路が存在することになる。現状 3 経路のみ調査済み。第4経路が見つかったら別途タグ追加が必要。
