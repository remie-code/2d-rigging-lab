# 配信の組み直し Domain B — 記憶をロールごとに 完了報告

Gnome → Orch-Sylph(2026-10-31)。計画 [stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain B。ブランチ `ai-cohost/stream-restructure`(38084596 の上)。**コミットはしていない(stage もしていない)。**
実データには触れていない: `apps/soul/agent/cockpit-settings.local.json`(と `.bak*`)・`apps/soul/agent/memories/`・`apps/soul/agent/roles/`・`.env*.local` は読んでいない・書いていない・動かしていない。操縦席は起動していない(`scripts/cockpit.mjs` は `node --check` と、テストからの import と文字列の読み取りだけ。`main()` は走らない)。テストは全て OS temp のフォルダだけを使う。作業後に `apps/soul/agent/roles/`・`apps/soul/agent/tmp/restructure-backups/`・`apps/soul/agent/memories.migrating-*` が無いことを確かめた。依存・lockfile は変えていない。`discussion/.../stream-restructure-wave-plan.md` の変更は作業前からあったもの(触っていない)。

## 1. 変えたファイル

パスは `apps/soul/agent/` 起点。

| ファイル | 新規/変更 | 要点 |
|---|---|---|
| `src/memory/memory-migration.mjs` | 新規 | 起動時の引っ越し(記憶の分)。`migrateMemoriesToRole({ memoriesDir, backupDir, roleId = "chappy" })`(置き場を引数に取る・投げない)。「直下に記録がある」の判定 `inspectMemoryRoot`、件数 `countMemoryRecords`、途中で止まった残り `findMemoryMigrationLeftovers`、表示 `formatMemoryMigrationReport`。写し → `memories/` を隣の `memories.migrating-<pid>/` へ rename → `memories/` を作り直す → 作業用を `memories/chappy/` へ rename。3・4 の失敗はその場で元へ戻す。落ちた残りは次の起動で続きをする |
| `src/memory/memory-migration.test.mjs` | 新規 | 10 件(本物の git。§3) |
| `src/memory/memory-store.mjs` | 変更 | `DEFAULT_MEMORY_DIR` を「記憶の根(ロールのフォルダを並べる所)」と注記。`memoryDirForRole(root, roleId)`(ロールの id の形だけ通す)。`CONVENTIONS_SEED_NAME = "チャッピー"`・`conventionsSeedForName(seed, soulName)`(名前だけ差し替える純関数・split/join)。`prepareMemoryFolder` に `soulName`(無い `_conventions.md` を差し替えた種で書く)。`prepareMemoryFolder` / `commitMemoryChanges` は `dir` を省略できない(省略は git を呼ばずに失敗で返す) |
| `src/memory/memory-store.test.mjs` | 変更(追加のみ) | 4 件 |
| `src/mind/memory.mjs` | 変更 | `writeStreamRecord` の `dir` の既定(`DEFAULT_MEMORY_DIR`)を外し、無ければ TypeError(②を作る前)。**②の指示・頼みの本文は変えていない** |
| `src/mind/memory.test.mjs` | 変更(追加のみ) | 1 件 |
| `src/roles/role-migration.mjs` | 変更 | `runStartupMigration({ rolesDir, settingsPath, memoriesDir, backupDir })`(設定の分 → 記憶の分・写しのフォルダを共有・条件は独立)と `formatStartupMigrationReport`(設定の分の行 + 記憶の分の行)。冒頭の注記 |
| `src/roles/role-migration.test.mjs` | 変更(追加のみ) | 4 件 |
| `scripts/cockpit.mjs` | 変更 | `createRoleMemoryPlaces`(新規 export・記憶の置き場を今のロールに付いていかせる)。`createMemoryRecorder` に `getPlace`(置き場を保存を頼んだ時点で取る・置き場が違う頼みは合流させずに並べる)。`main()`: 写しのフォルダを `migrationBackup` 定数に上げて `runStartupMigration` に渡す → 表示 → `createRoleMemoryPlaces` → 起動時に今のロールの置き場を準備(await)。`onSetRole` で替えたロールの置き場を準備(await)。②は頼んだ時点の置き場の `dir` と本体のファイル名、④は今のロールの置き場の `dir`。記憶の 4 か所から `DEFAULT_MEMORY_DIR` が消えた |
| `scripts/cockpit.test.mjs` | 変更(追加のみ) | 7 件 |
| `.gitignore` | 変更 | `/memories.migrating-*/`(記憶の引っ越しの作業用。Domain A の `/roles.migrating-*/` と同じ流儀) |

`src/memory/conventions-seed.md`・`src/mind/recall.mjs`(④の指示)・`src/mind/memory.mjs` の `WRITER_SYSTEM_PROMPT` / `buildWriterRequest`・判定の文面(speak-now / comment-react)は差分に入っていない(`git status` で確かめた)。

## 2. 期待値を変えた既存テスト

**なし。** 既存テストは 1 件も書き換えていない(テストファイルの変更は import の追加と末尾への追加だけ)。`createMemoryRecorder` の既存 7 件は `getPlace` を渡さない形(置き場は undefined で 1 つ = 今まで通り)のまま通る。`memory-store.test.mjs` の「`DEFAULT_MEMORY_DIR` は `apps/soul/agent/memories` を指す」も、定数の値を変えていない(意味を「根」にした)のでそのまま通る。

## 3. テスト結果

- `apps/soul/agent` で `node --test`: **1758 pass / 0 fail / 0 cancelled / 0 skipped**(作業前の基準 1732 pass を確かめてから始めた。+26)。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1560 source files scanned)。
- 足したテスト(約束の分):
  - 記憶の引っ越し(本物の git・`memory-migration.test.mjs`): 前の形(今の部品で準備 → 記録をコミット 2 回)から `memories/chappy/` へ移り、**履歴が残る**(同じ HEAD・同じコミット数・作業ツリー clean・チャッピーの `_conventions.md` が一字も変わらない)/**写しがある**(写しのフォルダの `memories/` に `.git` ごと・同じ HEAD)/件数 3/根にはロールのフォルダだけ/移したあとも準備・コミットが使える。**2 回目は何もしない**(写しも取らない)。前の形が無ければ何もしない(根が無い・空・新しい形でロールのフォルダだけ・`.git` の無いロールのフォルダ・desktop.ini)。chappy があれば前の形が残っていても触らない(知らせる)。写しが取れなければ移さない(元の形のまま・上書きもしない)。前の形とロールのフォルダが混ざっていたら移さない。途中で止まった残りの続き(写しを取ってから)。決められない残り(2 つ以上・直下にも記録・chappy もある)。件数と判定の純関数。Codex の git の根(§4)。
  - 1 つの流れ(`role-migration.test.mjs`): 設定と記憶を移して写しは 1 つのフォルダ(設定ファイルと `memories/`)・表示に「記録 1 件」と写しの置き場・2 回目はどちらも何もしない。**`roles/` がすでにある起動でも記憶の分は移す**(設定の写しは取らない・記憶の写しは取る)。**seeded の起動でも記憶の分はそれだけで判定**(記憶だけ前の形 → migrated、何も無い → skipped で写しのフォルダも作らない)。記憶の分が失敗しても設定の分は進む。
  - 種の差し替え(`memory-store.test.mjs`): 種の「チャッピー」だけが呼び名に替わる(戻せば種と同じ・`$&` を解釈しない・使えない呼び名は種のまま)。`prepareMemoryFolder` の `soulName` で、こーでぃーのフォルダは「コーディ」の種・チャッピーのフォルダは種と同じ文面・既にある `_conventions.md` は触らない・**種のファイルの sha256 が前後で同じ**。記憶の根に git を作らない。`dir` が無ければ失敗で返す。`memoryDirForRole` の形の確かめ。
  - ②(`memory.test.mjs`): `dir` が無ければ TypeError で②を作らない。
  - 結線(`cockpit.test.mjs`): 保存の係が置き場を頼んだ時点で取る(走っている・待っている保存は、あとでロールが替わっても前のロールの置き場へ・置き場の違う頼みは合流しない・同じ置き場は合流・直列のまま)。`getPlace` が投げたら null。`createRoleMemoryPlaces` がロールごとに 1 回だけ置き場を作り(`memories/<role-id>/`・呼び名の種・本体のファイル名)、戻したロールは前の置き場、`available: false` で何もしない、準備の失敗は `onPrepareFailed`。本物の git で、ロールごとのフォルダと `.git` ができ根には git が無く、新しいロール(ミオ)の種は呼び名に差し替わる。`main()` の結線(写しのフォルダの共有・引っ越し → 置き場の作成 → 準備の順・`dir: DEFAULT_MEMORY_DIR` が無い・②④が置き場の `dir`・`onSetRole` が替えたロールの置き場を準備)。
- 本物の LLM・外部 API は呼んでいない(②④は偽物の create)。

## 4. Codex の git の根の確かめ(設計 §9)

- **テストで確かめた範囲**(`memory-migration.test.mjs`「Codex の git の根」): 一時フォルダに外側のリポジトリ(プロジェクトの代わり)を `git init` し、その中に記憶の根を置く入れ子を作った。引っ越した `memories/chappy/`・その下のトピックのフォルダ・新しく準備した `memories/cody/` を cwd にして `git rev-parse --show-toplevel` を呼ぶと、**どれもロールのフォルダが返った**(外側まで上がらない)。対照として、`.git` の無い `memories/plain/` からは外側のリポジトリが返った(止まっているのは `.git` があるため)。継承の `GIT_*` 環境変数は落として呼んだ。
- **人間ゲートの確認に回す部分**: Codex の頭(App Server)が実際に cwd から上へ根を探すときの探し方が `git rev-parse` と同じか(AGENTS.md などをどこまで上がって読むか、`.git` で止まるか)は、本物の Codex でしか確かめられない。人間ゲートで②④が `memories/chappy/` を作業フォルダにして動いたとき、プロジェクトの AGENTS.md の影響が出ていないか(②が記憶のフォルダの外を読もうとしない・書き出しが今まで通り)を見てほしい。

## 5. 裁量(設計に無いことを決めた所)

1. **ロールの切り替えと記憶の置き場**: `createRoleMemoryPlaces` がロールの id ごとに置き場(フォルダ・準備の promise・本体のファイル名)を 1 回だけ作って持ち回る。起動時に今のロールの置き場を作って準備を待ち、`onSetRole` で替えたロールの置き場を作って準備を待つ(git init・種はそこで済む)。ロールを戻したときは前の置き場(同じ本体のファイル名)を使う。今までの「1 起動 1 本体」をロールごとにした最小の形で、場ごとの作り直しは Domain D に残した。
2. **走っている/積まれた保存の置き場**: 保存の係(`createMemoryRecorder`)が、材料と同じく**置き場も頼んだ時点で取る**(`getPlace`)。置き場の違う頼みは待っている 1 件に合流させず後ろに並べ、置き場ごとに順に走らせる(直列は保つ)。②の `dir` と本体のファイル名は、その頼みの置き場のものを使う。これで「保存の引き金のときのロールと違うロールのフォルダに書かない」(設計 §2.3)。②の頭(Codex の選び方)は走る時点の今の頭のまま(フォルダには関係しない)。④は今のロールの置き場(場の途中でロールは替えられないので、思い出しの頼みの時点のロールと同じ)。
3. **「直下に記録がある」の判定**: 記憶の根の直下に `.git` のフォルダか `.md` のファイル(`_conventions.md`・`_map.md`・古いダイジェスト)があること。前の形は起動のたびに `.git` と `_conventions.md` を置いていた。新しい形の根にはロールのフォルダしか並ばないので、引っ越しのあとや、こーでぃーだけ使っている根(chappy が無い)を前の形と取り違えない。`.md` でないファイル(desktop.ini など)は数えない。
4. **前の形とロールのフォルダが混ざっているとき**(ロールの id の名前で `.git` を持つフォルダが直下にある): どちらの記憶か決められないので移さずに失敗で返す。普通の流れでは起きない(引っ越しが失敗した起動では、ロールのフォルダを作らないため。下の 7)。
5. **「移した記録の件数」**: 移したものの中の `.md` のファイルのうち名前が `_` で始まらないもの(回ごとの本体・古いダイジェスト。目次と決まりは数えない。`.git` の中は見ない)。人が「何回分の記録を移したか」と読める数にした。
6. **移し方**: 写し(`cpSync`・`.git` ごと・上書きしない)→ `memories/` を `memories.migrating-<pid>/` へ rename → `memories/` を作り直す → 作業用を `memories/chappy/` へ rename。写しが取れなければ移さない。最初の rename の失敗は何も動いていない。3・4 の失敗はその場で元へ戻す(作り直した空の `memories/` を消して作業用を戻す)。戻せずに止まったら作業用が残り、次の起動で「chappy が無く残りが 1 つだけ・根に前の形の記録も無い」ときだけ、写しを取り直して続きをする(前の起動の写しの置き場はこのプロセスからは分からないため)。決められない残りは失敗で返して置き場を表示する。作業用の名前は `.gitignore` の `/memories.migrating-*/` で無視される(§6 の check-ignore)。
7. **記憶の引っ越しが失敗した起動**: 記憶を読み書きしない(`createRoleMemoryPlaces` の `available: false`。どのロールのフォルダも準備しない・保存は「memory folder is not available」で警告・④は失敗として係に返る)。前の形の記録が残る根の中にロールのフォルダや git を作ると、次の起動で「chappy が無い」の条件や中身の取り違えが起きるため。設定の分は進む(条件は独立)。表示は失敗の行と「今回は記憶を読み書きしない(次の起動でもう一度確かめる)」。
8. **chappy があって前の形の記録も残っているとき**: 触らない(設計の条件どおり)。表示に「直下に前の形の記録が残っている(手で確かめる)」を 1 行出す。記憶は普通に使う(各ロールに `.git` があるので根の古い git とは混ざらない)。
9. **種の差し替えの口**: `prepareMemoryFolder` に `soulName`(呼び名)を渡し、読み込んだ種の本文の「チャッピー」を差し替えて書く(変換は `conventionsSeedForName`・純関数で export)。呼び名はロールの `name.canonical`(Domain A で「呼び名」と定めた値・名前の一文や判定の問いに使う名前。こーでぃーは「コーディ」)。チャッピーは差し替えても種と同じ文面。既にある `_conventions.md` は今まで通り触らない。
10. **既定の置き場を外した**: `memories/` は記憶のフォルダではなくなったので、`prepareMemoryFolder` / `commitMemoryChanges`(失敗で返す)と `writeStreamRecord`(TypeError)は `dir` を省略できないようにした(既定のまま呼ぶと記憶の根に git を作り、ロールのフォルダが入れ子になる)。`runRecall` は前から必須。`DEFAULT_MEMORY_DIR` は値を変えず「根」の意味で残した(名前を変えると既存テストと使い手が広く動くため)。
11. **表示**: 起動の引っ越しの行は設定の分 → 記憶の分の順で 1 回だけ。どちらかが失敗した起動は、全部の行をターミナルの WARN に出す(Domain A は設定の分の失敗だけで判定していた)。記憶の分は「記憶をロールのフォルダへ引っ越した(記録 N 件・履歴ごと): <置き場>」と「記憶の写し: <置き場>」。記録の名前・中身は出さない。

## 6. git check-ignore

- `apps/soul/agent/memories.migrating-1234/x` → `apps/soul/agent/.gitignore:72:/memories.migrating-*/`
- `apps/soul/agent/memories/chappy/_conventions.md`・`apps/soul/agent/memories/cody/.git/HEAD` → `apps/soul/agent/.gitignore:41:memories/`
- `apps/soul/agent/tmp/restructure-backups/restructure-20261031-090000/memories/_map.md` → `.gitignore:19:tmp/`(リポジトリの根)
- `apps/soul/agent/src/memory/memory-migration.mjs` → 該当なし(コードは無視されない)

## 7. 持ち越し(次のドメイン別)

- **Domain D(場)**: 場の始まりで記憶の本体のファイル名を作り直す所は `createRoleMemoryPlaces` の置き場(ロールごとに 1 回だけ作る)。場ごとに作り直すなら、置き場の `streamRecord` を作り直す口(または場の始まりで置き場の表を捨てる)を足す。`lastRecordAtMs` / `lastRecordedSeq` は今もプロセスに 1 つ(ロールや場ごとではない)。「配信を終える」で記憶の最後の保存を待つときは、`memoryRecorder.record(...)` が頼んだ時点のロールの置き場に書く(このドメインで固定済み)。
- **Domain E(画面)**: 記憶のタブに「どのロールの記憶か」を出すなら、`createRoleMemoryPlaces` の `place()` の `roleId` / `dir` が使える(snapshot には載せていない)。新しいロールを作る画面で、Windows の予約名(`con` など)を弾く件(Domain A の持ち越し 2)は、`memoryDirForRole` でも同じ id がフォルダ名になる。
- **人間ゲート**: (1) 引っ越しの表示に「記録 N 件」と写しの置き場が出る。(2) Windows で `memories/` の中を Explorer やエディタが開いていると rename が失敗しうる(そのときは元の形のまま失敗で返り、その起動は記憶を読み書きしない・次の起動でもう一度)。初回の起動の前に `memories/` を開いているものを閉じておくとよい。(3) §4 の Codex の根の確かめ。
- **範囲の外に残した古い記述**: `memory-store.mjs` の冒頭の「上位文書」・`recall-flow.md` の「`memories/_map.md`」など、記憶の置き場を `memories/` 直下として書いている文書は直していない(範囲外)。

## 8. 質問

1. 記憶の引っ越しが失敗した起動では、記憶を読み書きしない形にした(§5-7)。配信そのものは止めない。「失敗したら起動を止める」「失敗しても前の形の `memories/` のまま記録する」などの別の扱いを望むなら教えてほしい(今の形は、次の起動での取り違えを避けるのを優先した)。
2. ロールを戻したとき、前に作った置き場(同じ本体のファイル名)を使う形にした(§5-1)。場(Domain D)ができるまでのつなぎとしてよいか。
