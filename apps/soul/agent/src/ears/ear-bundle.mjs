// @ts-check
/**
 * 耳の束（Discord モード Domain B・discord-mode.md §4.3・棚卸し §9-4）。
 *
 * 人ごとの耳の集合を、場（cockpit-server）からは 1 つの耳に見える束にする。場が耳に使う口は寿命（start / dispose）と
 * 「誰かが今話しているか」（userSpeaking）だけ（会話の正本は Domain A で場に出た）なので、束はその口だけを持つ。
 *
 *  - add(key, ear): 耳を 1 本束ねる（key は束の中の名前。配信のマイクは "mic"、Discord は人ごと）。
 *  - remove(key): 1 本だけ束から外す（畳むのは外した側）。drop(key): 外して畳む。
 *  - vadMouth(key): その耳の VAD の口。話しているかを耳ごとに覚えてから、場の VAD の口（options.onVadEvent）へそのまま渡す
 *    （場は放送・割り込み・発火の予定を 1 本で受ける）。束から外れた耳の出来事も場へは渡す（話しているかは覚えない）。
 *  - userSpeaking(): どれか 1 本でも話していれば真。
 *  - start(): 束ねた耳を順に起こす。どれかが起きなければ、起きた分を畳んで束を空にし、その例外を投げ直す
 *    （起きなかった耳は耳の側が自分を畳む＝ear-pipeline の約束。ここでは畳まない）。
 *  - dispose(): 全部を畳む（冪等・1 本が投げても残りは畳む）。
 *
 * 会話の正本と耳ごとの口（cockpit-server の earTranscriptMouth）は束が持たない: 場が作った同じ正本と同じ耳ごとの口を
 * 各耳に渡せば、耳が N 本でも購読は N 重にならない（Domain A の約束）。
 *
 * @typedef {{ start?: () => (Promise<void> | void); dispose?: () => (Promise<void> | void) }} BundledEar
 */

/**
 * @param {{ onVadEvent?: (event: any, key: string) => void }} [options]
 */
export function createEarBundle(options = {}) {
  const forward = typeof options.onVadEvent === "function" ? options.onVadEvent : null;
  /** @type {Map<string, { ear: BundledEar; speaking: boolean }>} */
  const members = new Map();
  let disposed = false;

  /** @param {BundledEar} ear */
  const disposeEar = async (ear) => {
    try {
      await ear?.dispose?.();
    } catch {
      // best-effort（1 本が投げても残りは畳む）。
    }
  };

  return {
    /**
     * @template {BundledEar} T
     * @param {string} key  @param {T} ear  @returns {T}
     */
    add(key, ear) {
      if (disposed) throw new Error("ear bundle is disposed");
      if (typeof key !== "string" || key.length === 0) throw new TypeError("ear key must be a non-empty string");
      if (members.has(key)) throw new Error(`ear ${key} is already bundled`);
      members.set(key, { ear, speaking: false });
      return ear;
    },
    /** @param {string} key @returns {BundledEar | null} */
    remove(key) {
      const member = members.get(key);
      members.delete(key);
      return member ? member.ear : null;
    },
    /** @param {string} key */
    async drop(key) {
      const ear = this.remove(key);
      if (ear) await disposeEar(ear);
    },
    /** @param {string} key */
    has: (key) => members.has(key),
    keys: () => [...members.keys()],
    size: () => members.size,
    /**
     * @param {string} key
     * @returns {(event: any) => void}
     */
    vadMouth(key) {
      return (event) => {
        const member = members.get(key);
        if (member && event) {
          if (event.type === "speechStart") member.speaking = true;
          else if (event.type === "speechEnd" || event.type === "speechCancel") member.speaking = false;
        }
        if (forward) forward(event, key);
      };
    },
    /** どれか 1 本でも話しているか。 */
    userSpeaking() {
      for (const member of members.values()) if (member.speaking) return true;
      return false;
    },
    async start() {
      /** @type {BundledEar[]} */
      const started = [];
      for (const [key, member] of [...members]) {
        try {
          await member.ear?.start?.();
          started.push(member.ear);
        } catch (error) {
          // 起きなかった耳は自分で畳む約束。起きた分だけ畳み、束を空にして投げ直す。
          members.delete(key);
          const rest = [...members.values()].map((m) => m.ear);
          members.clear();
          for (const ear of started) await disposeEar(ear);
          for (const ear of rest) if (!started.includes(ear)) await disposeEar(ear);
          throw error;
        }
      }
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      const ears = [...members.values()].map((m) => m.ear);
      members.clear();
      for (const ear of ears) await disposeEar(ear);
    },
    isDisposed: () => disposed
  };
}
