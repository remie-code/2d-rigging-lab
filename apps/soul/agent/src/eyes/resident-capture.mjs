// @ts-check
/**
 * 立ち上げたままの撮る係（常駐 PowerShell によるウインドウキャプチャ）— apps/soul/agent。
 *
 * 調査（discussion/ai-cohost/research/vision-capture-latency-2026-10.md §1）で、毎回の撮影に約 0.6 秒の
 * 待ちがあり、その大半が powershell.exe の毎回起動（約 330ms）と C# P/Invoke 定義の毎回コンパイル
 * （Add-Type・約 110ms）だと分かった。ここでは PowerShell を 1 回だけ起動して型を読み込み、以後は
 * stdin で撮る窓のタイトルを受け取り stdout で画像を返すループに撮らせる（決定 §3 = 案 C・合意 §4）。
 *
 * ── 合意 §4 の写し（ここに書いていないことは広げない）──────────────────────
 *  1. 常駐の PowerShell。型の読み込みは起動時に 1 回だけ。入出力とも UTF-8。
 *  2. 耳の Start に合わせて start()、耳の Stop で stop()（結線は cockpit-server の onEarsStarted /
 *     onEarsStopped と scripts/cockpit.mjs）。操縦席の終了時にも stop()。
 *  3. 1 回の撮影に 2 秒の上限。超えたらその回は { error: { kind: "timeout" } }（今と同じく画像なしで
 *     喋る扱い）とし、撮る係を立ち上げ直す。落ちた場合も同様に立ち上げ直す。
 *  4. 窓はタイトルの完全一致のまま。返す形（{jpegBase64,width,height,elapsedMs} / {error}）と画像の
 *     作り方（長辺 1024・JPEG 75・PrintWindow(hwnd, hdc, 2)）は window-capture.mjs と同じ。
 *  5. 撮る窓の一覧（window-list.mjs）は今のまま（ここでは触らない）。
 *
 * ── 撮る係が使えないとき（合意 §4 の 6 = 実装側で選んだ扱い）────────────────
 *  起動中（ready 前）・起動失敗で諦めた後・stop 済み・別の撮影が返事待ちのとき に capture() が呼ばれたら、
 *  **今の captureWindow（毎回起動・タイムアウト 5 秒）に戻す**。今の挙動そのもの（画像は届く・待ちが
 *  約 0.6 秒に戻るだけ）なので、手動の「見て喋る」発火が画像なしで中止される等の新しい劣化を生まない。
 *  なお発火そのものは耳が止まっていると ears-not-running で弾かれる（fire-orchestrator）ため、
 *  耳停止中に撮影が要る経路は通常ない。
 *
 * ── stdin / stdout の約束（本ファイルが唯一の実装・唯一の読者）────────────────
 *  起動完了: "RESIDENT_READY\n"（型の読み込みと JPEG エンコーダの用意が済んだ合図）
 *  要求（1 行）: "CAPTURE <id> <base64(UTF-8 のタイトル)>\n"
 *    タイトルは base64 で包む（タイトル中の空白・改行・文字コードで 1 行の区切りが壊れないように）。
 *  応答: window-capture.mjs と同じ本文（"CAPTURE_OK\n<w>\n<h>\n<base64>" / "CAPTURE_FAIL\n<kind>\n<message...>"）
 *    の後に終端行 "CAPTURE_END <id>\n"。本文は parseCaptureStdout でそのまま解釈する。
 *  stdin が閉じたら（Node 側が落ちた・stop した）ループを抜けて終わる（取り残しの二重の防波堤）。
 *
 * ── 子プロセスの後始末（S1 ハング教訓・ffmpeg-capture.mjs の dispose と同じ作法）────────
 *  kill → stdio destroy → unref を一度だけ。タイマは unref。時計・タイマ・spawn は注入可能。
 *  stdin への書き込み失敗（EPIPE 等）は error リスナで握る（落ちたことは exit で知る）。
 */

import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

import { DEFAULT_POWERSHELL_PATH, buildPowerShellInvocationArgs } from "./powershell-exec.mjs";
import {
  DEFAULT_JPEG_QUALITY,
  DEFAULT_MAX_SIDE,
  captureWindow as defaultFallbackCapture,
  parseCaptureStdout
} from "./window-capture.mjs";

/** 1 回の撮影の上限（ms・合意 §4 の 3）。 */
export const RESIDENT_CAPTURE_TIMEOUT_MS = 2000;

/** 起動完了（RESIDENT_READY）までの上限（ms）。調査の実測は約 450ms。余裕を大きく取る。 */
export const RESIDENT_STARTUP_TIMEOUT_MS = 10000;

/** 落ちた後に立ち上げ直すまでの間（ms）。撮影の上限超えのときは待たずにすぐ立ち上げ直す。 */
export const RESIDENT_RESTART_DELAY_MS = 500;

/**
 * 起動完了の前に続けて落ちた回数がこれに達したら、その start() の間は立ち上げ直しを諦める
 * （powershell.exe が無い等で起動と失敗を延々繰り返さないため）。以後の撮影は毎回起動に戻る。
 * 一度でも起動完了したら数え直す。次の start()（耳の Start）でまた試す。
 */
export const RESIDENT_MAX_START_FAILURES = 3;

const READY_LINE = "RESIDENT_READY";
const END_PREFIX = "CAPTURE_END ";

/**
 * 常駐用 PowerShell スクリプト全文を組む純関数（powershell を起動せずテストできる）。
 * 画像の作り方は window-capture.mjs の buildCaptureScriptText と同じ（完全一致検索 → IsIconic →
 * GetWindowRect → PrintWindow(hwnd, hdc, 2) → 長辺 maxSide に縮小 → JPEG quality → base64）。
 *
 * @param {object} [opts]
 * @param {number} [opts.maxSide]
 * @param {number} [opts.jpegQuality]
 * @returns {string}
 */
export function buildResidentCaptureScriptText(opts = {}) {
  const maxSide = opts.maxSide ?? DEFAULT_MAX_SIDE;
  const jpegQuality = opts.jpegQuality ?? DEFAULT_JPEG_QUALITY;

  return [
    "$ErrorActionPreference = 'Stop'",
    // 入出力とも BOM 無し UTF-8（stdin を UTF-8 にしないと日本語タイトルが壊れる＝調査で踏んだ地雷）。
    // 出力の設定は $out を取るより前に済ませる（Console.Out は設定時に作り直される）。
    "[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)",
    "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)",
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
    "$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1",
    `$maxSide = ${maxSide}`,
    `$jpegQuality = [int64]${jpegQuality}`,
    "function Invoke-EyesCapture([string]$title) {",
    "  $proc = Get-Process | Where-Object { $_.MainWindowTitle -eq $title } | Select-Object -First 1",
    "  if (-not $proc) { return @('CAPTURE_FAIL', 'notFound', \"window not found: $title\") }",
    "  $hwnd = $proc.MainWindowHandle",
    "  if ([EyesNative]::IsIconic($hwnd)) { return @('CAPTURE_FAIL', 'minimized', 'window is minimized') }",
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
    "    return @('CAPTURE_FAIL', 'failed', 'PrintWindow returned false')",
    "  }",
    "  $scale = [Math]::Min(1.0, $maxSide / [Math]::Max($width, $height))",
    "  $outW = [Math]::Max(1, [int][Math]::Round($width * $scale))",
    "  $outH = [Math]::Max(1, [int][Math]::Round($height * $scale))",
    "  $resized = New-Object System.Drawing.Bitmap $bitmap, $outW, $outH",
    "  $bitmap.Dispose()",
    "  $ms = New-Object System.IO.MemoryStream",
    "  $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)",
    "  $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $jpegQuality)",
    "  $resized.Save($ms, $encoder, $encParams)",
    "  $resized.Dispose()",
    "  $b64 = [Convert]::ToBase64String($ms.ToArray())",
    "  $ms.Dispose()",
    "  return @('CAPTURE_OK', [string]$outW, [string]$outH, $b64)",
    "}",
    "$out = [Console]::Out",
    "$reader = [Console]::In",
    `$out.Write("${READY_LINE}\`n")`,
    "$out.Flush()",
    "while ($true) {",
    "  $line = $reader.ReadLine()",
    "  if ($null -eq $line) { break }",
    "  $parts = $line.Split(' ')",
    "  if ($parts.Length -lt 2 -or $parts[0] -ne 'CAPTURE') { continue }",
    "  $id = $parts[1]",
    "  try {",
    "    if ($parts.Length -ne 3) { throw 'malformed capture request' }",
    "    $title = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($parts[2]))",
    "    $lines = Invoke-EyesCapture $title",
    "  } catch {",
    "    $lines = @('CAPTURE_FAIL', 'failed', [string]$_.Exception.Message)",
    "  }",
    "  foreach ($l in $lines) { $out.Write([string]$l); $out.Write(\"`n\") }",
    `  $out.Write("${END_PREFIX}$id\`n")`,
    "  $out.Flush()",
    "}"
  ].join("\n");
}

/**
 * 要求 1 行を組む純関数（テスト用に公開）。
 * @param {string} id
 * @param {string} title
 * @returns {string}
 */
export function buildResidentCaptureRequestLine(id, title) {
  return `CAPTURE ${id} ${Buffer.from(title, "utf8").toString("base64")}\n`;
}

/**
 * @typedef {{ jpegBase64: string; width: number; height: number; elapsedMs: number } |
 *   { error: { kind: "notFound"|"minimized"|"failed"|"timeout"; message: string } }} CaptureResult
 */

/**
 * @typedef {(
 *   { type: "starting" } |
 *   { type: "ready"; startupMs: number } |
 *   { type: "exited"; code: number|null; willRestart: boolean; reason: string } |
 *   { type: "gaveUp"; failures: number } |
 *   { type: "stopped" } |
 *   { type: "capture"; via: "resident"|"spawn"; elapsedMs: number; ok: boolean; kind: string|null; fallbackReason?: string }
 * )} ResidentCaptureEvent
 */

/**
 * 撮る係を作る（まだ起動しない。start() で起動する）。
 *
 * @param {object} [options]
 * @param {string} [options.powershellPath]
 * @param {number} [options.maxSide]
 * @param {number} [options.jpegQuality]
 * @param {number} [options.captureTimeoutMs=RESIDENT_CAPTURE_TIMEOUT_MS]
 * @param {number} [options.startupTimeoutMs=RESIDENT_STARTUP_TIMEOUT_MS]
 * @param {number} [options.restartDelayMs=RESIDENT_RESTART_DELAY_MS]
 * @param {number} [options.maxStartFailures=RESIDENT_MAX_START_FAILURES]
 * @param {(title: string) => Promise<CaptureResult>} [options.fallbackCaptureImpl]
 *   撮る係が使えないときの撮り方（既定 window-capture.mjs の captureWindow = 毎回起動）。
 * @param {*} [options.spawnImpl]  テスト用 spawn 差し替え。
 * @param {() => number} [options.nowImpl]
 * @param {*} [options.setTimeoutImpl]
 * @param {*} [options.clearTimeoutImpl]
 * @param {(event: ResidentCaptureEvent) => void} [options.onEvent]
 *   起動・終了・撮影ごとの記録（数字と種類だけ。タイトルや画像は渡さない）。cockpit.mjs が標準出力に 1 行書く。
 * @returns {{
 *   start: () => void;
 *   stop: () => void;
 *   capture: (title: string) => Promise<CaptureResult>;
 *   status: () => "stopped" | "starting" | "ready" | "gaveUp";
 * }}
 */
export function createResidentCapture(options = {}) {
  const spawnImpl = options.spawnImpl ?? spawn;
  const powershellPath = options.powershellPath ?? DEFAULT_POWERSHELL_PATH;
  const captureTimeoutMs = options.captureTimeoutMs ?? RESIDENT_CAPTURE_TIMEOUT_MS;
  const startupTimeoutMs = options.startupTimeoutMs ?? RESIDENT_STARTUP_TIMEOUT_MS;
  const restartDelayMs = options.restartDelayMs ?? RESIDENT_RESTART_DELAY_MS;
  const maxStartFailures = options.maxStartFailures ?? RESIDENT_MAX_START_FAILURES;
  const fallbackCaptureImpl = options.fallbackCaptureImpl ?? defaultFallbackCapture;
  const nowImpl = options.nowImpl ?? Date.now;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const onEvent = typeof options.onEvent === "function" ? options.onEvent : null;
  const scriptText = buildResidentCaptureScriptText({
    maxSide: options.maxSide,
    jpegQuality: options.jpegQuality
  });

  /** 耳が動いている間 true（start〜stop）。false の間は立ち上げ直さない。 */
  let wanted = false;
  /** @type {"stopped" | "starting" | "ready" | "gaveUp"} */
  let state = "stopped";
  /** 起動完了の前に続けて落ちた回数（起動完了で 0 に戻す）。 */
  let startFailures = 0;
  let requestSeq = 0;
  /** 子プロセスの世代（古い子のイベントを無視するため）。 */
  let generation = 0;

  /**
   * @type {null | {
   *   gen: number; child: any; startedAt: number; decoder: StringDecoder; buffer: string;
   *   startupTimer: any; ended: boolean
   * }}
   */
  let worker = null;
  /** @type {any} */
  let restartTimer = null;

  /**
   * 返事待ちの撮影（同時に 1 件だけ）。
   * @type {null | { id: string; gen: number; startedAt: number; lines: string[]; timer: any;
   *   resolve: (r: CaptureResult) => void }}
   */
  let inflight = null;

  /** @param {ResidentCaptureEvent} event */
  function emit(event) {
    if (!onEvent) return;
    try {
      onEvent(event);
    } catch {
      // 記録の失敗で撮影を止めない。
    }
  }

  /** @param {any} timer */
  function unrefTimer(timer) {
    if (timer && typeof timer.unref === "function") timer.unref();
    return timer;
  }

  /** @param {any} timer */
  function clearTimer(timer) {
    if (timer != null) clearTimeoutImpl(timer);
  }

  /** 子プロセスを畳む（kill → stdio destroy → unref・一度だけ）。 */
  function disposeWorker() {
    const w = worker;
    worker = null;
    if (!w || w.ended) return;
    w.ended = true;
    clearTimer(w.startupTimer);
    w.startupTimer = null;
    const c = w.child;
    try {
      c.kill();
    } catch {
      // best-effort
    }
    try {
      c.stdout?.destroy();
      c.stderr?.destroy();
      c.stdin?.destroy();
    } catch {
      // best-effort
    }
    try {
      c.unref?.();
    } catch {
      // best-effort
    }
  }

  /**
   * 返事待ちの撮影をこの結果で片付ける。
   * @param {CaptureResult} result
   */
  function settleInflight(result) {
    const job = inflight;
    if (!job) return;
    inflight = null;
    clearTimer(job.timer);
    job.resolve(result);
  }

  function spawnWorker() {
    if (!wanted) return;
    generation += 1;
    const gen = generation;
    state = "starting";
    emit({ type: "starting" });
    /** @type {any} */
    let child;
    try {
      child = spawnImpl(powershellPath, buildPowerShellInvocationArgs(scriptText), {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });
    } catch (error) {
      handleWorkerLoss(false, null, `spawn threw: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const w = {
      gen,
      child,
      startedAt: nowImpl(),
      decoder: new StringDecoder("utf8"),
      buffer: "",
      startupTimer: /** @type {any} */ (null),
      ended: false
    };
    worker = w;
    // stdin の書き込み失敗（相手が落ちた後の EPIPE 等）で Node を落とさない。落ちたことは exit で知る。
    child.stdin?.on?.("error", () => {});
    child.stdout?.on("data", (/** @type {Buffer|string} */ chunk) => onStdout(w, chunk));
    // stderr は読み捨てる（パイプが詰まって子が止まらないように）。
    child.stderr?.on("data", () => {});
    child.on("error", (/** @type {unknown} */ err) => {
      onWorkerEnded(w, null, `spawn error: ${err instanceof Error ? err.message : String(err)}`);
    });
    child.on("exit", (/** @type {number|null} */ code) => {
      onWorkerEnded(w, code, "exited");
    });
    w.startupTimer = unrefTimer(
      setTimeoutImpl(() => {
        if (worker !== w || state !== "starting") return;
        onWorkerEnded(w, null, `not ready within ${startupTimeoutMs}ms`);
      }, startupTimeoutMs)
    );
  }

  /**
   * @param {{ gen: number; decoder: StringDecoder; buffer: string; startedAt: number; startupTimer: any }} w
   * @param {Buffer|string} chunk
   */
  function onStdout(w, chunk) {
    if (worker !== w) return;
    w.buffer += typeof chunk === "string" ? chunk : w.decoder.write(chunk);
    let newlineIndex;
    while ((newlineIndex = w.buffer.indexOf("\n")) >= 0) {
      const line = w.buffer.slice(0, newlineIndex).replace(/\r$/, "");
      w.buffer = w.buffer.slice(newlineIndex + 1);
      onLine(w, line);
      if (worker !== w) return;
    }
  }

  /**
   * @param {{ gen: number; startedAt: number; startupTimer: any }} w
   * @param {string} line
   */
  function onLine(w, line) {
    if (state === "starting") {
      if (line === READY_LINE) {
        clearTimer(w.startupTimer);
        w.startupTimer = null;
        state = "ready";
        startFailures = 0;
        emit({ type: "ready", startupMs: nowImpl() - w.startedAt });
      }
      return; // 起動完了の前の行は読み捨てる。
    }
    const job = inflight;
    if (!job || job.gen !== w.gen) return; // 頼んでいない行は読み捨てる。
    if (line.startsWith(END_PREFIX)) {
      if (line.slice(END_PREFIX.length) !== job.id) return; // 別の要求の終端（起こらない想定）は無視。
      const parsed = parseCaptureStdout(job.lines.join("\n"));
      const elapsedMs = nowImpl() - job.startedAt;
      settleInflight("error" in parsed ? parsed : { ...parsed, elapsedMs });
      return;
    }
    job.lines.push(line);
  }

  /**
   * 子が落ちた・起動完了が来なかったとき。既に畳んだ子（stop・上限超えで kill した子）の知らせは無視する。
   * @param {{ gen: number; ended: boolean }} w
   * @param {number|null} code
   * @param {string} reason
   */
  function onWorkerEnded(w, code, reason) {
    if (w.ended || worker !== w) return;
    const wasReady = state === "ready";
    disposeWorker();
    if (inflight && inflight.gen === w.gen) {
      settleInflight({ error: { kind: "failed", message: `capture helper ${reason}` } });
    }
    handleWorkerLoss(wasReady, code, reason);
  }

  /**
   * 撮る係を失った後: 立ち上げ直すか、続けて起動に失敗したなら諦める。
   * @param {boolean} wasReady
   * @param {number|null} code
   * @param {string} reason
   */
  function handleWorkerLoss(wasReady, code, reason) {
    if (!wanted) {
      state = "stopped";
      return;
    }
    if (!wasReady) startFailures += 1;
    if (startFailures >= maxStartFailures) {
      state = "gaveUp";
      emit({ type: "exited", code, willRestart: false, reason });
      emit({ type: "gaveUp", failures: startFailures });
      return;
    }
    state = "starting"; // 立ち上げ直しを待つ間も「使えない」（撮影は毎回起動に戻る）。
    emit({ type: "exited", code, willRestart: true, reason });
    clearTimer(restartTimer);
    restartTimer = unrefTimer(
      setTimeoutImpl(() => {
        restartTimer = null;
        spawnWorker();
      }, restartDelayMs)
    );
  }

  /** 撮影の上限超え: その回は timeout で返し、待たずに立ち上げ直す（合意 §4 の 3）。 */
  function restartAfterTimeout() {
    disposeWorker();
    clearTimer(restartTimer);
    restartTimer = null;
    if (!wanted) {
      state = "stopped";
      return;
    }
    emit({ type: "exited", code: null, willRestart: true, reason: `capture exceeded ${captureTimeoutMs}ms` });
    spawnWorker();
  }

  /**
   * 撮る係が使えないときの撮り方（毎回起動）。
   * @param {string} title
   * @param {string} fallbackReason
   * @returns {Promise<CaptureResult>}
   */
  async function captureByFallback(title, fallbackReason) {
    const startedAt = nowImpl();
    /** @type {CaptureResult} */
    let result;
    try {
      result = await fallbackCaptureImpl(title);
    } catch (error) {
      result = { error: { kind: "failed", message: error instanceof Error ? error.message : String(error) } };
    }
    emit({
      type: "capture",
      via: "spawn",
      elapsedMs: nowImpl() - startedAt,
      ok: !("error" in result),
      kind: "error" in result ? result.error.kind : null,
      fallbackReason
    });
    return result;
  }

  return {
    /** 起動する（冪等）。耳の Start に合わせて呼ぶ。諦めた後でも、次の start() でまた試す。 */
    start() {
      if (wanted && state !== "gaveUp") return;
      wanted = true;
      startFailures = 0;
      clearTimer(restartTimer);
      restartTimer = null;
      if (!worker) spawnWorker();
    },

    /** 止める（冪等）。耳の Stop・操縦席の終了で呼ぶ。返事待ちの撮影は failed で返す。 */
    stop() {
      const wasActive = wanted || worker !== null;
      wanted = false;
      clearTimer(restartTimer);
      restartTimer = null;
      const gen = generation;
      generation += 1; // 以後、今の子の知らせは無視する。
      disposeWorker();
      if (inflight && inflight.gen === gen) {
        settleInflight({ error: { kind: "failed", message: "capture helper stopped" } });
      }
      state = "stopped";
      if (wasActive) emit({ type: "stopped" });
    },

    status: () => state,

    /**
     * 窓を 1 枚撮る。撮る係が使えるならそれに頼み、使えないなら毎回起動に戻す（冒頭の注記）。
     * @param {string} title 完全一致タイトル。
     * @returns {Promise<CaptureResult>}
     */
    async capture(title) {
      if (typeof title !== "string" || title.length === 0) {
        throw new TypeError("captureWindow: title must be a non-empty string");
      }
      const w = worker;
      if (state !== "ready" || !w || inflight) {
        const fallbackReason = inflight ? "busy" : state;
        return captureByFallback(title, fallbackReason);
      }
      requestSeq += 1;
      const id = String(requestSeq);
      const startedAt = nowImpl();
      /** @type {CaptureResult} */
      const result = await new Promise((resolve) => {
        const job = {
          id,
          gen: w.gen,
          startedAt,
          lines: /** @type {string[]} */ ([]),
          timer: /** @type {any} */ (null),
          resolve
        };
        inflight = job;
        job.timer = unrefTimer(
          setTimeoutImpl(() => {
            if (inflight !== job) return;
            settleInflight({ error: { kind: "timeout", message: `capture timed out after ${captureTimeoutMs}ms` } });
            restartAfterTimeout();
          }, captureTimeoutMs)
        );
        try {
          w.child.stdin.write(buildResidentCaptureRequestLine(id, title));
        } catch (error) {
          // 書けない = 子が既に落ちている。その回は failed で返す（立ち上げ直しは exit の知らせが担う）。
          settleInflight({
            error: { kind: "failed", message: `capture helper write failed: ${error instanceof Error ? error.message : String(error)}` }
          });
        }
      });
      emit({
        type: "capture",
        via: "resident",
        elapsedMs: nowImpl() - startedAt,
        ok: !("error" in result),
        kind: "error" in result ? result.error.kind : null
      });
      return result;
    }
  };
}
