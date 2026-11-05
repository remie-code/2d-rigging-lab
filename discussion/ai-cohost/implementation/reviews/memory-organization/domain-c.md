# Domain C レビュー(Review-Sylph)

**判定: 合格**(must-fix なし。minor 3 点・質問 2 点)

## 機械ゲート(自分で実行)
- `node --test`(apps/soul/agent): **2428 / 2428 pass**、fail 0、cancelled 0、skipped 0(Gnome の主張どおり。B のあと 2401 → +27)。
- `pnpm run check:soul-zone`: pass(1634 ファイル)。
- `git diff --stat` で package.json / pnpm-lock.yaml: 変更なし。
- テスト実行後の `git status`: 想定外の新規ファイルなし。`memory-backups/` は作られていない。

## 観点ごとの確認(根拠)
1. **閉じは整理を待つ**: OK。
   - `scripts/cockpit.mjs` createStreamVenueHooks の saveFinal(約 1384-1408): ②が走っていれば 90 秒上限で待つ(`waitBounded` は従来のまま)→ 頼まなかった閉じでも `organiseIfDue(place, {writerBusy})`。旧 `if (!isRecording()) return` を外した形。
   - `cockpit-server.mjs` closeStream(3054-3110): `closing` → `runRoleHooksAll("saveFinal")` → `markVenueClosed()`。整理中も phase は closing のまま、venue が閉じるのは整理のあと。始める・ロール切り替えの拒否は `streamPhase !== "closed"` の既存ガードのまま。
   - Discord も同じ `closeStream`(テスト `cockpit-organiser-c.test.mjs:493` で確認)。
   - 印: `setMemoryOrganising`(cockpit-server.mjs 約 5181)は closing の外の true を持たない。`stream.organising` は `streamPhase==="closing" && memoryOrganising`(1560)。`markVenueClosed` で false(2912)。係は `finally { setRunning(dir,null) }`(cockpit.mjs 約 1190)で、エラー・abort でも必ず下ろす。
2. **Ctrl+C**: OK。
   - `createCockpitShutdown`(約 2713)は最初の 1 回で `venue.stopOrganising()` を `beforeClose`・endStream より前に呼ぶ。stdin EOF も同じ shutdown 経路。
   - `stop()` は `stopped=true` にして走行中を `abort()`。`done` は B の巻き戻しのあとに解決するので、巻き戻し完了前にプロセスが終わらない。`organiseIfDue` は due 確認の await のあとで `stopped` を再確認し、そのあと `writerBusy`・`startImpl`・`setRunning` までは await が無く、隙間がない。
   - ②の最中の Ctrl+C: ②は 90 秒待ち・2 回目で打ち切りは従来どおり。そのあと整理は始まらない(テスト 635)。
3. **時期でない閉じ**: OK。`readMemoryHead` → `checkOrganiseDue` が「無し」なら何も出さず戻る。先頭が無い(`.git` 無し・コミット無し)では B を呼ばないので控えの置き場も作らず警告も出ない。本物の git のテスト(810)で確認。
4. **backupRoot**: `MEMORY_BACKUP_ROOT = DEFAULT_MEMORY_BACKUP_ROOT`(memory-organizer.mjs:72 = `agent/memory-backups` の絶対パス)。main が明示して渡す(cockpit.mjs 約 3443-3447)。テストは `mkdtemp` の一時フォルダのみ(`:234-235`, `:536-537`)。本番の根は定数の値だけを検査(880)。
5. **安全(②と③の同時実行)**: 実害のある隙間は見つからなかった。
   - 見送り方式は妥当。閉じかけの間に②を起動できる口を確認した: 20 分保存は場が開いている間だけ、「今日を記録」は open 以外 409、新しい場の開始は closing で拒否。よって整理の最中に②が始まらない。
   - 整理の前に②が残っている場合は `writerBusy`(= `isRecording()`)で見送る。これは保存の係全体の判定なので、他ロールの②が走っていても見送る。安全側の誤りで害はない。
   - ④の recall は頭のセッションを畳んだあとなので、閉じかけの間は走らない(コード上の確認。minor 参照)。
6. **ロールごと**: `place()` がロールごとの置き場で、係は dir ごとに別の整理(テスト 531 で 2 ロール確認)。頭は `resolveWriterBrainDef(currentBrain).create`(②と同じ)。
7. **ターミナルの行**: 始まり `memory: organising (role <id>)`(`role set: <id>` と同じ扱い)、終わり `memory: organised (commit …)`、skip は B の警告 1 行のみ、C 独自は ②が上限超過の見送りと起動失敗(想定外)の 2 つだけ。B の `organiser stopped` との重複なし(テスト 611 が `lines` と `warnings` を厳密比較)。中身・ファイル名は出ない。
8. **UI 文言**: `isMemoryOrganising` が true のときだけ差し替え。印が無ければ従来の「配信を終えています…」「通話を終えています…」「記録中…」「記録中」のまま(organising-c.test.mjs で両方検査)。他の文言の変更なし。
9. **後片付け**: `note(paths, removed)` で D を先に外す(memory.mjs 141-150、`removed` は 320 で `status==="D"` から)。コメント(cockpit.mjs main・createStreamVenueHooks の JSDoc、cockpit-server.mjs の 778 付近と 2967 付近)は更新済み。`stream-wording-pin-calls.mjs` の `baseName` 削除は 2 か所のみで、`stream-wording-pin-expected.mjs` の差分は A の変更(C は触っていない)。
10. **テスト**: 偽の organiser・brain を使い、cockpit は起動しない(`createCockpitServer(...).listen(0)` のインプロセスのみ)。実フォルダへの書き込みなし。上の 1-8 の挙動を実際に assert している。
11. **ルール**: 依存の変更なし。ログ・警告に記憶本文やファイル名は出ない。B のモジュール、④・②の文言は C では変えていない。

## 指摘
### must-fix
なし。

### minor
1. `cockpit.mjs` の `writerBusy`(約 1405)は保存の係全体を見る。複数ロールで他ロールの②が長引くと、別ロールの整理が見送られる(次の閉じでやり直し)。現状ロール 1 つなので害はなく、Gnome の質問 2 に対しては「このままでよい。複数ロールを同時に運用する段階で dir 単位に直す」と判断する。
2. 閉じかけの間に recall(④)が走らないことはコード上の読みだけで、テストでは固定されていない。整理は開始時に未コミットの変更を捨てるので、将来 closing 中に④が走る経路ができたら要確認。いまは対応不要。
3. `raceMemoryRecordWithTimeout` の 90 秒タイマーが解除されない件(Gnome の質問 5)は従来の形で、`process.exit` で終わるため害なし。変更不要。

## Gnome の 5 つの質問への見解
1. 場が開いているときの Ctrl+C では整理を走らせない: 設計 §7「Ctrl+C は整理を打ち切る」と整合しており、**この読みでよい**。
2. ②判定を保存の係全体で見る: 上の minor 1 のとおり**現状はこれでよい**。
3. 時期でない閉じで git を 2 回読む: 数十 ms の見込みで許容。
4. 新ロール初回の閉じで③が走る: 設計の「一度も整理していなければ時期」どおりで**よい**。
5. タイマー非解除: **変更不要**。

## 質問(Orch-Sylph へ)
- なし(上の見解で足りる)。ただし 2 の複数ロール時の dir 単位化を将来課題として plan に残すかは、Orch-Sylph の判断に任せる。
