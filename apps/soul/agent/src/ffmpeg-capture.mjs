// @ts-check
/**
 * ffmpeg 常駐マイク取り込みラッパ（S2 Domain A）— apps/soul/agent。
 *
 * ffmpeg を子プロセスで 1 本常駐させ、マイク（Windows は dshow）を **16kHz mono s16le PCM** に
 * 落として stdout へ流し続ける。魂はその byte ストリームを PCM フレーマ → Silero VAD → セグメンタ
 * へ渡す（Domain C で結線）。実マイク・実 ffmpeg には触れない機械テストのため、spawn を差し替え
 * 可能にし、合成 PCM を吐くダミー子プロセスを注入して往復を検証する（audio-player.mjs と同型）。
 *
 * ── 設定可能点（S2 計画 §3）───────────────────────────────────────────
 *  - ffmpegPath: 既定は PATH 解決の "ffmpeg"。環境変数 FFMPEG_PATH → options.ffmpegPath の順で上書き。
 *  - device / inputFormat: dshow デバイス名・入力フォーマットを設定で差し替え（未指定なら既定入力）。
 *  - args: 全引数を丸ごと上書き（テスト注入・特殊経路用）。
 *
 * ── 再起動耐性（クラッシュループ・バックオフ）───────────────────────────────
 *  ffmpeg が異常終了しても魂の耳が黙らないよう、dispose していなければ restartDelayMs 後に
 *  再 spawn する。ただし maxRestarts で無限ループを止める。プロセスが restartResetMs 以上生きて
 *  から死んだ場合は「一度は正常稼働した」とみなし restart 予算をリセットする（起動直後に死に続ける
 *  デバイス不正だけを打ち切る）。タイマ・時計は注入可能（テストで実時間を待たない）。
 *
 * ── クリーンシャットダウン（S1 ハング教訓・s1-followup §8）──────────────────
 *  dispose() は再起動を止め、kill 後に stdio パイプ（stdin/stdout/stderr）を destroy し child.unref()。
 *  「kill したが OS が未 reap の子プロセス／未 destroy のパイプが event loop を生かし続ける」窓を塞ぐ。
 */

import { spawn } from "node:child_process";

const DEFAULT_FFMPEG = "ffmpeg";
const DEFAULT_INPUT_FORMAT = process.platform === "win32" ? "dshow" : "";
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_CHANNELS = 1;

/**
 * ffmpeg 引数を組む純関数（spawn せずにテストできる）。
 * マイク（inputFormat/device）→ 16kHz mono s16le を pipe:1（stdout）へ。
 *
 * @param {object} opts
 * @param {string} [opts.inputFormat]  例 "dshow"（win32）/"avfoundation"/"pulse"。空なら -f を付けない。
 * @param {string} [opts.device]       入力デバイス指定（dshow なら 'audio="マイク名"' 相当の値）。
 * @param {number} [opts.sampleRate=16000]
 * @param {number} [opts.channels=1]
 * @returns {string[]}
 */
export function buildFfmpegArgs(opts = {}) {
  const inputFormat = opts.inputFormat ?? DEFAULT_INPUT_FORMAT;
  const device = opts.device;
  const sampleRate = opts.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const channels = opts.channels ?? DEFAULT_CHANNELS;

  const args = ["-hide_banner", "-loglevel", "error", "-nostdin"];
  if (inputFormat) {
    args.push("-f", inputFormat);
  }
  if (device) {
    args.push("-i", device);
  }
  // 出力: リサンプル + ダウンミックス + s16le を stdout へ。
  args.push(
    "-ac",
    String(channels),
    "-ar",
    String(sampleRate),
    "-acodec",
    "pcm_s16le",
    "-f",
    "s16le",
    "pipe:1"
  );
  return args;
}

/**
 * ffmpegPath を解決する（options → 環境変数 FFMPEG_PATH → 既定 "ffmpeg"）。
 * @param {string} [optionPath]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveFfmpegPath(optionPath, env = process.env) {
  return optionPath ?? env.FFMPEG_PATH ?? DEFAULT_FFMPEG;
}

/**
 * 常駐 ffmpeg キャプチャを起動する。
 *
 * @param {object} [options]
 * @param {string} [options.ffmpegPath]  実行コマンド（既定 PATH の "ffmpeg"・env FFMPEG_PATH で上書き）。
 * @param {string} [options.inputFormat]
 * @param {string} [options.device]
 * @param {number} [options.sampleRate=16000]
 * @param {number} [options.channels=1]
 * @param {string[]} [options.args]  引数の丸ごと上書き（テスト注入・特殊経路）。既定は buildFfmpegArgs。
 * @param {(chunk: Uint8Array) => void} [options.onPcm]   stdout の PCM バイトチャンクごと。
 * @param {(line: string) => void} [options.onError]      stderr の 1 行ごと。
 * @param {(info: { code: number|null; signal: string|null; willRestart: boolean; restartCount: number }) => void} [options.onExit]
 * @param {number} [options.maxRestarts=5]      再起動の上限（起動直後クラッシュのループ打ち切り）。
 * @param {number} [options.restartDelayMs=500] 異常終了から再 spawn までの待ち。
 * @param {number} [options.restartResetMs=5000] この時間以上生きてから死んだら restart 予算をリセット。
 * @param {typeof spawn} [options.spawnImpl]    spawn の差し替え（テスト用）。
 * @param {typeof setTimeout} [options.setTimeoutImpl]  再起動タイマの差し替え（テスト用）。
 * @param {() => number} [options.nowImpl]      時計の差し替え（テスト用）。既定 Date.now。
 * @returns {{
 *   restartCount: () => number;
 *   isDisposed: () => boolean;
 *   currentChild: () => import("node:child_process").ChildProcess | null;
 *   dispose: () => void;
 * }}
 */
export function createFfmpegCapture(options = {}) {
  const ffmpegPath = resolveFfmpegPath(options.ffmpegPath);
  const args =
    options.args ??
    buildFfmpegArgs({
      inputFormat: options.inputFormat,
      device: options.device,
      sampleRate: options.sampleRate,
      channels: options.channels
    });
  const onPcm = options.onPcm;
  const onError = options.onError;
  const onExit = options.onExit;
  const maxRestarts = options.maxRestarts ?? 5;
  const restartDelayMs = options.restartDelayMs ?? 500;
  const restartResetMs = options.restartResetMs ?? 5000;
  const spawnImpl = options.spawnImpl ?? spawn;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const nowImpl = options.nowImpl ?? Date.now;

  let disposed = false;
  let restartCount = 0;
  /** @type {import("node:child_process").ChildProcess | null} */
  let child = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let restartTimer = null;

  function spawnChild() {
    if (disposed) return;
    const spawnedAt = nowImpl();
    const c = spawnImpl(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    child = c;

    if (c.stdout) {
      c.stdout.on("data", (chunk) => {
        if (onPcm) onPcm(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      });
    }
    if (c.stderr && onError) {
      lineReader(c.stderr, onError);
    }

    c.on("exit", (code, signal) => {
      if (disposed) return;
      // 十分長く生きてから死んだなら「一度は正常稼働」→ 予算リセット。
      if (nowImpl() - spawnedAt >= restartResetMs) {
        restartCount = 0;
      }
      const willRestart = restartCount < maxRestarts;
      if (onExit) onExit({ code, signal, willRestart, restartCount });
      if (willRestart) {
        restartCount += 1;
        restartTimer = setTimeoutImpl(() => {
          restartTimer = null;
          spawnChild();
        }, restartDelayMs);
        // 再起動タイマだけのために event loop を保持しない。
        if (restartTimer && typeof (/** @type {any} */ (restartTimer).unref) === "function") {
          /** @type {any} */ (restartTimer).unref();
        }
      }
    });

    c.on("error", (err) => {
      if (onError) onError(`ffmpeg spawn error: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  spawnChild();

  return {
    restartCount: () => restartCount,
    isDisposed: () => disposed,
    currentChild: () => child,
    /**
     * 常駐を畳む（再起動停止 + kill + stdio destroy + unref）。冪等。
     */
    dispose() {
      if (disposed) return;
      disposed = true;
      if (restartTimer !== null) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      const c = child;
      if (!c) return;
      try {
        c.kill();
      } catch {
        // best-effort
      }
      // stdio パイプを destroy して fd ハンドルを即解放（reap 待ちで loop を生かさない）。
      try {
        c.stdout?.destroy();
        c.stderr?.destroy();
        c.stdin?.destroy();
      } catch {
        // best-effort
      }
      c.unref();
    }
  };
}

/**
 * ストリームを行単位に割ってコールバックへ流す（依存ゼロの簡易 line reader・audio-player と同型）。
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
