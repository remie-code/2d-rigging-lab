# Perf Wave 1.3 — Domain P-C Review（artworkBoundsAndAssembly 内部分離計測）

> Domain: `perf-wave1_3-assembly-breakdown`
> レビュー担当: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph, Perf Wave 1.3 / Domain P-C）
> 判定: **合格（要修正なし）**
> ループ番号: Loop 1
> レビュー日: 2026-07-07

## 0. 判定サマリ

Gnome の実装は perf-wave1.3-plan §3 の契約を全て満たす。3子スパン分離は純粋リファクタ（scene リテラル外への
`createCanvasEvaluatedRigControls` 引き上げ 1 点のみ）に留まり、評価結果は byte 一致（既存 caller テストで実証）、
OFF時ゼロコスト構造を維持、内側被覆率は全 4 scale で ≥98.99%（目標 <10% 残余を大幅達成）を自己再現で確認した。
最適化の混入・scope 逸脱は認めない。全 gate（root tsc / apps/editor tsc 新規0件 / check:source / check:deps /
canvas+viewer 168 pass）を自己再実行で pass 確認。

## 1. diff の切り分け（Wave1.3 増分の同定）

委任どおり Wave1.2 が未コミット（HEAD = meshv7）のため混在するが、本レビューは Wave1.3 増分のみを判定した。

- `git status` により **`synthetic-heavy-model.bench.test.ts` / `synthetic-heavy-model.ts` は untracked（`??`）**
  と確認。両者は Wave1.2 で新規作成されたファイルで HEAD に存在せず、`git diff HEAD` には現れない。よって
  bench.test.ts の Wave1.3 増分（3子スパンの count 検証 L228-237 / `assemblyChildSpanKeys` L262-269 /
  inner-coverage 計算 L296-303 / inner-coverage ログ L326-330）はファイル現内容として直接検証した。
- `canvas-evaluation.ts` の `git diff HEAD` は Wave1.2 分（indexBuild/keyform/rigControlEval/deformerVertex の
  5スパン化・`evaluationCaller` タグ・caller counter）と Wave1.3 分を混在表示する。**Wave1.3 の増分は L350-386**:
  deformerVertex record 直後の `artworkBoundsAndAssemblyTimingStart`（親スパン）+ 3子スパン
  （assembly.rigControls / assembly.artworkBounds / assembly.rest）+ `createCanvasEvaluatedRigControls` を
  scene リテラル外に引き上げて `const evaluatedRigControls` に束ねた並べ替え。projection/panel/viewer の caller
  配線・上流4スパンは Wave1.2 成果で対象外とした。

## 2. 各観点の適合

### 観点1: 挙動不変（純粋リファクタ・byte 一致）— 適合

- **並べ替えの独立性をコードで確認**（canvas-evaluation.ts）:
  - `evaluatedRigControls = createCanvasEvaluatedRigControls(rigControls, rigControlsById)`（L353）: 引数は
    L242/L249 で確定済み（deformerVertex 区間より前）。`rigControls.map(...)` で新配列を返す純関数、共有状態を
    mutate しない。
  - `unionRects(...)`（L359 / 実装 L1115）: 確定済み `drawables`（L261-349）の bounds を読む純関数、副作用なし。
  - `resolveEvaluationCanvasBounds(session)`（L370 / 実装 L1014）: `structuredClone` を返す純関数。
  - maskRelations map（L374-380）: `session.graph.masks` を読み新配列を返す。副作用なし。
  - 4者は互いの出力に依存しない。よって「rigControls 引き上げ → unionRects → scene リテラル」への並べ替えは各
    戻り値を変えない。
- **scene のフィールド挿入順が Before/After 不変**: diff 上、scene リテラルは `rigControls:` 行が
  `createCanvasEvaluatedRigControls(...)` から `evaluatedRigControls` へ置換されただけで、挿入位置
  （canvasBounds → artworkBounds spread → drawables → rigControls → maskRelations）は不変。`JSON.stringify(scene)`
  は byte 一致する。
- **caller テスト「never alters the projection」pass を自己確認**（synthetic-heavy-model.bench.test.ts L151:
  `expect(JSON.stringify(tagged)).toEqual(JSON.stringify(untagged))`）。projection 全体（scene 含む）の byte 一致を
  守っており、リファクタ後も pass。
- **自己再実行**: `npx vitest run apps/editor/src/workspace/canvas apps/editor/src/workspace/viewer`
  → **17 files / 168 passed / 4 skipped（fail 0）**。canvas-evaluation.test.ts(16) / canvas-projection.test.ts(20) /
  canvas-render-scene-adapter.test.ts(4) / synthetic-heavy-model.bench.test.ts(10 pass, 4 skip) / viewer 全件を含む。
  Gnome 報告 §8 と一致。

### 観点2: OFF時ゼロコスト — 適合

- 追加 3 timingStart（`assemblyRigControlsTimingStart` / `assemblyArtworkBoundsTimingStart` /
  `assemblyRestTimingStart`）は `startLive2dPerformanceTiming()` の戻り値 = **`number | null` のスカラ**。ガード外に
  配列/オブジェクトの新規割り当てなし。
- start/record は全て `.map()` ホットループの外側。3子スパンは各々関数呼び 1 個（createCanvasEvaluatedRigControls /
  unionRects / scene リテラル評価）を丸ごと囲み、内側ループ（rigControls.map / drawables.filter().map() /
  masks.filter().map()）に食い込まない。
- 並べ替えによる OFF時コスト増なし: 引き上げは `const evaluatedRigControls` 束縛 1 個の追加のみ。ON/OFF 双方で
  createCanvasEvaluatedRigControls は 1 回だけ評価（元も scene リテラル内で 1 回評価）。
- Wave1.2 domain-pb-report §2 の論法と同一で先例整合。

### 観点3: 内部被覆率の実証 — 適合（自己再現で確認）

`$env:RUN_PERF_BENCH = "1"; npx vitest run .../synthetic-heavy-model.bench.test.ts` を自己実行（10 passed）。
inner-coverage 行の自己再現値:

| scale | 自己実行 内側被覆率 | 親比 assembly.rigControls | Gnome報告 内側被覆率 |
|-------|------|------|------|
| light    | 98.99% | 4.198/4.489 = 93.5% | 97.75% |
| medium   | 99.85% | 59.104/59.731 = 98.95% | 99.82% |
| heavy    | 99.96% | 432.565/434.285 = 99.60% | 99.95% |
| rigHeavy | **99.98%** | 1108.461/1110.356 = **99.83%** | 99.98% |

- 全 4 scale で内側被覆率 ≥ 98.99%（残余 < 10% 目標を大幅達成）を**独立再現**。
- 絶対値は環境変動で Gnome 記録と差がある（例: rigHeavy 親 67.9ms→55.5ms）が、baseline-synthetic-v3.md が明記
  するとおり主眼は相対構成と被覆率であり、そこは安定して再現。**rigHeavy で assembly.rigControls が親の 99.83% を
  占める構造**が再現され、支配関数 = createCanvasEvaluatedRigControls の結論を裏付ける。

### 観点4: 関数化が純粋リファクタであること（diff 突合）— 適合

- 引き上げは計測目的の最小構造変更（scene リテラル内 1 式を外に出し const 束縛）に留まる。ロジック改変・最適化の
  混入なし。createCanvasEvaluatedRigControls 本体（L566-575）は無変更。

### 観点5: 最適化の混入なし / scope — 適合

- createCanvasEvaluatedRigControls / unionRects / maskRelations 等を速くする変更は入っていない（diff 上、これらの
  実装関数に変更行なし）。
- 禁止事項に非抵触: `git status` 上 packages/** の変更なし、依存/lockfile 変更なし、commit なし。変更は
  apps/editor の 2 ファイル（+ discussion 記録）のみ。

### 観点6: gate 再確認 — 全て自己実行で pass

| gate | コマンド | 結果 |
|------|---------|------|
| root typecheck | `npx tsc --noEmit` | **exit 0（pass）** |
| apps/editor typecheck | `npx tsc --noEmit -p apps/editor/tsconfig.json` | 総エラー **22 件**（既存 baseline と同数）／変更 2 ファイル起因の**新規エラー 0 件**（grep フィルタで実証） |
| check:source | `node scripts/check-source-organization.mjs` | **pass** |
| check:deps | `node scripts/check-dependencies.mjs` | **pass** |
| 挙動不変 | `npx vitest run .../canvas .../viewer` | **168 passed / 4 skipped（fail 0）** |
| ベンチ計測 | `RUN_PERF_BENCH=1 npx vitest run .../synthetic-heavy-model.bench.test.ts` | **10 passed**（3子スパン count 検証込み・全 4 scale） |

## 3. Gnome の質問への技術的所見

**質問1（キー名の階層 `canvas.evaluation.assembly.*.ms`）**: 妥当。既存 `rigControlEval.ms`（rig control **評価**）と
本 wave の `assembly.rigControls.ms`（rig control **再構築/クローン**）は意味が異なるため、`assembly.` を挟む 3 階層は
混同を避ける適切な選択。フラット 2 階層（`rigControls.ms` 等）にすると rigControlEval との紛らわしさが生じるため、
現行命名を支持する。既存 `canvas.evaluation.*.ms` 規則にも準拠しており改名不要。

**質問2（rigHeavy を回帰ガードに使うか）**: 本 wave での見送り判断を支持する。時間計測ベースの assertion
（`assembly.rigControls > assembly.artworkBounds` 等）は環境依存で fragile。本 wave は計測のみのドメインであり、
回帰ガードの導入は最適化を実施する次 wave で「構造 assertion（比率順序）を許容誤差付きで常時テスト化するか」を
設計対話で決めるのが筋。ただし count 検証（3子スパンが各評価で 1 回記録される）は既に常時テスト化されており、
計測面の回帰は捕捉できている。

## 4. 判定

**合格（要修正なし）**。契約（3分割 / 内側被覆率 <10% 残余 / OFF時ゼロコスト / rigHeavy 内部分解 / gate / 禁止事項）
を全て満たす。純粋リファクタ・計測のみ・byte 一致を独立検証で確認。改善設計の標的 = createCanvasEvaluatedRigControls
一点という核心成果も rigHeavy 親比 99.83% の自己再現で裏付けられた。

質問・不足情報: なし。
