# Discord 参加モード（チャッピーを VC に入れて聞く・しゃべる）のための外部調査（2026-10）

- 調査日: 2026-10-31
- 調査者: Sylph（外部ファクト調査。製品・範囲の判断はしない。選択肢と根拠を並べるだけ）
- 前提: Node 24.19 / Windows 11。discord.js 14.27.0、@discordjs/voice 0.19.2、@snazzah/davey 0.1.12、opusscript 0.0.8（`apps/soul/agent/package.json` で確認）。
- 重複回避: DAVE の制度、ライブラリ比較、ポリシー条文（Developer ToS 5(a)(b)(c)・12(a)、Policy 条 21 など）、Windows での入れ方、受信の数え方、#11653 の中身は前の 2 本（`discord-voice-bot-2026-10.md`＝以下「前回A」、`probe-external-2026-10.md`＝「前回B」）にある。ここでは繰り返さない。
- 表記: 出典つきは確認済みの事実。【推測】は推論。【未確認】は確かめられなかったこと。【実測】は今日このPCで私が動かして確かめたこと（リポジトリのコードは変えていない。試験用のスクリプトは作業用の一時フォルダだけ）。

---

## 0. 要約（10 行）

1. **声を流す**: 24kHz/モノの PCM でも、`createAudioResource(stream, { inputType: StreamType.Raw })` は 48kHz・ステレオ・s16le を前提にする。変換は自前（24k→48k は 2 倍化で済む。44.1k は別途リサンプラ）。opusscript 0.0.8 で足りる【実測: 20ms フレームのエンコード約 0.2ms】。
2. **ストリーミングで一番の落とし穴**: TTS の PCM が 5 フレーム（100ms）続けて途切れると、プレイヤーは自分で止まって Idle になる（`maxMissedFrames` 既定 5）。Idle になった後は同じ resource に足せない。`behaviors.maxMissedFrames` を大きくするか、先読みの余裕を持たせるか、文ごとに resource を作り直す必要がある【0.19.2 のソースで確認】。
3. **割り込みと「どこまで再生したか」**: `player.stop()` は最後に無音 5 フレームを送ってから Idle。`stop(true)` は即 Idle。`play(新しい resource)` は Idle を挟まず差し替え。`resource.playbackDuration`（実音声パケットだけを 20ms ずつ数える）が「送り出した長さ」の最良の手がかり。ただし聞き手に届いた時刻・実際に聞こえた長さを知る手段は見つからなかった【未確認】。
4. **1 つの VC に Bot 2 つ**: 1 Bot はサーバーごとに VC を 1 つだけ（discordjs.guide が明記。Discord 公式文書には明文なし）。別トークンの Bot なら同じ VC に入れる【推測。同じ VC に 2 つ入れた公開例は見つからず】。**同じプロセスで 2 クライアントを動かすなら `joinVoiceChannel` の `group` を Bot ごとに変えないと、2 つ目の呼び出しが 1 つ目の接続を使い回してしまう**【ソースで確認】。
5. **人ごとの文字起こし**: ElevenLabs リアルタイム STT は 1 接続 = 1 ストリーム。同時接続の上限はプラン別（Starter 9 / Creator 15 / Pro 30）、料金は $0.39/時、「送った音声の長さ」で課金（無音も課金）。自前 VAD で区切って「しゃべっている分だけ送る」形なら費用は話した時間分。ローカル（Zipformer/Parakeet）はこのリポジトリの実測で 1 発話 0.12〜0.36 秒なので、1 本のワーカーで数人をさばける見込み【推測】。
6. **ほぼ無音の発話**: 受信側で長さ 3 バイトの無音フレームを捨てる／短すぎる発話（先例は 400ms 未満）を捨てる／VAD で発話率を見る／Whisper を使うなら既知の幻聴文を除く、が先例の定番。ElevenLabs には `insufficient_audio_activity` エラーがある。
7. **最初の発話の頭欠け**: 0.19.2 は復号失敗を連続 36 回（約 0.72 秒）まで黙って捨てる設計。これを直す修正は入っていない。#11653 の修正 PR #11667 は 2026-10-31 時点でも未マージ（承認 3 つが必要）で、しかも「Bot が後から入って Welcome を受けた場合」の話。**人が後から入る場合の頭欠けを直す公開修正は見つからなかった**【未確認】。
8. **プライバシーポリシー**: 小さな Bot の先例は 1 ページの短い文書で、集めるもの・使い方・第三者（STT/LLM/TTS の社名）・保存期間・削除の頼み方・連絡先を書く形が多い。置き場は GitHub Pages が定番。blob や Gist を Discord が受け付けるかを示す一次情報は見つからなかった【未確認】。
9. 前回から変わっていない点: @discordjs/voice の最新は今も 0.19.2、davey も 0.1.12（`npm view` で 2026-10-31 に確認）。

---

## 1. 声を VC に流す（@discordjs/voice 0.19.2）

### 1.1 事実

**入力の形式と変換**（0.19.2 の配布物 `dist/index.js` を読んで確認）[1]

- `StreamType.Raw` は s16le PCM で、**48kHz・2ch・20ms=960 サンプルのフレーム**を前提に Opus へエンコードされる（prism-media の `opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 })`）。サンプルレートやチャンネル数を渡す口は無い。24kHz/モノの PCM をそのまま Raw で渡すと、速く高い音になる【推測。形式を宣言する引数が無いため】。
- `StreamType.Opus` は「すでに Opus パケットになった」ストリーム、`OggOpus`/`WebmOpus` はコンテナ付き。これらは Opus ライブラリ不要（デマルチプレクサは純 JS）。`Arbitrary` は FFmpeg で 48k/2ch の Raw か Opus に変換する [1]。
- prism-media 1.3.5 の `opus.Encoder` は、入力を溜めて 1 フレーム（3840 バイト＝960×2ch×2byte）ごとにエンコードする。**端数（1 フレーム未満）は終了時に捨てられる**（`_flush` が無い）。最大 19ms 分で実害は小さい [2]。
- 24kHz モノ→48kHz ステレオは、各サンプルを 2 回ずつ・左右に同じ値を書くだけで作れる（整数倍）。【実測】100ms 分（2400 サンプル）をそう変換して `Raw` の resource に入れると、実音声パケット 5 個（=100ms）が出て、その後は `read()` が null を返した。`resource.playbackDuration` は 100 になった。44.1kHz 系（Aivis の既定の可能性）は整数倍でないので、リサンプラ（ffmpeg の `-ar 48000 -ac 2` か自前）が要る【推測】。AivisSpeech の出力は WAV（非ストリーミング）で、サンプルレートはヘッダから読んでいる（`apps/soul/agent/src/voice/engines/aivis-voice-engine.mjs`）。ElevenLabs は `pcm_24000` モノ（`elevenlabs-voice-engine.mjs`）。
- **opusscript 0.0.8 で足りるか**【実測】: このPC（Node 24.19）で、48kHz ステレオの 20ms フレームを 500 個（=10 秒分）エンコードして 100ms、デコードして 29ms。1 本の発話ストリームなら CPU の 1% 程度。ただしエンコードはメインスレッド上で同期実行される（`_transform`）。`@discordjs/opus`（ネイティブ）が Node 24 用の prebuilt を持たない件は前回B。

**送り出しの仕組み（遅れ・無音）**[1]

- 全 AudioPlayer は**プロセスで 1 つの 20ms タイマー**（`audioCycleStep`、ドリフト補正つき）で駆動される。毎周期 resource から 1 パケット読む（`resource.read()`）。
- 読めなかったとき（データが間に合っていない）は**無音フレーム `F8 FF FE` を送り**、`missedFrames` を数える。**`maxMissedFrames`（既定 5）に達すると `stop()` を呼ぶ**。`stop()` は無音パディング 5 フレームを流してから Idle になり、resource は破棄される。**ストリーミング TTS の PCM が 100ms 以上途切れるだけで、そこで再生が終わる**。
- 再生が終わる（Idle になる）と `setSpeaking(false)` が送られる。公式文書も、止めるときは無音 5 フレームを送るよう求めている（前回A [2]）。
- 購読者（VoiceConnection）が Ready でない間は `noSubscriber: pause`（既定）で自動停止（AutoPaused）し、戻ると再開する。
- `createAudioResource` の `silencePaddingFrames` 既定は 5。

**止め方**（`AudioPlayer.stop` / `play` のソース）[1]

| 操作 | 動き |
|---|---|
| `player.stop()` | 無音パディングがあれば、次の周期から**実音声は読まず無音を 5 フレーム**（=100ms）流してから Idle。resource は Idle の時点で破棄 |
| `player.stop(true)` | 即 Idle。無音フレームは追加されない（`_signalStopSpeaking` だけ） |
| `player.play(新 resource)` | 再生中の resource を破棄して**Idle を挟まず**差し替え |
| `player.pause(interpolateSilence)` | 一時停止。resource は保持 |

- 公式ドキュメント（discord.js.org の AudioPlayer）も `stop(force)` を「Idle になるか、無音パディングが流れ終わるまで今の状態に留まる」と説明している [3]。

**「どこまで再生したか」**[1][3]

- `resource.playbackDuration`: 実音声パケットを `read()` するたびに +20ms。**無音フレームは数えない**。【実測】上の 100ms の例で 100。
- `player.state.playbackDuration`（Playing 状態の中）: `_preparePacket` が呼ばれるたびに +20ms。**無音フレームも数える**。同じ「再生時間」でも二つの値は違う。
- どちらも「ライブラリが送るパケットを用意した量」。聞き手のクライアントに届いた量・実際に聞こえた量ではない（Discord 側のジッタバッファなどは不明）【未確認。受信側の確認応答を示す文書は見つからなかった】。
- 流し込んだけれどまだ読まれていない分は、Node のストリームのバッファ（上流の PassThrough と Encoder）に残る。再生を止めると破棄される。**「流した PCM の量 − `resource.playbackDuration`」が、まだ送り出していない分**。【推測】
- 口の動きや文字との突き合わせには、このリポジトリ側の既存資産（ElevenLabs の `sync_alignment` に基づくタイムライン: `elevenlabs-timeline.mjs`、モーラのタイムライン: `mora-timeline.mjs`）と `playbackDuration` を使える見込み【推測】。

**関連する未リリースの変更**: PR #11598「バッファリング中に `stop()` するとプレイヤーが片付かない」は 2026-10-31 時点で open [4]。PR #11581（VOICE_SERVER_UPDATE の到着順で signalling に止まる）は main に入っているが 0.19.x には未リリース（前回B [27]）。

### 1.2 選択肢

| 案 | 内容 | 利点 | 注意 |
|---|---|---|---|
| A. 1 発話 1 resource ＋ `maxMissedFrames` を大きく | PassThrough に PCM を逐次書き込み、プレイヤーを `behaviors: { maxMissedFrames: 50 }`（約 1 秒）などで作る | 実装が単純。TTS の揺らぎに強い | 最後に `end()` しないと終わらない。途切れた間は無音が出る。大きくした分、本当に止めたいときは `stop()` で明示する |
| B. 文ごとに resource を作り、`play()` で連ねる | 1 文ごとに resource | 文の境目が割り込み点になる | 境目で Idle になりやすい（Idle を挟まず `play()` 差し替えは可）。文頭が欠けないよう先読みが要る |
| C. 先に溜めてから再生開始 | 先頭の数百 ms を溜めてから `play()` | 途切れに強い | 遅れが増える |
| D. ElevenLabs 側で Opus を受ける（`opus_48000_*`） | 再エンコード不要 | CPU が減る | TTD の WebSocket で使えるか・Ogg か生パケットかは【未確認】。`OggOpus` なら使える見込み |
| E. 割り込み | 割り込み時は `stop()`（無音 100ms の余韻あり）か、次の発話があるなら `play()` で差し替え。即座に切るなら `stop(true)` | — | `stop(true)` は急に切れて聞き手側で音が途切れる可能性【推測】 |

---

## 2. 1 つの VC に複数の Bot

### 2.1 事実

- **1 Bot（1 トークン）はサーバーごとに 1 つの VC にしか入れない**: discordjs.guide は「サーバー内では一度に 1 つの VC にしか接続できない」と書き、別チャンネルに `joinVoiceChannel` すると既存の接続が移る [5]。Nostrum（Elixir）・D++（C++）の文書も同じ構造（接続をギルド ID で管理）[6][7]。**Discord 公式の Voice Connections / Voice State 文書には、この制約を述べた文は見つからなかった**（Voice State の取得エンドポイントが `/guilds/{guild.id}/voice-states/{user.id}` の形であることから、1 人1ギルド1状態と読める。これは URL からの推論）[8]。
- **別トークンの Bot 同士は別のユーザー**なので、同じサーバー・同じ VC に同時に入ること自体を妨げる文書は見つからなかった【推測】。**同じ VC に複数の Bot を入れた公開例は見つからなかった**【未確認】。
- 近い先例: `sealbro/go-discord-caller`（Go）は「聞く役の Bot」が聞いた音を、プールにした「話す役の Bot」（それぞれ別の VC に入る）へ流す構成。Speaker Bot はトークンを番号付きで増やす。libdave が必要（Docker 推奨）[9]。同じ VC に 2 つ入る構成かは書かれていない。
- **@discordjs/voice の内部の状態はモジュールの中で共有される**（0.19.2 のソースで確認）[1]:
  - 接続の台帳は `groups: Map<group, Map<guildId, VoiceConnection>>`。`joinVoiceChannel` は `getVoiceConnection(guildId, group)` で既存を探し、**あれば新規に作らずその接続に参加用のペイロードを送り直して返す**。`group` の既定は `"default"`。
  - つまり**同じプロセスに discord.js のクライアントが 2 つあり、同じ guildId で `group` を省略して 2 回 `joinVoiceChannel` すると、2 つ目は 1 つ目の接続を再利用**する（1 つ目の Bot を別の VC に動かそうとする）。`joinVoiceChannel({ ..., group: "bot-b" })` のように Bot ごとに違う group を付け、`getVoiceConnection(guildId, "bot-b")` で引く。`group` は `JoinVoiceChannelOptions` の公式のオプション [10]。
  - 20ms の再生タイマーと AudioPlayer の台帳もプロセス共通。2 つの Bot が同時に話すと、毎周期 2 本分を順番に用意する（`setImmediate` でつなぐ）。
  - DAVE のセッション（`DAVESession`）は接続ごとに作られる（`Networking` が生成）。Bot ごとに別の MLS メンバーになる。
- **ゲートウェイ**: Bot ごとに 1 本の WebSocket。Identify は「1 日 1000 回」「`max_concurrency` ぶんが 5 秒に 1 回」（トークン単位）[11]。Bot を 2 つにしても、それぞれ別のトークンなので別枠。小さなサーバーならシャーディングは不要（1 シャード 2500 ギルドまで）[11]。イベント送信は接続ごとに 60 秒 120 回 [11]。
- **チャンネルの人数上限**は Bot にも適用され、満員だと VOICE_STATE_UPDATE / VOICE_SERVER_UPDATE が来ない（`MOVE_MEMBERS` があれば超えられる）[12]。2 つ入れるなら上限の数え方に Bot が 2 人入る。
- DAVE の MLS グループは参加者が増えるたびに提案→コミット→移行が起きる [13]。Bot が 2 つ入ると、入室・退室のたびに起こる鍵移行の回数が増える【推測】。

### 2.2 選択肢

| 案 | 内容 | 注意 |
|---|---|---|
| A. 1 プロセス・2 クライアント | クライアントを 2 つ作り、`group` を分ける | 上記の台帳の注意。メインスレッドで両方のエンコード・復号が走る |
| B. 2 プロセス（Bot ごと） | 完全に分離 | 魂の本体との連携を別途用意（耳と口の分担など） |
| C. 聞く Bot と話す Bot を分ける | 聞くのは片方だけ、もう片方は再生専用 | 受信の不具合（DAVE）の影響を片側に閉じられる。go-discord-caller と同じ発想 [9] |
| D. 1 Bot のまま役割を切り替える | トークン 1 つ | 声の同時出力はできない（1 本の AudioPlayer が 1 本の resource を鳴らす） |

注意点（【推測】）: 各 Bot は他の Bot の発話も他の参加者の音声として受け取りうるので、聞く側で「自分たちの Bot の userId」を除く必要がある（Hermes は許可したユーザー以外の音声を無視 [前回A 6]）。

---

## 3. 人ごとの文字起こし

### 3.1 事実

**Discord 側**

- 受信は人ごと（`receiver.subscribe(userId)`）の Opus パケット列。話者の識別は不要（Oatmeal の README も「Discord は話者ごとに別の Opus ストリームを届けるので話者の帰属は正確」と書く）[14]。
- 3 バイトの無音フレーム `F8 FF FE` は DAVE の復号をそのまま通り、購読ストリームに出てくる（0.19.2 のソース。前回B 2.4）。**デコード前に長さ 3 のパケットを捨てる**ことができる【推測。実装の定番として先例を確認できていない】。
- 【実測】opusscript 0.0.8 は、ステレオの Opus パケットを `new OpusScript(16000, 1, ...)` で直接 16kHz モノにデコードできた（20ms で 320 サンプル）。libopus は復号の Fs に 8000/12000/16000/24000/48000 を取れると文書化している [15]。48kHz に戻してから間引く処理が要らない。ただし、あくまで opusscript 0.0.8 + Node 24.19 の合成音（正弦波）での確認で、音質（折り返し雑音など）は未確認。デコーダは状態を持つので、人ごとに 1 つ作る必要がある【推測】。
- 先例の区切り方: Oatmeal は 800ms の無音で発話の終わり（`SILENCE_MS`）、400ms 未満は破棄（`MIN_UTTERANCE_MS`）、1 つながりを 1 つの wav にして終わったらすぐ文字起こし [14]。Hermes は 0.5 秒以上の発話の後 1.5 秒の無音（前回A 6）。OpenClaw は話者ごとのストリームを「連続した発話の区切り」ごとにバッチで文字起こし（`captureSilenceGraceMs` で短い間は同じストリームを保つ）[16]。TheShovel/artificial-user は Silero VAD で雑音を除いてから Whisper を通し、ワーカー数は設定（`STT_MAIN_WORKERS`）、キューはサーバー単位 [17]。

**ElevenLabs リアルタイム STT（`scribe_v2_realtime`）**

- 同時接続の上限（リアルタイム STT）: Free 6 / Starter 9 / Creator 15 / Pro 30 / Scale 45 / Business 45 / Enterprise は個別。ヘルプセンターの記事と models ページで一致 [18][19]。（ヘルプ検索の抜粋にこれと違う小さい数字の表も出たが、公式 2 ページの本文は上の数字。【未確認】: 実際の接続上限エラーの出方。API リファレンスに上限の記載は無く、`rate_limited` `queue_overflow` `resource_exhausted` というエラー種別がある [20]）
- 料金: Scribe v2 Realtime は **$0.39/時**、バッチの Scribe v2 は $0.22/時 [21]。
- 課金: 「送った音声の長さ」で課金。リアルタイムは「送った毎秒」で計量され、無音も課金される（接続時間ではない）[22]。
- 1 接続は 1 本の音声。話者ごとの分離（ダイアライゼーション）はリアルタイム版の機能一覧に無い [22]。
- 区切り: `commit_strategy` は `manual` / `vad` / `turn_prediction`。`vad` では `vad_silence_threshold_secs` `vad_threshold` `min_speech_duration_ms` `min_silence_duration_ms` を指定できる。`manual` では `input_audio_chunk` の `commit: true` で確定。`audio_format` は `pcm_16000` ほか `pcm_48000` まで [20]。（今のリポジトリは `vad` / 0.3 秒 / `pcm_16000`: `apps/soul/agent/src/ears/elevenlabs-stt.mjs`）
- 例外・近況: `insufficient_audio_activity` というエラー種別、`filter_background_audio`、`enable_logging`（既定 true）がある [20]。`enable_logging=false`（ゼロ保持モード）は「選ばれた Enterprise 向け」と記載 [23]。
- 計算の例（算術のみ）: 4 人が 2 時間いて、各自の発話が全体の 2 割なら、発話の合計は 1.6 時間で約 $0.62（話した分だけ送る場合）。4 本を 2 時間つなぎっぱなしで無音も送ると 8 時間分で約 $3.12。
- 【未確認】: 発話ごとに WebSocket を張り直すときの接続確立の遅さ。人ごとに常時 1 本を張るのと、発話ごとに張るのとの遅延差。

**ローカル（このリポジトリの実測）**

- Zipformer（ReazonSpeech K2 v2）は 1 発話の推論の中央値 0.12 秒、Parakeet は 0.36 秒（2 スレッド、1〜10 秒の発話 80 個。`discussion/ai-cohost/research/stt-candidates-2026-10.md` §5）。メモリは約 0.5GB / 0.9GB。
- 子プロセスに分けてある理由は §6（onnxruntime.dll の版の衝突）。耳の VAD（Silero、onnxruntime-node）とセグメンタは今のまま、というユーザー裁定（2026-10-25）。
- Silero VAD のラッパは**再帰状態（h/c）と直前フレームの文脈を持ち回る**（`ears/silero-vad.mjs`）。複数人を同じモデル・セッションで扱うなら、人ごとにその状態を分けて持つ必要がある【推測】。公式 README: 16kHz/8kHz、30ms 超のチャンクが 1 CPU スレッドで 1ms 未満 [24]。人数分の VAD は CPU の負担にならない見込み【推測】。
- このリポジトリの whisper 経路は 20 発話中 3 件で同じ文を繰り返した（同 §5）。

**ほぼ無音・雑音の発話を除く方法（先例と一次情報）**

| 手 | 出典・状況 |
|---|---|
| 3 バイトの無音フレームを捨てる | 0.19.2 のソース（上記） |
| 短すぎる発話を捨てる（咳・マイクの音） | Oatmeal: 400ms 未満を破棄 [14] |
| Silero VAD で「発話の割合」を見て、低ければ捨てる | artificial-user: Silero VAD で音楽・クリック・ゲーム音を除いてから Whisper [17]。このリポジトリの耳も同じ VAD を持つ |
| ElevenLabs 側の絞り込み | `filter_background_audio`、`insufficient_audio_activity`（エラー）[20] |
| Whisper の幻聴文を除く | 非音声で出やすい定型句（"Thank you" など）が知られている。ICASSP 2025 の論文は「幻聴の袋（bag of hallucinations）」で後処理して誤り率を下げた [25]。faster-whisper の `vad_filter` は Silero を内部で使う。Oatmeal は faster-whisper の側で VAD を効かせる [14] |
| 音量（RMS）の下限 | 先例を確認できず。【推測】 |

### 3.2 選択肢

| 案 | 内容 | 注意 |
|---|---|---|
| A. 自前 VAD で区切って、確定した発話だけ送る | Discord の人ごとのストリーム → デコード（16kHz モノ）→ 人ごとの VAD → 発話ができたら STT。ElevenLabs なら `manual` で `commit`、ローカルなら 1 発話 1 リクエスト | 料金が話した分だけ。発話の頭を落とさないよう前を少し足す（speech pad） |
| B. 人ごとに ElevenLabs の接続を常時 | 接続を人数分 | 無音も課金。上限（9〜30）に当たる。`keepalive_interval_ms` あり [20] |
| C. ElevenLabs のバッチ（Scribe v2）に発話ごと | $0.22/時、同時 8〜60（Starter 12 / Creator 20 / Pro 40）[18] | 遅延の実測は【未確認】 |
| D. ローカルで 1 ワーカー・順番待ち | Zipformer / Parakeet | 同時に何人もしゃべると待ちが出る。待ち時間の実測は無い |

---

## 4. 最初の発話の頭が欠ける件（DAVE の初回の鍵交換）

### 4.1 事実

- **今の状態**（2026-10-31 に GitHub API で確認）:
  - #11653（Welcome の後、`lastTransitionId` が 0 だと回復しない）は open。ラベルは `packages:voice`、担当者なし、メンテナの返信なし [26]。
  - 修正 PR #11667（`!== undefined` に変える）は open、未マージ。マージには承認 3 つが必要で、レビュー依頼は 4 人、まだ誰もレビューしていない。自動レビュー（CodeRabbit）は「再接続処理中（Resuming）だと回復用の鍵パッケージが捨てられる」と指摘し、設計判断が要る可能性を挙げた [27]。
  - `@discordjs/voice` の最新は 0.19.2（2026-03-17）。1.0.0 の dev 版が 2026-10-20 まで出ている。DAVE まわり（`DAVESession.ts`）の変更は、最後が 2026-05-23（型の export だけ）[28]。受信まわりでは 2026-06-27 に `AudioPacket`（sequence・timestamp つき）を返す破壊的変更が main に入っただけ [28]（前回B [24]）。`@snazzah/davey` の最新は 0.1.12、beta は 0.2.0-beta.1。
  - #11441（鍵移行中に 34% のパケットが消える）・#11445 は not planned で閉鎖（前回B）。
- **復号失敗の許容値**: 0.19.2 のソースでは `DEFAULT_DECRYPTION_FAILURE_TOLERANCE = 36`（連続 36 回まで黙って捨てる。1 回=20ms なので約 0.72 秒）。OpenClaw の文書は「upstream default 24」と書く [29] が、0.19.2 のソースは 36。**どちらも連続失敗の回数で、設定名は `decryptionFailureTolerance`**。許容値を上げると、例外（ストリーム破棄）に至りにくくなるが、捨てる量は減らない（前回B 2.6）。
- **仕様側の説明**（DAVE プロトコル文書）[13]:
  - 新しい参加者は鍵パッケージを送り、ゲートウェイが追加提案を配り、コミット（と Welcome）が出て、準備完了の報告の後に「移行を実行せよ」の合図が出る。
  - 「Welcome された参加者は、飛行中のメディアをすぐには復号できないことがある」と明記されている。
  - 過去のエポックの受信鍵は最大 10 秒保持される。
  - 移行の間、SFU がパケットを落とすことがある（対応していない側ではストリームが途切れる）。
  - 「人が後から入ったときの最初の数十〜数百ミリ秒の欠け」を直接説明した文は見つからなかった。
- **他の実装の手当て**: OpenClaw は「復号失敗の検知」と「繰り返したら自動で再参加」を入れた（2026.2.24 以降）。ログ文言は `DAVE decrypt failures detected` `repeated decrypt failures; attempting rejoin`。閾値の数値は文書に無い [29]。Hermes はテストに、再接続ごとの鍵の取り直し・DAVE セッションの後追い・復号失敗が続いたときのフォールバック・対応づけのない SSRC の暗号文の破棄がある（前回A 6）。

### 4.2 選択肢（どれも公開された「頭欠けの解決策」ではない）

| 案 | 内容 | 評価 |
|---|---|---|
| A. 受け入れて、欠けを検知して扱う | `receiver.speaking` の `start`（復号前に出る）の時刻と、最初に復号できた音声パケットの時刻の差を測り、差が大きければ「頭が欠けた発話」として印を付ける（応答しない・聞き返す・低信頼として扱う） | 公開 API だけで可。前回B 2.2 の仕組みを使う【推測】 |
| B. 入室直後の発話を保留する | `voiceStateUpdate` で入室を検知し、数秒間はその人の発話に応答しない | 実装が小さい。「人が入った直後の挨拶」が拾えない |
| C. 復号できないパケットを一時的に取っておいて後から復号 | 暗号文のまま短い間（1 秒程度）持ち、鍵が入った後で復号し直す | `VoiceReceiver` の中の処理なのでパッチ（patch-package など）が必要。後から復号できるかは davey の動作次第で【未確認】 |
| D. #11667 を当てる | `lastTransitionId` を `!== undefined` に | 直るのは「Welcome 後に回復しない」問題。頭欠けが戻る今の挙動は別の問題の可能性が高い【推測】。未マージ・レビュー中 |
| E. 復号失敗が続いたら再参加（OpenClaw 型） | 失敗数を数え、閾値で `rejoin` | 頭欠けの対策ではなく、回復しなかったときの保険 |
| F. 1.0.0-dev を使う | `AudioPacket`（sequence あり）で欠損が見える | 破壊的変更を含む。dev 版（Node >=24.17）。DAVE の受信が良くなる記載は見つからず |

---

## 5. プライバシーポリシー（先例の書き方と置き場）

法律の助言ではない。事実と先例だけ。

### 5.1 事実

**義務の根拠は前回A（Developer ToS 5(a)(b)(c)・12(a)）・前回B（例外が見つからない、API 上の項目は任意）。ここでは足さない。** 追加で確認できたこと:

- Developer Portal の「プライバシーポリシー URL」「利用規約 URL」は、2021 年 4 月に Discord が追加した。当初は OAuth の認可画面に表示された（discord-api-docs issue #1533 のスタッフとコメント）[30]。→ 招待される人がこのリンクを見る可能性がある【推測】。
- App Directory（探索）に載せるには、公開されているポリシー・規約と、検証済みであることが要る（Discord の Developer Help 記事。検索の抜粋で確認。ページ本体は取得時 403 だった）[31]。**このプロジェクトのような非公開の Bot は対象外**。
- URL の置き場所（ホスト）についての Discord の公式な指定は見つからなかった。issue #1533 の議論にも書式の指定は無い [30]。
- 公開リポジトリのテンプレートは **GitHub Pages**（`https://<user>.github.io/<repo>/`）の URL を両方の欄に入れる方法を案内している（DrSinister31/Privacy-TOS。Discord が受理した旨の記載は無い）[32]。
- **GitHub の blob（`github.com/.../blob/.../PRIVACY.md`）、raw、Gist が Discord に受理されるか、または検証で通るかを示す一次情報は見つからなかった**【未確認】。リポジトリが公開（public）であれば誰でも開ける。非公開リポジトリのファイルは外から開けない（一般的な GitHub の仕様）。

**小さな Bot の先例の構成**（実際の文書を読んだもの。内容の要約のみ）

| 先例 | 構成と中身 |
|---|---|
| Tricked-dev/Speech-To-Text-Bot の `PRIVACY.md`（音声メッセージの文字起こし Bot）[33] | 序・集める情報（送られた音声ファイルのみ）・使い道（文字起こし）・第三者（共有・販売・貸与しない）・保存と削除（返信するまで保持してから削除）・13 歳未満・変更・連絡先（運営者の Discord）。**保存期間は書いてあるが、削除の頼み方と第三者の社名は無い** |
| PalmBeach bot（`raw.githubusercontent.com` 上の `PRIVACY_POLICY.txt`、音声 + OpenAI）[34] | 音声は有効時にリアルタイムで文字起こしされ、録音・保存はしない。テキストは OpenAI の API に送られ、OpenAI 自身のポリシーに従う。メモリ上のデータは処理後に破棄。削除の依頼は「権利」の節に一文（持続的なデータベースが無いのでほとんど自動）。連絡先は Discord サーバー経由 |
| Lane（Read the Docs 上、音声 + 複数の外部サービス）[35] | 節立てが最も細かい。集める情報（メッセージ・ユーザー名・音声・声紋）・使い方（モデルの学習を含む）・第三者の社名（Anthropic・Azure・ElevenLabs・Qdrant・Discord）・保存期間（音声は文字起こし後に削除、記憶は削除まで）・削除の頼み方（管理者経由かメール、「声を忘れて」のコマンド）・外部事業者側の写しは対象外・13 歳未満・変更・連絡先（メール）。文末に最終更新日 |

先例で共通して見える項目: 集める情報の種類／使い道／第三者（社名を挙げるか、「各社のポリシーに従う」と書く）／保存期間／削除の頼み方（連絡先）／子どもの扱い／変更の知らせ方／連絡先。

ホストの実例: 上の 3 つは、GitHub のファイル（blob の `PRIVACY.md`）、raw の `.txt`、Read the Docs だった。**これらが Developer Portal の欄に入っていた事例かは確認できていない**（文書の置き場所を確認しただけ）。

### 5.2 選択肢（置き場）

| 案 | 内容 | 注意 |
|---|---|---|
| A. GitHub Pages | 公開リポジトリの `docs/privacy.md` などを Pages で公開 | テンプレートでの先例あり [32]。リポジトリを公開にする必要がある |
| B. GitHub の blob の `PRIVACY.md` | 先例の文書自体はこの形 [33] | Discord の受理は【未確認】。ブラウザで普通に表示される |
| C. Gist | 非公開（secret）でなく公開の Gist | 受理は【未確認】。URL を知っている人は誰でも開ける（secret Gist も同様） |
| D. 自前のサイト | — | 先例の確認は不要だが維持が要る |

---

## 6. 出典

[1] `@discordjs/voice` 0.19.2 の配布物（`dist/index.js`、`dist/index.d.ts`）https://registry.npmjs.org/@discordjs/voice/-/voice-0.19.2.tgz（`AudioPlayer`、`AudioResource`、`audioCycleStep`、`createVoiceConnection`、`joinVoiceChannel`、`DAVESession`）
[2] prism-media 1.3.5 `src/opus/Opus.js` https://registry.npmjs.org/prism-media/-/prism-media-1.3.5.tgz
[3] discord.js 公式ドキュメント（AudioPlayer / AudioResource）https://discord.js.org/docs/packages/voice/main/AudioPlayer:Class ／ https://discord.js.org/docs/packages/voice/main/AudioResource:Class
[4] discord.js PR #11598 https://github.com/discordjs/discord.js/pull/11598（GitHub API で状態を確認）
[5] discord.js Guide「Voice Connections」https://discordjs.guide/voice/voice-connections
[6] Nostrum.Voice https://hexdocs.pm/nostrum/0.4.5/Nostrum.Voice.html
[7] D++ voiceconn https://ccoderun.ca/programming/doxygen/dpp/classdpp_1_1voiceconn.html
[8] Discord Developer Docs「Voice」https://docs.discord.com/developers/resources/voice
[9] sealbro/go-discord-caller https://github.com/sealbro/go-discord-caller
[10] `JoinVoiceChannelOptions`（`group`）https://discord.js.org/docs/packages/voice/main/JoinVoiceChannelOptions:Interface
[11] Discord Developer Docs「Gateway」（Identify の上限、`session_start_limit`、シャーディング）https://docs.discord.com/developers/events/gateway
[12] Discord Developer Docs「Voice Connections」https://docs.discord.com/developers/topics/voice-connections
[13] DAVE protocol https://github.com/discord/dave-protocol/blob/main/protocol.md
[14] PotatoPeaSea/Oatmeal https://github.com/PotatoPeaSea/Oatmeal
[15] Opus API「opus_decoder」https://opus-codec.org/docs/opus_api-1.5/group__opus__decoder.html
[16] OpenClaw「Discord voice transcripts」https://docs.openclaw.ai/channels/discord/voice-transcripts.md
[17] TheShovel/artificial-user https://github.com/TheShovel/artificial-user
[18] ElevenLabs ヘルプ「How many Speech to Text requests can I make and can I increase it?」https://elevenlabs.io/docs/help-center/product/core-capabilities/speech-to-text/how-many-speech-to-text-requests-can-i-make-and-can-i-increase-it.md
[19] ElevenLabs Models https://elevenlabs.io/docs/overview/models
[20] ElevenLabs API リファレンス「Realtime speech to text」https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
[21] ElevenLabs API 料金 https://elevenlabs.io/pricing/api
[22] ElevenLabs「Speech to text」https://elevenlabs.io/docs/overview/capabilities/speech-to-text
[23] ElevenLabs「Zero Retention Mode」https://elevenlabs.io/docs/developer-guides/zero-retention-mode
[24] snakers4/silero-vad https://github.com/snakers4/silero-vad
[25] Barański ほか「Investigation of Whisper ASR Hallucinations Induced by Non-Speech Audio」arXiv:2501.11378（ICASSP 2025）https://arxiv.org/abs/2501.11378
[26] discord.js issue #11653 https://github.com/discordjs/discord.js/issues/11653
[27] discord.js PR #11667 https://github.com/discordjs/discord.js/pull/11667
[28] discord.js のコミット履歴（`packages/voice`、GitHub API で取得）／ npm registry（`npm view @discordjs/voice`、`@snazzah/davey`）
[29] OpenClaw「Discord troubleshooting」https://docs.openclaw.ai/channels/discord/troubleshooting.md
[30] discord/discord-api-docs issue #1533 https://github.com/discord/discord-api-docs/issues/1533
[31] Discord Developer Help「App Directory: Discovery」https://support-dev.discord.com/hc/en-us/articles/9489299950487
[32] DrSinister31/Privacy-TOS https://github.com/DrSinister31/Privacy-TOS
[33] Tricked-dev/Speech-To-Text-Bot `PRIVACY.md` https://github.com/Tricked-dev/Speech-To-Text-Bot/blob/master/PRIVACY.md
[34] palmbeach-bot-legal `PRIVACY_POLICY.txt` https://raw.githubusercontent.com/AdrianYooo/palmbeach-bot-legal/refs/heads/main/PRIVACY_POLICY.txt
[35] Lane のプライバシーポリシー https://lane.readthedocs.io/en/latest/discord_privacy_policy/
リポジトリ内: `apps/soul/agent/src/voice/engines/{elevenlabs,aivis}-voice-engine.mjs`、`src/ears/{elevenlabs-stt,silero-vad,speech-segmenter}.mjs`、`discussion/ai-cohost/research/stt-candidates-2026-10.md`。

---

## 7. 未確認のこと

- 聞き手に実際に届いた（聞こえた）再生位置を知る手段。Discord 側のジッタバッファの大きさ。
- 同じ VC に別トークンの Bot を 2 つ入れた公開例、DAVE の鍵移行が Bot 2 つでどう増えるか。Bot 同士が互いの音声を受信するか（受信側で除く前提）。
- ElevenLabs の TTD（text-to-dialogue）WebSocket で Opus 出力が選べるか。`opus_48000_*` が Ogg か生パケットか。
- ElevenLabs リアルタイム STT の同時接続上限を超えたときのエラーの出方（`rate_limited` か `resource_exhausted` か）。発話ごとに接続を張る場合の確立時間。バッチ API の遅延。
- 非 Enterprise のアカウントで `enable_logging=false` が効くか。ElevenLabs の通常の音声・文字起こしの保持期間。
- 16kHz モノへの直接デコード（opusscript 0.0.8）の音質（折り返し雑音）。実際の Discord 音声での確認。
- 人が後から入ったときの頭欠けの原因（受信側の鍵移行の遅れか、送信側の移行の遅れか）。暗号文を一時保持して後から復号し直せるか（davey の動作）。
- #11667 のマージ・リリース時期。
- GitHub の blob・raw・Gist を Developer Portal の URL 欄に入れた実例と、それが検証・OAuth 画面でどう扱われるか。App Directory の記事の本文（取得時 403、検索抜粋のみ）。
