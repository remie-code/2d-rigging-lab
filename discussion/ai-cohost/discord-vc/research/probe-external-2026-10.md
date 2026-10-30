# VC 受信プローブ（数だけ数える使い捨て Bot）のための外部調査（2026-10）

- 調査日: 2026-10-30
- 調査者: Sylph（外部ファクト調査。設計判断・範囲判断はしない）
- 前提: 非公開 Bot、自分のサーバーのみ、権限 View Channels / Connect / Speak、Intent は GUILDS と GUILD_VOICE_STATES のみ。Windows 11 + Node v24.19.0。声は保存しない、文字起こししない。
- 前回調査: `discussion/ai-cohost/discord-vc/research/discord-voice-bot-2026-10.md`（以下「前回」）。重複は避け、前回の番号を参照する場合は「前回[n]」と書く。
- 表記: 出典つきの記述は確認済みの事実。【推測】は推論。[n] は末尾「出典一覧」。
- 方法: npm registry のメタデータ、GitHub API（issue / PR / release）、`@discordjs/voice@0.19.2` と `prism-media@1.3.5` の配布物（tgz を一時ディレクトリに展開して読んだだけ。インストールも実行もしていない）、Discord 公式文書。

---

## 0. 要点

- **入れるもの（Windows + Node 24）**: `discord.js@14.27.0` と `@discordjs/voice@0.19.2`。DAVE 用の `@snazzah/davey@0.1.12` は voice の依存として自動で入り、win32-x64 の N-API 版バイナリがある（ネイティブビルド不要）[1][2]。
- **暗号ライブラリ（sodium 系）は不要**。このPCの Node 24.19 は `aes-256-gcm` を持つ（`getCiphers()` で確認済み）。0.19.2 は aes-256-gcm があれば `aead_aes256_gcm_rtpsize` を候補の先頭にする [3][4]。
- **Opus ライブラリは、受信を数えるだけなら不要。ビープを鳴らすなら必要**（PCM → Opus のエンコード）[3][4]。Node 24 では `@discordjs/opus@0.10.0` の Windows 用 prebuilt が無い（Node 22 = ABI 127 まで）。入れるとソースからのビルドになり、VS Build Tools と Python が要る [5][6][7]。**`opusscript@0.0.8`（WASM、ビルド不要）が入りやすい**。ただし `opusscript@0.1.1`（latest）は prism-media の peer 範囲 `^0.0.8` に合わず、npm 7+ で ERESOLVE になる報告がある [8][9]。
- **受信の数え方**: `receiver.speaking` の start/end は復号の前に出る。DAVE の復号失敗は 36 回連続までは「黙って捨てる＋debug ログ」、超えると回復を試みるか、ストリームを `error` で破棄する [4]。debug ログ（`joinVoiceChannel({ debug: true })`）の文字列で失敗を数えられる。
- **#11653 は open のまま**。修正 PR #11667 が 2026-10-27 に出たが未マージ [10][11]。#11441・#11445 は「not planned」で閉じられた [12][13]。
- **話者名は非特権で取れる**。`guild.members.fetch(id)`（単体）は REST の Get Guild Member を呼び、特権 Intent の注記は無い。VC にいるメンバーは VOICE_STATE_UPDATE や GUILD_CREATE でキャッシュに入る [14][15][16][17]。
- **プライバシーポリシー**: 開発者規約 5(a) に例外の規定は見当たらない。非公開・自分のサーバー限定でも「Application」に当たる。一方 Developer Portal の項目（`privacy_policy_url`）は API 上は任意 [18][19]。

---

## 1. Windows + Node 24 での入りやすさ

### 1.1 バージョンと依存（npm registry、2026-10-30 時点）[1][2]

| パッケージ | 最新（latest） | engines | ネイティブ | 備考 |
|---|---|---|---|---|
| `discord.js` | 14.27.0（2026-07-15） | node >=18 | なし | 15.x は `15.0.0-dev.*` のみ。安定版の 15 は未公開。dev 版は node >=24.17.0 |
| `@discordjs/voice` | 0.19.2（2026-03-17） | node >=22.12.0 | なし | 依存: ws, prism-media ^1.3.5, `@snazzah/davey` ^0.1.9, discord-api-types。dev 版 `1.0.0-dev.1792497873-5050a3b54`（2026-10-20）は node >=24.17.0 |
| `@snazzah/davey` | 0.1.12（2026-06-22） | node >= 10 | **prebuilt（N-API）** | optionalDependencies に `@snazzah/davey-win32-x64-msvc@0.1.12`（os: win32, cpu: x64, `davey.win32-x64-msvc.node`）。WASM 版もある |
| `@discordjs/opus` | 0.10.0（2025-01-25） | node >=12 | **あり** | `install: node-pre-gyp install --fallback-to-build`。prebuilt は GitHub Releases から取る |
| `opusscript` | 0.1.1（2023-10-10） | — | なし（emscripten、WASM と asm.js） | 0.0.8（2021-02-24）は libopus 1.3.1。install スクリプトなし |
| `prism-media` | 1.3.5（2023-02-27） | — | なし | Opus は optional peer: `@discordjs/opus >=0.8.0 <1.0.0`、`opusscript ^0.0.8`、`node-opus` |

- `@snazzah/davey` の `0.2.0-beta.1`（2026-10-27）は破壊的変更を含む（`processCommit` / `processWelcome` が鍵を更新しなくなる等）[20]。`@discordjs/voice@0.19.2` の範囲 `^0.1.9` では選ばれない。【推測】手で beta を入れないこと。

### 1.2 Opus 復号・エンコードの候補

**事実**

- prism-media 1.3.5 は Opus を次の順で探す: `@discordjs/opus` → `node-opus` → `opusscript`。どれも無いと、エンコーダ・デコーダの生成時に `Could not find an Opus module!` を投げる [21]。
- `@discordjs/voice` 0.19.2 の変換グラフ [4]:
  - Raw（s16le PCM）→ Opus: `prism.opus.Encoder`（**Opus ライブラリが要る**）。
  - Opus → Raw: `prism.opus.Decoder`（同上）。
  - OggOpus / WebmOpus → Opus: デマルチプレクサ（純 JS、Opus ライブラリ不要）。
  - Arbitrary → Raw: FFmpeg。
- 受信ストリーム（`AudioReceiveStream`）が出すのは**復号済みの Opus パケット**で、PCM への変換はしない [4]。→ パケット数・バイト数を数えるだけなら Opus ライブラリは要らない。
- `@discordjs/opus@0.10.0` の GitHub Release にある Windows 用 prebuilt は `node-v72`〜`node-v127`（Node 22）まで。Node 24（ABI `node-v137`）用は無い [5]。
  - issue #200「Node 24 (v137) prebuilt binary availability」は 2026-02-23 から open [6]。
  - PR #206「Node 24 で SIGSEGV（`delete` に配列演算子が無い）」も open。Debian での報告 [6]。
  - リポジトリの最終コミットは 2025-12-11（最小 Node を v20 へ）。それ以降のリリースは無い [5]。
- prebuilt が無いとソースからのビルドに落ちる。node-gyp の Windows 要件は、サポート中の Python と Visual Studio 2019 以降の「Desktop development with C++」ワークロード [7]。
- `opusscript@0.1.1` を入れると、`peerOptional opusscript@"^0.0.8" from prism-media@1.3.5` で npm が ERESOLVE を出した、という報告がある（第三者リポジトリの CI、2026-10）[8]。同種の修正 PR も複数ある [9]。

**【推測】**

- このプローブでは `opusscript@0.0.8` を版指定で入れるのが最も楽。WASM なのでビルドは要らない。エンコードは `@discordjs/opus` より遅いが、短いビープ 1 本なら問題にならない。
- `npm i opusscript` と版を書かずに入れると 0.1.1 が入り、ERESOLVE になりうる。`--legacy-peer-deps` で通す方法もあるが、範囲外の版を使うことになる。
- 復号（Opus → PCM）を使うのは、「パケットは来ているが中身が壊れている」を見分けたい場合だけ（RMS 等）。数だけなら不要。

### 1.3 暗号（sodium 系）

**事実**

- README: 「aes-256-gcm を持たない環境でだけ、次のどれかを入れる」。候補は `sodium-native` / `sodium` / `@stablelib/xchacha20poly1305` / `@noble/ciphers` / `libsodium-wrappers` [3]。
- 0.19.2 の実装: `SUPPORTED_ENCRYPTION_MODES` は既定で `aead_xchacha20_poly1305_rtpsize` だけ。`crypto.getCiphers()` に `aes-256-gcm` があれば `aead_aes256_gcm_rtpsize` を先頭に足す。aes-gcm の暗号化・復号は `node:crypto` で行う。xchacha 側だけ外部ライブラリを使い、無ければ「Cannot play audio as no valid encryption package is installed」を投げる [4]。
- このPCで `node -e` を実行して確認: Node v24.19.0、`aes-256-gcm` あり、`chacha20-poly1305` あり。
- 公式文書: `aead_aes256_gcm_rtpsize` は「Available (Preferred)」、`aead_xchacha20_poly1305_rtpsize` は「Available (Required)」。UDP 節の Ready 例の `modes` は `["aead_aes256_gcm_rtpsize", "aead_xchacha20_poly1305_rtpsize", "xsalsa20_poly1305_lite_rtpsize"]` の順 [22]。

**【推測】**

- 0.19.2 はサーバーが示した `modes` の順に、自分が対応するものを探す（`options.find(...)`）[4]。サーバーの並びが文書の例どおり aes-gcm が先なら、sodium 系は一度も呼ばれない。万一サーバーが xchacha を先に並べた場合だけ、送受信で上記の例外になる。気になるなら `@noble/ciphers`（純 JS）を保険に足せるが、今回の確認範囲では不要と読める。

### 1.4 ネイティブビルドが要るもの（まとめ）

| パッケージ | Windows x64 + Node 24 |
|---|---|
| `discord.js` 14.27.0 | 不要（純 JS）[1] |
| `@discordjs/voice` 0.19.2 | 不要（純 JS）[1] |
| `@snazzah/davey` 0.1.12 | 不要（N-API の prebuilt、`win32-x64-msvc`）[1] |
| `opusscript` 0.0.8 | 不要（WASM）[1] |
| `@discordjs/opus` 0.10.0 | **要る**（Node 24 用 prebuilt が無い）[5][6] |
| sodium 系 | 不要（aes-256-gcm があるので入れない）[3][4] |

- 補足（事実）: `generateDependencyReport()` が `@discordjs/voice` から export されており、Opus・暗号・DAVE・FFmpeg の検出状況を表示する [4][23]。メンテナは不具合報告のたびにこれを求めている [23]。

---

## 2. 受信の数え方（`@discordjs/voice` 0.19.2 の実装）

以下はすべて 0.19.2 の `dist/index.js` を読んで確認した [4]。

### 2.1 パケットが届いてからの流れ（`VoiceReceiver.onUdpMessage`）

1. 長さ 8 バイト以下は捨てる。
2. RTP ヘッダの SSRC から `ssrcMap` を引く。**対応が無ければ黙って捨てる**（`ssrcMap` は音声ゲートウェイの Speaking op 5 で登録、op 13 で削除）。
3. **`speaking.onPacket(userId)` を呼ぶ（ここで `speaking` の `start` が出る）。この時点では復号していない。**
4. その userId の購読（`subscribe`）が無ければ**ここで終わり（復号もしない）**。
5. ペイロード種別が Opus 以外、または RTP version ≠ 2 なら黙って捨てる。
6. `parsePacket`（トランスポート復号 → パディング除去 → ヘッダ拡張除去 → DAVE 復号）。
   - 戻り値が null（DAVE 復号失敗を許容した場合）→ **push しない（黙って捨てる）**。
   - 例外 → **`stream.destroy(error)`**。

### 2.2 speaking の start / end

- `start`: そのユーザーの「話し中」タイマーが無いときに最初のパケットが来たら出る。
- `end`: 最後のパケットから `SpeakingMap.DELAY = 100` ms で出る。
- 3 の順序なので、**start/end は復号の成否と関係なく出る**。購読していないユーザーでも出る。
- 【推測】`start` のハンドラ内で同期的に `subscribe` すると、その直後（同じ呼び出しの手順 4）で購読が見つかるので、最初のパケットから受け取れる。

### 2.3 受信ストリーム（`receiver.subscribe(userId, { end })`）

- 既定の終了条件は `EndBehaviorType.Manual`（自動では閉じない）。ほかに AfterSilence / AfterInactivity。
- 同じ userId で既に購読があれば、同じストリームを返す。`close` で購読表から消える。
- 出てくるのは objectMode の Buffer（Opus ペイロード）。RTP の sequence や timestamp は付かない（0.19.2）。

### 2.4 復号に失敗したとき

**トランスポート層（aes-256-gcm）**

- `decipher.final()` が例外を投げる → `stream.destroy(error)`。そのユーザーのストリームが `error` で終わる。

**DAVE 層（`DAVESession.decrypt`）**

- 次の場合は、**復号せずパケットをそのまま返す**: 無音フレーム `F8 FF FE`、セッションが ready でない、protocol 0 で passthrough 不可。
- `session.decrypt` が例外を投げた場合:
  - 移行中でも再初期化中でもないとき: `consecutiveFailures++`。debug に `Failed to decrypt a packet (N consecutive fails)` を出す。
    - N が `decryptionFailureTolerance`（既定 **36**、`joinVoiceChannel` のオプションで変更可）を超えたら:
      - `lastTransitionId` が truthy → `recoverFromInvalidTransition`。
      - そうでなければ**例外を再送出** → `stream.destroy(error)`。
  - 再初期化中: debug `Failed to decrypt a packet (reinitializing session)`。
  - 移行待ちあり: debug `Failed to decrypt a packet (K pending transition[s])`。
  - どちらも、そのパケットは null を返して**黙って捨てる**。
- 成功すると `consecutiveFailures = 0`。カウンタはセッション全体で 1 つ（ユーザー別ではない）。
- debug は `joinVoiceChannel({ debug: true })` のときだけ、`connection.on('debug')` に `[NW] [DAVE] ...` の接頭辞つきで届く。
- 接続まわりのエラー（IP discovery の失敗を含む）は `connection` の `error` イベントに流れる（0.19.2 では `.catch(e => this.emit('error', e))`）。

**事実（Node の仕様）**: Readable を `destroy(err)` すると `error` イベントが出る。`error` リスナーが無いとプロセスが落ちる。→ 受信ストリームと connection の両方に `error` リスナーを付けること。

### 2.5 失敗を数として拾えるか

| 数えたいもの | 拾い方 | 種別 |
|---|---|---|
| 発話区間の数・長さ | `receiver.speaking` の `start`/`end` と時刻差 | 公開 API [4] |
| 受信パケット数・バイト数 | 購読ストリームの `data` | 公開 API [4] |
| DAVE の復号失敗（許容内で捨てた分） | debug 文字列 `Failed to decrypt a packet` を数える | debug 文字列（安定 API ではない）[4] |
| 許容超え・トランスポート失敗 | 購読ストリームの `error` を数え、再購読 | 公開 API [4] |
| 鍵移行の発生 | debug `Preparing for transition` / `Transition executed` / `MLS welcome processed` / `MLS commit processed` | debug 文字列 [4] |
| SSRC 未登録で捨てた分・購読前の分 | 拾えない（イベントが無い） | — |

**【推測】**

- 「黙って捨てた分」の総量は、`speaking` の区間長 ÷ 20 ms と、実際に受け取ったパケット数の差で、おおよそ見積もれる。Discord クライアントは話している間 20 ms ごとに送ると考えられるので。ただしこれは推測で、正確な欠損数ではない。
- 正確な欠損（RTP sequence の飛び）は 0.19.2 では取れない。main（1.0.0-dev）には `AudioPacket`（`sequence` / `timestamp` / `ssrc` つき）を返す変更 PR #11432 が 2026-06-27 にマージ済み [24]。dev 版は node >=24.17 なので、このPCでも動く要件ではある。ただし dev 版で、破壊的変更を含む。
- DAVE セッションが ready でないと、DAVE で暗号化されたままのフレームがストリームにそのまま流れうる（2.4 の「そのまま返す」）。DAVE フレームの末尾は 2 バイトのマジックマーカー `0xFAFA`（公式プロトコル文書）[25]。受け取ったパケットのうち末尾が `FA FA` のものを数えれば、「復号されずに漏れた DAVE フレーム」の目安になる。

### 2.6 関連 issue の今の状態（2026-10-30 確認）

| 番号 | 内容 | 状態 |
|---|---|---|
| #11653 | transition 0 の Welcome 後、`lastTransitionId` が 0（falsy）なので回復せず、許容を超えると例外を投げ続ける。カウンタがユーザー別でない点、Welcome 後に passthrough を有効にしない点も指摘 | **open**、コメント 0 [10] |
| PR #11667 | 上の修正「recover from invalid transition when lastTransitionId is 0」（2026-10-27） | **open、未マージ** [11] |
| #11441 | DAVE の鍵移行中に 34% のパケットが黙って消える（0.19.0） | **closed（not planned）**。メンテナは「AI slop」とコメント [12] |
| #11445 | 0.19.0 で `UnencryptedWhenPassthroughDisabled` | **closed（not planned）**。再現手順が出れば再開すると [13] |
| #11419 | 0.19.x の再接続ループと受信ゼロ | closed（completed）。PR #11449 で修正、0.19.2 に入った（前回[8][10]） |
| #11436 | Windows + Node 24 で IP discovery の unhandled rejection によりプロセスが落ちる（0.19.0） | closed（not planned）、コメント 0 [26]。0.19.2 では `.catch` で `error` イベントに流す実装 [4] |
| PR #11581 | VOICE_SERVER_UPDATE が先に来ると signalling で止まる | main にマージ（2026-09-28）。**0.19.x には未リリース** [27] |
| PR #11567 | close code 4021/4022 で再接続しない | main にマージ（2026-07-16）。0.19.x には未リリース [27] |
| #8105 | 話している途中で受信ストリームが終わる | open（2022 年から）（前回[26]） |

**#11653 の回避策（issue 本文と実装から）**

- 事実: issue の報告者は、Bot が自分でグループを作った場合（`MLS commit processed (transition id: 0)`）には起きていない、と書いている [10]。
- 【推測】回避の候補:
  - 相手より**先に Bot が VC に入る**（Welcome ではなく Commit で始まる形にする）。
  - ストリームの `error` を受けたら再購読する（ただし失敗が続く間は再購読してもまた壊れる、と報告にある）。
  - `decryptionFailureTolerance` を大きくして、例外まで行く回数を減らす（捨てる量は減らない）。
  - 切断 → 再接続。
- 【推測】`lastTransitionId` を直す 1 行修正（`!== undefined`）を patch-package で当てる方法もある。ただし未マージの変更なので、プローブの目的（素の挙動を数える）と合うかは呼び出し元の判断。

---

## 3. 話者の名前（user id → 表示名）

**事実**

- Get User（`GET /users/{user.id}`）: 「指定 ID のユーザーオブジェクトを返す」。Intent の注記は無い。`global_name` は「表示名（設定されていれば）」、`username` はユーザー名 [14]。
- Get Guild Member（`GET /guilds/{guild.id}/members/{user.id}`）: Intent の注記は無い。**List Guild Members だけ**に「GUILD_MEMBERS 特権 Intent が要る」と書かれている [15]。
- Gateway 文書: 特権 Intent は HTTP の一部エンドポイントにも効く。例として挙がっているのは List Guild Members [16]。
- discord.js 14.27.0:
  - `guild.members.fetch(id)`（単体、`limit` や `withPresences` なし）→ `_fetchSingle` → `rest.get(Routes.guildMember(...))`。つまり **REST の Get Guild Member**。引数なしや複数指定は `_fetchMany`（ゲートウェイの Request Guild Members）[17]。
  - `client.users.fetch(id)` → REST の Get User [17]。
  - `GuildMember#displayName` は `nickname ?? user.displayName`。`User#displayName` は `globalName ?? username` [17]。
  - VOICE_STATE_UPDATE の処理で、ペイロードに `member` があればメンバーキャッシュに追加・更新する [17]。ボイスステートオブジェクトには任意の `member` フィールドがある [28]。
- GUILD_CREATE: GUILD_PRESENCES が無い場合（または 75k 人超）、`members` は「Bot 自身と VC にいるユーザー」だけになる [29]。
- 参考: 2026-05-06 の告知で、特権 Intent の審査基準はサーバー数から利用者数に変わった。**1 万人未満のアプリは Developer Portal のトグルで使える**（今回は使わない前提）[30]。

**【推測】**

- GUILDS と GUILD_VOICE_STATES だけで、VC にいる相手の表示名は、多くの場合 `guild.members.cache.get(userId)?.displayName` で取れる。キャッシュに無ければ `guild.members.fetch(userId)` で REST から取れる。どちらも特権 Intent は不要。
- REST のレート制限はあるが、1 人分を 1 回取るだけなら問題にならない。

---

## 4. Bot から音を鳴らす（その場で作るビープ）

### 4.1 最小の形（0.19.2 の API に沿って）

```js
import { Readable } from 'node:stream';
import { createAudioPlayer, createAudioResource, StreamType } from '@discordjs/voice';

// 48 kHz・2ch・s16le。20 ms（960 サンプル）単位に丸める。
function beepPcm(hz = 880, ms = 300, amp = 0.2) {
  const frames = Math.ceil(ms / 20) * 960;
  const buf = Buffer.alloc(frames * 4); // 2ch × 2byte
  for (let i = 0; i < frames; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * hz * i) / 48000) * amp * 32767);
    buf.writeInt16LE(v, i * 4);
    buf.writeInt16LE(v, i * 4 + 2);
  }
  return buf;
}

const player = createAudioPlayer();
player.on('error', (e) => console.error(e));
connection.subscribe(player);
player.play(createAudioResource(Readable.from([beepPcm()]), { inputType: StreamType.Raw }));
```

**事実（実装から）[4][21]**

- `StreamType.Raw` は `prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 })` を通る。**Opus ライブラリ（`opusscript@0.0.8` か `@discordjs/opus`）が要る**。
- prism の Encoder は 1 フレーム = `frameSize × channels × 2` = 3840 バイトずつエンコードする。上の例はバッファ長を 3840 の倍数にしてある。
- `createAudioResource` の `silencePaddingFrames` 既定は 5。公式文書の「止めるときに無音 5 フレーム」に合う [22]。
- `joinVoiceChannel` の既定は `selfDeaf: true`, `selfMute: false`。**受信するには `selfDeaf: false` を明示する**必要がある。
- Speaking（op 5）の送信は AudioPlayer 側が行う。公式文書は「音声を送る前に少なくとも 1 回 Speaking を送ること」としている [22]。

**【推測】**

- `Readable.from([buf])` は配列の要素 1 つ（Buffer 全体）を 1 チャンクとして流す。`Readable.from(buf)` でも Buffer は分割されない、と Node の文書にある。配列で包むほうが意図が明確。
- FFmpeg は不要（Raw → Opus はエンコーダだけで済む）。

### 4.2 DAVE 下での送信の既知の問題

- 事実: discord.js メンテナ（vladfrangu、2026-02-13）が「DAVE で音声の送信は問題なく使えている。これは受信だけの問題」とコメント（#11419）[23]。
- 事実: 2025-09 以降の `packages:voice` ラベルの issue は 4 件（#11653、#11553、#11419、#11387）。送信が DAVE で壊れるという報告は見当たらなかった [27]。
- 事実: #11553（ときどき signalling で止まる）は送信用 TTS Bot の報告。原因は VOICE_SERVER_UPDATE と VOICE_STATE_UPDATE の到着順。修正 PR #11581 は main にのみマージ済みで、0.19.x には未リリース [27]。
- 事実: open PR #11598「バッファリング中の `stop()` で AudioPlayer が片付かない」（#11039）[27]。
- 事実: davey 0.1.12 のリリースノートは「libdave との一致を修正し、暗号化の信頼性を上げた」[20]。
- 【推測】ビープ 1 本の送信で DAVE 由来の既知の問題に当たる可能性は低い。`entersState(connection, VoiceConnectionStatus.Ready, ...)` が時間切れになったら、作り直して再試行するのが現実的（#11553 の回避と同じ）。

---

## 5. プライバシーポリシーの義務

**事実**

- Discord Developer Terms of Service（2024-07-08 施行。ヘルプセンター上の記事更新日は 2026-10-29。本文の「Last updated: June 6, 2024」は変わっていない）[18]:
  - 5(a): 適用されるプライバシー法に沿ったプライバシーポリシーを用意し、守ること。何を集め、どう使い・共有し、どう削除を求められるかを書くこと。**Developer Portal に公開の最新リンクを置き**、アプリからも見つけやすくすること。
  - 定義: 「Application」は、API にアクセスする、または Application ID を割り当てられた、あらゆるアプリ（Bot を含む）。
  - 本文に「exempt」「non-commercial」「hobby」「own server」などの語は無い。個人利用・非公開・テスト用途の例外は**見つからなかった**。
- Discord 公式 API 文書のアプリケーションオブジェクトでは、`privacy_policy_url?` と `terms_of_service_url?` は **任意**（`?` 付き）の文字列 [19]。
- 「How Do I Get My App Verified?」: 検証は 100 サーバーを超えるのに必須。要件は Developer Portal の「App Verification」タブのチェックリストにある、とだけ書かれ、プライバシーポリシーが項目かは本文に明記が無い [31]。

**【推測】**

- 規約の文面上は、非公開・自分のサーバーだけの Bot でもプライバシーポリシーの義務がある（前回 Q5 の推測を、今回は ToS 本文で例外が無いことまで確認した）。
- Developer Portal 上は入力しなくても Bot は作れて動く（API 上は任意項目のため）。つまり「技術的に必須の入力ではないが、規約上は用意する義務がある」という状態。
- 検証のチェックリストにプライバシーポリシーがあるという第三者の解説はあるが、公式文書では確認できなかった。100 サーバー未満なら検証自体が要らない。
- 今回のプローブは声を保存しない・数だけ記録する。それでも user id や発話の時刻は API Data に当たると読むのが自然。ポリシーの中身は短くて済む。

---

## 6. 出典一覧

1. npm registry: `discord.js` https://registry.npmjs.org/discord.js ／ `@discordjs/voice` https://registry.npmjs.org/@discordjs/voice ／ `@snazzah/davey` https://registry.npmjs.org/@snazzah/davey ／ `@snazzah/davey-win32-x64-msvc` https://registry.npmjs.org/@snazzah/davey-win32-x64-msvc ／ `opusscript` https://registry.npmjs.org/opusscript ／ `prism-media` https://registry.npmjs.org/prism-media ／ `@discordjs/opus` https://registry.npmjs.org/@discordjs/opus
2. 同上（dist-tags と各版の `engines` / `dependencies` / `optionalDependencies`）
3. `@discordjs/voice` 0.19.2 README（Dependencies 節）https://cdn.jsdelivr.net/npm/@discordjs/voice@0.19.2/README.md
4. `@discordjs/voice` 0.19.2 配布物 `dist/index.js`（`VoiceReceiver`、`DAVESession.decrypt`、`SpeakingMap`、`AudioReceiveStream`、`TransformerGraph`、`chooseEncryptionMode`、`joinVoiceChannel`、`createAudioResource`）https://registry.npmjs.org/@discordjs/voice/-/voice-0.19.2.tgz
5. discordjs/opus Release v0.10.0（アセット一覧）https://github.com/discordjs/opus/releases/tag/v0.10.0 ／ コミット履歴 https://github.com/discordjs/opus/commits/main
6. discordjs/opus issue #200 https://github.com/discordjs/opus/issues/200 ／ PR #206 https://github.com/discordjs/opus/pull/206
7. node-gyp README（On Windows）https://github.com/nodejs/node-gyp
8. smv620/Discord-DMbot issue #8（opusscript@0.1.1 と prism-media の ERESOLVE。第三者の報告）https://github.com/smv620/Discord-DMbot/issues/8
9. 同種の修正 PR の例: https://github.com/Aliifilqodri/bot-afk/pull/1 ／ https://github.com/Control-Critic/Constrol/pull/113
10. discord.js issue #11653 https://github.com/discordjs/discord.js/issues/11653
11. discord.js PR #11667 https://github.com/discordjs/discord.js/pull/11667
12. discord.js issue #11441 https://github.com/discordjs/discord.js/issues/11441
13. discord.js issue #11445 https://github.com/discordjs/discord.js/issues/11445
14. Discord Developer Docs「User」https://docs.discord.com/developers/resources/user
15. Discord Developer Docs「Guild」（Get / List / Search Guild Member(s)）https://docs.discord.com/developers/resources/guild
16. Discord Developer Docs「Gateway」（Privileged Intents）https://docs.discord.com/developers/events/gateway
17. discord.js 14.27.0 ソース: `src/managers/GuildMemberManager.js`、`src/structures/GuildMember.js`、`src/structures/User.js`、`src/client/actions/VoiceStateUpdate.js` https://cdn.jsdelivr.net/npm/discord.js@14.27.0/src/
18. Discord Developer Terms of Service https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service（ヘルプセンター API 経由で本文取得）
19. Discord Developer Docs「Application」（Application Object）https://docs.discord.com/developers/resources/application
20. Snazzah/davey Releases（js-0.1.12、js-0.2.0-beta.1）https://github.com/Snazzah/davey/releases
21. prism-media 1.3.5 `src/opus/Opus.js` https://registry.npmjs.org/prism-media/-/prism-media-1.3.5.tgz
22. Discord Developer Docs「Voice Connections」https://docs.discord.com/developers/topics/voice-connections
23. discord.js issue #11419 のメンテナコメント https://github.com/discordjs/discord.js/issues/11419
24. discord.js PR #11432（AudioPacket、2026-06-27 マージ、main）https://github.com/discordjs/discord.js/pull/11432
25. DAVE protocol 文書 https://github.com/discord/dave-protocol/blob/main/protocol.md
26. discord.js issue #11436 https://github.com/discordjs/discord.js/issues/11436
27. discord.js issue #11553 https://github.com/discordjs/discord.js/issues/11553 ／ PR #11581 https://github.com/discordjs/discord.js/pull/11581 ／ PR #11567 https://github.com/discordjs/discord.js/pull/11567 ／ PR #11598 https://github.com/discordjs/discord.js/pull/11598 ／ ラベル検索 https://github.com/discordjs/discord.js/issues?q=label%3Apackages%3Avoice
28. Discord Developer Docs「Voice」（Voice State Object）https://docs.discord.com/developers/resources/voice
29. Discord Developer Docs「Gateway Events」（Guild Create）https://docs.discord.com/developers/events/gateway-events
30. Discord Developer Help「Changes to Privileged Intent Access for Discord Apps」（2026-05-06）https://support-dev.discord.com/hc/en-us/articles/40281523410967-Changes-to-Privileged-Intent-Access-for-Discord-Apps
31. Discord Developer Help「How Do I Get My App Verified?」https://support-dev.discord.com/hc/en-us/articles/23926564536471-How-Do-I-Get-My-App-Verified

---

## 7. 未確認のこと

- `opusscript@0.0.8` が Node 24.19 で実際に動くか（WASM なので動くと見ているが、実行はしていない）。
- `opusscript@0.1.1` での ERESOLVE は第三者 CI の報告のみ。このリポジトリの npm の版で再現するかは未確認。
- Discord の音声サーバーが実際に返す `modes` の並び（公式文書の例は aes-gcm が先）。
- Discord クライアントが話している間、本当に 20 ms ごとに欠かさず送るか（欠損見積もりの前提）。
- Developer Portal の「App Verification」チェックリストの現行の項目。
- PR #11667 のマージ時期と、それを含む 0.19.x / 1.0.0 のリリース予定。
