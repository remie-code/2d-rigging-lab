// @ts-check
/**
 * ウインドウ列挙（S5 Domain A「目が開く」）— apps/soul/agent。
 *
 * `Get-Process | Where-Object { $_.MainWindowTitle } | Select Id,ProcessName,MainWindowTitle` を
 * PowerShell（powershell.exe 1 回起動・タイムアウト付き）で実行し、JSON で受け取る。操縦席の
 * 「対象ウインドウ選択」の一覧取得ボタン用途（棚卸し §3-4: 実測 546〜563ms/回・更新ボタン用途なら許容帯）。
 *
 * **既知の制約（docs 事実として明記・実装で回避しない）**:
 *   Win32 の `MainWindowHandle`/`MainWindowTitle` は「プロセスごとに主ウインドウ 1 個」しか返さない。
 *   同一プロセスが複数のトップレベルウインドウを持つ場合、2 個目以降は列挙に現れない
 *   （Win11 新メモ帳はタブ統合で 1 プロセス 1 タイトルなので実害なし。ゲームも通常 1 プロセス 1 窓が
 *   多く実害は薄いが、マルチウインドウ構成のアプリでは取りこぼしうる）。
 *
 * ── 失敗方針 ─────────────────────────────────────────────────────────
 *  window-capture.mjs と同型の判別可能な戻り値にする（`{ windows }` | `{ error }`）。
 *  kind は "failed"（powershell 非0終了・JSON 解釈不能等）と "timeout" の 2 種。
 *  ウインドウ 0 件（`MainWindowTitle` を持つプロセスが無い）は失敗ではなく `{ windows: [] }`。
 */

import { runPowerShellScript } from "./powershell-exec.mjs";

/** Node 側列挙タイムアウト既定値（ms）。棚卸し §3-4 実測 546〜563ms/回に安全マージン。 */
export const DEFAULT_LIST_TIMEOUT_MS = 3000;

/**
 * ウインドウ列挙用 PowerShell スクリプト全文を組む純関数。
 * PowerShell 5.1 の `ConvertTo-Json` は要素 1 個の配列を配列でなく単一オブジェクトとしてシリアライズする
 * 既知の癖があるため、Node 側パース（parseListStdout）で単一オブジェクト/配列/null の 3 形を吸収する。
 * @returns {string}
 */
export function buildListScriptText() {
  return [
    "$ErrorActionPreference = 'Stop'",
    "$procs = Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id,ProcessName,MainWindowTitle",
    "$list = @($procs)",
    "if ($list.Count -eq 0) {",
    "  Write-Output '[]'",
    "} else {",
    "  Write-Output ($list | ConvertTo-Json -Compress)",
    "}"
  ].join("\n");
}

/**
 * listWindows の stdout を解釈する純関数（powershell を起動せずテストできる）。
 * @param {string} stdout
 * @returns {
 *   { windows: Array<{ pid: number; processName: string; title: string }> } |
 *   { error: { kind: "failed"; message: string } }
 * }
 */
export function parseListStdout(stdout) {
  const trimmed = stdout.trim();
  if (trimmed.length === 0 || trimmed === "null") {
    return { windows: [] };
  }
  /** @type {any} */
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      error: { kind: "failed", message: `JSON parse error: ${err instanceof Error ? err.message : String(err)}` }
    };
  }
  if (parsed === null) {
    return { windows: [] };
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  const windows = arr
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      pid: Number(x.Id),
      processName: String(x.ProcessName ?? ""),
      title: String(x.MainWindowTitle ?? "")
    }))
    .filter((w) => Number.isFinite(w.pid));
  return { windows };
}

/**
 * 起動中ウインドウ（MainWindowTitle を持つプロセス）を列挙する。
 *
 * @param {object} [options]
 * @param {number} [options.timeoutMs]  既定 DEFAULT_LIST_TIMEOUT_MS。
 * @param {string} [options.powershellPath]
 * @param {*} [options.spawnImpl]       テスト用 spawn 差し替え。
 * @param {() => number} [options.nowImpl]
 * @param {*} [options.setTimeoutImpl]
 * @param {*} [options.clearTimeoutImpl]
 * @returns {Promise<
 *   { windows: Array<{ pid: number; processName: string; title: string }> } |
 *   { error: { kind: "failed"|"timeout"; message: string } }
 * >}
 */
export async function listWindows(options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_LIST_TIMEOUT_MS;
  const scriptText = buildListScriptText();

  const result = await runPowerShellScript(scriptText, {
    powershellPath: options.powershellPath,
    timeoutMs,
    spawnImpl: options.spawnImpl,
    nowImpl: options.nowImpl,
    setTimeoutImpl: options.setTimeoutImpl,
    clearTimeoutImpl: options.clearTimeoutImpl
  });

  if (result.timedOut) {
    return { error: { kind: "timeout", message: `window listing timed out after ${timeoutMs}ms` } };
  }

  if (result.code !== 0 && result.stdout.trim().length === 0) {
    return {
      error: {
        kind: "failed",
        message: `powershell exited ${result.code} with no stdout: ${result.stderr.slice(0, 500)}`
      }
    };
  }

  return parseListStdout(result.stdout);
}
