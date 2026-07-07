# Domain G レビュー（案D+E: deformerVertex 表示経路最適化）— レーン2「テスト妥当性」

> レビュア: Review-Sylph（Orch-Sylph からのサブエージェント委任・読み取り+テスト/ベンチ再実行のみ）
> 対象: `canvas-evaluation.test.ts` の二層分離 3 テスト / `synthetic-heavy-model.bench.test.ts` / 実装 `canvas-evaluation.ts`・`canvas-projection.ts`
> 判定基準: `improvement-design.md` §3/§5, `perf-wave2-plan.md` §4, Gnome レポート `domain-g-report.md`

## 判定: **合格**（残課題 1 件 = テスト強度の穴。実装の正しさには影響なし。§末尾に記載）

二層分離の核（保存バイト同一 / 表示 epsilon 等価 / クローン isolation）はいずれも「有効な差分を踏む」ことを実測で確認した。ベンチの deformerVertex 削減も自環境で再現。既存テストの意味論緩和なし。gate 充足。ただし isolation テストが `cloneMesh` の shallow-copy 境界そのものは踏んでおらず（下記 [残課題1]）、Domain G が実際に変更した 1 行の isolation は現行テスト群では検出できない（アリアシング破壊を注入しても全 canvas スイート green のまま）。実装は正しいので合格とするが、テスト強度として指摘する。

---

## 1. 二層分離テストの実効性（最重要）

### 1-1. 表示層 epsilon 等価テスト — **有効（epsilon=0 で実際に落ちる）**

`keeps evaluated (display) vertices within 1e-9 of the old toFixed normalization`。

- **fixture が非整数座標を実際に生むか**: 生む。45度回転 pivot(50,50)・単位相当の正方形 (0,0)-(100,100) を解析計算した結果、`new` 実装（`normalizeTransformNumber` = 素の value）は 4 頂点中 3 頂点が非整数座標（例 `y=-20.710678118654748`）。`anyNonInteger(new)=true` を確認。整数のみの自明通過ではない。
- **ハードコード `OLD_TOFIXED_ROTATED_SQUARE` が本当に旧 toFixed 出力か**: 一致。旧実装 `Number(value.toFixed(12))` を同じ入力で計算した値とハードコード配列の最大差 = **0（完全一致）**。ハードコードは正しく旧出力を固定している。
- **epsilon が有効な差分を踏むか（epsilon=0 で落ちるか）**: **落ちる（実測）**。`DISPLAY_EPSILON` を一時的に `0` に書き換えて当該テストのみ実行 → `AssertionError: expected 7.105427357601002e-15 to be less than or equal to 0` で **FAIL**。解析上の new-vs-hardcoded 最大差は 2.52e-13（Gnome 主張「最大 2.5e-13」と一致）。1e-9 では通り、0 では落ちる = epsilon は vacuous でなく、旧 toFixed と現数値演算の実差を回帰ガードしている。**確認後 `DISPLAY_EPSILON` は 1e-9 に復元済み**（`grep` で 1e-9 が 1 件・0 が 0 件を確認）。

### 1-2. 保存層バイト同一テスト — **有効（保存経路 = session.graph 原本を踏む）**

`leaves the session.graph save-layer originals byte-identical across evaluation`。

- fixture は 1-1 と同じ 45度回転（非整数の表示座標を生む評価）。`JSON.stringify(session)` を評価前後で比較。原本 `session.graph`（meshes/rigControls/keyformSets 全体）が非整数を生む評価を挟んでバイト同一であることを保証しており、「評価済み表示物が原本へ書き戻らない」ことを実際に踏む。空テストや自明 true ではない（原本が汚染されうる経路 = cloneMesh の shallow-copy / cloneEvaluatedMesh の参照渡しを跨いだ後の比較）。
- 補足: この保存層テストは「原本を **mutate** する経路」を検出するが、「原本を **alias するだけ（非破壊）**」の退行は検出しない（アリアシングは stringify を変えないため）。ただし evaluation は原本へ書き込まないので、alias 自体が保存バイト互換を壊すことはない。保存バイト互換の観点では十分。

### 1-3. クローン isolation テスト — **通過するが `cloneMesh` 境界を踏んでいない（残課題1）**

`isolates evaluated display vertices from the original mesh objects`。

- 現状: **rotation deformer を持つ DRAW_FACE** の評価頂点を破壊的に書き換え、原本 mesh が不変であることを確認 → green。
- **実効性の穴**: DRAW_FACE は rotation chain を通るため、評価頂点は `applyRotationToPoint` が返す **新規オブジェクト**であり、`cloneMesh` の shallow-copy 由来ではない。よってこのテストは「deformer 経路が新規オブジェクトを返す」ことを検証しているだけで、Domain G が実際に変更した箇所（`cloneMesh` の `cloneVec2`→`shallowCloneVec2`、= **無変形 drawable の表示境界**）の isolation は踏んでいない。
- **注入検証（実測）**: `shallowCloneVec2` を `return value;`（原本を alias）に改変して canvas スイート全体を実行 → **109 passed / 4 skipped の green のまま**。isolation テストも保存バイト同一テストも検出できなかった。つまり `cloneMesh` の shallow-copy 境界が退行（原本 alias 化）しても現行テスト群は素通しする。**確認後 `shallowCloneVec2` は `{ x, y }` へ復元済み**。
- 判定への影響: 実装は正しく新規オブジェクトを作っている（現行コードは green）。ので合格判定は維持。ただしテスト強度として残課題に記載（無変形 drawable の評価頂点を mutate → 原本不変を assert する 1 ケースがあれば `cloneMesh` 境界を直接踏める）。

---

## 2. gate の充足

### 2-1. 合成ベンチ deformerVertex 減少 — **再現（同環境 before/after を自作）**

Gnome レポートの before は HEAD ではなく「Domain G ホットパス revert・計測フック保持」状態でしか再現できない（HEAD には deformerVertex 計測 span 自体が無く count=0 になるため）。そこで `normalizeTransformNumber`（toFixed 復帰）/ `cloneMesh`（cloneVec2 復帰）/ `applyRigControlChainToVertices`（防御コピー復帰）の 3 点だけを surgical に revert して before を再構成し、`RUN_PERF_BENCH=1` で before/after を同一環境で計測（各 20 iterations、count=20 で有効収集を確認）。**計測後は after 版へ完全復元済み**（diff stat 217/26/272 一致・grep でホットパス 3 行が after 形であることを確認）。

`canvas.evaluation.deformerVertex.ms` totalMs（20回合計）:

| scale | before(自環境) | after(自環境) | 削減率 | Gnome before | Gnome after |
|---|---|---|---|---|---|
| light (8×16 D1) | 10.15 | 3.18 | −69% | 9.19 | 3.36/3.79 |
| medium (40×64 D3) | 180.32 | 20.50 | **−89%** | 177-178 | 18.3/18.4 |
| heavy (120×256 D6) | 3520.87 | 345.91 | **−90%** | 3569-3607 | 329/332 |
| rigHeavy (200×4 D8) | 136.38 | 38.60 | −72% | 141.5 | 34.3/34.5 |

減少方向・大幅削減（medium/heavy ~90%）を再現。絶対値も Gnome の数値と桁・オーダーが一致（before の medium 180 / heavy 3521 は Gnome 177/3569 とほぼ同値）。gate「deformerVertex 減少」充足。

### 2-2. 既存テスト green — **確認**

- `vitest run apps/editor/src/workspace/canvas`: **109 passed / 4 skipped**（4 skip = ベンチ opt-in）。新規二層分離 3 テスト含む。（Gnome レポートは 106 だが、これは Domain F 由来テストも working tree に同居しているため件数増。green である点は一致。）
- `vitest run apps/editor/src/workspace/canvas apps/editor/src/workspace/viewer`: **177 passed / 4 skipped**（Gnome §6 と一致）。
- 既知 baseline fail（`diagnostics-jump-actions.test.ts` 4件）は canvas/viewer スコープ外のため上記には含まれず。gate 通り除外可。

### 2-3. typecheck / check:source / check:deps — **確認**

- `tsc --noEmit -p apps/editor/tsconfig.json`: 総 **22 件**（gate 明示の pre-existing 22 と一致）。**Domain G 2 ファイル（canvas-evaluation.ts / canvas-projection.ts の非テスト）起因 0 件**を grep で確認。22 件の内訳サンプルは viewer-variant-selection / viewer-render-source / triangleStableIds 等で Domain G 無関係。
- `node scripts/check-source-organization.mjs`: **passed**。
- `node scripts/check-dependencies.mjs`: **passed**。

---

## 3. 意味論の緩和チェック — **緩和なし**

`git diff HEAD -- canvas-evaluation.test.ts` を精査:

- 既存テストへの変更は **(a) `selection:` 引数の追加**（Domain F 契約変更に伴う追従。Domain G 由来ではない）と **(b) `expect(evaluatedScene.rigControls).toHaveLength(1)` の追加**（assertion の**強化**）のみ。
- **exact `toEqual` → epsilon `toBeCloseTo` への置換は 0 件**。既存の頂点等価 assertion（`toEqual({ x, y })`）は一切甘くなっていない。Gnome 主張「exact→epsilon 更新した既存テスト 0 件」を diff で確認。
- 新規 epsilon テストは **表示層専用**（`face.evaluatedMesh.vertices` = 評価済み表示物）に対してのみ epsilon 等価を適用。保存経路（`JSON.stringify(session)`）は別テストで **バイト同一（exact）** を要求しており、保存を epsilon で緩めていない。意味論として正しい二層分離（表示=epsilon / 保存=byte-exact）。

---

## 4. 差分・残課題

- **[残課題1]（テスト強度、実装欠陥ではない）**: isolation テストが `cloneMesh` の shallow-copy 境界（Domain G が実際に変更した無変形 drawable の表示境界）を踏んでいない。`shallowCloneVec2` を原本 alias に退行させても canvas 全スイート green のまま（実測）。無変形 drawable（deformer chain 空）の評価頂点を mutate → 原本 mesh 不変を assert するケースを 1 つ追加すれば、Domain G の 1 行の isolation を直接カバーできる。現行実装は正しいため合格を妨げないが、将来の退行を捕捉できない穴として記録。
- 上記以外の差分: なし。保存バイト同一・表示 epsilon 等価・ベンチ削減・意味論非緩和・typecheck/guards はすべて確認・再現済み。

## 5. 質問

- **[Q1]** [残課題1] のケース追加を Domain G の必須修正とするか、テスト強化タスクとして別途起票するか、Orch-Sylph 判断を仰ぎたい。実装の正しさは現行テスト+自身の注入検証で確証済みのため、私見では「合格・強化は fast-follow」で問題ないと考える。

## 実行環境の注意（遵守事項）

- テストのため一時編集した箇所は **すべて復元済み**: `DISPLAY_EPSILON`（0→1e-9）、`shallowCloneVec2`（alias→`{x,y}`）、ベンチ before 用の 3 点 revert（→ after 版へ全復元、diff stat・grep で確認）。
- `pnpm install` 等の依存変更は未実施。既存スクリプト（vitest / tsc / check-*.mjs）と `RUN_PERF_BENCH=1` のみ使用。
- プロダクトコードへの恒久変更なし（working tree は Gnome 実装状態のまま）。
