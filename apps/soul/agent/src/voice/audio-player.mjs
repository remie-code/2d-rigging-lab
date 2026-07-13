// @ts-check
/**
 * 常駐音声再生プロセス（S1 Domain B → S6 Domain A で WinRT MediaPlayer 化）— apps/soul/agent。
 *
 * ── なぜ刷新したか（s6-planning-inventory §3-1/§3-2）──────────────────────────
 *  S1 は常駐 PowerShell `System.Media.SoundPlayer.PlaySync()`（ブロッキング）で鳴らしていた。だが
 *  PlaySync 中は stdin の ReadLine に戻れないため**停止コマンドが届かない**（barge-in 不能）・SoundPlayer は
 *  出力デバイス指定も不可。S6 は会話が続く（相手が話し始めたら声を止める）ため、途中停止と出力デバイス
 *  指定が要る。両方を一挙に満たす現実解が **WinRT `Windows.Media.Playback.MediaPlayer`**（PowerShell 5.1
 *  から `Add-Type -AssemblyName System.Runtime.WindowsRuntime` のみ・依存ゼロで使用可・実機実証済み）。
 *   - 非同期再生 ⇒ stdin コマンドループが生きたまま = **STOP が届く**。
 *   - `AudioDevice` プロパティ ⇒ 出力デバイス指定（日本語名含む・env 経由で無劣化受け渡し）。
 *   - `PlaybackSession`（Position/NaturalDuration/PlaybackState）の 50ms ポーリング ⇒ 再生実区間の追跡
 *     （「本当に喋っとる区間」= barge-in の切断点算出材料。WinRT イベント購読は PS5.1 不可を実測）。
 *
 * ── 常駐 1 プロセス設計は維持 ────────────────────────────────────────────────
 *  子プロセスを 1 本だけ常駐させ、同一 MediaPlayer の Source 差し替えで連続再生する（spawn コストを
 *  起動 1 回に押し出す S1 の設計を継承）。stdin へ行コマンドを送るたびに再生／停止する。
 *
 * ── 行プロトコル（PLAY/STOP + 状態応答行）──────────────────────────────────────
 *  Node → PS（stdin, 1 行 1 コマンド）:
 *    "PLAY <wavPath>"  非同期再生開始（Source 差し替え + Play()）。前の声は置換される。
 *    "STOP"            再生中の声を途中停止（Pause + Source=null）。barge-in 用。
 *  PS → Node（stdout, 1 行 1 応答・タブ区切り <marker>\t<arg>）:
 *    "STARTED\t<path>" 再生開始を受理した（isPlaying = true）。
 *    "ENDED\t<path>"   自然完了を検出した（Position が NaturalDuration に到達）。
 *    "STOPPED\t<path>" STOP で途中停止した。
 *    "ERROR\t<message>" Source 設定/再生の失敗（常駐は継続）。
 *  出力デバイス指定は env `SOUL_AUDIO_DEVICE_NAME`（起動時に PS が列挙して名前一致の DeviceInformation を
 *  AudioDevice にセット・未指定/不一致なら既定デバイス）。
 *
 * ── 機械テストは無音（絶対規律）─────────────────────────────────────────────
 *  command/args/spawnImpl/env を差し替え可能にしてある。テストは PowerShell の代わりに無音の疑似
 *  MediaPlayer プロセス（`test-support/fake-media-player.mjs`）を注入し、行コマンド → 状態応答という
 *  往復プロトコルと内部再生状態だけを検証する。実際にスピーカーから音を出すのは preflight/人間ゲートの領分。
 */

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runPowerShellScript } from "../eyes/powershell-exec.mjs";

/**
 * WinRT ロード + await ヘルパの共通前置き（常駐スクリプトと列挙スクリプトで共有）。
 * PowerShell 5.1 は WinRT の IAsyncOperation を直接 await できないため、System.Runtime.WindowsRuntime の
 * AsTask 拡張（引数 1 個・IAsyncOperation`1 版）を反射で取り出して .NET Task に橋渡しする（定石）。
 */
const WINRT_PRELUDE = String.raw`Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + "`" + String.raw`1' })[0]
function Await($op, $t) { $m = $asTaskGeneric.MakeGenericMethod($t); $task = $m.Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }`;

/**
 * 常駐 PowerShell スクリプト（既定 command 用）。生 stdin ストリームを ReadAsync で非ブロッキングに
 * 読みつつ（TextReader.ReadLineAsync はリダイレクト stdin で 2 回目以降が同期ブロックし得るため生
 * ストリームを使う・実機検証済み）、50ms ごとに PlaybackSession をポーリングして自然完了を検出する。
 * 完了判定は PlaybackState だけでなく **Position >= NaturalDuration - 80ms** を併用する（STOP の Pause や
 * 連続再生の状態遷移を「完了」と誤検出しないため・実機検証済み）。
 */
const RESIDENT_POWERSHELL_SCRIPT = String.raw`[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
${WINRT_PRELUDE}
[void][Windows.Media.Playback.MediaPlayer,Windows.Media,ContentType=WindowsRuntime]
[void][Windows.Media.Core.MediaSource,Windows.Media,ContentType=WindowsRuntime]
[void][Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
[void][Windows.Media.Devices.MediaDevice,Windows.Media.Devices,ContentType=WindowsRuntime]
$Playing = [Windows.Media.Playback.MediaPlaybackState]::Playing
$Opening = [Windows.Media.Playback.MediaPlaybackState]::Opening
$Buffering = [Windows.Media.Playback.MediaPlaybackState]::Buffering
$player = New-Object Windows.Media.Playback.MediaPlayer
$devName = $env:SOUL_AUDIO_DEVICE_NAME
if ($devName) {
  try {
    $selector = [Windows.Media.Devices.MediaDevice]::GetAudioRenderSelector()
    $devices = Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($selector)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
    $match = $null
    foreach ($d in $devices) { if ($d.Name -eq $devName) { $match = $d; break } }
    if ($match -ne $null) { $player.AudioDevice = $match; [Console]::Error.WriteLine('device-set: ' + $devName) }
    else { [Console]::Error.WriteLine('device-not-found: ' + $devName) }
  } catch { [Console]::Error.WriteLine('device-error: ' + $_.Exception.Message) }
}
$stdin = [System.Console]::OpenStandardInput()
$readBuf = New-Object byte[] 4096
$decoder = ([System.Text.UTF8Encoding]::new($false)).GetDecoder()
$charBuf = New-Object char[] 4096
$lineBuf = ''
$readTask = $null
$currentPath = $null
$playing = $false
$sawPlaying = $false
function Handle-Line($line) {
  $line = $line.Trim()
  if ($line.Length -eq 0) { return }
  if ($line -eq 'STOP') {
    try { $script:player.Pause() } catch {}
    try { $script:player.Source = $null } catch {}
    Write-Output ('STOPPED' + [char]9 + $script:currentPath)
    $script:playing = $false; $script:sawPlaying = $false; $script:currentPath = $null
  } elseif ($line.StartsWith('PLAY ')) {
    $p = $line.Substring(5).Trim()
    try {
      $uri = New-Object System.Uri($p)
      $script:player.Source = [Windows.Media.Core.MediaSource]::CreateFromUri($uri)
      $script:player.Play()
      $script:currentPath = $p; $script:playing = $true; $script:sawPlaying = $false
      Write-Output ('STARTED' + [char]9 + $p)
    } catch { Write-Output ('ERROR' + [char]9 + $_.Exception.Message); $script:playing = $false; $script:currentPath = $null }
  }
}
while ($true) {
  if ($readTask -eq $null) { $readTask = $stdin.ReadAsync($readBuf, 0, $readBuf.Length) }
  if ($readTask.Wait(50)) {
    $count = $readTask.Result
    $readTask = $null
    if ($count -eq 0) { break }
    $charCount = $decoder.GetChars($readBuf, 0, $count, $charBuf, 0)
    if ($charCount -gt 0) {
      $lineBuf += (New-Object string ($charBuf, 0, $charCount))
      while (($nl = $lineBuf.IndexOf([char]10)) -ge 0) {
        $line = $lineBuf.Substring(0, $nl).TrimEnd([char]13)
        $lineBuf = $lineBuf.Substring($nl + 1)
        Handle-Line $line
      }
    }
  }
  if ($playing) {
    $session = $player.PlaybackSession
    $state = $session.PlaybackState
    if ($state -eq $Playing) { $sawPlaying = $true }
    $pos = $session.Position.TotalMilliseconds
    $dur = $session.NaturalDuration.TotalMilliseconds
    if ($sawPlaying -and $state -ne $Playing -and $state -ne $Opening -and $state -ne $Buffering -and $dur -gt 0 -and $pos -ge ($dur - 80)) {
      Write-Output ('ENDED' + [char]9 + $currentPath)
      $playing = $false; $sawPlaying = $false; $currentPath = $null
    }
  }
}
try { $player.Dispose() } catch {}`;

/**
 * 出力デバイス列挙スクリプト（`listAudioDevices` 用・単発実行）。WinRT の
 * DeviceInformation.FindAllAsync(GetAudioRenderSelector()) でアクティブな出力デバイスを列挙し、
 * { id, name } の配列を JSON で 1 行出力する（UTF-8 出力前置きは runPowerShellScript が付与）。
 */
const LIST_DEVICES_POWERSHELL_SCRIPT = `${WINRT_PRELUDE}
[void][Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
[void][Windows.Media.Devices.MediaDevice,Windows.Media.Devices,ContentType=WindowsRuntime]
$selector = [Windows.Media.Devices.MediaDevice]::GetAudioRenderSelector()
$devices = Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($selector)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
$out = @()
foreach ($d in $devices) { $out += [pscustomobject]@{ id = $d.Id; name = $d.Name } }
ConvertTo-Json -Compress -InputObject $out`;

const DEFAULT_COMMAND = "powershell.exe";
const DEFAULT_ARGS = [
  "-NoProfile",
  "-NonInteractive",
  "-NoLogo",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  RESIDENT_POWERSHELL_SCRIPT
];

/**
 * 合成 WAV バイト列を OS の temp ディレクトリに書き出し、パスを返す。
 * 再生指示は「PLAY <ファイルパス>」なので、バイト列は一旦ファイル化して渡す。
 * @param {Uint8Array} bytes  RIFF/WAVE PCM のバイト列。
 * @param {object} [options]
 * @param {string} [options.dir]  書き出し先ディレクトリ（既定 OS temp 配下の一意ディレクトリ）。
 * @param {string} [options.prefix]  ファイル名 prefix（既定 "utterance-"）。
 * @returns {string}  書き出した WAV ファイルの絶対パス。
 */
export function writeTempWav(bytes, options = {}) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("writeTempWav(bytes): bytes must be a Uint8Array.");
  }
  const dir = options.dir ?? mkdtempSync(path.join(tmpdir(), "soul-agent-"));
  const prefix = options.prefix ?? "utterance-";
  const fileName = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`;
  const filePath = path.join(dir, fileName);
  writeFileSync(filePath, bytes);
  return filePath;
}

/**
 * 状態応答行のマーカー（PS → Node）。
 */
const MARK_STARTED = "STARTED";
const MARK_ENDED = "ENDED";
const MARK_STOPPED = "STOPPED";
const MARK_ERROR = "ERROR";

/**
 * 常駐再生プレイヤーを起動する。
 * @param {object} [options]
 * @param {string} [options.command]  実行コマンド（既定 powershell.exe）。テストで差し替える注入点。
 * @param {string[]} [options.args]  引数（既定は常駐 MediaPlayer スクリプト）。
 * @param {(command: string, args: string[], opts: object) => import("node:child_process").ChildProcess} [options.spawnImpl]
 *   spawn の差し替え（テスト用）。既定 node:child_process spawn。
 * @param {string} [options.deviceName]  出力デバイス名（env SOUL_AUDIO_DEVICE_NAME で PS へ渡す）。
 *   未指定なら既定デバイスで再生（S1 挙動の無退行）。
 * @param {NodeJS.ProcessEnv} [options.env]  spawn へ渡す基底 env（既定 process.env）。テスト用。
 * @param {(line: string) => void} [options.onOutput]  子プロセス stdout の 1 行ごと（状態応答の観測用）。
 * @param {(line: string) => void} [options.onError]  子プロセス stderr の 1 行ごと（再生失敗の観測用）。
 * @returns {{
 *   play: (wavPath: string) => void;
 *   stop: () => void;
 *   isPlaying: () => boolean;
 *   dispose: () => void;
 *   child: import("node:child_process").ChildProcess;
 * }}
 */
export function createAudioPlayer(options = {}) {
  const command = options.command ?? DEFAULT_COMMAND;
  const args = options.args ?? DEFAULT_ARGS;
  const spawnImpl = options.spawnImpl ?? spawn;
  const onOutput = options.onOutput;
  const onError = options.onError;

  // 出力デバイス名を env 経由で PowerShell へ無劣化受け渡し（日本語名含む・inventory §3-2 実測）。
  // 未指定なら env に何も足さず既定デバイスで鳴る（S1 無退行）。
  const baseEnv = options.env ?? process.env;
  const spawnEnv = options.deviceName
    ? { ...baseEnv, SOUL_AUDIO_DEVICE_NAME: options.deviceName }
    : baseEnv;

  const child = spawnImpl(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: spawnEnv
  });

  // 内部再生状態: 状態応答行から更新する（isPlaying() の裏付け）。
  let playing = false;

  if (child.stdout) {
    lineReader(child.stdout, (line) => {
      const tab = line.indexOf("\t");
      const marker = tab >= 0 ? line.slice(0, tab) : line;
      if (marker === MARK_STARTED) {
        playing = true;
      } else if (marker === MARK_ENDED || marker === MARK_STOPPED || marker === MARK_ERROR) {
        playing = false;
      }
      if (onOutput) {
        onOutput(line);
      }
    });
  }
  if (onError && child.stderr) {
    lineReader(child.stderr, onError);
  }

  let disposed = false;

  /** stdin へ 1 行コマンドを書く共通処理（改行除去で 1 行プロトコルを守る）。 */
  const writeCommand = (line) => {
    if (!child.stdin || child.stdin.destroyed) {
      throw new Error("audio player stdin is not writable.");
    }
    const clean = line.replace(/[\r\n]+/g, "");
    child.stdin.write(`${clean}\n`);
  };

  return {
    /**
     * 再生指示を送る（非ブロッキング＝指示送出のみ・完了は待たない）。
     * MediaPlayer は非同期なので stdin ループは生きたまま = この後 stop() も届く。
     * @param {string} wavPath  再生する WAV の絶対パス。
     */
    play(wavPath) {
      if (disposed) {
        throw new Error("audio player already disposed.");
      }
      if (typeof wavPath !== "string" || wavPath.length === 0) {
        throw new TypeError("play(wavPath): wavPath must be a non-empty string.");
      }
      writeCommand(`PLAY ${wavPath}`);
    },
    /**
     * 再生中の声を途中で止める（barge-in 用・Domain B が呼ぶ）。
     * 送出のみで完了は待たない。停止応答（STOPPED）は onOutput 経由で届く。
     */
    stop() {
      if (disposed) {
        throw new Error("audio player already disposed.");
      }
      writeCommand("STOP");
    },
    /**
     * 直近の状態応答に基づく再生中フラグ（STARTED で true・ENDED/STOPPED/ERROR で false）。
     * 「本当に喋っとる区間」の粗い問い合わせ口（正確な切断点は Domain B が再生開始時刻 + タイムラインで算出）。
     * @returns {boolean}
     */
    isPlaying() {
      return playing;
    },
    /**
     * 常駐プロセスを畳む（stdin を閉じてから kill）。
     *
     * ── クリーンシャットダウン（event loop に残さない・機械テストのハング対策）─────
     *  kill 後、child の stdio パイプ（stdin/stdout/stderr）を destroy し、child ハンドルを unref
     *  する（S1 domain-c.md のハング調査の作法を踏襲）。kill だけだと reap 待ちで ChildProcess ハンドルが
     *  event loop を生かし続け、テストランナーがハングし得るため、fd 由来ハンドルを即解放する。
     */
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      playing = false;
      try {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.end();
        }
      } catch {
        // best-effort
      }
      child.kill();
      try {
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
      } catch {
        // best-effort
      }
      child.unref();
    },
    child
  };
}

/**
 * アクティブな出力オーディオデバイスを列挙する（操縦席のデバイス選択 UI の純部品）。
 * WinRT `DeviceInformation.FindAllAsync(GetAudioRenderSelector())` を単発の powershell.exe で実行する
 * （常駐プレイヤーとは独立・列挙は 1 プロセス完結）。powershell-exec.mjs の共通 exec 層を再利用する。
 *
 * @param {object} [options]
 * @param {number} [options.timeoutMs=8000]  列挙のタイムアウト（WinRT ロード + 列挙で数百ms〜数秒）。
 * @param {string} [options.powershellPath]  既定 "powershell.exe"。
 * @param {typeof import("node:child_process").spawn} [options.spawnImpl]  テスト用 spawn 差し替え。
 * @param {() => number} [options.nowImpl]
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @returns {Promise<
 *   { devices: Array<{ id: string; name: string }> } |
 *   { error: { kind: "failed" | "timeout"; message: string } }
 * >}
 */
export async function listAudioDevices(options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const result = await runPowerShellScript(LIST_DEVICES_POWERSHELL_SCRIPT, {
    timeoutMs,
    powershellPath: options.powershellPath,
    spawnImpl: options.spawnImpl,
    nowImpl: options.nowImpl,
    setTimeoutImpl: options.setTimeoutImpl,
    clearTimeoutImpl: options.clearTimeoutImpl
  });
  if (result.timedOut) {
    return { error: { kind: "timeout", message: `listAudioDevices timed out after ${timeoutMs}ms` } };
  }
  if (result.code !== 0 && result.code !== null && result.stdout.trim().length === 0) {
    return {
      error: {
        kind: "failed",
        message: `powershell exited ${result.code}${result.stderr ? `: ${result.stderr.trim()}` : ""}`
      }
    };
  }
  return parseListDevicesStdout(result.stdout, result.stderr);
}

/**
 * listAudioDevices の PowerShell stdout（ConvertTo-Json 出力）を解釈する純関数。
 * Windows PowerShell 5.1 の ConvertTo-Json は要素 1 個の配列を単一オブジェクトとしてシリアライズする
 * 既知の癖があるため、単一オブジェクト/配列/null/空文字列の全形を配列へ正規化する（window-list と同じ作法）。
 *
 * @param {string} stdout
 * @param {string} [stderr]
 * @returns {
 *   { devices: Array<{ id: string; name: string }> } |
 *   { error: { kind: "failed"; message: string } }
 * }
 */
export function parseListDevicesStdout(stdout, stderr = "") {
  const trimmed = (stdout ?? "").trim();
  if (trimmed.length === 0) {
    // 出力なし = デバイス 0 件（0 件は失敗ではない）。
    return { devices: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      error: {
        kind: "failed",
        message: `unparseable device JSON: ${error instanceof Error ? error.message : String(error)}${
          stderr ? ` (stderr: ${stderr.trim()})` : ""
        }`
      }
    };
  }
  if (parsed == null) {
    return { devices: [] };
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const devices = [];
  for (const item of list) {
    if (item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string") {
      devices.push({ id: item.id, name: item.name });
    }
  }
  return { devices };
}

/**
 * ストリームを行単位に割ってコールバックへ流す（依存ゼロの簡易 line reader）。
 * @param {import("node:stream").Readable} stream
 * @param {(line: string) => void} onLine
 */
function lineReader(stream, onLine) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        onLine(line);
      }
    }
  });
}
