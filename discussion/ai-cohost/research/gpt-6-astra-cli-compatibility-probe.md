# GPT-6 Astra CLI compatibility probe

調査日: 2026-09-08 (Asia/Tokyo)

目的: 現行 `0.144.5` の明示400（newer Codex required）を受け、公式配布の現在安定版1つを製品依存へ反映せず隔離取得し、Astra `low` のvision + 継続turnを確認する。

## Repository facts

- 現行依存は `apps/soul/agent/package.json:13` の `@openai/codex-sdk: ^0.144.5`、lockfileも0.144.5系列。製品package/lockfile/node_modulesは変更していない。
- 既存adapter `apps/soul/agent/src/mind/codex-session.mjs:574-578,604-606,659-662` は `app-server --stdio`、`forced_login_method="chatgpt"`、read-only/approval never/network disabled、指定model/effortを使用する。画像base64→`localImage` は `:130-152`、delta concatとcompleted/final一致検証は `:482-559`。
- Astraを選択肢へ追加するregistry/UI/API/settings/testの候補箇所は先行報告 [gpt-6-astra-integration-inventory.md](gpt-6-astra-integration-inventory.md) に記載。今回それらは変更していない。

## Package metadata / acquisition facts

`npm view` で取得したnpm registry metadata（配布物の機械事実。OpenAI APIのモデル対応保証ではない）:

| package | version | tarball | integrity |
|---|---:|---|---|
| `@openai/codex` | `0.153.4` | `https://registry.npmjs.org/@openai/codex/-/codex-0.153.4.tgz` | `sha512-wbHDmit7S/YvBGVX1DQmk13xtWblZ2cApeJ/pB7xDZ10Cna+DZc5ij7f0F4OxdsXN4FW1oLT48OpogUI1+8Y2w==` |
| `@openai/codex` Windows x64 variant | `0.153.4-win32-x64` | `https://registry.npmjs.org/@openai/codex/-/codex-0.153.4-win32-x64.tgz` | `sha512-lMkB43kJZH0VFr+hoXc11qqR7QtQIbkr07ALgj4urKL1osNyUyuy1iXd3Vzz2iCYvBUCSw7I0l/W1cEPGx9euQ==` |

0.153.4 Windows x64 tarballを隔離tempへ `npm pack --ignore-scripts` で取得し展開。実行物 `codex.exe --version` は `codex-cli 0.153.4`。公式配布ページの一般案内は [Codex CLI docs](https://developers.openai.com/codex/cli) を参照（配布版の選択はnpm registry metadataによる）。

## Runtime observations

- 使用経路: 既存 `createCodexSession` に `codexPath` のみ隔離展開済み0.153.4を指定。`model="gpt-6-astra"`, `effort="low"`、subscription-auth env guard、`forced_login_method="chatgpt"`、approval never、read-only/network disabled。cwdとledgerは一時dir、既定ledgerは不使用。
- 入力は自作の1×1 PNG base64（ユーザー画面/既存権利物ではない）と短文。本文・nonce回答は保存せず、イベント件数/文字数/elapsedだけ記録。
- Turn 1（画像付きvision）: `completed=true`, `deltaCount=1`, `deltaChars=1`, `elapsedMs=7696`。adapterのdelta蓄積がcompleted item/finalと一致して正常完了した（不一致ならadapterが例外化する）。
- Turn 2（同thread、短い合成nonceを参照する継続）: `completed=true`, `deltaCount=5`, `deltaChars=11`, `elapsedMs=5319`。同thread継続とdelta受信は成功。nonceの意味内容を本文保存せず、回答が期待nonceを含んだかは判定していないため、意味的記憶の証明ではない。
- 0.144.5での同条件直接turnは先行報告どおり `invalid_request_error` / “requires a newer version of Codex” の400。0.153.4ではこの拒否は再現せず、Astra low turnを2回完了できた。
- cleanup: probe script、展開tarball、展開先、作業cwd/ledgerは削除済み。adapterのdisposeは所有thread cleanupを実行。cleanupの残留thread/DBエラーは観測していない。Cockpit稼働プロセス、auth DB、ユーザー画面、既定ledger、他rolloutは触れていない。

## Inference / boundaries

- 0.153.4は、このsubscription-auth環境でAstra `low` の画像付きturnと同thread継続を実際に受理した限定証拠を提供する。ただし「Astraの最小対応版」が0.153.4であることや、他アカウント/他platformでの可用性までは証明しない。0.144.5は明示的に新しいCodexを要求したため、少なくとも現行版は不可。
- delta初到達はTurn1で1件、Turn2で5件。これはこの2サンプルのイベント観測であり、全応答の一般的な粒度/TTFT保証ではない。
- vision受理は合成画像1枚の1ターン成功に限る。モデル一覧広告でなく、実turn成功に基づく観測である。

## Proposed minimum update (not implemented)

1. `@openai/codex-sdk`と解決されるplatform binaryを、対応版として0.153.4系列へ更新（package/lockfileの整合を同時に取る）。今回のprobeは製品node_modulesを更新していない。
2. `brains.mjs`にAstra registry entry（ID/label/`gpt-6-astra`/`low`/Chappy identity）を追加し、既存のchoice/defaultを変更しない。
3. 先行inventoryの固定UI/API/instruction ID/test箇所へ同じbrain IDを追加。既存adapterのvision/delta経路は再利用可能だが、対応版へ更新後に最小verificationを再実行する。
4. 必要最小verification: registry exact model/effort、subscription-auth guard、API 200/invalid拒否、実Astra画像turn、同thread第2turn、delta concat/final一致、次accepted Fireでのsession再生成。

## Unresolved

- 0.153.4が公式npm registry上の現在安定版であることはmetadata取得時点の事実だが、ChatGPT/Codex Appの配布経路・アカウントrollout・将来の対応版条件は未確認。
- 実turnはプロトコル完了と画像入力受理を確認したが、本文を保存していないためnonceの意味的記憶、一語回答の内容、品質は未確認。
- 製品依存更新とAstra選択肢追加はユーザー承認済み作業の別工程であり、この調査では実施していない。
