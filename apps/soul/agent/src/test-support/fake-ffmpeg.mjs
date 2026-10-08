// @ts-check
/**
 * 合成 PCM を吐くダミー ffmpeg（ffmpeg-capture の機械テスト用）— apps/soul/agent。
 *
 * createFfmpegCapture の ffmpegPath/args 差し替え注入点に渡す「実 ffmpeg の代役」。実マイク・実
 * ffmpeg・録音物を一切使わず、決定論的な合成 PCM バイト列を stdout へ書くだけ（機械テスト無音・
 * プライバシーの絶対規律）。実 ffmpeg の疎通は人間ゲート／任意 preflight の領分。
 *
 * argv:
 *   --bytes N   stdout へ書く合成 PCM バイト数（既定 2048）。値は (i % 256) の増加パターン。
 *   --exit C    書き込み後 exit code C で終了（再起動耐性テスト用）。
 *   --stay      書き込み後も生き続ける（kill されるまで keepalive）。クリーンシャットダウン検証用。
 *   --stderr S  PCM 書き込み前に stderr へ 1 行 S を出す（stderr 経路の検証用）。
 */

function parseArgs(argv) {
  const out = { bytes: 2048, exit: 0, stay: false, stderr: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--bytes") out.bytes = Number(argv[++i]);
    else if (a === "--exit") out.exit = Number(argv[++i]);
    else if (a === "--stay") out.stay = true;
    else if (a === "--stderr") out.stderr = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.stderr) {
  process.stderr.write(`${args.stderr}\n`);
}

const buf = Buffer.alloc(args.bytes);
for (let i = 0; i < buf.length; i += 1) {
  buf[i] = i % 256;
}
process.stdout.write(buf);

if (args.stay) {
  // kill されるまで生き続ける（event loop を保持する keepalive）。
  const keepAlive = setInterval(() => {}, 1000);
  process.on("SIGTERM", () => {
    clearInterval(keepAlive);
    process.exit(0);
  });
} else {
  process.exit(args.exit);
}
