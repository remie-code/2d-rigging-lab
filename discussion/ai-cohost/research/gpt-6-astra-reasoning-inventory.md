# GPT-6 Astra reasoning inventory

調査日: 2026-09-08 (Asia/Tokyo)

対象: 正確なモデル ID `gpt-6-astra`。製品実装は変更していない。

## 結論

- **公式 API の最小 supported effort は `low`**。公式の列挙は `low`, `medium`, `high`, `xhigh`, `max`。`none` は非対応と明記されている。
- **API の effort default はこの調査では未確認**。公式モデルページの “Default” はモデルの選択表示であり、`defaultReasoningEffort` の値とは断定しない。公式移行ガイドは、現行が `none`/`minimal` なら `low` から比較するよう案内する。
- **正確なモデル ID は `gpt-6-astra`**。公式 API ページは画像入力 (`Image: Input only`) を広告する。
- **現行 subscription-auth Codex App Server の Astra runtime 適合は未確認**。同梱 CLI の版は 0.144.5 と確認できたが、今回の read-only `model/list` probe では Astra の有効な応答を回収できなかった。したがって、low が広告されることと実ターン成功は区別し、Astraについてはどちらも runtime 実測済みとはしない。

## Official facts（公式本文）

1. [GPT-6 Astra Model](https://developers.openai.com/api/docs/models/gpt-6-astra) は `reasoning.effort` の supported 値を `low`, `medium`, `high`, `xhigh`, `max` と記載（本文行 825–836）。同ページは modality を Text input/output、Image input only、Audio/Video not supported と記載（行 876–892）。
2. [Model guidance](https://developers.openai.com/api/docs/guides/latest-model) は `model` に `gpt-6-astra` を設定すること（行 831–838）、`none` reasoning effort は非対応（行 839–845）、現行が `none` または `minimal` なら `low` から比較すること（行 914–918）を記載。
3. [Models](https://developers.openai.com/api/docs/models) は model ID `gpt-6-astra` と reasoning 列挙 `low medium high xhigh max`（行 823–831）、最新モデルは text/image input と vision をサポートすると記載（行 811–816）。

## Local observed facts（リポジトリ・同梱 CLI）

- `apps/soul/agent/package.json:11-14` は `@openai/codex-sdk: ^0.144.5`。lockfileも同版系列（`apps/soul/agent/package-lock.json:10-13`）。同梱実行物への `--version` は `codex-cli 0.144.5` を返した（警告は一時 arg0/PATH alias の cleanup 不許可のみ）。
- 現行 Codex adapter は `apps/soul/agent/src/mind/codex-session.mjs:574-578` で `app-server --stdio` を起動し、`forced_login_method="chatgpt"` と `web_search="disabled"` を渡す。`thread/start` は同ファイル `:604-606` で `model` と read-only/approval 設定を渡す。これは subscription-auth 経路の配線事実である。
- `apps/soul/agent/src/mind/codex-session.mjs:130-152` は base64画像を作業用一時ファイルへ写し `localImage` inputへ変換する。`item/agentMessage/delta` の蓄積・`item/completed` との一致検証は同ファイル `:482-559` にある。
- 現行 registry は `apps/soul/agent/src/mind/brains.mjs:80-87` までで、Astra entryは存在しない。Solのlow配線は既存実測に基づくコメントであり、Astraの能力広告ではない。
- Astraを対象に、childを一つだけ起動し `initialize` → `model/list` のみを試みた。thread/start、turn/start、設定変更、依存更新はしていない。今回の取得結果はAstraの usable model recordを含まず、成功/失敗を判定できる応答本文も保存していない。

## Inference（限定的な導出）

- 公式 API の minimum supported effort を、Astraを追加する場合の初期値候補 `low` とするのは妥当。ただし、Codex App Server の `supportedReasoningEfforts` が同じ集合であることは別途 runtime `model/list` で確認が必要。
- 現行 adapter の画像橋渡しとdelta処理はモデル非依存の形に見えるため、**コード構造上の再利用可能性**はある。しかしAstraでのvision入力受理、deltaイベント順序、turn完了を証明するものではない。

## Unverified / next checks

- subscription-auth App Server `model/list` に `gpt-6-astra` が出るか、その `supportedReasoningEfforts`、`defaultReasoningEffort`、`inputModalities`。
- `gpt-6-astra` + `low` の実ターン成功、画像入力成功、`item/agentMessage/delta` の完了前到着。今回の調査ではいずれも実施していない。
- `default` の意味（モデル既定か effort既定か）。`low` を広告値・実ターン受理値と混同しない。

## 最小追加時の technical 注意点（未実装）

最小候補は registry に別 IDを追加し `createCodexSession({ ...options, model: "gpt-6-astra", effort: "low" })` とすることだが、実装承認前に App Server `model/list` の Astra recordを確認する。併せて Cockpit各層の表示札・妥当性検証・テストへ同じ IDを追加し、`none`/`minimal` を送らない。vision/deltaは既存adapterを再利用できる可能性があるだけで、Astra runtime smokeを別途行う。
