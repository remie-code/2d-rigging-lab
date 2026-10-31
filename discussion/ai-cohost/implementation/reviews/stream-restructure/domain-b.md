# 実装レビュー: 配信の組み直し Domain B(記憶をロールごとに)— 1 回目

Review-Sylph → Orch-Sylph(2026-10-31)。対象: ブランチ `ai-cohost/stream-restructure`、`git diff 38084596` + 未追跡の `src/memory/memory-migration.mjs` / `.test.mjs`(パスは `apps/soul/agent/` 起点)。Gnome の報告 [domain-b-gnome.md](../../waves/stream-restructure/domain-b-gnome.md) は参考にしただけで、差分・対象ファイル・テストを自分で確かめた。

## 判定: **pass**(止めた指摘 0)

escalate 候補が 1 つ(下の「裁量の評価」の A)。判定は pass のまま、Undine の確認を 1 つ依頼したい。

## テスト

- `apps/soul/agent` で `node --test`: **1758 pass / 0 fail / 0 cancelled / 0 skipped**(Gnome の報告と一致)。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1560 source files scanned)。
- 参考(機械ゲートには含まれない): `pnpm run typecheck:root` を走らせ、差分に関わるファイル(`scripts/cockpit.mjs`・`src/memory/*`・`src/roles/*`・`src/mind/memory.mjs`)に型エラーは出なかった。

## 確かめたこと(必ず確かめる 1〜6)

1. **機械ゲート**: 上のとおり。
2. **文面が差分に入っていない**: `git diff 38084596 --stat` の変更は 10 ファイル(Undine の wave-plan を含む)。`src/mind/recall.mjs`(④の指示)・`src/memory/conventions-seed.md`(種)・判定の文面のファイルは差分に無い(`git diff 38084596 --stat -- src/mind/ src/memory/conventions-seed.md` は `src/mind/memory.mjs` と `memory.test.mjs` だけ)。`src/mind/memory.mjs` の差分の中身は、(a) import から `DEFAULT_MEMORY_DIR` を外す、(b) `writeStreamRecord` の `dir` の既定を外して無ければ TypeError、(c) JSDoc の `dir` の説明、の 3 つだけ。`WRITER_SYSTEM_PROMPT`・`buildWriterRequest` などの文面の定数・テンプレート文字列は一字も動いていない。種の差し替えは `conventionsSeedForName`(読み込んだ種の文字列を split/join する純関数)で、種のファイルは読むだけ。チャッピーは「チャッピー」→「チャッピー」で同一になる(テストで固定)。
3. **実データ**: テストは `mkdtempSync(tmpdir())` の一時フォルダだけ(`memory-migration.test.mjs`)。`cockpit.test.mjs` の `main()` の結線テストはソースの文字列の読み取りだけで `main()` は走らない。既存テストの期待値の変更なし(`-` 行は import の差し替えのみ)。`apps/soul/agent/roles/`・`apps/soul/agent/tmp/restructure-backups/`・`apps/soul/agent/memories.migrating-*` は存在しない(存在だけを確かめた・中身は開いていない)。私自身も実データ・操縦席・`.env*.local` には触れていない。
4. **引っ越しの安全**(`src/memory/memory-migration.mjs` とテスト):
   - 写しが先: `migrateMemoriesToRole` は `backupMemories`(cpSync・`.git` ごと・上書きしない)に成功してから最初の `renameSync` に進む(L178〜L183)。**写しが取れなければ移さない**(テスト「写しが取れなければ移さない」・元の形のまま)。
   - 2 回目は何もしない: `memories/chappy/` があれば skipped で写しも取らない(テスト 2 本目・写しのフォルダが作られないことまで固定)。
   - 履歴が残る: 本物の git(2 コミット)から移し、同じ HEAD・同じコミット数・作業ツリー clean・チャッピーの `_conventions.md` が一字不変。移したあとも `prepareMemoryFolder` が冪等でコミットが積める。写しにも同じ HEAD。
   - 条件が `roles/` の有無と独立: `runStartupMigration`(`src/roles/role-migration.mjs`)は設定の分と記憶の分を別々に判定する。`roles/` がすでにある起動でも記憶の分は移す・seeded の起動でも記憶の分はそれだけで判定する・記憶の分が失敗しても設定の分は進む、がテストで固定されている。写しのフォルダは `migrationBackup` 定数として 1 つを共有(`cockpit.mjs` の `main()`)。
   - 途中失敗の戻し・止まった残りの続き・決められない残り(2 つ以上/直下にも記録/chappy もある)のテストも有る。`.gitignore` の `/memories.migrating-*/` は `git check-ignore -v` で効くことを確かめた。
5. **別ロールのフォルダに書かないか**: 書かない。`createMemoryRecorder` は保存を頼んだ時点で `getPlace()`(= そのときのロールの置き場)を取り、`writeImpl(entries, place)` が `place.dir` と `place.streamRecord` を使う(`cockpit.mjs` の②の結線)。待っている保存と置き場が違う頼みは合流させず並べる(`place === last.place` の比較・置き場はロールごとにキャッシュされた凍結オブジェクト)。②は `place.dir`、④は今のロールの `place.dir`。`DEFAULT_MEMORY_DIR` は `main()` で「引っ越し」と「`createRoleMemoryPlaces` の根」の 2 か所だけで使われ、記憶の 4 か所(準備・本体のファイル名・②・④)からは消えている(grep で確認)。`prepareMemoryFolder` / `commitMemoryChanges` / `writeStreamRecord` / `runRecall` は `dir` が無ければ失敗で返す/投げるので、省略して根へ書く道は残っていない。テストで走っている保存・待っている保存・違う置き場が固定されている。
6. **依存・lockfile**: `package.json`・`pnpm-lock.yaml` の差分なし。テストは偽の create と本物の git だけで、本物の LLM・外部 API は呼ばない。

### Codex の git の根(設計 §9)

テスト(`memory-migration.test.mjs` 末尾)で、一時フォルダに外側のリポジトリを `git init` し、その中に記憶の根を置く入れ子で、引っ越した `memories/chappy/`・そのトピックのフォルダ・新規の `memories/cody/` を cwd に `git rev-parse --show-toplevel` を呼ぶと、いずれもロールのフォルダが返る(対照の `.git` 無しのフォルダは外側の根が返る)。`GIT_*` の継承環境変数は落としてある。**確かめられない部分**(Codex App Server 本体が cwd から上へ AGENTS.md や根をどこまで探すか)は人間ゲートへ。Gnome の報告 §4 の見方(②④が `memories/<role-id>/` を作業フォルダにして動いたとき、プロジェクトの AGENTS.md の影響が出ていないか)で足りる。

### Domain C〜E に手を出していないか

差分は `scripts/cockpit.mjs` の記憶の結線・`createMemoryRecorder`・`createRoleMemoryPlaces`・`onSetRole` の準備、記憶の部品、引っ越し、`.gitignore` だけ。体なし・場・タブには触れていない。

## 止めた指摘

なし。

## 持ち越し(止めない指摘)

1. **`onSetRole` が置き場の準備を待つ**(`cockpit.mjs`、`await memoryPlaces.place()?.ready`): 新しいロールの初回は `git init` + 種の書き込みの間、`POST /api/role` の応答が待たされる(通常は数百 ms)。`prepareMemoryFolder` は git にタイムアウトを持つので固まりはしない。気になるなら待たずに裏で準備する案(根拠は無いので好みの範囲)。
2. **件数の数え方**(裁量 5): `_` で始まらない `.md` を数える。目次(`_map.md`)や決まりを数えないのは筋が通る。ただし「何回分」ではなくファイル数なので、表示文は「記録 N 件」のまま誤解は小さい。
3. **古い文書の記述**: Gnome の報告 §7 のとおり、`memory-store.mjs` 冒頭の「上位文書」や `recall-flow.md` の「`memories/_map.md`」など、`memories/` 直下を前提にした書き方が残る。Undine / 後の文書整理で直す。
4. **Windows の予約名**(Domain A の持ち越し 2): `memoryDirForRole` は id の形だけ通す。`con` などの扱いは Domain E のロールを作る画面で。
5. **`lastRecordAtMs` / `lastRecordedSeq` がプロセスに 1 つ**: Domain D(場)で場ごとに作り直すときに合わせて決める(Gnome の持ち越しと同じ)。
6. **続きの処理の写しの重複**: 前の起動が 2 の後で止まったとき、写しは今回の起動の写しのフォルダに取り直す。前の写しとの二重は残る(安全側。容量だけの話)。
7. **記憶が大きいときの写し**: `cpSync` は同期でメインスレッドを塞ぐ。起動時の 1 回だけなので現状は許容。

## 裁量の評価(Gnome 報告 §5 を一つずつ)

筋が通る(設計に無い所を、設計の趣旨の範囲で最小に決めている):

- **§5-1 ロールごとの置き場の表(`createRoleMemoryPlaces`)**: 設計 §2.3「ロールのフォルダが置き場」から素直。ロールを戻したときに前の置き場(同じ本体のファイル名)を使うのは Gnome の質問 2。場(Domain D)で作り直す前提のつなぎとして妥当。**質問 2 への回答: 可**。
- **§5-2 置き場も頼んだ時点で取る**: 設計 §2.3「ほかのロールのフォルダに書けない」を満たす最小の形。
- **§5-3 「直下に記録がある」の判定(`.git` のフォルダか `.md`)**: 設計 §2.4「`memories/` の直下に記録がある」の具体化。前の形は起動のたびに `.git` と `_conventions.md` を置いていたので取り違えない。desktop.ini を数えない点も筋が通る。
- **§5-4 前の形とロールのフォルダの混在は失敗で返す**: 普通の流れでは起きない。上書きより安全。
- **§5-6 移し方**(写し → 作業用へ rename → 作り直し → chappy へ rename・失敗は元へ戻す・止まった残りは次の起動で続き): 「自分の子へ親は rename できない」への妥当な解で、`.git` をコピーせず rename で移すので履歴が確実に残る。
- **§5-8 chappy があって直下にも記録が残るときは触らず知らせる**: 設計の条件どおり。
- **§5-9 種の差し替え**: 設計 §2.3 どおり。呼び名は Domain A の `name.canonical`。使えない呼び名は種のまま、は安全側。
- **§5-10 `dir` の既定を外す**: 根に git を作る事故を防ぐ。設計の趣旨と合う。`DEFAULT_MEMORY_DIR` の値は変えず意味を「根」にしたのも、既存テストを壊さない最小の判断。
- **§5-11 表示**: 設計 §2.4 の「移した記録の件数、写しの置き場」に合う。どちらかの分が失敗したら全部の行を WARN にする拡張も自然。

### escalate 候補(Undine の判断が欲しい 1 件)

**A. 記憶の引っ越しが失敗した起動では、記憶を読み書きしない(Gnome の質問 1・§5-7)**。設計 §2.4 に「記憶の引っ越しが失敗したら」の扱いは書かれていない(設計に無い判断の分岐)。Gnome の選択は「配信は止めず、どのロールのフォルダも作らず、②は警告・④は失敗として係に返る。表示に『今回は記憶を読み書きしない』を出す。次の起動でもう一度確かめる」。取り違え(前の形の記録が残る根の中にロールのフォルダや `.git` を作って、次の起動の判定が狂う)を避ける理由は筋が通り、データも壊さない。Domain A の設定の分が失敗しても起動を続ける流儀とも合う。私の見立ては「この形でよい」。ただ計画 §4 の「設計に書いていない判断の分岐は止めて Undine に上げる」に当たりうるので、Undine に「失敗した起動は記憶なしで配信を続ける」で確定してよいか、1 点だけ確認してほしい。別案(起動を止める/前の形のまま記録する)は、前者は配信が出ない、後者は次の起動の引っ越し条件が崩れる(根にコミットが積まれる)ので、勧めない。Domain B のコードが変わるのは、確認の結果が「別案」だった場合だけ。

## 質問

1. 上の escalate 候補 A(記憶の引っ越しが失敗した起動の扱い)を Undine へ。
2. Gnome の質問 2(ロールを戻したときに前に作った置き場と同じ本体のファイル名)は、Domain D までのつなぎとして**可**と評価した。Undine の追認が要るなら A と一緒に。
3. 人間ゲートに回す項目: (a) 引っ越しの表示に件数と写しの置き場が出ること、(b) 初回の起動前に `memories/` を Explorer やエディタで開いていないこと(Windows の rename 失敗の回避)、(c) Codex の頭が `memories/<role-id>/` を作業フォルダにして動いたときの AGENTS.md の影響の有無。
