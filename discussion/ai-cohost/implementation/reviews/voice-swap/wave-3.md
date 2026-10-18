# 声の差し替え Wave 3 レビュー(Domain D / E の軽い突き合わせ)

> Review-Sylph(1 レーン・読み取り専任)→ Undine。対象: 未コミットの作業ツリー(直前コミット 6ac2814e)。計画: [../../orchestration/voice-swap-wave-plan.md](../../orchestration/voice-swap-wave-plan.md) §3・「D と E の接点」・「Wave 2 からの申し送り」。報告は説明に頼らず diff とテストで確かめた。本物の ElevenLabs API は叩いていない。

## 判定

**合格**(契約の食い違いなし)。人間ゲート前に直したほうがよい小さな差分が 3 件あるが、いずれも計画の完了条件を壊さない。

## テスト

| 対象 | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | 1463 件 / pass 1463 / fail 0 / skipped 0 |
| ルートで `pnpm run check:soul-zone` | 成功(1509 ファイル、器→魂・魂→器の import なし) |

(`check:soul-zone` は apps/soul/agent の package.json にはなく、リポジトリルートのスクリプト。)

## 遅延の重点確認(最初の音 298ms)

**結論: コード上、最初の文の最初の音を遅らせている箇所は見つからない。** 298ms は、棚卸しの 128〜138ms との差が約 160ms あるが、報告のとおり「接続直後の 1 回目」の冷えた測定と読むのが妥当。人間ゲート 3 で 2 回目以降を見るのが筋。

- (a) 読み(`/accent_phrases`)は送信と**並行**。`elevenlabs-voice-engine.mjs:669` で `startReadings(job)` を起こし、`:683` の `pump()` が本文 + flush を同期で送る。`startReadings` の fetch は `Promise.resolve().then(...)`(`:501-502`)で microtask に回るので、送信のほうが先に出る。読みの実測は 5〜16ms(`tts-client.mjs` の注記)で、最初の音(約 300ms)より十分早い。
- (b) 最初の audio は読みも時間割も**待たない**。audio は届いたらそのまま `yield`(`:554-557`)。待たされるのは timeline だけで、alignment は builder ができるまで `pendingAlignments` に溜まる(`:560-563`)。builder は `readings` 事象か `final`(`:568-575`)で作る。読みが 10ms 台で返る通常時は、最初のメッセージの時点で builder があり、同じメッセージの audio → timeline が隣り合って出る(実測も audio 298ms / timeline 303ms)。
- (c) 前の文の `is_final` を待つ直列化(`:422` の `current !== null` で待つ)は、最初の文には効かない。最初の文は `current === null` なので即送信。効くのは 2 文目以降。

**最初の音を遅らせうる場所**(いずれも通常時は起きない・修正は任意):

1. **barge-in 直後の最初の返事**: 送ったあとの文を中止すると接続を切ってつなぎ直す(`:322-330`)。新しい接続が open するまで(実測 185ms 前後)`ready=false` で次の文が待つ(`:421-422`、`:674-683`)。割り込み後の最初の返事が約 0.2 秒遅れる。止める手段が無いので避けにくい。人間ゲート 4 の体感で見る。
2. **AivisSpeech が応答しないとき**: 読みの上限は 2 秒(`readingsTimeoutMs`、`:71-72`、`:497-500`)。音は出るが timeline は `final` まで出ず(`:575` の `await job.readings`)、器の安全網(データ切れ 2000ms)と重なると口が途中で閉じうる。拒否(接続不可)なら即フォールバックするので、ハングのときだけ。
3. **2 文目以降**: 前文の `is_final` 後に次を送るので、前文が非常に短い(0.5 秒程度)と、次の音が前文の再生終了に間に合わず小さな隙間が出る可能性がある(概算: final まで約 350ms + 次の最初の音まで約 300ms)。実時間 9 倍で届くので 1 秒以上の文では隠れる。

## 差分(修正するならここ)

| # | 箇所 | 内容 | 修正指針 |
|---|---|---|---|
| 1 | `scripts/cockpit.mjs` の `createVoiceEngineManager.prepare` / `elevenlabs-voice-engine.mjs` | `onDiagnostic` が工場の deps に渡っていない(E の自己申告どおり)。`elevenLabsDeps()` は readingClient / ttsBaseUrl / speaker だけ。接続失敗・切断・サーバーエラーの理由(`code=1006` など)が操縦席のどこにも出ない。`tts-reconnecting` / `tts-down` の detail が、Start 失敗以外では常に null。 | manager の deps に `onDiagnostic` を足し、`cockpit-server` の `setVoiceEngineStatus` の `reason` へ流す(`ttsDisconnected` / `ttsConnectFailed` / `ttsServerError` の reason を最後の理由として保持。reason は決まった語彙・code・識別子のみで本文もキーも入らないのは D がテストで固定済み)。D の質問 3・E の質問 2 への答えは「出してよい」。 |
| 2 | `scripts/cockpit.mjs` の `prepare`(`engine != null && engineKind === kind` で使い回し) | ファイル冒頭の注記は「ElevenLabs のキーも Start のたびに読む」だが、同じ種類なら読まない。無効なキーで `down` になった engine は、キーを直して Stop → Start しても古いキーのまま裏でつなぎ直し続ける。 | `engineKind === "elevenlabs"` かつ `engine.status === "down"` のときは `drop()` して作り直す(キーを読み直す)。注記も実態に合わせる。 |
| 3 | `elevenlabs-voice-engine.mjs:466-472` | 同じメッセージ内で audio を先に、alignment を後に積むので、timeline が音より後に出る(数 ms 差)。Wave 1 申し送り 2(append は音声より先に)の趣旨は、engine が読みを待たなければ完全には守れない。実害は小さい(器の open は最初の音より前に受理済み)。 | 同一メッセージ内では alignment を先に push する(builder が既にあれば timeline が先に出る)。読み待ちのときの改善には、最初の audio から短い上限(例 250ms)で簡易版に倒す手もある。 |

## 注記(確認済みの良い点・参考)

**D(計画どおり)**
- keep_alive: 最後の送信から 10 秒(`:184-192`)、受信では延長しない。再接続 1s→15s の倍々、open で戻す(`:221-229`、`:283`)。キーはヘッダのみ(`:264`)、URL に載らない。`voice_settings` は open 直後の最初のメッセージにだけ(`:284`)。`pcm_24000`・`language_code=ja`・`sync_alignment=true`(`:82-91`)。
- 直列化: `pump` が前の `is_final` 後に 1 本ずつ(`:421-439`)。end 後の abort は無視(`:378`、`:389-390` の状態ガード)。送信済みの文の中止だけ接続を切ってつなぎ直す(`:399`)ので、一斉 abort でも再接続は 1 回(送信済みは高々 1 本)。本物の SpeechStreamer に載せた barge-in テストあり。
- 口の時間割: 区間化(かな / 漢字・英数字 / 句読点 / 記号 / タグ)、`pau` 組分け・錨・数の比、簡易版、`alignmentLeadMs`、4096 上限、食い違い時の簡易版(`elevenlabs-timeline.mjs`)。タグ・句読点の区間は `s:0` で閉じ、次の声の 80ms 前に再び `s:0`(`:543-554`)。器が隣の要素間を補間するための裁量で、妥当(D の質問 1 は「よい」)。
- `onReadingsFallback` は文ごとに 1 回、cancelled の文には呼ばない(`:530-539`)。`readingClient: null` は通知なしで常に簡易版。
- 秘密: キーも本文もトレース・診断に出さない(字数のみ)。`process.env` は D / E とも触っていない。

**E(計画どおり)**
- `ttsEngine` の設定・UI(入出力タブの STT の下)・Start の body・`state.tts` による復元。保存層は文字列素通し、不明値は `createTtsEngineHooks` で aivis へ。API は不明値を 400(STT と同じ)。
- Start で `onPrepareVoiceEngine` → `prepare(kind)`。同種は使い回し、違えば購読解除 → dispose → 作り直し(Wave 2 申し送り 2)。終了時 `voiceEngines.dispose()`。古い engine の status 通知は捨てる(`engine === made` ガード)。
- 警告: `tts-reconnecting`(warn)/ `tts-down`(alert)は ElevenLabs のときだけ(`cockpit-server.mjs` の `refreshStateWarnings`)。`tts-readings-fallback`(warn・60 秒の出来事・detail なし)。
- キー: manager が `loadElevenLabsApiKey()` で読み、`apiKey` として engine に渡すだけ。state・SSE・警告・Start 失敗理由(固定文言)に載らない。
- 遅延の凡例: TTS「声を頼んでから最初の音が届くまで」/ 声「最初の音が届いてから鳴り始めるまで」を title で添付。棒の title と標準出力に engine 名。区間キー `ttsMs` / `voiceMs` は不変。

**D と E の接点**: `createVoiceEngine("elevenlabs", { readingClient, ttsBaseUrl, speaker, apiKey, onReadingsFallback })` は D の `ElevenLabsVoiceEngineDeps` と一致し、実際につながっている(`onReadingsFallback` → `server.reportVoiceReadingsFallback()`、`onStatus` → `setVoiceEngineStatus`)。未配線は `onDiagnostic` のみ(差分 1)。

**その他の観察(判断は Undine)**
- 耳を Stop しても ElevenLabs 接続は残り、keep_alive が続く(E 裁量 2)。keep_alive は課金されない前提だが、人間ゲート 5(数分の無言で残量が減らないか)で実測確認が要る。
- 喋っている最中に種類を変えて Start すると古い engine の dispose で声が切れる(E のリスクどおり。運用外でよい)。
- 前の文の先送り(`is_final` を待たずに続けて送る)で隙間を詰められる可能性はあるが、alignment の帰属と「送信済みは高々 1 本」の前提が崩れるので、今回は勧めない。人間ゲート 3 で隙間が体感されたときの案。
