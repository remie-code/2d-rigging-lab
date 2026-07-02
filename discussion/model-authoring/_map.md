# Model Authoring Map

> LLM（Fable）によるモデル制作挑戦の外部記憶の入口地図。

## 位置付け

足場（Editor / Runtime Player）完成後の次挑戦「**Fable に 2D モデルを作らせる**」に関する前提合意・閉問題・制作定石を保持するトピック。[../design/codex-friendly-automation-policy.md](../design/codex-friendly-automation-policy.md)（外部 LLM が deterministic API 経由で人間同等操作を行う Accepted decision）の後継。

## Entry Points

- 前提のオラクル: [premises/](premises/) の 3 文書（下記）
- 現在の作業: [closed-problems/_map.md](closed-problems/_map.md)

## 直下のディレクトリ

| Path | Role | Status |
|---|---|---|
| [premises/](premises/) | 前提合意層。この挑戦のオラクル | Accepted 5 文書を記録済み |
| [closed-problems/](closed-problems/) | 閉問題の連続。1 問題 = 1 ディレクトリ | 01-eyeball-x 定義済み・API 調査完了 |
| [research/](research/) | 調査事実の置き場（Sylph 報告の L0 統合、較正ログ） | 知覚経路調査・較正ログ Round 1 を記録済み |
| `craft/` | 閉問題から蒸留したレシピと不変量 = 制作定石（設計は [premises/craft-design.md](premises/craft-design.md)） | **未作成**（設計合意済み。初エッセンス獲得時に作成） |

## Key Files

| Path | Content | Status |
|---|---|---|
| [premises/authoring-solvability-analysis.md](premises/authoring-solvability-analysis.md) | 最小構成が不可解である理由、欠けた二器官、可解の境界、中心的未知 | Accepted |
| [premises/operating-policies.md](premises/operating-policies.md) | ヘッドレス専有運用、Git 巻き戻し、判定の梯子、Fable の知覚能力、素材スコープ、ref の位置づけ | Accepted |
| [premises/closed-problem-approach.md](premises/closed-problem-approach.md) | 閉問題連続アプローチの定義、利点 i-v、既知リスク、問題列 | Accepted |
| [premises/craft-design.md](premises/craft-design.md) | craft/ の目的（2周目のための手続き記憶）、遅延ロード参照モデル、レシピ自己完結性テスト、終着イメージ（プログラム化） | Accepted |
| [premises/model-allocation-policy.md](premises/model-allocation-policy.md) | Fable 枠制約下のモデル配分原則（実験=Fable必須 / L0=Fable / 委任=Fable以外）、調査モデル選定基準、較正ループ | Accepted |
| [closed-problems/01-eyeball-x/problem-definition.md](closed-problems/01-eyeball-x/problem-definition.md) | 第一閉問題: 眼球 X rigging の操作列・判断の所在・成功基準 | Problem defined |
| [closed-problems/01-eyeball-x/api-requirements.md](closed-problems/01-eyeball-x/api-requirements.md) | 6 操作の operation 対応表（全て exists）、実行ライフサイクル、ギャップ 3 件（host 不在 / Validate 入口無し / CLI 無し） | Facts recorded |
| [research/perception-path-survey.md](research/perception-path-survey.md) | 知覚経路の存否: 評価までは Node 到達可能、「RenderScene→PNG」の一段のみ欠落。入力形式の分岐材料 | Facts recorded |
| [research/delegation-calibration-log.md](research/delegation-calibration-log.md) | モデル配分較正の記録。Round 1: sonnet は狭い問い + アンカー付きなら足る | Living log |

## 現在の状態サマリ

- 2026-07-02: 前提 5 文書合意、第一閉問題（眼球 X）定義、API 調査完了（6 操作すべて既存 operation で対応可能）。
- 2026-07-02: **Wave103 `headless-authoring-host-foundation` final complete / pass**（[計画](../implementation/orchestration/wave103-plan.md) / [最終報告](../implementation/waves/wave103/wave103-final-integration-report.md)）。武器の第 1 陣が完成:
  - **手**: `apps/authoring-host` — ワンショット CLI。load → dry-run → 自動承認 → commit → save。閉問題 01 の 5 操作スモーク全 committed、`createEndsCenter` 単独新規作成も実証済み
  - **網膜**: `packages/render-software` — 依存ゼロ・完全決定論の RenderScene → RGBA8 → PNG。ビュー変換順逆 API 公開済み（サイドカー用）
- Wave103 からの引き継ぎリスク（非ブロッキング）: state-dir パッケージ内誤用ガード無し / 実 WebGL2 とのピクセル同値性未検証（ref e2e で扱う）/ 依存ガード偽陽性（別タスク化済み）

## 次の行動

1. Wave104 計画（planning-gate から）: 知覚コマンド面 renderView / コンタクトシート / ビュー変換サイドカー + 測量コマンド + validatePackage 接続 + ref/ e2e スモーク
2. Wave104 完了後、閉問題 01 の実験実行（B の検証 = Fable の視覚弁別力の初実測）

## 決着済みの元・未決事項（2026-07-02 ユーザー決定）

- 承認 gate: ai-interface 経由（案 A）+ 自動承認ポリシー = dry-run を機械的検証ゲートとして再解釈
- 知覚経路: ホスト内で生きた AuthoringSession から直接描画（Runtime Export 経由は不要と決着）。要求仕様 = 目（renderView + フレーミング + コンタクトシート）/ 測量（評価済みジオメトリ照会）/ 変換器（サイドカーのビュー変換）の三位一体
- 実装 wave の置き場: 既存 implementation/ 機構の続番（wave103〜）
- ラスタライザ方式: 純 TS ソフトウェアラスタライザ（ネイティブ GL 不採用）。ホスト形態: ワンショット CLI

## 未決事項

- Git コミット粒度の規約化
- Fable の視覚弁別力の実測値（01-eyeball-x の実験で最初の答えが出る）
- コマ列グリッド生成の手段（欠落部品の一部として実装 wave で扱う見込み）
