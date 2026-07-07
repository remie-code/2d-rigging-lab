# Perf Wave 1 Plan: 計測基盤(フェーズ計測 + 合成ヘビーモデルベンチ)

> 改善設計に先立ち、評価パイプラインの内訳を実測可能にする小wave。設計の正は [improvement-approach.md](../../improvement-approach.md) と現状調査レポート。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Perf Wave 1(計測基盤)
- Model Allocation: L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須

## 2. Oracles / User Decisions

- [improvement-approach.md](../../improvement-approach.md) §3: 主戦場 = Editor 共有経路 / 決定性は二層分離(表示緩和可・保存/export不可侵) / 計測→設計の順
- 調査事実: [../../../reports/editor-render-performance/current-state-survey.md](../../../reports/editor-render-performance/current-state-survey.md)(ホットパスの file:line はここが正)
- **本waveは計測のみ。最適化・挙動変更は一切しない**(観測を確定してから設計する、がユーザー判断)

## 3. Domain P-A: フェーズ計測 + 合成ベンチ

Domain id: `perf-wave1-instrumentation`

Allowed write scope:

- apps/editor の評価・描画経路への**計測フック追加のみ**(canvas-evaluation とその周辺。既定OFF・有効時も評価結果に影響しないこと)
- 合成ヘビーモデルの決定的ベンチ(fixture 生成をパラメータ化: drawable 数 × 頂点数 × デフォーマ chain 深さ × keyformSet 数)とその実行手段(テストまたはスクリプト。既存のテスト基盤の慣行に従う)
- 計測結果の記録: `discussion/render-performance/measurements/baseline-synthetic.md`
- Domain report / review files(`waves/perf-wave1/domain-pa-report.md`, `reviews/perf-wave1/domain-pa-review.md`)

Forbidden write scope: 評価・描画の挙動変更 / 最適化の先行実装 / packages/** の評価ロジック変更(計測の受け口が評価層に必要な場合は最小の追加的フックに限定し、report で明示) / 依存追加・lockfile / `pnpm install` / コミット。

Required implementation:

1. **フェーズ計測**: スライダー1tick(1フレーム)の内訳を、少なくとも次の粒度で計測可能にする — keyform サンプリング / デフォーマ chain 頂点変形 / 正規化(toFixed)・クローン / projection 再構築 / 描画 submit。既定OFFで、OFF時のオーバーヘッドは実質ゼロ(ガード1分岐程度)
2. **合成ベンチ**: 規模パラメータを振れる決定的な合成モデル生成 + 計測実行。最低3規模(軽/中/重。重は「症状が出る」規模を狙う)× 上記内訳で数値を取る
3. **ベースライン記録**: 実測値・実行環境・再現手順を `measurements/baseline-synthetic.md` に記録。仮説A/B/C のどれが支配的かの読みを添える(確定はユーザー実測と合わせて)
4. **ユーザー実モデル計測手順**: Editor 上で実モデルの内訳数値を取る手順(計測の有効化方法・数値の出る場所)を domain report に含める

Required tests / gate:

- 挙動不変: 既存テスト全 green(apps/editor 含む。既知 baseline fail 4件は除外してよい)
- 計測OFF時のホットパスに実質コストが乗らんこと(構造で示す。ガード外の割り当て禁止)
- ベンチの決定性(同一パラメータ→同一モデル生成。時間計測値そのものは変動してよい)
- typecheck / check:source / check:deps pass

Escalate if: 計測フックが評価層(packages/**)の非自明な変更を要求する場合 / 内訳粒度が既存構造で取れず設計変更が要る場合。

## 4. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の全規則に従う(分離 / ループ上限5 / 在席ポーリング / 閉域 / モデル明示)
- レビューは単一 Review-Sylph。観点: 挙動不変の実証(テスト再実行)・計測値の妥当性(内訳の合計がフレーム全体と概ね整合するか)・OFF時ゼロコストの構造確認
- 必須文言: 「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
