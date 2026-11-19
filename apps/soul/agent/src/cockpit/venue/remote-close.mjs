/**
 * A remote close retains completed stages between commands. The ordinary
 * venue lifecycle still owns the phase, while this runner owns the receipt
 * and whether a stage can be retried.
 */
export function createRemoteVenueClose({
  broadcastState, closeFailedEntrance, copyTranscript, currentRecallDesk,
  drainVenueTasks, errMessage, foldVenue, hasFailedOpening, parkRecallDesk, releaseVenueTasks,
  remoteVenue, saveRecording, stopAcceptingTasks, venueLifecycle, venueRoleList
}) {
  let remoteFinishing = false;
  let remoteCloseRunning = false;
  /** @type {null | {steps: Array<[string, () => Promise<void>]>; recording: string | null; organising: string | null; blocked: boolean}} */
  let remoteClose = null;
  /** @type {string | null} */
  let remoteCloseError = null;

  /** Normal folding and save hooks, with each successful step retained for a retry. */
  async function finishRemoteVenue() {
    if (remoteCloseRunning || remoteFinishing) return;
    remoteCloseRunning = true;
    remoteCloseError = null;
    try {
      if (venueLifecycle.phase === "open") {
        const transcript = copyTranscript();
        const desk = currentRecallDesk();
        venueLifecycle.markClosing();
        stopAcceptingTasks();
        parkRecallDesk(true);
        const state = /** @type {NonNullable<typeof remoteClose>} */ ({
          steps: [], recording: null, organising: null, blocked: false
        });
        remoteClose = state;
        state.steps.push(
          ["退出", foldVenue],
          ["進行中の小タスク", () => drainVenueTasks(desk)],
          ["記憶の保存・整理", async () => {
            for (const role of venueRoleList()) {
              const result = await saveRecording(role, transcript, { recording: state.recording, organising: state.organising });
              state.recording = result?.recording ?? null;
              state.organising = result?.organising ?? null;
              if (state.recording === "needs-review" || state.organising === "needs-review") state.blocked = true;
              if (!["saved", "not-needed"].includes(state.recording ?? "") ||
                  !["organised", "not-due"].includes(state.organising ?? "")) {
                throw new Error(`記憶: ${state.recording ?? "未確認"} / 整理: ${state.organising ?? "未確認"}`);
              }
            }
          }],
          ["資料の解放", async () => {
            try {
              await releaseVenueTasks();
            } catch (error) {
              state.blocked = true;
              throw error;
            }
          }]
        );
        broadcastState();
      }
      if (!remoteClose && hasFailedOpening()) await closeFailedEntrance();
      if (remoteClose) {
        while (remoteClose.steps.length > 0) {
          const [label, step] = remoteClose.steps[0];
          try {
            await step();
          } catch (error) {
            throw new Error(`${label}で停止: ${errMessage(error)}`);
          }
          remoteClose.steps.shift();
        }
        venueLifecycle.markClosed();
      }
      remoteFinishing = true;
    } catch (error) {
      remoteCloseError = errMessage(error);
    } finally {
      remoteCloseRunning = false;
    }
    if (remoteFinishing) {
      await remoteVenue.finish({
        recording: remoteClose?.recording ?? "not-needed",
        organising: remoteClose?.organising ?? "not-needed"
      });
    }
  }

  return {
    get finishing() { return remoteFinishing; },
    get running() { return remoteCloseRunning; },
    get blocked() { return remoteClose?.blocked; },
    get error() { return remoteCloseError; },
    finishRemoteVenue,
    failProcessExit() {
      remoteFinishing = false;
      remoteCloseError = "Cockpit の終了処理に失敗しました";
      if (remoteClose) remoteClose.blocked = true;
    }
  };
}
