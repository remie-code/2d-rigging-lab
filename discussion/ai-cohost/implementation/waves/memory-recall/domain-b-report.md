# 記憶の作り直し Wave 1 / Domain B — 記憶の置き場の種・git の部品・8 件の移し替え 完了報告

> Gnome → Undine(2026-10-21)。計画: [../../orchestration/memory-recall-wave-plan.md](../../orchestration/memory-recall-wave-plan.md) §1 Domain B。プロジェクトのリポジトリにはコミットしていない。記憶のフォルダの git には 2 回コミットした(§4)。
> この報告には記憶の中身の要約・引用を書かない(件数・トピック名・日付だけ)。

## 1. 変更ファイル(すべて新規)

- `apps/soul/agent/src/memory/conventions-seed.md` — `_conventions.md` の種。conventions-draft.md の「本文」の節(`# 記憶の置き場の決まり` 〜 §6 の末尾)をそのまま。「たたき台について」の節と区切りの `---` は入れていない。LF。
- `apps/soul/agent/src/memory/memory-store.mjs` — 記憶のフォルダの準備と git の部品。
- `apps/soul/agent/src/memory/memory-store.test.mjs` — テスト 16 件。

memory.mjs・scripts/cockpit.mjs・cockpit-server.mjs・src/mind/ には触れていない。実データは `apps/soul/agent/memories/`(プロジェクトの .gitignore 対象)のみ。

## 2. 部品の API(`src/memory/memory-store.mjs`)

| 名前 | 中身 |
|---|---|
| `DEFAULT_MEMORY_DIR` | `apps/soul/agent/memories/`(memory.mjs の `DEFAULT_MEMORIES_DIR` と同じ場所) |
| `CONVENTIONS_SEED_PATH` / `CONVENTIONS_FILE_NAME` | 種のパス / `"_conventions.md"` |
| `MEMORY_GIT_USER_NAME` / `MEMORY_GIT_USER_EMAIL` | `"soul"` / `"soul@memory.invalid"` |
| `prepareMemoryFolder({ dir?, seedPath?, gitPath?, timeoutMs? })` | → `{ ok: true, dir, createdDir, initializedGit, seededConventions }` または `{ ok: false, dir, error }`。冪等。フォルダが無ければ作る → `.git` が無ければ `git init` → ローカル設定(user.name / user.email / `core.autocrlf=false` / `core.safecrlf=false`。毎回入れ直す)→ `_conventions.md` が無ければ種を LF にそろえて置く(`wx` で作るので、あれば触らない) |
| `commitMemoryChanges({ dir?, role, at?, gitPath?, timeoutMs? })` | → `{ ok: true, committed: false }`(変更なし)/ `{ ok: true, committed: true, commit: <sha> }` / `{ ok: false, error }`。`status --porcelain --untracked-files=all` が空なら何もしない。あれば `add --all` → `commit -m "<役名> <YYYY-MM-DD HH:MM:SS +09:00>"`。役名は空・複数行を拒否 |
| `buildCommitMessage(role, at)` / `formatJst(at)` | 本文を組む純関数 / 日本時間の整形 |
| `pinnedGitArgs(dir, args)` | `--git-dir=<dir>/.git --work-tree=<dir>` を前に付ける |

守っていること:

- **throw しない**。git が無い(ENOENT)・非 0 終了・タイムアウト(既定 30 秒)・フォルダが作れない・種が読めない、はすべて `ok: false` で返す。error は「段階: 理由 (git の stderr の 1 行目)」だけで、記憶の中身は入れない。
- git は `execFile` で呼ぶ(シェルを通さない)。`GIT_TERMINAL_PROMPT=0`、継承した `GIT_DIR` / `GIT_WORK_TREE` / `GIT_INDEX_FILE` 等は落とす。
- **親リポジトリを巻き込まない**: 記憶のフォルダはプロジェクトのリポジトリの中にあるため、init 以外の git はすべて `--git-dir` / `--work-tree` で記憶のフォルダに固定する。コミットは `<dir>/.git` が無ければ git を呼ばずに失敗で返す。
- コミットの本文は役名と日時だけ。ファイル名・差分は書かない。フックは飛ばさない(`--no-verify` なし)、署名の設定も触らない(ユーザーの global に gpgsign は無いことを確認済み)。

## 3. テスト

- `node --test src/memory/memory-store.test.mjs`: 16 件すべて緑(OS の temp 配下で実際に git を動かす。ネット不要。固定値は無害な文字列のみ)。
  - 準備: 作成・init・ローカル設定・種(LF)/ 2 回呼んでも同じ / 既存の `_conventions.md` を上書きしない / 既存の `.git` とコミットを残す
  - コミット: 全部コミットし本文は役名と日時だけ(作者が soul、CRLF がそのまま残る)/ 変更なしでコミットしない / 削除も含める / `.git` 無しは git を呼ばず失敗 / 役名が空・複数行で失敗
  - 失敗: git が無い(準備・コミットとも)/ 壊れた `.git` / フォルダが作れない / 種が読めない — いずれも throw しない
  - 種が draft の本文であること、`formatJst` の日付またぎ
- `apps/soul/agent` で `node --test`: 1505 件すべて緑。
- リポジトリルートで `pnpm run check:soul-zone`: 緑(1513 ファイル)。
- プロジェクト側の `git status`: `?? apps/soul/agent/src/memory/` のみ。`memories/` は無視(`!!`)のまま出ない。

## 4. 移し替えの結果

- 準備: 既存のフォルダに対して `prepareMemoryFolder` を実行(init・ローカル設定・種の配置)。
- 1 回目のコミット: 今の 8 件だけ(本文「移し替え前 <日時>」)。
- 2 回目のコミット: 置き直し・目次・`_conventions.md`(本文「移し替え <日時>」)。その後の再実行は `committed: false`。
- 記憶のフォルダの `git log --oneline`: **2 行**。作者は `soul <soul@memory.invalid>`。

置き直した形(本体 13 件。元の箇条 61 個は、並べ替えて比べて元と完全に一致することを確かめた):

| トピック | 本体の数 | 日付(日本時間) |
|---|---|---|
| `arknights` | 2 | 2026-10-18, 2026-10-20 |
| `arknights-endfield` | 1 | 2026-10-17 |
| `cohost-dev` | 7 | 2026-08-30, 2026-08-30-2, 2026-09-08, 2026-09-13, 2026-10-17, 2026-10-18, 2026-10-18-2 |
| `live2d-editor` | 3 | 2026-08-30, 2026-09-08, 2026-09-13 |

- 分割: **あり**。8 件中 5 件を 2 つに分けた(2026-08-30 の 1 回目、2026-09-08、2026-09-13、2026-10-17、2026-10-18 の 2 回目)。分け方は箇条の単位で、元の順のまま置いた。分けなかったのは 3 件。
- 目次: 全体の `_map.md`(4 行)と各トピックの `_map.md`(計 13 行)。決まりどおり、リンク・件数/日付・一言だけで、中身は書いていない。
- 本体の文章は書き換えていない。各本体の末尾に改行を 1 つそろえた以外、元の区切り(箇条間の空行の有無)も元のファイルのまま。本体に見出しは足していない。
- 視聴者の名前: 全件を読み、敬称・`@`・コメント周りも検索して確かめた。**視聴者のハンドル名は無く、置き換えは 0 件**。

## 5. 裁量判断

1. 種の置き場は `apps/soul/agent/src/memory/conventions-seed.md`(部品の隣)。
2. ダミーのメールは `soul@memory.invalid`(`.invalid` は使われないことが保証されたドメイン)。
3. 改行は `core.autocrlf=false` に加えて `core.safecrlf=false`。種はプロジェクト側のチェックアウトで CRLF になりうるので、置くときに LF にそろえる。
4. 1 回目のコミットを「8 件そのまま」にするため、準備で置かれた `_conventions.md` を一時的にフォルダの外へ退かしてからコミットし、戻した(`_conventions.md` は 2 回目のコミットに入る)。使い捨ての手順はスクラッチ領域に置き、リポジトリには入れていない。
5. 移し替えのコミット本文は、部品の形式に合わせて「移し替え前 <日時>」「移し替え <日時>」(役名の位置に「移し替え前」「移し替え」を入れた)。
6. トピックの切り方: ゲームは `arknights` と `arknights-endfield` を分けた。ゲーム以外は、相方 AI 自体の開発・動作確認(`cohost-dev`)と、自作の 2D モデリングエディター(`live2d-editor`)の 2 つにした。ゲームの配信の中で相方の仕組みだけを話した箇条は `cohost-dev` に分けた(思い出し役が「相方の改造の話」を探すとき、ゲームの記録を読まなくても届くように)。同じ日の 2 回目は、起動の早い方を無印、遅い方を `-2` にした。
7. 2026-10-18 の 1 回目(動作確認の回)にある「次のアークナイツ配信の予定」の箇条は、分けると `arknights/2026-10-18.md` が予告の 1 箇条になり、本物の読み配信が `-2` になってしまうため、分けずに `cohost-dev` に置いた。
8. 全体の目次の一言には、トピックの範囲(何がここに入るか)だけを書いた。トピックの目次の一言に、やり残し(次はどこから)は入れていない(draft のメモどおり未決のため)。

## 6. 残るリスク

- 「`.git` があるか」は `existsSync` だけで見ている。`.git` が壊れているときは git が失敗し、`ok: false` で返る(テストで固定)。
- 部品は同時に 2 つ呼ばれることを想定していない(git の index.lock がぶつかると片方が `ok: false`)。呼ぶ側(Wave 2 の②の後)で直列にする想定。
- ユーザーの global 設定にフックのパスや署名が今後入ると、記憶のコミットにも効く(今は無い)。

## 7. 質問

1. 移し替えのコミット本文に日時が付いている(「移し替え前 2026-10-21 18:56:58 +09:00」)。本文を「移し替え前」だけにしたい場合は、記憶の git で本文を直す(履歴の書き換え)必要がある。このままでよいか。
2. トピック `cohost-dev` / `live2d-editor` の名前と、ゲームの配信から相方の仕組みの箇条を分けた方針でよいか。②は今後、全体の目次を見て同じトピックを使うので、ここで決めた名前が引き継がれる。
