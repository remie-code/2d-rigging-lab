# Canvas 経路の二重評価 診断レポート

> Status: Recorded(2026-07-07)
> 調査者: Sylph(調査担当、読み取り専用)。委任元: Undine(L0)
> 対象: Editor Canvas 経路で 1 描画あたり評価(createCanvasRenderProjection / canvas.evaluation)が 2 回実行される機序の特定
> 根拠: 構造読解(file:line 付き)+ 計測 002(`discussion/render-performance/measurements/real-model-002.md`)。計測フックの有無に依存しない構造判断で結論を出した。

---

## 0. 結論(先に要約)

- **根本原因は React StrictMode による開発モードの二重実行**。`apps/editor/src/main.tsx:14` で `<StrictMode>` が全アプリを囲っており、開発ビルドでは純粋であるべきレンダー計算(コンポーネント本体 + `useMemo`)を React が意図的に 2 回実行する。評価を保持している `projection = useMemo(() => createProjection(), [createProjection])`(`canvas-preview-panel.tsx:189`)がこの二重実行の対象となり、1 コミットあたり評価が 2 回走る。
- **描画(renderSceneAdapter)は `useEffect` 内**(`canvas-preview-panel.tsx:288-310`)にあり、コミット後に 1 回だけ実行される。StrictMode はレンダーは 2 回流すが commit/effect は 1 回に畳む。よって **評価 92 = 描画 46 × 2** が過不足なく説明できる。
- **2 回の評価は完全に冗長**(同一入力・同一結果の再計算)。preview(rig ツールのドラッグ)由来の「異なる入力に対する 2 回目」ではない。今回の計測はスライダー操作(rig 非ドラッグ)であり、preview 経路は評価を追加していない(下記 §3)。
- **ただし本番ビルドではこの二重実行は起きない**(React の仕様: StrictMode の二重実行は development のみ)。計測 002 がどの実行モードで取られたか(dev server か 本番ビルドのプレビューか)で「本番でも二重評価が残るか」が変わる。これは **未解決の質問**(§6)。

---

## 1. 経路の全体像(リポジトリ事実)

Canvas 描画 1 サイクルで評価/描画がどこで起きるか。すべて `apps/editor/src/`。

| 段 | 何が起きるか | file:line | React 上の位置 |
|---|---|---|---|
| A | `createProjection()` を定義(`createCanvasRenderProjection` を呼ぶ callback) | `workspace/panels/canvas-preview-panel.tsx:156-188` | `useCallback` |
| B | **`projection = useMemo(() => createProjection(), [createProjection])`** ← ここで評価が走る | `canvas-preview-panel.tsx:189` | `useMemo`(= レンダー中の計算) |
| C | `createCanvasRenderProjection` → `createCanvasEvaluatedScene`(評価本体) | `canvas/canvas-projection.ts:198` → `canvas/canvas-evaluation.ts:217` | B から同期呼び出し |
| D | 評価末尾で `canvas.evaluation.ms` timing と `canvas.evaluation.caller.canvas` counter を記録 | `canvas-evaluation.ts:375-376` | 評価の一部 |
| E | 描画: `renderCanvasProjection(...)` を effect 内で呼ぶ | `canvas-preview-panel.tsx:288-310`(effect), `294` で呼ぶ | `useEffect` |
| F | `renderCanvasProjection` → `createRenderSceneFromCanvasProjection`(= renderSceneAdapter) | `canvas/canvas-renderer.ts:193` → `canvas/canvas-render-scene-adapter.ts:28` | E から同期呼び出し |
| G | renderSceneAdapter 末尾で `canvas.renderSceneAdapter.ms` timing を記録 | `canvas-render-scene-adapter.ts:71` | 描画の一部 |

**要点(リポジトリ事実)**:
- 評価(C, カウンタ D)は **レンダー中の `useMemo`** に置かれている(`canvas-preview-panel.tsx:189`)。
- 描画(F, カウンタ G)は **`useEffect`** に置かれている(`canvas-preview-panel.tsx:288`)。`renderCanvasProjection` は既に評価済みの `input.projection` を受け取るだけで、内部で `createCanvasEvaluatedScene` を呼ばない(`canvas-renderer.ts:77`, `193` — 評価呼び出しは無し。Grep で確認済み)。
- したがって **評価回数はレンダー回数に、描画回数はコミット/effect 回数に対応する**。React の実行モデル上、この 2 つがずれるのは自然。

---

## 2. 二重評価の根本原因(容疑の判定)

委任で挙がった容疑 (a)〜(d) を構造で潰す。

### 判定: (d) その他 = React StrictMode(開発モードの意図的二重実行)が主因

**リポジトリ事実**:
- `apps/editor/src/main.tsx:1,14-16`: `import { StrictMode } from "react"` し、`createRoot(...).render(<StrictMode><EditorApp /></StrictMode>)`。**環境ガード無し**で常に囲っている。
- StrictMode の development 挙動(React 公式仕様): 副作用を持たないはずのレンダー(コンポーネント関数本体 + `useMemo`/`useReducer` 等の計算)を **2 回呼ぶ**ことで純粋性違反を検出させる。一方 commit フェーズ(DOM 反映)と `useEffect` は畳んで **1 回**にする(mount 時のみ effect の setup→cleanup→setup で追加実行はあるが、更新時の effect は 1 回)。

**帰結(推測、ただし計測と一致)**:
- 評価は `useMemo`(§1 の B/C)にあるので **1 コミットあたり 2 回**評価される。
- 描画は `useEffect`(§1 の E/F)にあるので **1 コミットあたり 1 回**描画される。
- ⇒ **評価 count : 描画 count = 2 : 1**。計測 002 の `canvas.evaluation.ms` count = 92、`canvas.renderSceneAdapter.ms` count = 46 と厳密一致。

### 他容疑の消し込み

- **(a) 再レンダーと rAF 描画の両方が評価を起動**: ✗。rAF(描画)側は評価を呼ばない(`canvas-renderer.ts` に `createCanvasEvaluatedScene` 呼び出し無し)。評価は `useMemo` 側だけ。
- **(b) 同一フレーム内で projection が 2 箇所から要求(描画用 + ヒットテスト/インスペクタ用)**: ✗。本番経路で `createCanvasRenderProjection` を呼ぶのはプロダクションでは 3 箇所のみ — `canvas-preview-panel.tsx:163`(caller: `canvas`)、`viewer/viewer-runtime-screen.tsx:439`、`viewer/viewer-clean-stage.ts:61`(Grep 済み)。後 2 者は Viewer 経路で、計測 002 は Viewer 非表示のため未実行(counter に viewer 系がゼロ、caller.canvas のみ 92 と整合)。Canvas パネル内で `createProjection()` を呼ぶのは `useMemo`(:189)の 1 箇所のみ。ヒットテスト(`hitTestTopmostDrawable`)は既存 `renderProjection` を読むだけで再評価しない(`canvas-preview-panel.tsx:542`)。
- **(c) メモ化の失敗(useMemo 依存が毎フレーム変わる)**: ✗(これは二重評価の原因ではない)。`projection` useMemo の依存は `[createProjection]`、`createProjection` の依存は `parameterValues` 等(:177-187)。スライダーで `parameterValues` が変われば `createProjection` が作り直され `projection` も再評価される — これは **正当な 1 回**。問題は「その正当な 1 回が StrictMode で 2 回に膨れる」こと。メモ化が壊れて毎フレーム余分に走っているわけではない(もしそうなら評価:描画が 2:1 のきれいな比にならない)。**むしろ 2:1 の厳密さが StrictMode 説の強い傍証**。

---

## 3. 2 回の評価は同一入力か(冗長性の判定)

**判定: 完全に冗長(同一入力・同一結果)**。

- StrictMode の二重実行は「同じ props/state で同じレンダー関数を 2 回呼ぶ」もの。入力は同一、出力(projection)も同一(評価は純粋関数)。2 回目の結果は React 内部で捨てられ(または 1 回目と等価として扱われ)、描画には片方しか使われない。
- 「preview(ドラフト状態) vs 確定状態 の正当な 2 回」ではない根拠: preview 経路(rig ツールのドラッグ中)の追加評価は、`use-warp-deformer-control-point-interaction.ts:170-180` と `use-rotation-deformer-interaction.ts:166-173` の `renderProjection` useMemo にある。両者とも **`preview === null` のときは `input.projection` をそのまま返し、追加評価を一切しない**。計測 002 はスライダー操作(rig ドラッグではない)なので preview は常に null。よって preview 由来の 2 回目評価は存在しない。二重は純粋に StrictMode 由来。

補足(リポジトリ事実): rig ツールでコントロールポイント/ピボットをドラッグしている最中は、上記フックの `createPreviewProjection` が **さらに追加の評価**を起こす(`canvas-preview-panel.tsx:196,206` が `createProjection({ preview })` を渡す)。つまり **ドラッグ中は StrictMode 抜きでも 1 コミットに評価が複数回走り得る**。ただしこれは今回計測の対象操作(スライダー)ではないので、92 の二重には寄与していない。改善設計時には別途考慮すべき副次経路。

---

## 4. renderSceneAdapter(46 回)との対応

- 描画に使われた評価は **StrictMode の 2 回のうち「commit された 1 回分」**。React は 2 回のレンダー計算のうち片方(通常は最終)の結果でコミットし、その `renderProjection` が effect(`canvas-preview-panel.tsx:288`)経由で `renderCanvasProjection` に渡り、renderSceneAdapter が 1 回走る。
- **もう 1 回の評価結果は消費されず捨てられる**(StrictMode の破棄レンダー)。純粋な無駄仕事。
- したがって renderSceneAdapter 46 は「実際に画面へ反映されたフレーム数」に対応し、評価 92 のうち **46 回分(半分)は完全に捨てられている**。

---

## 5. counters の傍証検算(計測 002 の値との整合)

計測 002 の値: `parameterBar.slider.rawEvents 34 / coalescedUpdates 7 / appliedFrames 27 / appliedUpdates 50 / skippedNoOpUpdates 3`。

カウンタ実装(`workspace/controls/raf-coalesced-number.ts`):
- `rawEvents`(:56): `schedule()` 呼び出し = 生スライダーイベント数。
- `coalescedUpdates`(:60): 既に rAF 予約中に来て合流された数。
- `appliedFrames`(:42): rAF フレームで実際に `onCommit` した数。

**検算 1(コアレシングの整合)**: `appliedFrames = rawEvents − coalescedUpdates` が期待値。34 − 7 = **27 = appliedFrames**。**完全一致**。入力 34 回が 27 フレームに畳まれた。

**検算 2(appliedUpdates / skippedNoOpUpdates)**: これは `raf-coalesced-number.ts` のカウンタではない(Grep で `parameterBar.slider.appliedUpdates` の記録箇所は本ファイルに無し)。命名から `onCommit` 内(parameter 適用ロジック)で、実適用 50 / no-op スキップ 3 を数える別カウンタと解される(記録元は `editor-session-context.tsx` / `parameter-bar.tsx` 側の可能性。本調査では未特定 — 二重評価の判定には不要)。appliedFrames 27 とは母数が異なる別系列であり、矛盾は生じない。

**検算 3(二重評価説との整合)**: スライダー適用フレーム 27 に対し、実際のレンダーコミット(= renderSceneAdapter)は 46。46 > 27 は自然(スライダー起因コミット 27 に加え、フック内の state 更新・hover・その他再レンダーが上乗せされ得る)。そして各コミットが StrictMode で評価 2 回 ⇒ 46 × 2 = 92。**すべて整合**。カウンタ群は二重評価の機序(StrictMode)と矛盾しない。

---

## 6. 修正候補筋(診断が主目的、修正はしない)

根本原因が「開発モード限定の StrictMode 二重実行」か「本番でも残る構造問題」かで、打ち手の意味が根本的に変わる。**まず §7 の質問を解消してから設計に進むべき**。以下は候補列挙。

### 候補 A: 計測を本番ビルド(または StrictMode 無効)で取り直し、二重評価が開発アーティファクトか確定させる
- 影響範囲: なし(計測のやり直しのみ)。表示/状態に波及しない。
- 規模: 極小。
- 位置づけ: **最優先の切り分け**。もし本番ビルドで評価:描画 = 1:1 なら、二重評価は開発時だけの見かけ上のコストであり、「約 2 倍改善」の即効源は本番には存在しない(実ユーザー体感は artworkBoundsAndAssembly 96ms 側が主因のまま)。この場合、二重評価対策の投資対効果は開発体験(HMR 中の重さ)に限定される。

### 候補 B: 評価(重い純粋計算)を StrictMode の二重実行対象から外す
StrictMode を残したまま、重い評価が 2 回走らないようにする方向。開発時のみ効くが、開発体験を軽くする。
- B-1: 評価を `useMemo` から `useEffect`(または useSyncExternalStore / 外部ストア)へ移し、レンダー中に走らせない。
  - 影響範囲: **状態管理に波及(中)**。`projection` を state 化する必要があり、`renderProjection`/`warpControlPoints`/`rotationDeformer` の依存グラフ(`canvas-preview-panel.tsx:190-244`)が同期レンダー値でなくなる。初回レンダーで projection 未確定になるハンドリングが要る。
  - 規模: 中〜大。
- B-2: 評価結果を入力キーでキャッシュ(メモ化テーブル)し、同一入力の 2 回目を計算スキップ。
  - 影響範囲: 表示のみ(小〜中)。`createCanvasRenderProjection` の外側にキャッシュ層を置く。StrictMode の 2 回は同一入力なので 2 回目がヒットして評価本体を飛ばせる。ただしキャッシュキーの設計(session/selection/parameterValues/drafts の同値判定)が重い入力に対して正しく安価であることが前提。
  - 規模: 中。

### 候補 C: 本番ビルドでも二重評価が残っていた場合(= StrictMode 説が外れた場合)の再調査
- もし §7 の切り分けで本番でも 2:1 が出たら、本レポートの主因判定は誤り。その場合は「レンダーが 1 コミットで 2 回走る別要因」(親コンポーネントの二度セット、`setView`/`setViewport` の初回連鎖など)を rerender カウンタで追う再調査が必要。
- 影響範囲/規模: 不明(再調査次第)。

### 補足(いずれの筋でも共通する上流の本丸)
- 二重評価を仮に解消しても、**1 評価あたり 127ms(うち artworkBoundsAndAssembly 96ms = 75.8%)** という単価は残る(計測 002 確定事項)。二重評価解消は「最大 2 倍」の頭打ちで、単価削減(Perf Wave 1.3 の内部分離計測 → `createCanvasEvaluatedRigControls` の rig 全量再構築+cloneVec2 の疑い)と両輪で進める必要がある。二重評価の即効性は「本番でも二重が残るなら」高い、という条件付き。

---

## 7. 未解決の質問(呼び出し元 Undine への確認)

1. **【最重要】計測 002 はどの実行モードで取られたか?**
   dev server(`vite dev` / `import.meta.env.DEV === true`)か、本番ビルドのプレビュー(`vite preview` / production bundle)か。
   - dev なら: 二重評価は StrictMode の開発時アーティファクトで確定。**本番ユーザーには二重評価は無い**。よって「二重評価解消で本番約 2 倍」は成立せず、即効源は artworkBoundsAndAssembly 側。二重評価対策は開発体験(HMR 時の重さ)向けの投資になる。
   - 本番ビルドなら: 本レポートの StrictMode 主因説は成立しない(本番で StrictMode は二重実行しない)。§6 候補 C の再調査が必要。
   - 計測手順書(`perf-wave1/domain-pa-report.md:121-152`)は「Editor で開く」としか書いておらず、モードを断定できなかった。ユーザーの計測環境の確認を要する。

2. 副次経路の扱い: rig ツールでのドラッグ中は preview 経路(`canvas-preview-panel.tsx:196,206`)が StrictMode 抜きでも追加評価を起こす(§3 補足)。今回のスライダー計測には無関係だが、改善設計のスコープにドラッグ操作の評価回数も含めるか?

---

## 参照 file:line 一覧

- `apps/editor/src/main.tsx:1,14-16` — StrictMode で全アプリを包む(環境ガード無し)
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:156-189` — createProjection callback と `projection` useMemo(評価の起動点)
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:288-310` — 描画 effect(renderCanvasProjection を useEffect 内で呼ぶ)
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:196,206` — preview 経路の追加評価(ドラッグ中のみ)
- `apps/editor/src/workspace/canvas/canvas-projection.ts:198,313` — `createCanvasEvaluatedScene` 呼び出しと `canvas.projection.ms`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts:217,375-376` — 評価本体と `canvas.evaluation.ms` / `caller` counter
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:77,193` — `renderCanvasProjection`(評価を呼ばず projection を受けるだけ)
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:28,71` — renderSceneAdapter 本体と `canvas.renderSceneAdapter.ms`
- `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:170-180` — preview=null時に input.projection 素通し
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:166-173` — 同上
- `apps/editor/src/workspace/controls/raf-coalesced-number.ts:42,56,60` — slider rawEvents/coalescedUpdates/appliedFrames カウンタ
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:439`, `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:61` — 他の本番評価呼び出し元(Viewer 経路、計測 002 では未実行)

---

## 追記: ユーザー確認による結論の確定(2026-07-07、Undine 記録)

- **計測002および普段の使用は dev server(開発モード)** — ユーザー確認済み。よって二重評価は StrictMode の開発時アーティファクトで確定。**本番ビルドには存在しない**
- ただしユーザーの日常のリギング作業は dev server 上で行われているため、**開発モードの二重評価は体感品質に直撃し続けている**。「本番に効かんから無視」は誤り
- 改善設計への含意: 評価をレンダー中計算(useMemo)から外へ出す筋(effect / 外部ストア / キー付きキャッシュ)は、StrictMode 二重実行の解消と設計健全化を同時に満たす候補として設計対話で扱う
- **rig ツールのドラッグ操作(プレビュー経路の追加評価)も改善設計の対象に含める** — ユーザー確定
