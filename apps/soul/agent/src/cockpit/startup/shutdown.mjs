

/**
 * Ctrl+C と EOF は通常の閉場を待つ。閉場中の Ctrl+C はプロセス全体の終了を要求する。
 * @param {object} deps
 * @param {(line: string) => void} deps.write
 * @param {() => void} [deps.beforeClose]
 * @param {{ streamStatus: () => { phase: string }; endStream: () => Promise<any>; close: () => Promise<void>; getVenueTaskResourcePath?: () => string|null }} deps.server
 * @param {{ waitForRunningSaves: () => Promise<void> }} deps.venue
 * @param {() => Promise<void>} deps.disposeRest
 * @param {() => Promise<void>} deps.finalize
 * @param {() => void} deps.forceExit
 */
export function createCockpitShutdown(deps) {
  let closing = false;
  return async function shutdown(signal = "SIGINT") {
    if (closing) {
      if (signal === "SIGINT") {
        const path = deps.server.getVenueTaskResourcePath?.();
        deps.write(`[cockpit] 強制終了します。${path ? `保持する作業領域: ${path}` : "閉場途中の作業領域は保持します。"}\n`);
        deps.forceExit();
      }
      return;
    }
    closing = true;
    deps.write("\n[cockpit] closing…\n");
    try {
      try {
        deps.beforeClose?.();
      } catch {
        // best-effort
      }
      const ended = deps.server.streamStatus().phase !== "closed";
      if (ended) {
        deps.write("[cockpit] 場を終えます（記録してから畳みます・Ctrl+C で強制終了）。\n");
        const state = await deps.server.endStream();
        if (state?.stream?.error) deps.write(`[cockpit] WARN: ${state.stream.error}\n`);
      }
      await deps.server.close();
      if (!ended) await deps.venue.waitForRunningSaves();
      await deps.disposeRest();
    } finally {
      await deps.finalize();
    }
  };
}
