# 声の差し替え Wave 3 / Domain D — ElevenLabsVoiceEngine 完了報告

> Gnome → Undine（2026-10-18）。計画: [../../orchestration/voice-swap-wave-plan.md](../../orchestration/voice-swap-wave-plan.md) §0・§3 Domain D・「D と E の接点」・「Wave 2 からの申し送り」1・3・4。
> コミットはしていない。依存・環境は変えていない（WebSocket は Node 標準の `globalThis.WebSocket`）。`src/cockpit/`・`scripts/cockpit.mjs`・UI・warnings・`apps/runtime-player` には触れていない（作業ツリーにあるそれらの差分は Domain E のもの）。

## 1. 変更したファイル（すべて `apps/soul/agent/` 配下）

新規:

- `src/voice/engines/elevenlabs-voice-engine.mjs` — `createElevenLabsVoiceEngine`、`buildElevenLabsTtdUrl`、`ELEVENLABS_TTD_URL`、`ELEVENLABS_TTS_DEFAULTS`
- `src/voice/engines/elevenlabs-timeline.mjs` — 口の時間割の純関数と、文字時刻を受けながら時間割を出す組み立て器
- `src/voice/engines/elevenlabs-voice-engine.test.mjs`（22 件）
- `src/voice/engines/elevenlabs-timeline.test.mjs`（14 件）
- `src/test-support/fake-clock.mjs` — 期限つきの偽の時計（`advance(ms)`）。keep_alive・再接続・待ちの上限など、種類の違うタイマを同時に扱うため

変更:

- `src/voice/engines/voice-engine.mjs` — `VOICE_ENGINE_FACTORIES.elevenlabs` の登録と、deps の型 `ElevenLabsVoiceEngineDeps`、説明文
- `src/voice/engines/voice-engine.test.mjs` — kind の一覧が `["aivis","elevenlabs"]` になったので期待値を変えた。elevenlabs を作る 1 件を足した
- `src/voice/tts-client.mjs` — `accentPhrases(text, {signal})` を足した（`POST /accent_phrases`・合成なし）
- `src/voice/tts-client.test.mjs` — 1 件を足した
- `src/voice/mora-timeline.mjs` — `resolveSByVowel` に `export` を付けただけ（母音ごとの開き量と sConfig の解決を共有するため）

既存の `fake-websocket.mjs` はそのまま使った。

## 2. engine の振る舞い

### 接続

- `wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?model_id=eleven_v4_turbo&output_format=pcm_24000&language_code=ja&sync_alignment=true` に繋ぐ。
  - キーはヘッダ `xi-api-key` にだけ載せる。URL には載せない。
- engine を作った時点で繋ぎ始める。操縦席の Start で作られる前提（Domain E の作りと合っている）。
- open したら、最初のメッセージ `{voices:[voiceId]}` を送る。
  - voice_settings は、deps で渡されたときだけここに載せる。既定では送らない。
- 最後に何かを送ってから 10 秒経つと `{"keep_alive": true}` を送る。本文を送るたびに数え直す。
- 状態の動き:
  - 初めは `connecting`。open したら `up`。
  - 最初の接続に失敗したら `down`。
  - 繋がった後に切れたら `reconnecting`。
  - `down` と `reconnecting` のどちらも、裏で 1s → 2s → … → 15s の間隔で繋ぎ直しを続ける。繋がれば `up` に戻り、間隔も 1s に戻る。
  - キーが空なら `down` のまま繋がない。synthesize は `elevenlabs_api_key_missing` で失敗する。
  - `dispose()` で `down` になる。

### 文の送り方

- synthesize は、呼ばれた順に文を列に積む。前の文の `is_final_audio_for_turn` が届いてから、次の文の `{inputs:[{text, voice_id}]}` と `{flush:true}` を送る。送った順に受け取ることになる。
- 出す列の順:
  1. `format`（24000Hz、モノラル）を最初に 1 回出す。
  2. 届いた音（PCM。奇数バイトになったら端の 1 バイトを次へ持ち越す）と時間割を、届いた順に出す。
  3. `is_final_audio_for_turn` で `end` を出す。
- 読み（`/accent_phrases`）は、文を受けた時点で送信と並行して取りに行く。
- 失敗するときの code:

| 状況 | code |
|---|---|
| 送った文の途中で接続が切れた | `elevenlabs_tts_disconnected` |
| 繋がらないまま 5 秒待った | `elevenlabs_tts_unavailable` |
| 送った後、便りが 10 秒途絶えた（このときは繋ぎ直す） | `elevenlabs_tts_turn_timeout` |
| サーバーがエラーを返した（このときは繋ぎ直す） | `elevenlabs_tts_server_error` |

- 繋ぎ直しの待ち時間中に文が来たら、待たずにその場で繋ぎ直しを試す。

### 中止（申し送り 1）

- `end` を出した後の abort は無視する。is_final が届いた時点でその文は「終わり」になる。
- まだ送っていない文の abort は、列から外すだけにする。
- 送った後でまだ終わっていない文の abort では、接続を切ってすぐ裏で繋ぎ直す。状態は `up` のまま変えない。繋ぎ直しに失敗したときだけ `reconnecting` になる。
- 送った後でまだ終わっていない文は、いつでも高々 1 本しかない。そのため barge-in で全文が一斉に abort されても、切断と再接続は 1 回にまとまる。これはテストで固定した（終わった文・送った文・待ちの文の 3 本で、接続は 1 本だけ増える）。
- 消費者が `end` の前に読むのをやめた場合も、abort と同じに扱う。

### 秘密と本文

- キーと本文は、トレースにも診断にも載せない。載せるのは字数・バイト数・要素数だけ。
- 診断（`onDiagnostic`）の中身:
  - reason は、決まった語彙・close code・サーバーの `error` の識別子だけ。識別子は `[a-z0-9_]` の形のものだけを通す。
  - message はいつも null。
  - サーバーの message 文と close の reason 文は載せない。
  - テストで、キーと本文を含む close reason を送り、どちらも出ないことを確かめた。

## 3. 口の時間割の作り方

1. **通し値に直す。** alignment はかたまりごとに 0 から数え直すので、それまでのかたまりの「最後の文字の開始 + 長さ」を足して通し値にする。文字はコードポイント単位で本文と突き合わせる。
2. **区間に束ねる。** 区間の種類は次の 5 つ。
   - かな
   - 漢字・英数字
   - 句読点
   - 空白・括弧などの記号
   - タグ（`[...]` と後ろの空白）

   声の区間（かな・漢字等）は 1 つずつ扱い、黙る区間（句読点・記号・タグ）は続いた分を 1 つにまとめる。
3. **読みのモーラを区間に割り付ける。**
   - 読みは、タグを除いた本文で取る。
   - 読みを `pau`（と pause_mora）で組に分ける。本文を句読点で分けた組と数が合えば組ごとに、合わなければ文全体を 1 組にする。
   - 組の中では、かなの区間を読みの中から探して錨にする。一致はゆるく取る（は → ワ、を → オ、長音 ↔ 母音）。
   - 錨と錨の間のモーラを、漢字・英数字の区間に渡す。漢字等の区間が複数並ぶときは、字数の比で分ける。
   - 錨が見つからない組は、数の比（かな = そのモーラ数、漢字等 = 字数 × 2）で順に配る。
   - 区間の中ではモーラを均等に置く。ん・っ は要素を出さず、時間の枠だけ使う。
4. **開き量。** mora-timeline の `DEFAULT_S_BY_VOWEL` を使う（sConfig も効く）。
5. **簡易版（読みが取れないとき）。**
   - 読みの口が失敗したとき、2 秒の上限を越えたとき、返りの形が違うときに使う。
   - かなは表で母音を引く。漢字・英数字は、区間の始まりで a に開き、真ん中で閉じる。
   - 文ごとに `onReadingsFallback()` を 1 回呼ぶ。
6. **alignmentLeadMs を足す。** timeMs は整数で、厳密に増えるようにする。
7. **出すタイミング。** 区間の文字時刻が揃った所から出す。音より先に出ることもある。
8. **上限。** 発話全体で 4096 要素を超えない。上限に達したら、最後の 1 枠で口を閉じて打ち切る。
9. **本文と alignment の文字が食い違ったとき。** そこから先は、文の終わりで届いた文字から簡易版を作って出す。

例（実機で `うん、先に行こう。`）:

| 区間 | 母音 |
|---|---|
| うん | u, - |
| 、 | （黙る） |
| 先 | a, i |
| に | i |
| 行 | i |
| こう | o, o |
| 。 | （黙る） |

出た時間割:

`0u 160u_ 480a_ 560a 720i 880i 1000i 1120o 1240o 1360o_`

`_` は `s:0`（口を閉じる要素）。

## 4. deps の最終形

```
createVoiceEngine("elevenlabs", {
  apiKey,                    // 必須（空なら down）
  voiceId?, modelId?, outputFormat?("pcm_<rate>"), languageCode?,
  readingClient?,            // {accentPhrases(text,{signal})}。省略時は AivisSpeech（ttsBaseUrl?/speaker?）。null で読みなし
  alignmentLeadMs?,          // 既定 0
  onReadingsFallback?,       // () => void。文ごとに 1 回
  onDiagnostic?,             // ({type, reason, message:null}) => void
  voiceSettings?, sConfig?,
  WebSocketImpl?, setTimeoutImpl?, clearTimeoutImpl?, baseUrl?,
  keepAliveIntervalMs?, reconnectInitialDelayMs?, reconnectMaxDelayMs?,
  connectTimeoutMs?, connectWaitMs?, turnIdleTimeoutMs?, readingsTimeoutMs?
})
```

Domain E の `createVoiceEngineManager` は `{apiKey, readingClient: createTtsClient(...), onReadingsFallback}` を渡している。この形と合っていることを、読んで確かめた。

## 5. テスト

| 対象 | 結果 |
|---|---|
| apps/soul/agent `node --test` | 1463 件すべて成功（Domain E の作業中のテストを含む） |
| `check:soul-zone` | 成功（1509 ファイル） |

足したテストは 38 件。

- timeline 14 件:
  - 区間化
  - モーラ分け
  - 読みの組分け
  - 錨での割り付け
  - 組の数が合わないとき
  - 錨が見つからないとき
  - 簡易版
  - 通し値化と、区間が揃ってからの出力
  - タグで閉じること
  - lead
  - 食い違い
  - 上限
- engine 22 件:
  - URL・ヘッダ・voices・voice_settings
  - format / 音 / 時間割 / end
  - 直列化
  - end 後の abort を無視すること
  - 一斉 abort での再接続が 1 回だけで、状態が up のままなこと
  - 送る前の abort
  - 消費者が途中でやめたとき
  - keep_alive
  - 1s→15s の再接続と、間隔のリセット
  - 最初の接続に失敗したときの down
  - 待ちの上限と、待ち中の前倒し
  - サーバーのエラー
  - 文の時間切れ
  - 読みが失敗したときと、時間切れのとき
  - 読みの口が null のとき
  - キーがないとき
  - dispose
  - 秘密
  - 工場関数
  - 本物の SpeechStreamer に載せて、2 文の器への送信と barge-in
- voice-engine 1 件、tts-client 1 件。
- 期待値を変えた既存テストは `voice-engine.test` の 1 件だけ。kind の一覧が増えたことと、"elevenlabs" が投げなくなったこと（知らない kind の例を "nope" にした）。

## 6. 実機確認（2026-10-18、1 回）

使ったスクリプトは scratchpad の `real-tts-engine.mjs` で、リポジトリには入れていない。キーは `loadElevenLabsApiKey()` で読み、表示も保存もしていない。

| 項目 | 値 |
|---|---|
| 接続（作ってから up まで） | 185ms |
| synthesize から最初の音まで | 298ms |
| synthesize から最初の時間割まで | 303ms |
| 文の終わりまで | 492ms |
| PCM | 80,640 byte（1.68 秒） |
| 時間割の作り方 | 読みあり（簡易版にはならなかった） |
| 要素数 | 10 |
| 本文と alignment の食い違い | なし |

- 12 秒何もしなかった後も up のまま（keep_alive が効いた）。
- 再生と器は使っていない。
- **最初の音までの 298ms について。** 棚卸しの実測（128〜138ms）より遅い。今回は接続直後の 1 回目で、1 回しか測っていない。人間ゲート 3 の遅延バーで見てほしい。
- **使ったクレジット。** 9 文字なので約 2 の見込み。残量の表示は前後とも 5,232 で、まだ反映されていなかった。

## 7. 裁量判断

1. **黙る区間は `s:0` の要素で口を閉じる。** 計画には「タグの区間は口を閉じる（要素を出さない）」とある。しかし器は隣り合う要素の間を補間する（`speech-timeline-state.ts`）ので、要素を出さないだけでは、口は開いたまま次の母音へ移ってしまう。そこで次のようにした。
   - タグの区間に母音の要素は出さない。
   - 黙る区間の始まりに `s:0` を置く。
   - 次の声の区間の 80ms 前（`SILENCE_REOPEN_LEAD_MS`）に、もう一度 `s:0` を置く。
   - 文頭は長さによらず閉じる。文中は 100ms 以上（`SILENCE_CLOSE_MIN_MS`）のときだけ閉じる。文末は始まりで閉じる。
   - 句点で終わらない文は、音の終わりで閉じる。

   契約の s は 0 を許すので、器側の変更は要らない。人間ゲート 2「区切りやタグの所で閉じる」を満たすための判断。
2. **送信を直列にした。** 前の文の is_final を待ってから次の文を送る（先送りはしない）。ElevenLabs は実時間の約 9 倍で届くので、2 文目以降は前の文が鳴っている間に揃う。
3. **中止したときの繋ぎ直しでは状態を変えない（up のまま）。** barge-in のたびに `tts-reconnecting` の警告がちらつかないようにするため。
4. **最初の接続に失敗したら `down` にし、それでも裏で繋ぎ直しを続ける。** STT は最初の失敗で止まるが、人間ゲート 6「戻るとまた鳴る」に合わせた。
5. **3 つの待ちの上限を新しく置いた。**
   - 繋がらないときの文の待ち: 5 秒
   - 送った後に便りが途絶えたとき: 10 秒
   - 読みの待ち: 2 秒

   SpeechStreamer には合成の待ちに上限がないため、Fire が止まったままにならないようにした。
6. **割り付けで、かなを錨にした。** 計画の「pause_mora を手がかりに区間へ」に加えた工夫。漢字が複数並ぶ文でも、区間ごとの読みが合いやすくなる。
7. **本文の前後の空白は削ってから送る。** 空白だけの文は、送らずに format → end で終える。

## 8. 残るリスク

- 割り付けの錨は、最初に一致した所を採る。漢字の読みの途中に、後ろのかなと同じ並びがある文では、ずれることがある（まれ）。ずれても声の区間の中だけで、時間の区切りは崩れない。
- ElevenLabs の実際の読みと AivisSpeech の読みは、英字・数字でずれることがある（inventory §4）。モーラの数は AivisSpeech の側に従う。
- TTD の接続の最大時間は、まだ確かめていない。切れたら繋ぎ直しで戻る。
- `scripts/cockpit.mjs` の遅延のイベント名は、streamer が出す共通の名前で動く。この engine は追加で `voice.elevenlabs.*` のトレースを出す（本文なし）。

## 9. 質問

1. **黙る区間を `s:0` で閉じてよいか**（裁量 1）。計画の文言「要素を出さない」とは違う。
2. **最初の音までが 298ms だった**（棚卸しは 128〜138ms）。1 回しか測っていないので、人間ゲート 3 で確かめる扱いでよいか。
3. **Domain E の質問 2 について。** 診断の reason には本文もキーも入らないことを保証した（§2「秘密と本文」・テストあり）。E が `tts-reconnecting` の detail に `code=1006` などを出してよいかは、Undine の判断を仰ぎたい。
