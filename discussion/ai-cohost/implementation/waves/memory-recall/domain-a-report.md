# 記憶の作り直し Wave 1 / Domain A — 頭のセッションの役ごとの設定と MCP の切り離し 完了報告

> Gnome → Undine(2026-10-21)。計画: [../../orchestration/memory-recall-wave-plan.md](../../orchestration/memory-recall-wave-plan.md) §1 Domain A。コミットはしていない。
> 実機は Codex 0.163.0(同梱 codex.exe)、gpt-5.6-terra / effort none。会話はダミー文だけ。

## 1. 変更ファイル

- `apps/soul/agent/src/mind/codex-session.mjs` — MCP の切り離し、役ごとの設定(`cwd` / `sandbox` / `finalAnswerOnly`)、ツールの通知を黙って捨てる。
- `apps/soul/agent/src/mind/codex-session.test.mjs` — 偽物の App Server に `config/read` の応答を足した。テストを 11 件追加(27 → 38)。

brains.mjs は変えていない。Codex の行はもとから `{ ...options, model, effort }` で options を素通しにしているので、`cwd` / `sandbox` / `finalAnswerOnly` はそのまま届く。memory.mjs・scripts/cockpit.mjs・cockpit-server.mjs・memories/ には触れていない。

## 2. MCP の切り離し

### 2.1 実機で試した書き方(thread/start まで。turn なし。`mcpServer/startupStatus/updated` の件数)

| 上書き | 結果 |
|---|---|
| なし(今まで) | 8 件。node_repl・blender(config.toml の `[mcp_servers]`)、codex_apps(ChatGPT のコネクタ)、cua_repl(computer-use プラグイン) |
| `-c mcp_servers={}` | 10 件。消えない。`-c` は表に混ぜるだけ |
| `-c mcp_servers=[]` / `=false` | App Server が起動エラー(`invalid type ... expected a map`) |
| `--disable plugins --disable apps` | 4 件。codex_apps と cua_repl は消える。node_repl と blender が残る |
| `-c mcp_servers.<名前>.enabled=false` を 2 つ | 4 件。node_repl と blender は消える。codex_apps と cua_repl が残る |
| thread/start の `config: { mcp_servers: {} }` | 4 件。消えない |
| **起動時 `-c features.plugins=false -c features.apps=false` + thread/start の `config.mcp_servers.<名前> = { enabled: false }`(名前は `config/read` で読む)** | **0 件** |

「`-c` で一覧を空にする」1 行の書き方は無かった。そこで、次の 2 段にした(どちらも名前を決め打ちしない)。

1. 起動引数 `APP_SERVER_ARGS` に `-c features.plugins=false`・`-c features.apps=false` を足す。
2. 接続ごとに 1 回、`config/read { includeLayers:false, cwd: thread の cwd }` で実効の設定を読み、`mcp_servers` の**名前だけ**を取り出す。thread/start の `config.mcp_servers` に `{ <名前>: { enabled: false } }` を入れる。サーバーが 1 つも無ければ、config は今までと同じ形のまま。`initialize()` でも先に読むので、最初の ask では待たない。

専用の CODEX_HOME には回していない(ログイン情報の扱いはそのまま)。

### 2.2 実装後の実機確認(`createCodexSession` を本物で 3 本)

| セッション | MCP の起動通知 | 結果 |
|---|---|---|
| ① 既定(一時フォルダ・read-only) | 0 件 | 返事は正常。agentMessage は 1 件(phase=final_answer) |
| ④ 相当(cwd=一時の記憶フォルダ、read-only、finalAnswerOnly) | 0 件 | commandExecution 2 件で読み、1 行の要約を返した。ファイルは変わらない。所要 約 35 秒(後片付けを含む) |
| ② 相当(cwd=一時の記憶フォルダ、workspace-write、finalAnswerOnly) | 0 件 | 本体を新規作成し、目次に 1 行足した。返事はファイル名だけ。所要 約 41 秒(後片付けを含む) |

- どれも承認要求は 0 件。dispose で thread/delete と rollout の削除まで済み、残った rollout は 0。試験フォルダ(OS の temp 配下)は消した。台帳は試験用の一時ファイルを使った(リポジトリの `codex-rollouts.local.json` には書いていない)。
- 調査用に thread/start だけ行った thread は、すべて thread/delete 済み(turn なしなので rollout はできていない)。

### 2.3 ユーザー設定から引き継いでいる他の項目(切り離すかは判断していない)

`config/read` と各 list の結果。値は出していない(名前・件数・種類だけ)。

| 項目 | 状態 |
|---|---|
| `notify` | 設定あり(2 要素の配列)。turn が終わるたびにユーザーの通知プログラムが動くはず【推測・実際に動いたかは見ていない】。`-c notify=[]` で上書きできる見込み【未確認】 |
| `[windows] sandbox` | `"unelevated"` が効いている |
| skills | プラグインを止めた後も 5 件残る(imagegen・openai-docs・review-agent・skill-creator・skill-installer。同梱のもの)。止める前は 13 件 |
| `~/.codex/AGENTS.md` | ファイルはあるが 0 バイト(今は中身なし。書かれれば全セッションに入る) |
| `~/.codex/rules/default.rules` | あり(コマンドの許可ルール。approval=never なので影響は小さいはず【推測】) |
| `shell_environment_policy.set` | 環境変数 1 つを、頭が動かすシェルに足す設定がある |
| `model` / `model_reasoning_effort` / `service_tier` | ユーザーの既定がある。model と effort は魂が毎回上書きする。service_tier は上書きしていない |
| `features` | `js_repl=false`・`memories=false` などのユーザー指定が効く |
| `projects.*.trust_level` | 多数。記憶のフォルダは載っていない |
| hooks | 0 件 |
| `[plugins]` 12 件・`[marketplaces]` 2 件 | `features.plugins=false` で、インストール済みの一覧ごと空になる |

ほかに、実機で毎回来る「未対応の通知」の警告(①にも前からある): `remoteControl/status/changed`・`account/updated`・`thread/started`・`thread/status/changed`(×3)。④相当では `skills/changed`(×2)も来た。ツールの通知ではないので、今回は黙らせていない。

## 3. 役ごとの設定の API(`createCodexSession(options)`。brains の Codex の行の `create(options)` でも同じ)

| option | 既定 | 中身 |
|---|---|---|
| `cwd` | 使い捨ての一時フォルダ(今までどおり) | 絶対パス。thread/start・turn/start・`config/read` の cwd に渡す。**指定したフォルダは dispose で消さない**。画像の一時ファイルと App Server のプロセスの cwd は、指定があっても一時フォルダのまま(記憶のフォルダを汚さない) |
| `sandbox` | `"read-only"` | `"read-only"` か `"workspace-write"`。thread/start の `sandbox` と turn/start の `sandboxPolicy` を揃える(workspace-write は `{ type:"workspaceWrite", writableRoots:[], networkAccess:false, excludeTmpdirEnvVar:false, excludeSlashTmp:false }` で、実機の thread/start 応答の実効値と同じ形)。approval は常に never |
| `finalAnswerOnly` | `false` | true なら、replyText を phase=`final_answer` の agentMessage だけでつなぐ。無ければ最後の agentMessage を答えにする。false は今までどおり全部をつなぐ。`onTextDelta` には前置きも含めて全部流れる |

- 誤り(sandbox が上の 2 つ以外、cwd が絶対パスでない)は、プロセスを起こす前に TypeError。
- 公開した名前: `SANDBOX_MODES`、`APP_SERVER_ARGS`、`mcpServerDisableOverrides(configReadResult)`。
- 例(②): `BRAINS[id].create({ systemPrompt, cwd: memoryDir, sandbox: "workspace-write", finalAnswerOnly: true })`。

## 4. phase の実測

- ツールを使う turn(④相当・②相当)では、agentMessage が `["commentary", "final_answer"]` の順に来た。
- ツールを使わない turn(①)では、`["final_answer"]` の 1 件だった。
- 型(MessagePhase)には `partial_answer` もある。また「出さない頭もある(null は不明扱い)」と書かれている。finalAnswerOnly で phase が 1 つも無いときに最後の agentMessage を使うのは、そのための保険。

## 5. ツールの通知

次の通知は「未対応の通知」の警告を出さずに捨てる: `turn/diff/updated`・`turn/plan/updated`・`item/plan/delta`・`item/commandExecution/outputDelta`・`item/commandExecution/terminalInteraction`・`item/fileChange/outputDelta`・`item/fileChange/patchUpdated`・`item/mcpToolCall/progress`・`serverRequest/resolved`。commandExecution / fileChange の item/started・item/completed は、もとから agentMessage 以外として黙って捨てている。実機の ②④相当で、ツール由来の警告は 0 件だった。①は、この種の通知が来ないので変わらない。

## 6. テスト

- `apps/soul/agent` で `node --test`: 1516 件すべて合格(codex-session.test.mjs は 38 件で、うち 11 件が今回の追加)。
- リポジトリのルートで `pnpm run check:soul-zone`: 合格。
- 追加したテストで固定したこと:
  - 起動引数
  - 既定の thread/turn が今と同じこと(一時フォルダ・read-only・never、MCP が無いときの config の形、dispose で一時フォルダを消す)
  - `[mcp_servers]` を名前ごとに止めること。`config/read` は接続ごとに 1 回で、thread を作り直しても読み直さず、接続を作り直したら読み直す
  - `config/read` が失敗したときに警告を 1 回出して続けること
  - 役の cwd と workspace-write を thread/turn の両方に渡すこと。役の cwd を消さず、画像は一時フォルダに置くこと
  - cwd だけを指定したときは read-only のままであること
  - 設定の誤りで TypeError になること
  - finalAnswerOnly の組み立て(phase あり / なし)と、既定の組み立て。どちらでもツールの通知が警告にならないこと

## 7. 裁量で決めたこと

1. **MCP を止める方法**: 「起動時の `-c` 1 行」では空にできなかったので、`-c` 2 つと、thread/start での名前ごとの無効化を組み合わせた。名前は決め打ちせず、毎回の接続で `config/read` から読む(ユーザーがサーバーを足しても効く)。
2. **`config/read` が失敗したとき**: 会話を止めず、警告を出して続ける(MCP が起動しうる)。①が黙るのを避けるため。止める方に倒すべきなら変える。
3. **ツールの通知は全部のセッションで黙らせた**: ①にはこの種の通知が来ないので、振る舞いは変わらない。推論の通知(`item/reasoning/*`)は今回の対象外として残した。
4. **finalAnswerOnly はセッション単位**: ask ごとには指定できない。②④は使い捨てのセッションなので、これで足りると判断した。

## 8. 残リスク

- **Claude の頭は役の設定を黙って無視する**(`createLlmSession` は `cwd` / `sandbox` / `finalAnswerOnly` を読まない)。②④は当面 Codex という前提。
- workspace-write の `excludeTmpdirEnvVar:false` / `excludeSlashTmp:false` は、実機の既定の実効値に合わせたもの。TEMP への書き込みは塞がない。cwd の外への書き込みを Windows の unelevated sandbox が常に塞ぐかは、前の棚卸しどおり未確定。
- 記憶のフォルダには入れ子の `.git` がある。Codex が project root の判定に `.git` を使うと、親リポジトリの AGENTS.md は読まれないはず【推測・未確認】。②④の指示の届き方は Domain C・D の実機で見るのがよい。
- App Server の版が上がって `config/read` の形が変わると、名前が読めずに MCP が起動しうる。その場合は警告が出る。

## 9. 質問

1. ユーザー設定の `notify` フック(turn ごとに動くはず)を、チャッピーのセッションでも切り離すか。切り離すなら、`-c notify=[]` を足す形の見込み(未確認なので、決まれば実機で確かめる)。
2. `config/read` が失敗したときは、今の「警告して続ける」でよいか。
