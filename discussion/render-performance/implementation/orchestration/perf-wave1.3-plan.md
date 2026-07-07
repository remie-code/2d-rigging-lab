# Perf Wave 1.3 Plan: artworkBoundsAndAssembly の内部分離計測

> 実モデル計測002で gap 主犯が `artworkBoundsAndAssembly`(75.8%)と確定したため、Perf Wave 1.2 の条件付き課題を発動する。当区間の内部を分離計測し、改善設計の標的を関数単位まで絞る。本waveも計測のみ・挙動変更禁止。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Perf Wave 1.3
- Model Allocation: L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須

## 2. Oracles / 背景事実

- [measurements/real-model-002.md](../../measurements/real-model-002.md) — artworkBoundsAndAssembly 75.8% で主犯確定・単一経路二重評価も確定
- Perf Wave 1.2 の条件付き課題(domain-pb-report): 「実モデルで当区間が主犯確定なら内部分離。createCanvasEvaluatedRigControls を関数化して呼び出し外側で1区間計測すれば OFF時ゼロコスト両立可能」(Gnome/Review 合意済みの実装筋)
- 二重評価の根本原因調査は**別トラック**(読み取り調査、並行実施中)。本waveでは触れない

## 3. Domain P-C: 内部分離計測

Domain id: `perf-wave1_3-assembly-breakdown`

Allowed write scope: apps/editor の計測フック細分化のみ(canvas-evaluation.ts の artworkBoundsAndAssembly 区間内部)/ 合成ベンチの計測面追従 / `discussion/render-performance/measurements/baseline-synthetic-v3.md` / Domain report / review files(`waves/perf-wave1.3/domain-pc-report.md`, `reviews/perf-wave1.3/domain-pc-review.md`)。

Forbidden write scope: 評価・描画の挙動変更 / 最適化の先行実装 / packages/** / 依存・lockfile / pnpm install / コミット。

Required implementation:

1. artworkBoundsAndAssembly 区間の内部を分離計測: 最低限 **createCanvasEvaluatedRigControls(rig control 再構築+cloneVec2)/ artworkBounds 計算 / 残りの assembly(クローン・組み立て)** の3分割。OFF時ゼロコスト維持(必要なら関数化+外側計測の筋を使う。関数化は挙動不変の純粋リファクタに限る)
2. 被覆率: artworkBoundsAndAssembly 内の未計測残余 < 10%
3. rigHeavy probe を含む合成ベンチ再実測 → `baseline-synthetic-v3.md`(内部分解値と支配関数の読み)
4. ユーザー手順の差分(新キーの読み方)を domain report に記載

Required tests / gate: 挙動不変(既存テスト green、既知 baseline fail 4件除外可)/ OFF時ゼロコスト構造 / ベンチ決定性 / typecheck・check:source・check:deps pass。

Escalate if: 分離が評価層(packages/**)の変更を要する / 関数化が挙動不変で済まない構造の場合。

## 4. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の全規則に従う(分離 / ループ上限5 / 在席ポーリング / 閉域 / モデル明示)
- レビューは単一 Review-Sylph。観点: 挙動不変 / OFF時ゼロコスト / 内部被覆率の実証 / 関数化が純粋リファクタであること(diff 突合)/ 最適化の混入なし
- 必須文言: 「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
