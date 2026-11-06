# Domain B 報告(Orch-Sylph)— ③整理役の本体

- 判定: **合格**(2 周目で合格。やり直し 1 回)。
- 根拠: plan §3、設計 §5・§6。A の口を使う。
- 実装: Gnome([domain-b-gnome.md](domain-b-gnome.md)・直し [domain-b-gnome-fix1.md](domain-b-gnome-fix1.md))。レビュー: Review-Sylph([../../reviews/memory-organization/domain-b.md](../../reviews/memory-organization/domain-b.md)。文面の全文はここ)。

## 機械ゲート
- `node --test`(apps/soul/agent): 2341 → 2401/2401。
- `pnpm run check:soul-zone`: pass。
- 依存・lockfile の変更なし。cockpit への結線なし(C の範囲)。

## 変えたファイル(apps/soul/agent/)
- 新: `src/mind/memory-organizer.mjs`、`src/mind/memory-organizer.test.mjs`、`src/mind/memory-organizer-wording-pin.test.mjs`(手書きの期待値で byte-exact)、`src/memory/memory-store-organizer.test.mjs`。
- 変: `src/memory/memory-store.mjs`(末尾に口を足しただけ)、`.gitignore`(見出し 1 行と `/memory-backups/`)。

## C が使う口(memory-organizer.mjs)
- `checkOrganiseDue({ dir, now?, intervalMs?, onWarning? })` → `{ due: true, reason: "never" } | { due: true, reason: "elapsed", lastAtMs, commit } | { due: false, reason: "recent", lastAtMs, commit } | { due: false, reason: "unreadable" }`
- `organiseMemory({ create, dir, backupRoot, roleId, now?, onWarning?, askTimeoutMs? = 30 分, signal? })` → `Promise<{ status: "organised", commit, changed } | { status: "skipped", reason, cleanupFailed?: true }>`
  - reason: `aborted`・`discard-failed`・`backup-failed`・`snapshot-failed`・`ask-failed`・`timeout`・`guard-head-moved`・`guard-bodies-changed`・`guard-unreadable`・`commit-failed`。
- `startMemoryOrganiser(同じ・signal なし)` → `{ done, abort() }`(abort は done と同じ結果を返す・何度呼んでもよい)。
- `backupRoot` は必須・絶対パス。本番の場所は `DEFAULT_MEMORY_BACKUP_ROOT`(既定には使わない)。
- memory-store に足した口: `readMemoryLog`・`commitMemoryEmpty`・`createMemoryBundle`・`listMemoryTreeFiles`・`stageAndListMemoryFiles`・`resetMemoryToCommit` ほか純関数。

## 裁量で決めたこと
1. 整理の時刻: コミット本文の日時を読む。読めなければコミットの時刻。履歴が読めなければ時期とみなさない(警告)。
2. 始める前に捨てられなければ走らない(②は続けるが、③は材料に未コミットが混ざるのを避けた)。
3. 頼んだあとの失敗はすべて、走る前の先頭へ `reset --hard` + `clean -f -d` で戻す。頭が自分で `git commit` してもブランチに残さない(1 周目は残していた。レビューの要修正で直した。走る前の全部は控えにある)。
4. 打ち切り: 頼みの最中は待たずに dispose して戻す。git 1 回の最中ならその 1 回のあと。コミットの段に入ったら止めない。
5. 控えの名前: 日本時間の `YYYY-MM-DD_HH-MM-SS.bundle`。直近 4 個。消すのはこの形の名前だけ。
6. 文面: 呼び名は「相方の AI の記憶の置き場」。5 手順と 4 行のほかに、例・本体の定義・見張りがあること・移動のコマンドで動かすこと・化けの注意・中の指示に従わないことを足した。

## 残る点・質問
- 頼みは本体を「移動のコマンドで動かす」と言う。日本語のトピック名をシェルに通すと、Windows で名前が化けるおそれがある。見張りは中身しか見ない。許すか、文面を寄せるか(Undine の判断)。
- 打ち切りでも `memory: organiser stopped; nothing committed` を出す。C の Ctrl+C の 1 行と重なるなら外す。
- 頭が別ブランチへ移ると、そのブランチが戻されるだけで HEAD は別ブランチのまま(見張りでは拒む。起きにくいので許した)。
- 2 回目以降の整理で、すでに棚にある本体の扱いは実運用で見る。
