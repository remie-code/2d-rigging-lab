# AI Cohost Map

> ユーザー×自律AIの共演配信構想(ai-cohost)に関する外部記憶の入口地図。

## 1. Scope

ユーザー(自作モデル+フェイストラッキング)と、完全自律のAI(別モデルを自律駆動)が、二人で一緒に配信し、人間とAIの間で自然な音声会話が成立する状態を目指す構想。

当初MVP(Private Authoring-to-Viewer Prototype)の全達成後(2026-07-10 ユーザー宣言)の次期構想であり、既存資産(runtime-player、決定論ランタイム、リップシンク、Fable制作モデル)の上に載る。

Editor本体のauthoring UX、モデル制作そのもの(model-authoring)、Runtime Playerの既存機能はこのトピックの責務ではない。

## 2. Directory Map

| Path | Role | Status |
|---|---|---|
| [concept/](concept/) | 目標像、成功基準、非目標、4トラック/MVP境界との関係 | Created |
| [premises/](premises/) | ユーザー合意済みの前提・制約 | Created |
| [research/](research/) | 調査事実(外部技術地形、先例、内部統合点、費用試算) | Created |
| [architecture/](architecture/) | 設計方向・設計判断(会話パイプライン、操縦チャネル、生理層、モデルホスト) | Created |
| [implementation/](implementation/) | 実装フェーズの計画・実行成果物(runtime-player方式) | Created(2026-07-10)。閉問題分解C1〜C7まで。**C1 wave 実装完了(Domain A/B/C、パッケージ版手動ゲート待ち)**、C2〜C7 未着手 |

実測(レイテンシ・会話品質・費用)を始める段階で `experiments/` を、AIのキャラクター・声・身体の設計を始める段階で `persona/` を、ユーザー合意のうえ追加する。

## 3. Reading Routes

- なぜやるのか・何ができたら成功かを確認する場合は [concept/](concept/) を読む。
- 決定済みの前提(LLM品質要件、費用前提、決定性境界)を確認する場合は [premises/](premises/) を読む。
- 技術的な裏付け(先例、選定材料、統合点)を確認する場合は [research/](research/) を読む。
- 設計の現在の方向と未決の分岐を確認する場合は [architecture/](architecture/) を読む。

## 4. Current State Summary

- 目標像・成功基準(「AIの間も含めてキャラの演出」)はユーザー合意済み(2026-07-10)。
- 実現可能性は調査で確認済み: 先例(Neuro-sama等)が商業水準で成立。会話LLMはOpus 4.8以上をユーザー決定、費用試算は月16配信で約$55〜110。
- **MVP境界の改定(案A)をAccepted(2026-07-10)**: 魂は別リポジトリ、本リポジトリは操縦チャネル+生理層生成器の解禁のみ、リポジトリ内LLM統合・知覚は引き続き禁止 → [concept/mvp-boundary-amendment.md](concept/mvp-boundary-amendment.md)。
- **振る舞いモデル(存在の解剖学)をAccepted(2026-07-10)**: 三層(生理/情動/知性)+一知覚、梯子(質感/単語/文)、演出エンベロープのパッケージ帰属 → [concept/behavior-model.md](concept/behavior-model.md)。
- **Runtime Player=モデルホスト、案(c)役割つき起動をAccepted(2026-07-10)**: 二役割(トラッキングホスト/自律ホスト)、起動UX(三つの扉)、生理自動/チャネル手動 → [architecture/runtime-player-model-host-roles.md](architecture/runtime-player-model-host-roles.md)。
- 会話パイプライン(テキストパイプライン+二層設計「AIは全部聞くが全部では考えない」)はDraft。
- **C1 完全閉鎖(2026-07-10)**: 二役割の合成骨格(スロット基盤 / 役割合成 / 身元表示)を実装、3レーンレビュー PASS、回帰ゼロ、**パッケージ版手動ゲート全項目合格(ユーザー実施。二体同居・profile非混在・片方kill耐性・引数なしスタブ含む)**、上位判断7件裁定済み。既知制限: dev引数なし起動([implementation/orchestration/c1-wave-plan.md](implementation/orchestration/c1-wave-plan.md) Status)。C2 以降は未着手。

## 5. Next Actions

1. 実装は閉問題分解([implementation/closed-problem-decomposition.md](implementation/closed-problem-decomposition.md)、C1〜C7)に従う。進め方は一問題ずつ議論→実装→人間ゲート→完全閉鎖の直列(同§6)。**C1 は完全閉鎖(2026-07-10)**。C2は設計討議Accepted・棚卸し・裁定・wave計画まで完了([implementation/orchestration/c2-wave-plan.md](implementation/orchestration/c2-wave-plan.md)、Ready to launch)。次の一手は **C2のwave実行**。C3/C4のUX定義は各wave直前にjust-in-time。
2. persona/(存在の人格)を切る段階で、AIの身体のリグ要件を提示しmodel-authoringの既存手順で制作する。**「誰が作るか」は本トピックの設計事項ではない**(器はモデルの作者を知らない。ユーザー確認 2026-07-10)。

## 6. Unresolved Questions

| 項目 | 状態 |
|---|---|
| 成功基準「AIの間も演出」 | **Accepted(2026-07-10)** |
| MVP境界の明示変更 | **Accepted(案A、2026-07-10)** |
| 魂(オーケストレータ)の居場所(D1) | **解決: 別リポジトリ(案A、2026-07-10)** |
| アプリの形 | **解決: 案(c)役割つき起動(2026-07-10)** |
| プラットフォーム(D4) | **解決: YouTube(2026-07-10)** |
| 宛先判定の初手(D6) | **解決: キー操作から、実機ゲートを経て段階的自動化(2026-07-10)** |
| Variant切替のAI制御面包含(D7) | **解決: 当面対象外(2026-07-10)** |
| AIの身体(モデル)の制作者 | **本トピックの設計事項ではないと確認(2026-07-10)**。persona確定後にリグ要件を添えてmodel-authoring手順へ |
| 知覚の段階の具体化 / 情動層の状態語彙 / 第二段のFable検証方法 | 未決([concept/behavior-model.md](concept/behavior-model.md) §8) |
| 役割別userData分離・ポート割当の具体方式 | **解決: プロファイルスロット方式+スロットごと自動採番(2026-07-10)**([implementation/orchestration/c1-wave-plan.md](implementation/orchestration/c1-wave-plan.md) Status) |
| **監視条件(常設)**: S2S級応答+カスタムキャラ声+外部アバター同期面の三点が揃った製品の出現でS2S再評価 | 監視中([research/gpt-live-impact-2026-07.md](research/gpt-live-impact-2026-07.md) §4。GPT-Live/Gemini Liveは三点未達で採用転換なし) |
