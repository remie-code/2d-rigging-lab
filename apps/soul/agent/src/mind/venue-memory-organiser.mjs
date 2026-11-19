import { readMemoryHead } from "../memory/memory-store.mjs";
import { checkOrganiseDue, startMemoryOrganiser, DEFAULT_MEMORY_BACKUP_ROOT } from "./memory-organizer.mjs";

/**
 * ③整理役の控えの置き場の根（記憶の整理 Domain C・organization.md §6「控え」）。本番は `apps/soul/agent/memory-backups/`
 * （DEFAULT_MEMORY_BACKUP_ROOT・.gitignore 済み）。整理の係には main() がこれを明示して渡す（係は既定値を持たない）。
 */
export const MEMORY_BACKUP_ROOT = DEFAULT_MEMORY_BACKUP_ROOT;

/** 閉じの書き出し（②）が上限を過ぎてもまだ走っていて、整理を見送ったときの 1 行（中身なし・記憶の整理 Domain C）。 */
export const ORGANISER_WRITER_BUSY_WARNING = "memory: organising skipped: the writer is still saving";

/** 整理の係を始められなかった（引数の誤りなど・想定外）ときの 1 行（中身なし）。 */
export const ORGANISER_START_FAILED_WARNING = "memory: organising skipped: could not start the organiser";

/**
 * ③整理役の係（記憶の整理 Domain C・organization.md §5「きっかけ」・§7「閉じの流れ」）。場を閉じる道
 * （createStreamVenueHooks の saveFinal・配信を終える / 通話を終える / Ctrl+C の終える）が、閉じの書き出し（②）のあとに
 * organiseIfDue(place) を呼ぶ。置き場（createRoleMemoryPlaces の place = ロールの id と記憶のフォルダ）ごとに別の整理を
 * 走らせる（場にいるロールごとに saveFinal が呼ばれ、それぞれのロールの置き場を整理する）。
 *
 * organiseIfDue(place, { writerBusy }) の順:
 *  1. 止めた（stop() = Ctrl+C）あとは何もしない（何も出さない）。置き場が無い（記憶の引っ越しの失敗）も何もしない。
 *  2. 記憶のフォルダに git の先頭が無い（`.git` が無い・まだ 1 つもコミットが無い・git が読めない）なら何もしない（何も
 *     出さない・控えの置き場も作らない）。準備の失敗は起動・場の始まりで警告済みで、②の保存のたびにも出る。
 *  3. 整理の時期か（checkOrganiseDue）。時期でなければ何もしない（何も出さない = 今の閉じと同じ）。履歴が読めなければ
 *     B の固定の 1 行（onWarning）だけ。
 *  4. 書き出し役（②）がまだ記憶を使用している可能性があれば（writerBusy）、整理は見送る。
 *     ③は始めにコミットされていない変更を捨て、git を使うので、同じフォルダで②と同時に走らせない。
 *  5. 走らせる（startMemoryOrganiser・頭は書き出し役と同じ決め方 getCreate・控えの置き場は backupRoot）。始まりで 1 行
 *     （`memory: organising (role <id>)`）、終わるまで上限なしで待つ（③の頼みにも待つ上限は無い・止めるのは stop() の
 *     打ち切りだけ・記憶の整理 Domain D）。走っている間は
 *     onRunningChange(true)（snapshot の stream.organising）。
 *  6. 終わりの 1 行: コミットしたら `memory: organised (commit <短いハッシュ>)`（変更なしの空のコミットは
 *     `memory: organised (no changes, commit <短いハッシュ>)`）。走らなかった・取り消した（skipped）ときは B が onWarning で
 *     出す固定の 1 行がその回の 1 行（ここでは重ねて出さない・打ち切りの `memory: organiser stopped; nothing committed` も）。
 * stop(): 止める（Ctrl+C）。これからの整理を始めず、走っている整理はすぐ打ち切る（B の abort・セッションを閉じて変更を
 * 捨てる・時刻は進めない）。打ち切った整理の終わりは organiseIfDue の呼び出し側（閉じの道）が待つ（すぐ終わる）。
 * どの失敗も throw しない（閉じの道を止めない）。
 *
 * @param {object} deps
 * @param {() => Function} deps.getCreate  ③の頭の create（本番は resolveWriterBrainDef(currentBrain).create・書き出し役と同じ）。
 * @param {string} deps.backupRoot  控えの置き場の根（絶対パス・本番は MEMORY_BACKUP_ROOT）。
 * @param {(line: string) => void} [deps.onLine]  始まりと終わりの 1 行（本番は標準出力）。
 * @param {(line: string) => void} [deps.onWarning]  B の警告と、見送りの 1 行（本番は onBrainWarning = 標準エラー）。
 * @param {(running: boolean) => void} [deps.onRunningChange]  走り始めと全部終わったとき（本番は server.setMemoryOrganising）。
 * @param {() => Date} [deps.now]
 * @param {typeof readMemoryHead} [deps.headImpl]
 * @param {typeof checkOrganiseDue} [deps.checkDueImpl]
 * @param {typeof startMemoryOrganiser} [deps.startImpl]
 * @returns {MemoryOrganiserRunner}
 */
export function createMemoryOrganiserRunner(deps) {
  const headImpl = deps.headImpl ?? readMemoryHead;
  const checkDueImpl = deps.checkDueImpl ?? checkOrganiseDue;
  const startImpl = deps.startImpl ?? startMemoryOrganiser;
  let stopped = false;
  /** @type {Map<string, { abort: () => Promise<any> }>} 走っている整理（記憶のフォルダごと）。 */
  const running = new Map();
  const call = (/** @type {Function | undefined} */ fn, /** @type {any} */ arg) => {
    if (typeof fn !== "function") return;
    try {
      fn(arg);
    } catch {
      // 知らせ先の失敗で閉じの道を止めない。
    }
  };
  const warn = (/** @type {string} */ line) => call(deps.onWarning, line);
  const setRunning = (/** @type {string} */ dir, /** @type {{ abort: () => Promise<any> } | null} */ handle) => {
    const before = running.size > 0;
    if (handle) running.set(dir, handle);
    else running.delete(dir);
    const after = running.size > 0;
    if (before !== after) call(deps.onRunningChange, after);
  };

  return {
    async organiseIfDue(place, options = {}) {
      if (stopped) return "stopped";
      if (!place || typeof place.dir !== "string" || typeof place.roleId !== "string") return "unavailable";
      const { dir, roleId } = place;
      try {
        await place.ready;
      } catch {
        // 準備の失敗は起動・場の始まりで知らせ済み（下の先頭の確かめで止まる）。
      }
      /** @type {any} */
      let head;
      try {
        head = await headImpl({ dir });
      } catch {
        head = null;
      }
      if (!head || !head.ok || typeof head.head !== "string") return "not-prepared";
      /** @type {any} */
      let due;
      try {
        due = await checkDueImpl({ dir, ...(deps.now ? { now: deps.now } : {}), onWarning: warn });
      } catch {
        due = null;
      }
      if ((!due || due.reason === "unreadable") && options.strict) return "due-check-failed";
      if (!due || due.due !== true) return "not-due";
      if (stopped) return "stopped";
      if (typeof options.writerBusy === "function" && options.writerBusy()) {
        warn(ORGANISER_WRITER_BUSY_WARNING);
        return "writer-busy";
      }
      /** @type {{ done: Promise<any>; abort: () => Promise<any> }} */
      let handle;
      try {
        handle = startImpl({
          create: /** @type {any} */ (deps.getCreate()),
          dir,
          backupRoot: deps.backupRoot,
          roleId,
          onWarning: warn,
          ...(deps.now ? { now: deps.now } : {})
        });
      } catch {
        warn(ORGANISER_START_FAILED_WARNING);
        return "start-failed";
      }
      setRunning(dir, handle);
      call(deps.onLine, `memory: organising (role ${roleId})`);
      /** @type {any} */
      let result;
      try {
        result = await handle.done;
      } catch {
        result = null;
      } finally {
        setRunning(dir, null);
      }
      if (result && result.status === "organised") {
        const short = String(result.commit).slice(0, 7);
        call(deps.onLine, result.changed === false ? `memory: organised (no changes, commit ${short})` : `memory: organised (commit ${short})`);
        return "organised";
      }
      // skipped は B が理由の 1 行を onWarning で出し済み（重ねない）。done が想定外に投げたときだけここで 1 行。
      if (!result || result.status !== "skipped") warn(ORGANISER_START_FAILED_WARNING);
      if (options.strict && (!result || result.cleanupFailed === true)) return "needs-review";
      return "skipped";
    },
    stop() {
      stopped = true;
      for (const handle of running.values()) {
        try {
          void Promise.resolve(handle.abort()).catch(() => {});
        } catch {
          // best-effort
        }
      }
    },
    isRunning: () => running.size > 0
  };
}

/**
 * @typedef {{
 *   organiseIfDue: (place: { roleId: string; dir: string; ready?: Promise<void> } | null | undefined, options?: { writerBusy?: () => boolean; strict?: boolean }) =>
 *     Promise<"stopped" | "unavailable" | "not-prepared" | "not-due" | "writer-busy" | "start-failed" | "organised" | "skipped">;
 *   stop: () => void;
 *   isRunning: () => boolean;
 * }} MemoryOrganiserRunner
 */
