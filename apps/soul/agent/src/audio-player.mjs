// @ts-check
/**
 * 常駐音声再生プロセス（S1 Domain B）— apps/soul/agent。
 *
 * Windows/Node で依存ゼロに音を鳴らす唯一の現実解が PowerShell `System.Media.SoundPlayer`。
 * ただし PowerShell の spawn は ≈155ms（s1-planning-inventory §5 実測）。一文ごとに spawn すると
 * 再生のたびにこのコストを払う。そこで **子プロセスを 1 本だけ常駐**させ、stdin に WAV パスを
 * 1 行送るたびに `PlaySync()` で鳴らす。spawn コストはループ外（起動 1 回）に押し出される。
 *
 * ── 同期設計との関係（wave 計画 §3 Domain B）─────────────────────────────
 *  `play(wavPath)` は「再生指示の送出」であって完了待ちではない（stdin.write は即戻る）。
 *  speak.mjs は channel の accepted を受けた直後に play を呼ぶ＝「器の口が動き始めた瞬間に
 *  声が鳴り始める」。WAV 先頭 0.1s の無音が器の口の立ち上がり（attack）と概ね相殺する。
 *
 * ── 機械テストは無音（絶対規律）─────────────────────────────────────────
 *  command/args を差し替え可能にしてある。テストは PowerShell の代わりに無音のエコー
 *  プロセス（node）を注入し、stdin 指示 → 子プロセスの応答という往復プロトコルだけを検証する。
 *  実際にスピーカーから音を出すのは人間ゲートの領分（preflight-e2e.mjs）。
 */

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * 常駐 PowerShell スクリプト（既定 command 用）。stdin から 1 行ずつ WAV パスを読み、
 * SoundPlayer.PlaySync() で同期再生する。空行は無視。再生失敗は stderr に流し、常駐を続ける。
 * PlaySync はブロッキング＝一文ずつ順に鳴る（S1 は一文単位なので十分）。
 */
const RESIDENT_POWERSHELL_SCRIPT = [
  "$ErrorActionPreference='Stop';",
  "$player = New-Object System.Media.SoundPlayer;",
  "while (($line = [Console]::In.ReadLine()) -ne $null) {",
  "  $p = $line.Trim();",
  "  if ($p.Length -eq 0) { continue }",
  "  try { $player.SoundLocation = $p; $player.PlaySync() }",
  "  catch { [Console]::Error.WriteLine('play-error: ' + $_.Exception.Message) }",
  "}"
].join(" ");

const DEFAULT_COMMAND = "powershell.exe";
const DEFAULT_ARGS = [
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  RESIDENT_POWERSHELL_SCRIPT
];

/**
 * 合成 WAV バイト列を OS の temp ディレクトリに書き出し、パスを返す。
 * 再生指示は「ファイルパスを 1 行」なので、バイト列は一旦ファイル化して渡す。
 * @param {Uint8Array} bytes  RIFF/WAVE PCM のバイト列。
 * @param {object} [options]
 * @param {string} [options.dir]  書き出し先ディレクトリ（既定 OS temp 配下の一意ディレクトリ）。
 * @param {string} [options.prefix]  ファイル名 prefix（既定 "soul-agent-"）。
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
 * 常駐再生プレイヤーを起動する。
 * @param {object} [options]
 * @param {string} [options.command]  実行コマンド（既定 powershell.exe）。テストで差し替える注入点。
 * @param {string[]} [options.args]  引数（既定は常駐 SoundPlayer スクリプト）。
 * @param {(command: string, args: string[], opts: object) => import("node:child_process").ChildProcess} [options.spawnImpl]
 *   spawn の差し替え（テスト用）。既定 node:child_process spawn。
 * @param {(line: string) => void} [options.onOutput]  子プロセス stdout の 1 行ごと（テスト観測用）。
 * @param {(line: string) => void} [options.onError]  子プロセス stderr の 1 行ごと（再生失敗の観測用）。
 * @returns {{ play: (wavPath: string) => void; dispose: () => void; child: import("node:child_process").ChildProcess }}
 */
export function createAudioPlayer(options = {}) {
  const command = options.command ?? DEFAULT_COMMAND;
  const args = options.args ?? DEFAULT_ARGS;
  const spawnImpl = options.spawnImpl ?? spawn;
  const onOutput = options.onOutput;
  const onError = options.onError;

  const child = spawnImpl(command, args, {
    stdio: ["pipe", "pipe", "pipe"]
  });

  if (onOutput && child.stdout) {
    lineReader(child.stdout, onOutput);
  }
  if (onError && child.stderr) {
    lineReader(child.stderr, onError);
  }

  let disposed = false;

  return {
    /**
     * 再生指示を送る（非ブロッキング＝指示送出のみ・完了は待たない）。
     * @param {string} wavPath  再生する WAV の絶対パス。改行は 1 行プロトコルを壊すため除去。
     */
    play(wavPath) {
      if (disposed) {
        throw new Error("audio player already disposed.");
      }
      if (typeof wavPath !== "string" || wavPath.length === 0) {
        throw new TypeError("play(wavPath): wavPath must be a non-empty string.");
      }
      const line = wavPath.replace(/[\r\n]+/g, "");
      if (!child.stdin || child.stdin.destroyed) {
        throw new Error("audio player stdin is not writable.");
      }
      child.stdin.write(`${line}\n`);
    },
    /**
     * 常駐プロセスを畳む（stdin を閉じてから kill）。
     *
     * ── クリーンシャットダウン（event loop に残さない・機械テストのハング対策）─────
     *  kill 後、child の stdio パイプ（stdin/stdout/stderr）を destroy し、child ハンドルを unref
     *  する。kill だけだと「終了シグナルは送ったが OS がまだプロセスを reap していない」窓で
     *  ChildProcess ハンドルが event loop を生かし続け、緑出力後にプロセスが終わらない（テスト
     *  ランナーがハングする）ことがある。パイプを destroy して fd 由来ハンドルを即解放し、
     *  child.unref() で「この畳んだ子のためだけには loop を保持しない」ことを明示する。魂は畳む
     *  意図で dispose を呼ぶので、reap を待たず抜けてよい（s1 ハング調査・domain-c.md）。
     */
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      try {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.end();
        }
      } catch {
        // best-effort
      }
      child.kill();
      // stdio パイプを destroy して fd ハンドルを即解放（reap 待ちで loop を生かさない）。
      try {
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
      } catch {
        // best-effort
      }
      // 畳んだ子の reap 待ちで event loop を保持しない。
      child.unref();
    },
    child
  };
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
