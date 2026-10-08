# GPT-6 Astra integration inventory

調査日: 2026-09-08 (Asia/Tokyo)

対象: `gpt-6-astra` / effort `low`。製品コード、tests、設定、lockfileは変更していない。

## Repository facts

| 領域 | 現行箇所 | Astra追加時の最小変更候補 |
|---|---|---|
| registry/model routing | `apps/soul/agent/src/mind/brains.mjs:28,70-88` | `codex-astra`等の新規 brain ID entry、`model:"gpt-6-astra"`, `effort:"low"`。既存選択値/defaultは変更不要 |
| persisted choice / initial validation | `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs:244-250`; `apps/soul/agent/scripts/cockpit.mjs:646-675` | `brainChoice`は任意文字列を保存し、起動時は registry `BRAIN_IDS`で検証。registry追加のみで保存/初期復元の動的部分は変更不要 |
| API brain validation | `apps/soul/agent/src/cockpit/cockpit-server.mjs:1190-1212` | 明示許可列にAstra IDを1値追加。ここは現在4値の直書きで、未追加なら400 |
| settings UI label/options | `apps/soul/agent/src/cockpit/view-logic/health.mjs:90-99`; `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs:77-83` | `BRAIN_LABELS`へAstra表示札を1値追加。select optionsはそこから自動生成 |
| conversation instruction IDs | `apps/soul/agent/src/mind/fire-orchestrator.mjs:191-197`; `apps/soul/agent/src/cockpit/view-logic/conversation-instruction.mjs:14-23` | technical ID配列へAstra IDを追加。settings storeの読み書きは同配列を反復するため `cockpit-settings-store.mjs:154-180,262-290` も自動追随 |
| identity/name | `apps/soul/agent/src/mind/brains.mjs:70-88`; `apps/soul/agent/src/mind/model-identity.mjs`参照 | GPT系と同じ `MODEL_IDENTITIES.chappy` を使用する想定。文字列名の類似だけではなく、既存Codex全entryがchappy identityを共有するコード事実に基づく |
| session switching / next Fire | `apps/soul/agent/scripts/cockpit.mjs:840-880,1028-1042` | 変更不要。選択を永続化しrevisionを進め、現sessionは次のaccepted Fire境界で再生成する既存ライフサイクルを継承 |
| tests with fixed four-ID assumptions | `apps/soul/agent/src/mind/brains.test.mjs:18-23,32-49,51-75,124-128`; `apps/soul/agent/src/mind/fire-orchestrator.test.mjs:133`; `apps/soul/agent/src/cockpit/view-logic/health.test.mjs:102-114`; `apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs:25-28`; `apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs:86-182`; `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs:825-831`; `apps/soul/agent/src/cockpit/cockpit-server.test.mjs:2595-2611` | 既存の4値期待値・各Codex配線表へAstraを追加し、model/effort・label・API受理・instruction round-trip・次Fire切替を固定 |

`apps/soul/agent/src/mind/codex-session.mjs:574-578,604-606,659-662` は共通App Server route、subscription config、read-only/approval設定を持つ。画像橋渡しは `:130-152`、deltaのconcat/final一致検証は `:482-559` で、モデル固有分岐はない。

## Runtime observations

- 対象実行物は同梱 `@openai/codex-win32-x64` の `codex.exe`; `--version` は `codex-cli 0.144.5`。依存/CLI更新はしていない。
- bounded probeはchild 1個のみ。作業cwdは一時dir、argsは `app-server --stdio -c forced_login_method="chatgpt" -c web_search="disabled"`、stderrは破棄、stdoutのみJSONL解析、stdinはresponse受信まで開いた。
- JSON-RPC相関は request id `1` の `initialize` response受信後に `initialized` notificationと id `2` の `model/list` requestを送信。id `2` responseを受信し、`result.data`/`result.models`から **必要フィールドだけ** `id/name/supportedReasoningEfforts/defaultReasoningEffort/inputModalities` を抽出した。
- id `2` は正常な応答だったが、`gpt-6-astra` filter結果は `[]`。これは「今回のsubscription-auth runtimeのmodel/list応答にAstra recordが掲載されなかった」という観測であり、アカウント全体の非対応・CLIの一般仕様・サービス障害の原因までは確定しない。
- 一覧不掲載をgateにせず、同じ同梱CLIへ既知ID `gpt-6-astra` + `low` を直接指定し、隔離ledger/temp、read-only、画像付きの最小turnを1回実施した。`turn/start`段階で400相当の明示拒否を受けた: `invalid_request_error` / `The 'gpt-6-astra' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again.` 本文は保存していない。明示拒否のため第2turn、delta、vision成功確認は実施せず停止した。
- turn probeは既存製品adapterを使い、`forced_login_method="chatgpt"`、approval never、read-only/network disabled、isolated ledger、作業用tempを指定した。session disposeで所有thread cleanupを試み、probe script/temp dirは削除済み。ユーザーのCockpit、既定ledger、auth DB、他のrolloutは触れていない。

## Inference

- 公式APIの `low` を初期 effort候補とする認識は維持できるが、Codex App ServerがAstraについて広告する `supportedReasoningEfforts`/default/modalitiesは今回取得できない。直接turnは0.144.5から「newer version of Codexが必要」と明示拒否された。API広告とApp Server runtime広告、実turn受理を同一視しない。
- 既存adapterのvision/delta構造はAstraでも再利用できる可能性があるが、実turn成功・画像受理・delta順序の証拠ではない。
- 既存のbrain choice保存は未知値を保存し得るが、起動時にregistry検証して既定へfallbackする設計。Astraを追加しても既存値や既定Claudeを移行する必要はない。

## Proposed minimum edits（未実装）

1. `brains.mjs`にAstra entryを追加（ID/label/create/auth path/Chappy identity）。`createCodexSession`へ `gpt-6-astra` と `low` を渡す。
2. `health.mjs`の表示札と`cockpit-server.mjs`のPOST許可値に同じbrain IDを追加。
3. `fire-orchestrator.mjs`/conversation-instruction viewの技術ID配列と、固定4値テスト群をAstra込みに更新。保存キー名や既存defaultは変更しない。
4. 必要最小verificationは registryのexact model/effort、API 200/invalid拒否、instruction round-trip、次accepted Fireでsession再生成、subscription env guard、そしてruntime access回復後の `model/list` → 最大2ターン smoke。vision/deltaは実証時のみ確認する。

## Official baseline

前回の公式調査を再利用する。[GPT-6 Astra Model](https://developers.openai.com/api/docs/models/gpt-6-astra) は `low/medium/high/xhigh/max` と画像入力を記載。[Model guidance](https://developers.openai.com/api/docs/guides/latest-model) は `gpt-6-astra`、`none`非対応、`none`/`minimal`からは`low`開始を記載。[Models](https://developers.openai.com/api/docs/models) は IDとreasoning列挙を記載する。これらはAPI公式事実であり、今回のCodex App Server `model/list`観測とは別レイヤーである。

## Unresolved / user judgment

- Astraを現行subscription-auth CLI 0.144.5の選択肢として公開するには、対応する新しいCodex版の提供条件（CLI更新、アカウント rollout等）の確認が必要。今回の400はCLI版要件を示すが、どの版・いつ利用可能かまでは確定しない。
- 実装するかどうかの製品判断は未承認。既存選択値/defaultを変える必要はない。
