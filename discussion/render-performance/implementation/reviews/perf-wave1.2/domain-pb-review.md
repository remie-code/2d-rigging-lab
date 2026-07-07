# Perf Wave 1.2 — Domain P-B Review（計測細分化 + 呼び出し元タグ）

> Domain: `perf-wave1_2-gap-breakdown`
> レビュー担当: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph, Perf Wave 1.2）
> Reviewed: 2026-07-07

## 判定: **合格**

契約（perf-wave1.2-plan.md §3）の Allowed/Forbidden write scope・Required implementation 4点・gate をすべて満たす。挙動不変（計測のみ・最適化なし）を差分と自己再実行テストの両方で確認した。被覆率目標（残余 <10%）は自環境で再現し大幅にクリア（全 scale 残余 <1%）。以下、観点1-5すべて合格。裁量注記と Gnome の質問への見立てを末尾に付す。

---

## 観点1: 挙動不変（テスト自己再実行） — 合格

自分でテストを走らせて green を確認済み。Gnome の記述を鵜呑みにせず実行結果で裏取りした。

| 実行 | コマンド | 結果 |
|------|---------|------|
| canvas + viewer 全体 | `npx vitest run apps/editor/src/workspace/canvas apps/editor/src/workspace/viewer` | **17 files / 168 passed / 4 skipped / fail 0** |
| 計測 skip 版 bench | （上記に含まれる `synthetic-heavy-model.bench.test.ts`） | **10 passed / 4 skipped**（caller テスト2件 green） |
| typecheck (root) | `npx tsc --noEmit` | **EXIT 0（pass）** |
| check:source | `node scripts/check-source-organization.mjs` | **pass（EXIT 0）** |
| check:deps | `node scripts/check-dependencies.mjs` | **pass（EXIT 0）** |

- `canvas-evaluation.test.ts`（16）/ `canvas-projection.test.ts`（20）を含む評価系テストが全 green。評価結果不変。
- report §7 は bench を「6 passed / 3 skipped」と記すが、実行結果は「10 passed / 4 skipped」だった。これは数え方の差（describe ブロック単位 vs it 単位、caller テスト2件の常時実行分の合算）であり、**fail は 0** で挙動不変の結論に影響なし。裁量注記として記録。
- 既知 baseline fail（diagnostics-jump-actions 4件）はこの2ディレクトリに出ず（別ディレクトリ）、実際に出現しなかった。

## 観点2: OFF時ゼロコスト（構造で検証） — 合格

計測ヘルパー実装（`packages/render-core/src/performance-instrumentation.ts`）を実読して裏取りした:
- `startLive2dPerformanceTiming()` は OFF 時 `null` 即返し（L58-64）。
- `recordLive2dPerformanceTiming(name, start)` は `startMs === null || OFF` で即 return（L66-70）。
- `recordLive2dPerformanceCounter(name)` は OFF 時即 return（L46-52）。

canvas-evaluation.ts の追加コード（L221-375）を差分で確認:
- 追加 timing start 3本（`indexBuildTimingStart` L222 / `rigControlEvalTimingStart` L241 / `artworkBoundsAndAssemblyTimingStart` L351）は**すべて `number | null` スカラ**。ガード外での配列/オブジェクト新規割り当てなし。
- 追加 start/record は**すべてホットループの外側**。区間4（deformerVertex）の start は L260、record は L350 で、`session.graph.drawables.map(...)`（L261-349）を外から挟む。ループ**内**に計測は一切なし。頂点 `.map()`（`applyRigControlChainToVertices` 等）内にも計測なし。
- caller counter のキー生成 `` `canvas.evaluation.caller.${options.evaluationCaller ?? "unknown"}` ``（L375）は評価1回あたり O(1) の文字列連結1回。drawable/頂点数に非依存。helper が OFF 時 return しても連結自体は起きるが、短命な文字列1個のみでループ非依存 → **許容範囲**と判断。report §2 の自認と一致し妥当。
- OFF 時の追加コストは「関数呼び 新 start×3 + 新 record×3 + null 比較 + counter 呼び×1 + O(1) 連結×1」/ 評価1回で、drawable/頂点数に非依存。ゼロコスト要件を満たす。

## 観点3: 被覆率の実証（内訳合計 vs evaluation 全体） — 合格（本 wave の核心）

自環境で `RUN_PERF_BENCH=1` bench を実行し被覆率を再現した。絶対時間は環境で変動するが、比率は report と一致再現:

| scale | 自環境 被覆率（残余） | report 被覆率 | 一致 |
|-------|--------------------|-------------|------|
| light    | 99.206%（0.794%） | 99.28% | ✅ |
| medium   | 99.911%（0.089%） | 99.90% | ✅ |
| heavy    | 99.984%（0.016%） | 99.99% | ✅ |
| rigHeavy | 99.960%（0.040%） | 99.97% | ✅ |

- **全 scale で被覆率 99% 超、残余 <1%。目標（<10%）を大幅にクリア**。90% 閾値を全 scale で満たす。
- **非オーバーラップ（二重計上なし）を実コードで検証**: canvas-evaluation.ts の縫い目は report §2 の図と完全一致。各スパンの record が次スパンの start の直前に隣接（[1]record L234 → [2]start L235 / [2]record L240 → [3]start L241 / [3]record L258 → [4]start L260 / [4]record L350 → [5]start L351）。record が次 start より前に来て時系列で交わらない。隣接ペア間に新規オブジェクト割り当てを伴う処理なし。二重計上なし。
- `reportBenchStats`（bench.test.ts L232-299）の breakdownTotalMs = 5スパン totalMs 合計、coveragePct = breakdownTotalMs / wholeTotalMs の計算が baseline-synthetic-v2.md §5 と整合。

## 観点4: 呼び出し元タグの正しさ（タグ集計と実呼び出し構造の突合） — 合格

- **3経路のタグが正しい箇所に設定**（実コードで突合）:
  - `canvas-preview-panel.tsx` L164（`createProjection`、Canvas プレビュー描画経路）→ `"canvas"` ✓
  - `viewer-runtime-screen.tsx` L440（`createViewerRuntimeCleanStageProjection` 内 `originalProjection`）→ `"viewerRuntime"` ✓
  - `viewer-clean-stage.ts` L62（`createViewerCleanStageRenderSourceProjection`）→ `"viewerCleanStage"` ✓
  経路名と関数名が一致。命名も正確。
- **タグが評価結果に影響しない**（差分で確認）: `evaluationCaller` は canvas-evaluation.ts で record（L375）にのみ渡され、評価ロジックの分岐に一切使われていない。canvas-projection.ts は `...(options.evaluationCaller === undefined ? {} : { evaluationCaller })` で読み取り伝播のみ（未指定時は展開しない=既存挙動不変）。
- **突合関係「caller.* 総和 = canvas.evaluation.ms の count」が成立する設計**: counter 記録（L375）は全体 record（L376）の直前で、評価パスを通れば必ず1回だけ実行される。取りこぼし/二重記録なし。自環境 bench で全 scale `caller.unknown = 20 = BENCH_ITERATIONS = evaluation count` を確認。
- **caller 検証テスト2件（bench.test.ts L124-189）が突合とタグ非影響性を実テスト**:
  - L135-162: 同一 session をタグ有/無で評価 → `JSON.stringify` byte 一致（タグ非影響）＋ `caller.canvas=1`/`caller.unknown=1`＋ caller 総和 = evaluation count。
  - L164-189: 3経路タグがそれぞれ専用カウンタに1ずつ振り分けられる。
  両テスト green を観点1で確認済み。

## 観点5: 最適化の混入なし / スコープ厳守 — 合格

- **評価・描画の挙動変更、最適化の先行実装なし**: canvas-evaluation.ts の差分は純粋に加法的（import 1行 / 型 `CanvasEvaluationCaller` + JSDoc / options 1フィールド / timing start・record / caller counter 1行）。削除行（評価数値を生む `-` 行）は一切なし。`applyRigControlChainToVertices` / `computeEvaluatedMeshBounds` / `unionRects` / `createCanvasEvaluatedRigControls` の中身・順序に手が入っていない。頂点変形・clone・bounds・rig control 評価の数値/順序不変。
- **packages/** 無変更**: `git diff --stat -- packages/` が空。既存 export（`recordLive2dPerformanceCounter` / `recordLive2dPerformanceTiming` / `startLive2dPerformanceTiming`）を利用しただけ。
- **依存/lockfile 変更・commit なし**: git status に依存/lockfile 変更なし。commit されていない（working tree 上の変更のまま）。

## 差分・残課題

- 変更5ファイルの差分は委任プロンプト記載どおり。追加51行/削除4行（削除4行は canvas-projection.ts の options 展開の書き換えに伴う整形で、挙動不変）。
- **注記（fixture の tracked 状態）**: `synthetic-heavy-model.ts`（fixture）と `synthetic-heavy-model.bench.test.ts` は git 上 **untracked（新規・未コミット）**。前 wave（perf-wave1）で追加されコミットされていないため、git diff で「fixture 無変更」を機械的に確認する術は git 履歴上に存在しない。ただし fixture の byte 一致は bench.test.ts の `is deterministic`（同一 scale で byte 一致セッション生成）テストで担保され、これは観点1で green を確認済み。fixture 生成軸（drawableCount/verticesPerMesh/deformerChainDepth/keyformSetCount）は変更されておらず、rigHeavy probe は既存軸の組み合わせのみで追加（report §5 の記述と一致）。本 wave が fixture 生成ロジックを変更していない点は、テスト green と report §5 の整合で十分に裏取りできる。合否には影響しない。

## Gnome の質問（report §9）への見立て

いずれも本 wave の合否を左右しない将来判断。見立てを添える:

1. **rigHeavy を常時テスト化するか** — 見送り妥当。時間計測ベースの assertion（例: `artworkBoundsAndAssembly > deformerVertex`）は環境依存で fragile。回帰的に「rig 過多で gap 構造が出る」ことを守りたいなら、時間ではなく**構造量**（rigControls 数 = drawableCount × chainDepth など、fixture 由来の決定的な値）に対する assertion なら常時テスト化できる。時間比較の常時テスト化は推奨しない。改善設計フェーズで判断すればよく、本 wave では現状維持が妥当。
2. **artworkBoundsAndAssembly 内部分離を次 wave でやるか** — 実モデル計測で当区間が gap 主犯と確定した場合のみ必要。Gnome 提案（`createCanvasEvaluatedRigControls` を独立関数化し呼び出しの外側で1区間計測、内側 `.map()` はガード外割り当てなし）は OFF時ゼロコストと両立でき妥当。ただし**確定前に先行実装しないのが正しい**（計測駆動の原則）。次 wave の条件付き課題として妥当。
3. **caller.unknown に count が出た場合の第4経路** — 妥当な安全網。現状3経路以外に `createCanvasRenderProjection` を直接呼ぶ消費者（インスペクタ等）があれば `unknown` に出る設計で、取りこぼしを検出可能。第4経路が実モデルで顕在化したら別途タグ追加、という段取りは正しい。本 wave のタグ設計はこの検出能力を備えており良い。

## 質問（呼び出し元 Orch-Sylph 向け）

- なし。契約・gate・被覆率目標すべて充足し、追加の判断を要する不足情報はない。上記 Gnome 質問3点は将来判断であり、本 wave の完了を妨げない。
