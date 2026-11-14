/**
 * One Fire generation. Text offsets are UTF-16 indices in the recorded section.
 * Only matching player STARTED and ENDED can confirm a complete job.
 */
export function createSpeechIntentDelivery({ motion, sceneId, utteranceId, generation, context, trace, batch = false }) {
  const jobs = new Map();
  let section = null;
  let sectionIndex = 0;
  let accepting = true;
  let active = null;

  function prepare(state) {
    if (state.prepared || !accepting || !state.text.trim()) return;
    state.prepared = true;
    const text = state.text;
    void motion.prepare(state.id, { text, context }).then((decision) => {
      trace("intent.decision.completed", { generation, sectionIndex: state.id.sectionIndex, textChars: text.length, ...decision });
    });
  }

  function settle(state, interrupted = false) {
    if (state.finalized || !state.closed || state.pending !== 0) return;
    state.finalized = true;
    state.wake?.();
    void motion.finish(state.id, { interrupted });
    void motion.finalize(state.id, {
      text: state.text, audioPlayback: { ranges: state.ranges }
    }).then((result) => {
      trace("intent.recording.completed", {
        generation, sectionIndex: state.id.sectionIndex, kind: result?.kind ?? null, reason: result?.reason
      });
    });
  }

  function closeSection() {
    if (!section) return;
    if (batch) prepare(section);
    if (!section.prepared) {
      trace("intent.decision.skipped", {
        generation, sectionIndex: section.id.sectionIndex, reason: accepting ? "empty-text" : "interrupted"
      });
    }
    section.closed = true;
    settle(section, section.interrupted);
    section = null;
  }

  return {
    tag(intent, rawIntentTag) {
      if (!accepting) return;
      closeSection();
      if (intent === null || !motion.isActive()) return;
      const id = {
        sceneId, utteranceId, generation, sectionIndex, sectionId: `section-${sectionIndex++}`, intent, rawIntentTag
      };
      section = { id, text: "", ranges: [], pending: 0, activePlaybackId: null, closed: false, finalized: false };
      trace("intent.tag.ready", { generation, sectionIndex: id.sectionIndex });
    },
    text(text, index) {
      if (section) {
        const start = section.text.length;
        section.text += text;
        const range = { start, end: section.text.length, state: "not-enqueued" };
        section.ranges.push(range);
        if (index !== undefined) {
          section.pending += 1;
          jobs.set(index, { section, range });
          if (!batch) prepare(section);
        }
      } else if (index !== undefined) {
        jobs.set(index, null);
      }
    },
    started({ index, playbackId }) {
      if (!jobs.has(index)) return;
      const job = jobs.get(index);
      if (!job) {
        void motion.releaseCurrent();
        active = null;
        return;
      }
      const state = job.section;
      if (state.interrupted || !state.prepared) return;
      active = state;
      state.activePlaybackId = playbackId;
      state.wake?.();
      if (state.started) return;
      state.started = true;
      const result = motion.start(state.id, {
        async runWhenPlaying(play) {
          while (!state.activePlaybackId && !state.finalized && !state.interrupted) {
            await new Promise((resolve) => { state.wake = resolve; });
          }
          if (!state.activePlaybackId || state.interrupted) return { kind: "skipped" };
          trace("intent.motion.ready", { generation, sectionIndex: state.id.sectionIndex, playbackId: state.activePlaybackId });
          return play();
        }
      });
      void result?.playback.then((outcome) => {
        trace("intent.motion.reply", { generation, sectionIndex: state.id.sectionIndex, firstPlaybackId: playbackId, ...outcome });
      });
    },
    terminal({ index, playbackId, cause, started, ended, playerOpened }) {
      const job = jobs.get(index);
      jobs.delete(index);
      if (!job) return;
      const { section: state, range } = job;
      state.pending -= 1;
      if (state.activePlaybackId === playbackId) state.activePlaybackId = null;
      state.interrupted ||= cause !== "completed";
      Object.assign(range, {
        playbackId,
        cause,
        state: ended && started ? "completed" : started ? "started-incomplete" : playerOpened ? "unknown" : "not-started"
      });
      if (state.interrupted) {
        state.wake?.();
        void motion.finish(state.id, { interrupted: true });
      }
      settle(state, state.interrupted);
    },
    close() {
      closeSection();
      accepting = false;
    },
    endMessage: closeSection,
    retire() {
      motion.retireGeneration(generation);
    },
    interrupt() {
      accepting = false;
      if (active) {
        active.activePlaybackId = null;
        active.interrupted = true;
        active.wake?.();
      }
      void motion.releaseCurrent();
    }
  };
}
