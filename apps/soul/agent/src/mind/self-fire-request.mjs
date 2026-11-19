import { buildCommentReactFireInstruction } from "./comment-react.mjs";

export function scheduledFireOptions(kind) {
  // Silence requires a view. Other scheduled fires can continue without an image.
  return {
    vision: kind === "silence" ? true : "preferred",
    cause: { type: typeof kind === "string" ? kind : "unknown" }
  };
}

export function speakNowFireOptions({ choice, probability, trigger, triggerSeq, latencyMs }, questions) {
  const options = {
    vision: "preferred",
    cause: {
      type: "speak-now",
      choice,
      probability: probability ?? null,
      trigger: trigger ?? null,
      triggerSeq: triggerSeq ?? null,
      judgeLatencyMs: latencyMs ?? null
    }
  };
  if (choice === "backchannel") options.instruction = questions.backchannelInstruction;
  return options;
}

export function commentReactionFireOptions({ comments, probabilities, latencyMs }, soulName) {
  return {
    vision: "preferred",
    instruction: buildCommentReactFireInstruction(comments, soulName),
    cause: {
      type: "comment-react",
      commentIds: comments.map((comment) => comment.id),
      commentSeqs: comments.map((comment) => (typeof comment.seq === "number" ? comment.seq : null)),
      probabilities: Array.isArray(probabilities) ? probabilities : comments.map(() => null),
      judgeLatencyMs: typeof latencyMs === "number" ? latencyMs : null
    }
  };
}
