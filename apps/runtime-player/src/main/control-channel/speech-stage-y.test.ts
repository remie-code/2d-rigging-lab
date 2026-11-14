import { describe, expect, it } from "vitest";
import { parseSpeechMotionRequest, SpeechMotionState } from "./speech-motion-state";

function fixture() {
  const motion = new SpeechMotionState();
  function send(op: string, now: number, input = {}, generation = 1, sectionIndex = 0, owner = 1) {
    const request = parseSpeechMotionRequest({ op, generation, sectionIndex, ...input });
    if (!request) throw new Error("Invalid motion fixture");
    motion.apply(request, owner, now);
  }
  return { motion, send };
}

describe("speech Stage Y", () => {
  it.each([
    { op: "play" },
    { op: "play", stageY: [] },
    { op: "play", stageY: [[1, 0]] },
    { op: "play", stageY: [[0, 0], [0, 100]] },
    { op: "play", stageY: [[0, 0], [2, 10], [1, 20]] },
    { op: "play", stageY: [[0, 0], [1.5, 100]] },
    { op: "play", stageY: [[0, 0], [10001, 0]] },
    { op: "play", stageY: [[0, -201]] },
    { op: "play", stageY: [[0, Infinity]] },
    { op: "play", stageY: [[0, "10"]] },
    { op: "play", stageY: [[0, 10, 0]] },
    { op: "play", stageY: Array.from({ length: 65 }, (_, time) => [time, 0]) },
    { op: "play", presetId: "receive", stageY: null },
    { op: "play", presetId: "invalid", stageY: [[0, 10]] },
    { op: "begin", stageY: [[0, 10]] },
    { op: "end", stageY: [[0, 10]] },
    { op: "cancel", stageY: [[0, 10]] }
  ])("rejects invalid input %#", (input) => {
    expect(parseSpeechMotionRequest({ generation: 1, sectionIndex: 0, ...input })).toBeNull();
  });

  it("enters on the shared 180ms timeline and naturally releases a nonzero endpoint", () => {
    const { motion, send } = fixture();
    send("begin", 0);
    send("play", 100, { stageY: [[0, -200], [10000, 200]] });
    expect(motion.sampleStageY(100)).toBe(0);
    expect(motion.sampleStageY(190)).toBe(-100);
    expect(motion.sampleStageY(280)).toBe(-200);
    expect(motion.sampleStageY(5280)).toBe(0);
    expect(motion.sampleStageY(10280)).toBe(200);
    expect(motion.sampleStageY(10480)).toBe(100);
    expect(motion.sampleStageY(10680)).toBe(0);
    expect(motion.sampleModelParameters(10680, {})).toEqual({});
  });

  it.each(["end", "cancel", "next section", "next generation", "disconnect", "kill"])(
    "releases continuously on %s and ignores the superseded play",
    (event) => {
      const { motion, send } = fixture();
      const play = { stageY: [[0, 80], [1000, 80]] };
      send("begin", 0);
      send("play", 0, play);
      if (event === "next section") send("begin", 180, {}, 1, 1);
      else if (event === "next generation") send("begin", 180, {}, 2);
      else if (event === "disconnect") motion.disconnect(180, 1);
      else if (event === "kill") motion.disconnect(180);
      else send(event, 180);

      expect(motion.sampleStageY(180)).toBe(80);
      send("begin", 200);
      send("play", 200, play);
      expect(motion.sampleStageY(380)).toBe(40);
      expect(motion.sampleStageY(580)).toBe(0);
    }
  );

  it("re-enters from the latest Y after reconnect and rejects old owners", () => {
    const { motion, send } = fixture();
    send("begin", 0);
    send("play", 0, { stageY: [[0, 100], [1000, 100]] });
    motion.disconnect(180, 1);
    send("begin", 380, {}, 0, 0, 2);
    send("play", 380, { stageY: [[0, -100], [1000, -100]] }, 0, 0, 2);
    expect(motion.sampleStageY(380)).toBe(50);
    send("begin", 400, {}, 5, 5, 1);
    send("cancel", 400);
    motion.disconnect(400, 1);
    expect(motion.sampleStageY(470)).toBe(-25);
    expect(motion.sampleStageY(560)).toBe(-100);
    motion.clear();
    expect(motion.sampleStageY(560)).toBe(0);
  });

  it("keeps the natural release deadline when end arrives before the next sample", () => {
    const { motion, send } = fixture();
    send("begin", 0);
    send("play", 0, { stageY: [[0, 80]] });
    send("end", 380);
    expect(motion.sampleStageY(380)).toBe(40);
    expect(motion.sampleStageY(580)).toBe(0);
  });
});
