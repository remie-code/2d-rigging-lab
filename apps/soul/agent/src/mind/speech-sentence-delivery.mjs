import { createSpeechSentenceMotionInput, decideSpeechSentenceMotion } from "./speech-sentence-motion.mjs";

/** Track the decision and actual Player events for each sentence job in a reply. */
export function createSpeechSentenceDelivery({ motion, sceneId, utteranceId, generation, context, isVenueActive, trace }) {
  const buildInput = createSpeechSentenceMotionInput(context);
  const jobs = new Map();
  let interrupted = false;
  return {
    text(text, index) {
      if (interrupted) return;
      const input = buildInput(text);
      const section = { kind: "sentence", sceneId, utteranceId, generation,
        sectionId: `sentence-${index}`, sectionIndex: index };
      jobs.set(index, { section, text, started: null });
      void motion.prepare(section, { text, input, decide: decideSpeechSentenceMotion }).then((decision) => {
        trace("intent.decision.completed", { generation, sectionIndex: index, textChars: text.length, ...decision });
      });
    },
    started(info) {
      const job = jobs.get(info.index);
      if (!job || interrupted) return;
      job.started = info;
      const result = motion.start(job.section, { isVenueActive });
      void result?.playback.then((outcome) => {
        trace("intent.motion.reply", { generation, sectionIndex: info.index, playbackId: info.playbackId, ...outcome });
      });
    },
    terminal({ index, playbackId, cause, started, ended, playerOpened }) {
      const job = jobs.get(index);
      if (!job) return;
      jobs.delete(index);
      const aborted = interrupted || cause !== "completed";
      const observedStart = started && job.started?.playbackId === playbackId;
      const state = observedStart && ended ? "completed"
        : observedStart ? "started-incomplete" : playerOpened ? "unknown" : "not-started";
      void motion.finish(job.section, { interrupted: aborted });
      void motion.finalize(job.section, {
        text: job.text,
        audioPlayback: { ranges: [{ start: 0, end: job.text.length, playbackId, cause, state,
          ...(observedStart ? { startedAtMs: job.started.atMs } : {}) }] },
        interrupted: aborted
      }).then((result) => {
        trace("intent.recording.completed", { generation, sectionIndex: index,
          kind: result?.kind ?? null, reason: result?.reason });
      });
    },
    retire() {
      motion.retireGeneration(generation);
    },
    interrupt() {
      interrupted = true;
      void motion.releaseCurrent();
    }
  };
}
