# Domain D — 場(配信を始める / 終える)完了報告

> Orch-Sylph → Undine(2026-10-31)。計画: [../../orchestration/stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain D。
> 判定: **pass**(ループ 1 回。止めた指摘 0 件。Undine に上げる分岐 0 件)。コミットはしていない(ブランチ `ai-cohost/stream-restructure`、直前のコミット 7e9a04b0)。
> 実装: Gnome(opus)→ [domain-d-gnome.md](domain-d-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/stream-restructure/domain-d.md](../../reviews/stream-restructure/domain-d.md)。
> 実データ(`cockpit-settings.local.json`・`.bak*`・`memories/`・`roles/`・`session-usage/`)と鍵(`.env*.local`)には誰も触れていない(レビューは存在と更新日時だけを確認。作業前のまま。`roles/` は無い)。操縦席は起動していない。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1817 pass / 0 fail**(基準 1782 → +35)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1561 files) |
| 依存・lockfile | 変更なし |
| 本物の LLM・外部 API | 呼ばない(偽の耳・判定・器・頭・②と、本物の cockpit-server の loopback HTTP。一時フォルダは `mkdtempSync(tmpdir())`) |
| 判定の文面・②④の指示・種・`skills/` | 差分なし(レビューで確認) |

## 2. 作ったもの(要約。詳細は domain-d-gnome.md §2)

- **場の状態** `closed → opening → open → closing → closed`(`cockpit-server.mjs`)。snapshot に `stream: { phase, error, openedAtMs }`。
- **配信を始める `openStream`**: ロールを固める(opening から `/api/role` が 409)→ 場の記録を作り直す(記憶の本体のファイル名・頭の文脈の記録・場ごとの保存の数え・そのロールの置き場の準備を待つ)→ KILL を OFF + revive、判定部品・発火の予定・思い出しの係を作り直し、弾く判定の待ち行列を捨てる → 耳・目・声 → 頭のセッション → 体があれば器(URL が無い / つながらなければ場を開かず、起こしたものを畳み、理由を `stream.error` に残す)→ 保存してある YouTube の URL につなぐ(失敗しても開く)→ open。
- **配信を終える `closeStream`**: 写し → 畳む(YouTube → 判定 → 発火の予定 → 思い出しの係 → 鳴っている返事を kill → 目・耳 → 頭のセッション → 器。**器の close は体の有無に関わらず**)→ 記憶の最後の保存を待つ(closing = 画面の「記録中…」、上限 90 秒)→ closed。
- **API**: `POST /api/stream/start`・`/api/stream/stop`。`/api/ears/start`・`/stop` は同じ関数を通る別名(耳だけを起こす道は残さない)。`/api/memory-record` は場が開いている間だけ。開いている間の start は 409(マイク・文字起こしはサーバの側で替えられない)。
- **Ctrl+C**(`createCockpitShutdown`): 場が閉じていなければ `endStream()`(終えると同じ道)→ `server.close()` → 残りを畳む。2 回目は待ちの打ち切りだけ(今の形)。
- **cockpit.mjs の口**: `createStreamVenueHooks`(場の hook・場ごとの `lastRecordedSeq` / `lastRecordAtMs`・20 分ごとの保存は開いている間だけ)、`createLazyChannel.connect()`、`createRoleMemoryPlaces.beginStream()`、器の断りの文面 `BODY_CONNECT_FAILED_MESSAGE`(「runtime-player が起動していないか、channel が開いていない」)・`BODY_URL_NOT_SET_MESSAGE`。頭のセッションは場の始まりで作る(`--channel` の先充填はやめた)。
- **画面**: 場が閉じている間、メイン画面の中央に「配信を始める」と「準備・設定」。始められなかった理由(赤い枠)、開きかけ / 閉じかけ(「記録中…」)もそこに出る。「配信を終える」は下の帯の歯車の左に小さく、開いている間だけ・2 回押し。設定のダイアログの Start / Stop は場の関数を通り、開いている間はマイク・文字起こしの select が disabled。

## 3. 変えたファイル(`apps/soul/agent/` 起点。15 ファイル +1205 / −259、新規 1)

- 新規: `scripts/cockpit-stream.test.mjs`(約束のテスト 29 件)。
- 実装: `src/cockpit/cockpit-server.mjs`・`scripts/cockpit.mjs`・`src/cockpit/ui/{app,conversation,bottom-bar,settings-drawer,styles}.mjs`・`src/cockpit/view-logic/{glance-meters,settings}.mjs`。
- テスト: `scripts/cockpit.test.mjs`・`src/cockpit/cockpit-server.test.mjs`・`src/cockpit/cockpit-ui-glance.test.mjs`・`src/cockpit/cockpit-ui.test.mjs`・`src/cockpit/view-logic/{glance-meters,settings}.test.mjs`。
- **期待値を変えた既存テスト: 10 件**(すべて仕様変更に伴うもの。レビューで差分と一致を確認。一覧は domain-d-gnome.md §6): `/api/role` の 409 の判定と文面 1、耳の Stop の記録の口 → 「配信を終える」の saveFinal 2、`/api/memory-record` の前提に場を開くを足した 3(期待値そのものは不変)、耳の Stop → 保存の最小ハーネスの書き直し 1、Domain B の結線テスト(置き場の準備を場の始まりへ)1、メイン画面の配信前の表示 1、`settingsFromSnapshot` の `stream` 1。

## 4. 約束のテスト(レビューで確認)

- 始めるの 7 段・終えるの 4 段の並びを events の列で固定(テスト 1・15)。器につながらないときの断りと畳みは本物の `createLazyChannel` で(テスト 6)。体なしは器を見ない。YouTube の失敗でも開く。開いている間のロール・マイク・文字起こしは 409。
- **場の終わりのあと発火の予定が動かない**(設計 §9・棚卸し §5): 本物の `createFireScheduler` に偽のタイマを入れ、終えるとタイマが 0・発火を頼まないことを固定(テスト 22)。
- 走っていた判定・思い出しの結果が次の場に届いても発火しない(テスト 4・5。`reset` だけの実装なら落ちる)。
- 2 つ目の場で前の場の `lastRecordedSeq` に引きずられない・前の場の遅れた保存が新しい場の数えを上書きしない(テスト 24)。ロールを替えて始めると新しいロールの置き場に書く。
- Ctrl+C の 2 回目の打ち切り(テスト 20)。
- 前のドメインからの持ち越し 8 項目(A の 409、B の本体のファイル名・数え・置き場の準備・最後の保存の置き場、C の器につなぐかは体を見る・器の close はいつも・`--channel` の先充填)はすべて実装とテストあり。

## 5. 裁量(全 16 項目は domain-d-gnome.md §7。レビューはすべて筋が通ると評価)

- 場の状態と `openStream` / `closeStream` は cockpit-server、記録・頭のセッション・器・記憶は cockpit.mjs の `createStreamVenueHooks` が hook として渡す(今の橋渡しの流儀)。
- speak-now・コメント反応は `reset` ではなく作り直す(`reset` + 古い部品の `dispose`)。計画より強いが、走っている判定の結果が次の場で発火するのを防ぐのに要る(設計 §3 の 3 の趣旨)。
- 発火の予定は起動時と場の終わりで dispose し、自発の ON/OFF・口数の値の置き場として残す。閉じている間はタイマを張らない。
- 声のプレイヤーと engine は場の終わりで畳まない(設計 §3 の「畳む」の列に無い。鳴っている声は kill で止まる)。
- `--channel` の先充填をやめ、頭のセッションはいつも「配信を始める」で作る。起動の案内と HELP の `--channel` の文面を最小限直した。
- 置き場の準備(git init)は場の始まりで待ち、起動時と `onSetRole` では待たない(ロールの切り替えの応答を遅らせない)。
- 器の URL が無いときは、つながらないときと別の文面で断る。
- 終えるときの記憶の待ちの上限は Ctrl+C と同じ 90 秒。画面の「配信を終える」の HTTP 応答も保存が済むまで返らない(その間 SSE が closing を流す)。
- `/api/ears/start` の別名は、開いている間の 2 回目が 200(冪等)→ 409 に変わる。
- YouTube の「前もって入っていれば」を「設定に保存してある前回の URL」と読んだ(→ §7 質問 1)。

## 6. 持ち越し

- **Domain E へ**:
  - 設定のダイアログの「今日を記録」は今も押せ、閉じている間は 409 の文面が出るだけ(記憶のタブで開いている間だけ押せる見た目にする)。マイク・文字起こしの固定は disabled だけ(たたむ等は E)。
  - 始められなかった理由はメイン画面の中央と、設定のダイアログの Start のエラー欄の両方に出る。どちらを正にするか。
  - 上の帯の状態のピルは耳の状態のまま。ロールの名前を出すときに場の状態(開きかけ・記録中)を出すか。
  - 使える値: snapshot の `stream`・`memory.recording`、`view-logic/glance-meters.mjs` の `streamPhaseOf`。
  - 場が閉じている間の手動 Fire で頭のセッションが立ちうる(設計に記述なし。運転タブを組み直すときに決める)。
- **仕上げ(全体の突き合わせのあと)**:
  - README の Start / Stop・`/api/ears/*`・`--channel` の記述、`view-logic/settings.mjs` と `cockpit-server.mjs` の JSDoc の一部が古い言い方のまま。
  - `openStream` / `closeStream` の本体に try/finally が無く、想定外の throw で場の状態が opening / closing のまま固まりうる(レビューの止めない指摘。根拠の無い端として持ち越し。全体の突き合わせで見てほしい)。
  - `main()` の結線テストがソース文字列の照合で書き換えに弱い(Domain B・C と同じ)。
- **人間ゲート(計画 §6 の 2・3・5)**:
  - runtime-player を起動しないで「配信を始める」→ 中央に赤い枠で「体の器(runtime-player)につながらない — runtime-player が起動していないか、channel が開いていない。…」が出て、場は開かない。起動して channel を開いてから押し直すと開く。
  - 頭のセッションの立ち上げ(約 12 秒)が場の始まりに乗る。場はすぐ開くが、最初の返事はそれを待つ。
  - 「配信を終える」は 2 回押し → 「配信を終えています…」「記録中…」→ 最大 90 秒で「配信を始める」に戻り、`memories/chappy/` の git にコミットが積まれる。Ctrl+C でも同じ並び。
  - 保存してある前回の YouTube の URL があれば「配信を始める」で自動でつなぎ、終わった動画なら「チャットが切れている」の警告が出うる(場は開く)。
  - 残リスク: 考えている最中に終えると「頭のエラー」の一回きりの警告が出うる(場は正しく閉じる)。ElevenLabs の声の接続は場の間もつながったまま(Ctrl+C で畳む)。

## 7. 質問(Undine へ。どれもループを止める分岐ではない。レビューも裁量で足りると評価)

1. **YouTube の「URL が前もって入っていれば」**を「設定に保存してある前回の URL」と読んだ。前回の配信の URL が残っていると、場を開くたびに古い URL につなぎにいき、警告が出うる(場は開く)。scope §19「場を開いたあとで URL を入れることがほとんど」に寄せて「この起動で場を開く前に Connect 済みのものだけ」と読むなら、`connectSavedChat` の数行で直せる。Orch-Sylph の意見: ユーザーのふだんの流れ(開いたあとで新しい URL を入れる)では、前回の URL に自動でつなぐ利点が薄く、警告のほうが目立ちうるので、後者の読みのほうが体験に合うかもしれない。ユーザーに確かめるか、人間ゲートで見て決めるか。
2. speak-now・コメント反応の判定部品を `reset` ではなく作り直す形(計画の文面より強い手当て)を追認してよいか。
3. `--channel` で起動したときの頭のセッションの先充填をやめ、いつも「配信を始める」で作る形でよいか(設計 §3 の 5 に沿う読み。最初の返事が場の始まりのセッションの立ち上げを待つ)。
