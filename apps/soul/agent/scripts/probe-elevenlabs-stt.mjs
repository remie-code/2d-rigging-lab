// @ts-check
/**
 * ElevenLabs リアルタイム STT 観測「probe-elevenlabs-stt」— apps/soul/agent。**従量（Free 枠）を消費する**。
 *
 * 実マイク（S2 の ffmpeg 取り込み・16kHz mono s16le）の音声を 100ms ごとに `scribe_v2_realtime` の
 * WebSocket へ流し、届く partial / committed を時刻付きで全部記録する。目的は STT の挙動観察
 * （partial の書き換わり方、commit の出方、確定方式ごとの遅延）。設計の合意は
 * discussion/ai-cohost/elevenlabs/ を参照。
 *
 * ── 遅延の物差し（手元 Silero VAD）────────────────────────────────────────
 *  ElevenLabs は「いつ喋り終わったか」を教えてくれないので、同じ音声を手元の Silero VAD +
 *  セグメンタにもかけ、無音が始まったストリーム時刻（speechPad 0）を「喋り終わり」とする。
 *  ストリーム時刻はフレームを受け取った壁時計へ写像し、届いたイベントの壁時計との差を遅延とする。
 *  手元 VAD は本番の仕組みではなく、計測のための物差し。
 *
 * ── 記録（S2 のプライバシー規律）────────────────────────────────────────
 *  音声は一切ディスクに書かない。残すのはイベントの時刻と文字起こしだけで、置き場所は
 *  tmp/elevenlabs-stt/runs/（gitignore）。
 *
 * ── 認証 ───────────────────────────────────────────────────────────
 *  `apps/soul/agent/.env.elevenlabs.local`（gitignore 済み）の `ELEVENLABS_API_KEY` を
 *  `node --env-file` で読む。キーの値はログ・結果に書かない。
 *
 * 実行（話しかけながら。--seconds で上限を切る。既定 60 秒、最大 300 秒）:
 *   node --env-file=apps/soul/agent/.env.elevenlabs.local apps/soul/agent/scripts/probe-elevenlabs-stt.mjs \
 *     --strategy vad [--vad-silence 1.5] [--seconds 60] [--device "マイク (2- Shure MV7+)"]
 *  --strategy: vad | manual。manual は手元 VAD の speechEnd（無音 --local-silence ms、既定 400）で commit を送る。
 *  サーバー VAD の無音しきい値は 0.3〜3.0 秒しか受け付けない（0.2 は invalid_request。2026-10-16 実機確認）ので、
 *  それより短く確定させたいときは manual + --local-silence を使う。
 *  （turn_prediction は scribe_v2_realtime では invalid_request になる。2026-10-16 実機確認）
 *  --buffer-ms: dshow の -audio_buffer_size（既定 50）。既定のままだとマイク音声が約 0.5 秒ずつ
 *  まとめて届き、送信も物差しも 0.5 秒刻みになる（experiments/01 の 1 回目で観測）。0 で指定なし。
 */

import { mkdir, writeFile, appendFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createFfmpegCapture, buildFfmpegArgs } from "../src/ears/ffmpeg-capture.mjs";
import { createPcmFramer, int16ToFloat32 } from "../src/ears/pcm-framing.mjs";
import { createSileroVad } from "../src/ears/silero-vad.mjs";
import { createSpeechSegmenter } from "../src/ears/speech-segmenter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..", "..");
const SAMPLE_RATE = 16000;
const SEND_EVERY_BYTES = 3200; // 100ms 分の s16le mono 16kHz。
const MAX_SECONDS = 300;

async function loadLastDevice() {
  try {
    const json = JSON.parse(await readFile(resolve(here, "..", "cockpit-settings.local.json"), "utf8"));
    return typeof json.lastDevice === "string" ? json.lastDevice : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      strategy: { type: "string", default: "vad" },
      "vad-silence": { type: "string" },
      seconds: { type: "string", default: "60" },
      device: { type: "string" },
      language: { type: "string", default: "ja" },
      "buffer-ms": { type: "string", default: "50" },
      // 手元 VAD の最小無音（ms）。物差しの区切りであり、manual では commit を送るきっかけ。既定は soul の耳と同じ 400。
      "local-silence": { type: "string", default: "400" },
    },
  });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set (run with --env-file=apps/soul/agent/.env.elevenlabs.local)");
  const strategy = values.strategy;
  if (!["vad", "manual"].includes(strategy)) throw new Error(`unknown --strategy: ${strategy}`);
  const seconds = Math.min(Number(values.seconds), MAX_SECONDS);
  const deviceName = values.device ?? (await loadLastDevice());
  if (!deviceName) throw new Error("--device is required (no lastDevice in cockpit-settings.local.json)");

  const query = new URLSearchParams({
    model_id: "scribe_v2_realtime",
    audio_format: "pcm_16000",
    language_code: values.language,
    commit_strategy: strategy,
  });
  if (values["vad-silence"]) query.set("vad_silence_threshold_secs", values["vad-silence"]);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(REPO_ROOT, "tmp", "elevenlabs-stt", "runs");
  await mkdir(outDir, { recursive: true });
  const bufferMs = Number(values["buffer-ms"]);
  const localSilenceMs = Number(values["local-silence"]);
  const tag = `${stamp}-${strategy}${values["vad-silence"] ? `-${values["vad-silence"]}s` : ""}-buf${bufferMs}${strategy === "manual" ? `-local${localSilenceMs}` : ""}`;
  const logPath = resolve(outDir, `${tag}.jsonl`);

  const t0 = performance.now();
  const now = () => Math.round(performance.now() - t0);
  /** @param {Record<string, unknown>} entry */
  const log = (entry) => appendFile(logPath, `${JSON.stringify({ t: now(), ...entry })}\n`);
  await log({ kind: "config", strategy, query: Object.fromEntries(query), device: deviceName, seconds, bufferMs, localSilenceMs });

  // --- 手元の物差し: Silero VAD + セグメンタ（speechPad 0 で endMs = 無音開始時刻）。
  /** ストリーム時刻(ms) → そのフレームを受け取った壁時計(ms)。フレーム順に単調。 */
  /** @type {Array<[number, number]>} */
  const frameClock = [];
  const wallAt = (/** @type {number} */ streamMs) => {
    for (let i = frameClock.length - 1; i >= 0; i--) if (frameClock[i][0] <= streamMs) return frameClock[i][1];
    return frameClock[0]?.[1] ?? 0;
  };
  /** @type {Array<{ startWall: number; endWall: number | null; text?: string }>} */
  const utterances = [];
  let commitNext = false;
  const segmenter = createSpeechSegmenter({ minSilenceMs: localSilenceMs, speechPadMs: 0 }, (event) => {
    if (event.type === "speechStart") {
      utterances.push({ startWall: wallAt(event.tMs), endWall: null });
      void log({ kind: "local_speech_start", streamMs: event.tMs, wall: wallAt(event.tMs) });
    } else if (event.type === "speechEnd") {
      const endWall = wallAt(event.endMs);
      const u = utterances.at(-1);
      if (u) u.endWall = endWall;
      void log({ kind: "local_speech_end", streamMs: event.endMs, wall: endWall, detectedAt: now() });
      console.log(`[${fmt(now())}] ── 手元VAD: 喋り終わり（${fmt(endWall)} 時点）`);
      if (strategy === "manual") commitNext = true;
    } else if (event.type === "speechCancel") {
      utterances.pop();
    }
  });
  const vad = createSileroVad({});
  await vad.init();
  const framer = createPcmFramer();
  let streamSamples = 0;
  let vadChain = Promise.resolve();

  // --- ElevenLabs WebSocket
  const ws = new WebSocket(`wss://api.elevenlabs.io/v1/speech-to-text/realtime?${query}`, {
    // @ts-ignore undici の WebSocketInit は headers を受け付ける（Node 24 同梱）。
    headers: { "xi-api-key": apiKey },
  });
  let lastPartial = "";
  /** @type {Array<{ t: number; kind: string; text: string; rewrite?: boolean }>} */
  const events = [];
  ws.addEventListener("message", (msg) => {
    const t = now();
    const data = JSON.parse(String(msg.data));
    const type = data.message_type;
    if (type === "partial_transcript") {
      const text = data.text ?? "";
      if (text === lastPartial) return; // keepalive / 変化なし
      const rewrite = lastPartial.length > 0 && text.length > 0 && !text.startsWith(lastPartial);
      events.push({ t, kind: "partial", text, rewrite });
      void log({ kind: "partial", text, rewrite });
      console.log(`[${fmt(t)}] partial${rewrite ? "（書き換え）" : ""}: ${text}`);
      lastPartial = text;
    } else if (type === "committed_transcript") {
      events.push({ t, kind: "commit", text: data.text ?? "" });
      void log({ kind: "commit", text: data.text ?? "" });
      console.log(`[${fmt(t)}] ★ commit: ${data.text}`);
      lastPartial = "";
    } else {
      void log({ kind: "server", data });
      console.log(`[${fmt(t)}] ${type}: ${JSON.stringify(data.config ?? data.error ?? data)}`);
    }
  });
  const opened = new Promise((ok, ng) => {
    ws.addEventListener("open", () => ok(undefined), { once: true });
    ws.addEventListener("error", (e) => ng(new Error(`websocket error: ${/** @type {any} */ (e).message ?? "unknown"}`)), { once: true });
  });
  ws.addEventListener("close", (e) => {
    void log({ kind: "ws_close", code: e.code, reason: e.reason });
    console.log(`[${fmt(now())}] websocket closed code=${e.code} ${e.reason}`);
  });
  await opened;

  // --- マイク → 手元VAD と ElevenLabs の両方へ
  let pending = new Uint8Array(0);
  let firstChunk = true;
  /** マイクから PCM チャンクが届いた壁時計の間隔（取り込みバッファの確認用）。 */
  /** @type {number[]} */
  const chunkGaps = [];
  let lastChunkWall = null;
  const device = deviceName.startsWith("audio=") ? deviceName : `audio=${deviceName}`;
  // -audio_buffer_size は buildFfmpegArgs が付ける（既定 50。0 で付けない）。ここで足すと二重になる。
  const args = buildFfmpegArgs({ device, sampleRate: SAMPLE_RATE, channels: 1, audioBufferMs: bufferMs });
  const capture = createFfmpegCapture({
    args,
    sampleRate: SAMPLE_RATE,
    channels: 1,
    onPcm: (chunk) => {
      const wall = now();
      if (lastChunkWall != null) chunkGaps.push(wall - lastChunkWall);
      lastChunkWall = wall;
      for (const frame of framer.push(chunk)) {
        const tMs = Math.round((streamSamples * 1000) / SAMPLE_RATE);
        streamSamples += frame.length;
        frameClock.push([tMs, wall]);
        const f32 = int16ToFloat32(frame);
        vadChain = vadChain.then(async () => segmenter.push(await vad.process(f32), tMs));
      }
      const merged = new Uint8Array(pending.length + chunk.length);
      merged.set(pending);
      merged.set(chunk, pending.length);
      pending = merged;
      while (pending.length >= SEND_EVERY_BYTES && ws.readyState === WebSocket.OPEN) {
        const piece = pending.subarray(0, SEND_EVERY_BYTES);
        pending = pending.slice(SEND_EVERY_BYTES);
        const commit = commitNext;
        commitNext = false;
        ws.send(JSON.stringify({
          message_type: "input_audio_chunk",
          audio_base_64: Buffer.from(piece).toString("base64"),
          commit,
          sample_rate: SAMPLE_RATE,
        }));
        if (commit) void log({ kind: "manual_commit_sent" });
        if (firstChunk) { firstChunk = false; void log({ kind: "first_chunk_sent" }); }
      }
    },
    onError: () => {},
  });

  console.log(`録音開始（${seconds} 秒、方式=${strategy}${values["vad-silence"] ? `、無音しきい値=${values["vad-silence"]}s` : ""}）。話しかけてください。`);
  await new Promise((r) => setTimeout(r, seconds * 1000));
  capture.dispose();
  await vadChain;
  await new Promise((r) => setTimeout(r, 2500)); // 末尾の commit を待つ
  ws.close();

  // --- 要約: commit ごとに、その直前の「手元VADの喋り終わり（無音開始）」を基準に測る。
  //     ElevenLabs の VAD と手元 VAD は区切り方が違うため、手元の発話単位ではなく commit 単位で対応付ける。
  const commits = events.filter((e) => e.kind === "commit");
  const ends = utterances.filter((u) => u.endWall != null).map((u) => /** @type {number} */ (u.endWall));
  let prevCommitT = 0;
  const rows = commits.map((c, i) => {
    const end = ends.filter((e) => e > prevCommitT && e <= c.t).at(-1);
    const partials = events.filter((e) => e.kind === "partial" && e.t > prevCommitT && e.t <= c.t);
    const lastP = partials.at(-1);
    prevCommitT = c.t;
    return {
      commit: i + 1,
      commitAfterEndMs: end != null ? c.t - end : null,
      lastPartialAfterEndMs: end != null && lastP ? lastP.t - end : null,
      lastPartialEqualsCommit: lastP ? lastP.text === c.text : null,
      partials: partials.length,
      rewrites: partials.filter((p) => p.rewrite).length,
      text: c.text,
    };
  });
  const sorted = [...chunkGaps].sort((a, b) => a - b);
  const chunkGapMs = { median: sorted[Math.floor(sorted.length / 2)] ?? null, max: sorted.at(-1) ?? null, n: sorted.length };
  const summary = { strategy, vadSilence: values["vad-silence"] ?? null, localSilenceMs, bufferMs, chunkGapMs, rows };
  await writeFile(resolve(outDir, `${tag}.summary.json`), JSON.stringify(summary, null, 2));
  console.log(`
マイク取り込みのチャンク間隔: 中央値 ${chunkGapMs.median}ms / 最大 ${chunkGapMs.max}ms`);
  console.log("commit ごとの要約（直前の手元VADの喋り終わり基準、ms）:");
  console.table(rows.map(({ text, ...r }) => r));
  console.log(`log: ${logPath}`);
  await vad.dispose?.();
  process.exit(0);
}

/** @param {number} ms */
function fmt(ms) {
  return `${(ms / 1000).toFixed(2).padStart(6)}s`;
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
