# 改善設計インプット — createCanvasEvaluatedRigControls / deformerVertex

> Status: Recorded(2026-07-07)
> 調査者: Sylph(調査担当、読み取り専用)。委任元: Undine(L0)
> 目的: 改善設計対話の材料。**確定はしない**。file:line 付き。リポジトリ事実と推測を分離。
> 根拠: `apps/editor/src/workspace/canvas/canvas-evaluation.ts`、`canvas-projection.ts`、`canvas-render-scene-adapter.ts`、`canvas-preview-panel.tsx`、`use-*-deformer-interaction.ts` の構造読解 + 計測 002 / baseline-synthetic-v3 / double-evaluation-diagnosis。

---

## 0. 結論(先に要約)

- **最重要の消費者分析結果(設計を決める事実)**: `createCanvasEvaluatedRigControls` は毎評価で**全 rig control**の評価済み形状(rest/evaluated 制御点、evaluatedPivot 等)を再構築するが、その出力 `evaluatedScene.rigControls` の**唯一の本番消費者**は `canvas-projection.ts:288-293` の `resolveDeformerOverlay` であり、そこは結局 **`selection` に一致する 1 個(または draft 1 個)だけ**を `.find()` で拾い、残りを捨てている(`canvas-projection.ts:399-417`)。**実描画(renderSceneAdapter)は `evaluatedRigControls` を一切参照しない**(`canvas-render-scene-adapter.ts` は `projection.drawables` のみ消費)。ヒットテストも既存 projection を読むだけで rig control 評価済み形状に依存しない(double-evaluation-diagnosis §2 で確認済み)。
- ⇒ **rigHeavy で 67.8ms/評価(親区間の 99.84%)を費やして N 個作っているものの、消費されるのは常に 0〜1 個**。これは「全量計算 → 1 個だけ使用」という純粋な過剰計算であり、**選択駆動の遅延/部分評価に置き換えれば大半を消せる**見込み。これが最有力の設計方向。
- 二次標的 `deformerVertex`(17.0%)は drawable 頂点変形。こちらは全 drawable が描画に本当に必要なので「消す」のではなく「安くする」(cloneVec2 削減・typed array・toFixed 除去)方向。表示/保存の分離点は §5。

---

## 1. createCanvasEvaluatedRigControls の内部構造とコスト源(項目1)

### 入力と出力
- 呼び出し: `canvas-evaluation.ts:353` `createCanvasEvaluatedRigControls(rigControls, rigControlsById)`。
- 入力 `rigControls`: `createEvaluationRigControls`(`:242-248`)が生成した全 rig control の内部表現(committed 全件 + draft 最大1)。`rigControlsById` は id→内部表現の Map(`:249`)。
- 出力: `readonly CanvasEvaluatedRigControl[]`(全件 map、`:570-575`)。warp は評価済み制御点、rotation は評価済み pivot を持つ公開 DTO。

### 1 rig control あたりの再構築コスト(`createCanvasEvaluatedWarpRigControl` `:577-605`)
warp の場合、1 個につき:
1. `createDrawableRigControlChain(rigControl, rigControlsById)`(`:581`) — parentId を辿って祖先チェーンを構築。長さ = chain 深さ D。
2. `createWarpRestControlPoints(rigControl)`(`:582`, 本体 `:636-657`) — latticeColumns × latticeRows 個の rest 制御点を新規生成。点数 P。
3. `restControlPoints.map((point) => applyRigControlChainToPoint(point, chain))`(`:583-585`) — **P 点 × チェーン全段(D)** に warp/rotation 変形を適用(`applyRigControlChainToPoint` `:779-795` が chain を逆順に舐め、各段 `applyRigControlToPoint`)。
4. 出力構築で **cloneVec2 を 3 系列**: `restControlPoints.map(cloneVec2)`(`:599`)、`controlPointOffsets.map(cloneVec2)`(`:600`)、`evaluatedControlPoints`(既に新規生成)。
5. `computeBoundsFromVertices(evaluatedControlPoints)`(`:594`) — P 点走査(内部で `.slice(1)` により配列複製、`:1091`)。

### 複雑度(リポジトリ事実 + 算式)
- 全体 ≈ **O(N × P × D)** の chain 適用 + **O(N × P)** の cloneVec2(3 系列)。N = rig control 数、P = lattice 点数、D = chain 深さ。
- `cloneVec2` はさらに 1 回ごとに `normalizeTransformNumber`(`:1195-1201`)を **x/y 各**呼ぶ。`normalizeTransformNumber` は `Math.abs` 比較 + `Number(value.toFixed(12))` の**文字列往復**を含む(`:1200`)。`applyRotationToPoint`/`applyWarpLatticeToPoint`/`interpolateVec2` も出力ごとに `normalizeTransformNumber` を通す(`:843-849`, `:887-890`, `:1165-1167`)。**toFixed(12) の文字列往復が N×P×D の各座標で発生**するのがマイクロコストの主因候補(推測、ただし deformerVertex 側と同型の構造で計測 v3 が示す単価とも整合)。

### 計測との整合(baseline-synthetic-v3 §4)
- rigHeavy(N=1600, chainDepth=8, lattice 3×3=9点): `assembly.rigControls` = 67.824ms/評価(親区間の 99.84%)。
- heavy(N=720, chainDepth=6, 9点): 25.797ms。medium(N=120, D=3): 2.953ms。**N×D にほぼ比例**(1600×8=12800 → 67.8ms、720×6=4320 → 25.8ms、比 ≈ 2.6 対 2.63 でほぼ一致)。P は合成では常に 9 で固定。
- 実モデル(計測 002): この区間が評価全体の 75.8%(96.4ms/評価)。**実モデルは P(lattice 密度)が合成の 9 より大きい可能性**があり、その場合 P も効く(下記「質問」)。

### 「パラメータ1個変更で本来必要な再計算の粒度」(項目1後段)
- リポジトリ事実: 現状は依存追跡ゼロ。パラメータが 1 個動くと `createEvaluatedParameterKeyformState`(`:236`)が全 keyform を再サンプルし、その結果を使って**全 rig control を無条件で再構築**する。
- 依存の実体(推測 + 構造根拠): ある rig control の評価済み形状が変わるのは、(a) その rig control 自身にバインドされたパラメータ(warp なら `rigControlPointOffsetsById`、rotation なら `rigAngleDegreesById`/`rigTranslationById`、`parameter-keyform-state.ts` 参照)が動いたとき、(b) その**祖先**(parentId チェーン上)のいずれかが動いたとき、の 2 経路のみ。子孫や無関係な rig control は不変。→ **「変わった rig control とその子孫サブツリーだけ再構築」で正しい**はず(要検証:§6 案での不変条件確認)。

---

## 2. 消費者分析(項目2・設計の要)

`evaluatedScene.rigControls`(= `createCanvasEvaluatedRigControls` の出力)を誰が消費するか、全経路を追った結果:

| 消費者 | 場所 | 全 rig control が必要か | 実際に使う数 |
|---|---|---|---|
| **実描画(renderSceneAdapter)** | `canvas-render-scene-adapter.ts:28-73` | **不要** | 0(rig control を参照しない。`projection.drawables` のみ) |
| **deformer オーバーレイ**(rig ツールの選択ハンドル表示) | `canvas-projection.ts:288-293` → `resolveDeformerOverlay:392-418` | **不要** | **0〜1**(選択中の rigControlId に `.find` 一致、または draft 1 個) |
| ヒットテスト | `canvas-preview-panel.tsx:501-546` | 不要 | 0(既存 renderProjection の drawable を読むだけ。double-evaluation-diagnosis §2 済) |
| インスペクタ(rig-tool-inspector) | — | 不要 | 0(`session.graph.rigControls`〔原本〕を読む。評価済み形状に非依存) |
| Viewer 経路 | `viewer-render-source.ts:454-473`, `viewer-runtime-screen.tsx:691` | 不要 | 0〜1(同じく `deformerOverlay` 経由。計測 002 では viewer 非表示で未実行) |

### 消費者分析の結論(リポジトリ事実)
- **全 rig control の「評価済み形状」を毎フレーム必要とする消費者は存在しない**。
- 必要なのは常に「**選択中の 1 個**(または編集中の draft 1 個)」の評価済み制御点/pivot だけ。それも rig ツール使用中(`deformerOverlayVisible` かつ選択が rigControl)に限る。スライダー操作中(rig 非選択)は **0 個で足りる**。
- したがって現状は「N 個計算 → 最大 1 個消費」で、rigHeavy では **1599/1600 が捨てられている**。計測 002 の主犯(75.8%)は、ほぼ全量が捨てられる計算である。
- ※注意(不変条件): `resolveDeformerOverlay` は選択中 rig control の評価済み形状に加えて、その `evaluatedControlPoints`/`domainBounds` を使う。**選択中 1 個だけを評価する場合でも、その 1 個の chain(祖先全段)は評価する必要がある**(祖先の変形が選択 rig control の見かけ位置に効くため)。「1 個」= 「選択 rig control + その祖先チェーン」であって、単独ノードではない。

---

## 3. メモ化・差分再構築の縫い目(項目3)

### (a) キャッシュキーになり得る入力 / 依存グラフ
- rig control の親子は `parentId` / `childRigControlIds`(内部表現 `:186-188`、原本 DTO にも存在)で既に引ける。祖先チェーンは `createDrawableRigControlChain`(`:732-752`)が既に構築している。**依存グラフの素材は既存**。
- 評価済み形状のキャッシュキー候補: `(rigControlId, その rig 自身のバインド値, 祖先チェーン各段のバインド値)`。バインド値は `evaluatedKeyforms.rigControlPointOffsetsById` / `rigAngleDegreesById` / `rigTranslationById` / `rigOpacityMultiplierById`(`:441-443`, `:488-495`)から引ける。パラメータ→rig control の逆引きは `parameter-keyform-state.ts` 側にある可能性が高い(未精査:§7 質問)。
- 簡便な代替キー: 「今回の評価で `evaluatedKeyforms` の該当 rig 値が前回と参照/値一致か」。keyform 状態を安定参照で持てれば `===` 比較で差分判定できる。

### (b) 不変条件との整合
- 決定性: `createCanvasEvaluatedRigControls` の出力は純粋関数(session + parameterValues + preview のみに依存、外部状態なし)。同一入力→同一出力なのでメモ化は決定性を壊さない。
- **表示経路の丸め緩和は解禁済み**(improvement-approach §3-2)。`evaluatedScene.rigControls` は**表示専用**(§2 の通り保存/export に流れない)。→ この区間の cloneVec2/normalizeTransformNumber(toFixed12)は**表示専用なので緩和可**。保存・export・provenance のバイト互換には触れない。
- 保存/export 不可侵: rig control の**原本**は `session.graph.rigControls`。評価済み DTO は派生表示物であり、保存経路に混ざらない(§2 で確認)。→ キャッシュ層は安全に表示側だけに置ける。

### (c) 既存の類似機構の流用可能性
- **render-core にトポロジ compile / 評価キャッシュは無い**(Grep: `packages/render-core/src` に `compiledTopology`/`memo`/`cache` は `texture-signature.ts` のテクスチャ内容署名のみ。rig 評価キャッシュ機構は不在)。→ **流用できる既存キャッシュ機構は無い**。新設が必要。
- ただし `createProjectionContentKey`(`canvas-projection.ts:311`)という projection 一致判定キーの前例はある。同種のキー生成を rig control 単位に降ろす発想は流用できる(推測)。

---

## 4. 評価のレンダー外化の実装面(項目4)

double-evaluation-diagnosis の確定事項: dev の StrictMode 二重実行で評価が `useMemo`(`canvas-preview-panel.tsx:189`)で 2 回走る。日常作業が dev server 上なので体感に直撃(improvement-approach §3-5)。

- 現状構造: `projection = useMemo(() => createProjection(), [createProjection])`(`:189`)→ `warpControlPoints`(`:190`, projection を受け preview 差分)→ `rotationDeformer`(`:200`, warp の結果を受ける)→ `renderProjection = rotationDeformer.renderProjection`(`:210`)。描画は `useEffect`(`:246` 以降、renderCanvasProjection)。
- **useMemo → 外部化した場合の波及範囲(中)**:
  - `projection` を state/外部ストア化すると、`warpControlPoints`/`rotationDeformer` の入力(`:195`, `:205`)が同期レンダー値でなくなる。両フックは `input.projection` を `renderProjection` の基点にしている(`use-warp...:170-180`)。初回レンダーで projection 未確定になるハンドリングが要る。
  - preview 経路(rig ドラッグ)は `createPreviewProjection`(`:196`, `:206`)で**その場で追加評価**を呼ぶ。ここは選択 1 個の再評価で、外部化しても preview の同期性は保ちたい(ドラッグ追従)。→ 「ベース projection は外部化、preview は同期」の二層化が要る(設計論点)。
  - **StrictMode 二重実行がどう消えるか**: 評価をレンダー中計算(useMemo)から `useEffect`/外部ストア(useSyncExternalStore)へ移せば、StrictMode が 2 回流すのはレンダーであって effect は 1 回に畳むため、**重い評価は 1 回に戻る**。キー付きキャッシュ案なら useMemo のままでも 2 回目がキャッシュヒットして本体計算を飛ばせる(double-evaluation-diagnosis §6 候補 B-2)。
- 規模: 外部ストア化 = 中〜大(状態管理波及)。キー付きキャッシュ = 中(表示層のみ)。

---

## 5. deformerVertex(第二標的)の下調べ(項目5)

- 場所: `canvas-evaluation.ts:260-350`。全 drawable について baseMesh 構築 → `applyRigControlChainToVertices`(`:285-289`, 本体 `:754-777`)→ bounds。計測 002 で 17.0%(21.6ms/評価)。
- **cloneVec2 / toFixed のホットスポット**:
  - `cloneMesh`(`:921-931`): vertices/uvs を各 `cloneVec2`、triangles を `cloneTriangle`、bounds を `structuredClone`。**毎評価で全 drawable の全頂点を新規オブジェクト化**。
  - `applyRigControlChainToVertices`(`:763-764`): `current`/`reference` の**2 本を map(cloneVec2)で複製**してから chain 適用。chain 各段でさらに `current.map(...)` で全頂点再生成(`:767-773`)。
  - projection 層(`canvas-projection.ts:253` `cloneEvaluatedMesh`)と adapter 層(`canvas-render-scene-adapter.ts:83-84` `map(clonePoint)`)で**さらに 2 回クローン**。improvement-approach §2 の「評価→projection→adapter の 3 重クローン」がここ。
- **表示/保存の分離点**:
  - `evaluatedMesh.vertices` は**表示専用**(変形後座標。原本メッシュは `session.graph.meshes`)。→ 表示経路の toFixed 除去・typed array 化・クローン削減は解禁対象。
  - 分離点: `cloneMesh`(`:921`)が原本 `MeshDto` から評価用へコピーする境界。ここから下流(evaluatedMesh → projection → adapter → RenderScene)は**すべて表示専用**。**上流の `session.graph.meshes`(原本)には触れない**。保存/export は原本を読む(評価済みメッシュは保存に流れない、§2 と同型)。
  - adapter の `clonePoint`(`:218-226`)は `normalizeTransformNumber` を通さない素のコピー(既に緩い)。normalizeTransformNumber(toFixed12)は評価層 `cloneVec2`(`:1156-1161`)側に集中。

---

## 6. 改善候補の設計案スケッチ(項目6・確定しない)

効果見込み(計測 002 の 96.4ms/評価 = 75.8% を主対象)× 変更規模 × リスクで整理。

### 案 A: rig control 評価を「選択駆動の遅延評価」に置換(最有力・本丸)
- 内容: `createCanvasEvaluatedRigControls` を全量 map で回すのをやめ、`resolveDeformerOverlay` が要求する「選択中 rig control(+その祖先チェーン)」だけを評価する。scene に全 `rigControls` を持たせる代わりに、遅延評価関数 or 選択 id を受ける単発評価にする。
- 効果見込み: **最大級**。rigHeavy 67.8ms → ほぼ 0(選択時のみ数個)。計測 002 の主犯 75.8% を直撃。本番にも効く(StrictMode 非依存)。
- 変更規模: 中。`canvas-evaluation.ts:353` の全量呼び出しと `CanvasEvaluatedScene.rigControls` 型、`canvas-projection.ts:291` の消費点。scene の公開契約変更。
- 壊れ得るもの:
  - `canvas-evaluation.test.ts:75,586` 等が `evaluatedScene.rigControls[i]` / `.find(rigControlId===)` で**全件配列を前提**にしている(要改修)。
  - draft 経路(`resolveDeformerOverlay:398-404` が `status==="draft"` を find)も選択非依存で常に 1 個要る → 遅延評価の要求集合に「draft があれば draft」を含める必要。
  - 決定性: 出力は同じ(部分集合を計算するだけ)。保存/export 非依存(§2)。undo/preview: preview 経路も選択 rig 中心なので整合。
  - **リスク低〜中**(消費者が §2 で 0〜1 と確定しているため、契約縮小の安全性が高い)。

### 案 B: rig control 単位のメモ化(差分再構築)
- 内容: 全量 map は残すが、rig control ごとに `(自身+祖先のバインド値)` をキーに評価済み形状をキャッシュ。パラメータ 1 個変更で影響を受ける rig control(自身+子孫サブツリー)だけ再計算。
- 効果見込み: 高(変わらない大多数をスキップ)。ただし「毎回全件 map して個別に `===` 判定」する土台コストは残る。案 A より弱い(全量は消えない)。
- 変更規模: 中。キャッシュ層 + 依存グラフ(§3-a、parameter→rig 逆引きが要る)。
- 壊れ得るもの: キャッシュキーの同値判定バグ(祖先変更の取りこぼし → 表示が古いまま)。keyform 状態の参照安定性が前提。**リスク中**(キー設計を誤ると視覚バグ)。

### 案 C: 評価のレンダー外化(useMemo → useEffect/外部ストア)
- 内容: §4。dev の StrictMode 二重評価を潰す。案 A/B と直交(併用可)。
- 効果見込み: dev 体感で最大 2 倍(本番は二重が無いので効かない)。日常作業が dev なので体感直撃(improvement-approach §3-5)。
- 変更規模: 中〜大(状態管理波及、preview 同期の二層化)。
- 壊れ得るもの: 初回 projection 未確定ハンドリング、preview ドラッグ追従の遅延、`warpControlPoints`/`rotationDeformer` の依存連鎖。**リスク中**。案 A で単価を下げれば C の緊急度は下がる(二重でも軽い)。

### 案 D: deformerVertex のクローン削減 + toFixed 除去(第二標的)
- 内容: §5。3 重クローンの削減(評価済みメッシュを参照渡し or typed array 化)、表示経路の `normalizeTransformNumber`(toFixed12)除去。
- 効果見込み: 中(17.0% → 削減)。案 A の後の次点。
- 変更規模: 中(表示専用境界の維持が要件)。
- 壊れ得るもの: 保存/export への漏れ(境界 = `cloneMesh` `:921`)。決定性テスト(byte 一致)は**保存経路のみ**なので表示経路の緩和は許容(improvement-approach §3-2)。ただし既存テストが表示座標の toFixed 前提なら要調整。**リスク中**。

### 案 E(併用小物): unionRects の Spread 除去等
- `unionRects`(`:1115-1132`)は `Math.min(...arr)` の spread。大 N でスタック負荷だが計測上 0.07%(v3)。**優先度低**。案 A/D と一緒に触るなら掃除する程度。

### 推奨の重ね順(設計対話の叩き台)
1. **案 A(本丸・選択駆動遅延評価)** — 主犯 75.8% を直撃、リスク低〜中、本番にも効く。
2. **案 D(deformerVertex)** — 次点 17.0%。
3. **案 C(レンダー外化)** — dev 体感。案 A 後は緊急度低下。
4. 案 B は案 A が採れない場合の代替(案 A で全量が消えれば B は不要になりがち)。

---

## 7. 質問(呼び出し元 Undine への確認)

1. **【設計方針の分岐点】案 A(選択駆動遅延評価)で `CanvasEvaluatedScene.rigControls` の契約を「全件配列」から「選択駆動の部分/遅延」に変えてよいか?** 消費者は §2 の通り 0〜1 個だが、`canvas-evaluation.test.ts` 等が全件配列を前提にしている。契約変更(テスト改修込み)を許容するか、案 B(全量維持のメモ化)で契約を保つかは設計判断。
2. **実モデルの lattice 密度(P)はいくつか?** 合成ベンチは全 rig control が 3×3=9 点固定。実モデルで warp lattice がより密(例 10×10)なら、コストは N×D だけでなく P も効き、案 A の効果と案 D の重みが変わる。計測 002 の 96.4ms を N×D×P で分解できると設計精度が上がる(要すれば追加計測の依頼先を示す)。
3. **parameter→rig control の逆引きは既存で引けるか(案 B 前提)?** `parameter-keyform-state.ts` に依存インデックスがあるか未精査。案 B を候補に残すなら、ここを追加調査すべきか指示を請う(案 A 採用なら不要)。
4. **rig ドラッグ中の preview 経路(`canvas-preview-panel.tsx:196,206`)も案 A の遅延評価に含めるか?** preview は選択 1 個の再評価なので案 A と整合しやすいが、preview 合成の同期性(ドラッグ追従)を保つ設計が要る。スコープに含める前提でよいか(improvement-approach §3-4 で「rig ドラッグも対象」は確定済みだが、案 A の実装単位として一体で扱うかの確認)。

---

## 参照 file:line 一覧

- `canvas-evaluation.ts:353` — createCanvasEvaluatedRigControls 全量呼び出し(主犯)
- `canvas-evaluation.ts:566-575` — 全 rig control を map で再構築
- `canvas-evaluation.ts:577-605` — warp 1 個の再構築(chain 適用 + cloneVec2 三系列)
- `canvas-evaluation.ts:607-634` — rotation 1 個の再構築
- `canvas-evaluation.ts:636-657` — createWarpRestControlPoints(P 点生成)
- `canvas-evaluation.ts:779-795` — applyRigControlChainToPoint(P×D 適用)
- `canvas-evaluation.ts:1156-1161,1195-1201` — cloneVec2 / normalizeTransformNumber(toFixed12 文字列往復)
- `canvas-evaluation.ts:260-350,754-777,921-931` — deformerVertex 経路と cloneMesh
- `canvas-projection.ts:288-293,392-418` — evaluatedScene.rigControls の唯一の消費者 resolveDeformerOverlay(選択 0〜1 個)
- `canvas-projection.ts:253,311` — cloneEvaluatedMesh / createProjectionContentKey
- `canvas-render-scene-adapter.ts:28-73,83-84` — 実描画は rig control 非参照 / clonePoint
- `canvas-preview-panel.tsx:156-210,246-` — createProjection/projection useMemo / preview 連鎖 / 描画 effect
- `use-warp-deformer-control-point-interaction.ts:170-180` — preview=null 時 素通し
- `packages/render-core/src` — rig 評価キャッシュ機構は不在(Grep 確認)
- baseline-synthetic-v3.md §4-6 / real-model-002.md / double-evaluation-diagnosis.md — 計測・二重評価の確定事実
