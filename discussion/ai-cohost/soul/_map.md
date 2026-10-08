# Soul (魂) Map

> S系列(魂の実装)と、その前提討議・運用判断の入口地図。器(C1〜C7、2026-07-12完成)の後段を索引する。

## 1. 位置づけ

- 魂 = 特区 `apps/soul` に住む自律駆動側(LLM・知覚・ASR/TTS・宛先判定)。憲章は [../concept/mvp-boundary-amendment.md](../concept/mvp-boundary-amendment.md) §6。特区の最初の住人=C4参照ドライバは稼働済み。
- 前提討議①②はクローズ済み。S1〜S8の実装・wave記録は [../implementation/](../implementation/) にあり、この map は現在の裁定、実装到達、残る人間/製品ゲートを分離して索引する。
- 実測(レイテンシ・費用)を始める段階で `experiments/` を、キャラクター設計を始める段階で `persona/` を、ユーザー合意のうえ切る([.._map](../_map.md) §2 の既定どおり)。

## 2. 議題(前提討議3件)

| # | 議題 | 成果物 | Status |
|---|---|---|---|
| ① | **知性のアクセス経路**: API従量 vs Claude Max 20x(Agent SDK) | [llm-access-path.md](llm-access-path.md) | **裁定済み・クローズ(2026-07-12)**。主経路=**案B(Max 20x+Agent SDK)**。切替容易性を要件化(魂の作り直し許容・退避先想定=OpenAIサブスク)。AI開示=配信概要欄記載必須。OpenAIデータ共有案=不採用。枠の実効量は`experiments/`で`/usage`実測。制度変更(クレジット制)は監視継続 |
| ② | **会話パイプライン最終化** + ASR/TTS選定の再確認 | [../architecture/conversation-pipeline-direction.md](../architecture/conversation-pipeline-direction.md) | **裁定済み・クローズ(2026-07-12)**: Draft→Accepted昇格。①織り込み(SDK・転写バッファが正・ツール無効+最小プロンプト)+出力側をC4〜C6契約へ接地+先送り明示(反射層具体構成はS系列、**persona声→相槌音声の順序制約**)。選定鮮度は再調査不要・S1着手時に最終確認 |
| ③ | **persona**(声・人格・AIの身体) | `persona/`(未作成) | **S8の実装後・S9相槌の声確定時に着手**。自己名「コーディ」は実装済み。声はS9/相槌の体感ゲートで確定、身体はリグ要件を添えて model-authoring 既存手順へ(器はモデルの作者を知らない)。 |

## 3.5 現在の後発判断

| Path | Status | 要点 |
|---|---|---|
| [brain-swap.md](brain-swap.md) | **実装済み・最終人間ゲート記録待ち** | 4頭(Claude Opus / GPT-5.6 Terra / GPT-5.5 / GPT-5.6 Sol)をregistry・操縦席・観測へ配線。初回体感の序列は Opus > Sol ≒ 5.5 > Terra。rollout掃除を含む運用3点ゲートは未記録。 |
| [stream-memory.md](stream-memory.md) | **実装済み・人間ゲート記録待ち** | 直近3配信の自動搭載、20分checkpoint/手動/SIGINT、OFF止水栓、視聴者名秘匿。保存/次回搭載/OFF/手動記録の4点実射が未記録。 |

## 3. 関連材料(①用)

- [../research/llm-cost-estimate.md](../research/llm-cost-estimate.md) — P3費用試算(API従量: 月16配信で約$55〜110)。①の比較基準。
- OpenAIのデータ共有プログラム(feedback/評価/fine-tuningデータおよびAPI入出力のOpenAIへの共有): <https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai> — **ユーザー提示(2026-07-12)、内容の事実確認要**。①の比較材料。
- [../research/gpt-live-impact-2026-07.md](../research/gpt-live-impact-2026-07.md) §4 — S2S再評価の常設監視条件(三点セット)。
- 会話LLMの品質要件: Opus 4.8以上(ユーザー決定、premises)。

## 4. 次の行動

1. **S8安全弁の人間ゲート**: 発話中kill→全発火拒否→一クリック復帰、通常発話無退行の2点を実射し、[../implementation/orchestration/s8-wave-plan.md](../implementation/orchestration/s8-wave-plan.md) に記録する。
2. **多頭化の最終運用ゲート**: 4頭の速度/品質体感、Claude無退行、配信後rollout掃除を [../implementation/orchestration/brain-swap-wave-plan.md](../implementation/orchestration/brain-swap-wave-plan.md) に記録する。実装済みであることをゲート完了と混同しない。
3. **配信間記憶の4点ゲート**: 保存/秘匿、次回自動搭載、OFF、手動/定期更新を [../implementation/orchestration/stream-memory-wave-plan.md](../implementation/orchestration/stream-memory-wave-plan.md) に記録する。
4. **persona/S9**: 声・人格の確定時期をユーザーが決める。身体/リグは model-authoring 責務のまま。

## 5. 未決事項

| 項目 | 状態 |
|---|---|
| ① アクセス経路(API従量 vs Max 20x/Agent SDK) | **裁定済み(2026-07-12): 主経路=Max 20x+Agent SDK**。残る検証は実測(枠・レイテンシ)=`experiments/`へ。クレジット制施行の監視は常設 |
| ② パイプライン最終形・ASR/TTS選定 | **裁定済み(2026-07-12): Accepted昇格**。外部要素の鮮度のみS1着手時に最終確認 |
| ③ persona の中身 / S9相槌の声 | **未着手**。自己名は実装済みだが声・人格の最終決定と実射は未完了 |
| S8 kill human gate | **未実施**。機械実装/764緑・9レーンPASSだが、即時停止/復帰と通常発話無退行の実射が必要 |
| 多頭化の最終運用 | **未記録**。4頭実装・初回体感あり。rollout掃除を含む3点人間ゲートを残す |
| 配信間記憶の実射 | **未記録**。957緑・6レーンPASS。4点人間ゲートを残す |
| 知覚の段階の具体化 / 情動層の状態語彙 | 未決([../concept/behavior-model.md](../concept/behavior-model.md) §8)。S系列分解時に扱う |
