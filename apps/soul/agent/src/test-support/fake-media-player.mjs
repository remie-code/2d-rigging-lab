// @ts-check
/**
 * 無音の疑似 MediaPlayer プロセス（audio-player 新プロトコルの機械テスト用）— apps/soul/agent。
 *
 * createAudioPlayer の command/args 差し替え注入点に渡す「WinRT MediaPlayer 常駐 PowerShell の代役」。
 * 新プロトコル（行コマンド PLAY/STOP + 状態応答行）の往復を、**スピーカーから音を出さずに**
 * 決定論的に検証するための無音プロセス。実再生・実 WinRT は人間ゲート/preflight の領分。
 *
 * ── 応答（本物の PowerShell 常駐スクリプトと同じ状態応答行を模す）──────────────
 *   受信 `PLAY <path>`  → 送信 `STARTED\t<path>`（再生開始＝isPlaying true）
 *   受信 `STOP`         → 送信 `STOPPED\t<path>`（直近 PLAY のパス・途中停止）
 *   受信 `END`          → 送信 `ENDED\t<path>`（自然完了の模擬。本物はポーリングが自発的に出すが、
 *                          テストの決定性のため明示トリガで模擬する）
 *   起動時 env SOUL_AUDIO_DEVICE_NAME があれば `DEVICE\t<name>` を 1 行出す（env 受け渡しの結合確認用）。
 *
 * タブ区切りは本物のプロトコル（<marker>\t<arg>）と一致させてある。
 */

const deviceName = process.env.SOUL_AUDIO_DEVICE_NAME;
if (deviceName) {
  process.stdout.write(`DEVICE\t${deviceName}\n`);
}

/** @type {string} */
let currentPath = "";
let currentPlaybackId = "";

process.stdin.setEncoding("utf8");
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newlineIndex).replace(/\r$/, "").trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line.length === 0) continue;
    if (line === "STOP") {
      process.stdout.write(
        currentPlaybackId
          ? `STOPPED\t${currentPlaybackId}\t${currentPath}\n`
          : `STOPPED\t${currentPath}\n`
      );
      currentPath = "";
      currentPlaybackId = "";
    } else if (line === "END") {
      process.stdout.write(
        currentPlaybackId
          ? `ENDED\t${currentPlaybackId}\t${currentPath}\n`
          : `ENDED\t${currentPath}\n`
      );
      currentPath = "";
      currentPlaybackId = "";
    } else if (line.startsWith("PLAYID\t")) {
      const parts = line.split("\t");
      currentPlaybackId = parts[1] ?? "";
      currentPath = parts.slice(2).join("\t").trim();
      process.stdout.write(`STARTED\t${currentPlaybackId}\t${currentPath}\n`);
    } else if (line.startsWith("PLAY ")) {
      currentPath = line.slice(5).trim();
      currentPlaybackId = "";
      process.stdout.write(`STARTED\t${currentPath}\n`);
    }
  }
});
process.stdin.on("end", () => {
  process.exit(0);
});
