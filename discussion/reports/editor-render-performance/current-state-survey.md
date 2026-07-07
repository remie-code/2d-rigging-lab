# Editor / Viewer レンダリング性能 現状把握調査

> Status: Recorded(2026-07-07)
>
> 本レポートは**リポジトリ事実**（file:line で裏付け）を主とする。推測・仮説は各所で「【推測】」「【仮説】」と明示的に分離している。実測（ベンチ実行）は行っておらず、計算量・アロケーション特性はコード読解に基づく静的推定である。
>
> 調査担当: Sylph（サブエージェント委任 / 呼び出し元 Undine）。読み取り専用。

## 症状（ユーザー報告）

デフォーマを細かく作り込んだモデルで、パラメータスライダーを動かすと Editor Canvas の描画が極端に重い。Editor 内 Viewer(Runtime Player プレビュー)でも同様。

---

## 0. エグゼクティブサマリ（結論先出し）

- Editor Canvas も Editor 内 Viewer も、パラメータ変更のたびに **`createCanvasRenderProjection` → `createCanvasEvaluatedScene`（`apps/editor/src/workspace/canvas/canvas-evaluation.ts`）で全 drawable・全 rig control・全 keyformSet を丸ごと再評価**する。差分評価・dirty tracking・メモ化は評価層に**存在しない**（事実）。
- この評価パスは、頂点座標を `{x,y}` オブジェクト（`Vec2Dto`）で表現し、**デフォーマ chain の各段・各頂点で新規オブジェクト配列を生成**し、しかも座標ごとに `normalizeTransformNumber`（= `Number(value.toFixed(12))`、文字列化を伴う）を複数回呼ぶ。「デフォーマが細かい（chain 深い / 頂点多い）× スライダー操作」で最も効くのはここ、というのが**最有力仮説**。
- 頂点配列は評価 → projection → render-scene-adapter の3段で**繰り返しディープコピー**される（事実）。
- 描画そのもの（WebGL2）はテクスチャをキャッシュしており、GPU ラスタライズは通常 CPU 評価より軽い。ただしマスク付き drawable は毎フレーム別 FBO へマスクを再レンダリングするため、マスク多用時に draw call が増える（事実）。**render-software** の CPU ラスタライザは Editor 実描画には使われておらず（テスト/PNG エクスポート用）、症状の主因ではない可能性が高い。
- スライダー連打自体は **rAF コアレシング**で 1 フレームに統合済み（事実、`raf-coalesced-number.ts`）。よって「入力頻度」ではなく「1フレームあたりの評価+描画コスト」が重い。
- 計測機構は runtime-core / render-core に存在するが（`recordLive2dPerformanceTiming` 等）、**定量ベースラインは未記録**（backlog L125）。

---

## 1. ホットパス: スライダー1tick → 再評価 → 再描画

### 1.1 呼び出し連鎖（Editor Canvas）

1. **スライダー UI**: `apps/editor/src/workspace/panels/parameter-bar.tsx`（`ParameterSlider`）。pointer move で値算出 → `useRafCoalescedNumberCommit().schedule(value)`。
2. **rAF コアレシング**: `apps/editor/src/workspace/controls/raf-coalesced-number.ts` L54-68 `schedule`。同一フレーム内の複数 tick は 1 つの `requestAnimationFrame` に統合（L59-61 で `coalescedUpdates` カウント、L64-67 で rAF 登録）。次フレームで `commitPending` → `onCommit(value)`。**スロットリングは存在する**（フレーム単位）。
3. **セッション state 反映**: `apps/editor/src/features/editor-session/editor-session-context.tsx` の `setActiveParameterValue`（該当ハンドラ）→ `setParameterValues`（React `useState`）。値が変わらなければスキップ（差分ガードあり、ただし値単位のみ）。**同期**。
4. **projection 再計算**: `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` L156-188。`createProjection` は依存配列に `parameterValues` を含み（L181）、`projection = useMemo(() => createProjection(), [createProjection])`（L188）。`parameterValues` が変わると projection 全体を再計算。**同期**。
5. **描画**: 同ファイル L287-309 の `useEffect`。依存に `renderProjection`（毎 tick 新オブジェクト）を含むため、**毎 tick `renderCanvasProjection` を実行**。→ `canvas-renderer.ts` → WebGL2 `renderer.render(createRenderSceneFromCanvasProjection(...))`。

### 1.2 全量再評価か差分か（事実）

**全量**。`createCanvasEvaluatedScene`（`canvas-evaluation.ts` L207-354）は毎回:
- 全 keyformSet を再サンプリング（後述 2.2）
- `session.graph.drawables` を**無条件に `.map()`**（L244-332）し、各 drawable で rig control chain を頂点全体に適用
- 変更されたパラメータに依存する drawable/デフォーマだけを選ぶ**部分再評価の仕組みは無い**（コード上、パラメータ→影響 drawable の依存グラフや dirty フラグが存在しない）。

> 【注記】ホットパス調査（サブエージェント）は当初「変更パラメータに影響を受けるデフォーマのみ評価」と記述したが、`canvas-evaluation.ts` L244 の直接読解では全 drawable を無条件に処理しており、絞り込みは無い。**直接読解を一次情報として採用**する。

### 1.3 同期/非同期

- 入力→commit: **非同期**（rAF 1 フレーム遅延、コアレシングあり）
- commit 後の state更新・評価・描画: **すべて同期**（1 フレーム内でブロッキング実行）

---

## 2. 評価層アーキテクチャ（authoring 経路 / runtime-core 経路）

Editor Canvas と Editor 内 Viewer が使うのは **authoring 側の `canvas-evaluation.ts` 経路**（下記 2.1-2.4）。エクスポート済みモデルの再生（apps/runtime-player）は **runtime-core 経路**（2.5）で、別実装だが特性は類似。

### 2.1 Editor Canvas 評価の中核（`canvas-evaluation.ts`）— 事実

`createCanvasEvaluatedScene`（L207-354）1 回の主コスト:

- **頂点変形の本体**: `applyRigControlChainToVertices`（L718-741）。chain の各 rig control ごとに `current.map(...)` で**新しい `Vec2Dto[]` を生成**（L731-737）。頂点数 N、chain 深さ D なら **O(N×D) の新規オブジェクト生成**。
- **1頂点あたり**: `applyRigControlToPoint`（L767）→ warp なら `applyWarpLatticeToPoint`（L816-855）。格子セルの双線形補間で複数の `interpolateVec2` を呼び、**そのたびに `normalizeTransformNumber`**（L1159-1165、`Number(value.toFixed(12))`）。回転なら `applyRotationToPoint`（L793、`Math.cos/sin` + `normalizeTransformNumber`）。
- **メッシュ複製**: `cloneMesh`（L885-895）で全 drawable のメッシュ頂点・UV・三角形を毎回 `.map()` 複製。
- **`normalizeTransformNumber`**（L1159-1165）: 決定性正規化のため `toFixed(12)`（数値→文字列→数値）を**全頂点変換のたびに複数回**呼ぶ。文字列生成を伴う高コスト演算。

計算量（1 評価あたり、【推測】オーダー）:
- keyform サンプリング: O(K)（全 keyformSet、各 O(log(keys)) 前後）
- 頂点変形: **O(Σ_drawable (N_d × D_d))** ここで N_d=drawable の頂点数、D_d=その drawable の rig control chain 深さ。「デフォーマが細かい」= D_d が大きい / N_d が大きい ほど二乗的に効く。

### 2.2 keyform 評価（`parameter-keyform-state.ts`）— 事実

`createEvaluatedParameterKeyformState`（L473-586）は、`sortLinearKeyformSets(session.graph.keyformSets)` を**全件反復**（L492）。変更されていないパラメータの keyformSet も毎 tick 再サンプリング（`sampleLinearKeyformValue`, L499）。差分・dirty tracking なし。K=keyformSet 総数に対し O(K)。

### 2.3 コンパイル済み評価器・キャッシュ・dirty tracking（Editor 経路）— 事実

- **無い**。`canvas-evaluation.ts` に `cache` / `memo` / `dirty` / `invalidate` の類は存在しない。毎回インデックス Map（`partsById`, `meshesById` 等, L212-219）をゼロから構築して全量評価する。
- 唯一のメモ化は React の `useMemo`（projection 単位）だが、依存に `parameterValues` を含むため tick ごとに必ず再計算される。

### 2.4 頂点配列の多重コピー（事実）

同じ頂点データが評価パイプラインで**3回以上ディープコピー**される:
1. `canvas-evaluation.ts` L268-272 で rig control 適用時に `.map(cloneVec2)`（L727-728）
2. `canvas-projection.ts` L242-243 `structuredClone(bounds)` + `cloneEvaluatedMesh(drawable.evaluatedMesh)`
3. `canvas-render-scene-adapter.ts` L83-91 `drawable.evaluatedMesh.vertices.map(clonePoint)` / `uvs.map(clonePoint)` / `triangles.map(...)`

各コピーが N×drawable 個の新規オブジェクトを生成 → GC 圧力。

### 2.5 runtime-core 経路（export 再生 / apps/runtime-player）— 事実+一部要検証

runtime-core（`packages/runtime-core/src`）はエクスポート済みモデルの per-frame 評価に使う。`runtime-profiling.ts` に 15 フェーズの計測 interface があり、`RuntimeModelInstance#evaluateRenderFrame`（Wave17）が public `RuntimeSnapshotDto` を経由しない fast path を提供する。

特性は Editor 経路と類似（サブエージェント調査、file:line は runtime-core 内で概ね確認・一部は要検証）:
- **事前コンパイル**: `snapshot-static-templates.ts` が drawable テンプレート・reference vertices・mask テンプレートを事前生成。rig control topology も事前評価（`runtime-model.ts`）。→ Editor 経路には無い最適化。
- **毎フレーム全量**: parameter resolution / keyform sampling / keyform application / deformer chain / dynamics は毎フレーム実行。dirty tracking・部分再評価・vertex キャッシュは**無い**。
- **アロケーション**: `cloneVertices = vertices.map(v => ({x:v.x, y:v.y}))` 型のパターンがデフォーマ各段で発生（runtime-drawable-evaluation.ts 付近）。`normalizeTransformNumber`（`rig-control-transform.ts`）で `toFixed` 正規化。→ Editor 経路と同型の非効率。
- **データ表現**: `Vec2Dto` オブジェクト配列。**Float32Array 等の typed array は未使用**。

> 【要検証】評価層サブエージェントが挙げた一部 file:line（例: `rig-control-compiled-topology.ts は存在しない` 等）は、実ファイルは `rig-control-compiled-topology.ts`（`packages/runtime-core/src`）として**存在する**。個別行番号は再確認を要するが、「全量評価・オブジェクト配列・毎段クローン・dirty無し」という結論は Editor 経路の直接読解と整合しており信頼度は高い。

---

## 3. 描画層

### 3.1 Editor / Editor内Viewer の実描画 = WebGL2（事実）

Editor Canvas は **`render-webgl2`（`WebGl2Renderer`）** を使う（`canvas-renderer.ts` L1, L248 で `new WebGl2Renderer(gl)`、L192 `stack.renderer.render(...)`）。`render-software` は Editor 実描画には使われない。

`WebGl2Renderer.render`（`packages/render-webgl2/src/webgl2-renderer.ts` L50-91）は毎フレーム:
- 全 drawable を back-to-front 順で走査し、各 drawable を `drawDrawable`。
- **頂点/インデックスは毎フレーム `bufferData(..., DYNAMIC_DRAW)` で再アップロード**（L262-271）。頂点が毎フレーム変わる前提のため妥当だが、drawable 数に比例した bufferData/drawElements 呼び出しが発生。
- **テクスチャはキャッシュ**される（`webgl2-textures.ts` `WebGl2TextureCache`、content signature 一致でヒット L20-24）。→ テクスチャ再アップロードは基本発生しない。
- **マスク**: clipping を持つ drawable は `renderMaskTexture`（L120-144）で**毎フレーム別 FBO にマスク drawable 群を再描画**してからターゲットを描く（L88-89）。マスクを多用するとパス数・draw call が増える。

【推測】GPU ラスタライズ自体は 512px〜数千px 規模なら通常 CPU 評価より軽い。マスク多用 + drawable 多数の組み合わせが描画側の主コスト候補。

### 3.2 render-software（CPU ラスタライザ）— 事実（参考）

`packages/render-software/src/software-renderer.ts`。純粋関数で、`renderSceneToRgba8` は毎回 framebuffer を新規生成し、**全 drawable を全三角形・全ピクセル走査で再ラスタライズ**（`triangle-rasterizer.ts` L122-166 の二重ループ、ピクセルごとに `edgeArea2` 3 回 + テクスチャサンプル）。差分描画・レイヤキャッシュは**無い**（テクスチャ前処理のみ scene 内でキャッシュ、L77-90）。`RenderPoint` は `{x,y}` オブジェクト。
- 用途はテスト / PNG エクスポート / 決定性オラクル。Editor 実描画経路ではない → 症状の主因ではない**可能性が高い**（【仮説】）。ただし PNG エクスポートやテストが遅い場合は該当。

---

## 4. Viewer 経路（Editor 内 Viewer と runtime-player を区別）

「Viewer」には2種類あり、混同注意:

### 4.1 Editor 内 Viewer（`apps/editor/src/workspace/viewer`）— 症状対象（事実）

- `viewer-runtime-screen.tsx` が runtime-core の `evaluateViewerRuntimePlaybackFrame`（`viewer-runtime-playback.ts` L103）で**有効パラメータ（dynamics 込み）を解決**し、その値で **`createCanvasRenderProjection`（= 2.1 の全量評価パス）** を呼んで描画する（`viewer-clean-stage.ts` L61 `createCanvasRenderProjection(session, null, {...})`）。
- **結論**: Editor 内 Viewer は Editor Canvas と**同じ重い評価パイプライン（canvas-evaluation.ts）を共有**する。これが backlog L145「Viewer が runtime-core drawable snapshots ではなく Editor Canvas projection を使っている」の実体。したがって「Editor でも Viewer でも重い」という症状は整合する。
- 既存最適化（Editor 内 Viewer 固有）:
  - **Wave98**: 同一フレームの重複 zero-delta 評価を削除、`ViewerRuntimeReusableParameterValues` を 1 フレームキャッシュ（`viewer-runtime-playback.ts`）。
  - **Wave97**: Dynamics rAF ループを idle-stop（収束後に rAF 停止）。
  - **Wave96**: Atlas runtime source signature をキャッシュ。
  - これらは **dynamics 再生ループ**の無駄を削るもので、**スライダー操作時の canvas-evaluation 全量再評価コストは削減しない**。

### 4.2 runtime-player（`apps/runtime-player`）— export 再生（事実）

- runtime-core の `evaluateRenderFrame`（Wave17 fast path）を使う独立経路。
- 既存キャッシュ（サブエージェント調査）:
  - **Scaffold Cache**（Wave14, `runtime-export-evaluation-cache.ts`）: normalized graph / compiled model / texture source / drawable render templates / model bounds をキャッシュ。キー = package id/revision/variant 選択。**live parameter 値・frame index では無効化しない**。
  - **RuntimeModelInstance Cache**（Wave16）: compiled instance を 1 entry キャッシュ。
- **キャッシュされないもの（毎フレーム）**: runtime state, `RuntimeSnapshotDto`, drawable vertices/opacity/visibility/drawOrder, parameter 値, keyform samples, dynamics state。→ **頂点評価は毎フレーム全量**。
- runtime-player はスライダー操作の症状の主対象ではない【推測】が、大規模モデルでは同じ「毎フレーム全量頂点評価」コストを負う（backlog L76 が既知リスクとして記載）。

---

## 5. 既存の計測・診断

- **runtime-core**: `runtime-profiling.ts`（15 フェーズの duration interface、`createRuntimeCoreEvaluationProfiler`、enabled/disabled ゲート）。`diagnostics.ts` は診断 DTO 生成のみ。
- **render-core カウンタ**: `recordLive2dPerformanceCounter` / `recordLive2dPerformanceTiming` / `startLive2dPerformanceTiming` が各所に埋め込み済み。例:
  - `canvas.evaluation.ms`（`canvas-evaluation.ts` L211, L352）
  - `canvas.renderSceneAdapter.ms` / `canvas.renderScene.textureSources`（`canvas-render-scene-adapter.ts` L70-71）
  - `webgl2.bufferDataCalls` / `webgl2.textureCacheHits`（`webgl2-renderer.ts` L262/L270, `webgl2-textures.ts` L23）
  - `parameterBar.rawEvents` / `.coalescedUpdates` / `.appliedFrames`（`raf-coalesced-number.ts` L42/L56/L60）
  - Editor 内 Viewer: `viewer.runtimeFrame.evaluations` / `.ms` / `viewer.cleanStageProjection.ms`（Wave98）。`globalThis.__LIVE2D_PERF__` 有効時。
- **runtime-player Performance Diagnostics 画面**（`apps/runtime-player/src/control/performance-diagnostics-*`）: FPS / rAF cadence / fast-path proof counter（`compiledRenderFrameCount`, `publicSnapshotMaterializationCount` 等）/ cache hit-miss を採取。runtime-core deep profiling は Wave18 で削除（軽量計測のみ）。
- **既知課題（backlog）**:
  - L76: 大規模 project で Viewer per-frame runtime evaluation が負荷になる可能性 → focused profiling を追加予定（**未実施**）。
  - L77: runtime/viewer projection unification（Editor Canvas projection 依存の解消）→ **未実施**。
  - L125: Wave82 計測は存在するが**定量ベースライン未記録**。
- **計測の空白**: `canvas-evaluation.ts` の内部フェーズ内訳（keyform vs deformer vs clone のどれが支配的か）を切り分ける計測は無い。全体 `canvas.evaluation.ms` の粗い計測のみ。

---

## 6. ボトルネック仮説の順位付け

> 実測前の静的推定。各仮説に根拠（計算量・呼出頻度・file:line）を付す。

### 仮説A（最有力）: canvas-evaluation の頂点変形が全量 × 多重クローン × toFixed 正規化

- **根拠**: `canvas-evaluation.ts` `applyRigControlChainToVertices`（L718-741）が chain 各段 × 全頂点で新規 `Vec2Dto` 配列生成。1頂点ごとに `normalizeTransformNumber`（L1159-1165, `toFixed(12)` 文字列化）を複数回。さらに評価→projection→adapter で頂点を3重コピー（2.4）。
- **症状適合**: 「デフォーマが細かい」= chain 深 D・頂点数 N が大 → コストは **O(Σ N_d×D_d)** で増大。スライダー tick ごとに全 drawable 分がこれを負う。ユーザー症状（デフォーマ細かい×スライダー）に最も直結。
- **効き**: 大。特に `toFixed` 文字列化と GC 圧力は頂点数に線形以上で効く。

### 仮説B（有力）: keyform + projection の全量再構築（差分なし）

- **根拠**: `parameter-keyform-state.ts` L492 で全 keyformSet 再サンプリング。`canvas-projection.ts` L164-256 で全 drawable の projection をゼロから再構築（Map 群も毎回再構築、L170-178）。dirty tracking 皆無。
- **症状適合**: パラメータ 1 個変えただけでも全 keyformSet・全 drawable を再計算。keyformSet 数 K・drawable 数が多い作り込みモデルで効く。
- **効き**: 中〜大（仮説Aと同一パスで累積）。

### 仮説C（中）: 毎 tick 再描画 + マスク FBO 再レンダリング

- **根拠**: `canvas-preview-panel.tsx` L287-309 が `renderProjection` 変化で毎 tick 描画。`webgl2-renderer.ts` L88-89 のマスク付き drawable は毎フレーム別 FBO へ再描画、L262-271 で全 drawable 頂点を bufferData 再アップロード。
- **症状適合**: マスクを多用するモデルで draw call・FBO パスが増える。ただし GPU 側なので通常 CPU 評価より軽い【推測】。
- **効き**: 中（マスク多用時のみ大）。

### 仮説D（低〜条件付き）: render-software CPU ラスタライズ

- **根拠**: `triangle-rasterizer.ts` の全ピクセル走査。ただし Editor 実描画では**使われない**（WebGL2 を使用）。
- **効き**: Editor リアルタイム描画では小。PNG エクスポート/テストが遅い場合のみ該当。

### 仮説E（低）: dynamics 評価ループ

- **根拠**: `dynamics-evaluation.ts` の sub-step ソルバは O(groups × substeps × segments)。ただし Wave97 で idle-stop 済み、頂点数非依存。
- **効き**: 小（スライダー静止時は収束後停止）。

---

## 7. 計画への含意（改善方向の候補 — 処方は確定しない）

各候補に規模感と副作用（決定性 / テスト / export 互換への影響）を付す。**本調査は診断が主目的であり、採否は Undine/Salamander の判断領域**。

| # | 改善方向 | 対象仮説 | 規模感 | 副作用・留意点 |
|---|---------|---------|-------|--------------|
| 1 | ホットループの typed array 化（`Vec2Dto[]` → `Float32Array`）。頂点を x,y インターリーブの Float32Array で持ち回る | A | 中〜大（評価層 API 変更） | 【要注意】決定性: 現状 `toFixed(12)` 正規化に依存。Float32 化は丸め挙動が変わり **PNG オラクル/スナップショットテストの再基準化**が必要。export バイト互換に波及の可能性 |
| 2 | `normalizeTransformNumber`（toFixed）の削減/置換。ホットパスから外す、または整数量子化へ | A | 小〜中 | 決定性の要。安易な除去は snapshot/PNG テスト差分を生む。**決定性戦略の再設計とセット**で扱う必要 |
| 3 | 頂点多重コピーの削減（評価→projection→adapter の3段クローンを1回に） | A | 中 | 中間表現の共有により不変性契約が緩む。読み取り専用の型設計で担保 |
| 4 | 評価結果メモ化 + パラメータ→影響 drawable 依存グラフによる部分再評価（dirty tracking） | A,B | 大（アーキ変更） | 依存グラフの正確性が難所（dynamics/合成/preview 経路）。誤ると視覚バグ。テスト網増強必須。決定性は保てる |
| 5 | keyformSet の変更検知（前回 parameterValues と diff し、影響 set のみ再サンプル） | B | 小〜中 | 合成モード（additiveDelta 等）の順序依存に注意。決定性は保てる |
| 6 | projection の増分化（変わった drawable のみ再構築） | B | 大 | #4 と同種の依存管理。React 再レンダ境界の再設計 |
| 7 | 評価/描画の worker オフロード | A,B | 大 | 転送コスト・決定性（浮動小数の worker 間一致）・非同期化による UX 変化。export 経路との二重管理リスク |
| 8 | Editor 内 Viewer の projection unification（runtime-core render-frame 直結、canvas-evaluation 依存を外す） | A,B | 大 | backlog L77 の既定課題。runtime-core 側の最適化（scaffold cache 等）を Viewer に波及できる。Editor Canvas との描画一致検証が必要 |
| 9 | 内部フェーズ計測の追加（keyform / deformer / clone / render の内訳を `recordLive2dPerformanceTiming` で切り分け） | 全 | 小 | **副作用ほぼ無し。診断の空白（§5）を埋め、仮説A/Bの実測検証に直結。最初の一手として低リスク** |
| 10 | マスク FBO の再利用/キャッシュ（マスク drawable が不変なら再描画スキップ） | C | 中 | マスク drawable の変化検知が必要。決定性影響なし |

【推奨の初手（診断継続として）】: #9（内部フェーズ計測の追加）で `canvas.evaluation.ms` を keyform / deformer-vertex / clone に分解し、大規模モデルで実測 → 仮説A/Bの相対寄与を定量化してから処方を選ぶ。ベースライン未記録（backlog L125）を埋める意味でも整合的。

---

## 未解決・質問（呼び出し元 Undine 向け）

1. **症状の主対象はどちらか**: 「Editor Canvas 上でのスライダー操作」と「Editor 内 Viewer 再生中のスライダー/入力操作」で、より深刻なのはどちらか。両者は canvas-evaluation を共有するが、Viewer は dynamics ループも回すため切り分けが有用。（runtime-player 単体アプリでの再生も対象か？）
2. **モデル規模の実値**: 「細かいデフォーマ」の具体規模（drawable 数 / 1メッシュあたり頂点数 / rig control chain の最大深さ / keyformSet 総数）。仮説の効き（O(Σ N_d×D_d)）を裏付けるため実データが欲しい。
3. **決定性制約の優先度**: 現状 `toFixed(12)` 正規化と PNG/snapshot オラクルが決定性を担保している。性能のために丸め挙動を変える（#1,#2）ことは許容されるか、それとも決定性・export バイト互換は不可侵か。これは処方選択を大きく左右する。
4. **実測の要否**: 本調査は静的推定に留めた。次段で #9（計測追加）→ 実機ベンチまで踏み込むか、それとも仮説順位のまま設計判断に進むか。
