// @ts-check
/**
 * ウインドウキャプチャ（S5 Domain A「目が開く」・PrintWindow 経路）— apps/soul/agent。
 *
 * PrintWindow + PW_RENDERFULLCONTENT を PowerShell（System.Drawing・.NET 内蔵）で 1 プロセス完結実行し、
 * 「完全一致タイトルで窓発見 → composited 描画取得 → 長辺 1024 に縮小 → JPEG エンコード → base64 化」
 * まで powershell.exe 側で終わらせて stdout へ吐く（棚卸し §3-2: PrintWindow が唯一 composited 内容を
 * 撮れた経路。gdigrab は DirectComposition 系描画が真っ白になる地雷があるため不採用＝裁定済み）。
 *
 * **画像はディスクへ一切書かない**（MemoryStream → base64 → stdout のみ・PowerShell 側にも一時ファイルなし）。
 *
 * ── 失敗は正直に（throw ではなく戻り値）─────────────────────────────────
 *  引数不正（呼び出しミス）だけは TypeError で早期に弾く。それ以外の失敗は必ず
 *  `{ error: { kind, message } }` を返す（成功を捏造しない）。kind:
 *    - "notFound"  完全一致タイトルの窓が見つからない
 *    - "minimized" IsIconic が true（PowerShell 側で PrintWindow より先に判定）
 *    - "failed"    PrintWindow が false を返した／GDI 例外／stdout が解釈不能／異常に小さいデータ
 *    - "timeout"   Node 側のタイムアウト（子プロセスは kill 済み）
 *
 * ── stdout プロトコル（本ファイルが唯一の実装・唯一の読者）───────────────
 *  成功: "CAPTURE_OK\n<width>\n<height>\n<base64>\n"
 *  失敗: "CAPTURE_FAIL\n<kind>\n<message...>\n"（message は残り行を全部 join。改行を含みうる）
 *  各 kind は 1 行目のマーカー + 2 行目の kind 文字列から一意に判定できる。
 */

import { runPowerShellScript } from "./powershell-exec.mjs";

/** 縮小後の長辺（px）。v0 はツマミなし固定値（棚卸し §3-3 の帯: 1024 で JPEG base64 100〜160KB程度）。 */
export const DEFAULT_MAX_SIDE = 1024;

/**
 * JPEG 品質（System.Drawing の Encoder.Quality・0〜100・**100 が最高画質**＝ffmpeg mjpeg q とは逆スケール）。
 * 75 は「web 用途の実用品質」としてよく採られる値で、視覚劣化を抑えつつサイズを抑制する（棚卸し §3-3 の
 * 目安 100〜160KB/枚に収まる想定）。具体的な実測 KB は preflight-eyes.mjs で確認するが、preflight は
 * メモ帳窓のみを対象とし、ゲーム窓での実測は人間ゲートの領分（§質問で申し送り）。
 */
export const DEFAULT_JPEG_QUALITY = 75;

/** Node 側キャプチャタイムアウト既定値（ms）。棚卸し §3-2: 列挙 546〜563ms/回からの類推で起動+PrintWindow
 *  約550ms、実測 PrintWindow 単体 64ms。エンコード込みでも数百ms〜1s程度と見込み、5s を安全マージンとする。 */
export const DEFAULT_CAPTURE_TIMEOUT_MS = 5000;

/** CAPTURE_OK の base64 データがこの文字数未満なら「白紙/壊れデータの成功マーカー」とみなし failed へ落とす
 *  形式ガード（画素解析はしない・あくまで異常に短いデータの門番）。最小限の 1x1 JPEG でも数百バイト＝
 *  base64で400字前後はあるため、100字を下回るものは構造的に壊れているとみなせる。 */
const MIN_PLAUSIBLE_BASE64_LENGTH = 100;

/**
 * PowerShell の単一引用符文字列リテラルへ安全に埋め込むためのエスケープ（' → ''）。
 * シングルクォート文字列は変数展開されない（$ や ` はリテラルのまま）ため、これだけで足りる。
 * @param {string} s
 * @returns {string}
 */
export function escapePsSingleQuoted(s) {
  return s.replace(/'/g, "''");
}

/**
 * PrintWindow キャプチャ用 PowerShell スクリプト全文を組む純関数（powershell を起動せずテストできる）。
 * @param {string} title 完全一致で探す対象ウインドウタイトル。
 * @param {object} [opts]
 * @param {number} [opts.maxSide]
 * @param {number} [opts.jpegQuality]
 * @returns {string}
 */
export function buildCaptureScriptText(title, opts = {}) {
  const maxSide = opts.maxSide ?? DEFAULT_MAX_SIDE;
  const jpegQuality = opts.jpegQuality ?? DEFAULT_JPEG_QUALITY;
  const escapedTitle = escapePsSingleQuoted(title);

  return [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Drawing",
    "$sig = @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public class EyesNative {",
    '  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);',
    '  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);',
    '  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);',
    "  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }",
    "}",
    "'@",
    "Add-Type -TypeDefinition $sig -ErrorAction Stop",
    `$title = '${escapedTitle}'`,
    "$proc = Get-Process | Where-Object { $_.MainWindowTitle -eq $title } | Select-Object -First 1",
    "if (-not $proc) {",
    "  Write-Output 'CAPTURE_FAIL'",
    "  Write-Output 'notFound'",
    '  Write-Output "window not found: $title"',
    "  exit 0",
    "}",
    "$hwnd = $proc.MainWindowHandle",
    "if ([EyesNative]::IsIconic($hwnd)) {",
    "  Write-Output 'CAPTURE_FAIL'",
    "  Write-Output 'minimized'",
    "  Write-Output 'window is minimized'",
    "  exit 0",
    "}",
    "try {",
    "  $rect = New-Object EyesNative+RECT",
    "  [void][EyesNative]::GetWindowRect($hwnd, [ref]$rect)",
    "  $width = $rect.Right - $rect.Left",
    "  $height = $rect.Bottom - $rect.Top",
    "  if ($width -le 0 -or $height -le 0) { throw 'invalid window size' }",
    "  $bitmap = New-Object System.Drawing.Bitmap $width, $height",
    "  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
    "  $hdc = $graphics.GetHdc()",
    "  $printed = [EyesNative]::PrintWindow($hwnd, $hdc, 2)",
    "  $graphics.ReleaseHdc($hdc)",
    "  $graphics.Dispose()",
    "  if (-not $printed) {",
    "    $bitmap.Dispose()",
    "    Write-Output 'CAPTURE_FAIL'",
    "    Write-Output 'failed'",
    "    Write-Output 'PrintWindow returned false'",
    "    exit 0",
    "  }",
    `  $maxSide = ${maxSide}`,
    "  $scale = [Math]::Min(1.0, $maxSide / [Math]::Max($width, $height))",
    "  $outW = [Math]::Max(1, [int][Math]::Round($width * $scale))",
    "  $outH = [Math]::Max(1, [int][Math]::Round($height * $scale))",
    "  $resized = New-Object System.Drawing.Bitmap $bitmap, $outW, $outH",
    "  $bitmap.Dispose()",
    "  $ms = New-Object System.IO.MemoryStream",
    "  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1",
    "  $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)",
    `  $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]${jpegQuality})`,
    "  $resized.Save($ms, $encoder, $encParams)",
    "  $resized.Dispose()",
    "  $bytes = $ms.ToArray()",
    "  $b64 = [Convert]::ToBase64String($bytes)",
    "  Write-Output 'CAPTURE_OK'",
    "  Write-Output $outW",
    "  Write-Output $outH",
    "  Write-Output $b64",
    "} catch {",
    "  Write-Output 'CAPTURE_FAIL'",
    "  Write-Output 'failed'",
    "  Write-Output $_.Exception.Message",
    "}"
  ].join("\n");
}

/**
 * captureWindow の stdout を解釈する純関数（powershell を起動せずテストできる）。
 * @param {string} stdout
 * @returns {
 *   { jpegBase64: string; width: number; height: number } |
 *   { error: { kind: "notFound"|"minimized"|"failed"; message: string } }
 * }
 */
export function parseCaptureStdout(stdout) {
  const lines = stdout.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { error: { kind: "failed", message: "empty stdout from capture script" } };
  }

  if (lines[0] === "CAPTURE_OK") {
    const width = Number(lines[1]);
    const height = Number(lines[2]);
    const jpegBase64 = lines[3] ?? "";
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return { error: { kind: "failed", message: `malformed CAPTURE_OK dimensions: ${JSON.stringify(lines.slice(1, 3))}` } };
    }
    if (jpegBase64.length < MIN_PLAUSIBLE_BASE64_LENGTH) {
      // 白紙/壊れデータの「成功」を成功として通さない形式ガード（画素解析はしない）。
      return {
        error: {
          kind: "failed",
          message: `CAPTURE_OK reported success but base64 payload is implausibly short (${jpegBase64.length} chars)`
        }
      };
    }
    return { jpegBase64, width, height };
  }

  if (lines[0] === "CAPTURE_FAIL") {
    const kind = lines[1];
    const message = lines.slice(2).join("\n") || "capture failed (no message)";
    if (kind === "notFound" || kind === "minimized" || kind === "failed") {
      return { error: { kind, message } };
    }
    return { error: { kind: "failed", message: `unknown CAPTURE_FAIL kind "${kind}": ${message}` } };
  }

  return { error: { kind: "failed", message: `unrecognized capture stdout: ${stdout.slice(0, 300)}` } };
}

/**
 * 対象ウインドウを 1 枚キャプチャする。
 *
 * @param {string} title 完全一致タイトル（列挙で得た実タイトルを使う前提）。
 * @param {object} [options]
 * @param {number} [options.maxSide]      縮小後の長辺 px（既定 DEFAULT_MAX_SIDE）。
 * @param {number} [options.jpegQuality]  JPEG 品質 0-100（既定 DEFAULT_JPEG_QUALITY）。
 * @param {number} [options.timeoutMs]    既定 DEFAULT_CAPTURE_TIMEOUT_MS。
 * @param {string} [options.powershellPath]
 * @param {*} [options.spawnImpl]         テスト用 spawn 差し替え。
 * @param {() => number} [options.nowImpl]
 * @param {*} [options.setTimeoutImpl]
 * @param {*} [options.clearTimeoutImpl]
 * @returns {Promise<
 *   { jpegBase64: string; width: number; height: number; elapsedMs: number } |
 *   { error: { kind: "notFound"|"minimized"|"failed"|"timeout"; message: string } }
 * >}
 */
export async function captureWindow(title, options = {}) {
  if (typeof title !== "string" || title.length === 0) {
    throw new TypeError("captureWindow: title must be a non-empty string");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_CAPTURE_TIMEOUT_MS;
  const scriptText = buildCaptureScriptText(title, {
    maxSide: options.maxSide,
    jpegQuality: options.jpegQuality
  });

  const result = await runPowerShellScript(scriptText, {
    powershellPath: options.powershellPath,
    timeoutMs,
    spawnImpl: options.spawnImpl,
    nowImpl: options.nowImpl,
    setTimeoutImpl: options.setTimeoutImpl,
    clearTimeoutImpl: options.clearTimeoutImpl
  });

  if (result.timedOut) {
    return { error: { kind: "timeout", message: `capture timed out after ${timeoutMs}ms` } };
  }

  if (result.code !== 0 && result.stdout.trim().length === 0) {
    return {
      error: {
        kind: "failed",
        message: `powershell exited ${result.code} with no stdout: ${result.stderr.slice(0, 500)}`
      }
    };
  }

  const parsed = parseCaptureStdout(result.stdout);
  if ("error" in parsed) {
    return parsed;
  }
  return { ...parsed, elapsedMs: result.elapsedMs };
}
