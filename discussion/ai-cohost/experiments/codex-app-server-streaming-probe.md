# Codex App Server streaming probe

- 実施日: 2026-08-30（Asia/Tokyo）
- 目的: 現行製品が実際に解決するCodex CLI 0.144.5の同梱実行物をApp Serverとしてstdio JSONL起動し、画像付き `gpt-5.6-sol` / `low` ターンで `item/agentMessage/delta` が完了前に届くかを確認する。
- 実行物: `apps/soul/agent/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`（`@openai/codex` / `@openai/codex-sdk` 0.144.5が解決する同梱実行物）。別CLIのインストール・更新はしていない。
- 基準仕様: [Codex App Server公式仕様](https://learn.chatgpt.com/docs/app-server)。同仕様はstdio JSONL、`item/agentMessage/delta`、`item/completed`、`localImage`、`thread/delete`等を定義している。
- 秘密・本文: account identifier、token、quota絶対値、prompt本文、response本文は本レポートへ保存していない。

## Official facts（実験の前提となる公式事実）

[App Server公式仕様](https://learn.chatgpt.com/docs/app-server) は、`codex app-server`をstdio（既定）またはWebSocketで起動し、JSON-RPCの通知を読む方式を定義する。ThreadはTurnを持ち、Turn中に`item/started`、`item/completed`、`item/agentMessage/delta`等が流れる。`agentMessage`は蓄積されたreplyで、`item/agentMessage/delta`はstreamed textを追加するイベント、`item/completed`はItemの確定イベントである。

同仕様のTurn inputには、`{type: "text"}`、`{type: "image", url}`、`{type: "localImage", path}`がある。また、`turn/start`ではmodel、effort、approval policy、sandbox policy等を指定できる。

同仕様の`model/list`例には`gpt-5.6-sol`、`inputModalities: ["text", "image"]`、`defaultReasoningEffort: "low"`がある。ただし、これは仕様例であり、各アカウントのruntime応答は別途観測した。

## Actual environment facts（今回の実行環境）

- `codex.exe --version` は `codex-cli 0.144.5` を返した。
- App Serverを同じ`codex.exe app-server --stdio`で起動し、`initialize` → `initialized`を成功させた。initialize応答のCLI user agentにも0.144.5が含まれていた。
- `account/read`はChatGPT managed accountを示した。plan名・メールアドレス・識別子は保存していない。
- `account/rateLimits/read`は成功した。rate limitの絶対値、reset時刻、credit残高は保存していない。
- `model/list`の実アカウント応答で`gpt-5.6-sol`を確認した。`inputModalities`は`["text", "image"]`、`defaultReasoningEffort`は`low`、supported reasoning effortsは`low`, `medium`, `high`, `xhigh`, `max`, `ultra`だった。`none`はsupported一覧に含まれなかった。
- `none`は一覧非対応だったため、追加の`none`成功ターンまたはvalidationターンは実行していない。従って成功ターン数はlowの1回のみ。
- 実験起動時はCLI config overrideでweb searchをdisabledにし、Turnは`approvalPolicy: never`、read-only sandbox、`networkAccess: false`を指定した。ファイル変更、Web search、tool callは観測されなかった。
- 画像はrepository-ownedの`apps/editor/build/icon-source.png`を`localImage`として1枚渡した。

## Experiment results

### Run 1（low、PTY取得制約あり）

### 実行条件

- model: `gpt-5.6-sol`
- effort: `low`
- approval policy: `never`
- sandbox: read-only（runtime応答ではreadOnly、networkAccess false）
- input: 同一の短い日本語prompt + 上記local image。画像に触れ、句点`。`で終わる自然な複数文を十分な長さで返すよう依頼した。本文は保存していない。
- 成功: `turn/completed` status `completed`

### 安全な観測値

stdout/tool transportには大量のdelta本文が含まれ得るため、本稿には本文を再掲しない。観測したイベント順は次のとおり。

`turn/started` → user message `item/started` / `item/completed` → agent message `item/started` → 複数の `item/agentMessage/delta` → agent message `item/completed` → `turn/completed`

| 指標 | 観測結果 |
|---|---|
| `item/agentMessage/delta` の発生 | **あり**。agent message completedより前に多数発生 |
| 最初のdelta | **agent message `item/started`の後、`item/completed`の前** |
| 最初の安全な日本語文境界 | **`item/completed`より前のdelta列中に観測**（未完了angle tagなしの`。！？`判定） |
| agent message completed | あり。最終snapshotのUTF-16長は582 |
| turn completed | あり。serverの`durationMs`は13044 |
| tool/web/file change | 観測なし |
| 画像入力 | `localImage` user itemがstarted/completed。受理された |

### delta数・連結一致・時刻の扱い

今回の実行はPTYでApp Serverを動かした。PTYの一回の読み出しをツールが上限で切り詰め、中間delta列の一部が欠落したため、以下は**未測定**とする。

- deltaの正確な総数。保存されたツール出力から確実に再取得できたのは少なくとも99イベントだが、これは総数ではなく下限であり、採用値にしない。
- 全deltaを順序appendした文字列と、completed agentMessage textとの完全一致。欠落した中間deltaを含む全列がないため、`false`とは判定しない。
- 最初のdeltaおよび最初の安全な文境界の正確なmonotonic elapsedと、`item/completed`/`turn/completed`に対する先行ミリ秒。App Serverのdelta payload自体にtimestampはなく、今回のPTY読み出し単位では個々の受信時刻を取得できなかった。

従ってRun 1で確実に言える技術的成立は、**同じ同梱CLIのApp Serverが、画像付き`gpt-5.6-sol` / `low` Turnで、完了前に`item/agentMessage/delta`を発行した**ことまでである。delta concat完全一致や先行秒数は、このRun 1の取得制約により判定保留とする。

### Run 2（low、stdio pipe lossless collector）

Run 1と同じ画像・同じ日本語prompt・同じ`gpt-5.6-sol` / `low`条件で、同梱CLIを`stdio: [pipe, pipe, pipe]`で起動したNode collectorを用いて1成功ターンだけ追試した。App Server childのraw stdout/stderr、prompt、delta本文、response本文はcollectorの外へ出していない。ネットワークを無効化したread-only sandbox、`approvalPolicy: never`で実行し、web/tool/file changeは観測しなかった。

collectorは各JSONL lineのNode `performance.now()`受信時刻を記録し、`item/agentMessage/delta`をitemごとに順序appendした。安全な文境界は未完了angle tag内を除外し、`。！？`の最初の出現で判定した。完成itemの本文自体は保存せず、collector内でのみ連結一致を比較した。

| 指標 | Run 2 観測値 |
|---|---:|
| turn status | `completed` |
| agent message item数 | 1（最終発話item） |
| `item/agentMessage/delta` 総数 | 450 |
| delta UTF-16累積長 | 566 |
| completed text UTF-16長 | 566 |
| 順序appendとcompleted textの完全一致 | **true** |
| 最初のdelta elapsed | 15088 ms |
| 最初の安全な文境界 elapsed | 16031 ms |
| agent message `item/completed` elapsed | 25140 ms |
| `turn/completed` elapsed | 25216 ms |
| 安全な文境界の先行 | 9109 ms（item completed比） |
| 最初のdeltaの先行 | 10053 ms（item completed比） |

イベント観測は、`turn/started`、user itemの開始・完了、agent item開始、450件の`item/agentMessage/delta`、agent item完了、`turn/completed`の順だった。App Server公式仕様どおり、deltaはcompleted前に届き、今回のlossless collectorでは連結一致も成立した。

| 条件 | delta数 | concat一致 | first delta | first safe boundary | item completed | turn completed | safe-boundary lead |
|---|---:|---|---:|---:|---:|---:|---:|
| Run 2 `low` | 450 | true | 15088 ms | 16031 ms | 25140 ms | 25216 ms | 9109 ms |
| `none` | 未実行 | — | — | — | — | — | — |

`none`は実アカウントの`model/list`でsupported一覧に含まれなかったため、ユーザー指定どおり試していない。Run 2は1サンプルであり、性能優劣や一般的な先行時間を断定しない。

## Cleanup result

- 成功Turnに使用した正確なthread IDに対し、公式`thread/delete`を送った。
- App Serverは削除処理中に`no such table: agent_jobs`というdatabase errorを返した。これはmetadata削除の成功確認ではない。
- ただし、threadのstatusは`notLoaded`となり、App Serverが返したrollout pathのファイルは削除後に存在しなかった。
- 正確なrollout path、`session_index.jsonl`、model cache、thread history等をread-only確認し、実験thread IDの残存matchは確認されなかった。確認出力へID・本文は保存していない。
- App Server child processはCtrl-Cで終了した。実験用コードファイル・一時物は作成していない。

Run 2でも、完了したTurnの正確なthread IDに対して公式`thread/delete`を送った。応答はRun 1と同じ`no such table: agent_jobs` database errorで、metadata削除の成功確認にはならなかった。Run 2のthread/start応答からrollout pathを取得できなかったため、Run 2固有のrollout消失とthread検索残存は確認不能として扱う。Run 2のApp Server child processはcollector終了時にSIGTERMで終了した。実験用コードファイル・一時物は作成していない。

追試後のprivacy cleanupでは、read-onlyでCodex sessions/rollout metadata、session index、thread一覧を照合した。直前collectorの正確なthread IDに完全一致する永続rolloutまたはmetadataを安全に再特定できなかったため、推測による削除は行っていない。Run 2について追加で削除した内容はなく、metadataのDB直接編集もしていない。

cleanupの総合判定は、Run 1については**rolloutは消失確認、metadataはApp ServerのDB errorにより未確認**、Run 2については**thread/deleteを実行したが同じDB errorとなり、rollout/thread残存を確認不能**である。削除エラーを隠して成功扱いにはしない。

## Inference（実験結果からの推論）

- 現行SDKが内部で使うCodex CLI 0.144.5と同じ実行物でも、App Server protocolでは、今回の画像付きSol/low pathでcompleted前のagent text deltaを受け取れた。SDK `runStreamed()`の今回の実測（別レポート）と同じ挙動になるとは限らない。
- Run 2では完了前delta、完成本文との完全concat一致、first safe boundaryのitem完了に対する9109 ms先行を同一collectorで観測した。このため、今回の実験条件に限れば、外部TTSへ渡す前段の候補データをcompletion前に得られた。
- ただし、deltaのreplacement/retry規則、長文・別入力・再接続・Turn steer時の挙動、一般的な性能や安定性は確定しない。先行時間はRun 2の1サンプルである。
- これは経路の観測結果であり、SDK `runStreamed()`からApp Serverへ移行すべきという設計判断を意味しない。

## Unknowns（未確認事項）

- Run 2以外の条件でのApp Server delta総数、completed textとのUTF-16長・hash・完全一致。
- Run 2のthread/deleteが返した`agent_jobs` table errorの原因と、metadataがどの内部DBに残り得るか。Run 2のrollout消失・thread検索残存（正確なIDを再特定できず、追加確認不能）。
- tool call、安全性処理、長文、別画像、再接続、Turn steer時のdelta挙動。
- `none`は今回の実アカウントの`model/list`で非対応だったため、App Serverが別条件で受理する可能性は確認していない。
