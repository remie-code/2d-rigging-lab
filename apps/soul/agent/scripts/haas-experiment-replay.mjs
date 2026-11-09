import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { EAR_DEFAULTS } from "../src/ears/ear-pipeline.mjs";
import { createPcmFramer, int16ToFloat32 } from "../src/ears/pcm-framing.mjs";
import { createPcmRingBuffer } from "../src/ears/pcm-ring-buffer.mjs";
import { createSileroVad } from "../src/ears/silero-vad.mjs";
import { createSpeechSegmenter, DEFAULT_FRAME_MS, DEFAULT_SEGMENTER_OPTIONS } from "../src/ears/speech-segmenter.mjs";
import { padWithSilence } from "../src/ears/local-stt/local-stt-engines.mjs";
import { encodeWav } from "../src/voice/wav-encode.mjs";

const sampleRate = EAR_DEFAULTS.sampleRate;
const round = (ms) => Math.round(ms * 10) / 10;

// The capture clock is not available during replay. Both passes use the same audio clock,
// starting at sample zero, with frames released at the end of their nominal interval.
export async function replayExperimentClip(pcm, {
  recognize, preRollMs, silencePadMs, signal, vadFactory = createSileroVad,
  now = () => performance.now(), wait = (ms) => sleep(ms, undefined, { signal })
}) {
  const frames = createPcmFramer().push(pcm);
  const vad = vadFactory();
  const ring = createPcmRingBuffer({ sampleRate, capacityMs: EAR_DEFAULTS.ringMs });
  const records = [];
  let cancelled = 0;
  let queued = Promise.resolve();
  const segmenter = createSpeechSegmenter({
    minSilenceMs: EAR_DEFAULTS.minSilenceMs,
    maxSpeechMs: EAR_DEFAULTS.maxSpeechMs
  });
  try {
    await vad.init();
    const origin = now();
    for (const frame of frames) {
      signal?.throwIfAborted();
      const frameStartMs = ring.totalMs();
      const remaining = origin + frameStartMs + DEFAULT_FRAME_MS - now();
      if (remaining > 0) await wait(remaining);
      ring.write(frame);
      const events = segmenter.push(await vad.process(int16ToFloat32(frame)), frameStartMs);
      for (const event of events) {
        if (event.type === "speechCancel") cancelled += 1;
        if (event.type !== "speechEnd") continue;
        const cut = ring.slice({ startMs: Math.max(0, event.startMs - preRollMs), endMs: event.endMs });
        const wav = encodeWav(padWithSilence(cut.samples, silencePadMs, sampleRate), { sampleRate, channels: 1, bitsPerSample: 16 });
        // The first low-probability frame marks an estimate, never the later VAD commit.
        // A forced cut does not tell us when speech actually ended.
        const endEstimateMs = event.reason === "silence" ? event.endMs - DEFAULT_SEGMENTER_OPTIONS.speechPadMs : null;
        const record = {
          startMs: event.startMs,
          endMs: event.endMs,
          reason: event.reason,
          inputSha256: createHash("sha256").update(wav).digest("hex"),
          endEstimateMs,
          vadConfirmedMs: round(now() - origin),
          outcome: "failed",
          text: null,
          recognitionMs: null,
          exactSpeechEndToFinalMs: null,
          replayEndEstimateToFinalMs: null
        };
        records.push(record);
        queued = queued.then(async () => {
          if (signal?.aborted) return;
          const submitted = now();
          try {
            const text = await recognize(wav);
            const finalAt = now();
            record.text = text;
            record.outcome = text ? "text" : "empty";
            record.recognitionMs = round(finalAt - submitted);
            if (endEstimateMs !== null) record.replayEndEstimateToFinalMs = round(finalAt - origin - endEstimateMs);
          } catch {
            // An engine failure is distinct from a successful, empty recognition.
          }
        });
      }
    }
    await queued;
    signal?.throwIfAborted();
    return { records, cancelled, unsettled: segmenter.isSpeaking() };
  } finally {
    await queued;
    await vad.dispose();
  }
}

export async function compareExperimentClip(pcm, { haas, zipformer, ...replayOptions }) {
  const baseline = await replayExperimentClip(pcm, { ...replayOptions, recognize: zipformer });
  const candidate = await replayExperimentClip(pcm, { ...replayOptions, recognize: haas });
  if (baseline.cancelled !== candidate.cancelled || baseline.unsettled !== candidate.unsettled ||
      baseline.records.length !== candidate.records.length ||
      baseline.records.some((record, index) => record.inputSha256 !== candidate.records[index].inputSha256 ||
        record.startMs !== candidate.records[index].startMs || record.endMs !== candidate.records[index].endMs ||
        record.endEstimateMs !== candidate.records[index].endEstimateMs ||
        record.reason !== candidate.records[index].reason)) {
    throw new Error("The two replay passes did not use identical VAD cuts and PCM");
  }
  const count = baseline.records.length;
  return {
    outcome: count === 0 ? "no_segment" : count === 1 ? "one_segment" : "multiple_segments",
    cancelled: baseline.cancelled,
    unsettled: baseline.unsettled,
    segments: baseline.records.map((record, index) => ({
      zipformer: record, haas: candidate.records[index]
    }))
  };
}
