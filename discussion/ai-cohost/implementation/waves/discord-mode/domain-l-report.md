# Domain L 完了報告 — 書き出し役の書き込みが「?」に化けたら取り消してやり直す

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格)。止めない指摘 1(空白の抜け)だけ Gnome に戻して直した。製品判断で止める質問は無い。Gnome の質問 1 つは見立てを添えて §8 に上げる。
> Orch-Sylph(2026-11-01)。ブランチ `ai-cohost/discord-mode`(HEAD `803cd53a`)。コミットしていない。
> 子: Gnome(opus)`ac7724191e9fe69c6`(実装 + 狭い修正 1 回)、Review-Sylph(sonnet)`a51ecbdc63af5849b`。どちらも SubagentHandback で完了を返した(生き残りなし)。
> Gnome の報告 [domain-l-gnome.md](domain-l-gnome.md)(変更・文言・裁量の全文はここが正)、レビュー [../../reviews/discord-mode/domain-l.md](../../reviews/discord-mode/domain-l.md)。
> 仕様 [../../../memory/writer-garble-2026-11-01.md](../../../memory/writer-garble-2026-11-01.md) §5、計画 [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §8 Domain L。
> 鍵(`.env*.local`)は誰も読んでいない。実データ(`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`・`cockpit-settings.local.json`)に触れていない(テストは一時フォルダの git)。操縦席・本物の Bot / LLM / Codex / 外部 API は起動していない。`~/.codex`・依存・lockfile の差分 0。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2303 / 2303 pass**(土台 2281 から +22)。Gnome・レビュー・Orch(空白の修正のあと)の 3 回 |
| 根で `pnpm run check:soul-zone` | pass(1626 files)。Gnome とレビュー |
| `src/mind/fixtures/stream-wording-pin-expected.mjs` | 差分は 32 行目(`writer.systemPrompt`)の -1/+1 だけ。`stream-wording-pin.test.mjs` 36 / 36 pass。Orch が `git diff -U0` で確認 |
| 配信の他の文面 | `buildWriterRequest`・④・判定・`runWriterOnce` の文面は差分に出ない(レビュー確認) |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 実装: `src/mind/memory.mjs`、`src/memory/memory-store.mjs`。
- fixture: `src/mind/fixtures/stream-wording-pin-expected.mjs`(1 行)。
- テスト新規(22 件): `src/mind/memory-garble.test.mjs`(新規・14)、`src/memory/memory-store.test.mjs`(+7)、`scripts/cockpit.test.mjs`(+1)。
- 既存テストの変更: `src/mind/memory.test.mjs` の 2 件に `addedLinesImpl: cleanAddedLines` を渡した(偽のコミットのハッシュで `.git` の無いフォルダのため「確かめられない」警告が 1 つ足され、警告の列を `deepEqual` で固定しているため)。期待値の変更 0・assert を弱めていない(レビュー確認)。

## 3. 作ったもの(要約)

- **指示**: `buildWriterSystemPrompt` の「このフォルダの外には書かないでください。」の直後に、語の組に依らない固定文を 1 つ。配信・通話の両方に効く。
  > ファイルは、ファイルを直接書き換える道具で書いてください。シェルのパイプやスクリプトに日本語を通して書くと、文字が「?」に化けます。
- **化けの見分け**(純関数・`memory.mjs`): `isGarbledLine` / `hasGarbledLines`。`?` の 4 連があり、かつ ASCII 以外の文字が 0 の行が 1 行でもあれば化け。
- **git の口**(`memory-store.mjs`・`commitMemoryChanges` と同じ作法: `runGit` + `pinnedGitArgs`・throw しない・dir 必須・`.git` が無ければ git を呼ばない):
  - `readCommitAddedLines`: `git diff-tree --root -p -U0 --no-color --no-ext-diff --no-textconv`(ルートのコミットでも動く)。行の取り出しは純関数 `parseAddedLines`(`+++` 見出しを除く)。
  - `revertMemoryCommit`: `git revert --no-edit`(履歴を書き換えない)。失敗したら `--abort` を best-effort。
  - コミットの引数は `HEAD` か 16 進のハッシュだけを通す(引数注入なし)。
- **`writeStreamRecord`**: 新しいコミットが積まれた回(`committed === true`)だけ足された行を見る。化けなら revert → 警告 → やり直し。やり直しは書き損じと合わせて最大 1 回(`MAX_ATTEMPTS = 2` のまま)。やり直しでも化けたら、それも revert して `{ written: false, garbled: true }`。
- **警告**(固定の英語・export): `WRITER_GARBLED_RETRY_WARNING`・`WRITER_GARBLED_WARNING`・`WRITER_GARBLED_REVERT_FAILED_WARNING`・`WRITER_GARBLE_CHECK_FAILED_WARNING`。中身・ファイル名・トピック名・git の stderr を載せない。
- **呼び出し側**: `scripts/cockpit.mjs:884` は `result.written` だけを見て、記録時刻は `onSaved` でしか進まない。`src/cockpit/` に `written` を読む所は無い。よって `garbled: true` は `missing: true` と同じ扱い(記録時刻を進めない)。`scripts/cockpit.test.mjs` に 1 件足して固定。

## 4. 確かめ(テスト)

- 純関数: 化けの行・ふつうの日本語の「??」・`???`(3 連)・英数字だけの行・`?` 4 連 + 日本語・空。
- git の口: 足された行(ルートのコミットでも)・revert で中身が戻り revert のコミットが積まれる(ルートのコミットも)・`.git` が無ければ git を呼ばない。
- 偽物の書き出し役 × 一時フォルダの本物の git: 1 回目化け → revert → 2 回目正常で `written:true`・本体に `?` なし／化け → 化けで `written:false`・2 回とも revert・前の状態のまま／書き損じ → 化けで 2 回打ち止め(create 2 回)／2 回目以降の保存で化け → 前の本体に戻ってからやり直し／警告に中身が載らない。
- レビューは独自に、荒らした global 設定(`color.ui=always`・存在しない `diff.external`・`diff.noprefix`・`diff.renames`)を一時の `GIT_CONFIG_GLOBAL` で与えても口が動くこと、HEAD でないコミットの競合や未コミットの変更があるとき `ok:false` で止まり途中状態を残さないことを確かめた(scratchpad・リポジトリに置いていない)。

## 5. ループ

| 回 | 中身 | 結果 |
|---|---|---|
| 1 | Gnome 実装 → Review-Sylph | pass・止める指摘 0 |
| 補 | 止めない指摘 1(`memory.test.mjs:251` の `const RECORD =Object.freeze` の空白の抜け。Gnome の編集で入った)を Gnome に戻した | 直った(HEAD と同じ行に。改行も CRLF に戻した)。Orch が全テスト 2303 / 2303 を再確認 |

## 6. 裁量(Gnome が決め、レビューが筋が通ると評価)

- 確かめるのは新しいコミットが積まれた回だけ(変更なし・コミット失敗の回は見ない)。
- 足された行が取れないときは「書けた」扱い + 固定の警告(fail-open。今の「コミットに失敗したら判断できないので書けた扱い」に合わせた。記録を壊さない側)。
- revert に失敗したら、やり直さず `written:false, garbled:true` + 固定の警告(化けた中身が残るが、記録時刻を進めないので次の定期保存で書き直される)。
- 化けて revert した回は「書けなかった回」として数え、その回の書き損じの判定は飛ばす。
- ask が失敗した回でも、化けたコミットは revert してから throw する。
- 新しい印は `garbled: true`(呼び出し側は `written` だけを見るので扱いは `missing` と同じ)。
- 化けの見分けの純関数は `memory.mjs` に、git の口は `memory-store.mjs` に置いた。

## 7. 持ち越し(止めない)

1. ASCII だけの `????` を書き出し役が材料からそのまま写すと、化けと誤判定して取り消す理屈上の穴(仕様どおり・非常に稀)。
2. 指示の文面は道具を名指ししない・「ファイルは、ファイルを…」が少し重なる。効くかどうかは実機で見る(レビューの指摘)。
3. `scripts/cockpit.mjs:165` 付近の説明(書き損じのやり直しが Ctrl+C の 90 秒の枠の中で走る)が、化けのやり直しに触れていない(ふるまいは同じ枠の中)。
4. そのコミットに書き出し役以外の未コミットの手直しが混ざっていた場合も一緒に取り消される(今のコミットのしかたと同じ限界・JSDoc に注記済み)。具体例が §8 の質問 1。

## 8. 質問(Undine へ。止めない)

1. **新しいロールの最初の保存で化けると、`_conventions.md` の種も消える**。`prepareMemoryFolder` が置く種はコミットされないまま、書き出し役の最初のコミット(ルートのコミット)に含まれる。これを revert すると種も消え、同じ保存の中のやり直しは決まりを読めないまま書く。レビューの指摘で、`prepareMemoryFolder` は場の始まりに 1 回しか走らないので、**その場の残りの保存もすべて種なしで走り、戻るのは次の場の始まり**(Gnome の見立てより長い)。被害は記録の消失ではなく、書式が決まりから外れること。起こるのは「新しいロールの最初の保存」かつ「化けた」ときだけ。
   - Gnome・レビュー・Orch とも「注記のまま持ち越してよい」の見立て。
   - 直すなら最小は「revert のあとに種を置き直す」。ただし `writeStreamRecord` はロールの呼び名を持たないので、素朴に `prepareMemoryFolder({ dir })` を呼ぶと呼び名が「チャッピー」のまま置かれる。呼び名を渡す口が要り、Domain L の範囲を少し超える。「種をコミットしておく」案は prepare の契約と整理役の前提を動かすのでレビューは勧めない。直すかどうかの判断を Undine に委ねる。

## 9. 全体の突き合わせと人間ゲート 3 で見てほしい所

- 突き合わせ: 化けのやり直しが Ctrl+C の最後の保存の 90 秒の枠に収まるか(書き損じのやり直しと同じく、収まらなければ打ち切りが優先)。revert のコミットが記憶の git に残る形(役名と日時だけの元のコミットに対する `Revert "書き出し役 …"`)を整理役・人が見て困らないか。
- 人間ゲート 3: 配信・通話の保存が今までどおり書けること(指示の 1 文を足したので、書き出し役のふるまいが変わっていないか)。記憶の git に revert のコミットが出ていないこと(出ていれば化けを捕まえたということで、警告の行と合わせて見る)。
