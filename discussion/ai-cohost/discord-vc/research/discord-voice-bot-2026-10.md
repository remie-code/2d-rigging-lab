# Discord ボイスチャンネル Bot 調査（2026-10）

- 調査日: 2026-10-30
- 調査者: Sylph（外部ファクト調査。設計判断はしない）
- 対象: チャッピーを独立した Bot アカウントとして友人限定の VC に参加させ、話者ごとに聞き取り、自分の声で話す。この用途の実現性。
- 表記: 出典つきの記述は確認済みの事実。【推測】は推論。番号 [n] は「3. 出典一覧」を指す。

---

## 1. 要点

- **結論: 技術的には可能。ただし受信側は「非公式で壊れやすい」前提で扱う必要がある。** 送信（TTS を流す）は安定している。話者ごとの受信も主要ライブラリで実現できる。ただし Discord は受信を公式に文書化していない [3][5]。
- **DAVE（音声 E2EE）は 2026-03-01 から必須。** 非対応のクライアントや Bot は通話に参加できない [1][2]。Bot は MLS グループの正規メンバーとして鍵を受け取るので、受信音声の復号は仕組み上可能。ただし復号失敗のバグ報告が各ライブラリで続いている [6][7][8][13][15]。
- **Node.js の第一候補は `@discordjs/voice` 0.19.2（2026-03-17）。** DAVE 用の `@snazzah/davey` を同梱する。ユーザー ID ごとの受信ストリーム API がある [3][4][9]。DAVE 受信の大きな不具合は 0.19.2 で修正済み [9][10]。一方で 2026-10-08 にも、復号失敗から回復しない不具合が報告され、まだ open [11]。
- **話者の識別は、音声ゲートウェイの Speaking（opcode 5）で SSRC とユーザー ID を対応づける方式。** 音声は Opus・48 kHz・ステレオ・20 ms フレーム [2][4][12]。
- **ポリシー上、友人の事前同意つき・自分のサーバー限定なら、明確に禁じる条文は見当たらない。** ただし開発者規約上の義務がある。プライバシーポリシーの用意と公開、第三者共有の制限（Service Provider 経由は可）、削除要求への対応、保存データの暗号化 [16][17]。「メッセージ内容」を AI の学習に使うことは禁止 [16]。
- **必要な Intent は `GUILDS` と `GUILD_VOICE_STATES`。どちらも特権 Intent ではない** [18]。話者の識別に `GUILD_MEMBERS`（特権）は不要 [19]。
- **先行例はある。** Hermes Agent（Nous Research）は discord.py 2.7 と davey の上に独自の受信処理を実装し、話者別 STT → エージェント → TTS を運用している [19][20]。多人数での発話タイミングは、どの先行例も「無音しきい値で区切る」程度。精度の高い順番取りの実例は見つからなかった。
- **Windows のローカル PC で動かせる。** Gateway（WebSocket）も音声（UDP）も外向き接続なので、公開サーバーは不要【推測。根拠は 7 章】。Node 24.19（このPCの現行版）は要件（22.12 以上）を満たす [9]。

---

## 2. 質問ごとの調査結果

### Q1. Bot は VC の音声をユーザー別に受信できるか

**確認済み**

- Discord の公式ドキュメントは、送信の仕様だけを書いている。「Discord へ送る音声は Opus、2ch（ステレオ）、48 kHz」[2]。受信について、Bot ができる・できないとは書いていない [2]。
- `@discordjs/voice` の README は受信を機能として挙げる。ただし注記がある。要旨は「受信は Discord が文書化していないので、安定した動作は保証しない」[3]。メンテナも「受信はずっと『動くかもしれない』扱い」と述べている [8]。
- 音声ゲートウェイの opcode [12]:
  - 5 Speaking（クライアントとサーバーの双方向）。誰が話しているかを示す。
  - 11 Clients Connect（サーバー → クライアント）。VC に誰かが入った。
  - 13 Client Disconnect。誰かが抜けた。
- `@discordjs/voice` 0.19.2 の実装（パッケージ内のコードで確認）[4]:
  - サーバーから Speaking（op 5）が届くたびに `{ userId: d.user_id, audioSSRC: d.ssrc }` を `SSRCMap` に登録する。op 13 で削除する。
  - `receiver.subscribe(userId, { end })` で、ユーザーごとの `AudioReceiveStream` が得られる。中身は Opus パケット。
  - 終了条件は `EndBehaviorType` で決める。Manual / AfterSilence（無音が続いたら終了）/ AfterInactivity（パケットが途絶えたら終了）。
  - `receiver.speaking` は `start` と `end` のイベントを出す。最後のパケットから 100 ms（`SpeakingMap.DELAY`）で「話し終わり」とみなす。
  - 送信フレーム長は 20 ms（`FRAME_LENGTH = 20`）。無音フレームは `F8 FF FE`。
- 話し終わりに無音フレームを 5 つ送るという仕様が公式にある [2]。

**【推測】**

- Discord クライアントは、音声検出（または Push-to-Talk）が働いている間だけパケットを送る。だから「パケットが来ない＝話していない」になりやすい。発話区間の切り出しは比較的簡単。ただし、ノイズ抑制などの処理はクライアント側で済んだ音が届く。
- 受信した Opus をデコードすると、48 kHz・ステレオの PCM になる。16 kHz・モノラルを前提とする STT に渡すには、変換が必要。

### Q2. DAVE（音声・映像の E2EE）

**確認済み**

- 公式ドキュメント: 「2026-03-01 以降、E2EE の通話だけをサポートする」。対象は DM、グループ DM、ボイスチャンネル、Go Live [2]。
- Discord ブログ（2026-05-18）[1]:
  - 2026 年 3 月初めに移行を完了した。
  - 2025 年中に、Bot とアプリ、Social SDK を含む全プラットフォームへ DAVE を広げた。
  - ステージチャンネルは E2EE の対象外。
  - 実装は libdave として公開されている。
- プロトコル [2][12]:
  - Identify の `max_dave_protocol_version` で対応バージョンを申告する。0 または省略は非対応。
  - 通話では、参加者が共通して対応する最も低いバージョンが選ばれる。
  - opcode 21〜31 で MLS の鍵交換と移行を行う。
  - DAVE 非対応で入ろうとすると、close code **4017**（E2EE/DAVE が必要）で切断される。
- トランスポート暗号の必須モードは `aead_xchacha20_poly1305_rtpsize`。推奨は `aead_aes256_gcm_rtpsize` [2]。

**Bot への影響（確認済み）**

- 送信も受信も、DAVE への対応が実質的に必須になった [2]。
- 受信の不具合例:
  - `@discordjs/voice` 0.19.0 で、復号失敗（`UnencryptedWhenPassthroughDisabled`）、再接続ループ、音が取れない、などの報告が 2026 年 2〜3 月に集中した [6][7][8]。
  - 0.19.2 の修正「パケットのパディング除去とガード追加」（PR #11449）で、#11419 と関連 issue を直したとされる [9][10]。
  - 2026-10-08 の open issue #11653 [11]。Bot より先に VC にいたユーザーが、すぐに話し始めた場合の不具合。最初のパケットが復号できず、受信ストリームが破棄され、回復しない。発生は毎回ではない。報告者は次の点も指摘している。
    - 失敗の回数を、ユーザー別ではなくセッション全体で数えている。
    - Welcome の受信直後に passthrough が有効にならない。
- Python では、`discord-ext-voice-recv` が DAVE に対応していない。最終リリースは 2025-06 [13][14]。

**【推測】**

- Bot は MLS グループの正規メンバーとして鍵を受け取る。だから「E2EE があるから Bot は聞けない」ということはない。参加者には、Bot が通話にいることが見える。
- DAVE の鍵の切り替えは、参加者の出入りのたびに起きる。そのため、入退室の直後に音声を取りこぼす可能性がある（[7][11][15] の報告から）。

### Q3. ライブラリ

| ライブラリ | 受信 | ユーザー別 | DAVE | 成熟度・状態 |
|---|---|---|---|---|
| `@discordjs/voice`（Node） | あり（非公式扱い）[3] | `subscribe(userId)` [4] | 対応。`@snazzah/davey` 同梱 [3][9] | 安定版は 0.19.2（2026-03-17）。1.0.0 の dev 版を 2026-10-20 まで公開中 [9]。DAVE 受信の open issue あり [11] |
| `@snazzah/davey`（Node 用 DAVE） | — | — | 本体 | 0.1.12（2026-06-22）。0.2.0-beta あり。win32-x64 のビルド済みバイナリあり [9] |
| discord.py 2.7.x（Python） | 本体には受信 API なし【推測】 | — | 2.7.0（2026-02-27）から `davey` を voice extra に追加 [13] | 送信は DAVE 対応 |
| `discord-ext-voice-recv`（discord.py 拡張） | あり（実験的） | あり | **非対応**。DAVE 対応要望 #64 が open。2.7.1 で音が崩れる報告 #53 [14] | 最終リリース 0.5.2a179（2025-06-18）。止まっている [13][14] |
| py-cord 2.8.x | 録音 API（`start_recording`、Sink） | Sink でユーザー別 | DAVE 対応（`is_dave_connection()`）。ただし公式ドキュメントに「DAVE のため録音が期待どおり動かない可能性」と警告 [21] | 2.8.1（2026-07-25） |
| songbird（Rust） | あり（ユーザー別受信イベント） | あり | v0.6.0（2026-04-05）で DAVE 対応 [15] | v0.6.1（2026-10-10）。DAVE の受信停止や復号エラーの open issue #310、音割れ #315 あり [15] |
| JDA + JDAVE（Java） | JDA に受信 API あり【推測】 | — | JDAVE（MinnDevelopment/jdave）がある。2026-09 に更新 | 詳しくは未確認 |

**補足（確認済み）**

- `@discordjs/voice` 0.19.2 の要件は Node 22.12 以上。依存は ws、prism-media、`@snazzah/davey`、discord-api-types [9]。main ブランチの README は Node 24.17 以上を要求している（1.0 系）[3]。
- Opus のライブラリは `@discordjs/opus`（ネイティブ）か `opusscript`（純 JS）のどちらかが要る [3]。
- 暗号ライブラリは、環境に aes-256-gcm がない場合だけ要る [3]。

### Q4. 送信（TTS を VC に流す）

**確認済み**

- `@discordjs/voice` の `createAudioResource` が受け取れる入力形式（`StreamType`）は 5 つ [4]: Arbitrary（FFmpeg で変換）、OggOpus、WebmOpus、Opus（すでにパケット化済み）、Raw（s16le PCM）。
- 送信は 20 ms ごとのフレームで行う [4]。音を止めるときは無音フレームを 5 つ送る [2]。
- ElevenLabs API の出力形式 [22]:
  - PCM 48 kHz（プランの制限の記載なし）。
  - Opus 48 kHz、32〜192 kbps（プランの制限の記載なし）。
  - PCM 44.1 kHz は Pro 以上。
- DAVE 環境での送信は、discord.js のメンテナが「問題なく使えている」と述べている [8]。

**【推測】遅延の考え方**

- 遅延の大半は、Discord 側ではなく STT・LLM・TTS の処理時間。
  - 先行例の目安 [19]: Groq の Whisper で約 0.5 秒。ElevenLabs TTS で約 2 秒（非ストリーミングの場合）。
  - 発話の終わりを判定する無音待ちも加わる。Hermes は 1.5 秒 [19]。
- Discord の経路そのもので増える遅延は、数十〜百数十 ms 程度と見込まれる。内訳は 20 ms フレーム、ネットワーク、受け手側のジッタバッファ。実測値の出典はない。
- 48 kHz の PCM か Opus で受け取れば、サンプルレートの変換を省ける。Ogg Opus をそのまま渡せれば、再エンコードも不要。ただし、ElevenLabs の Opus 出力の入れ物（Ogg かどうか）は未確認。
- 長い返答は、文ごとにストリーミングで再生するのが一般的。Hermes も文単位でストリーミングしている [19]。

### Q5. ポリシー

**Discord Developer Policy（2024-07-08 施行。2026-10 時点で現行）[16]**

- 2: ユーザーやサーバーの代わりに処理を始める前に、許可を得ること。許可の求め方は明確に表示し、目的を正確に説明すること。
- 3: Discord のプライバシー・安全機能を回避しないこと。ユーザーがアプリをブロックしたり、オプトアウトしたり、除去したりできるようにすること。
- 12: 他のアプリ、Discord の社員やパートナー、Discord のサービスになりすまさないこと。
- 15: API Data は、表明した機能に必要な範囲でだけ使うこと。改善目的に使う場合は、集計・匿名化したものに限る。
- 16: API Data で人をプロファイリングしないこと。健康情報などのセンシティブな情報は、取得も送信もしないこと。
- 17・18: API Data をデータブローカーや広告に渡さないこと。販売しないこと。
- 21: API で得た**メッセージ内容**を、ML や AI（LLM を含む）の学習に使わないこと。Discord の明示的な許可がある場合を除く。
- 開発者は、問題を報告できる窓口を用意し、届いた報告に対応すること。

**Discord Developer Terms of Service（2024-07-08 施行）[17]**

- 「API Data」とは、API を通じて得たあらゆるデータのこと（個人データを含む）。
- 5(a): 適用されるプライバシー法（GDPR など）に従うこと。プライバシーポリシーを用意して守ること。ポリシーには、何を集め、どう使い、第三者とどう共有し、どう削除を求められるかを書くこと。ポリシーへのリンクを Developer Portal に公開すること。
- 5(b): API Data は第三者と共有しないこと。例外は次の 3 つ。
  - Service Provider との共有。
  - 法令で求められた場合。
  - ユーザー本人が明示的に指示した場合（求められたら証拠を出す）。
- 5(b): 不要になったら、またはユーザーから求められたら、すぐに削除すること。
- 5(c): 保存しているデータを暗号化すること。
- 12(a): Service Provider には、あなたのためだけに使うこと、他の目的に使わないことを、書面で約束させること。利用をやめたら、データを削除させること。

**Intent [18]**

- `GUILD_VOICE_STATES`（1<<7）は特権 Intent ではない。
- 特権 Intent は `GUILD_MEMBERS`、`GUILD_PRESENCES`、`MESSAGE_CONTENT` の 3 つ。
- Hermes の文書によると、VC での SSRC とユーザー ID の対応づけは Speaking opcode から得るので、`GUILD_MEMBERS` は不要 [19]。

**【推測】**

- 受信した音声と、それを書き起こした文字列は「API で得たデータ」なので、API Data に当たる可能性が高い。
- OpenAI（頭）や ElevenLabs（STT）に送る場合、規約上は「Service Provider」として扱うのが自然な読み方。その場合は 12(a) の書面の約束が要る。各社の API 規約（データ処理の条件）でこれを満たせるかは未確認。STT をローカルの Zipformer にすれば、少なくとも STT 部分は第三者に送らない。
- 条 21 の「メッセージ内容」に、音声の書き起こしが含まれるかは不明。学習に使わなければ関係しない。
- 録音や書き起こしそのものを禁じる条文は、Developer Policy と Developer ToS には見当たらない。ただし、条 2 の「事前の許可」や、各国の盗聴・録音関連の法律の観点から、事前同意は求められると考えるのが妥当。
- AI が生成した声について、開発者規約に専用の条文は見当たらない。実在の人物になりすます声でなければ、条 12 の問題にはなりにくい。Discord Community Guidelines の詳しい条文は、今回は確認していない。
- 個人用・少人数のサーバーでも、規約上は「Application」に当たる。だからプライバシーポリシーの義務は免除されない、と読める。

### Q6. 先行例

**確認済み**

- **Hermes Agent（Nous Research、MIT ライセンス、2026 年も更新中）[19][20]**
  - `/voice join` で VC に入る。ユーザーごとの音声ストリームを別々に聞く。
  - 0.5 秒以上の発話の後に 1.5 秒の無音が続いたら、STT にかける。
  - 返答はテキストチャンネルにも投稿する（`[Voice] @user: ...`）。
  - 自分の TTS を再生している間は聞き取りを止める（エコー対策）。
  - 許可されたユーザー以外の音声は無視する。
  - Whisper の幻聴対策として、既知のフレーズを除外するフィルタがある。
  - 実装は discord.py 2.7 と davey の上に作った独自の VoiceReceiver。テストに次の対策が書かれている。
    - 再接続のたびに変わる `secret_key` を追い直す。
    - DAVE セッションが後から作られる場合に追随する。
    - 復号失敗が続いたときのフォールバック。
    - 対応づけのない SSRC の暗号文を捨てる。
- **LLMChat（hc20k）**: ElevenLabs、Azure などの TTS と Whisper を使う。README に「1 人ずつ話すときだけ安定」とある。2025-12-02 にアーカイブ済み [23]。
- **OpenClaw の discord-voice スキル**: 音声区間を自動で検出する。ユーザーが話し始めたら即座に発話を止める（バージイン）。STT は Whisper か Deepgram、TTS は OpenAI、ElevenLabs、Kokoro から選べる [24]。
- **DiscordEarsBot（inevolin）**: ユーザーごとに別の音声として STT するだけの Bot [25]。

**分かった課題（確認済みの範囲）**

- DAVE の後、受信が無音になる、音が崩れる、取りこぼす [6][7][8][11][14][15]。
- 崩れた音声を Whisper に入れると、まったく別の文章を幻聴として生成する [8]。
- 雑音から偽の書き起こしが出る [19]。
- 話していても受信ストリームが途中で終わることがある（`@discordjs/voice` #8105、2022 年から open）[26]。

**【推測】**

- 多人数での順番取りについて、先行例はどれも単純な規則にとどまる。具体的には「無音しきい値で区切る」「話しかけられたら割り込みをやめる」「許可リスト」。「誰かが話している間は黙る」「名前を呼ばれたら応答する」といった判断を、高い精度で行う公開実装は見つからなかった。
- 商用の AI 会話 Bot の実装の詳細は、今回の調査では確認できなかった。

### Q7. Windows のローカル PC で動かす

**確認済み**

- `@snazzah/davey` は、win32-x64、ia32、arm64 用のビルド済みバイナリを配布している [9]。
- `@discordjs/opus` 0.10.0 も、GitHub Releases からビルド済みバイナリを取得する方式 [9]。
- このリポジトリの PC の Node は v24.19.0（`node --version` で確認）。`@discordjs/voice` 0.19.2 の要件（22.12 以上）も、main の要件（24.17 以上）も満たす。
- 既存の soul パッケージ（`apps/soul/agent/package.json`）は `"type": "module"` の独立パッケージ。

**【推測】**

- Bot は Gateway（WSS）にも音声サーバー（WSS と UDP）にも、自分から接続する。だから、公開サーバー、ポート開放、固定 IP は不要。IP Discovery も UDP で自分から問い合わせる方式（[2] の Select Protocol の流れ）。
- Windows Defender ファイアウォールが、node.exe の UDP 通信について確認を出す可能性がある。
- PC がスリープしたり回線が切れたりすると、VC から落ちる。再接続の処理が必要。
- 再接続のたびに DAVE の鍵交換が起き直すので、その直後の取りこぼしに注意する（[11][19]）。
- 同じ Bot トークンで複数のプロセスを動かすと、Gateway のセッションが衝突しうる。
- 権限: Bot を自分のサーバーに招待するには、`bot` スコープと、Connect、Speak、View Channel が要る。チャンネルの人数上限は Bot にも適用される。`MOVE_MEMBERS` 権限があれば上限を超えられる [2]。
- Bot は自分の送った音声を受信しない。それでも、友人のマイクが Bot の声を拾って返ってくることはある。Hermes が自分の再生中に聞き取りを止めているのは、このためとみられる [19]。

---

## 3. 出典一覧

1. Discord Blog「Every voice and video call on Discord is now end-to-end encrypted」(2026-05-18) https://discord.com/blog/every-voice-and-video-call-on-discord-is-now-end-to-end-encrypted
2. Discord Developer Docs「Voice Connections」https://docs.discord.com/developers/topics/voice-connections
3. `@discordjs/voice` README（main）https://github.com/discordjs/discord.js/tree/main/packages/voice ／ 0.19.2 版 https://cdn.jsdelivr.net/npm/@discordjs/voice@0.19.2/README.md
4. `@discordjs/voice` 0.19.2 の配布物（`dist/index.d.ts`、`dist/index.js`）https://registry.npmjs.org/@discordjs/voice/-/voice-0.19.2.tgz
5. discord.js Guide（Voice）https://discordjs.guide/voice
6. discord.js issue #11445（DAVE 受信の復号失敗、2026-03）https://github.com/discordjs/discord.js/issues/11445
7. discord.js issue #11441（DAVE の鍵移行中に 34% のパケットを取りこぼす、2026-03）https://github.com/discordjs/discord.js/issues/11441
8. discord.js issue #11419（DAVE による再接続ループと受信ゼロ、2026-02）https://github.com/discordjs/discord.js/issues/11419
9. npm registry: `@discordjs/voice` https://registry.npmjs.org/@discordjs/voice ／ `@snazzah/davey` https://registry.npmjs.org/@snazzah/davey ／ `@discordjs/opus` https://registry.npmjs.org/@discordjs/opus
10. discord.js PR #11449「fix(voice): strip padding from packets and add guards」(2026-03-13 マージ) https://github.com/discordjs/discord.js/pull/11449 ／ リリース @discordjs/voice@0.19.1, 0.19.2 https://github.com/discordjs/discord.js/releases
11. discord.js issue #11653（transition 0 の Welcome 後に復号失敗から回復しない、2026-10-08、open）https://github.com/discordjs/discord.js/issues/11653
12. Discord Developer Docs「Opcodes and Status Codes」https://docs.discord.com/developers/topics/opcodes-and-status-codes
13. PyPI: discord.py https://pypi.org/project/discord.py/ ／ discord-ext-voice-recv https://pypi.org/project/discord-ext-voice-recv/
14. discord-ext-voice-recv issues #64（DAVE 対応要望、open）https://github.com/imayhaveborkedit/discord-ext-voice-recv/issues/64 ／ #53 https://github.com/imayhaveborkedit/discord-ext-voice-recv/issues/53 ／ #61 https://github.com/imayhaveborkedit/discord-ext-voice-recv/issues/61
15. songbird リリース v0.6.0 / v0.6.1 https://github.com/serenity-rs/songbird/releases ／ issue #310 https://github.com/serenity-rs/songbird/issues/310 ／ #315 https://github.com/serenity-rs/songbird/issues/315
16. Discord Developer Policy（2024-07-08 施行）https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy
17. Discord Developer Terms of Service（2024-07-08 施行）https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service
18. Discord Developer Docs「Gateway」（Intent の一覧）https://docs.discord.com/developers/events/gateway
19. Hermes Agent ドキュメント voice-mode.md https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/voice-mode.md ／ 解説記事（2026-05-14 更新）https://fast.io/resources/hermes-agent-discord-bot/
20. Hermes Agent テスト `tests/gateway/test_discord_voice_rekey.py`、`scripts/discord-voice-doctor.py` https://github.com/NousResearch/hermes-agent
21. py-cord Voice API ドキュメント（stable）https://docs.pycord.dev/en/stable/api/voice.html
22. ElevenLabs Help「What audio formats do you support」https://elevenlabs.io/docs/help-center/troubleshooting/what-audio-formats-do-you-support.md
23. hc20k/LLMChat https://github.com/hc20k/LLMChat
24. OpenClaw discord-voice スキル https://www.skills.sh/openclaw/skills/discord-voice
25. inevolin/DiscordEarsBot https://github.com/inevolin/DiscordEarsBot
26. discord.js issue #8105（受信ストリームが話している途中で終わる、open）https://github.com/discordjs/discord.js/issues/8105

---

## 4. 未確認のこと

- `@discordjs/voice` 0.19.2 で、DAVE 環境の多人数受信が実際に安定するか。#11653 の再現条件はまだはっきりしない。1.0.0 の正式リリースの予定も分からない。
- Discord が今後、受信を公式に禁止または制限する予定があるか。今回の調査では、そうした告知は見つからなかった。
- OpenAI と ElevenLabs の API 規約が、Developer ToS 12(a) の「Service Provider の書面での約束」の要件を満たすか。
- 音声の書き起こしが、Developer Policy 条 21 の「message content」に含まれるか。
- 録音・AI 音声・合成音声についての Discord Community Guidelines と Terms of Service の現行の条文（今回は原文を読んでいない）。
- 日本の法律での扱い（全員の同意があれば問題になりにくいと見ているが、未確認）。
- ElevenLabs の Opus 出力の入れ物（Ogg かどうか）。`StreamType.OggOpus` にそのまま渡せるか。
- Bot に対してもチャンネルの「音声検出を使用」権限（Push-to-Talk の強制）が効くか。
- Discord クライアントのノイズ抑制や音量処理が、受信音声の STT 精度にどう影響するか。
- 商用の AI 会話 Bot が多人数での順番取りをどう処理しているか。
- JDA の受信 API と DAVE の組み合わせの成熟度。
