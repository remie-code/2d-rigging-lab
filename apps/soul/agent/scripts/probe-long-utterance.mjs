// @ts-check
/**
 * 長発話 flash-attn 崩壊ゾーンの回帰プローブ（S2.5 追撃 domain-f・恒久）— apps/soul/agent。
 *
 * 診断済みの事実（discussion/ai-cohost/implementation/waves/s2.5/long-utterance-diagnosis.md）:
 * vendor whisper-server(v1.9.1) は flash-attn が既定 ON。動的 audio_ctx（whisper-inference.mjs の
 * computeAudioCtx・下限クランプ 256）との組み合わせで、audio_ctx が 256 を超える域
 * （≒ 発話 3.2 秒超）に達すると転写が**決定論的に崩壊**する（丸ごと空 / 「,」等のゴミ行 / 末尾反復）。
 * whisper-server.mjs は既定で `-nfa`（flash-attn OFF）を付けるよう修正済み。本スクリプトは
 * その修正の**回帰プローブ**: 3.2 秒を確実に超える発話 1 本を、(i) 抑止オプションで flash-attn を
 * ON に戻した「旧挙動」と (ii) 採用既定（-nfa）の両方で実部品縦貫通し、(i) で崩壊・(ii) で正常
 * 転写になることを rawText 付きで示す。
 *
 * 実部品の縦貫通は preflight-ears.mjs と同型: fake マイク（TTS 合成 PCM を実時間レートで注入）→
 * 実 Silero VAD → セグメンタ → リング切り出し → 実 whisper-server。
 * プライバシー絶対規律: 音声はメモリ上のみ・ディスク不書き出し・実マイク不使用。
 *
 * 使い方: node apps/soul/agent/scripts/probe-long-utterance.mjs [--port N]
 * exit 0 = PASS（(i) 崩壊 かつ (ii) 正常転写を確認）、exit 1 = 失敗（回帰 or 疎通不可）。
 */

import { createEarPipeline, EAR_DEFAULTS } from "../src/ears/ear-pipeline.mjs";
import { createWhisperInference } from "../src/ears/whisper-inference.mjs";
import { createTtsClient } from "../src/voice/tts-client.mjs";
import { decodeInt16LE } from "../src/ears/pcm-framing.mjs";
import { silencePcm, concatInt16 } from "../src/ears/fixtures-audio.mjs";

const log = (msg) => process.stdout.write(`[probe-long-utterance] ${msg}\n`);

function parseArgs(argv) {
  const args = { port: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--port") args.port = Number(argv[++i]);
  }
  return args;
}

/** WAV → data チャンクの PCM（16bit 前提の最小 RIFF パーサ・preflight-vad/preflight-ears と同型）。 */
function wavDataBytes(wav) {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  if (view.getUint32(0, false) !== 0x52494646) throw new Error("not a RIFF file");
  let offset = 12;
  while (offset + 8 <= wav.byteLength) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    if (id === 0x64617461) return wav.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  throw new Error("no data chunk found");
}

async function ttsPcm(text) {
  const tts = createTtsClient();
  const query = await tts.audioQuery(text);
  if (typeof query === "object" && query !== null) {
    query.outputSamplingRate = 16000;
    query.outputStereo = false;
  }
  return decodeInt16LE(wavDataBytes(await tts.synthesis(query)));
}

/**
 * 1 回分の縦貫通実行（fake マイク → 実 VAD → 実 whisper-server）。
 * @param {object} opts
 * @param {string} opts.label
 * @param {Int16Array} opts.stream  無音 → 長発話 → 無音（メモリ上のみ）。
 * @param {number} opts.port
 * @param {boolean} opts.flashAttn  true = 旧挙動（flash-attn ON・抑止オプション使用）。
 * @returns {Promise<{ label: string; transcripts: any[]; diags: any[]; rawTexts: string[]; error: string | null }>}
 */
async function runOnce(opts) {
  const { label, stream, port, flashAttn } = opts;
  log(`── run start: ${label} (flashAttn=${flashAttn}, port=${port}) ──`);

  // fake マイク: 実時間レート（100ms = 1600 サンプル）で onPcm へ流す。
  const captureFactory = (captureOpts) => {
    let cursor = 0;
    const timer = setInterval(() => {
      if (cursor >= stream.length) return; // 流し終えたら無音すら送らない（終端で静止）
      const next = Math.min(cursor + 1600, stream.length);
      const chunk = stream.subarray(cursor, next);
      cursor = next;
      const bytes = new Uint8Array(chunk.length * 2);
      new Int16Array(bytes.buffer).set(chunk);
      captureOpts.onPcm(bytes);
    }, 100);
    return {
      dispose() {
        clearInterval(timer);
      }
    };
  };

  // rawText を捕まえるため transcribeImpl を自前ラップ（実 whisper-server は叩き続ける）。
  const baseUrl = `http://127.0.0.1:${port}`;
  const inference = createWhisperInference({ baseUrl });
  /** @type {string[]} */
  const rawTexts = [];
  const transcribeImpl = async (wavBytes, transcribeOpts) => {
    try {
      const result = await inference.transcribe(wavBytes, transcribeOpts);
      rawTexts.push(result.rawText);
      return result;
    } catch (error) {
      rawTexts.push(`(exception: ${error instanceof Error ? error.message : String(error)})`);
      throw error;
    }
  };

  /** @type {any[]} */
  const transcripts = [];
  /** @type {any[]} */
  const diags = [];
  const pipeline = createEarPipeline({
    captureFactory: /** @type {any} */ (captureFactory),
    whisper: { threads: EAR_DEFAULTS.threads, port, flashAttn },
    // pipeline 内部の transcribe 呼び出しは実 whisper-server を叩く（wire は本物・キャプチャのみ挟む）。
    transcribeImpl,
    onVadEvent: (e) => {
      if (e.type === "speechEnd") {
        log(`  vad: speechEnd ${(e.startMs / 1000).toFixed(2)}..${(e.endMs / 1000).toFixed(2)}s (${e.reason})`);
      }
    },
    onTranscript: (entry, meta) => {
      transcripts.push({ entry, meta });
      log(
        `  transcript[${entry.seq}] ${(entry.startMs / 1000).toFixed(2)}..${(entry.endMs / 1000).toFixed(2)}s ` +
          `latency=${Math.round(meta.latencyMs)}ms audio_ctx=${meta.audioCtx}  "${entry.text}"`
      );
    },
    onDiagnostic: (d) => {
      diags.push(d);
      log(`  diag: ${JSON.stringify(d)}`);
    }
  });

  let error = null;
  try {
    await pipeline.start();
    log(`  pipeline started (VAD init + whisper ready)`);

    // 発話が確定 or 失敗の診断が出るまで待つ（有界 60s）。
    const deadline = Date.now() + 60000;
    while (
      pipeline.transcriptBuffer.size() === 0 &&
      !diags.some((d) => d.type === "asrFailure" || d.type === "transcriptDiscarded") &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (
      pipeline.transcriptBuffer.size() === 0 &&
      !diags.some((d) => d.type === "asrFailure" || d.type === "transcriptDiscarded")
    ) {
      error = `timeout: no transcript/diagnostic within 60s (stats=${JSON.stringify(pipeline.stats())})`;
      log(`  FAIL: ${error}`);
    }
  } catch (e) {
    error = e instanceof Error ? (e.stack ?? e.message) : String(e);
    log(`  FAILED (setup/start): ${error}`);
  } finally {
    await pipeline.dispose();
    log(`  pipeline disposed`);
  }
  return { label, transcripts, diags, rawTexts, error };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const basePort = args.port ?? 8178;

  // 3.2s を確実に超える発話（computeAudioCtx が 256 を超える域）。目安 ceil(sec*50)+96 > 256
  // ⇔ sec > 3.2。句点「。」を使うと TTS の無音がセグメンタの minSilenceMs(400ms) を超えて
  // VAD が複数発話に分割してしまう（実測: 12.83s の文が最初の句点で 2.04s に切られた）ため、
  // ここでは句点なし・読点を最小限にした「一続きの長い発話」にして 1 発話として切り出させる。
  const longUtterance =
    "今日はメッシュ生成の続きをやりながらずいぶん長い時間このトピックに取り組んでいて" +
    "焦らず一つずつ確認しながら少しずつ前に進めていこうと思っていますのでもうしばらく" +
    "このまま作業を続けていく予定です";

  log(`TTS 合成中（AivisSpeech 実機・実マイク不使用）: "${longUtterance}"`);
  const pcm = await ttsPcm(longUtterance);
  const durationSec = pcm.length / 16000;
  log(`utterance duration: ${durationSec.toFixed(2)}s`);
  if (durationSec <= 3.2) {
    process.stderr.write(
      `[probe-long-utterance] FAILED (setup): utterance too short (${durationSec.toFixed(2)}s <= 3.2s); ` +
        "崩壊域（audio_ctx>256）に達しない。テキストを長くする必要がある。\n"
    );
    process.exit(1);
    return;
  }
  const stream = concatInt16(silencePcm({ durationMs: 500 }), pcm, silencePcm({ durationMs: 900 }));

  // (i) 旧挙動: flash-attn ON（抑止オプション flashAttn:true で -nfa を外す）。
  const portA = basePort;
  const before = await runOnce({ label: "flash-attn=ON (旧挙動)", stream, port: portA, flashAttn: true });

  // ポート解放待ち（前サーバの TCP 解放をまたいで次サーバを同一 host で起こす保険）。
  await new Promise((r) => setTimeout(r, 500));

  // (ii) 採用既定: flash-attn OFF（-nfa・buildWhisperServerArgs 既定）。
  const portB = basePort + 1;
  const after = await runOnce({ label: "flash-attn=OFF (-nfa・採用既定)", stream, port: portB, flashAttn: false });

  // ── 判定 ──
  // 崩壊 = 転写ゼロ件（timeout/asrFailure/transcriptDiscarded）または非空 rawText が入力と大きく乖離
  // （簡易判定: 転写が 0 件、または transcriptBuffer に積まれた text が空/短すぎる）。
  const beforeCollapsed =
    before.transcripts.length === 0 ||
    before.diags.some((d) => d.type === "asrFailure" || d.type === "transcriptDiscarded") ||
    before.error != null;
  const afterOk =
    after.transcripts.length > 0 &&
    after.error == null &&
    after.transcripts.every((t) => typeof t.entry.text === "string" && t.entry.text.length > 0);

  log("");
  log("═══════════════════════════════════════════════════════════════");
  log(`RESULT SUMMARY (utterance ${durationSec.toFixed(2)}s, 崩壊域 audio_ctx>256 を確実に超える)`);
  log("───────────────────────────────────────────────────────────────");
  log(`(i)  flash-attn=ON (旧挙動):  transcripts=${before.transcripts.length}  diags=${JSON.stringify(before.diags.map((d) => d.type))}  error=${before.error ?? "null"}`);
  log(`     rawText(s): ${JSON.stringify(before.rawTexts)}`);
  log(`     → collapsed=${beforeCollapsed}`);
  log(`(ii) flash-attn=OFF (-nfa・採用既定): transcripts=${after.transcripts.length}  diags=${JSON.stringify(after.diags.map((d) => d.type))}  error=${after.error ?? "null"}`);
  log(`     rawText(s): ${JSON.stringify(after.rawTexts)}`);
  after.transcripts.forEach((t) => log(`     text: "${t.entry.text}"  latency=${Math.round(t.meta.latencyMs)}ms audio_ctx=${t.meta.audioCtx}`));
  log(`     → ok=${afterOk}`);
  log("═══════════════════════════════════════════════════════════════");

  const pass = beforeCollapsed && afterOk;
  if (pass) {
    log("PASS: 旧挙動(flash-attn ON)で崩壊・採用既定(-nfa)で正常転写を確認。");
  } else {
    log(
      `FAIL: 期待した対比が得られなかった（beforeCollapsed=${beforeCollapsed} / afterOk=${afterOk}）。` +
        "本文の rawText/diag を確認すること。"
    );
  }
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(
    `[probe-long-utterance] FAILED (setup): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
