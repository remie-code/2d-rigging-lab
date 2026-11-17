// @ts-check

/** @typedef {(options: object) => { ask: (content: string) => Promise<{ replyText: string }>; dispose: () => Promise<void> }} TaskSessionCreate */
/**
 * @typedef {{
 *   create: TaskSessionCreate;
 *   sessionOptions: object;
 *   content: string;
 *   timeout?: { ms: number; error: Error; set?: typeof setTimeout; clear?: typeof clearTimeout };
 * }} TaskSessionRequest
 */

/** @param {TaskSessionRequest} request @param {(error: unknown) => void} onCleanupFailure */
async function execute({ create, sessionOptions, content, timeout }, onCleanupFailure) {
  const session = create({ ...sessionOptions, finalAnswerOnly: true, ephemeral: true });
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  try {
    const reply = timeout
      ? await Promise.race([
        new Promise((_, reject) => {
          timer = (timeout.set ?? setTimeout)(() => reject(timeout.error), timeout.ms);
        }),
        Promise.resolve().then(() => session.ask(content))
      ])
      : await session.ask(content);
    return reply?.replyText;
  } finally {
    if (timer !== undefined) (timeout?.clear ?? clearTimeout)(timer);
    try {
      await session.dispose();
    } catch (error) {
      // Best effort, preserving the task's reply or execution error.
      onCleanupFailure(error);
    }
  }
}

/** One scope belongs to one venue generation. Conversation delivery is handled by the caller. */
export function createTaskSessionScope() {
  let open = true;
  /** @type {Set<Promise<unknown>>} */
  const active = new Set();
  /** @type {unknown[]} */
  const cleanupFailures = [];
  return {
    /** @param {TaskSessionRequest} request */
    async run(request) {
      if (!open) throw new Error("task session scope is closed");
      const task = Promise.resolve().then(() => execute(request, (error) => cleanupFailures.push(error)));
      active.add(task);
      try {
        return await task;
      } finally {
        active.delete(task);
      }
    },
    isOpen: () => open,
    stopAccepting() {
      open = false;
    },
    /** Wait for execution and disposal. Stop accepting first when closing the scope. */
    async waitForIdle() {
      while (active.size > 0) await Promise.allSettled(active);
    },
    /** Check after waiting for idle before releasing resources the workers used. */
    getCleanupFailures: () => [...cleanupFailures]
  };
}

/** @typedef {ReturnType<typeof createTaskSessionScope>} TaskSessionScope */
