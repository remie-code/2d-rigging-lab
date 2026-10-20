# 声の差し替え Wave 1 / Domain B — 流し込みプレイヤー 完了報告

> Gnome → Undine(2026-10-18)。計画: [../../orchestration/voice-swap-wave-plan.md](../../orchestration/voice-swap-wave-plan.md) §1 Domain B。コミットはしていない。

## 1. 変更ファイル(すべて新規)

- `apps/soul/agent/src/voice/stream-player.mjs` — 常駐 PowerShell + C# の再生器と Node API
- `apps/soul/agent/src/voice/stream-player.test.mjs` — node:test 28 件

既存の audio-player / speak / progressive-speech-delivery / tts-playback-coordinator / mind / channel には触れていない。`src/test-support/` は範囲外なので、偽の常駐プロセスはテストファイルの中に置いた(fake child と `node -e` の代役)。

## 2. 採用した再生方式: WASAPI 共有モード(Add-Type の C# から COM interop)

理由:

1. **デバイス名を全長で一致できる。**
   - WASAPI の `PKEY_Device_FriendlyName` は、操縦席の `listAudioDevices`(WinRT `DeviceInformation.Name`)と同じ文字列になる。実機の 5 台で一致を確かめた。
   - waveOut の `szPname` は 31 字で切れるため、前方一致の曖昧さが残る。
2. **実際の再生開始が取れる。** `STARTED` は IAudioClock の位置が 0 を超えた時点で出す。
3. **遅れが小さい。** 形式変換は `AUTOCONVERTPCM | SRC_DEFAULT_QUALITY` に任せるので、24kHz モノラルをそのまま渡せる。

構成:

- C# のメインスレッドが stdin を同期で読み、音の仕事は専用の MTA スレッドが持つ。PowerShell 側は Add-Type と `Run` の呼び出しだけをする(WinRT イベントの問題を避けるため)。
- ポーリングは 5ms で、`timeBeginPeriod(1)` を使う。WASAPI のバッファは 500ms。
- 形式が同じなら、前の IAudioClient を再利用する。
- 既定デバイスで鳴らしているときは、OPEN のたびに既定が変わったかを見て、変わっていれば作り直す。
- 引用符崩れを避けるため、C# は base64 で -Command に埋め込む。スクリプトに二重引用符はない。コマンドラインは約 21.5K 字(上限は 32767)。

デバイス名の一致: env `SOUL_AUDIO_DEVICE_NAME` と FriendlyName を、大文字小文字を無視して全長で比べる(旧 PS の `-eq` と同じ)。一致しなければ既定デバイス(eConsole)を使う。stderr に `device-set:` / `device-not-found:` / `device-default:` を出す(UTF-8)。

## 3. プロトコルの最終形

- 入力:
  - `OPEN\t<id>\t<rate>\t<ch>`(8000..192000 / 1..2)
  - `DATA\t<id>\t<base64>`
  - `END\t<id>`
  - `STOP`
- 返り:
  - `READY\t<デバイス名>`
  - `STARTED\t<id>`
  - `ENDED\t<id>`
  - `STOPPED` または `STOPPED\t<id>`
  - `ERROR\t<id|空>\t<msg>`
- 振る舞い:
  - 別の id の DATA / END、END 後の DATA は無視する。
  - OPEN は前の再生を黙って捨てる(返りはない)。
  - 音のない発話は、STARTED なしで ENDED を返す。
  - ERROR の後も常駐は続き、次の OPEN で作り直す。

## 4. Node API

`createStreamPlayer({ deviceName, command, args, spawnImpl, env, maxDataBytes, onEvent, onOutput, onError, nowImpl })` は、次を返す。

- `open(id, { sampleRate, channels })`
- `write(id, pcm) → boolean`
- `end(id) → boolean`
- `stop()`
- `onEvent(cb) → 解除関数`
- `whenReady() → Promise<boolean>`
- `current()`
- `isAlive()`
- `dispose()`
- `child`

イベントには、すべて `atMs` が付く。

- `ready{device}`
- `started{id}`
- `ended{id}`
- `stopped{id|null}`
- `error{id|null, message}`
- `exit{id, code, signal, message?}`

振る舞い:

- DATA は 16KiB ごとに分ける(既定。1 行は base64 で約 22KB)。
- 今の発話でない id の STARTED / ENDED は捨てる。
- 異常終了すると `exit` を 1 回だけ出し、その後の操作は投げる。

## 5. テスト

- `node --test`(apps/soul/agent): 1395 / 1395 pass(新規 28 件を含む)。
- `check:soul-zone`: passed。

## 6. 実音の確認

0.3 秒・440Hz・振幅 0.05 のサイン波を、in-memory で既定デバイス(スピーカー (Realtek(R) Audio))へ 1 回流した。

- STARTED と ENDED は返った。
- OPEN から STARTED まで 85ms。
- STARTED から ENDED まで 279ms。STARTED の検出が 5〜20ms ほど遅れるため、音の長さ(300ms)より短く見えている。

無音の PCM でも確かめた(音は鳴らない)。

| 確認 | 結果 |
|---|---|
| OPEN → STARTED(初回 / 再利用) | 47ms / 18ms |
| STOP → STOPPED | 1ms 未満 |
| OPEN での置き換え(48k ステレオへ変更)と、別 id の DATA / END の無視 | 確認した |
| 奇数長の分割 | 確認した |
| 音のない発話 | ENDED が返った |
| 不正な形式 | ERROR が返った |
| spawn から READY まで | 約 0.5 秒 |

## 7. 裁量で決めたこと

- `READY` 行と `STOPPED\t<id>` を足した(どちらも追加で、計画の形は保っている)。
- channels は 1 または 2 に限った。
- ENDED は、溜めた分が空で、時計の位置が書いた長さに届いたら出す。届かなくても 300ms で打ち切る。
- 先読みのためのバッファ(プリバッファ)は持たない。

## 8. 質問・残るリスク

1. 届く速さが実時間より遅く、途中で音が途切れたときは、無音のまま進める(区切りの検出も継続通知もない)。ElevenLabs は約 9 倍の速さで届くので問題ない見込みだが、最初の 30ms のかたまりの直後にプチッと鳴らないかは人間ゲートで確かめたい。必要なら、Wave 2 でプリバッファの設定を足せる。
2. 起動に約 0.5 秒かかる。Wave 2 では、最初の Fire まで作らずに待つのではなく、Start のときに作ることを勧める。
