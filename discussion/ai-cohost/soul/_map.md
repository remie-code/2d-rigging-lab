# Soul (魂) Map

> S系列(魂の実装)の**前提討議**トピックの入口地図。器(C1〜C7、2026-07-12完成)の次段。

## 1. 位置づけ

- 魂 = 特区 `apps/soul` に住む自律駆動側(LLM・知覚・ASR/TTS・宛先判定)。憲章は [../concept/mvp-boundary-amendment.md](../concept/mvp-boundary-amendment.md) §6。特区の最初の住人=C4参照ドライバは稼働済み。
- 本トピックは **S系列の閉問題分解の前に閉じるべき前提討議** を保持する(ユーザー確認 2026-07-11: 前提討議→S系列分解→S1=歩くスケルトン=一文の縦貫通)。討議が閉じたら分解・実装は [../implementation/](../implementation/) 流儀(閉問題直列)で起こす。
- 実測(レイテンシ・費用)を始める段階で `experiments/` を、キャラクター設計を始める段階で `persona/` を、ユーザー合意のうえ切る([.._map](../_map.md) §2 の既定どおり)。

## 2. 議題(前提討議3件)

| # | 議題 | 成果物 | Status |
|---|---|---|---|
| ① | **知性のアクセス経路**: API従量 vs Claude Max 20x(Agent SDK) | [llm-access-path.md](llm-access-path.md) | **裁定済み・クローズ(2026-07-12)**。主経路=**案B(Max 20x+Agent SDK)**。切替容易性を要件化(魂の作り直し許容・退避先想定=OpenAIサブスク)。AI開示=配信概要欄記載必須。OpenAIデータ共有案=不採用。枠の実効量は`experiments/`で`/usage`実測。制度変更(クレジット制)は監視継続 |
| ② | **会話パイプライン最終化** + ASR/TTS選定の再確認 | (未着手) | 既存Draft: [../architecture/conversation-pipeline-direction.md](../architecture/conversation-pipeline-direction.md)(テキストパイプライン+二層設計「AIは全部聞くが全部では考えない」)。選定材料は [../research/](../research/)(2026-07-10時点)——鮮度確認要 |
| ③ | **persona**(声・人格・AIの身体) | `persona/`(未作成) | コードと独立の**並行コンテンツトラック**。身体はリグ要件を添えて model-authoring 既存手順へ(器はモデルの作者を知らない) |

## 3. 関連材料(①用)

- [../research/llm-cost-estimate.md](../research/llm-cost-estimate.md) — P3費用試算(API従量: 月16配信で約$55〜110)。①の比較基準。
- OpenAIのデータ共有プログラム(feedback/評価/fine-tuningデータおよびAPI入出力のOpenAIへの共有): <https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai> — **ユーザー提示(2026-07-12)、内容の事実確認要**。①の比較材料。
- [../research/gpt-live-impact-2026-07.md](../research/gpt-live-impact-2026-07.md) §4 — S2S再評価の常設監視条件(三点セット)。
- 会話LLMの品質要件: Opus 4.8以上(ユーザー決定、premises)。

## 4. 次の行動

1. **② 会話パイプライン最終化+ASR/TTS選定の再確認**: 既存Draft([../architecture/conversation-pipeline-direction.md](../architecture/conversation-pipeline-direction.md))を①の裁定(Agent SDK経由)前提で見直し、選定材料の鮮度を確認して最終化。
2. ③ persona は並行トラックとしていつでも開始可。
3. 3件が閉じたら S系列の閉問題分解を起こす(S1=歩くスケルトン)。`experiments/` を同時に切る(コストメーター=`/usage`実測+レイテンシ実測)。

## 5. 未決事項

| 項目 | 状態 |
|---|---|
| ① アクセス経路(API従量 vs Max 20x/Agent SDK) | **裁定済み(2026-07-12): 主経路=Max 20x+Agent SDK**。残る検証は実測(枠・レイテンシ)=`experiments/`へ。クレジット制施行の監視は常設 |
| ② パイプライン最終形・ASR/TTS選定 | 未着手(既存Draftあり) |
| ③ persona の中身 | 未着手(並行トラック) |
| 知覚の段階の具体化 / 情動層の状態語彙 | 未決([../concept/behavior-model.md](../concept/behavior-model.md) §8)。S系列分解時に扱う |
