# Perf Wave 1.3 — Domain P-C Report（artworkBoundsAndAssembly 内部分離計測）

> Domain: `perf-wave1_3-assembly-breakdown`
> 実装担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph, Perf Wave 1.3）
> Status: Implemented（2026-07-07）／ 挙動不変・計測のみ・最適化なし

本 wave の本質: 実モデル計測002で主犯確定した `artworkBoundsAndAssembly`（評価時間の 75.8%・平均 96.4ms）の
**内部を関数単位まで分離計測**し、改善設計の標的を確定する。挙動・評価結果・数値・順序は一切変えていない
（純粋リファクタによる評価順の並べ替えのみ・結果 byte 一致）。

**核心成果**: rigHeavy probe で親 artworkBoundsAndAssembly の **99.84% が `createCanvasEvaluatedRigControls`**
と確定。unionRects（0.07%）・残り assembly（0.08%）は棄却。**改善設計の標的は createCanvasEvaluatedRigControls
一点**（rig control 全量再構築 + cloneVec2）。

## 1. 実装サマリ（変更 / 新規ファイル）

| ファイル | 種別 | 役割 |
|---------|------|------|
| `apps/editor/src/workspace/canvas/canvas-evaluation.ts` | 変更 | `artworkBoundsAndAssembly` 親スパンの**内側**を 3 子スパンに細分化（新規 3: assembly.rigControls / assembly.artworkBounds / assembly.rest）。`createCanvasEvaluatedRigControls` の呼び出しを scene リテラル外に引き上げ（純粋リファクタ）、time-sequential に並べて各区間を start/record で囲む。親スパンは保持。評価結果・順序・数値は不変（結果 byte 一致）。 |
| `apps/editor/src/workspace/canvas/synthetic-heavy-model.bench.test.ts` | 変更 | 計測面を新 3 子スパンに追従（reportBenchStats の table に 3 行追加 + inner-coverage 行を出力）。全 4 scale の RUN_PERF_BENCH テストに 3 子スパンの count 検証を追加。`BENCH_SCALES` は無変更（4 点維持）。 |
| `discussion/render-performance/measurements/baseline-synthetic-v3.md` | 新規 | 新 3 子スパンでの再実測・内側被覆率・支配関数の読み。 |
| `discussion/render-performance/implementation/waves/perf-wave1.3/domain-pc-report.md` | 新規 | 本レポート（完了の合図）。 |

`packages/**` は一切変更していない（`recordLive2dPerformanceTiming` / `startLive2dPerformanceTiming` は
既存 export を利用しただけ）。`synthetic-heavy-model.ts`（fixture 生成）は無変更（byte 一致テスト維持）。
新規 record API 追加なし。依存・lockfile 変更なし。pnpm install なし。commit なし。

## 2. 新 3 子スパンの定義表（キー名・測る区間・並べ替えの有無）

`createCanvasEvaluatedScene` の第 5 スパン `canvas.evaluation.artworkBoundsAndAssembly.ms`（既存・保持）の
**内側**に、時系列で隙間なく連続する 3 子スパンを刺した。親＝内訳と整合の基準、子＝内訳。

| # | stats キー | 測る区間（canvas-evaluation.ts） | 並べ替え |
|---|-----------|--------------------------------|---------|
| 5-a | `canvas.evaluation.assembly.rigControls.ms` | `createCanvasEvaluatedRigControls(rigControls, rigControlsById)`（rig control 全量再構築 + chain 適用 + cloneVec2。主犯第一容疑） | **あり**（scene リテラル外へ引き上げ・親内の先頭で評価） |
| 5-b | `canvas.evaluation.assembly.artworkBounds.ms` | `unionRects(visible drawables の bounds)`（artworkBounds 計算） | なし（元位置） |
| 5-c | `canvas.evaluation.assembly.rest.ms` | 残り assembly = `resolveEvaluationCanvasBounds`（canvasBounds）+ scene オブジェクトリテラル構築 + maskRelations map | なし |
| — | `canvas.evaluation.artworkBoundsAndAssembly.ms`（既存・保持） | 5-a + 5-b + 5-c の合計（内訳と親の整合基準） | — |

キー名は既存命名規則 `canvas.evaluation.*.ms` に準拠。親の意味的サブツリーであることを示すため
`canvas.evaluation.assembly.*.ms` の階層命名を採用した。

### 縫い目（非オーバーラップ・二重計上なし）

canvas-evaluation.ts L351-379 の実際の縫い目:

```
artworkBoundsAndAssemblyTimingStart = start()          # 親[5] 開始
  assemblyRigControlsTimingStart = start()             # [5-a] 開始
    evaluatedRigControls = createCanvasEvaluatedRigControls(...)
  record("assembly.rigControls.ms", ...)               # [5-a] 終了 ─┐ 隣接
  assemblyArtworkBoundsTimingStart = start()           # [5-b] 開始 ─┘
    artworkBounds = unionRects(...)
  record("assembly.artworkBounds.ms", ...)             # [5-b] 終了 ─┐ 隣接
  assemblyRestTimingStart = start()                    # [5-c] 開始 ─┘
    scene = { canvasBounds, ...artworkBounds, drawables, rigControls: evaluatedRigControls, maskRelations }
  record("assembly.rest.ms", ...)                      # [5-c] 終了
record("artworkBoundsAndAssembly.ms", ...)             # 親[5] 終了
recordCounter("caller.*"); record("evaluation.ms", ...)
```

- 各子 record は次の子 start の**直前**に隣接。区間は重複せず、隙間には次の start を取る以外の処理はない。
- 親スパン開始は最初の子開始の直前、親スパン終了は最後の子終了の直後 → 親 ＝ 3 子 + 微小オーバーヘッド。
  **内側被覆率で実証**（baseline-synthetic-v3.md §5）: 3 子の totalMs 合計が親の 97.75〜99.98%（全 scale
  残余 < 3%）。目標（残余 < 10%）を大幅達成。

## 3. OFF時ゼロコストの構造的説明

Wave1.2 domain-pb-report §2 と同じ論法。**OFF 時（`__LIVE2D_PERF__` 未設定）に、drawable 数・rig control 数
に非依存な定数個の追加コストしか発生しないこと**を構造で示す。

- 追加した start は全て `startLive2dPerformanceTiming()` — **OFF 時は `null` を即返し**（`@private-2d-rigging-lab/render-core`
  の既存 export）。record は `recordLive2dPerformanceTiming(name, start)` — `start === null` で即 return。
- 追加した timingStart 変数 `assemblyRigControlsTimingStart` / `assemblyArtworkBoundsTimingStart` /
  `assemblyRestTimingStart` は**すべて `number | null` のスカラ**。ガード外で配列・オブジェクトを新規割り当て
  していない。
- start / record は**すべてホットループ（`.map()` 群）の外側**に置いた。
  - `createCanvasEvaluatedRigControls` の内側 `rigControls.map(...)` は関数の中 → ガードの外側でこの関数呼び
    1 個を丸ごと囲む（ループに食い込まない）。
  - `unionRects` の内側 `.filter().map()` も関数呼び 1 個として外から囲む。
  - maskRelations map（`session.graph.masks.filter().map()`）は `assembly.rest` の中の scene リテラル内に
    あり、`assembly.rest` の start/record はそのリテラル評価全体の外側。ループに食い込まない。
- したがって **OFF 時の追加コストは「関数呼び 3 回（start）+ 3 回（record）+ null 比較」/ 評価 1 回のみ**。
  drawable 数・rig control 数・頂点数に非依存。これが OFF時ゼロコストの生命線。
- **並べ替えによる OFF 時コスト増もない**: 引き上げた `evaluatedRigControls` は const 1 個の束縛のみで、
  ON/OFF 双方で同じ 1 回だけ評価される（元も scene リテラル内で 1 回評価だった）。追加割り当ては const
  参照 1 個で、これは V8 では実質ゼロコスト。

## 4. 純粋リファクタの証明（scene リテラル外への引き上げ・結果 byte 一致）

### 何を並べ替えたか

- **v2（Before）**: `createCanvasEvaluatedRigControls(...)` は scene オブジェクトリテラルの中で評価されて
  いた（`unionRects` の後、`maskRelations` map の直前）。評価順は「unionRects → scene リテラル
  （canvasBounds → artworkBounds spread → **createCanvasEvaluatedRigControls** → maskRelations map）」。
- **v3（After）**: 3 子スパンを time-sequential に分離するため、`createCanvasEvaluatedRigControls(...)` を
  scene リテラルの**外**に出し、**先頭で** `const evaluatedRigControls` に束ねた。scene リテラルは
  `rigControls: evaluatedRigControls` で参照するだけ。評価順は「**createCanvasEvaluatedRigControls** →
  unionRects → scene リテラル（canvasBounds → artworkBounds spread → maskRelations map）」に変わった。

### なぜ結果が byte 一致か（副作用・順序依存がないことの根拠）

3 者は互いに独立・副作用なしで、評価順序を変えても各々の戻り値も scene の最終形も不変:

- `createCanvasEvaluatedRigControls(rigControls, rigControlsById)`（L554）: 引数 `rigControls` / `rigControlsById`
  （どちらも並べ替え前に確定済み）を読み、`.map()` で新配列を返す純関数。共有状態を mutate しない。
- `unionRects(...)`（L1103）: 既に計算済みの `drawables`（並べ替え前に確定）の bounds を読み、新オブジェクトを
  返す純関数。副作用なし。
- `resolveEvaluationCanvasBounds(session)`（L1002）: `session` を読み `structuredClone` を返す純関数。
- maskRelations map: `session.graph.masks` を読み新オブジェクト配列を返す。副作用なし。
- これら 4 者は**互いの出力に依存しない**（rigControls は drawables/artworkBounds を使わない、artworkBounds は
  rigControls を使わない、等）。したがって評価順の入れ替えは各戻り値を変えない。
- **scene のフィールド挿入順は v2 と同一**（canvasBounds → artworkBounds spread → drawables → rigControls →
  maskRelations）。リテラル内の記述順を変えていないため、`JSON.stringify(scene)` も byte 一致。

### 裏付けテスト（挙動不変の実証）

- **synthetic-heavy-model.bench.test.ts の caller テスト**「records the forwarded caller tag once per
  evaluation and never alters the projection」: 同一 session を評価 → `JSON.stringify(tagged) ===
  JSON.stringify(untagged)` を assert。**projection 全体（scene 含む）の byte 一致**を守っており、リファクタ
  後も pass。
- **canvas-evaluation.test.ts（16）/ canvas-projection.test.ts（20）/ canvas-render-scene-adapter.test.ts（4）**:
  評価結果の構造・値を検証する既存テスト群がすべて pass（リファクタで結果が変わっていれば fail するはず）。
- **synthetic-heavy-model.bench.test.ts「is deterministic」/「does not mutate the generated session」**:
  決定性・非破壊も維持。
- 全 168 passed / 4 skipped（fail 0）で挙動不変を実証（§8 テスト結果表）。

## 5. 内側被覆率表（3 子スパン合計 / 親 artworkBoundsAndAssembly・全 4 scale）

| scale | childBreakdownMs | artworkBoundsAndAssemblyMs | 内側被覆率 | 残余 | 目標 ≥90% |
|-------|-----------------|----------------------------|-----------|------|----------|
| light    | 5.002    | 5.117    | 97.75% | 2.25% | ✅ |
| medium   | 59.780   | 59.890   | 99.82% | 0.18% | ✅ |
| heavy    | 517.909  | 518.150  | 99.95% | 0.05% | ✅ |
| rigHeavy | 1358.435 | 1358.697 | 99.98% | 0.02% | ✅ |

**全 scale で内側被覆率 ≥ 97.75%（残余 < 3%）、目標（残余 < 10%）を大幅にクリア**。残余は 3 子スパンの
record と次 start の間の関数呼び + null 比較のオーバーヘッドに相当（無視できる大きさ）。

## 6. rigHeavy probe の内部分解値と支配関数の読み（核心成果）

rigHeavy probe（drawables=200 / verticesPerMesh=4 / chainDepth=8 / rigControls=1600）の
artworkBoundsAndAssembly 内部分解:

| 子スパン | totalMs（20 反復） | avgMs（1 評価） | 親比 |
|---------|-------------------|----------------|------|
| **assembly.rigControls**（createCanvasEvaluatedRigControls） | **1356.475** | **67.824** | **99.84%** |
| assembly.artworkBounds（unionRects） | 0.927 | 0.046 | 0.07% |
| assembly.rest（canvasBounds + scene リテラル + maskRelations） | 1.032 | 0.052 | 0.08% |
| 親 artworkBoundsAndAssembly | 1358.697 | 67.935 | 100% |

**支配関数は `createCanvasEvaluatedRigControls` で確定**（親の 99.84%）。unionRects は 0.07%、残り assembly は
0.08% と極小で**棄却**。v2 で残っていた「unionRects の可能性」は完全に否定された。

全 scale でも同構造（親に占める assembly.rigControls の比率）: light 92.79% / medium 98.63% / heavy 99.57% /
rigHeavy 99.84%。**どの scale でも artworkBoundsAndAssembly ≒ createCanvasEvaluatedRigControls**。

### 改善設計への含意

- 実モデル計測002で artworkBoundsAndAssembly が主犯（75.8%・96.4ms/評価）確定。本 v3 でその内部支配が
  createCanvasEvaluatedRigControls（rig control 数 × chain 適用 + cloneVec2 の全量再構築）と関数単位まで確定。
- **改善設計の標的は createCanvasEvaluatedRigControls 一点**。処方候補: 全 rig control の毎評価クローンの
  メモ化・差分再構築・cloneVec2 削減。unionRects や maskRelations は標的ではない。
- **本 wave は計測のみ**（createCanvasEvaluatedRigControls を速くしていない）。処方は次の設計対話へ。

## 7. ユーザー手順の差分（Wave1.2 domain-pb-report §6 との差分だけ）

有効化方法・スクラブ手順・stats 読み出し（`console.table(...timings)`）は domain-pb-report §6 と**同一**。
以下が Perf Wave 1.3 での**差分**（timings に子スパン 3 キーが増えた）。

`console.table(globalThis.__LIVE2D_PERF_STATS__.timings)` に以下が追加で並ぶ（既存の
`canvas.evaluation.artworkBoundsAndAssembly.ms` はそのまま親として残る）:

| 新キー | 意味 | 読み方 |
|-------|------|-------|
| `canvas.evaluation.assembly.rigControls.ms` | createCanvasEvaluatedRigControls（rig control 全量再構築 + cloneVec2） | **artworkBoundsAndAssembly の主犯候補**。ここが親の大半を占めれば「gap の正体は rig control 再構築」と確定 |
| `canvas.evaluation.assembly.artworkBounds.ms` | unionRects（visible drawables の bounds 統合） | 通常は極小。ここが大きければ bounds 統合が支配（合成では 0.1% 未満） |
| `canvas.evaluation.assembly.rest.ms` | canvasBounds 解決 + scene リテラル + maskRelations map | 通常は極小。maskRelations が多いモデルで伸びうる |

**内側被覆率の確認**: `assembly.rigControls + assembly.artworkBounds + assembly.rest` の totalMs 合計が
`canvas.evaluation.artworkBoundsAndAssembly.ms` totalMs の 90% 以上を占めていれば、親の内訳が説明できている
（v3 合成では 97.75〜99.98%）。

**支配関数の読み分け**（実モデルで期待される分岐）:
- `assembly.rigControls` が親 artworkBoundsAndAssembly の大半（90% 超）→ 合成 rigHeavy と同型。処方は
  createCanvasEvaluatedRigControls（rig control 全量再構築）へ。実モデルはこちらに該当する見込み。
- `assembly.artworkBounds` or `assembly.rest` が親の相当部分 → 想定外。bounds 統合 or maskRelations が支配。
  合成では観測されなかった profile（別途調査要）。

## 8. テスト結果（全 gate）

| gate | 対象 | 結果 |
|------|------|------|
| 挙動不変 | `canvas` + `viewer` ディレクトリ全体（17 ファイル） | **168 passed / 4 skipped**（fail 0）。canvas-evaluation.test.ts(16) / canvas-projection.test.ts(20) / canvas-render-scene-adapter.test.ts(4) / viewer 全件を含む |
| 挙動不変（byte 一致） | caller テスト「never alters the projection」（`JSON.stringify` 比較） | pass（リファクタ後も projection byte 一致を維持） |
| 挙動不変 | `synthetic-heavy-model.bench.test.ts`（計測 skip） | 10 passed / 4 skipped（caller テスト2件 + 決定性・非破壊込み） |
| ベンチ計測 | `synthetic-heavy-model.bench.test.ts`（RUN_PERF_BENCH=1） | **10 passed**（新 3 子スパン count 検証込み・全 4 scale） |
| ベンチ決定性 | byte 一致テスト（is deterministic） | pass（synthetic-heavy-model.ts 無変更・維持） |
| typecheck | `npx tsc --noEmit`（root） | **pass（ROOT_TSC_OK）** |
| typecheck | `npx tsc --noEmit -p apps/editor/tsconfig.json` | 総エラー **22 件**（既存 baseline・Wave1.2 と同数）。**変更 2 ファイル起因の新規エラー 0 件**（フィルタで実証） |
| check:source | `node scripts/check-source-organization.mjs` | **pass** |
| check:deps | `node scripts/check-dependencies.mjs` | **pass** |

**apps/editor tsconfig エラーの内訳注**: 総エラー 22 件はすべて既存 baseline（Wave1.2 domain-pb-report §7 と
同数）。私が触った 2 ファイル（canvas-evaluation.ts / synthetic-heavy-model.bench.test.ts）を参照するエラーは
**0 件**（`error TS` 行を当該ファイル名でフィルタし 0 件を実証）。既知 baseline fail（diagnostics-jump-actions
4 件）はスコープ外のため未実行。

## 9. 質問 / escalate

- **escalate: なし**。packages/** の評価ロジック・計測 API 変更は不要（既存 export のみ使用）。並べ替えは
  挙動不変で済み（3 者は独立・副作用なし・結果 byte 一致を既存テストで実証）、副作用や順序依存は判明せず。
  環境変更（pnpm install 等）も不要。内側被覆率目標（≥90%）と OFF時ゼロコストは両立できた。
- **質問（設計者向け・判断に迷った点）**:
  1. **キー名の階層 `canvas.evaluation.assembly.*.ms` でよいか**。既存は `canvas.evaluation.<span>.ms` の
     2 階層だが、親 artworkBoundsAndAssembly の内訳であることを示すため `assembly` を挟む 3 階層にした。
     もし「親スパン名を残さず `canvas.evaluation.rigControls.ms` 等のフラットな 2 階層」を望むなら改名する
     が、既存の `rigControlEval.ms`（rig control **評価**）と `rigControls`（rig control **再構築/クローン**）が
     紛らわしくなるため、区別のつく `assembly.rigControls` を採った。判断を仰ぐ。
  2. **次 wave での createCanvasEvaluatedRigControls 最適化に向け、rigHeavy を回帰ガードに使うか**。
     現状 rigHeavy は RUN_PERF_BENCH=1 時のみ実行。最適化後に「artworkBoundsAndAssembly ≒ rigControls」の
     構造が保たれることを回帰的に守りたいなら、rigHeavy で `assembly.rigControls > assembly.artworkBounds`
     等の構造 assertion を常時テスト化する案があるが、時間計測ベースの assertion は環境依存で fragile な
     ため本 wave では見送った（Wave1.2 の質問1と同じ懸念）。判断を仰ぐ。
