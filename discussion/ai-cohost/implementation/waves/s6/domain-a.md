# S6 Domain A: 声の器官刷新（`src/voice/`・WinRT MediaPlayer 化・停止/デバイス指定/再生実区間）

> Status: 実装完了・機械ゲート緑・実機 preflight PASS（2026-07-13）。人間ゲート（実配信での barge-in
> 体感・指定デバイスからの実再生）は後続 Domain（B/C/D）と人間ゲートに持ち越し。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md) §3 Domain A /
> [../../orchestration/s6-planning-inventory.md](../../orchestration/s6-planning-inventory.md) §3-1〜3-3。
> 実機事実は inventory §3-2 をそのまま採用（再発見不要の裁定通り）＋ 本 Domain の preflight で end-to-end 再確認。

## 0. パイプライン（この Domain が敷いた線）

```
createAudioPlayer({ deviceName?, onOutput?, onError?, ... })
  └─ powershell.exe 1 本を常駐起動（WinRT MediaPlayer・env SOUL_AUDIO_DEVICE_NAME で出力先指定）
       Node → PS (stdin, 1 行 1 コマンド)      PS → Node (stdout, 状態応答行 <marker>\t<arg>)
         "PLAY <wavPath>"  ─────────────▶        "STARTED\t<path>"   (isPlaying=true)
                                                 "ENDED\t<path>"     (自然完了・Position≥Duration)
         "STOP"            ─────────────▶        "STOPPED\t<path>"   (barge-in 途中停止)
                                                 "ERROR\t<message>"  (Source設定/再生失敗・常駐は継続)
  play(wavPath) / stop() / isPlaying() / dispose() / child

listAudioDevices()  → 単発 powershell.exe（常駐と独立）
  └─ DeviceInformation.FindAllAsync(GetAudioRenderSelector()) → { devices: [{ id, name }] } | { error }

speak(text, deps) → { timeline, wavDurationSec, wavPath, rttMs, playbackStartedAtMs(★S6追加) }
  ★ player.play(wavPath) を呼んだ瞬間（声が鳴り始めた t=0）の時刻。barge-in の切断点算出材料。
```

- `play`/`stop`/`isPlaying`/`listAudioDevices` は Domain B（barge-in・fire-orchestrator 結線）と Domain D
  （操縦席のデバイス選択 UI）が呼ぶ純部品。**このドメインでは呼び出し側（fire-orchestrator・cli・cockpit）を
  一切変更していない**（`player.play(wavPath)` の signature と `speak()` の既存戻り値を壊さず、新能力は追加サーフェス）。

## 1. 実装/変更ファイル一覧

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/voice/audio-player.mjs` | 変更 | 常駐 SoundPlayer(PlaySync) → **WinRT MediaPlayer** 化。`createAudioPlayer` に `stop()`/`isPlaying()`/`deviceName`/`env` を追加。`listAudioDevices()` / `parseListDevicesStdout()` を新規 export。`writeTempWav` は不変。 |
| `src/voice/speak.mjs` | 変更 | 戻り値に **`playbackStartedAtMs`** を追加（注入 clock `nowImpl`・既定 Date.now）。既存フィールド（timeline/wavDurationSec/wavPath/rttMs）と `player.play` 呼び出し signature は不変。 |
| `src/voice/audio-player.test.mjs` | 変更 | 新プロトコル（PLAY/STOP + 状態応答）の往復・停止・isPlaying・deviceName env 受け渡し・列挙パースを fake で検証。7 本 → 20 本。 |
| `src/voice/speak.test.mjs` | 変更 | `playbackStartedAtMs` の決定論テストを 1 本追加（4 本 → 5 本）。既存 4 本は不変。 |
| `src/test-support/fake-media-player.mjs` | 新規 | 新プロトコルを喋る無音の疑似 MediaPlayer プロセス（PLAY→STARTED / STOP→STOPPED / END→ENDED / 起動時 env→DEVICE 行）。機械テスト無音の代役。 |
| `scripts/preflight-voice.mjs` | 新規 | 実機疎通 preflight（機械テストではない）。自前合成の小音量 WAV で ①既定再生+自然完了検出 ②STOP 途中停止 ③列挙 を検証・**実行済み PASS**（§5）。合成 WAV は temp のみ・終了時 rm。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`
は完全不変**（§6 の `git diff --stat` で確認・新規依存ゼロ・WinRT/PowerShell 内蔵 + Node 組み込みのみ）。

### 依存方向の設計判断（申し送り）

`audio-player.mjs` は `listAudioDevices()` の単発 PowerShell 実行に、S5 Domain A の共通 exec 層
`src/eyes/powershell-exec.mjs` の `runPowerShellScript`（spawn/timeout/cleanup/UTF-8 前置きの実績ある土台）を
**再利用**した（voice → eyes の src 内 import）。独自 exec を書く DRY 違反を避けた選択。soul-zone-boundary
チェックは通過（同一魂ゾーン内 import・§6）。常駐プレイヤー本体は eyes に依存せず自前 spawn（stdin 常駐が必要で
runPowerShellScript の 1 回起動モデルと形が違うため）。

## 2. 純部品の契約（引数・戻り値・失敗の扱い）

### `createAudioPlayer(options?)`

```
createAudioPlayer({
  command?: string;      // 既定 "powershell.exe"
  args?: string[];       // 既定は常駐 MediaPlayer スクリプト
  spawnImpl?;            // テスト用
  deviceName?: string;   // 出力デバイス名（env SOUL_AUDIO_DEVICE_NAME で PS へ）。未指定=既定デバイス（S1 無退行）
  env?: NodeJS.ProcessEnv; // spawn 基底 env（既定 process.env）
  onOutput?: (line) => void; // stdout 状態応答行の観測
  onError?: (line) => void;  // stderr 行の観測（device-set/not-found 等）
}) => {
  play(wavPath: string): void;  // "PLAY <path>" 送出（非ブロッキング）。空/非文字列は TypeError。改行は除去。dispose 後は throw
  stop(): void;                 // "STOP" 送出（barge-in 途中停止）。dispose 後は throw
  isPlaying(): boolean;         // 状態応答由来。STARTED→true / ENDED・STOPPED・ERROR→false
  dispose(): void;              // stdin.end → kill → stdio destroy → unref（event loop に残さない・冪等）
  child: ChildProcess;
}
```

- **失敗の扱い**: `play`/`stop` は引数不正（play の空文字）と dispose 後のみ throw。再生そのものの失敗
  （Source 設定不能等）は PS が `ERROR\t<message>` 行を返し、常駐は継続（呼び出し側が onOutput で観測）。
- **isPlaying の意味**: 状態応答行に基づく粗いフラグ。正確な切断点は Domain B が `speak()` の
  `playbackStartedAtMs` + モーラタイムライン + 相手発話時刻で算出する（isPlaying は「まだ喋っているか」の目安）。
- **デバイス指定**: `deviceName` 指定時のみ env に `SOUL_AUDIO_DEVICE_NAME` を足す。未指定なら env を素通し＝
  既定デバイス再生（S1 挙動の無退行）。PS 側は起動時に列挙して Name 完全一致の DeviceInformation を
  `MediaPlayer.AudioDevice` にセット。不一致なら stderr に `device-not-found` を出して既定のまま続行。

### `listAudioDevices(options?)`

```
listAudioDevices({ timeoutMs?=8000, powershellPath?, spawnImpl?, nowImpl?, setTimeoutImpl?, clearTimeoutImpl? }) =>
  Promise<{ devices: Array<{ id: string; name: string }> } | { error: { kind: "failed"|"timeout"; message } }>
```

- eyes/window-list と同型の判別可能戻り値（`{ devices }` | `{ error }`）に統一。**0 件は失敗ではない**
  （`{ devices: [] }`）。kind は `failed`（powershell 非 0 終了+stdout 空／JSON 解釈不能）と `timeout` の 2 種。
- `parseListDevicesStdout(stdout, stderr?)` は純関数として独立 export（決定論テスト用）。PS5.1 `ConvertTo-Json` の
  「1 要素配列を単一オブジェクト化する癖」に対し、単一オブジェクト/配列/null/空文字列を全て配列へ正規化。
  `id`/`name` の両方が文字列のエントリのみ採用（欠落は黙って除外＝成功を捏造しない側に倒す）。

### `speak(text, deps)` の戻り値拡張

- 追加: **`playbackStartedAtMs`** = `player.play(wavPath)` を呼んだ直後に `deps.nowImpl()`（既定 Date.now）で取る時刻。
- 既存フィールド（`timeline`/`wavDurationSec`/`wavPath`/`rttMs`）・`player.play` signature・処理順序（accepted→play）は不変。
  呼び出し側（fire-orchestrator は戻り値を捨てている・cli は wavPath 等のみ参照）は後方互換で無変更。

## 3. PowerShell 側プロトコル（`audio-player.mjs` の常駐スクリプトが唯一の実装/読者）

### 行コマンド（stdin・1 行 1 コマンド）
- `PLAY <wavPath>`: `MediaSource.CreateFromUri(new Uri(path))` を Source に差し替え → `Play()`（非同期）。前の声は置換。
- `STOP`: `Pause()` + `Source = $null`（barge-in 途中停止）。

### 状態応答行（stdout・タブ区切り `<marker>\t<arg>`）
- `STARTED\t<path>`: PLAY 受理直後。
- `ENDED\t<path>`: 自然完了検出。**判定 = `sawPlaying && state∉{Playing,Opening,Buffering} && Position ≥ NaturalDuration − 80ms`**。
- `STOPPED\t<path>`: STOP による停止。
- `ERROR\t<message>`: Source 設定/再生の例外（常駐継続）。

### 常駐ループの中核（実機検証で確定した 2 つの要点）
1. **stdin は `Console.OpenStandardInput()` の生ストリームを `Stream.ReadAsync` + `Task.Wait(50)` で非ブロッキング読み**。
   `TextReader.ReadLineAsync()` はリダイレクト stdin で 2 回目以降が同期ブロックし得る（＝ポーリングに到達せず
   自然完了 ENDED が出ない）ことを実機で踏んだため、生ストリーム方式に確定。UTF-8 は Decoder でインクリメンタルに割る。
2. **完了判定に `Position ≥ NaturalDuration` を併用**。PlaybackState のみの判定だと、連続再生の状態遷移や STOP の
   Pause を「自然完了」と誤検出する（短 WAV 連続再生で ENDED 誤発火を実機で観測）。Position 併用で
   「途中停止（Position < Duration）」と「自然完了」を確実に区別。
- 出力デバイスは env `SOUL_AUDIO_DEVICE_NAME`（起動時に列挙して Name 一致の DeviceInformation を AudioDevice にセット）。
- WinRT ロードは `Add-Type -AssemblyName System.Runtime.WindowsRuntime` + AsTask 反射ヘルパ（PS5.1 定石・依存ゼロ）。

## 4. 変更した既存テストと変更理由（プロトコル変更の意図明示）

| テスト | 変更 | 理由 |
|---|---|---|
| `audio-player.test.mjs` の旧「生パス往復」系（`played:<path>` を検証する 4 本: play 往復・複数 play・改行除去・dispose 後 throw の期待値） | 期待値を新プロトコル（`STARTED\t<path>` / `STOPPED` / `PLAY`・`STOP` 送出）へ更新 | **wave-plan §3 Domain A が明示指示した意図的なプロトコル変更**（SoundPlayer 生パス → MediaPlayer PLAY/STOP + 状態応答）。旧プロトコル自体が無くなったため期待値の更新は不可避。 |
| 代役プロセス `echo-player.mjs`（旧・`played:<path>` を返す） | **無変更で温存** | `cli.test.mjs` が引き続き使用（そちらは echo の stdout を検証せず「無音往復を踏む」だけ）。audio-player の新テストは別の `fake-media-player.mjs` を新設して分離。 |
| `speak.test.mjs` | 既存 4 本は**無変更**・`playbackStartedAtMs` 検証を 1 本追加 | 戻り値へのフィールド追加は既存 assert に非干渉（後方互換）。追加テストは注入 clock で決定論固定。 |

呼び出し側契約（`speak()` の既存戻り値フィールド・`player.play(wavPath)` signature）は破壊していない。
`cli.test.mjs`・`fire-orchestrator` 系テストは無変更で通過（§8）。

## 5. preflight-voice の検証内容と実行結果

`scripts/preflight-voice.mjs` は機械テストではなく実機検証スクリプト。**このセッション内で実行し PASS を確認済み**。
自前合成の小音量サイン波 WAV（44100Hz mono 16bit・振幅≈8%・300ms/800ms）で本番 `audio-player.mjs`（実 WinRT
MediaPlayer 常駐 PowerShell・既定デバイス）を end-to-end 駆動した（= 本番 PS スクリプト文字列＝WINRT_PRELUDE の
バッククォートエスケープ含む＝が実機で正しく動くことの確認でもある）。合成 WAV は temp のみ・終了時に temp ごと rm。

### 実測（2026-07-13・このセッション実行・生数字）

```
① 既定デバイス再生（短 WAV 300ms）
   STARTED 観測: spawn + WinRT ロード込み 521ms
   ENDED 観測（自然完了検出）: STARTED から 333ms（WAV 300ms + オーバーヘッド ≈33ms）  isPlaying=false
② STOP 途中停止（長 WAV 800ms・250ms で STOP）
   応答: ["STARTED\t...\long.wav", "STOPPED\t...\long.wav"]
   midPlaying=true（STOP 前に再生中）  誤ENDED=false（自然完了は誤発火せず）  isPlaying=false
③ listAudioDevices() 列挙: 5 件（476ms）
   - BenQ EX2510S (NVIDIA High Definition Audio)
   - スピーカー (Pico Streaming Speaker)
   - TOSHIBA-TV (NVIDIA High Definition Audio)
   - スピーカー (Realtek(R) Audio)
   - ヘッドホン (2- Shure MV7+)   ← 日本語名・inventory §3-2 実測と一致（無劣化）
RESULT: PASS / EXIT=0
```

- inventory §3-2 の「800ms WAV→904/919ms で検出」に対し、本 preflight の短 WAV は STARTED から 333ms で自然完了検出
  （オーバーヘッド ≈33ms・50ms ポーリング粒度の範囲内）。列挙 5 件も inventory の実測と一致。
- STOP 途中停止で誤 ENDED が出ないこと（Position 併用判定の効果）を実機で確認。

## 6. 器不変・依存ゼロ・チェック無退行の確認

```
git diff --stat -- apps/runtime-player packages           → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json → 出力なし（lockfile・依存不変＝新規依存ゼロ）
git diff --stat -- *channel-protocol-contract*            → 出力なし（契約 JSON 不変）
git status --porcelain（.tmp 除外）:
   M apps/soul/agent/src/voice/audio-player.mjs
   M apps/soul/agent/src/voice/audio-player.test.mjs
   M apps/soul/agent/src/voice/speak.mjs
   M apps/soul/agent/src/voice/speak.test.mjs
  ?? apps/soul/agent/scripts/preflight-voice.mjs
  ?? apps/soul/agent/src/test-support/fake-media-player.mjs
```

`.tmp/facex-*`（別セッション領分）は一切触っていない。変更は `apps/soul/agent/src/**` と `scripts/**` のみ（scope 内）。

### 構造チェック 3 種（このセッション実行）
- `check:deps`（`node scripts/check-dependencies.mjs`）: **passed**（Dependency guard passed）。
- `check:soul-zone`（`node scripts/check-soul-zone-boundary.mjs`）: **passed**（1337 files・器↔魂 越境 import なし。
  voice→eyes は同一魂ゾーン内 import のため問題なし）。
- `check:source`（`node scripts/check-source-organization.mjs`）: EXIT=1 だが唯一の違反は
  `apps/runtime-player/src/main/physiology/index.ts`（器コード・本 Domain で不変＝`git diff --stat` 空）。
  **私のスコープ（soul/agent）には違反ゼロ**。この違反はブランチ既存（器側 pre-existing）であり本 Domain の
  導入ではない＝無退行（§7-4 に申し送り）。

## 7. §質問（Orch / Domain B・C・D への申し送り・迷った裁定点）

1. **isPlaying の粒度は「状態応答フラグ」で切断点算出には粗い（Domain B へ）**: `isPlaying()` は STARTED/ENDED/STOPPED
   に基づく boolean で、「今どこまで声に出たか」は持たない。barge-in の正確な切断点は Domain B が
   `speak()` の `playbackStartedAtMs` + モーラタイムライン + `speechStart` の時刻から算出する設計（inventory §3-3）。
   MediaPlayer の再生 Position を Node へ返す口は今回作っていない（プロトコルに `POSITION` 応答を足せば可能だが、
   タイムライン×経過時間で足りるはずなので v0 は追加していない）。もし実 Position が要るなら申し出てほしい。
2. **STOP の完了通知タイミング（Domain B へ）**: `stop()` は送出のみで、実際の停止確定は `STOPPED` 行が
   onOutput に届いた時点。barge-in で「止めた」を確定したいなら onOutput の STOPPED を待つ設計にできる（今回は
   `isPlaying()` が false に落ちることで観測可能）。口閉じ（channel の mouth-open set）との順序は Domain B の裁定。
3. **デバイス名は完全一致・列挙名をそのまま渡す前提（Domain D へ）**: `deviceName` は PS 側 `Name -eq` の完全一致。
   `listAudioDevices()` が返した `name` をそのまま `createAudioPlayer({ deviceName })` に渡す前提（列挙名と設定名が
   同一ソース）。不一致時は既定デバイスにフォールバック（stderr に `device-not-found`）＝声が消えるより既定で鳴る側に倒した。
   操縦席の永続化・再起動時の適用（プレイヤーは起動時に env で受けるので、デバイス変更は常駐再起動が要る）は Domain D の裁定。
   なお `id` での指定は今回未実装（`DeviceInformation.CreateFromIdAsync`）。名前一致で実機疎通は確認済みだが、同名デバイスが
   複数ある環境では id 指定が要るかもしれない（実機は同名なし・v0 は名前で十分と判断）。
4. **check:source の既存違反（Orch へ）**: `apps/runtime-player/src/main/physiology/index.ts` の barrel-only 違反は
   本 Domain の変更前から存在する器コード側の状態（私は runtime-player を 1 バイトも触っていない）。本 Domain の
   機械ゲート（`node --test`）とは独立。器側の課題として台帳化が要るか判断してほしい。
5. **preflight は既定デバイス再生のみ実測（人間ゲートへ）**: `deviceName` 指定での「指定デバイスからの実再生」は
   preflight では鳴らしていない（既定デバイスで鳴らす方が安全・列挙 ③ でデバイス指定経路の疎通は確認）。
   「魂の声がマイクの拾わんデバイス（ヘッドホン (2- Shure MV7+)）から出る」の目視/耳確認は人間ゲートの領分
   （wave-plan §1 ⑥・音響設営手順は Domain D の手順書）。
6. **WinRT ロードのオーバーヘッド（Domain B/D へ）**: 常駐起動〜最初の STARTED まで 521ms（spawn + WinRT ロード込み）。
   常駐 1 プロセスなので初回のみ。以後の PLAY は即時（Source 差し替え）。起動タイミングは cli/orchestrator の
   既存結線（起動時に 1 回 createAudioPlayer）に従う想定。

## 8. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 425
# pass  425
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

**S6 前ベースライン 411 → 425（+14）**。内訳:
- `audio-player.test.mjs`: 7 → 20（**+13**）。新規: stop 往復・isPlaying(STARTED/ENDED・STOPPED)・deviceName env
  受け渡し 2 本・parseListDevicesStdout 5 本・listAudioDevices 2 本。既存 play 往復系はプロトコル変更で期待値更新（§4）。
- `speak.test.mjs`: 4 → 5（**+1**）。`playbackStartedAtMs` の決定論テスト追加。既存 4 本は不変。
- 他ファイル（fire-orchestrator・cli 等の呼び出し側テスト）は無変更で全通過＝呼び出し側契約の無退行を確認。

preflight-voice を実機で実行し PASS（§5・EXIT=0）。実行後、合成 WAV は temp ごと削除済み・scratchpad の検証用
一時ファイル（probe WAV/PS/driver）も削除済み。
