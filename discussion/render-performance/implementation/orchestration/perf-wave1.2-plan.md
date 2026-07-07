# Perf Wave 1.2 Plan: 計測の細分化(gap 内訳 + 評価呼び出し元タグ)

> 実モデル計測001で判明した2つの未解明 — evaluation 内の計測区間外 ≈78%(gap)の正体と、評価が描画の2倍走る現象 — を計測で確定させる追撃wave。本waveも計測のみ・挙動変更禁止。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Perf Wave 1.2
- Model Allocation: L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須

## 2. Oracles / 背景事実

- 方針: [improvement-approach.md](../../improvement-approach.md)(計測→設計。表示経路の決定性は緩和可だが**本waveは挙動不変**)
- 実モデル計測001: [measurements/real-model-001.md](../../measurements/real-model-001.md) — evaluation 平均112ms のうち deformerVertex 17%・keyform 4.5%・**gap ≈78%**。evaluation count が renderSceneAdapter の2倍
- Perf Wave 1 の粒度限界(既知): index Map 構築 / rig control 評価 / artworkBounds / 計測区間外のクローンが未計測(domain-pa-report 参照)
- 合成ベンチ(heavy)は deformerVertex 86% で実モデルと乖離 — 合成モデルが実モデルの構造(gap を生む要素)を再現できていない

## 3. Domain P-B: 計測細分化 + 呼び出し元タグ

Domain id: `perf-wave1_2-gap-breakdown`

Allowed write scope:

- apps/editor の計測フックの細分化のみ(canvas-evaluation とその周辺。評価・描画の挙動は不変)
- 合成ベンチ(synthetic-heavy-model)の**計測面の追従**と、必要なら gap 要素を再現する規模パラメータの追加(rig control 数など。fixture 生成の拡張は追加的に)
- 計測結果: `discussion/render-performance/measurements/baseline-synthetic-v2.md`(新スパンでの再実測)
- Domain report / review files(`waves/perf-wave1.2/domain-pb-report.md`, `reviews/perf-wave1.2/domain-pb-review.md`)

Forbidden write scope: 評価・描画の挙動変更 / 最適化の先行実装 / packages/** の評価ロジック変更 / 依存・lockfile / pnpm install / コミット。

Required implementation:

1. **gap の細分化**: evaluation 全体スパンの内側を、OFF時ゼロコストと両立する範囲で最大限細分化する。最低限: rig control 評価 / index・Map 構築 / artworkBounds / deformerVertex 外のクローン・正規化。「内訳合計 ≈ evaluation 全体」となる被覆率(目標: 未計測残余 < 10%)を達成すること
2. **呼び出し元タグ**: evaluation 実行ごとに呼び出し元(Canvas / Viewer / その他の経路)を識別するカウンタ/タグを追加し、「1描画あたり評価2回」の正体(2 surface か単一経路の二重評価か)を計測で切り分け可能にする
3. **合成ベンチ再実測**: 新スパンで軽/中/重を再実測し `baseline-synthetic-v2.md` に記録。合成でも gap が出るか(=fixture が実モデル構造を再現できとるか)を明記。gap が出ん場合、gap を生む要素の仮説(rig control 数等)を fixture パラメータとして追加して1点だけ検証
4. **ユーザー手順の更新**: 実モデルで新内訳+呼び出し元カウンタを読む手順を domain report に含める(前回手順との差分だけでよい)

Required tests / gate: Perf Wave 1 と同一(挙動不変=既存テスト green〔既知 baseline fail 4件除外可〕/ OFF時ゼロコストの構造 / ベンチ決定性 / typecheck・check:source・check:deps pass)。

Escalate if: 細分化が評価層(packages/**)の非自明な変更を要する / OFF時ゼロコストと被覆率目標が両立不能な場合(その場合は達成可能な被覆率と理由を持って返す)。

## 4. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の全規則に従う(分離 / ループ上限5 / 在席ポーリング / 閉域 / モデル明示)
- レビューは単一 Review-Sylph。観点: 挙動不変(テスト自己再実行)/ OFF時ゼロコスト / **被覆率(内訳合計 vs 全体)の実証** / 呼び出し元タグの正しさ / 最適化の混入なし
- 必須文言: 「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
