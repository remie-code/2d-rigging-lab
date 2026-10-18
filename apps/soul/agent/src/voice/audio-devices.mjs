// @ts-check
/**
 * 出力オーディオデバイスの列挙（操縦席のデバイス選択 UI の純部品）— apps/soul/agent。
 *
 * 旧 `audio-player.mjs`（WinRT MediaPlayer のファイル再生・声の差し替え Wave 2 で廃止）から、列挙だけを
 * そのまま移したもの。列挙は WinRT `DeviceInformation.FindAllAsync(GetAudioRenderSelector())` を単発の
 * powershell.exe で実行する（常駐の流し込みプレイヤーとは独立・1 プロセス完結）。返す `name` は
 * 流し込みプレイヤー（stream-player.mjs）が WASAPI の FriendlyName と全長で照合する名前と同じ文字列。
 */

import { runPowerShellScript } from "../eyes/powershell-exec.mjs";

/**
 * WinRT ロード + await ヘルパの共通前置き。
 * PowerShell 5.1 は WinRT の IAsyncOperation を直接 await できないため、System.Runtime.WindowsRuntime の
 * AsTask 拡張（引数 1 個・IAsyncOperation`1 版）を反射で取り出して .NET Task に橋渡しする（定石）。
 */
const WINRT_PRELUDE = String.raw`Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + "`" + String.raw`1' })[0]
function Await($op, $t) { $m = $asTaskGeneric.MakeGenericMethod($t); $task = $m.Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }`;

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
