// @ts-check
/**
 * ASR 実機疎通 preflight（S2 Domain B・機械検証）— apps/soul/agent。**配線 ≠ 疎通**。
 *
 * 実 whisper-server.exe + 実 kotoba モデル（vendor 配置・非コミット）を子プロセスで起動し、
 * 固定 WAV（**合成のみ**・実マイク不使用）を `/inference` に往復させて転写を取得、
 * 転写バッファに積んで表示し、**確実にサーバを畳んで** exit 0/1 する。preflight-tts.mjs の型。
 *
 * ── 検証する項目 ─────────────────────────────────────────────────────
 *  1. whisper-server 子プロセスの起動 + ヘルスチェック通過（モデルロード時間を ms 計測）。
 *  2. /inference の multipart 往復（HTTP 200 + `{text}` レスポンス構造）。
 *  3. 発話終了→転写到着のレイテンシ実測（cold/warm の 2 回・Domain C 計測の先行データ）。
 *  4. 転写バッファへの積み上げ（S2 の心臓の実機経路）。
 *
 * ── 音声素材（プライバシー絶対規律）─────────────────────────────────────
 *  (a) AivisSpeech 実機（http://127.0.0.1:10101）が生きていれば、日本語テキストを TTS 合成した
 *      WAV を使う（合成音声 = 実マイクではない・**メモリ上のみ・ディスクに書かない**）。
 *      この場合は日本語転写テキストの実取得まで検証できる。
 *  (b) いなければ正弦波+無音の合成 WAV（fixtures-audio + encodeWav）で疎通のみ検証。
 *      このとき転写テキストは空や幻聴でも**疎通 PASS**（PASS 定義 = HTTP 200 + text が文字列。
 *      内容の正しさは問わない）。どちらで検証したかを出力に明示する。
 *
 * 使い方: node apps/soul/agent/scripts/preflight-asr.mjs
 *   [--port N] [--host H] [--model PATH] [--server-path PATH] [--language L] [--threads N]
 *   [--text "…"] [--synthetic]（TTS を試さず合成 WAV に固定）
 *   [--ready-timeout MS]（既定 120000。モデルロード 512.9MB を見込む）
 * exit 0 = PASS、exit 1 = 疎通失敗 or 構造違反。
 */

import { createWhisperServer } from "../src/whisper-server.mjs";
import { createWhisperClient } from "../src/whisper-client.mjs";
import { createTranscriptBuffer } from "../src/transcript-buffer.mjs";
import { createTtsClient } from "../src/tts-client.mjs";
import { encodeWav } from "../src/wav-encode.mjs";
import { wavDurationSec } from "../src/wav-duration.mjs";
import { sinePcm, silencePcm, concatInt16 } from "../src/fixtures-audio.mjs";

function parseArgs(argv) {
  const args = {
    port: undefined,
    host: undefined,
    model: undefined,
    serverPath: undefined,
    language: undefined,
    threads: undefined,
    text: "こんにちは、耳のテストです",
    synthetic: false,
    readyTimeoutMs: 120000
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--host") args.host = argv[++i];
    else if (a === "--model") args.model = argv[++i];
    else if (a === "--server-path") args.serverPath = argv[++i];
    else if (a === "--language") args.language = argv[++i];
    else if (a === "--threads") args.threads = Number(argv[++i]);
    else if (a === "--text") args.text = argv[++i];
    else if (a === "--synthetic") args.synthetic = true;
    else if (a === "--ready-timeout") args.readyTimeoutMs = Number(argv[++i]);
  }
  return args;
}

const log = (msg) => process.stdout.write(`[preflight-asr] ${msg}\n`);

/**
 * WAV 素材を用意する。TTS（AivisSpeech 実機）→ だめなら合成正弦波へフォールバック。
 * @param {{ text: string; synthetic: boolean }} args
 * @returns {Promise<{ wav: Uint8Array; source: "tts" | "synthetic"; describe: string }>}
 */
async function acquireWav(args) {
  if (!args.synthetic) {
    try {
      const tts = createTtsClient();
      const query = await tts.audioQuery(args.text);
      // 16kHz 出力を要求（VOICEVOX 系互換フィールド）。whisper 入力と揃える。
      if (typeof query === "object" && query !== null) {
        query.outputSamplingRate = 16000;
        query.outputStereo = false;
      }
      const wav = await tts.synthesis(query);
      return {
        wav,
        source: "tts",
        describe: `AivisSpeech 合成音声（実マイクではない・メモリ上のみ）text="${args.text}"`
      };
    } catch (error) {
      log(
        `AivisSpeech 不在または失敗 → 合成 WAV へフォールバック: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  // 合成: 無音 300ms + 440Hz 正弦波 800ms + 無音 300ms @16kHz mono。
  const pcm = concatInt16(
    silencePcm({ durationMs: 300 }),
    sinePcm({ freq: 440, durationMs: 800 }),
    silencePcm({ durationMs: 300 })
  );
  return {
    wav: encodeWav(pcm, { sampleRate: 16000, channels: 1, bitsPerSample: 16 }),
    source: "synthetic",
    describe: "合成 WAV（無音 300ms + 440Hz 正弦波 800ms + 無音 300ms・16kHz mono）"
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // 1. WAV 素材（サーバ起動前に確保 — TTS 失敗のフォールバックもここで確定）。
  const { wav, source, describe } = await acquireWav(args);
  const wavSec = wavDurationSec(wav);
  log(`WAV source = ${source}: ${describe}`);
  log(`WAV: ${wav.byteLength} bytes, ${wavSec.toFixed(3)}s`);

  // 2. whisper-server 起動 + ヘルスチェック（モデルロード込み）。
  const server = createWhisperServer({
    serverPath: args.serverPath,
    modelPath: args.model,
    host: args.host,
    port: args.port,
    language: args.language,
    threads: args.threads,
    readyTimeoutMs: args.readyTimeoutMs,
    onStderr: () => {} // ログは消費のみ（大量のロード進捗で画面を埋めない）
  });
  log(`whisper-server spawning: baseUrl=${server.baseUrl}`);

  let failed = false;
  try {
    const tReady0 = Date.now();
    await server.ready;
    const readyMs = Date.now() - tReady0;
    log(`server READY in ${readyMs}ms (HTTP responding = model loaded & listening)`);

    // 3. /inference 往復（cold / warm の 2 回でレイテンシ実測）。
    const client = createWhisperClient({ baseUrl: server.baseUrl });
    const t1 = Date.now();
    const first = await client.transcribe(wav);
    const coldMs = Date.now() - t1;
    log(`inference #1 (cold): ${coldMs}ms  text="${first.text}"`);

    const t2 = Date.now();
    const second = await client.transcribe(wav);
    const warmMs = Date.now() - t2;
    log(`inference #2 (warm): ${warmMs}ms  text="${second.text}"`);
    log(
      `LATENCY: utterance ${Math.round(wavSec * 1000)}ms → transcript in cold=${coldMs}ms / warm=${warmMs}ms`
    );

    // 4. 転写バッファに積む（S2 の心臓の実機経路）。
    const buffer = createTranscriptBuffer();
    const result = buffer.append({ startMs: 0, endMs: Math.round(wavSec * 1000), text: first.text });
    log(
      `transcript buffer: appended=${result.appended} reason=${result.reason} ` +
        `stats=${JSON.stringify(buffer.stats())}`
    );
    for (const entry of buffer.all()) {
      log(`  buffer[${entry.seq}] ${entry.startMs}..${entry.endMs}ms "${entry.text}"`);
    }

    // 5. PASS 判定。
    //    共通: ready 通過 + /inference HTTP 200 + text が文字列（transcribe が返った時点で成立）。
    //    tts のときのみ: 日本語転写が非空であることまで要求。
    //    synthetic のときは text 空/幻聴でも疎通 PASS（内容は問わない・上記ヘッダコメントの定義）。
    if (source === "tts" && first.text.length === 0) {
      log("FAIL: TTS 音声に対して転写が空（疎通は成立したが日本語転写の実取得に失敗）");
      failed = true;
    } else {
      log(
        `RESULT: PASS (${source} WAV; server ready ${readyMs}ms; ` +
          `/inference round-trip OK; response structure {text} OK; buffer append OK)`
      );
    }
  } catch (error) {
    log(`FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    failed = true;
  } finally {
    // どの経路でも whisper-server の孤児を残さない（絶対規律）。
    server.dispose();
    log("server disposed (kill → stdio destroy → unref)");
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(
    `[preflight-asr] FAILED (setup): ${
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    }\n`
  );
  process.exit(1);
});
