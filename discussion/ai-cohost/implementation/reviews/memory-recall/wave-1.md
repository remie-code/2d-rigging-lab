# 記憶の作り直し Wave 1 レビュー(Review-Sylph・軽め 1 レーン)

> 2026-10-21。対象: 未コミットの作業ツリー(Domain A / B)。基準: memory-recall-wave-plan.md §0・§1、conventions-draft.md。
> 記憶の本文は読んでいない(ファイル名・構造・git log の件数だけ)。コードは変更していない。

## 判定: 合格(ただし Wave 2 完了まで cockpit を起動しない前提。差分 1 を参照)

## テスト件数

- `apps/soul/agent` で `node --test`: 1516 件 全合格(失敗 0)。
- リポジトリルートで `pnpm run check:soul-zone`: 合格(1513 ファイル)。

## 確認できたこと

### Domain A(src/mind/codex-session.mjs)
- MCP の切り離し: 起動引数 `APP_SERVER_ARGS`(features.plugins/apps=false)は `createCodexSession` の唯一の spawn 経路に入っており、①・使い捨てのどちらも同じ。名前ごとの `enabled=false` は `ensureThread` の thread/start で付く(接続ごと 1 回の `config/read`、`initialize()` でも先読み)。サーバーが 0 件なら config は従来と同じ形。`config/read` 失敗は警告のみで続行。
- 既定: `cwd` 省略は従来の一時フォルダ、`sandbox` 省略は read-only、`finalAnswerOnly` 省略は false(全部つなぐ従来の組み立て)。brains.mjs は `create(options)` を素通しにしているので①は変わらない。
- workspace-write: thread/start の `sandbox` と turn/start の `sandboxPolicy`(`turnSandboxPolicy`)が同じ変数から決まり、揃う。cwd も thread/start・turn/start・config/read で同じ `threadCwd`。指定 cwd は dispose で消さない(rmSync は一時フォルダのみ)。画像の一時ファイルと App Server の cwd は一時フォルダのまま。
- finalAnswerOnly: delta と全文の突き合わせは従来どおり全 item に対して行い、そのあとで phase=final_answer だけを選ぶ(無ければ最後の item)。突き合わせの厳しさは落ちていない。
- 通知の捨て: `QUIET_TOOL_NOTIFICATIONS` は圧縮の通知の振り分けの後ろ、turnScoped 判定の前。圧縮の経路は影響を受けない。①はツールを使わないのでこの通知が来ず、警告・診断は従来のまま(既存テスト全合格)。

### Domain B(src/memory/)
- 種 `conventions-seed.md` は conventions-draft.md の本文(「# 記憶の置き場の決まり」〜 §6 末尾)と一致(末尾の空行を除き diff なし)。「たたき台について」の節は入っていない。LF。記憶のフォルダの `_conventions.md` も種と一致。
- `memory-store.mjs`: init 以外の git はすべて `--git-dir`/`--work-tree` 固定。`commitMemoryChanges` は `.git` が無ければ git を呼ばず失敗で返す。GIT_DIR 等の継承環境変数を落とす。execFile で shell なし。全経路が `ok:false` で返り throw しない(try/catch と resolve)。status が空ならコミットしない。`_conventions.md` は `wx` で作るので既存を上書きしない。コミット本文は「役名 日時」のみ。
- 記憶のフォルダ: `_conventions.md`、`_map.md`、`<topic>/_map.md`、`<topic>/<YYYY-MM-DD>[-n].md` の形。トピック 4(本体 2+1+7+3=13)。平置きの古いファイルは無い。追跡ファイル 19(= 1+1+4+13)。git log は 2 件(移し替え前 / 移し替え)、作者 soul、ローカル設定は autocrlf/safecrlf=false。
- プロジェクト側: `apps/soul/agent/.gitignore:41 memories/` で無視。`git status` に memories/ は出ない(`!!`)。

## 差分(要対応 / 注意)

1. **【Wave 2 で必ず消すこと】旧 `loadRecentDigests`(src/mind/memory.mjs)が新しい構造と衝突する。** 直下の `*.md` を名前降順で上位 3 件読む作りのため、今の記憶のフォルダでは直下の `_map.md` と `_conventions.md`(`_` は数字より後ろに並ぶ)が「直近のダイジェスト」として①の固定の指示に搭載される(本体はサブフォルダなので読まれない)。旧 `saveDigest` も直下に `<日時>.md` を書き、記憶の git に未コミットで積もる。Domain C の撤去(起動時の 3 件搭載・saveDigest)で解消するので、Wave 1 のコード修正は不要。修正指針: Wave 2 が済むまで cockpit を実機で起動しない(または Domain C を先にマージ)。Domain C のテストに「直下に `_map.md` があっても搭載されない」ではなく、搭載経路そのものの撤去を確認する項目を入れる。
2. (任意・軽微)Domain A の質問 1 の notify フックは未対応のまま。ユーザーの通知プログラムが①②④の turn ごとに動く可能性がある。切り離すなら `APP_SERVER_ARGS` に `-c notify=[]` を足す形(未確認)。判断は Undine/ユーザー。
3. (任意・軽微)`src/cockpit/quota.mjs` も codex を使うが、今回の `APP_SERVER_ARGS` の対象外(チャッピーのセッションではない)。MCP を起動するなら別件。確認はしていない。

## Wave 2(②)でつなぐときの注意

- ②は `BRAINS[id].create({ systemPrompt, cwd: <記憶のフォルダ絶対パス>, sandbox: "workspace-write", finalAnswerOnly: true })`。`cwd` は絶対パス必須(相対だと TypeError)。`DEFAULT_MEMORY_DIR` は絶対パス(import.meta.url 由来)でそのまま渡せる。
- Claude の頭(llm-session)は cwd/sandbox/finalAnswerOnly を黙って無視する。②の頭が Claude になる設定だと書けない/cwd が違うまま動く。C は ②の頭を Codex に固定するか、Claude のときは起動しないようにすること。
- 順序: `prepareMemoryFolder()`(起動時 1 回。`_conventions.md` を種から置く)→ ②セッション → `commitMemoryChanges({ role: "書き出し役" })`。部品は同時呼び出しに非対応(index.lock)なので、保存の経路(定期・手動・耳の Stop・Ctrl+C)は直列化すること。コミットは dispose 後に呼ぶと ②の rollout 掃除と干渉しない。
- 種の §2 は「同じトピック・同じ日の 2 回目は `-2`」。計画は「同じ配信では同じ本体を更新し続ける」。②に本体のファイル名(日付と `-n`)を魂側で確定して渡さないと、保存のたびに `-2`, `-3` ができうる。C で「今回の配信の本体 = トピック/日付(-n)」を最初の保存時に決めて持ち回る設計にする。
- 種 §5 は ②の書き換え対象を「今回の本体と目次の該当行」としている。新トピックの追加や全体の目次の件数・最後の日付の更新もこの「該当行」に含む解釈になるので、指示文では明示するとよい。
- コミット本文の役名は魂が固定の語を渡す(複数行・空は拒否)。移し替えの 2 件は「移し替え前/移し替え」だが問題なし。
- 親の AGENTS.md: 記憶のフォルダは入れ子の `.git` があるので project root が記憶のフォルダになる想定(Domain A の報告どおり未確認)。②④に渡す指示は systemPrompt と最初の turn に明示的に入れる前提で組む。

## 注記
- Domain A の質問 2(`config/read` 失敗時は警告して続行)は妥当。①を黙らせないためとして問題なし。
- Domain B の質問(コミット本文に日時が付く件、トピック名)は Undine/ユーザー判断。コード上の不具合ではない。
- 実機確認(MCP 0 件)の再現はしていない(本物の頭は起動しない方針)。Gnome の実測表を信頼し、テストと diff で整合だけを見た。
