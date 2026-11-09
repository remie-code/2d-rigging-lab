import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { captureExperimentClip } from "./haas-experiment.mjs";
import { compareExperimentClip } from "./haas-experiment-replay.mjs";
import { readWavPcm } from "../src/voice/wav-pcm.mjs";

const frameSamples = 512;
const frameBytes = frameSamples * 2;

function fixture(probabilities) {
  const pcm = Buffer.alloc(probabilities.length * frameBytes);
  for (let frame = 0; frame < probabilities.length; frame += 1) {
    const sample = probabilities[frame] > 0.5 ? 2000 : 0;
    for (let i = 0; i < frameSamples; i += 1) pcm.writeInt16LE(sample, frame * frameBytes + i * 2);
  }
  let clock = 0;
  return {
    pcm,
    options: {
      preRollMs: 200,
      silencePadMs: 300,
      now: () => clock,
      wait: async (ms) => {
        const target = clock + ms;
        await nextTurn();
        clock = Math.max(clock, target);
      },
      vadFactory: () => ({
        init: async () => {},
        process: async (samples) => samples[0] > 0.01 ? 0.9 : 0.01,
        dispose: async () => {}
      })
    },
    advance: (ms) => { clock += ms; }
  };
}

test("fake microphone is bounded, preserves exact PCM across chunks and closes", async () => {
  const source = Buffer.alloc(32_009);
  source.writeInt16LE(830, 16);
  source.writeInt16LE(-125, 31_998);
  const events = [];
  const clip = await captureExperimentClip({
    device: "USB Mic",
    seconds: 1,
    onStart: () => events.push("cue"),
    captureFactory: ({ onPcm, device, maxRestarts }) => {
      assert.equal(device, "audio=USB Mic");
      assert.equal(maxRestarts, 0);
      queueMicrotask(() => {
        onPcm(source.subarray(0, 17));
        onPcm(source.subarray(17));
      });
      return { dispose: () => events.push("dispose") };
    }
  });
  assert.deepEqual(clip, source.subarray(0, 32_000));
  assert.deepEqual(events, ["cue", "dispose"]);
});

test("each engine sees identical audio and replay delay includes VAD waiting", async () => {
  const { pcm, options, advance } = fixture([
    ...Array(5).fill(0), ...Array(10).fill(1), ...Array(16).fill(0)
  ]);
  let zipInput;
  const trial = await compareExperimentClip(pcm, {
    ...options,
    zipformer: async (wav) => {
      zipInput = Buffer.from(wav);
      advance(60);
      return "うん";
    },
    haas: async (wav) => {
      assert.deepEqual(Buffer.from(wav), zipInput);
      const { pcm, sampleRate, channels } = readWavPcm(wav);
      assert.equal(sampleRate, 16_000);
      assert.equal(channels, 1);
      assert.ok(Buffer.from(pcm).subarray(0, 9600).equals(Buffer.alloc(9600)));
      advance(20);
      return "";
    }
  });
  assert.equal(trial.outcome, "one_segment");
  const [{ zipformer, haas }] = trial.segments;
  // Audio starts after 5 silent frames and ends exactly at the end of frame 15.
  const knownEndMs = 15 * frameSamples / 16;
  assert.equal(pcm.readInt16LE(knownEndMs * 32 - 2), 2000);
  assert.equal(pcm.readInt16LE(knownEndMs * 32), 0);
  assert.equal(zipformer.endEstimateMs, knownEndMs);
  assert.equal(haas.endEstimateMs, knownEndMs);
  assert.equal(zipformer.vadConfirmedMs, 928);
  assert.equal(haas.vadConfirmedMs, 928);
  assert.equal(zipformer.recognitionMs, 60);
  assert.equal(zipformer.replayEndEstimateToFinalMs, 508);
  assert.equal(haas.outcome, "empty");
  assert.equal(haas.recognitionMs, 20);
  assert.equal(haas.replayEndEstimateToFinalMs, 468);
  assert.equal(zipformer.exactSpeechEndToFinalMs, null);
  assert.equal(haas.exactSpeechEndToFinalMs, null);
});

test("no VAD segment and multiple segments differ from engine failure", async () => {
  const silence = fixture(Array(30).fill(0));
  const unexpected = async () => assert.fail("ASR should not receive a silent cue");
  const noSegment = await compareExperimentClip(silence.pcm, {
    ...silence.options, haas: unexpected, zipformer: unexpected
  });
  assert.deepEqual(noSegment, { outcome: "no_segment", cancelled: 0, unsettled: false, segments: [] });
  const multiple = fixture([...Array(10).fill(1), ...Array(15).fill(0), ...Array(10).fill(1), ...Array(15).fill(0)]);
  const result = await compareExperimentClip(multiple.pcm, {
    ...multiple.options,
    zipformer: async () => "聞こえた",
    haas: async () => { throw new Error("decoder exited"); }
  });
  assert.equal(result.outcome, "multiple_segments");
  assert.equal(result.segments.length, 2);
  assert.ok(result.segments.every(({ zipformer, haas }) =>
    zipformer.outcome === "text" && haas.outcome === "failed" && haas.text === null && haas.replayEndEstimateToFinalMs === null));
});
