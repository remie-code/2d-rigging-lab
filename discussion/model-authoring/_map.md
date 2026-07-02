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
| [premises/](premises/) | 前提合意層。この挑戦のオラクル | Accepted 3 文書を記録済み |
| [closed-problems/](closed-problems/) | 閉問題の連続。1 問題 = 1 ディレクトリ | 01-eyeball-x 定義済み |
| `craft/` | 閉問題から蒸留したレシピと不変量 = 制作定石（設計は [premises/craft-design.md](premises/craft-design.md)） | **未作成**（設計合意済み。初エッセンス獲得時に作成） |

## Key Files

| Path | Content | Status |
|---|---|---|
| [premises/authoring-solvability-analysis.md](premises/authoring-solvability-analysis.md) | 最小構成が不可解である理由、欠けた二器官、可解の境界、中心的未知 | Accepted |
| [premises/operating-policies.md](premises/operating-policies.md) | ヘッドレス専有運用、Git 巻き戻し、判定の梯子、Fable の知覚能力、素材スコープ、ref の位置づけ | Accepted |
| [premises/closed-problem-approach.md](premises/closed-problem-approach.md) | 閉問題連続アプローチの定義、利点 i-v、既知リスク、問題列 | Accepted |
| [premises/craft-design.md](premises/craft-design.md) | craft/ の目的（2周目のための手続き記憶）、遅延ロード参照モデル、レシピ自己完結性テスト、終着イメージ（プログラム化） | Accepted |
| [closed-problems/01-eyeball-x/problem-definition.md](closed-problems/01-eyeball-x/problem-definition.md) | 第一閉問題: 眼球 X rigging の操作列・判断の所在・成功基準 | Problem defined |

## 現在の状態サマリ

- 2026-07-02: 可解性分析・運用方針・閉問題アプローチを合意し、第一閉問題（眼球 X）を定義した。
- 2026-07-02: craft/ の成果物イメージ（遅延ロード参照モデル、レシピ自己完結性テスト）を合意した。
- API 調査（01 の A）は未着手。

## 次の行動

1. 01-eyeball-x の API 調査（A）: `ai-interface` の現状把握と不足面の同定
2. 知覚経路（レンダリング取得、コマ列グリッド生成）の実現手段の検討

## 未決事項

- API 整備で実装 wave が必要になった場合の置き場（既存 `implementation/` 機構に流すか、本トピック配下か）
- Git コミット粒度の規約化
- Fable の視覚弁別力の実測値（01-eyeball-x の実験で最初の答えが出る）
- コマ列グリッド生成の手段（ツール側機能か外部スクリプトか）
