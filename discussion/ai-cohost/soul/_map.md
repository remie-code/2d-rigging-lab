# Soul (魂) Map

> S系列(魂の実装)の**前提討議**トピックの入口地図。器(C1〜C7、2026-07-12完成)の次段。

## 1. 位置づけ

- 魂 = 特区 `apps/soul` に住む自律駆動側(LLM・知覚・ASR/TTS・宛先判定)。憲章は [../concept/mvp-boundary-amendment.md](../concept/mvp-boundary-amendment.md) §6。特区の最初の住人=C4参照ドライバは稼働済み。
- 本トピックは **S系列の閉問題分解の前に閉じるべき前提討議** を保持する(ユーザー確認 2026-07-11: 前提討議→S系列分解→S1=歩くスケルトン=一文の縦貫通)。討議が閉じたら分解・実装は [../implementation/](../implementation/) 流儀(閉問題直列)で起こす。
- 実測(レイテンシ・費用)を始める段階で `experiments/` を、キャラクター設計を始める段階で `persona/` を、ユーザー合意のうえ切る([.._map](../_map.md) §2 の既定どおり)。

## 2. 議題(前提討議3件)

| # | 議題 | 成果物 | Status |
|---|---|---|---|
| ① | **知性のアクセス経路**: API従量 vs Claude Max 20x(Agent SDK) | [llm-access-path.md](llm-access-path.md) | **事実調査完了・ユーザー裁定待ち(2026-07-12)**。要点: 現行規約はSDKサブスク利用を容認/クレジット制($200/月上限化)の施行延期中=制度変更リスク/枠の絶対量は非公表で実測必須/OpenAIデータ共有案は学習提供と引き換えの無償枠。裁定事項5件は同ファイル§6 |
| ② | **会話パイプライン最終化** + ASR/TTS選定の再確認 | (未着手) | 既存Draft: [../architecture/conversation-pipeline-direction.md](../architecture/conversation-pipeline-direction.md)(テキストパイプライン+二層設計「AIは全部聞くが全部では考えない」)。選定材料は [../research/](../research/)(2026-07-10時点)——鮮度確認要 |
| ③ | **persona**(声・人格・AIの身体) | `persona/`(未作成) | コードと独立の**並行コンテンツトラック**。身体はリグ要件を添えて model-authoring 既存手順へ(器はモデルの作者を知らない) |

## 3. 関連材料(①用)

- [../research/llm-cost-estimate.md](../research/llm-cost-estimate.md) — P3費用試算(API従量: 月16配信で約$55〜110)。①の比較基準。
- OpenAIのデータ共有プログラム(feedback/評価/fine-tuningデータおよびAPI入出力のOpenAIへの共有): <https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai> — **ユーザー提示(2026-07-12)、内容の事実確認要**。①の比較材料。
- [../research/gpt-live-impact-2026-07.md](../research/gpt-live-impact-2026-07.md) §4 — S2S再評価の常設監視条件(三点セット)。
- 会話LLMの品質要件: Opus 4.8以上(ユーザー決定、premises)。

## 4. 次の行動

1. **①のユーザー裁定**: [llm-access-path.md](llm-access-path.md) §6 の5件(主経路・制度変更ヘッジ・AI開示要件・OpenAI案の扱い・規約問い合わせ要否)→ 結果を同§7へ記録。
2. ①裁定後、②(パイプライン最終化・選定再確認)へ。③は並行トラックとしていつでも開始可。
3. 3件が閉じたら S系列の閉問題分解を起こす(S1=歩くスケルトン)。`experiments/` を同時に切る(P3コストメーター+レイテンシ実測)。

## 5. 未決事項

| 項目 | 状態 |
|---|---|
| ① アクセス経路(API従量 vs Max 20x/Agent SDK) | 討議中(2026-07-12〜)。ユーザー選好=Max 20x。規約適合+レイテンシの事実待ち |
| ② パイプライン最終形・ASR/TTS選定 | 未着手(既存Draftあり) |
| ③ persona の中身 | 未着手(並行トラック) |
| 知覚の段階の具体化 / 情動層の状態語彙 | 未決([../concept/behavior-model.md](../concept/behavior-model.md) §8)。S系列分解時に扱う |
