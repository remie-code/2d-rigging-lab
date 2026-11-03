# 全体の突き合わせ（2 回目）§3-1 と K の持ち越しの語 — Gnome の完了報告

> Gnome（2026-11-01）。ブランチ `ai-cohost/discord-mode`（HEAD `84bb6afa`）。コミットしていない。
> 読んだもの: `reviews/discord-mode/final-2.md` §3-1・§3-4、`domain-k-report.md` §7-1、設計 `discord-mode.md` §13.2〜§13.4。

## 1. 直した所

### 1-1. §3-1: 閉じるのと、抜ける・外から切られるが重なっても「VC にいない」の口を残さない（案 a を基本に）

- `apps/soul/agent/src/discord/discord-experience.mjs:933-950`（`foldLink` の出口を畳む所）
  - `:935` `const hold = how.hold && !x.closed;`。出口を畳む時点で場がもう閉じていれば（人の耳の畳みを待つ間に `teardown` が走った）、初めから hold なしで畳む。
  - `:941-947` hold で畳むのを待つ間に閉じた場合は、同じ出口の hold なしの `dispose()` で外す（案 a そのもの）。`x.heldOutlet` には入れない。
  - `:948-950` 閉じていなければ今のまま `x.heldOutlet = outlet`。
- 案 a に「畳む前にもう閉じていれば hold しない」を足した理由: 本番の再現の形（人の耳の drop を待つ間に閉じる）では、hold してからすぐ外すより、初めから hold しない方が差し口が一瞬でも「VC にいない」の口にならない。hold の畳みそのものを待つ間に閉じた場合は、案 a のとおり後から外す。どちらも差し口（`createVenuePlayerSlot`）の既存の約束（「hold で残した口は、同じ出口の hold なしの dispose で外れる」）だけを使う。差し口・`teardown` は変えていない。
- `hushVoice` の呼び方・`leaveVoice` / `goOutside` / `moveVoice` の後ろの `x.closed` の確かめは今のまま。

### 1-2. K の持ち越しの語: Discord の場の開きかけ・閉じかけの Fire の注記

- `apps/soul/agent/src/cockpit/view-logic/control.mjs:104`（`manualFireStreamView`）。場が開いていない間の注記は、`stream.experience === "discord"`（`isDiscordVenue`）なら `DISCORD_FIRE_NOT_IN_VC_NOTE`（「VC に入ると押せる」）にした。それ以外は今のまま「配信を始めると押せる」。
  - `:51` `isDiscordVenue` を `./discord.mjs` から読む。`:22-23` は頭の説明の 1 行。
- server は、開きかけ・閉じかけの間は `experience` を `"discord"` のまま返す。閉じたら `null` を返す（`markVenueClosed`）。そのため閉じている間は今のまま「配信を始めると押せる」が出る。配信の場（`experience: "stream"`）の出力は変わらない。
- 押せる・押せない（`blocked`）は変えていない。語だけを変えた。運転のタブの Fire も同じ関数を使うので、Discord の開きかけ・閉じかけの間は同じ語になる（K の「運転タブにも同じく効く」に揃う）。

## 2. 足したテスト（+4 件）

| ファイル | テスト | 見ること |
|---|---|---|
| `apps/soul/agent/scripts/cockpit-discord-final-2.test.mjs`（新規） | 抜けるの途中に通話を終える | 本物の server + 体験の口 + 偽の Discord + 本物の `createVenuePlayerSlot`。人の耳の `dispose` を 80ms 遅らせ、`leave` の 10ms 後に `/api/stream/stop`。閉じたあとの差し口は `null`（`HELD_VENUE_PLAYER` でない）。同じ起動で配信の場（`experience: "stream"`）を開くと、再生器を起こす段で差し口は空（`"local"`）。配信の間も差し口は空 |
| 同上 | 外から切られたの途中に通話を終える | `kickBot()` の 50ms 後に `/api/stream/stop`。あとは同上 |
| 同上 | 重ならないとき（抜けてから閉じる）は今のまま | 抜けたら `HELD_VENUE_PLAYER`、閉じたら空、次の配信は手元の再生器 |
| `apps/soul/agent/src/discord/discord-experience-discord-i.test.mjs:515` | 抜けるの途中に閉じる（体験の口だけ） | (1) 人の耳の畳みを待つ間に閉じたら、出口は hold なしで 1 回だけ（`[false]`）。(2) 出口の hold の畳みを待つ間に閉じたら、`[true, false]`（後から外す） |

既存のテストに足した確かめ（件数は増えない）: `apps/soul/agent/src/cockpit/view-logic/discord-panel-k.test.mjs`
- `:143-160` Discord の開きかけ・閉じかけ（接続が `joining` / `null` / `joined` / `outside`）は「VC に入ると押せる」。
- `:170-182` 配信の条件の出力は一字も変わらない。`phase` が closed / opening / closing、`experience` が undefined / null / `"stream"`、`connection` が undefined / null / joining / outside の全組で `{ blocked: true, note: "配信を始めると押せる" }`。`open` の配信は `{ blocked: false, note: "" }`。
- `cockpit-ui-settings.test.mjs:219-224`（配信の Fire の注記）はそのまま pass。

## 3. 落ちる → 通るの確かめ

- §3-1: 直す前に新しいテストを書いて走らせた。「抜ける」と「外から切られた」の 2 本が `「VC にいない」の口を残さない` で落ちた（重ならない 1 本は通った）。直したあとは 3 本とも通る。さらに直したあと、体験の口の側の 1 本も足した。直す前のファイル（`git show HEAD:`）に一時的に戻して走らせ、新しい 3 本（server 2 + 体験 1）が落ちることを確かめてから、直したファイルに戻した。
- 語: 直す前の `control.mjs`（`git show HEAD:`）に一時的に戻すと、`discord-panel-k.test.mjs` の「Domain K 手動の Fire」が落ちる。直したファイルに戻すと通る。
- 戻したあとの `git diff --stat` は、直した所だけ（`discord-experience.mjs` +14/-2・`control.mjs` +6/-3）。

## 4. 機械ゲート

- `apps/soul/agent` で `node --test`: **2281 / 2281 pass**（fail 0・cancelled 0・skipped 0・約 92 秒）。前の 2277 件に、足した 4 件を加えた数。
- 根で `pnpm run check:soul-zone`: pass（1625 files。新しいテストのファイルの分だけ増えた）。

## 5. 期待値を変えた既存テスト

- `apps/soul/agent/src/cockpit/view-logic/discord-panel-k.test.mjs:143-147`（「Domain K 手動の Fire」の中の 1 つ）。`{ phase: "opening", experience: "discord", connection: "joining" }` の注記の期待値を、「配信を始めると押せる」から `DISCORD_FIRE_NOT_IN_VC_NOTE`（「VC に入ると押せる」）に替えた。
  - 理由: このテストは、K の持ち越し（語がまだ直っていない今の形）をそのまま固めていた。今回の直しで、意図して替える所。

## 6. 境界

- 変えたのは次の 2 つだけ: `discord-experience.mjs` の `foldLink` と、`control.mjs` の `manualFireStreamView`。テストは、新規 1 ファイルと既存 2 ファイルへの追記。
- `stream-wording-pin.test.mjs`・`src/mind/fixtures`・`skills/`・`package.json`・lockfile には触れていない。
- `.env*.local`・`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/` にも触れていない。
- テストは OS の一時フォルダと偽物だけ（偽の Discord・偽の鍵の値・偽の id）。操縦席の起動・本物の Discord・LLM・外部 API は無い。
- ログに本文・名前・id を足していない。
- untracked の `discussion/ai-cohost/implementation/waves/discord-mode/human-gate-3.md` は私のものではないので、触れていない。

## 7. 残リスク

- §3-2（抜ける・移るの途中の短い間に発火を断らない）と §3-3（開きかけの間に見る窓を選ぶ）は、範囲の外なので変えていない。
- 「移る」の `foldLink` も同じ道を通る。移る途中に閉じた場合は、`moveVoice` が畳んだあとに `x.closed` で抜けるので、今回の直しで出口も外れる（テストは「抜ける」と「外から」で固めた。「移る」の重なりの専用のテストは無い）。

## 8. 質問

1. 閉じかけ（`phase: "closing"`）の Discord の場の注記も「VC に入ると押せる」にした。この語は、開きかけには合う。閉じかけには「通話を終えている途中」の方が合うかもしれない。委任の「VC に入ると押せる（または状態に合う語）」の前半を採り、新しい文言は足していない。閉じかけの語を分けるかは、人間ゲート 3 で見て決めてほしい。
