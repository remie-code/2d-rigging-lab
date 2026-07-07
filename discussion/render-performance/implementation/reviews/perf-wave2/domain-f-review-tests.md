# Domain F レビュー（レーン2: テスト妥当性） — 案A 選択駆動遅延化

> レビュー担当: Review-Sylph（サブエージェント委任、呼び出し元 Orch-Sylph）
> 対象: `canvas-evaluation.test.ts`（gate 6件 + 書き換え3テスト） / `canvas-evaluation.ts` / `synthetic-heavy-model.bench.test.ts`
> スコープ: テスト等価契約の**実効性** + テスト自己再実行 + ベンチ再実行（設計適合の突合はレーン1が担当）
> 判定: **合格**

---

## 1. テスト適合（gate 各項目の充足）

### 描画等価（核） — 充足
`produces byte-identical drawables whether or not a rig control is selected`（test L591-606）は
`JSON.stringify(selected.drawables) === JSON.stringify(unselected.drawables)` で drawables 配列**全体**を
文字列化比較しており、任意 drawable の任意フィールドの差を検出できる形。canvasBounds / maskRelations も同様に
byte 比較で補強されている。比較が部分的・型のみに緩められている箇所はない。

- 「変更前」の表現の妥当性: 本テストは「選択有無での drawables 不変」で等価を近似する。実装上、drawables 生成
  （`canvas-evaluation.ts` L262-350）は `rigControlsById`（L249、常に全件構築、今回無変更）を使い、
  `requiredEvaluatedRigControlIds` は L354 の `scene.rigControls` 生成にしか渡らない。つまり narrowing は
  drawables 経路に構造的に一切触れない。本テストは「narrowing が drawables 経路へ漏れていない」ことの
  リグレッションガードとして正しく機能する。
- HEAD 版（全件評価）との数値 exact 一致までは検証していないが、narrowing 対象が rigControls 出力に限局される
  ことは実装構造から明らかで、選択有無での不変性で十分。緩さの問題なし。

### 選択時等価 — 充足
`keeps the selected rig control's evaluated shape numerically identical to full evaluation`（L646-666）が
`evaluatedControlPoints` 全4点と `domainBounds` を数値 assert。期待値 `{x:20,y:0}` 等は fixture
（`createTwoWarpFixtureSession`: RIG_FACE_WARP に +20 on X @param30）から導出され、マジックナンバーの空チェック
ではない。加えて既存の `evaluates child warp in local rest space...`（L164-230）が**祖先変形の畳み込み**
（親warp +200/+30 が子warp選択時の `evaluatedControlPoints` に反映）を実数 assert しており、「選択1個の評価でも
祖先チェーンが反映される」という設計主張を数値で実証している。祖先反映の検証は具体値で担保されている。

### 遅延の構造テスト（時間 assert 禁止の遵守） — 充足
- `evaluates zero rig controls when nothing is selected/previewed/drafted` → `scene.rigControls` が `[]`
- `evaluates only the selected rig control, leaving the rest of the subset empty` → 2 rig 中 選択1個の id のみ
- `includes a control-point preview's rig control...` / `includes the rig draft...` → preview/draft 経路

すべて**呼び出し構造/出力構造**（配列内容・長さ・id）で assert。`performance.now` 等の時間閾値比較は
テストファイル全体に一切ない（grep 確認）。

- 「空配列 assert だけで評価が走らないと言えるか」の検証: 実装は
  `rigControls.filter(id ∈ requiredIds).map(...)`（L597-603）で、filter が先で map が後。非選択時は
  `requiredIds.size === 0` → 早期 `return []`（評価済み DTO 生成ループ自体が実行されない）。「評価して結果を捨てる」
  実装ではないため、空配列 assert は「評価がスキップされる」ことと整合する。ベンチでも rig 評価コストが実質ゼロ
  （後述）になっており、構造テストと数値が一致。

### 既存テスト書き換えが意味論の緩和でないこと — 充足
書き換え3テストは `selection: { kind:"rigControl", id }` を明示追加し、当該 rig を部分集合に入れた上で
**従来の assert を維持**している:
- L42「parameter scrub」: `toHaveLength(1)` + `evaluatedControlPoints` 全4点 + `domainBounds` を**追加**（緩めていない）
- L164「child warp local rest」: 子warp選択を追加、祖先変形の数値 assert はそのまま
- L375「rotation rest translation」: 3シーン全てに RIG_FACE_ROTATION 選択を追加、translation の数値 assert 維持

assert を消す/緩める形はなく、契約縮小（全件→選択駆動）に忠実。

---

## 2. テスト自己再実行結果

すべて自分で再実行（`test:unit` は packages のみ対象のため apps/editor は `vitest run --root apps/editor` で実行）。

| 対象 | 結果 | Gnome 主張 | 一致 |
|---|---|---|---|
| `canvas-evaluation.test.ts` | **22 passed** | 22 passed | ○ |
| `canvas-projection.test.ts` | **20 passed** | 20 passed | ○ |
| `apps/editor/src/workspace` 全体 | **279 passed / 4 skipped / 4 failed** | 279/4/4 | ○ |
| check:source | **PASS**（"Source organization guard passed."） | PASS | ○ |
| check:deps | **PASS**（"Dependency guard passed."） | PASS | ○ |

- 4 failed の内訳: 全て `src/workspace/diagnostics/diagnostics-jump-actions.test.ts`（1 file）。
  内容は setActiveEntry の期待値ズレ（"import" vs "workspace"）で、canvas 経路とは無関係の既知 baseline fail。
  当方確認: 変更2ファイルとは別ドメイン。gate 記載の「既知 baseline fail 4件除外可」に該当。
- typecheck（`apps/editor` tsc）: 現状 **22 error**。変更2ファイル（canvas-evaluation.ts / .test.ts）由来の
  error は **0件**（grep で確認）。残る22件は diagnostics-state / viewer / variant-manager 等の pre-existing。
  変更2ファイルを HEAD へ一時退避した baseline は **23 error** → 変更で **1件減**（増加なし）。
  当方由来の型エラーなしを実証。退避したファイルは byte 一致で復元済み（cmp 確認）。

---

## 3. ベンチ再実行結果（RUN_PERF_BENCH=1, 20 iterations/scale, `selection: null`）

after は実装版、before は `createCanvasEvaluatedRigControls` の subset フィルタを**全件評価へ論理1点 patch**
（`void requiredIds; return rigControls.map(...)`、他コード・CRLF 不変）した状態で同一プロセス測定。Gnome の
before 手法（surgical patch で全件評価に戻す）と同一方式で、妥当と評価。私の環境の実測値:

### rigHeavy（drawables=200, chainDepth=8, rigControls=1600）

| span | before avg (ms/eval) | after avg (ms/eval) | Gnome 主張 (before→after) |
|---|---|---|---|
| `canvas.evaluation.assembly.rigControls.ms` | **59.141** | **0.001** | 56.098 → 0.001（同オーダー一致） |
| `canvas.evaluation.artworkBoundsAndAssembly.ms` | **59.232** | **0.060** | 56.186 → 0.069（一致範囲） |

### heavy（drawables=120, chainDepth=6, rigControls=720）

| span | before avg (ms/eval) | after avg (ms/eval) | Gnome 主張 |
|---|---|---|---|
| `canvas.evaluation.assembly.rigControls.ms` | **21.564** | **0.001** | 21.486 → 0.001（一致） |
| `canvas.evaluation.artworkBoundsAndAssembly.ms` | **21.645** | **0.057** | 21.564 → 0.058（一致） |

- before の絶対値は私の環境で Gnome 比 やや高め（59 vs 56ms）だが同一マシン内の相対比較として整合し、
  after が 0.001ms/eval（実質ゼロ）へ落ちる点は完全再現。設計 §5「rigHeavy で artworkBoundsAndAssembly が
  ほぼ消える」を数値で満たす。
- patch は測定後に byte 一致で復元済み（cmp 確認）。

### 計測フック維持の実確認 — 充足
after 実行でも `canvas.evaluation.assembly.rigControls.ms` スパンは **count=20** で記録されている（値が 0.001ms/eval
と小さいだけ）。artworkBounds / rest / rigControlEval 等の全スパンも after で count=20 を維持。bench の sanity assert
（各スパン count === BENCH_ITERATIONS）が pass していることからも、計測フックの削除・改名はない。gate の「計測フック維持」
を満たす。

---

## 4. テスト強度の評価（変異テストによる実証）

`createCanvasEvaluatedRigControls` を全件評価へ意図的に変異させ、テスト検出力を実測（変異は測定後 byte 一致で復元済み）:

- 遅延構造テスト3件が正しく **FAIL**:
  - `evaluates zero rig controls...`（全件だと空配列にならない）
  - `evaluates only the selected rig control...`（sibling も評価され2件になる）
  - `includes a control-point preview's rig control...`（全件になり id が1個に限定されない）
- byte-identical drawables テストと rig draft テストは全件でも pass（drawables は narrowing の影響外／draft は
  部分集合にも含まれるため）。これは各テストが**まさに検出すべき差分だけ**を捉える正しい強度を持つことの実証。

→ 遅延化のリグレッション（narrowing が外れる／漏れる）を確実に検出する。緩すぎる箇所・見逃しリスクは検出されず。

### 補足観察（欠陥ではない）
`resolveRequiredEvaluatedRigControlIds`（L617-639）は selection + draft + controlPointPreview.rigControlId +
rotationPreview.rigControlId を**全て**集合へ加える。一方 消費者 `resolveDeformerOverlay`（canvas-projection.ts
L398-417）は draft がある時は selection を見ずに早期 return する。従って必要集合は「消費者が実際に拾い得る集合の
**上位集合**」（過剰評価はあり得るが漏れはない）。等価性・正当性は保たれ、遅延効果がごく僅かに緩む可能性があるだけ
（draft と selection が同時に立つ稀ケース）。テスト妥当性・描画等価に影響なし。設計の「preview.rigControlId を独立に
必要集合へ」という明示要求にも忠実。

---

## 5. 判定

**合格。** 要修正なし。

- gate 4項目（描画等価・選択時等価・遅延構造・意味論非緩和）すべて充足。テストは緩すぎず、変異検出力を実証済み。
- テスト自己再実行で Gnome 主張（22/20 passed、workspace 279/4/4、check:source/deps PASS、typecheck 当方0件）を全件再現。
- ベンチ再実行で after の rig 評価コスト実質ゼロ化・計測フック維持を再現。before 測定手法も妥当。
- レビュー中の一時 patch／変異は全て byte 一致で復元済み（cmp 確認）。ワークツリーはレビュー前と同一。

## 6. 質問

なし。テスト妥当性の観点で blocker・不明点は検出されなかった。

（環境注記: ルートの `test:unit` は packages のみ対象で apps/editor を含まない。apps/editor のテストは
`vitest run --root apps/editor <path>` で実行した。CI 側で apps/editor のユニットテストが常時実行経路に
入っているかは本レビューのスコープ外だが、Orch-Sylph 側で確認する価値がある点として記す。）
