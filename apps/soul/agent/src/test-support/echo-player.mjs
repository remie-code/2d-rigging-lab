// @ts-check
/**
 * 無音エコープロセス（audio-player の機械テスト用）— apps/soul/agent。
 *
 * createAudioPlayer の command/args 差し替え注入点に渡す「PowerShell SoundPlayer の代役」。
 * stdin から届く 1 行（WAV パス）ごとに stdout へ `played:<path>` を書き返すだけの無音プロセス。
 * これで「stdin 指示 → 子プロセス応答」という常駐プロトコルの往復を、**スピーカーから音を
 * 出さずに**検証できる（機械テスト無音の絶対規律）。実再生は人間ゲートの領分。
 */

process.stdin.setEncoding("utf8");
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
    buffer = buffer.slice(newlineIndex + 1);
    if (line.trim().length > 0) {
      process.stdout.write(`played:${line.trim()}\n`);
    }
  }
});
process.stdin.on("end", () => {
  process.exit(0);
});
