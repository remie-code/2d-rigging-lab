// @ts-check
/**
 * 人間ゲート用 E2E preflight（S1 Domain B）— apps/soul/agent。**実再生を伴う**。
 *
 * TTS → timeline → 実器の Control Channel へ intent.speech 送出 → accepted → **実スピーカー再生**
 * まで一気通貫で通す。C 系列の教訓「配線の存在 ≠ 疎通」を実器で 1 回果たすためのスクリプト。
 * ws-double テストは配線の存在を検証するが、実器の channel-server が同じ返信をするか・口が
 * 実際に動くか・声と口が同期して見えるかは、実器を起動してここを通すまで確定しない。
 *
 * ── 実行者と手順（人間ゲート・ユーザー/Undine が実行。Gnome は実行しない）─────
 *   1. AivisSpeech 起動（http://127.0.0.1:10101）。
 *   2. 自律ホスト（runtime-player）起動 → Channel 開放 → URL を取得。
 *   3. node apps/soul/agent/scripts/preflight-e2e.mjs "ws://127.0.0.1:<port>/channel?token=<token>" [--text "…"]
 *      → 声が鳴り、器の口が同期して動けば一目一聴ゲート合格。
 *
 * ── --dry-run（URL 不要・送出も再生もしない）───────────────────────────────
 *   node apps/soul/agent/scripts/preflight-e2e.mjs --dry-run [--text "…"]
 *   TTS → timeline 構築 → 契約 assert までを実機 TTS で通して印字する（Channel 接続・再生なし）。
 *   URL を渡さない検証の入口（この経路も Gnome は実行しない＝実機再生・実器接続を避ける）。
 *
 * exit 0 = シナリオ完遂 / 1 = 疎通・再生の失敗 / 2 = 引数不正。
 */

import { createTtsClient, parseAudioQuery } from "../src/voice/tts-client.mjs";
import { wavDurationSec } from "../src/voice/wav-duration.mjs";
import { buildSpeechTimeline } from "../src/voice/mora-timeline.mjs";
import { connectChannel, redactToken } from "../src/channel/channel-client.mjs";
import { createAudioPlayer, writeTempWav } from "../src/voice/audio-player.mjs";
import { speak } from "../src/voice/speak.mjs";

function parseArgs(argv) {
  const flags = argv.filter((a) => a.startsWith("--"));
  const positionals = argv.filter((a) => !a.startsWith("--"));
  const getFlag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    dryRun: flags.includes("--dry-run"),
    url: positionals[0],
    text: getFlag("--text") ?? "こんにちは、テストです",
    baseUrl: getFlag("--base-url"),
    speaker: getFlag("--speaker")
  };
}

/** --dry-run: 実機 TTS で timeline 構築まで（送出・再生なし）。 */
async function runDryRun(args) {
  const client = createTtsClient({ baseUrl: args.baseUrl, speaker: args.speaker });
  process.stdout.write(
    `[preflight-e2e --dry-run] TTS only, no channel, no playback. text="${args.text}"\n`
  );
  const query = await client.audioQuery(args.text);
  const { moras, prePhonemeSec, postPhonemeSec } = parseAudioQuery(query);
  const wav = await client.synthesis(query);
  const wavSec = wavDurationSec(wav);
  const { timeline } = buildSpeechTimeline(moras, wavSec, prePhonemeSec, postPhonemeSec);
  process.stdout.write(
    `[preflight-e2e --dry-run] moras=${moras.length} wav=${wavSec.toFixed(4)}s ` +
      `timeline=${timeline.length} items — first ${JSON.stringify(timeline[0])}\n`
  );
  process.stdout.write("[preflight-e2e --dry-run] OK (no send, no play)\n");
  process.exit(0);
}

/** 実器 E2E: TTS → 送出 → accepted → 実再生。 */
async function runE2E(args) {
  if (typeof args.url !== "string" || args.url.length === 0) {
    process.stderr.write(
      "usage: node preflight-e2e.mjs <ws-url> [--text ..] [--base-url ..] [--speaker ..]\n" +
        "   or: node preflight-e2e.mjs --dry-run [--text ..]\n"
    );
    process.exit(2);
    return;
  }
  process.stdout.write(
    `[preflight-e2e] connecting ${redactToken(args.url)} — will PLAY audio on accept\n`
  );
  const channel = await connectChannel(args.url);
  const player = createAudioPlayer();
  try {
    const result = await speak(args.text, {
      channel,
      player,
      ttsBaseUrl: args.baseUrl,
      speaker: args.speaker,
      writeWav: writeTempWav
    });
    process.stdout.write(
      `[preflight-e2e] accepted (rtt=${result.rttMs.toFixed(1)}ms), playing ${result.wavPath}\n` +
        `[preflight-e2e] timeline=${result.timeline.length} items, wav=${result.wavDurationSec.toFixed(4)}s\n` +
        "[preflight-e2e] 一目一聴: 声が鳴り、器の口が同期して動けば合格。\n"
    );
    // 発話が鳴り終わる尺だけ待ってから畳む（timeline 末尾 + WAV 末尾無音余裕）。
    const spanMs = (result.timeline.at(-1)?.timeMs ?? 0) + 800;
    await new Promise((resolve) => setTimeout(resolve, spanMs));
  } finally {
    player.dispose();
    await channel.close();
  }
  process.exit(0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.dryRun) {
    await runDryRun(args);
    return;
  }
  await runE2E(args);
}

main().catch((error) => {
  process.stderr.write(
    `[preflight-e2e] FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exit(1);
});
