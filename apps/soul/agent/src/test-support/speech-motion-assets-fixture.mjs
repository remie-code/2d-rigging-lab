import { connectChannel } from "../channel/channel-client.mjs";
import { decideSpeechIntentMotion } from "../mind/speech-intent-motion.mjs";

const [url, performanceId] = process.argv.slice(2);
const channel = await connectChannel(url);
const key = { generation: 1, sectionIndex: 0 };
let description;
const decision = await decideSpeechIntentMotion({
  intent: "任意の意図", text: "実際の発話", context: { transcript: "直前の会話" }
}, async ({ questions }) => {
  description = questions[0].choices.find(({ value }) => value === performanceId)?.description;
  return { answers: {
    speech_intent_performance: { type: "choice", choice: performanceId },
    speech_intent_attention: { type: "choice", choice: "game" }
  } };
}, channel.speechMotions);
await channel.sendMotion({ ...key, op: "begin" });
const { result, error } = await channel.sendMotion({ ...key, op: "play", performanceId, attentionTargetId: "game" });
const { result: speech } = await channel.openSpeech("external-motion-test");
process.send({ description, decision, result, error, speech });
