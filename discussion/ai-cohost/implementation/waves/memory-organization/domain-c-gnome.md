# Domain C 報告(Gnome)— 閉じの流れと「整理中」

- 根拠: plan §4、設計 §5・§7、コード棚 §2、A・B の報告。
- 機械ゲート: `node --test`(apps/soul/agent)**2428/2428 pass**(B のあと 2401 → +27)。`pnpm run check:soul-zone` **pass**。
- 依存・lockfile の変更なし。コミットなし。実データ・`memory-backups/` に触れていない(テストは一時フォルダだけ)。B のモジュールは変えていない。

## 変えたファイル(apps/soul/agent/)
- `scripts/cockpit.mjs`: 整理の係 `createMemoryOrganiserRunner`(新)、`createStreamVenueHooks`(saveFinal・stopOrganising・JSDoc)、`createCockpitShutdown`(stopOrganising を呼ぶ)、`main`(結線)、定数 `MEMORY_BACKUP_ROOT`・`ORGANISER_WRITER_BUSY_WARNING`・`ORGANISER_START_FAILED_WARNING`、古いコメントの直し。
- `src/cockpit/cockpit-server.mjs`: snapshot の `stream.organising`、`setMemoryOrganising(bool)`、閉じたら下ろす、古いコメント 2 か所(旧 778・2959 行)と saveFinal の JSDoc。
- `src/cockpit/view-logic/discord.mjs`・`glance-meters.mjs`: 整理中の文言。
- `src/mind/memory.mjs`: `D` の本体を持ち回りから外す。
- `src/mind/fixtures/stream-wording-pin-calls.mjs`: 使われない `baseName` を外した(期待値はそのまま・pin は green)。
- テスト(新): `scripts/cockpit-organiser-c.test.mjs`(18)、`src/cockpit/view-logic/organising-c.test.mjs`(7)。(足した): `src/mind/memory.test.mjs`(2)。

## 閉じの流れ(配信を終える・通話を終える)
- どちらも `POST /api/stream/stop` → `closeStream` → `runRoleHooksAll("saveFinal")`。Discord も同じ道(テストで確かめた)。
- `saveFinal`: 最初に、そのロールの置き場(`memoryPlaces.place()`)を取る → ②を今どおり頼み、走っていれば 90 秒の上限で待つ(上限は変えない)→ **頼まなかった閉じでも** `organiser.organiseIfDue(place)`。
- `organiseIfDue` の順:
  1. 止めたあと(Ctrl+C)・置き場が無い → 何もしない。
  2. `readMemoryHead` で先頭が無い(`.git` が無い・コミットが無い・読めない)→ 何もしない(行も出さない・控えの置き場も作らない)。
  3. `checkOrganiseDue` が時期でない → 何もしない(今の閉じと同じ・行なし)。履歴が読めないときは B の 1 行だけ。
  4. ②がまだ走っている(上限を過ぎた)→ 見送り 1 行。
  5. `startMemoryOrganiser`(頭 = `resolveWriterBrainDef(currentBrain).create`、`backupRoot` = `MEMORY_BACKUP_ROOT` = `DEFAULT_MEMORY_BACKUP_ROOT` = `apps/soul/agent/memory-backups`)。終わるまで上限なしで待つ。その間 phase は `closing` のまま。始める・ロールの切り替えは今どおり断る。
- ロールごと: 場にいるロールごとに saveFinal が呼ばれ、それぞれの置き場(ロールの id と記憶のフォルダ)で別の整理が走る。係は 1 つで、フォルダごとに走っている整理を持つ。

## Ctrl+C(SIGINT・stdin の EOF)
- `createCockpitShutdown` は最初の 1 回で、終えるより前に `venue.stopOrganising()` を呼ぶ。走っている整理は B の `abort()` ですぐ止め、これからの整理は始めない。
- 閉じかけの整理の最中に押した: abort → done がすぐ返る → closeStream が終わる → `endStream` も止まらずに進む。
- ②の書き出しの最中に押した: ②は今どおり最大 90 秒待つ(2 回目の Ctrl+C で打ち切るのも今どおり)。そのあと整理は始めない(行なし)。
- 場が開いているときの Ctrl+C: 終えると同じ道で②は書くが、整理は走らない(設計 §7「Ctrl+C は整理を打ち切る」に合わせた)。

## 印の形
- snapshot・SSE の `stream.organising: boolean`(いつも載る。`closing` の間に③が走っているときだけ true)。
- cockpit.mjs の係が `server.setMemoryOrganising(true/false)` で知らせ、サーバが SSE "state" を押す。`closing` の外の true は持たない。閉じたら false。
- `stream` に置いた理由: 画面の部品はどれも `settings.stream` を受け取っているので、引数を足さずに済む。サーバは整理の中身を知らない(真偽だけ)。

## 画面の文言
- 配信の場の中央: 「配信を終えています…」に代えて **「記憶を整理しています…」**、添え書き「記録中…」に代えて **「整理中…」**。
- Discord の場: 「通話を終えています…」に代えて **「記憶を整理しています…」**(中央の添え書きも「整理中…」)。
- 状態のピル: 「記録中」に代えて **「整理中」**(色は「記録中」と同じ class)。
- 印が無ければ今の文言のまま。記憶のタブの「(記録中…)」などほかの文言は変えていない。

## ターミナルの行
- 始まり: `[cockpit] memory: organising (role <id>)`(標準出力。ロールの id は `role set: <id>` と同じ扱い)。
- 終わり: `[cockpit] memory: organised (commit <7 桁>)`。変更なしは `memory: organised (no changes, commit <7 桁>)`。
- 走らなかった・取り消した: B が `onWarning` で出す固定の 1 行がその回の 1 行(`[cockpit] WARN: …`)。C は重ねて出さない。打ち切りも B の `memory: organiser stopped; nothing committed` だけ。
- C だけの見送り: `memory: organising skipped: the writer is still saving`、`memory: organising skipped: could not start the organiser`(想定外)。
- 時期でない閉じ・先頭が無い・Ctrl+C のあとは何も出さない。

## 裁量で決めたこと
1. **②が走っている間の整理は見送る**(②の後ろに並べない)。並べると閉じが②の終わりを上限なしで待つことになり、②の 90 秒の上限が意味を失う。保存の係の約束も変えずに済む。整理は次の閉じでやり直す(時期のまま)。閉じかけの間は 20 分ごとの保存も「今日を記録」も走らないので、整理の最中に②が始まることはない。走っているかは保存の係全体(`isRecording`)で見る(フォルダごとより慎重な側)。
2. **1 行の仕組み**: B の警告を skip の行として使い、C は skipped で何も出さない。B は 1 回の skip で理由の 1 行を必ず 1 回出すため。文字列で選り分ける仕組みは足さなかった。戻せなかったとき(`cleanupFailed`)の B の追加の 1 行は、別の事実なので残る。
3. **先頭が無いフォルダでは何もしない**: `.git` が無い・コミットが無いと、B は控え(`git bundle`)で失敗し、控えの置き場を作ったうえで閉じるたびに警告する。その前に `readMemoryHead` で止める。準備の失敗は起動と場の始まりで警告済み。
4. 印は `stream` に置いた(上の「印の形」)。
5. `D` の本体の外し方: `note(paths, removed)` の 2 つ目の引数を足した(先に外してから足す)。テストの偽物の `note` はそのまま使える。

## 残る点・質問
1. 場が開いているときの Ctrl+C でも整理は走らせない、とした。設計 §7 は「整理はすぐ打ち切る」だけなので、この読みでよいか。
2. 「②が上限を過ぎてまだ走っている」の判定は保存の係全体で見る。複数のロールの場で、ほかのロールの②が走っているときも見送る(今はロールが 1 つ)。フォルダごとに見るべきか。
3. 時期かどうかの確かめで、閉じるたびに git を 2 回(先頭・log)読む。時期でない閉じも少しだけ遅くなる(数十ミリ秒の見込み)。
4. 新しいロールの最初の閉じ: 種のコミットしかなくても「一度も整理していない」ので③が走る(頭を 1 回使う)。設計どおりだが、よいか。
5. `raceMemoryRecordWithTimeout` は 90 秒のタイマーを片付けない(前からの形)。テストでは unref したタイマーを渡した。本番は `process.exit` で終わるので害はない。
