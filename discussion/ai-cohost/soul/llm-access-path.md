# 討議①: 知性のアクセス経路(API従量 vs Claude Max 20x + Agent SDK)

> Status: **討議中(2026-07-12)**。事実調査(Sylph、Web一次情報)は完了、ユーザー裁定待ち。
> 位置づけ: S系列前提討議の①([_map.md](_map.md))。未決の初出は [../architecture/c4-control-channel-v0.md](../architecture/c4-control-channel-v0.md) §9。裁定は premises P3(費用試算 月$55〜110)を書き換え得る。
> 情報種別は 事実(出典付き)/推測/不明 を明示分離する(discussion/_conventions.md §6)。

## 0. 問いと選択肢

配信中ずっと常駐する魂(会話LLM=Opus 4.8以上、ASR→LLM→TTS、1配信2〜3時間、月16配信想定)の知性を何経由で呼ぶか。

- **案A: Anthropic API従量課金** — P3試算で月$55〜110。
- **案B: Claude Max 20xプラン + Claude Agent SDK** — ユーザー既契約。**ユーザー選好(2026-07-12): 費用面からこれが最も望ましい**。
- **参考C: OpenAI API(+データ共有プログラムの無償枠)** — ユーザー提示の比較材料。

## 1. 案Bの規約適合性(事実、2026-07-12時点)

1. **現行運用: Agent SDKのサブスク利用は公式に容認**。公式ヘルプ「Use the Claude Agent SDK with your Claude plan」の6/15付更新: "We're pausing the changes… For now, nothing has changed: Claude Agent SDK, claude -p, and third-party app usage still draw from your subscription's usage limits." 同記事は「自作プロジェクト(Python/TypeScript)でのAgent SDK利用」を正当な利用形態として明記。
   出典: <https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan>
2. **一時停止中のクレジット制度(施行延期中)**: Agent SDK等の利用をサブスク枠から切り離し、**Max 20xに月$200のAgent SDKクレジット**(繰越なし、超過は従量課金または停止)を付与する計画が存在。「施行前に告知する」と明言。→ **制度変更リスクの本体**。(同上)
3. **Consumer Terms**(2025-10-08発効): 自動アクセスは「明示的に許可された場合を除き」禁止 — 上記公式ヘルプが明示許可に該当すると読める。資格情報の共有は禁止(本件は本人利用なので非該当)。
   出典: <https://www.anthropic.com/legal/consumer-terms>
4. **Agent SDKドキュメントの禁止Note**: 「第三者開発者が自分の製品ユーザーにclaude.aiログイン/枠を提供する」ことの禁止であり、本人が自分のサブスクで自作エージェントを動かす形態とは別。
   出典: <https://code.claude.com/docs/en/agent-sdk/overview>
5. **Usage Policy**(2025-09-15発効): 消費者向けチャットボットは**AIであることの開示義務**あり → 配信で視聴者に明示すればクリア可能。human-in-the-loop要件は専門助言(法律・医療・金融)向けでエンタメ配信は非該当。配信自動応答・長時間常駐を直接禁じる条項は確認できず。
   出典: <https://www.anthropic.com/legal/aup>
6. (経緯、二次情報) 2026年2月にOAuthをClaude Code/claude.aiに限定するToS改訂→6月にサードパーティ/SDK利用を(クレジット制付きで)復活方針→施行延期、と**年内で二転三転**している。出典: <https://zed.dev/blog/anthropic-subscription-changes>

**推測(明記)**: 本人のMax 20xでAgent SDK製配信エージェントを常駐させる形態は、現行文言上は許容範囲と読める。ただし制度変更リスク(クレジット制=実質月$200上限化)が高い前提で設計すべき。

**不明・要問い合わせ**: クレジット制の再施行時期と最終形。「配信の自動応答」がUsage Policyの "automatically generate content and publish it for external consumption"(高リスク用途の記述)に該当するかの線引き。確実を期すならAnthropicサポートへ問い合わせ。

## 2. 案Bの枠の実態(事実)

- 構造: **5時間ローリングウィンドウ + 週次上限2系統**(全モデル共通/Sonnet専用)。チャットとClaude Code/Agent SDKは**同一プール**。Max 20x = Proの20倍/セッション。出典: <https://support.claude.com/en/articles/11049741-what-is-the-max-plan>
- 2026-05-06に5時間枠が全プラン倍増、ピーク時間帯縮小も撤廃。2025-11-24以降Opus個別キャップ撤廃(全体枠内で使用可)。Opus 4.8のトークン単価はSonnetの約1.67倍($5/$25 vs $3/$15)。出典: <https://www.morphllm.com/claude-code-usage-limits>(公式発表の集約、2026-06-09付)
- **絶対量(トークン換算)は非公表**。第三者推計は倍増前の古い値でstale。

**推測**: 配信2〜3時間は1ウィンドウに収まる。枠消費の主敵は毎ターンの固定プリフィックス+累積履歴。**持つかどうかは `/usage` 実測(experiments/)が必須**。月16配信(週4ペース)で週次上限に触れるかが本丸。

**不明**: 5時間/週次の絶対量。サブスク使用量計測でのキャッシュヒットの扱い。

## 3. レイテンシの構造差(事実=構造、実測は後段)

- Agent SDK = Claude Codeのハーネスごと載る(エージェントループ+ツール定義+`.claude/`・CLAUDE.mdロード。`settingSources`で制限可能)。出典: <https://code.claude.com/docs/en/agent-sdk/overview>
- **推測**: TTFT差の主因は (1)プリフィル量(SDK既定=数万トークン級 vs API直=数百に絞れる。キャッシュヒットで縮む) (2)エージェントループ(応答前のツール/思考がTTS開始を遅らせ得る) (3)初期化(常駐なら初回のみ)。**ツール無効化+システムプロンプト最小のSDKセッションなら構造差はかなり圧縮できる見込み**。制御自由度はAPI直が上。

## 4. 参考C: OpenAIデータ共有プログラム(事実、一次記事全文確認済み)

出典: <https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai>

- **何か**: API組織がopt-inで「feedback/評価・fine-tuningデータ/**API入出力(prompts・completions)**」をOpenAIへ共有する仕組み(既定は全て無効)。見返りは**無償デイリートークン**: Tier 1–2=250K/日(標準)+2.5M/日(mini/nano)、Tier 3–5=**1M/日+10M/日**。00:00 UTCリセット、枠超過リクエストは全体が通常課金、tool useは対象外、**30日前通知でプログラム終了があり得る**。ZDR組織は参加不可。
- **権利面**: 共有データは「将来のモデルの評価と学習に用いられる」と明記=**学習に使われる**。「共有する適切な権限を持つことの確認」責任は利用者側。opt-out後の共有済みデータの遡及削除への言及なし(不明)。
- **配信用途の含意(推測含む)**: 視聴者のコメント・発言(第三者の発話、場合により個人情報)がLLM入力に混入し、opt-in時はそれが学習提供される。プロジェクト単位でopt-in範囲を絞れるため、採用するなら配信用プロジェクト分離+視聴者告知が実務線。日本の個情法上の第三者提供整理が必要になり得る(推測、法的助言ではない)。
- **費用面(推測)**: 1配信の消費は履歴管理次第で数十万〜数百万tokens/日に達し得るため、Tier 1–2の250K/日では不足しがち。Tier 3–5でも履歴圧縮が前提。無償枠自体が30日通知で消える計画リスクあり。

## 5. 参考C': OpenAI API従量(事実は価格のみ)

- GPT-5.5 = $5/$30 per 1M(Opus 4.8 = $5/$25とほぼ同価格帯)。GPT-5.6ファミリーが限定プレビュー。出典: <https://developers.openai.com/api/docs/pricing> ほか。
- 品質要件「Opus 4.8以上」を満たすかは未検証(会話性の質は品質要件の定義次第。検証するならexperiments/)。

## 6. 裁定事項(ユーザー)

| # | 問い | Undineの推奨 |
|---|---|---|
| 1 | **主経路を案B(Max 20x+Agent SDK)とするか** | 推奨=Yes。現行規約は容認、費用選好とも整合。ただし#2のヘッジとセットで |
| 2 | **制度変更リスクへの構え**: クレジット制施行(実質$200/月上限)時の許容ラインと退避先 | 推奨=魂のLLM呼び出しを薄い抽象で包み**経路可換**(SDK⇄API従量)に設計。施行されたら$200/月内かAPI従量(P3試算$55〜110)へ切替 |
| 3 | **AI開示を設計要件に組み込むか**(配信概要欄・画面表示等でAIであることを明示) | 推奨=Yes(Usage Policy遵守の必須要件として) |
| 4 | **参考C(OpenAIデータ共有)を候補に残すか** | 推奨=**採用しない**。視聴者の発言を学習提供する構造は共演配信の性質と相性が悪く、無償枠は30日通知で消え得る。比較材料としての記録に留める |
| 5 | Anthropicサポートへの規約問い合わせ(配信自動応答の線引き)を行うか | 任意。行うならユーザー名義(アカウント事項のため) |

## 7. 裁定結果

(未記入 — ユーザー裁定後に記録)
