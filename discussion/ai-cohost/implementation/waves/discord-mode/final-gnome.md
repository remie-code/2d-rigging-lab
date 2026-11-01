# Discord モード 全体の突き合わせの直し — Gnome 報告(2026-11-01)

> 依頼: Undine。止める指摘 1 件(突き合わせ [../../reviews/discord-mode/final.md](../../reviews/discord-mode/final.md) §2-1・§3、計画 Status の Domain G の追認 (1))を案 a で直す。
> ブランチ `ai-cohost/discord-mode`(HEAD `79b09fd5`)。コミットはしていない。鍵(`.env*.local`)は読んでいない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)には触れていない。本物の Discord・LLM・外部 API は呼んでいない。テストは OS の一時フォルダだけ。依存・lockfile の変更なし。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2176 / 2176 pass**(2173 から +3) |
| 根で `pnpm run check:soul-zone` | pass(1611 files) |
| 固定テスト `src/mind/stream-wording-pin.test.mjs` と fixture | 触っていない |
| 期待値を変えた既存テスト | **0**(既存テストのファイルを 1 つも触っていない) |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 変更: `src/cockpit/cockpit-server.mjs`(+6 行、コメント込み)
- 新規: `src/cockpit/cockpit-server-discord-final.test.mjs`(3 テスト)

## 3. 直した所

1. **1 層目(主)**: `ingestChatMessage`(`src/cockpit/cockpit-server.mjs:4457`)の `if (closed) return;`(:4458)の直後、:4462 に `if (discordVenueActive()) return;`。`try` と `commentGuard` より前なので、弾く判定・`reportComment`・正本・放送・発火の予定・コメント反応のどれにも回らない。`discordVenueActive()`(:2311)は今の意味のまま(`venueExperience.kind === "discord"` = 開きかけ・開いている・閉じかけ)。
2. **2 層目(守り)**: `commitComment`(:4564)の先頭、:4566 に同じ 1 行。今の作りでは届かない(突き合わせ §3 のとおり)。
3. 捨てるときは何も出さない(`chatBufferAbsent` などの診断もログも出さない)。器官(`chatClient`)は畳まない。`POST /api/chat/connect` / `disconnect`・`startChatForStream`・配信の場の取り込みは変えていない。

## 4. 足したテスト(`src/cockpit/cockpit-server-discord-final.test.mjs`、3 件)

本物の cockpit-server + 本物の Discord の体験の口 + 偽の Discord。偽のチャット器官は `onMessage` の手を覚えて `emit` で流す(器官の `onMessage → ingestChatMessage` の道を通す)。`stop` の回数も数える。ロールの束の偽物は `saveFinal` の転写を残し、`renewRecords` / `openSession` / `saveFinal` を門で止められる。

1. **閉じている間に Connect → Discord の場 → コメント 2 件**: `getTranscript()`・snapshot の `transcripts` に viewer が無い / SSE の `transcript` に viewer が出ない / 診断(`chatBufferAbsent`・`chatIngestError`)と `commentRejected` が出ない / `commentGuard` 0 回・反応の判定 0 回 / 閉じたときの `saveFinal` の転写に viewer が無い / 器官は `stop` 0 回・作り直しなし・`onMessage` の手は生きたまま / 放送とログに名前も本文も無い。
2. **同じ器官のまま Discord を閉じて配信を始める**: 器官は作り直されず持ち込まれる(`sources` は 1 つ・`stop` 0)。コメントは `commentGuard` を 1 回通り、正本に積まれ、SSE で放送され(`commentId` 付き)、speak-now の反応の判定へ回り、配信の `saveFinal` の転写に viewer の行が入る(今まで通り)。
3. **開きかけ・閉じかけ**: 段 2(`renewRecords` で止める、正本ができる前)と段 8(`openSession` で止める、正本ができた後)の `phase === "opening"` の間、閉じる段 3(`saveFinal` で止める、`phase === "closing"`)の間にコメントを流す。どこでも正本・放送・判定に入らず、診断も出ない。最後に、場が閉じたあとは今まで通り `chatBufferAbsent` が出ることも見る。

## 5. テスト 4(1 層目を外すと落ちるか)の確かめ

`cockpit-server.mjs` を退避してから 1 行ずつ外して走らせ、退避から戻した(戻したあと `git diff` で直しの 6 行だけを確認)。

- **1 層目だけ外す**(2 層目は残す): 3 件とも落ちる。テスト 1 は「弾く判定(commentGuard)を呼ばない」で `actual: 2, expected: 0`。テスト 2 は Discord の場で流したコメントで guard が 1 回走って落ちる。テスト 3 は開きかけ(正本ができる前)と閉じかけで `chatBufferAbsent`(`reason` に視聴者の名前)が 2 本出て落ちる。
- **両方外す**: 3 件とも落ちる(正本に viewer が積まれる、突き合わせの再現どおり)。
- 2 層目だけを単独で落とすテストは作れない(今の作りでは届かない守りのため)。

## 6. 裁量

1. 新規テストファイルに置いた(既存の `makeChat` は広げていない。G のテストファイルは触らない)。ハーネスは `cockpit-server-discord-g.test.mjs` の `startServer` を写して、器官とロールの束だけ広げた。
2. テスト 3 は任意の「開きかけ」に加えて、正本ができる前(段 2)と閉じかけ(`saveFinal` の待ち)も見た。直しの 1 行が `discordVenueActive()` の範囲(開きかけ・閉じかけを含む)で効くことと、「何も出さない」(名前入りの `chatBufferAbsent` を出さない)を固定するため。
3. 2 層目のコメントは「今の作りでは届かない」ことを書いた。

## 7. 残リスク

- 2 層目は単独ではテストで固定できない(届かない道のため)。将来 `guardQueue` の扱いを組み替えたときに効く守り。
- 閉じている間に Connect した器官の「チャットが切れている」などの上の帯の警告は、突き合わせ §4 の 3 のとおりそのまま(案 a の筋)。

## 8. 質問

なし。
