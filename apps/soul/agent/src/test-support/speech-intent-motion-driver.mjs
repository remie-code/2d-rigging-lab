import { connectChannel } from "../channel/channel-client.mjs";
import { EXPRESSION_TABLE } from "../mind/expression-table.mjs";
import { createSpeechIntentMotion } from "../mind/speech-intent-motion.mjs";
import { createSpeechIntentNoneRecorder } from "../mind/speech-intent-none-recorder.mjs";
import { createFireOrchestrator } from "../mind/fire-orchestrator.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";

const [url, directory] = process.argv.slice(2);
let motion;
const channel = await connectChannel(url, {
  onTrace(event) {
    if (event === "channel.close") void motion?.retire();
  }
});
const decisions = new Map();
const decisionInputs = new Map();
const sections = new Map();
const active = new Map();
motion = createSpeechIntentMotion({
  channel,
  recordUnsupported: createSpeechIntentNoneRecorder({ directory }),
  judge: ({ input, questions }) => {
    const { promise, resolve, reject } = Promise.withResolvers();
    const parsed = JSON.parse(input);
    const key = parsed.intent.startsWith("<intent ") ? parsed.intent.slice(8, -1).trim() : parsed.intent;
    decisionInputs.set(key, { ...parsed, questions });
    decisions.set(key, (performance, attention) => {
      if (performance === "network") {
        reject(Object.assign(new Error("fixture network failure"), { kind: "network", latencyMs: 10 }));
        return;
      }
      const answer = (choice) => choice === "refusal" ? { type: "refusal" } : { type: "choice", choice };
      resolve({
        latencyMs: 10,
        answers: { [questions[0].name]: answer(performance), [questions[1].name]: answer(attention) }
      });
    });
    return promise;
  }
});

const buffer = createTranscriptBuffer();
buffer.append({ startMs: 0, endMs: 0, text: "合成入力の会話文脈", speaker: "you" });
const traceEvents = [];
let traceChanged = Promise.withResolvers();
async function nextTrace(event, fields = {}) {
  for (;;) {
    const match = traceEvents.findIndex((entry) => entry.event === event &&
      Object.entries(fields).every(([key, value]) => entry[key] === value));
    if (match !== -1) return traceEvents.splice(match, 1)[0];
    await traceChanged.promise;
  }
}
const spoken = [];
let playerListener = null;
let ask = null;
let fireResult = null;
const player = {
  onEvent(listener) {
    playerListener = listener;
    return () => { playerListener = null; };
  },
  open() {},
  write() {},
  end() {},
  stop() {}
};
const engine = {
  kind: "elevenlabs",
  onStatus() { return () => {}; },
  dispose() {},
  async *synthesize(text) {
    spoken.push(text);
    yield { type: "format", sampleRate: 24000, channels: 1 };
    yield { type: "audio", pcm: new Uint8Array(24000) };
    yield { type: "timeline", entries: [
      { timeMs: 0, vowel: "a", s: 0.7 }, { timeMs: 1400, vowel: "i", s: 0.6 }
    ] };
    yield { type: "end" };
  }
};
let askReady = Promise.withResolvers();
const session = {
  ask(content, callbacks) {
    const result = Promise.withResolvers();
    ask = { content, callbacks, result };
    askReady.resolve();
    return result.promise;
  }
};
const fire = createFireOrchestrator({
  getBuffer: () => buffer,
  session,
  channel,
  player,
  progressivePlayback: true,
  acquireFireResources: () => ({
    session, channel, player, engine, speechIntentMotion: motion, speechIntentScene: "fixture"
  }),
  onTrace(event) {
    traceEvents.push(event);
    traceChanged.resolve();
    traceChanged = Promise.withResolvers();
  },
  nowImpl: () => 0
});

const commands = {
  async fireStart() {
    askReady = Promise.withResolvers();
    fireResult = fire.fire();
    await askReady.promise;
    return ask.content;
  },
  async fireDelta({ text }) {
    ask.callbacks.onTextDelta(text);
    return spoken;
  },
  async fireReply({ replyText }) {
    ask.result.resolve({ replyText });
    return true;
  },
  async fireTrace({ event, fields }) {
    return nextTrace(event, fields);
  },
  async firePlayer({ type, id }) {
    playerListener?.({ type, id, atMs: 0 });
    return spoken;
  },
  async decisionInput({ intent }) {
    return decisionInputs.get(intent) ?? null;
  },
  async fireDecide({ intent, choice, attention = "partner" }) {
    decisions.get(intent)(choice, attention);
    return true;
  },
  async fireDone() {
    return fireResult;
  },
  async fireKill() {
    return fire.kill();
  },
  async fireRevive() {
    fire.revive();
    return true;
  },
  async fireInterrupt() {
    return fire.interrupt();
  },
  async prepare({ section }) {
    const decision = motion.prepare(section);
    sections.set(section.sectionId, { section, decision });
    return true;
  },
  async start({ id }) {
    const started = motion.start(sections.get(id).section);
    active.set(id, started);
    return started?.begin;
  },
  async result({ id }) {
    return active.get(id)?.playback;
  },
  async decide({ id, choice, attention = "partner" }) {
    const { section, decision } = sections.get(id);
    decisions.get(section.intent)(choice, attention);
    return decision;
  },
  async finalize({ id, text }) {
    return motion.finalize(sections.get(id).section, { text });
  },
  async finish({ id, interrupted }) {
    return motion.finish(sections.get(id).section, { interrupted });
  },
  async send({ request }) {
    return channel.sendMotion(request);
  },
  async expression() {
    return Promise.all(EXPRESSION_TABLE.smile.map((intent) => channel.sendEnvelope(intent)));
  },
  async mouth() {
    const utterance = "fixture-mouth";
    const open = await channel.openSpeech(utterance);
    const append = await channel.appendSpeech(utterance, [
      { timeMs: 0, vowel: "a", s: 0.7 },
      { timeMs: 650, vowel: "a", s: 0.7 },
      { timeMs: 1400, vowel: "i", s: 0.6 }
    ]);
    const end = await channel.endSpeech(utterance);
    return [open, append, end].map(({ result }) => result);
  },
  async close() {
    await channel.close();
    return true;
  }
};

process.on("message", async ({ command, input }) => {
  try {
    process.send({ result: await commands[command](input) });
  } catch (error) {
    process.send({ error: error.code ?? error.name });
  }
});
process.send({ result: "ready" });
