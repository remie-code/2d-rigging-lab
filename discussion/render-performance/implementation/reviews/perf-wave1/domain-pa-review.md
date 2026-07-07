# Perf Wave 1 — Domain P-A Review（フェーズ計測 + 合成ベンチ）

> Domain: `perf-wave1-instrumentation`
> レビュー担当: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）
> Status: **合格（条件なし。ただし注記1件 = typecheck 網羅の穴を要エスカレーション扱いで報告）**
> レビュー日: 2026-07-07 / 読み取り専任（修正なし）

## 0. 判定

**合格。** 契約（perf-wave1-plan.md §3）の Required を満たし、Forbidden 逸脱はゼロ。挙動不変・OFF時ゼロコスト・計測値の妥当性いずれも実証で確認。最適化の混入なし。

- 要修正の差分: **なし**（実装は受理可能）。
- ただし後述 §6 に「新規ファイルが CI の typecheck 経路に乗っていない（apps/editor が root typecheck 対象外）」という**契約未定義の網羅の穴**を発見。実装の欠陥ではないが、Orch-Sylph → ユーザー判断が要る事項として明記する。

## 1. 観点1: 挙動不変の実証（最重要）— 確認OK

### コード確認
`git diff apps/editor/src/workspace/canvas/canvas-evaluation.ts` は **+4行のみ**（計測フック2ペア）。評価ロジック本体（`applyRigControlChainToVertices` / `computeEvaluatedMeshBounds` / clone / keyform サンプリング / `normalizeTransformNumber`）への変更は**一切なし**。

追加された4行は全て `start`/`record` のスカラ取得と記録のみ:
- L223 `keyformTimingStart = startLive2dPerformanceTiming()` / L228 `record("canvas.evaluation.keyform.ms", ...)` → `createEvaluatedParameterKeyformState(...)` の1呼び出しを挟む。
- L246 `deformerVertexTimingStart = start()` / L336 `record("canvas.evaluation.deformerVertex.ms", ...)` → `drawables.map(...).filter(...).sort(...)` を挟む。

計測は `scene` の生成物（drawables の内容・順序・数値・opacity・bounds）に一切介入していない。返り値 `scene` の構築（L343-355）と `record` の呼び出しは独立。**評価の値の流れへの介入なし**を確認。

### テスト再実行（自分で実行・Gnome の主張を鵜呑みにせず）

```
npx vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts \
  apps/editor/src/workspace/canvas/canvas-projection.test.ts \
  apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts \
  apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts
→ 4 files / 44 passed | 3 skipped
  （canvas-evaluation 16 / canvas-projection 20 / canvas-render-scene-adapter 4 / bench 4passed+3skipped）
```

```
npx vitest run apps/editor/src/workspace/canvas apps/editor/src/workspace/viewer
→ 17 files / 166 passed | 3 skipped（canvas + viewer 共有経路すべて green）
```

report §6 の主張（canvas 全体 98passed/3skipped・viewer 68passed）と件数構成は整合。全 green、fail ゼロ（既知 baseline fail 4件 = diagnostics-jump-actions はスコープ外で未実行、これは契約許容）。非破壊テスト（`does not mutate the generated session during evaluation`）も green で、評価が session を変異させないことが担保されている。

## 2. 観点2: OFF時ゼロコストの構造確認 — 確認OK

- 計測基盤 `packages/render-core/src/performance-instrumentation.ts` は**無改変**（`git diff --stat packages/` 空）。`start` は OFF 時 `null` 即返し（`performance.now()` 不呼出）、`record` は `startMs === null` で即 return。ガード構造は既存のまま健全。
- 追加した `start`/`record` 3ペア（既存の全体計測 + 新規2つ）は**すべてホットループの外側**:
  - keyform: `createEvaluatedParameterKeyformState` の外側で1回。
  - deformerVertex: `drawables.map` チェーンの**外側**（`.map` 直前で start、`.sort` 直後で record）。ループ**内側**に計測は無い。
- ガード外の新規割り当ては `number | null` スカラ3つ（`timingStart` / `keyformTimingStart` / `deformerVertexTimingStart`）のみ。計測目的の配列/オブジェクト割り当てなし。
- したがって OFF 時追加コストは「関数呼び3回 + null 比較3回」/評価1回の**定数**であり、drawable 数・頂点数に非依存。構造上ゼロコストが崩れないことを確認。

## 3. 観点3: 計測値の妥当性 — 確認OK（自分でベンチ実行）

`RUN_PERF_BENCH=1` でベンチを**自分で1回実行**した結果（Win11 / 同環境）:

| scale | evaluation avg | keyform avg | deformerVertex avg | dv/全体 | adapter avg |
|-------|---------------|-------------|--------------------|---------|-------------|
| light  | 0.829ms   | 0.031ms | 0.411ms   | 49.6% | 0.058ms |
| medium | 12.291ms  | 0.078ms | 8.605ms   | 70.0% | 0.222ms |
| heavy  | 186.267ms | 0.240ms | 161.028ms | 86.4% | 2.150ms |

**report（baseline-synthetic.md §3）の数値をほぼ完全に再現。** 支配項の構造が確実に再現した:
- **仮説A（deformerVertex）が支配的**、light→medium→heavy で全体比 49→70→86% と増加。O(Σ 頂点数 × chain 深) と整合。
- **仮説B（keyform）はほぼ無関係**（全 scale で <0.3ms、全体の 0.1〜0.3%）。keyform 評価の O(K) が小さいことと整合。
- 内訳合計（keyform + deformerVertex）< evaluation 全体。heavy で 0.24+161.0 = 161.3ms に対し全体 186.3ms、差 **約25ms(13%)** は deformerVertex 区間外（index Map 群構築・`createEvaluationRigControls`・`createCanvasEvaluatedRigControls`・`unionRects`）。**二重計上なし**、内訳が全体を超える箇所なし。report の説明と一致。
- 決定性: `synthetic-heavy-model.bench.test.ts` の `is deterministic` テストが `serializeSessionShape`（`Uint8Array` を `Array.from` で JSON 化）で **byte 一致**を `.toEqual` 検証しており、担保あり。スケール反映テスト（件数・頂点数・binary entry 数）も green。

## 4. 観点4: 最適化の混入がないこと（Forbidden 逸脱チェック）— 逸脱なし

- `canvas-evaluation.ts` の評価本体（頂点変形・`normalizeTransformNumber`・clone・keyform）に計測以外の変更**なし**（差分 +4行が全て計測フック）。toFixed 除去・typed array 化・メモ化・dirty tracking・早期 return による評価スキップ等、**一切なし**。
- `packages/**` 無改変（`git diff --stat packages/` 空）。特に `performance-instrumentation.ts` 無改変を確認。
- 依存追加・lockfile 変更**なし**（`git diff` で `package.json` / `pnpm-lock.yaml` 空）。
- コミット**なし**（working tree 上の変更のみ）。
- 新規ファイル: `synthetic-heavy-model.ts` / `.bench.test.ts` の2つ + discussion 記録。discussion の `_map.md` / `_conventions.md` / `reports/_map.md` への追記（計14行）は記録の一部で scope 内。

## 5. 裁量判断（契約未定義だが合理的に実装された箇所）— 妥当

- **clone を deformerVertex から切り分けない選択**: `applyRigControlChainToVertices` と `cloneMesh`/`cloneVec2` は drawable ごとの `.map()` 内で密結合。内側に計測を入れると OFF 時にも drawable 数ぶんの関数呼び出しが乗り、OFF時ゼロコストが崩れる。よって「頂点変形 + clone 一括」に留めたのは**契約（粒度限界を正直に報告 > 無理な計測用リファクタで挙動変更）に忠実な妥当判断**。
- **RUN_PERF_BENCH ガード方式**: `describe.skipIf(!runPerfBench)` で重い計測（heavy×20反復）を既定 skip。CI 相当の通常実行では決定性・非破壊の軽量4件のみ走る。既存の計測前例（`viewer-runtime-screen.test.ts` 等の `__LIVE2D_PERF__=true` → 呼び出し → `getStats()` 読み）の慣行に整合。妥当。
- **決定性の担保方式**: 乱数・時刻を排し index 数式で全生成。決定性テストで byte 一致を明示検証。妥当。

## 6. 注記 / 質問（ユーザー判断が要る早期脱出事項）

### 注記1（重要・要エスカレーション）: 新規ファイルが typecheck 経路に乗っていない

契約 Required gate に「typecheck pass」があり、Gnome report §6 は「`npx tsc --noEmit`（root typecheck）pass」と主張。これは**事実として正しい**が、以下の網羅の穴がある:

- root `tsconfig.json` の `include` は `packages/*/src/**` `packages/*/test/**` `scripts/**` `vitest.config.ts` のみで、**`apps/**` を含まない**。`typecheck:root`（= `tsc --noEmit`）は apps を検査しない。
- `package.json` に `apps/editor` 専用の typecheck スクリプトは**未登録**（`typecheck:authoring-host` はあるが editor は無い）。
- したがって CI 経路の `pnpm typecheck` は **`apps/editor` の新規ファイルを一度も型検査しない**。

`apps/editor/tsconfig.json` を直接叩くと（`npx tsc --noEmit -p apps/editor/tsconfig.json`）、新規ファイル由来の型エラーが**2件**出る:
```
synthetic-heavy-model.ts(153,11): error TS2322: Type 'string[]' is not assignable to type 'DrawableId[]'.
synthetic-heavy-model.ts(164,7):  error TS2322: Type 'string[]' is not assignable to type 'RigControlId[]'.
```
`drawableIds` / `rigControlRootIds` を `string[]` で保持し branded 型フィールド（`DrawableId[]` / `RigControlId[]`）へスプレッド代入しているため。

**ただし判定への影響は限定的**:
- `apps/editor/tsconfig.json` 直接叩きは**元から clean ではない**（既存エラー計24件。うち TS2322=8, TS2379=5, TS2345=5 等が viewer/features/test 群に既存）。新規2件は**既存コードベースの型緩みの慣行（テスト・fixture で branded 型を string で埋める）と同質**で、`viewer-render-source.test.ts` 等にも同型のエラーが既存。
- テストは全 green、決定性・スケール・非破壊が担保済み。**実行時挙動・計測結果・決定性に一切影響しない**（branded 型は実行時 string と同一表現）。
- 契約 gate の「typecheck pass」は CI 定義上 pass（apps は対象外）。よって**契約違反ではない**。

**この網羅の穴は本ドメインが作った問題ではなく既存のインフラ構成**。合格判定は維持するが、Orch-Sylph → ユーザーに次を確認したい:
- Q1: perf-wave1 の Required gate「typecheck pass」は apps/editor を検査しない前提でよいか。それとも新規ファイルは branded 型（`DrawableIdSchema.parse` 済みの `drawableId` を `string` でなく `DrawableId` として配列に積む等）で型を通すべきか。後者なら **synthetic-heavy-model.ts の L83 `drawableIds: string[]` を `DrawableId[]` にし、push 箇所で parse 済み値を使う**軽微修正で解消可能（挙動不変）。ただし既存慣行に倣うなら現状維持も一貫性がある。

### 質問（Gnome report §8 の設計者向け質問を Orch 経由でユーザーへ）
- Q2: clone 単独の内訳（頂点変形本体 vs cloneMesh vs cloneVec2）の分離が改善設計に必要か。必要なら OFF時ゼロコストと両立する別 wave 設計が要る（本 wave は deformerVertex 一括で妥当に留めた）。
- Q3: 実モデル計測は report §5 の DevTools 手順で足りるか。Editor UI に計測トグルを出すなら挙動変更 = 別 wave。
- Q4: 仮説C（マスク FBO）の定量化には WebGL2 実行環境が要る。実モデルの webgl2 カウンタで代替する前提でよいか。

## 7. 参考: 無関係な untracked（逸脱ではない）
`apps/runtime-player/private-2d-rigging-lab-runtime-player-0.0.0.tgz`（約238MB, mtime 21:24）は本ドメイン成果物（21:47〜）より前の別作業の残置物。本レビューの逸脱判定には影響しない（記録のみ）。
