# Domain M Gnome 報告: 判定の札を同じ場の中だけで結ぶ

> 実装: Gnome（2026-11-03）。ブランチ `ai-cohost/discord-mode`（HEAD `c0d99235`）。コミットしていない。
> 根拠: [gate-3-stale-judgment-chip.md](gate-3-stale-judgment-chip.md) §5、計画 `implementation/orchestration/discord-mode-wave-plan.md` §8 の「### Domain M」。
> `.env*.local` は読んでいない。実データ（`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`・`cockpit-settings.local.json`）には触れていない（テストは純関数だけで、ファイルを書かない）。操縦席・本物の Bot / LLM / 外部 API は起動していない。依存は変えていない。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2315 / 2315 pass・fail 0**（土台 2303 を手元で確認してから +12） |
| 根で `pnpm run check:soul-zone` | pass（1627 files scanned） |
| `git diff -- apps/soul/agent/src/mind/` | 0 行（`stream-wording-pin.test.mjs`・fixture も 0） |
| サーバ（`cockpit-server.mjs`） | 差分 0 |
| 既存テストの期待値 | 変更 0 件 |

## 2. 調査の結果

### 2.1 「新しい場が開いた」の合図

今ある材料で決められた。サーバ側への足しはしていない。

- `openStream`（`cockpit-server.mjs` 2933 行あたり）は、最初に `streamPhase = "opening"` にして `broadcastState()`（SSE `state` = snapshot 全体）を配る。そのあとの段 4 で `openVenueTranscript()` が正本を作り直す（seq が 0 から）。つまり、同じ SSE の流れの中で **phase "opening" の `state` は、新しい場の最初の転写・判定より必ず前に届く**。
- 開き終えたら `streamPhase = "open"`・`streamOpenedAtMs = nowImpl()` で再び `broadcastState()`。閉じるときは `closing` → `closed`（`markVenueClosed` で `openedAtMs = null`）。始められなかったときは `opening` → `closed`。
- snapshot の `stream` は `{ phase, error, openedAtMs, experience, connection, vcName }`。Discord の VC を抜ける・入る・移るでは `connection`・`vcName` だけが変わり、`phase`・`openedAtMs` は変わらない。正本も作り直さない（`openVenueTranscript` を呼ぶのは開く段の 1 か所だけ）ので、seq は続く。
- 画面側: `app.mjs` は SSE の全イベントを `setGlance((g) => glanceAfterSseEvent(g, name, d, nowMs))` に通している（`state` も今までは「関係の無いイベント」として同じ状態を返していた）。初期化は `GET /api/state` → `glanceFromHistory(s.transcripts, now())`。POST の応答（`applySnapshot`）は glance に流れないが、同じ内容は SSE `state` で届く。
- 決めた合図: SSE `state` の `stream.phase` が "opening" になったとき（前に見た状態が "opening" でなければ）。取り逃したときの控えとして、閉じている・閉じかけを見たあとの "open"、`openedAtMs` が前と違う "open" も新しい場とみなす（`isNewVenue`）。

### 2.2 glance-timeline 以外に seq で結んでいる所

- `src/cockpit/` 全体（`ui/`・`view-logic/`）を `seq`・`triggerSeq`・`firstSeq`・`lastSeq` で grep した。glance-timeline 以外で seq を使うのは `conversation-instruction.mjs` の `requestSeq`（要求の世代の番号・正本の seq と無関係）だけ。
- ログのタブの `ui/rows.mjs`（観測フィード）は判定を `speak-now-judgment` の行として時系列に積むだけで、seq で他の行に結ばない。ずれない → 直していない。
- `discord-panel` ほかにも seq の結び付けは無い。

### 2.3 causes の triggerSeq での結び付け

ずれうる → 同じ場の中だけに限った（fireId の鍵の扱いは変えていない）。

- `linkedSeq`（最新の返事のきっかけの配信者の行を同じ色でつなぐ）: 開き直した直後は最新の返事が前の場の行で、そのきっかけ seq が新しい場の同じ seq の行とつながりうる。逆に新しい場の返事のきっかけ seq が前の場の同じ seq の行ともつながりうる。
- `seqs.has(cause.triggerSeq)`（きっかけの行が手元にあれば返事の行には札を出さない）: 全行の seq の集合なので、前の場の行の seq で「手元にある」と取り違えうる。

## 3. 変更ファイル（`apps/soul/agent/` 起点）

- `src/cockpit/view-logic/glance-timeline.mjs`（実装・冒頭の説明・JSDoc。CRLF のまま）
- `src/cockpit/ui/app.mjs`（初期化の 1 行に `s.stream` を渡す・冒頭の説明 2 行。CRLF のまま）
- 新規: `src/cockpit/view-logic/glance-venue-m.test.mjs`（12 件。隣の glance-* のテストに合わせて CRLF）

## 4. 作ったもの

### 4.1 状態（GlanceState）

- `venue: number`: 今の場の番号（`emptyGlance` で 0。この画面で新しい場が開くたびに 1 つ進む）。
- `venueMark: { phase, openedAtMs } | null`: 最後に見た場の状態（まだ見ていなければ null）。
- 会話の行（ConvoRow: you / soul / event / note）は積んだときの `venue` を持つ。

### 4.2 関数（export）

- `venueMarkOf(stream)`: snapshot の `stream` から `{ phase, openedAtMs }` を取る。形が違えば（古いサーバ・null）null。
- `isNewVenue(prev, next)`: 新しい場が開いた（開き始めた）か。opening → open・open → closing → closed は同じ場。prev が無ければ "opening" だけを新しい場とする（"open" は途中から見始めただけ）。
- `glanceAfterVenueStatus(g, stream)`: 新しい場なら `venue + 1`・`judgments = {}`・`window = null`（行・`causes`・`latencies`・`reacted`・コメントは残す）。場の状態が前と同じ・形が違うときは同じ状態（同一参照）を返す。閉じかけ・閉じたは印だけ替える。
- `glanceAfterSseEvent` に `case "state"`: `glanceAfterVenueStatus(g, d && d.stream)`。
- `glanceFromHistory(transcripts, nowMs, stream?)`: 3 つ目を渡すと、その場の状態を覚える（履歴の行は今の場）。省けば今まで通り。

### 4.3 表示（conversationRowsView・表示の形 ConvoRowView は変えていない）

seq で結ぶものは「今の場の行（`row.venue === g.venue`）」だけ:

- 判定の札（you の行の `chipText`）
- 推論の範囲（`inRange`・`rangeStart`・`rangeEnd`。間の薄い行は今まで通り位置で入る）
- `linkedSeq`: 最新の返事が今の場の行のときだけ、今の場の配信者の行とつなぐ（最新の返事の強調 `latest` は今まで通り）
- `seqs`（きっかけの行が手元にあるか）: 今の場の行の seq だけ。前の場の返事の行は seq で結ばないので、speak-now のきっかけは返事の行に小さく出す（§6 の裁量 2）

### 4.4 呼び出し側（app.mjs）

- SSE の経路は変えていない（`state` は前から `glanceAfterSseEvent` に流れている。今回、その中で場の状態を読むようにしただけ）。
- 初期化: `setGlance(glanceFromHistory(s.transcripts || [], now(), s.stream))`。開き直し（ページの再読み込み）のあと、最初の SSE `state` で取り違えないように場の状態を覚えさせる。

## 5. テスト（`glance-venue-m.test.mjs`・12 件）

1. ゲート 3 の再現: 1 回目の場で seq 24 が「応答 0.34」で発火 → 閉じて開き直し → 新しい場の seq 24 は「待つ 0.62」（action "none"・覚えない）。新しい seq 24 に札が出ない・どの行にも「応答 0.34」が出ない・前の場の行は残る。
2. 前の場の行に新しい場の札が付かない（新しい場の札は新しい場の同じ seq の行だけ）。
3. 推論の範囲: 開き直したら捨てる・新しい場の範囲（seq 23〜24）は前の場の seq 23〜24 の行に付かない・間の薄い行（skip-interval）は範囲に入る。
4. きっかけの結び付け: 開き直した直後（最新の返事が前の場）は誰ともつながず、前の場の返事の行に「応答 0.34」を小さく出す・遅延はそのまま。新しい場の返事は新しい場のきっかけの行だけとつながる。きっかけ seq が前の場の行にしか無ければ返事の行に小さく出す。
5. fireId で結ぶもの（コメント反応・手動のきっかけ・コメントの「反応」の印）は場をまたいでもそのまま。
6. 1 つの場の中は今と同じ: state を挟まない並びと、開いたあとの同じ並びで `conversationRowsView` の結果が deepEqual（遅延・きっかけ込み）。閉じても（次の場が開くまで）札と範囲はそのまま。
7. 配信の場でも同じ（同じ起動で配信を 2 回開いたとき）。
8. 合図の表（`isNewVenue`・`venueMarkOf`）: opening / open / closing / closed の移り方、取り逃したときの控え、形の崩れ。
9. 場の状態が変わらない state（VC を抜ける・移る＝connection・vcName だけの変化、stream の無い snapshot、null）は同一の状態を返す。閉じる・閉じたは印だけ。開くたびに場の番号が 1 つ進む。
10. `glanceFromHistory` の経路: 履歴の行は今の場（同じ場の SSE で札と範囲が付く）→ 閉じて開き直したら前の場の行になる。stream を渡さない古い呼び方・閉じている間の snapshot からの開始。
11. 履歴のあと opening を取り逃して別の場の open が届いても、控えで新しい場とみなす。
12. App の結線（ソースの照合）: SSE は `glanceAfterSseEvent` のまま・初期化は `glanceFromHistory(..., s.stream)`・`state` は購読に入っている。

既存の `glance-timeline.test.mjs`（「関係の無い SSE は同じ状態を返す」の `state` に `{ anything: 1 }` を含む・`glanceFromHistory(undefined) deepEqual emptyGlance()`）、`glance-discord-g.test.mjs`、`cockpit-ui-glance.test.mjs`（`setGlance((g) => glanceAfterSseEvent(...))` の照合）、`venue-events-discord-j.test.mjs` は期待値を変えずに pass。

## 6. 裁量

1. 合図は既存の SSE `state` の `stream.phase`（"opening"）。サーバに場の識別子を足す案（`streamGeneration` を snapshot に載せる等）は、今ある材料で順序が保証されるので採らなかった。サーバの差分 0。
2. 前の場の返事の行の speak-now のきっかけ: 前の場の札の覚えを捨てるので、そのままだと前の場の返事にはきっかけの表示がどこにも無くなる。きっかけは fireId で結ぶ（ずれない）ので、「きっかけの行が手元に無いとき」と同じ扱いで返事の行に小さく出すことにした。開き直した瞬間に、前の場の配信者の行の札が消え、その返事の行に同じ札が小さく出る見た目の変化がある。
3. 場が閉じた時点（closing / closed）では前の場の札と範囲を捨てない。捨てるのは新しい場が開いたとき（§5 の文言どおり。終えたあとも直前の場の見え方が残る）。
4. 合図の控え（"opening" を取り逃したとき）: 閉じている・閉じかけ → "open"、`openedAtMs` の違う "open"、"open" → "opening" を新しい場とみなす。前に何も見ていない（初期化の snapshot が取れなかった等）ときは "opening" だけ。
5. 新しいテストファイルは CRLF（隣の `glance-timeline.test.mjs`・`glance-discord-g.test.mjs` に合わせた）。

## 7. 残リスク・持ち越し

- SSE が切れてつなぎ直す間に `state` を取り逃すと（既存の作りでは、つなぎ直しで snapshot を取り直さない）、控えの判定（open の `openedAtMs` の違い）が届くまで前の場の札が残りうる。opening〜open の間に届いた新しい場の判定が、控えの切り替えで捨てられることもある（見た目だけ・次の判定から正しい）。今回の scope では、つなぎ直しの扱いは変えていない。
- `CONVO_KEEP`（300 行）の上限は場をまたいで共通のまま。前の場の行は上限で古い順に落ちる（今まで通り）。
- 人間ゲートでの確かめ（同じ起動で通話を開き直し、新しい場の行に前の場の札が出ないこと）は未実施（操縦席を起動していない）。

## 8. 質問

1. §6 の 2（前の場の返事の行に、きっかけの札を小さく出す）でよいか。前の場の行にはきっかけを何も出さない方がよければ、`conversationRowsView` の 1 か所を変えるだけで済む。

## 追補（レビュー pass 後・止めない指摘のテストの抜け）

実装は変えていない（`glance-timeline.mjs`・`app.mjs`・サーバのソースの差分は §3 のまま）。テストだけを足した。

### 機械ゲート（追補後）

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2320 / 2320 pass・fail 0**（§1 の 2315 から +5、土台 2303 から +17） |
| 根で `pnpm run check:soul-zone` | pass（1628 files scanned） |
| `git diff -- apps/soul/agent/src/mind/ apps/soul/agent/src/cockpit/cockpit-server.mjs` | 0 行 |

### 足したテスト（5 件）

`src/cockpit/view-logic/glance-venue-m.test.mjs`（+3・計 15）:
1. 追補 1: 読み込み時の snapshot が開きかけ（phase "opening"）。購読直後の同じ state は同一の状態のまま。そのあとの "open" で場の番号は進まず、判定の札と推論の範囲が履歴の行（今の場）に付く。
2. 追補 2: 始められなかった場をはさむ（1 回目 → 閉じる → 2 回目 opening →（1 行積まれて）closed（error）→ 3 回目 opening → open）。開き始めるたびに場の番号が 1 つ進む（3）。前の場と始められなかった場の行に札・範囲が出ない。3 回目の札・範囲・きっかけのつなぎは 3 回目の行だけに結ぶ（始められなかった場の seq 0 とはつながない）。
3. 追補 3: App の SSE の口と同じ形で確かめる。`app.mjs` の `SSE_EVENT_NAMES` を import し、`state` が入っていることを確かめた。購読のループ（`for (const name of SSE_EVENT_NAMES) { source.addEventListener(name,`）と `JSON.parse(ev.data)` はソースの照合で固定した。そのうえで、初期化（`glanceFromHistory(..., snapshot.stream)`）と、名前ごとの更新関数（`setGlance((g) => glanceAfterSseEvent(g, name, d, nowMs))`）を写した小さな再生器に JSON の data を流し、state で場が切り替わってゲート 3 の取り違えが出ないことを確かめた。
   - App 本体を描かなかった理由: App は preact の hooks（useState / useEffect）・EventSource・fetch を使う。この package には DOM の代わり（jsdom 等）が無く、依存も足せない。既存のテストも App を描かず、`app.mjs` の export（`SSE_EVENT_NAMES`・`settingsFromSnapshot` 等）の import とソースの照合で結線を固定している。今回もその作法に合わせた。

新規 `src/cockpit/cockpit-server-discord-m.test.mjs`（2 件・CRLF・本物の server と loopback の HTTP、偽の耳 / orchestrator / 発火の予定。設定は既定のメモリの置き場で、実データ・Bot・LLM・外部 API には触れない）:
4. 合図の順序: 1 回目の場で 2 行（seq 0・1）を積んで閉じる。2 回目の開く段を声の用意（`onPrepareVoiceEngine`。正本を作り直したあとの段）で止め、開きかけの間に正本が空になっていることを確かめてから、コメントを 1 行積む。SSE の並びで、2 回目の phase "opening" の state が新しい場の最初の行（seq 0）より先に届くこと、2 回目の seq が 0 から数え直すこと（1 回目の seq 1 と 2 回目の seq 1 が同じ番号）を固定した。あわせて、本物の SSE をそのまま `glanceAfterSseEvent` に流し、場の番号が 2 になること、seq 1 の判定が 2 回目の行にだけ付くことも確かめた。
5. SSE に接続した直後の 1 発目が state（今の場の phase と openedAtMs）であることを固定した（`openSse` の「接続直後に現在状態を 1 発」）。

### §7 の残リスクの書き方の訂正

§7 の 1 点目は書き方が不正確だった。SSE は接続（つなぎ直しを含む）の最初に必ず state（今の snapshot）を配る（`openSse`・上のテスト 5）。このため、つなぎ直したあとの最初の state で、場が替わっていれば控えの判定（閉じていたあとの "open"・`openedAtMs` の違う "open"）が効き、前の場の札と範囲はそこで捨てられる。残るのは、切れている間に配られた transcript / selfFire などを取りこぼすこと（行や札が抜ける）で、これは今までと同じ挙動（Domain M で変えたものではない）。
