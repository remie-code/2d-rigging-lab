# Domain C 報告(Orch-Sylph)— 閉じの流れと「整理中」

- 判定: **合格**(1 周目で合格。やり直し 0 回)。
- 根拠: plan §4、設計 §5・§7、コード棚 §2。B の口(`memory-organizer.mjs`)を結線した。
- 実装: Gnome([domain-c-gnome.md](domain-c-gnome.md))。レビュー: Review-Sylph([../../reviews/memory-organization/domain-c.md](../../reviews/memory-organization/domain-c.md))。

## 機械ゲート
- `node --test`(apps/soul/agent): 2401 → 2428/2428(Review-Sylph が自分で実行)。
- `pnpm run check:soul-zone`: pass。
- 依存・lockfile の変更なし。B のモジュール・②④の文言・pin の期待値は C では変えていない。

## 変えたファイル(apps/soul/agent/)
- `scripts/cockpit.mjs`: `createMemoryOrganiserRunner` を新設。saveFinal・`stopOrganising()`・`createCockpitShutdown`・main の結線。`MEMORY_BACKUP_ROOT`(= `DEFAULT_MEMORY_BACKUP_ROOT`)を main から明示して渡す。古いコメントの直し。
- `src/cockpit/cockpit-server.mjs`: snapshot に `stream.organising`、`setMemoryOrganising(bool)`。古いコメントの直し。
- `src/cockpit/view-logic/discord.mjs`・`glance-meters.mjs`: 整理中の文言。
- `src/mind/memory.mjs`: `D` の本体を持ち回りから外す(`note(paths, removed)`)。
- `src/mind/fixtures/stream-wording-pin-calls.mjs`: 使われない `baseName` を外した。
- テスト: 新 `scripts/cockpit-organiser-c.test.mjs`・`src/cockpit/view-logic/organising-c.test.mjs`、`src/mind/memory.test.mjs` に追加。

## 動き
- 閉じ(配信・Discord とも `closeStream` → saveFinal): ②を今どおり頼み 90 秒まで待つ → 文字起こしが無くても時期を見る → 時期なら③を上限なしで待つ。その間 phase は `closing`、`stream.organising` が true(どの終わり方でも finally で下りる)。場が閉じるのは③のあと。
- 時期でない閉じ・先頭の無いフォルダ: 何も出さず今どおり。控えの置き場も作らない。
- ②が 90 秒を過ぎても走っていれば、その閉じの③は見送り(次の閉じでやり直す)。
- Ctrl+C(stdin の終わりも同じ): 最初の 1 回で走っている③を `abort()`、これからの③も始めない。②は今どおり最大 90 秒、2 回目で打ち切り。
- 画面: 中央「記憶を整理しています…」、添え書き「整理中…」、Discord「記憶を整理しています…」、ピル「整理中」。
- ターミナル: `memory: organising (role <id>)`(`role set: <id>` に倣う)/ `memory: organised (commit <7桁>)`(変更なしは `(no changes, commit <7桁>)`)。走らなかったときは B の警告 1 行だけ。C 独自の見送りは `memory: organising skipped: the writer is still saving` など。

## 裁量
- ②が走っている間は③を見送る(後ろに並べると 90 秒の上限が意味を失うため)。
- 重なり防止は B の警告を「走らなかった」の 1 行としてそのまま使う。
- 先頭の無いフォルダは手前で止める(閉じるたびの警告を避ける)。

## 残る点・質問
- 「②が走っているか」は保存の係全体で見る。複数ロールでは他ロールの②でも見送る。今はロール 1 つで害なし。複数ロール運用時に dir 単位へ直すか(将来課題として残すか)。
- 閉じかけの間に④が走らないことはテストで固定していない(コードの読みでは走らない)。
- 新ロールの最初の閉じで③が走り、頭を 1 回使う(設計どおり)。
