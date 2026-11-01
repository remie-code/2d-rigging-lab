# Domain I 完了報告 — 体験と VC 接続を分ける(Orch-Sylph 2026-11-01)

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格・Undine への質問 4 つ〔止めない・裁量として仮に決めたもの〕)。
> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §8 Domain I。設計: [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §13.2・§13.3。
> 実装: Gnome(opus)→ [domain-i-gnome.md](domain-i-gnome.md)(境目・API・裁量 16 件・申し送りの詳細はこちら)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-i.md](../../reviews/discord-mode/domain-i.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `ed1fff64`)。鍵(`.env*.local`)は誰も読んでいない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`)には触れていない。操縦席の起動・本物の Discord / LLM / 外部 API の呼び出しなし。依存・lockfile の変更なし。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2229 / 2229 pass**(2199 から +30)。Gnome とレビューの両方で実行。新しいテスト 3 本は Gnome が 5 回続けて回して毎回通った |
| 根で `pnpm run check:soul-zone` | pass(1615 files) |
| 固定テスト `stream-wording-pin` と `src/mind/fixtures/` | pass・fixture 差分 0(レビューが確認)。②④の文面・`_conventions.md`・種のファイルも変更なし |
| `package.json`・`pnpm-lock.yaml` | 差分 0 |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 実装: `src/discord/discord-experience.mjs`(塊 `s` を体験の分 `x` と接続の分 `c` に割る)、`src/cockpit/cockpit-server.mjs`(`POST`/`GET /api/discord/vc`・`pauseVenueEars`・not-in-vc の断り・`noteVenueVcEvent`・snapshot の `outside`/`vcName`)、`scripts/cockpit.mjs`(差し口に鳴らない口 `HELD_VENUE_PLAYER` を残す `dispose({hold:true})`)、`src/cockpit/view-logic/discord.mjs`(「VC の外で待っている」の語だけ)、`src/mind/session-usage-log.mjs`(`USAGE_CONTROL_KINDS` に `vc-moved`・`vc-kicked`)。
- 偽物: `src/test-support/fake-discord.mjs`(閉じのコード・`moveBot`・`kickBot`・voiceStates・member・チャンネルの guildId・`reusedJoins`。`entersState` を本物と同じく上限で reject に)。
- テストの新規: `src/discord/discord-experience-discord-i.test.mjs`(17)、`src/cockpit/cockpit-server-discord-i.test.mjs`(9)、`scripts/cockpit-discord-i.test.mjs`(4)。

## 3. 作ったもの(要点)

- **体験の分**: client・guild・部品・botId・耳の束(体験の間 1 つ)・`seq`・client の `VoiceStateUpdate`。**接続の分**: connection・接続のイベント・receiver・speaking・人ごとの耳・出口・切れたあとの猶予のタイマ。
- **抜ける**: 接続の購読を先に外す → 鳴っている返事を `interrupt()` → 人の耳を drop → 出口を hold つきで畳む → destroy。耳の束は畳まず、ログアウトしない。**移る**: 移る先を先に確かめてから抜ける + 入る。`handleVoiceState` は今いる VC を見る。
- **VC にいない間**: 耳は `"stopped"`(`pauseEars`。`venueSttEngine`・`startedAtMs` は残す)。自発・手動(声・視覚つき)は接続が `outside` / `joining` のとき `not-in-vc` で断り、`reportFireRefused` で 1 回だけ記録。手動は 409。差し口が空にならないので手元の再生器は作られない(鳴っている途中に抜けた場合を含めテストで固定)。
- **外から**: 4014 は 5 秒の猶予ののち、戻っていなければ `outside`(動かされたときの 4014 は状態の知らせの前にも後にも来うるので、猶予の終わりに今の状態を見る。両方の順を偽物で確かめた)。Bot 自身が VC の外へ出た知らせは猶予なしで `outside`。それ以外の切れは今と同じく「切れた」。動かされたら動いた先を追い、前の VC の人の耳を drop。自分で抜けた・移ったときに「切れた」は出ない。
- **「通話を終える」**: VC の中・外・移った先のどれでも場を閉じて記憶を書き、ログアウトする。準備の `discordChannelId` は書き換えない。VC の入る・抜ける・移るで `renewRecords` を呼ばない(どちらもテストで確認)。
- **記録**: `control` に `vc-join`・`vc-leave`・`vc-move`・`vc-moved`・`vc-kicked`・`vc-disconnect`。名前・id は載らない(実際の記録関数を通してテスト)。
- **配信の場**: `vcName`・`connection` は null、手動の Fire は断られない(テスト)。

## 4. 期待値を変えた既存テスト(レビューが diff の `-` 行を全部洗って一致を確認)

| ファイル | 変更 | 理由 |
|---|---|---|
| `src/cockpit/cockpit-server-discord-d.test.mjs:329` | `VENUE_CONNECTION_STATES` の一覧に `"outside"` を足す | 設計 §13.4 の「VC の外で待っている」の語の追加 |
| `src/mind/session-usage-log.test.mjs:324-334` | `USAGE_CONTROL_KINDS` の一覧に `vc-moved`・`vc-kicked` を足す | 動かされた・4014 を `control` で分けるため(H の申し送りの手順どおり) |

- どちらも語彙の追加。ほかに削った・書き換えた assert は 0。

## 5. 裁量(Gnome。レビューはどれも設計に反しないと評価。全 16 件は Gnome 報告 §5)

主なもの: 4014 の 5 秒の猶予／Bot 自身の外への知らせで即 `outside`／`vc-disconnect` の記録は猶予のあいだ戻らなかったときに 1 回／`joining` の間も発火を断る(`disconnected` は今のまま断らない)／API は 400・404(同じサーバーの VC でない)・409(場が open でない・状態が合わない・操作の途中)・502(入れない)・503(入口が無い)、成功は snapshot／VC にいる間の join・いない間の move は 409(読み替えない)／移る先を先に確かめ、使えなければ抜けない／「聞いていない」は既存の語 `"stopped"`、稼働時間は外の間 0・入り直すと体験を開いた時から／`stream.vcName` は 100 字まで／VC 一覧の `people` は Bot 自身を除く。

## 6. 持ち越し(止めない)

- `main()` の結線そのものは実行テストでは見ていない(E の正規表現テストが固定・レビューが読んで確認)。手元で鳴らないことは人間ゲート 3 で実機確認。
- `hushVoice` と本物の orchestrator の結合は未テスト(同期で `interrupted` が立つので競合しない見立て)。
- 場を閉じる途中に終わった VC 操作の遅れた合図が、閉じたあとに `control` を 1 行書きうる(害なし。J で `x.closed` を見るとよい)。
- whisper の口の番号の使い回し(抜けてすぐ入り直す)【推測】、話している途中に抜けた人の VAD の `speechEnd`、本物の Discord での「画面で動かす」の 4014 と状態の順 → 人間ゲート 3。
- `outside` の色・「聞いていない」の間の耳の表示の見せ方 → K。

## 7. J・K への申し送り

- **出来事の合図(J)**: 体験 → 場の口 `vcEvent(event)` → server の `noteVenueVcEvent(event)`(今は `control` を書くだけ。**ここで正本に出来事の行を足す**)。形 `{ kind, channelName?, fromChannelName?, name?, via? }`(id は来ない)。`kind`: `vc-join`(`via: "open" | "panel"`)・`vc-leave`・`vc-move`・`vc-moved`(`fromChannelName`・`channelName`)・`vc-kicked`・`vc-disconnect` / `vc-reconnect`・`person-join` / `person-leave`(`name`。Bot 自身とほかの Bot は除く)。`vc-join`(open)は場が `opening` の間に届く。`vc-moved` は名前を取るので少し遅れて届く。ログには種類と数だけ。
- **VC 一覧(K)**: `GET /api/discord/vc` → `{ channels: [{ id, name, people, current }] }`(体験の client の guild から。2 本目のログインなし。Discord の場が open でなければ 409)。id は API の応答にだけ載る(snapshot・ログには載せない)。
- **入る / 抜ける / 移る(K)**: `POST /api/discord/vc` `{ action: "join" | "leave" | "move", channelId? }`。成功は snapshot、失敗は `{ error, state }`。
- **snapshot(K)**: `stream.connection` に `"outside"`、`stream.vcName`。手動の Fire は VC の外で 409 `reason: "not-in-vc"`。画面の「押せない」は `stream.connection` が `outside` / `joining` のとき(server と同じ見分け)。

## 8. 質問(Undine へ。止めない・Gnome が仮に決め、レビューは設計に反しないと評価)

1. 鳴っている途中に VC を抜けると `interrupt()` で止めるので、soul の行に割り込みと同じ注記「…（遮られた）」が付く。VC から抜けた用の別の注記にするか(J の出来事の行と並んだ見え方は人間ゲート 3 で見られる)。
2. Bot 自身が VC の外へ出た知らせで、4014 を待たずに「VC の外で待っている」へ落とす。これでよいか。
3. 入る・移るの途中(`joining`)も発火を断る(出口がまだ無いため)。これでよいか。
4. 入り直したあとの耳の稼働時間は体験を開いた時から数える(VC の外にいた時間を含む)。VC にいた時間だけにするか。

## 9. 子エージェントの閉域

| 役 | agentId | 状態 |
|---|---|---|
| Gnome(opus) | `a7c5c87a22f2303a1` | 完了(SubagentHandback で報告・成果物 `domain-i-gnome.md`) |
| Review-Sylph(sonnet) | `a130c5e24182e6dda` | 完了(SubagentHandback で報告・成果物 `reviews/discord-mode/domain-i.md`) |
