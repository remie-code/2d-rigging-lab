# Domain B — 記憶をロールごとに 完了報告

> Orch-Sylph → Undine(2026-10-31)。計画: [../../orchestration/stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain B。
> 判定: **pass**(ループ 1 回。止めた指摘 0 件。escalate 候補 1 件 → §5 質問 1)。コミットはしていない(ブランチ `ai-cohost/stream-restructure`、直前のコミット 38084596)。
> 実装: Gnome(opus)→ [domain-b-gnome.md](domain-b-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/stream-restructure/domain-b.md](../../reviews/stream-restructure/domain-b.md)。
> 実データ(`cockpit-settings.local.json`・`.bak*`・`memories/`・`roles/`)と鍵(`.env*.local`)には誰も触れていない。操縦席は起動していない。手元に `roles/`・`tmp/restructure-backups/`・`memories.migrating-*` は無い(レビューで存在だけ確認)。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1758 pass / 0 fail**(基準 1732 → +26)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1560 files) |
| 依存・lockfile | 変更なし |
| 本物の LLM・外部 API | 呼ばない |
| ②④の指示の文面・種 `conventions-seed.md`・判定の文面 | 差分なし(レビューで確認。種は sha256 のテストで固定。Orch-Sylph も `git diff --quiet` で種と `recall.mjs` の無変更を確認) |

## 2. 変えたファイル(`apps/soul/agent/` 起点)

- 新規: `src/memory/memory-migration.mjs`(記憶の引っ越し: 写し → `memories/` を `memories.migrating-<pid>/` へ rename → `memories/` を作り直す → `memories/chappy/` へ rename。途中の失敗はその場で戻す)、`src/memory/memory-migration.test.mjs`(本物の git・一時フォルダ)。
- 変更: `.gitignore`(`/memories.migrating-*/`)、`scripts/cockpit.mjs`(`createRoleMemoryPlaces`・保存の係に `getPlace`・写しのフォルダを `migrationBackup` に上げて共有・記憶の 4 か所をロールのフォルダへ・`onSetRole` で替えたロールのフォルダを準備)、`scripts/cockpit.test.mjs`、`src/memory/memory-store.mjs`(`memoryDirForRole`・`soulName` で種の「チャッピー」を差し替え・`conventionsSeedForName`・`dir` を必須に)・test、`src/mind/memory.mjs`(`writeStreamRecord` の `dir` を必須に。文面は不変)・test、`src/roles/role-migration.mjs`(`runStartupMigration`・`formatStartupMigrationReport`)・test。
- 計 9 ファイル変更(+630 / −55)+ 新規 2 ファイル。
- 期待値を変えた既存テスト: **0 件**(テストは import と追加だけ)。
- Codex の git の根: 一時フォルダの入れ子で `git rev-parse --show-toplevel` がロールのフォルダ(とその下のトピック)から ロールのフォルダを返すことをテストで固定(対照: `.git` の無いフォルダからは外側を返す)。**本物の Codex の探し方は人間ゲートの確認に回す。**

## 3. 裁量(Gnome が決め、レビューが 11 件すべて筋が通ると認めたもの。全文は domain-b-gnome.md §5)

- 記憶の置き場はロールの id ごとに 1 回作って持ち回る(フォルダ・準備・本体のファイル名)。ロールを戻すと前の置き場(同じ本体のファイル名)を使う。場ごとの作り直しは Domain D。
- 保存は「頼んだ時点の置き場」に書く。置き場の違う頼みは合流させず後ろに並べる(設計 §2.3「ほかのロールのフォルダに書けない」)。
- 「直下に記録がある」= 根の直下に `.git` か `.md`。件数 = 移した `.md` のうち `_` で始まらないもの。
- 前の形とロールのフォルダが混ざっている根は移さず失敗で返す。chappy があって前の形も残る根は触らず、注意を 1 行出す。
- **記憶の引っ越しが失敗した起動は記憶を読み書きしない**(配信は止めない。設定の分は独立に進む)。→ §5 質問 1。
- 呼び名はロールの `name.canonical`。`DEFAULT_MEMORY_DIR` は「根」の意味で値を変えずに残し、記憶を書く関数は `dir` を省略できなくした。
- 引っ越しの表示は設定の分 → 記憶の分の順に 1 回。どちらかが失敗なら全行を WARN に。

## 4. 持ち越し(止めない指摘。レビュー §持ち越しと Gnome §7)

- **Domain D へ**: 場の始まりで本体のファイル名を作り直す口が要る(`createRoleMemoryPlaces` の置き場はロールごとに 1 回)。`lastRecordAtMs` / `lastRecordedSeq` はプロセスに 1 つのまま。「配信を終える」の最後の保存は頼んだ時点のロールの置き場に書く(固定済み)。`onSetRole` が置き場の準備を待つ(ロールの切り替えの応答が git init の分遅れうる)。
- **Domain E へ**: 記憶のタブに「どのロールの記憶か」を出すなら `place()` の `roleId` / `dir` が使える。Windows の予約名(Domain A の持ち越し 2)は `memoryDirForRole` のフォルダ名にも効く。
- **仕上げ(全体の突き合わせのあと)**: `memory-store.mjs` の冒頭・`recall-flow.md` の `memories/_map.md` など、記憶を `memories/` 直下とする古い記述。写しの二重(引っ越しの写しと作業用)と同期コピー(大きい記憶で起動が遅れうる)は軽微。
- **人間ゲートへ**: (1) 引っ越しの表示に「記録 N 件」と写しの置き場が出る。(2) 初回の起動の前に `memories/` を Explorer やエディタで開いていないこと(Windows で rename が失敗しうる。そのときは元の形のまま失敗で返り、その起動は記憶を読み書きしない)。(3) Codex の頭(②④)が `memories/<role-id>/` を作業フォルダにして、上へ git の根や AGENTS.md を探さないこと。

## 5. 質問(Undine へ)

1. **(escalate 候補・レビューも同意見で確認を求める)** 記憶の引っ越しが失敗した起動では、記憶を読み書きしない(保存は警告・④は失敗)形でよいか。配信は止めない。設計 §2.4 に失敗時の扱いが無い。別案は「起動を止める」「前の形の `memories/` 直下のまま記録する」。Gnome は次の起動での取り違え(chappy が無い条件の崩れ)を避けるのを優先した。
2. ロールを戻したときに前に作った置き場(同じ本体のファイル名)を使うのを、Domain D までのつなぎとしてよいか(レビューは可と評価)。
