# Runtime Player / runtime-core レンダリング性能 現状把握調査

> Status: Recorded(2026-07-08)
>
> 本レポートは**リポジトリ事実**（file:line で裏付け）を主とする。推測・仮説は「【推測】」「【仮説】」で明示分離する。実測（ベンチ/実機計測）は行っておらず、計算量・アロケーション特性はコード読解に基づく静的推定である。既存のユニットテスト以外にベンチ資産は存在しない（`**/*.bench.ts` は 0 件）。
>
> 調査担当: Sylph（サブエージェント委任 / 呼び出し元 Undine）。読み取り専用。
> 前提資料: Editor 側 [improvement-approach.md](improvement-approach.md) / [improvement-design.md](improvement-design.md)（Perf Wave 2: 案A rig control 遅延化・案D 表示経路 toFixed 除去+クローン削減）と [current-state-survey.md](../reports/editor-render-performance/current-state-survey.md)。

---

## 0. エグゼクティブサマリ（結論先出し）

- **Player の live 経路は Editor Canvas とは別実装**（runtime-core の `evaluateRenderFrame` fast path、`apps/runtime-player`）で、Editor の主犯（案A: 全 rig control の毎フレーム再構築、案D: 表示経路 `toFixed(12)`）とは構造が異なる。Editor の Perf Wave 2 改善は Player にそのままは移植できない/不要な部分が多い。
- **Player は既に手厚くキャッシュされている**: scaffold（templates/texture/triangles/uvs/model bounds）は package/variant/dynamics 単位でキャッシュされ live フレームでは再構築されない（`runtime-export-evaluation-cache.ts`）。RuntimeModelInstance も 1 個キャッシュされ状態を持ち越す（`runtime-export-runtime-model-instance-cache.ts`）。live フレーム入力は **rAF コアレシング**され（`static-stage-canvas-renderer.ts:549-564`）、60Hz の iFacialMocap 入力に対して 1 rAF=1 評価に統合される。ユーザー証言「Player はそこまでひどくない」はこの構造と整合する。
- **毎フレーム全量頂点評価は事実**だが、fast path は snapshot 経路の重い部分（`RuntimeSnapshotSchema.parse`、`createStableVertexHash`、`computeBoundsFromVertices`、mesh evidence、rigControls DTO 構築）を**スキップ済み**（`snapshot.ts:329-364` の `RuntimeDrawableEvaluationBase` 版）。ここは Editor 経路より進んでいる。
- **残る Editor 同型の非効率は主に3つ**（すべて fast path 上に残存）:
  1. **`normalizeTransformNumber` の `toFixed(12)`（`rig-control-transform.ts:105-111`）が変形頂点ごとに複数回**（warp 1 段=1 頂点あたり 8 回前後）。Editor では案D で除去済みだが **runtime-core では未除去**（決定性・export/snapshot 互換の制約があるため単純除去不可）。
  2. **毎フレームの Zod スキーマ検証が複数回**: fast path でも `getState()`（`runtime-model.ts:217` の `RuntimeStateDtoSchema.parse`）+ 入力/状態/options/context の 4 parse（`runtime-core.ts:241-246`）+ `advanceRuntimeState` の再 parse（`runtime-core.ts:386`）。うち `getState()` 由来の `initialState` は **live 描画経路で誰も消費しない**（Editor の「誰も消費しない rig control 計算」と同型の無駄）。
  3. **頂点の多重クローン**: runtime-core `cloneRuntimeRenderVertices`（`runtime-core.ts:305-311`）→ Player `createEvaluatedRenderDrawableInputsFromRenderFrame`（`evaluated-runtime-export-stage-scene.ts:283`）→ `createEvaluatedRenderDrawables`（同 :247）→ WebGL の `createWebGl2MeshUpload` Float32Array 化（`webgl2-mesh.ts:15-28`）で、頂点が**4回コピー**される。
- **GPU アップロードは Editor と同型**（`webgl2-renderer.ts:263/271` の `bufferData(DYNAMIC_DRAW)` 毎フレーム、テクスチャはキャッシュ）。頂点が毎フレーム変わる以上妥当。ただし三角形インデックスは静的なのに `createWebGl2MeshUpload` が毎フレーム再検証+再構築している（`webgl2-mesh.ts:30-48`）。
- **計測の縫い目は既に存在**: runtime-core に 15 フェーズの deep profiler（`runtime-profiling.ts`）があり `warpDeformerVertexTransformDurationMs` / `rotationDeformerVertexTransformDurationMs` まで分解できる。Player 側も `poseEvaluationDurationMs` / `snapshotToRenderDrawableDurationMs` / `renderInputSceneBuildDurationMs` 等を採取済み（`static-stage-canvas-renderer.ts:442-514`）。deep profiling は `runtimeCoreProfiling: "deep"` で有効化できるが **live 経路には未配線**（`runtime-export-pose-evaluator.ts:100/156`）。
- **Browser Source は同一の `StaticStageCanvasRenderer` を共有**（`browser-source-stage-renderer.ts:55`）。→ runtime-core / Player 評価層の改善は Browser Source parity を自動的に保つ（分岐リスク無し）。

**総合見立て**: Player は 30/60fps 連続再生に向けて Editor より遥かに整備されており、**「改善不要（現状で十分）」が有力な結論**。踏み込むなら効果×リスク比が最良なのは (a) fast path の無駄な `getState()` Zod parse 除去（低リスク・決定性無影響）、(b) 静的三角形インデックスのフレーム間再利用、の2点。`toFixed` 除去や typed array 化は runtime-core の決定性/snapshot 互換に直結するため**大きなリスクを伴い、実測でボトルネックと確定するまで着手すべきでない**。

---

## 1. Player のホットパス（1 live フレームの流れ）

### 1.1 入力 → パラメータフレーム（main プロセス）

1. **iFacialMocap UDP 受信**: `ifacialmocap-udp-receiver.ts:68-77`。UDP メッセージごとに `onMessage(rawFrame, remote)`。iFacialMocap は概ね 60Hz 送出【推測、コード上に明示なし】。
2. パース/正規化（`ifacialmocap-frame-parser.ts` / `ifacialmocap-normalizer.ts`）→ auto-mapping（`live-mapping/runtime-export-auto-mapping.ts`）→ live parameter frame（`live-parameter-bridge-contract.ts`）が bridge 経由で stage renderer プロセスへ。
3. **stage 側受信**: `stage-window-app.tsx:215-222` の `liveParameters.onFrame` → `renderer.setLiveParameterFrame(frame)`。

### 1.2 評価 → 描画（stage renderer プロセス）

4. **rAF コアレシング**: `setLiveParameterFrame`（`static-stage-canvas-renderer.ts:339-356`）は `latestLiveParameterFrame` を上書きし `requestScheduledRender()` を呼ぶだけ。`scheduledAnimationFrameId !== null` の間は新規 rAF を張らない（同 :549-552）。→ **同一 rAF フレーム内に届いた複数入力は 1 評価に統合**（`coalescedLiveFrameCount` で計測、:348-351）。入力頻度そのものは 1 フレーム評価コストに影響しない。
5. **rAF コールバック**: `renderScheduledFrame`（:575-586）→ `applyLatestLiveParameterFrameToRenderInput`（:588-631）で **1 回だけ** `createEvaluatedRuntimeExportStageRenderInput` を呼ぶ。`deltaTimeMs` は前回 live ソース時刻との差分（:601-603）。
6. **評価本体**: `createEvaluatedRuntimeExportStageRenderInput`（`evaluated-runtime-export-stage-scene.ts:83-182`）:
   - scaffold を cache から取得（`:89-97`、live フレームでは常に hit）。
   - `poseEvaluationMode` は live では既定 `"render-frame"`（:121）→ `evaluateRuntimeExportRenderFrame`（fast path）。
   - runtime-core 評価結果 → `createEvaluatedRenderDrawables`（:129）で RenderScene 用 drawable へ変換 → `createRenderScene`（:138）。
7. **描画**: `renderCurrent`（:643-691）→ `this.renderer.render(scene, viewport)`（WebGL2、`webgl2-renderer.ts:50`）。
8. **Browser Source 配信**: Browser Source は別 stage エントリ（`browser-source-stage-*`）だが renderer は同一の `StaticStageCanvasRenderer`（`browser-source-stage-renderer.ts:55`）。配信は WebSocket フレーム（`browser-source-websocket-*`）。**評価・描画コストは stage と同一**。

### 1.3 フレームごとに再計算されるもの（事実）

- **再計算される**: parameter resolution、keyform sampling、keyform application、deformer(rig control) chain、dynamics 前進、頂点変形、RenderScene 構築、GPU アップロード。
- **キャッシュされ再計算されない**: normalized runtime graph（adapter）、compiled runtime model、drawable render templates（uvs/triangles/textureRef/stableIndex/clipping）、texture source、model bounds、rig control topology（`snapshot-static-templates.ts` / `rig-control-hierarchy.ts`、compile 時に 1 回）。

---

## 2. 既存最適化の被覆（何がキャッシュ/スキップされ、何が残るか）

### 2.1 Scaffold Cache（Wave14 相当、`runtime-export-evaluation-cache.ts`）— 事実

- キー = package id/revision/hash + loadedAtIso + texture 署名 + atlas 署名 + variant 選択 + dynamics tuning（`:154-192`）。**live parameter 値・frame index を含まない** → live フレームでは常に hit、scaffold は再構築されない。
- scaffold が抱えるもの（compile 1 回）: `adapter.graph`、`compiledRuntimeModel`、`textureSource`、`modelBounds`、`drawableTemplatesByDrawableId`（uvs/triangles を含む、`:228-265`）。

### 2.2 RuntimeModelInstance Cache（Wave16 相当、`runtime-export-runtime-model-instance-cache.ts`）— 事実

- 1 entry。`cacheKey === scaffold.cacheKey` で hit（`:33-36`）。**状態（`state`）を持ち越す**ので dynamics の連続性が保たれ、`previousState` を毎回渡し直す必要がない。

### 2.3 render-frame fast path（Wave17 相当）— 事実

- `evaluateRenderFrame`（`runtime-model.ts:190-214`）→ `evaluateRuntimeRenderFrameInternal`（`runtime-core.ts:225-280`）→ `evaluateRuntimeRenderDrawables`（`snapshot.ts:329-364`）。
- **公開 `RuntimeSnapshotDto` を経由しない**。`RuntimeDrawableEvaluationBase`（`runtime-drawable-evaluation.ts`）は `bounds`/`vertexHash`/`vertexCount` を持たないため、`hasPublicGeometryFields` が false になり以下を**スキップ**する（Editor 経路には無い/Editor 表示経路と同種の削減）:
  - `createStableVertexHash`（頂点ハッシュ）: `rig-control-evaluation.ts:483-487` / `keyform-target-application.ts:337`
  - `computeBoundsFromVertices`（bounds 再計算）: 同上
  - `RuntimeSnapshotSchema.parse`（巨大 snapshot 検証）: `snapshot.ts:321-323` で skip 相当（fast path はそもそも snapshot を作らない）
  - mesh evidence / rigControls DTO / parts / masks materialize（`snapshot.ts:242-299` を通らない）
- Player はさらに `snapshotValidation: "skip"` を渡す（`runtime-export-pose-evaluator.ts:159`）。

### 2.4 dynamics idle-stop（Wave97）等 — 事実 / 注意

- **Wave97/98 の idle-stop は Editor 内 Viewer の rAF ループ最適化**（`viewer-runtime-playback.ts`）。Player の `StaticStageCanvasRenderer` は**恒常 rAF ループを持たず**、入力 or view 変化があったときだけ `requestScheduledRender` する（イベント駆動）。→ Player は「入力が来なければ評価しない」構造で、idle-stop 相当は既に構造的に達成。
- dynamics 前進自体は live フレームごとに走る（`runtime-core.ts:357-392`）が、`advanceDynamicsGroupState` は頂点数非依存でグループ×substep のオーダー。

### 2.5 キャッシュできていないもの（毎フレーム）— 事実

- runtime state、頂点座標、opacity/visibility/drawOrder、parameter 値、keyform samples、dynamics 粒子。→ 頂点評価は毎フレーム全量。**部分再評価・dirty tracking は runtime-core に無い**（`snapshot.ts:403-463` は毎回全 parameter/binding/drawable を回す）。

---

## 3. Editor と同型の非効率の有無（項目3）

### (a) 毎フレーム全量頂点評価 — 事実。計算量

- `evaluateRigControlHierarchy`（`rig-control-evaluation.ts:106-179`）→ `applyRigControlTransformsToDrawables`（:385-461）が**全 drawable を `.map()`**（:404）。各 drawable で effect chain を頂点全体に適用（:448-453 → `applyRigControlEffectChainToVertices` :582-598）。
- 1 頂点あたり: warp なら `applyWarpLattice2dToVertex`（`rig-control-warp-lattice.ts:201-228`）が双線形補間（`interpolateVec2` 3 回）、rotation なら `applyAffine2dToPoint`（`rig-control-transform.ts:81-87`）。
- オーダー: **O(Σ_drawable (N_d × D_d))**（N_d=頂点数、D_d=effect chain 段数）。Editor 経路と同型。ただし fast path なのでハッシュ/bounds/クローン段は Editor より少ない。

### (b) `toFixed(12)` 文字列正規化 — **存在する（fast path 上）**。事実

- `normalizeTransformNumber`（`rig-control-transform.ts:105-111`）は `Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))`。**Editor の案D後の実装（`canvas-evaluation.ts:1326-1328` は toFixed 除去済み）と異なり、runtime-core は toFixed を保持**。
- 変形頂点ホットパスでの呼び出し密度（1 warp 段・1 頂点あたり）:
  - `interpolateVec2`（`rig-control-warp-lattice.ts:386-389`）: x,y 各 1 回 = 2 回、これを 3 回（lower/upper/displacement）= 6 回
  - 最終合成（同 :224-227）: x,y = 2 回
  - → **warp 1 段 = 1 頂点あたり 約 8 回の `toFixed(12)`**（境界外は `cloneVec2` で 2 回）。
  - rotation: `applyAffine2dToPoint` で x,y = 2 回/頂点、行列合成 `composeAffine2d`（:68-79）で 6 回/段（頂点非依存）。
- これは Editor が案Dで「表示経路のみ」除去した最適化そのもの。**runtime-core は表示専用ではなく export/snapshot 決定性の源**なので、同じ手（単純除去）は使えない（§4 で詳述）。

### (c) 頂点クローンの多重度 — **4 回**。事実

1. runtime-core: `cloneRuntimeRenderVertices`（`runtime-core.ts:305-311`）が render frame 出力で `{x,y}` 新規生成。
2. runtime-core 内部: `applyRigControlEffectChainToVertices` の起点 `cloneVertices`（`rig-control-evaluation.ts:737-738`）+ 各変形段が `.map` で新配列（warp/rotation 各段）。
3. Player: `createEvaluatedRenderDrawableInputsFromRenderFrame`（`evaluated-runtime-export-stage-scene.ts:283`）で再 `.map`。
4. Player: `createEvaluatedRenderDrawables`（同 :247）で mesh.vertices に再 `.map`。
5. WebGL: `createWebGl2MeshUpload`（`webgl2-mesh.ts:15-28`）で Float32Array へ最終コピー。

→ 頂点は **runtime-core 出力後だけでも 3 回（3→4→5）`{x,y}` オブジェクトを作り直してから Float32Array 化**。Editor の「3 重クローン」と同型の非効率が Player↔runtime-core 境界にもある。

### (d) 全メッシュ毎フレーム GPU 再アップロード — 事実（Editor と同一コード）

- `webgl2-renderer.ts:263/271` が全 drawable の頂点/インデックスを毎フレーム `bufferData(DYNAMIC_DRAW)`。頂点が毎フレーム変わる前提のため妥当。テクスチャは `WebGl2TextureCache` でキャッシュ（content signature 一致でヒット）。
- **ただしインデックス（三角形）は静的**なのに、`createWebGl2MeshUpload` が毎フレーム `validIndices` を再検証・再構築（`webgl2-mesh.ts:30-48`）してから `Uint16/32Array` 化している。頂点 Float32Array 化は毎フレーム不可避だが、インデックスは scaffold で 1 回作って使い回せる。
- マスク付き drawable は毎フレーム別 FBO 再描画（`webgl2-renderer.ts:120-144`）。Editor と同一。

### (e) 「誰も消費しない計算」— **存在する**。事実

- **`getState()` の毎フレーム Zod parse**: `createRuntimeExportPoseEvaluationRuntime`（`runtime-export-pose-evaluator.ts:261-270`）が `initialState: runtimeModelInstance.getState()` を毎フレーム設定。`getState()` は `RuntimeStateDtoSchema.parse(this.state)`（`runtime-model.ts:216-218`）で**全 runtime state（dynamics 粒子配列含む）を Zod 検証**。
- しかし `poseEvaluation.initialState` は **live 描画経路のどこからも読まれない**（`.initialState` の消費は `runtime-export-default-pose-evaluation.test.ts:239` のテストのみ、grep 済み）。→ Editor の「実描画が参照しない rig control 評価」（案A の主犯）と同型の無駄。規模は Editor ほど大きくない可能性が高いが、決定性無影響で除去できる点で低リスク。

---

## 4. Editor 改善（Perf Wave 2 案D系）の移植可能性（項目4）

### 4.1 案D-1: 表示経路 `toFixed` 除去 → runtime-core には**単純移植不可**

- Editor 案D は「`createCanvasEvaluatedScene` の出力は表示専用で、save/export/provenance は `session.graph` 原本を読む」ため toFixed を安全に落とせた（`canvas-evaluation.ts:1311-1328` のコメント）。
- **runtime-core の `normalizeTransformNumber` はそうではない**。同じ関数が:
  - snapshot 経路（`RuntimeSnapshotDto`）にも使われ、`vertexHash`（`createStableVertexHash`）や snapshot 比較（`snapshot-comparison.ts`）、provenance/evidence（`runtime-evidence.ts`）の**決定性の源**。
  - fast path と snapshot 経路が**同じ変形関数を共有**（`applyWarpLattice2dToVertices` / `applyAffine2dToPoint`）しているため、fast path だけ toFixed を外すと fast path と snapshot 経路で**頂点値が乖離**し、両者一致を検証するテスト（`preview-viewer-equivalence-fixture.test.ts`、`runtime-keyform-snapshot-integration.test.ts` 等）が壊れる。
- 【要検討・質問】もし「fast path 用の変形関数を snapshot 経路から分離し、fast path 側だけ toFixed を数値スナップ（`Math.abs<1e-12?0:value`）へ緩和」する設計なら移植可能。ただし fast path と snapshot の頂点一致契約を**明示的に epsilon 許容へ緩める**必要があり、決定性ポリシー（`epsilonPolicy`）とスナップショットオラクルの再基準化を伴う。規模: 中〜大、リスク: 高。

### 4.2 案D-2: クローン削減 → 一部**移植可能・低リスク**

- Player↔runtime-core 境界の 3 段クローン（§3-c の 3→4→5）は、決定性に影響しない**純粋な参照の付け替え**で削れる可能性がある:
  - `createEvaluatedRenderDrawableInputsFromRenderFrame`（`:283`）の `.map(v=>({x,y}))` は、直後に `createEvaluatedRenderDrawables`（`:247`）が再度 `.map` するため冗長。中間 `EvaluatedRenderDrawableInput` を挟まず runtime-core の frame drawable を直接 mesh へ渡せば 1 段減る。
  - runtime-core `cloneRuntimeRenderVertices`（`:305-311`）は「fast path 出力の防御的コピー」。Player が受領後すぐ Float32Array 化するだけなら、このコピーは省略候補（ただし runtime-core の出力不変性契約に触れるため要検討）。
- Editor の案D クローン削減（`shallowCloneVec2` で再正規化を避ける）と同じ発想が使える。規模: 小〜中、リスク: 低〜中（不変性契約の型設計で担保）。

### 4.3 案A（rig control 遅延化）→ Player には**該当構造が無い/既に無い**

- Editor 案A の主犯は「実描画が参照しない全 rig control DTO の毎フレーム再構築」。runtime-core fast path は `includeRigControls: false`（`snapshot.ts:350`）で **rig control DTO を最初から作らない**（`rig-control-evaluation.ts:172-176` で空配列）。→ 案A 相当は fast path に既に適用済み。移植不要。

---

## 5. 計測の縫い目（項目5）

### 5.1 既存の診断（事実）

- **runtime-core deep profiler**: `runtime-profiling.ts` が 15 フェーズ（`parameterResolutionDurationMs` / `keyformSamplingDurationMs` / `keyformApplicationDurationMs` / `deformerHierarchyEvaluationDurationMs` / **`warpDeformerVertexTransformDurationMs`** / **`rotationDeformerVertexTransformDurationMs`** / `runtimeCoreRenderFrameOutputDurationMs` 等）を分解。既定 disabled、`{ enabled: true }` で有効。
- **Player 計測**: `StaticStageRenderMetricsSnapshot`（`static-stage-canvas-renderer.ts:442-514`）が `lastPoseEvaluationDurationMs` / `lastSnapshotToRenderDrawableDurationMs` / `lastRenderInputSceneBuildDurationMs` / `lastRenderDurationMs` / `lastRafDeltaMs` / `coalescedLiveFrameCount` / cache hit-miss / `compiledRenderFrameCount` / `publicSnapshotMaterializationCount` を採取。Performance Diagnostics 画面（`apps/runtime-player/src/control/performance-diagnostics-*`）に表示。
- deep profiling は Wave18 で live 計測からは外れたが、**interface と profiler 本体は健在**。`runtime-export-pose-evaluator.ts:100/156` に `runtimeCoreProfiling: "deep"` 分岐が残っており、`evaluateRuntimeExportRenderFrame` に `runtimeCoreProfiling: "deep"` を渡せば per-phase 分解が復活する（`RuntimeCoreEvaluationProfile` が `evaluationProfile.runtimeCoreProfile` 経由で Player 側 metrics に流れる、`evaluated-runtime-export-stage-scene.ts:165-170`）。

### 5.2 Editor 式フェーズ計測を入れるなら（推奨）

- **配線するだけ**で済む: live 経路（`applyLatestLiveParameterFrameToRenderInput`）で `runtimeCoreProfiling: "deep"` を（診断フラグ下で）渡す。`static-stage-canvas-renderer.ts:830-857` の `recordLiveRenderInputEvaluationProfile` は既に `runtimeCoreProfile` を受け取る口を持つが、per-phase 値を metrics snapshot に露出していない。ここに `warpDeformerVertexTransformDurationMs` 等を足すのが最小改修。
- 【推奨初手】この配線で「warp/rotation 頂点変形」「keyform application」「dynamics」「snapshotToRenderDrawable（Player クローン段）」の実寄与を実機モデルで実測 → 仮説順位を確定。副作用ほぼ無し（診断フラグ下・挙動不変）。

---

## 6. ボトルネック仮説の順位付け（項目6）

> 実測前の静的推定。Player は 30/60fps 連続再生が本分。iFacialMocap 約 60Hz 入力は rAF コアレシングで 1 評価/rAF に統合されるため、**律速は「1 rAF 内の評価+描画が 16.6ms（60fps）/ 33ms（30fps）に収まるか」**。過剰最適化を勧めない前提で順位付けする。

### 仮説P1（Player 上の最有力）: 変形頂点ホットパスの `toFixed(12)` + 多重クローン

- 根拠: §3-b（warp 1 段=頂点あたり ~8 回の `toFixed`）+ §3-c（runtime-core 後 3 段クローン→Float32Array）。頂点数×chain 段数に線形以上。
- 効き: 大きいモデルほど。ただし **toFixed 除去は決定性リスク大**（§4-1）、クローン削減は低リスク（§4-2）。→ **クローン削減部分だけが実利/リスク比良好**。

### 仮説P2（有力・低リスク）: fast path の無駄な Zod parse

- 根拠: §3-e。`getState()` の毎フレーム全 state Zod parse（誰も消費しない）+ 入力/state/options/context の毎フレーム parse（`runtime-core.ts:241-246`）。dynamics 粒子配列を含む state の parse は非自明なコスト【推測】。
- 効き: 中【推測】。決定性無影響で除去可能なため**実利×リスク比は最良**。

### 仮説P3（中）: keyform application の O(samples × drawables) Map 再構築

- 根拠: `snapshot.ts:567-594` の `applySamplesInEvaluationOrder` が **sample ごとに** `applyKeyformTargetPatches` を呼び、その都度全 drawable の `drawablesById` Map をクローン再構築（`keyform-target-application.ts:59-64`）。keyform-heavy モデルで非線形。
- 効き: keyform 数が多いモデルで中〜大。決定性は保てるが合成順序の担保が難所。

### 仮説P4（低〜条件付き）: 静的三角形インデックスの毎フレーム再構築

- 根拠: `webgl2-mesh.ts:30-48`。頂点 Float32Array 化は不可避だが、三角形検証+`validIndices` 構築は静的。scaffold で 1 回作れる。
- 効き: 小〜中（頂点数大 かつ 三角形数大 のとき）。**Editor と共有コードなので Editor にも同時に効く**。決定性無影響。

### 仮説P5（低）: マスク FBO 毎フレーム再描画

- 根拠: `webgl2-renderer.ts:120-144`。マスク多用時のみ draw call 増。Editor と同一。GPU 側で通常軽い【推測】。

### 仮説P6（構造的に既に軽い、対策不要）: dynamics ループ / 入力頻度

- rAF コアレシング（§1.2-4）+ イベント駆動 rAF（§2.4）で入力頻度は律速でない。dynamics は頂点非依存。

---

## 7. 計画への含意（改善候補と効果×規模×リスク）

各候補に決定性 / export・snapshot 互換 / Browser Source parity への影響を付す。**採否は Undine/Salamander の判断領域**。Player は「改善不要（現状十分）」も正当な結論。

| # | 改善候補 | 対象仮説 | 効果見込み | 規模 | リスク（決定性/互換/parity） |
|---|---------|---------|-----------|------|------------------------|
| 1 | **live fast path の `getState()` 由来 `initialState` を live 経路で省略**（診断/テスト経路のみ保持）。誰も消費しない毎フレーム Zod parse を除去 | P2 | 中・**低リスク** | 小 | 決定性無影響。Browser Source は同一コードで自動追従。test の `initialState` 期待は別経路で担保 |
| 2 | **runtime-core render frame の入力/state/options/context の毎フレーム Zod parse を、初回のみ検証+以降スキップ or 軽量ガードに置換** | P2 | 中 | 中 | fast path 限定なら snapshot 経路の検証は不変。入力の型安全性を別途担保する設計が必要 |
| 3 | **Player↔runtime-core 境界の頂点クローン段削減**（中間 `EvaluatedRenderDrawableInput` を廃し frame drawable を直接 mesh へ、runtime-core 出力の防御コピーを見直し） | P1(クローン部) | 中・低リスク | 小〜中 | 決定性無影響（純粋な参照付け替え）。不変性契約を型で担保 |
| 4 | **静的三角形インデックスを scaffold にキャッシュし WebGL upload で使い回す**（頂点 Float32Array のみ毎フレーム） | P4 | 小〜中 | 小〜中 | 決定性無影響。**Editor にも同時に効く**共有コード改善。parity 無影響 |
| 5 | 内部フェーズ計測の live 配線（`runtimeCoreProfiling: "deep"` を診断フラグ下で通し、warp/rotation/keyform/クローン段を分解表示） | 全 | 診断のみ | 小 | **副作用ほぼ無し。最初の一手として推奨**。仮説 P1/P2/P3 の実寄与を実測確定 |
| 6 | fast path 変形関数を snapshot 経路から分離し fast path 側 `toFixed` を数値スナップへ緩和 | P1(toFixed部) | 大 | 大 | **高リスク**。fast path↔snapshot 頂点一致契約を epsilon 許容へ緩める必要。snapshot/PNG オラクル再基準化。実測で確定するまで着手非推奨 |
| 7 | keyform application を sample 単位ループから一括適用へ（drawablesById Map 1 回構築） | P3 | keyform-heavy で中 | 中 | 合成順序の決定性担保が難所。snapshot 経路と共有のため両経路テスト必須 |
| 8 | 頂点の typed array 化（`Vec2Dto[]`→`Float32Array` を runtime-core 内で持ち回る） | P1 | 大 | 大 | **最高リスク**。runtime-core 全評価 API・snapshot・決定性・export バイト互換に波及。#6 とセットでのみ意味を持つ。非推奨 |

### 推奨する進め方（実利優先・過剰最適化回避）

1. **まず #5（計測配線）だけを入れて実機モデルで live フレーム内訳を実測**。ユーザー証言「Player はそこまでひどくない」を数値で確認する。60fps/30fps 予算に対する余裕を見る。
2. 余裕があれば **#1・#4（低リスク・決定性無影響）** のみ実施。#1 は Player 単独、#4 は Editor 共有で二重の実利。
3. **#6・#7・#8 は実測でボトルネック確定 かつ ユーザーが体感問題を報告した場合のみ**。runtime-core の決定性・snapshot/export 互換に直結するため、Editor の「表示専用だから安全」という前提が**成り立たない**ことを設計で明示的に扱う必要がある。

---

## 未解決・質問（呼び出し元 Undine 向け）

1. **そもそも Player 改善に着手するか**: 本調査の結論は「Player は Editor より遥かに整備済み・現状で 30/60fps に足りている公算が高い」。ユーザー証言と整合する。**「改善不要」で締めてよいか**、それとも計測（#5）だけ入れて数値で締めるか。
2. **決定性の二層分離は runtime-core に適用可能か**: Editor は「表示経路は緩和可・save/export は不可侵」で分離できたが、runtime-core の `normalizeTransformNumber` は fast path と snapshot/export の**両方が共有**する。fast path 専用に決定性を緩める（頂点値を epsilon 許容にする）ことを許容するか。これが #6/#8 の可否を左右する。
3. **実測の主対象モデル**: 「デフォーマ細かい」実モデルの規模（drawable 数 / 1 メッシュ頂点数 / rig chain 最大深さ / keyformBinding 総数 / dynamics group 数）。Player 用の実機計測手順（Performance Diagnostics 画面 + #5 配線）で採るのが自然。
4. **Browser Source の負荷特性**: Browser Source は同一 renderer だが配信（WebSocket フレーム）が別途走る。stage と Browser Source を同時起動したときの負荷は本調査では未計測。改善対象に含めるか。
