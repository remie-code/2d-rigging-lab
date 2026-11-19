/**
 * Runs viewer-comment guard checks concurrently and delivers decisions in arrival order.
 * Clearing pending entries drops their results without resetting the fallback ID sequence.
 */
export function createCommentIntake({ judge, getSoulName, now, isClosed, onDecision, onError }) {
  let pending = [];
  let fallbackId = 0;

  function settle(slot, result) {
    if (isClosed()) return;
    const pass = result?.pass === true;
    slot.decision = {
      pass,
      kind: pass ? "ok" : typeof result?.kind === "string" && result.kind !== "ok" ? result.kind : "error",
      verdict: typeof result?.verdict === "string" ? result.verdict : null,
      hijackProbability: typeof result?.hijackProbability === "number" ? result.hijackProbability : null,
      latencyMs: typeof result?.latencyMs === "number" ? result.latencyMs : null,
      error: typeof result?.error === "string" ? redactComment(result.error, slot.text) : null
    };
    while (pending.length > 0 && pending[0].decision != null) {
      const head = pending.shift();
      try {
        onDecision(head);
      } catch (error) {
        onError(error);
      }
    }
  }

  function submit(message, text, displayName) {
    const id =
      typeof message?.messageId === "string" && message.messageId.length > 0 ? message.messageId : `local-${++fallbackId}`;
    const slot = { id, text, displayName, arrivedAtMs: now(), decision: null };
    pending.push(slot);
    let result;
    try {
      result = judge({ text, displayName: displayName ?? null, name: getSoulName() });
    } catch (error) {
      result = judgeError(error);
    }
    // An injected synchronous judge still commits before the ingest call returns.
    if (result != null && typeof result.then === "function") {
      Promise.resolve(result).then(
        (decision) => settle(slot, decision),
        (error) => settle(slot, judgeError(error))
      );
    } else {
      settle(slot, result);
    }
  }

  return {
    submit,
    clear() {
      pending = [];
    },
    hasPending() {
      return pending.length > 0;
    }
  };
}

function judgeError(error) {
  return { pass: false, kind: "error", error: error instanceof Error ? error.message : String(error), latencyMs: null };
}

function redactComment(reason, text) {
  const comment = String(text).trim();
  return comment.length > 0 && reason.includes(comment) ? "理由は伏せた（本文を含むため）" : reason;
}
