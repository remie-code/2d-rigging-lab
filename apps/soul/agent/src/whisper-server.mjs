// @ts-check
/**
 * whisper-server 常駐ラッパ（S2 Domain B）— apps/soul/agent。
 *
 * whisper.cpp v1.9.1 の `whisper-server.exe`（BLAS 版・vendor 配置・非コミット）を子プロセスで
 * 1 本常駐させ、kotoba-whisper q5_0 モデルで HTTP `/inference` を受けられる状態にする。
 * 「いつ準備完了か」はモデルロード（512.9MB・数秒〜数十秒）を挟むため自明ではない——
 * whisper-server はモデルロード完了後に listen するので、**HTTP が応答し始めた時点 = ready**
 * とみなすポーリングヘルスチェックを `ready` Promise で返す。
 *
 * ── 実機事実（vendor whisper-server.exe --help・2026-07-12 実取得）───────────
 *  - 既定 host 127.0.0.1 / port 8080 / inference path "/inference"（`--inference-path` で変更可）。
 *  - `-m FNAME` モデルパス / `-l LANG` 言語（既定 en → kotoba は日本語専用のため魂の既定は ja）。
 *  - `-t N` スレッド数（既定 4）。
 *
 * ── ポート既定 8178 の理由 ───────────────────────────────────────────
 *  whisper-server 素の既定 8080 は開発ツール一般と衝突しやすい定番ポート。魂の既定は
 *  他サービス（AivisSpeech 10101・エディタ dev server 5173 系）と離れた 8178 を取り、
 *  options で上書き可能にする。
 *
 * ── flash-attn は既定 OFF（`-nfa`）── 長発話の決定論的崩壊を実機診断（S2.5 追撃・
 *    2026-07-12・discussion/ai-cohost/implementation/waves/s2.5/long-utterance-diagnosis.md）───
 *  vendor whisper-server(v1.9.1) は flash-attn が既定 ON。動的 audio_ctx（whisper-inference.mjs
 *  の computeAudioCtx・下限クランプ 256）との組み合わせで、audio_ctx が 256 を超える域
 *  （≒ 発話 3.2 秒超）に達すると転写が**決定論的に崩壊**する（丸ごと空 or 「,」等のゴミ行 or
 *  末尾反復）。既存チューニング（experiments/s2-ears.md §2.1）は生 TTS WAV を `/inference` へ
 *  直投した格子で、本番の VAD トリム切り出し音声 + flash-attn=ON の崩壊域を踏んでいなかった。
 *  `-nfa`（flash-attn OFF）で全ケース正常化・レイテンシ 2.0〜2.4s（目標圏内）を実機確認済み。
 *  ゆえに `buildWhisperServerArgs`/`createWhisperServer` は既定で `-nfa` を出力に含める。
 *  `flashAttn: true` を渡すと抑止できる（テスト・切り分け用の脱出口。本番既定では使わない）。
 *
 * ── クリーンシャットダウン（S1 ハング教訓・s1-followup §8 / audio-player の型）────
 *  dispose() = kill → stdio パイプ destroy → child.unref()。冪等。
 *  「kill したが OS 未 reap の子／未 destroy のパイプが event loop を生かす」窓を塞ぐ。
 *  Windows の child.kill() は TerminateProcess で確実に落ちる（S1/S2 で実証済みの型）。
 *  さらに stdout/stderr は必ず消費する（whisper-server はログが多く、パイプ詰まりで
 *  サーバ側が書き込みブロックするのを防ぐ）。
 *
 * ── テスト設計 ─────────────────────────────────────────────────────
 *  spawnImpl（ダミー子プロセス注入）+ fetchImpl（ヘルスチェック応答の合成）+
 *  setTimeoutImpl/nowImpl（実時間を待たないポーリング）を全て差し替え可能にしてある。
 *  実 whisper-server + 実モデルの疎通は preflight-asr.mjs（配線 ≠ 疎通）の領分。
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** agent パッケージルート（src/ の親）。vendor 既定パスの基準。 */
const AGENT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** whisper-server 実行ファイルの既定（vendor 配置・非コミット）。 */
export const DEFAULT_WHISPER_SERVER_PATH = path.join(
  AGENT_ROOT,
  "vendor",
  "whisper",
  "whisper-server.exe"
);

/** kotoba-whisper q5_0 モデルの既定（vendor 配置・非コミット）。 */
export const DEFAULT_WHISPER_MODEL_PATH = path.join(
  AGENT_ROOT,
  "vendor",
  "models",
  "ggml-kotoba-whisper-v2.0-q5_0.bin"
);

/** 魂の whisper-server 既定ポート（衝突しやすい素の既定 8080 を避ける）。 */
export const DEFAULT_WHISPER_PORT = 8178;
/** 既定 host（localhost 束縛・外に開かない）。 */
export const DEFAULT_WHISPER_HOST = "127.0.0.1";
/** 既定言語（kotoba-whisper は日本語専用 distil モデル）。 */
export const DEFAULT_WHISPER_LANGUAGE = "ja";

/**
 * whisper-server のパスを解決する（options → env WHISPER_SERVER_PATH → vendor 既定）。
 * @param {string} [optionPath]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveWhisperServerPath(optionPath, env = process.env) {
  return optionPath ?? env.WHISPER_SERVER_PATH ?? DEFAULT_WHISPER_SERVER_PATH;
}

/**
 * モデルパスを解決する（options → env WHISPER_MODEL_PATH → vendor 既定）。
 * @param {string} [optionPath]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveWhisperModelPath(optionPath, env = process.env) {
  return optionPath ?? env.WHISPER_MODEL_PATH ?? DEFAULT_WHISPER_MODEL_PATH;
}

/**
 * whisper-server の引数を組む純関数（spawn せずにテストできる）。
 * @param {object} opts
 * @param {string} opts.modelPath
 * @param {string} [opts.host=DEFAULT_WHISPER_HOST]
 * @param {number} [opts.port=DEFAULT_WHISPER_PORT]
 * @param {string} [opts.language=DEFAULT_WHISPER_LANGUAGE]  空文字なら -l を付けない。
 * @param {number} [opts.threads]  省略時は server 既定（4）に任せる。
 * @param {boolean} [opts.flashAttn=false]  既定 false = `-nfa`（flash-attn OFF）を付ける。
 *   true を渡すと `-nfa` を付けない（= vendor 既定の flash-attn ON に戻す抑止オプション。
 *   長発話決定論的崩壊の実機診断済み・上記ヘッダ参照。本番既定では使わない）。
 * @param {string[]} [opts.extraArgs]  末尾に足す追加引数。
 * @returns {string[]}
 */
export function buildWhisperServerArgs(opts) {
  if (!opts || typeof opts.modelPath !== "string" || opts.modelPath.length === 0) {
    throw new TypeError("buildWhisperServerArgs: modelPath must be a non-empty string.");
  }
  const host = opts.host ?? DEFAULT_WHISPER_HOST;
  const port = opts.port ?? DEFAULT_WHISPER_PORT;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new RangeError(`buildWhisperServerArgs: port must be 1..65535; got ${port}.`);
  }
  const language = opts.language ?? DEFAULT_WHISPER_LANGUAGE;
  const args = ["-m", opts.modelPath, "--host", host, "--port", String(port)];
  if (language) {
    args.push("-l", language);
  }
  if (opts.threads != null) {
    if (!Number.isInteger(opts.threads) || opts.threads <= 0) {
      throw new RangeError(`buildWhisperServerArgs: threads must be a positive integer; got ${opts.threads}.`);
    }
    args.push("-t", String(opts.threads));
  }
  const flashAttn = opts.flashAttn ?? false;
  if (!flashAttn) {
    // 既定: flash-attn OFF。長発話（audio_ctx>256 ≒ 発話 3.2s 超）の決定論的崩壊を避ける
    // （ヘッダ参照）。opts.flashAttn=true で抑止できる（vendor 既定の ON に戻す）。
    args.push("-nfa");
  }
  if (opts.extraArgs) {
    args.push(...opts.extraArgs);
  }
  return args;
}

/**
 * whisper-server を子プロセスで起動し、HTTP 応答開始（= モデルロード完了後の listen）まで
 * ポーリングして ready を返す常駐ラッパ。
 *
 * @param {object} [options]
 * @param {string} [options.serverPath]  実行ファイル（既定 vendor/whisper/whisper-server.exe・env WHISPER_SERVER_PATH で上書き）。
 * @param {string} [options.modelPath]   モデル（既定 vendor/models/ggml-kotoba-whisper-v2.0-q5_0.bin・env WHISPER_MODEL_PATH で上書き）。
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @param {string} [options.language]
 * @param {number} [options.threads]
 * @param {boolean} [options.flashAttn=false]  既定 false = `-nfa` を付ける（buildWhisperServerArgs 参照）。
 * @param {string[]} [options.extraArgs]
 * @param {string[]} [options.args]  引数の丸ごと上書き（テスト注入・特殊経路）。
 * @param {number} [options.readyTimeoutMs=120000]  ヘルスチェックの全体タイムアウト（モデルロード込み）。
 * @param {number} [options.pollIntervalMs=250]     ポーリング間隔。
 * @param {(line: string) => void} [options.onStdout]  子プロセス stdout の 1 行ごと（省略時も必ず消費する）。
 * @param {(line: string) => void} [options.onStderr]  子プロセス stderr の 1 行ごと（同上）。
 * @param {(info: { code: number|null; signal: string|null }) => void} [options.onExit]
 * @param {typeof spawn} [options.spawnImpl]        spawn の差し替え（テスト用）。
 * @param {typeof fetch} [options.fetchImpl]        ヘルスチェック fetch の差し替え（テスト用）。
 * @param {typeof setTimeout} [options.setTimeoutImpl]  ポーリング待ちタイマの差し替え（テスト用）。
 * @param {() => number} [options.nowImpl]          時計の差し替え（テスト用）。既定 Date.now。
 * @returns {{
 *   ready: Promise<void>;
 *   baseUrl: string;
 *   isDisposed: () => boolean;
 *   hasExited: () => boolean;
 *   currentChild: () => import("node:child_process").ChildProcess;
 *   dispose: () => void;
 * }}
 */
export function createWhisperServer(options = {}) {
  const serverPath = resolveWhisperServerPath(options.serverPath);
  const modelPath = resolveWhisperModelPath(options.modelPath);
  const host = options.host ?? DEFAULT_WHISPER_HOST;
  const port = options.port ?? DEFAULT_WHISPER_PORT;
  const args =
    options.args ??
    buildWhisperServerArgs({
      modelPath,
      host,
      port,
      language: options.language,
      threads: options.threads,
      flashAttn: options.flashAttn,
      extraArgs: options.extraArgs
    });
  const readyTimeoutMs = options.readyTimeoutMs ?? 120000;
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  const spawnImpl = options.spawnImpl ?? spawn;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const nowImpl = options.nowImpl ?? Date.now;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("createWhisperServer: no fetch implementation available (pass options.fetchImpl).");
  }

  const baseUrl = `http://${host}:${port}`;

  let disposed = false;
  let exited = false;
  /** @type {number|null} */
  let exitCode = null;
  /** @type {string|null} */
  let exitSignal = null;

  const child = spawnImpl(serverPath, args, { stdio: ["ignore", "pipe", "pipe"] });

  // stdout/stderr は必ず消費する（whisper-server のログでパイプが詰まり、サーバ側の
  // 書き込みがブロックするのを防ぐ）。コールバック未指定でも捨て読みする。
  if (child.stdout) {
    if (options.onStdout) {
      lineReader(child.stdout, options.onStdout);
    } else {
      child.stdout.resume();
    }
  }
  if (child.stderr) {
    if (options.onStderr) {
      lineReader(child.stderr, options.onStderr);
    } else {
      child.stderr.resume();
    }
  }

  child.on("exit", (code, signal) => {
    exited = true;
    exitCode = code;
    exitSignal = signal;
    if (!disposed && options.onExit) {
      options.onExit({ code, signal });
    }
  });
  child.on("error", (err) => {
    // spawn 自体の失敗（実行ファイル不在等）。exit は来ないことがあるため exited を立てて
    // ready ポーリングを打ち切れるようにする。
    exited = true;
    exitCode = exitCode ?? -1;
    if (!disposed && options.onStderr) {
      options.onStderr(`whisper-server spawn error: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  /**
   * HTTP が応答し始めるまでポーリングする。任意のステータス（404 含む）でも
   * 「listen 済み = モデルロード完了」とみなす。接続拒否（fetch reject）は未 ready。
   */
  // ポーリングタイマは unref しない: ready は readyTimeoutMs で必ず有界に決着するループであり、
  // 待機中は event loop を保持するのが正しい。unref すると「タイマだけが残った瞬間に loop が
  // 干上がり ready が永遠に未決着」のレースになる（node:test の cancelledByParent で観測した型）。
  // dispose 後も最悪 pollIntervalMs 1 回分でループが終わるため残留しない。
  const ready = (async () => {
    const deadline = nowImpl() + readyTimeoutMs;
    // 起動直後に 1 tick 譲る（spawn 直後の同期 fetch を避ける）。
    await new Promise((resolve) => {
      setTimeoutImpl(resolve, 0);
    });
    for (;;) {
      if (disposed) {
        throw new Error("whisper-server disposed before ready.");
      }
      if (exited) {
        throw new Error(
          `whisper-server exited before ready (code ${exitCode}, signal ${exitSignal}).`
        );
      }
      try {
        await fetchImpl(`${baseUrl}/`, { method: "GET" });
        return; // HTTP 応答あり = listen 済み。
      } catch {
        // まだ listen していない（ECONNREFUSED 等）→ 続行。
      }
      if (nowImpl() >= deadline) {
        throw new Error(
          `whisper-server not ready within ${readyTimeoutMs}ms (${baseUrl}). ` +
            "Model load may be slow or the server failed to bind."
        );
      }
      await new Promise((resolve) => {
        setTimeoutImpl(resolve, pollIntervalMs);
      });
    }
  })();
  // ready を await しない経路（dispose 先行等）で unhandled rejection にしない。
  ready.catch(() => {});

  return {
    ready,
    baseUrl,
    isDisposed: () => disposed,
    hasExited: () => exited,
    currentChild: () => child,
    /**
     * 常駐を畳む（kill → stdio destroy → unref）。冪等。
     * どの経路で失敗しても孤児を残さないため、呼び出し側は finally で必ず呼ぶこと。
     */
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      try {
        child.kill();
      } catch {
        // best-effort
      }
      // stdio パイプを destroy して fd ハンドルを即解放（reap 待ちで loop を生かさない）。
      try {
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.stdin?.destroy();
      } catch {
        // best-effort
      }
      child.unref();
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
