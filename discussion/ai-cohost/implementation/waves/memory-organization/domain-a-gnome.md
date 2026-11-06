# 記憶の整理 Domain A — Gnome の報告

> 2026-11-04。ブランチ `ai-cohost/memory-organization`(切り替えなし・コミットなし)。根拠: wave plan §1・§2、設計 organization.md §4・§6「始める前」、コード棚 §1・§4・§5。

## 機械ゲート

- `apps/soul/agent` で `node --test`: **2341 / 2341 pass**(fail 0。着手前の土台は 2320)。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1628 files scanned)。
- `git status` / `git diff --stat`: 変えたのは下の 17 ファイルだけ。依存・lockfile の変更なし。`pnpm install` 等は走らせていない。
- 操縦席は起動していない。本物の LLM・外部 API は呼んでいない。git を使うテストは OS の一時フォルダ(`mkdtemp`)だけで、後片付けあり。実データ(`memories/`・`roles/` など・`.env*`)は読んでいない。

## 変えたファイル(すべて `apps/soul/agent/` 以下)

本体:
- `src/memory/memory-store.mjs` — git の口 3 つと純関数 `parseNameStatusZ` を足した。`prepareMemoryFolder` が `_conventions.md` だけをコミットするようにした。頭書きを更新。
- `src/mind/memory.mjs` — `resolveStreamRecordBaseName`・`findStreamRecordFiles`・`createStreamRecordIdentity`・`topicDirs` を外した。`isMemoryBodyPath`・`createStreamRecordLog` を足した。`buildWriterRequest`・`detectWriterMiss`・`writeStreamRecord` を書き直した。頭書きを更新。
- `scripts/cockpit.mjs` — 許された所だけ変えた: import、`RoleMemoryPlace` の typedef、`createRoleMemoryPlaces` の JSDoc・中身(`streamRecord`)、writer の `record: place.streamRecord`。
- `src/memory/conventions-seed.md` — 24 行目の該当の文だけ。
- `src/mind/fixtures/stream-wording-pin-expected.mjs` — `writer.request.new`・`writer.request.existing` の中の 2 行を手で置き換え(コードの出力から作り直していない)。頭書きに例外の 1 行。

テスト:
- `src/memory/memory-store.test.mjs`、`src/mind/memory.test.mjs`(ほぼ書き直し)、`src/mind/memory-garble.test.mjs`
- `scripts/cockpit.test.mjs`、`scripts/cockpit-stream.test.mjs`、`scripts/cockpit-discord-f.test.mjs`、`scripts/cockpit-role-edit.test.mjs`
- 呼び出すだけのテスト(`baseName` を外しただけ): `src/mind/wording-discord-c.test.mjs`(`writeStreamRecord` の record も持ち回りにした)、`src/mind/wording-discord-f.test.mjs`、`src/mind/venue-events-discord-j.test.mjs`、`src/mind/speaker-shape-discord-a.test.mjs`、`src/cockpit/cockpit-server-discord-j.test.mjs`
- `src/mind/fixtures/stream-wording-pin-calls.mjs` は触っていない(使われない `baseName` が残る)。

## export した git の口(`src/memory/memory-store.mjs`)

どれも throw しない。`dir` は必須。`.git` が無ければ git を呼ばずに `{ ok:false, error }`(error は git の短い説明)。`pinnedGitArgs` で固定。`GitOptions` = `{ gitPath?, timeoutMs? }`。

```js
readCommitChangedFiles({ dir, commit = "HEAD", ...GitOptions })
  // → { ok: true, files: Array<{ status: string; path: string }> } | { ok: false, error }
  // git diff-tree --root -r --name-status -z --no-renames --no-commit-id <commit> --
  // commit は checkCommitTarget の縛り(HEAD か 16 進)。パスは根からの相対・区切り "/"・-z なので日本語もそのまま。
readMemoryHead({ dir, ...GitOptions })
  // → { ok: true, head: string | null } | { ok: false, error }
  // rev-parse --verify --quiet HEAD^{commit}。終了コード 1 のときは symbolic-ref --quiet HEAD が通れば null(まだコミットが無い)。
discardUncommittedChanges({ dir, ...GitOptions })
  // → { ok: true } | { ok: false, error }
  // reset --hard --quiet HEAD → clean -f -d --quiet --(-x なし = .gitignore されたものは残す)。HEAD が無ければ何もせず { ok: true }。
parseNameStatusZ(output)   // 純関数。R…/C… が来たら新しい側のパス(--no-renames なので普通は来ない)。
PREPARE_COMMIT_ROLE = "魂"
```

`PrepareResult` の ok 側に `committedConventions: boolean` を足した。

## 持ち回りの API(`src/mind/memory.mjs`)

```js
isMemoryBodyPath(path)  // ファイル名(最後の "/" の後ろ)が ".md" で終わり "_" で始まらなければ true。深さは問わない。大文字の ".MD" は本体でない。
createStreamRecordLog({ startedAtMs })
  // → Readonly<{ dateJst: string; files(): string[]; note(paths: ReadonlyArray<string>): void }>
  // dateJst = formatJstDate(startedAtMs)。files() は写しを返し、重なりなし・最初に見た順。note は本体でないもの・文字列でないものを捨てる。
```

- `writeStreamRecord({ record, ..., changedFilesImpl, discardImpl })`。record は上の持ち回りで、`dateJst`・`files()`・`note()` が無ければ TypeError。
- 流れ: 引数の確かめ → `existingFiles = record.files()` で頼みを組む → `discardImpl({ dir })` を 1 回(失敗なら警告してそのまま書く) → 各回の②とコミット → 化けの確かめ → そのコミットが HEAD に残っていれば `changedFilesImpl({ dir, commit })` の `A`・`M` の本体を `record.note()` → (ask が失敗していればここで throw) → 書き損じの判定。
- HEAD に残るコミット: 化けて取り消せた回は除く。取り消しに失敗した回と、ask が失敗した回は含む。
- cockpit: `createRoleMemoryPlaces` の差し替え口は `createIdentityImpl` から **`createRecordLogImpl({ startedAtMs })`** に名前を変えた(`dir` は渡さない)。

## 書き損じの判定(`detectWriterMiss`)

毎回同じ決まりで見る。
- `commit.ok === false` → 書けたとみなす。
- `committed:false` → 書き損じ。
- 積まれたが、そのコミットに本体の `A`・`M` が 0 → 書き損じ。
- ファイルの一覧が読めない → 書けたとみなす。このとき固定の警告を 1 つ出す(下)。

やり直しは今どおり、化けと合わせて 1 回まで。前からある警告の定数は変えていない。

## 新しい警告(どちらも英語の固定の 1 行。中身・名前・id・git の stderr は入れない)

- `WRITER_CHANGED_FILES_FAILED_WARNING` = `memory: could not read the writer's commit to see which records it wrote; keeping it as written`
- `WRITER_DISCARD_FAILED_WARNING` = `memory: could not discard uncommitted changes before the writer; writing anyway`

## 文面

- `buildWriterRequest({ transcriptText, dateJst, existingFiles, wording })`。ファイル名の行と前回分の行は、plan の 40・42 行目と機械で突き合わせて一致を確かめた。日付の行・手順・材料の行と行の並びは変えていない。
- `stream-wording-pin.test.mjs` は 36/36 pass。④の pin とほかの場の語の pin は変えていない。
- 種は 24 行目の文だけ「同じ日付の本体が、どのトピックのどの棚(年と月のフォルダ)にあっても、次の番号を付けます」に変えた。括弧は種のほかの所と同じ半角。

## 足したテスト(主なもの)

- git の口: ルートのコミット・入れ子のフォルダ・日本語の名前・変更・削除・ハッシュ指定。移したファイルが D と A に分かれる。HEAD がまだ無いときは null。discard では、追跡済みの変更・index の変更・index に足しただけの新しいファイル・消した追跡済みが戻り、追跡外のファイルとフォルダが消え、`.gitignore` されたファイルとフォルダが残り、先頭は動かない。HEAD が無ければ何もしない。入口の止め方と git が無いとき。
- prepare: 置いた種だけをコミットする(本文は `^魂 <JST>$`・ほかの追跡外は残る)。前の形の未コミットの種もそれだけをコミットする(index に足した別のファイルは入れない)。HEAD に入っていれば、変えてあってもコミットしない。コミットに失敗したら `ok:false`(pre-commit フックで再現)。
- writeStreamRecord(本物の git): ②より前に捨てる(追跡外が消え、追跡済みが戻り、書きかけはコミットに混ざらない)。1 回目のファイルを 2 回目の頼みに載せる。2 回目に別のトピックへ足した本体も足し、3 回目の頼みに両方載る。`deep-topic/2026/11/…` も書いたと数える。`_map.md` だけのコミットは書き損じとしてやり直す。
- writeStreamRecord(偽物): 捨てるのに失敗しても警告して書く(throw も同じ)。捨てるのは 1 回だけ。一覧が読めなければ書けたとみなして警告する。D・T・目次は足さない。ask が失敗した回のファイルも throw の前に足す。
- garble(本物の git): 取り消した回のファイルは足さず、やり直しの回のファイルだけ足す。取り消しに失敗した回のファイルは足す。
- cockpit: 持ち回りは本物の `createStreamRecordLog` で、ロールごと・場ごとに別。場の中でロールを戻すと同じもの。`beginStream` で捨てる。日付は場の始まりの日本時間(日をまたぐと翌日)。

## 裁量で決めたこと

1. **種のコミット(Orch-Sylph の決定の形)**: `_conventions.md` があって HEAD の木に無ければ、`add -- _conventions.md` → `commit -m "魂 <JST>" -- _conventions.md`。index に足してある別のファイルは入れない。HEAD の木にあるかは `ls-tree --name-only -z HEAD -- _conventions.md` で見る(HEAD が無ければ「無い」)。失敗は `{ ok:false, error }`(`git add _conventions.md:` / `git commit _conventions.md:` / `git ls-tree:` / `git rev-parse:` で始まる)。`PREPARE_COMMIT_ROLE` として export した。
2. `PrepareResult` に `committedConventions` を足した。
3. 一覧が読めないときは、警告を出す方にした(`WRITER_CHANGED_FILES_FAILED_WARNING`)。
4. 差し替え口の名前は `createRecordLogImpl` にし、`dir` は渡さない。
5. 消えた本体(`D`)は持ち回りから外さない(足さないだけ)。
6. `readMemoryHead` は終了コード 1 のあと `symbolic-ref` で「まだコミットが無い」を確かめる(ほかの失敗と取り違えないため)。
7. `discardUncommittedChanges` の中では `readMemoryHead` を先に呼ぶ。HEAD が読めなければ失敗で返す。
8. `note()` も本体かどうかを確かめ直す(防御)。
9. 頭書きから、`writeStreamRecord` の「限界: まだコミットしていない種も一緒に取り消される」の注記を外した(捨てると種のコミットで起きなくなったため)。

## 残るリスク

- **cockpit.mjs の古いコメント**: 範囲外なので残した。`main` の中(2706〜2709 行付近「本体のファイル名を最初の保存で一度だけ決めて持ち回る」、3194 行付近)と、`createStreamVenueHooks` の JSDoc(1101 行付近)。`src/cockpit/cockpit-server.mjs` の 778・2959 行付近にも「記憶の本体のファイル名」が残る。動きには関わらない。
- **持ち回りの名前が古くなる**: この場で書いた本体を、同じ場の②が別の名前・場所に動かすと(`D`+`A`)、files() に古いパスが残り、次の頼みに載る。
- **捨てるのは強い**: 人が手で直してまだコミットしていない変更(`_conventions.md` を含む)も、次の書き出しの前に消える。設計 §6 の前提(記憶はチャッピーしか書かない)どおり。`.gitignore` されたものは残る。
- **失敗の説明に名前が載りうる**: `{ ok:false, error }` の error は、前からの口と同じく git の stderr の最初の行を含む。ファイル名が載ることがある(例: `git reset` の unlink の失敗)。writer 側の警告は固定文なので出ない。prepare の error は `onPrepareFailed` に渡る(前からの道)。
- **本物のチャッピーの置き場の初回**: 本物の `_conventions.md` は前に書き出し役のコミットで入っているはずなので、コミットは起きないと見ている。実物は読んでいない。

## 質問

1. cockpit.mjs の `main` の中・`createStreamVenueHooks` の JSDoc と、cockpit-server.mjs の古い「本体のファイル名」のコメントを、どこかのドメイン(C?)で直すか。今回は範囲外として残した。
2. 同じ場の中で、前の保存で書いた本体が消えた・動いた(`D`)とき、持ち回りから外すか。今は spec どおり足さないだけで、外してはいない。
3. `stream-wording-pin-calls.mjs` に、使われない `baseName` 引数が残っている。消すか(指示どおり触っていない)。
