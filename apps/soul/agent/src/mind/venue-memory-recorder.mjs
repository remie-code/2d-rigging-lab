import { BRAINS, isCodexBrainId } from "./brains.mjs";
import { isEventEntry } from "../ears/transcript-buffer.mjs";
import { hasWriterMaterials } from "./memory.mjs";

/**
 * 配信間記憶: 定期保存の間隔（裁定4「15〜30分ごと」の中庸・inventory §2-4 の 20 分固定）。
 * Discord モード Domain H（discord-mode.md §13.6・gate-2-midwrite-investigation.md §4 の案 B）: 「場の始まり、または
 * 前の保存（途中・手動の「今日を記録」）、またはこの場で前に途中保存を頼んだ時刻」からこの長さがたったときだけ頼む
 * （isMemoryCheckpointDue・createStreamVenueHooks の checkpoint）。
 */
export const MEMORY_CHECKPOINT_INTERVAL_MS = 20 * 60 * 1000;

/**
 * 配信間記憶: 定期保存を確かめる間隔（Discord モード Domain H・discord-mode.md §13.6）。タイマーは起動時に 1 回張る形の
 * まま、この間隔で checkpoint() を呼び、経過時間で頼むかを決める（場の口で張る・止めるを持たない＝漏れが無い）。
 * 頼むのは場の始まり・前の保存から 20 分（MEMORY_CHECKPOINT_INTERVAL_MS）たったときで、遅れはこの間隔まで。
 */
export const MEMORY_CHECKPOINT_TICK_MS = 60 * 1000;

/**
 * 配信間記憶: 定期保存を空回りさせない判定（inventory §2-4「転写が前回生成から変化しとらん時は
 * スキップ」）。転写件数（=seq・transcriptBuffer.all().length）が前回記録時から不変ならスキップする
 * （true=スキップ）。純関数（I/O ゼロ）——20 分ごとに同じ会話を②へ渡してトークンを燃やさない
 * 防波堤。手動「今日を記録」/ 耳の Stop / Ctrl+C はこの判定を経由しない（明示操作・最後の版は必ず試みる）。
 * @param {number} currentSeq  現在の転写件数。
 * @param {number} lastRecordedSeq  直近に記録が成立した時点の転写件数。
 * @returns {boolean}
 */
export function shouldSkipMemoryCheckpoint(currentSeq, lastRecordedSeq) {
  return currentSeq === lastRecordedSeq;
}

/**
 * 保存するかの数え方に入れる転写の件数（Discord モード Domain K・J の持ち越し 1 = Undine の判断 (1)）。出来事の行
 * （isEventEntry・入った / 抜けた / 人の出入りなど）は数えない: 誰も話していない通話（出来事の行だけ）で最後の保存・途中保存を
 * 走らせない。数えるのは保存の要否（行数・増えたか）だけで、②に渡す中身には出来事の行を載せたまま。配信には出来事の行が
 * 無いので、配信の数えは今と同じ（= 転写の件数）。純関数（I/O ゼロ）。
 * @param {ReadonlyArray<any> | null | undefined} entries
 * @returns {number}
 */
export function countSpokenEntries(entries) {
  if (!Array.isArray(entries)) return 0;
  let n = 0;
  for (const entry of entries) if (!isEventEntry(entry)) n += 1;
  return n;
}

/**
 * 配信間記憶: 途中保存の頃合いか（Discord モード Domain H・discord-mode.md §13.6・gate-2-midwrite-investigation.md §4 の
 * 案 B）。起点 = max(場の始まり, この場で前に保存が成り立った時刻, この場で前に途中保存を頼んだ時刻)（null は数えない）
 * から intervalMs 以上たっていれば true。起点が 1 つも無ければ false（場が始まっていない）。純関数（I/O ゼロ）。
 *  - 前の保存には途中保存・手動の「今日を記録」のどちらも入る（手動で保存すると起点が戻る）。
 *  - 前に頼んだ時刻も入れるのは、保存が失敗し続けたときに 1 分ごとに頼み直さないため（頼みの頻度を今の 20 分おきより
 *    増やさない）。
 * @param {number} nowMs
 * @param {{ startedAtMs: number | null; lastSavedAtMs: number | null; lastRequestedAtMs: number | null }} since
 * @param {number} [intervalMs=MEMORY_CHECKPOINT_INTERVAL_MS]
 * @returns {boolean}
 */
export function isMemoryCheckpointDue(nowMs, since, intervalMs = MEMORY_CHECKPOINT_INTERVAL_MS) {
  const marks = [since?.startedAtMs, since?.lastSavedAtMs, since?.lastRequestedAtMs].filter(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  if (marks.length === 0) return false;
  return nowMs - Math.max(.../** @type {number[]} */ (marks)) >= intervalMs;
}

/**
 * ②書き出し役・④思い出し役の頭（申し送り 1: Codex に固定）。今の頭が Codex 系ならその頭（①と同じ頭・
 * recall-flow.md §6）、Claude 系なら既定の Codex（Claude の頭は cwd / sandbox / finalAnswerOnly を黙って無視するため
 * 使わない）。④も同じ決め方（記憶の作り直し Wave 2 からの申し送り 1）。
 * @param {unknown} currentBrain
 * @param {Record<string, { create: Function }>} [brains=BRAINS]
 * @returns {{ id?: string; create: Function }}
 */
export function resolveWriterBrainDef(currentBrain, brains = BRAINS) {
  if (isCodexBrainId(currentBrain) && typeof currentBrain === "string" && brains[currentBrain]) {
    return brains[currentBrain];
  }
  return brains.codex;
}

/** @typedef {import("../cockpit/venue/task-resources.mjs").VenueWriterMaterials} WriterMaterials */
/** @typedef {{ entries: ReadonlyArray<any>; place: any; wording: any; writerBrain?: string; materials?: WriterMaterials; onUnconfirmedExit?: () => void }} MemoryRecordJob */

/**
 * 配信間記憶: 保存の係（定期・手動「今日を記録」・耳の Stop・Ctrl+C のどれもこれを通る）。
 *
 * **直列にする**（申し送り 3・記憶のフォルダの git の index.lock がぶつからないように）:
 *  - 何も走っていなければ、すぐ 1 回走らせる。
 *  - 走っている間に次の保存が来たら、1 件だけ待たせ、今のが終わってから 1 回だけ走らせる。待っている間に
 *    さらに来たら、待っている 1 件の材料を新しい方に差し替える（件数が減る差し替えはしない。耳の Stop の
 *    あとはライブの転写が空になるため、Stop のときに取った転写を後から来た空や短い転写で上書きしない）。
 *  - 材料（転写）は保存を頼んだ時点で取る（耳の Stop では pipeline を畳む前に取ったものが渡る）。
 *  - 空の転写は走らせない。
 *  - **置き場も保存を頼んだ時点で取る**（配信の組み直し Domain B・getPlace = その時点のロールの記憶のフォルダ）。
 *    走っている保存・待っている保存は、頼んだときのロールのフォルダに書く（あとでロールが替わっても、ほかの
 *    ロールのフォルダに書かない・stream-restructure.md §2.3）。待っている 1 件と置き場が違う頼みは差し替えずに
 *    後ろに並べる（置き場ごとに順に走らせる）。getPlace が無ければ今まで通り（置き場は undefined で 1 つ）。
 * 1 回の保存（writeImpl）の失敗は握って onError に渡す（どの呼び出し元も巻き込まない）。
 *
 * @param {object} deps
 * @param {() => ReadonlyArray<any>} deps.getLiveEntries  材料の省略時に使うライブの転写（cockpit-server の getTranscript）。
 * @param {(entries: ReadonlyArray<any>, place: any, wording: any, materials?: WriterMaterials, onUnconfirmedExit?: () => void, writerBrain?: string) => Promise<{ written: boolean; commit?: any; needsReview?: boolean }>} deps.writeImpl
 *   1 回の保存（本番は②書き出し役 writeStreamRecord + コミット）。place は頼んだ時点の getPlace() の値、wording は頼んだ時点の
 *   getWording() の値。
 * @param {() => string} [deps.getWriterBrain] 保存を頼んだ時点の有効モデル。
 * @param {() => any} [deps.getPlace]  保存を頼んだ時点の置き場（本番は今のロールの記憶のフォルダ・§createRoleMemoryPlaces）。
 *   同じ置き場には同じ値（=== で比べる）を返すこと。投げたら null。
 * @param {() => any} [deps.getWording]  保存を頼んだ時点の場の語の組（Discord モード Domain C・本番は cockpit-server の
 *   venueContext().wording）。writeImpl の 3 つ目の引数に渡る。null / 無し / 投げたら null（= 配信の語の組）。置き場は場ごとに
 *   作り直す（beginStream）ので、同じ置き場の頼みは同じ場の語の組（待っている 1 件を差し替えるときも新しい方の値にする）。
 * @param {(info: { atMs: number; entriesLength: number; spokenLength?: number; commit?: any; place?: any }) => void} [deps.onSaved]
 *   保存が成り立ったあと（main() 側がここで lastRecordAtMs / lastRecordedSeq を更新する）。place は getPlace があるとき
 *   だけ載る（その保存を頼んだ時点の置き場・配信の組み直し Domain D の場ごとの数え方）。spokenLength は出来事の行を除いた
 *   件数（Discord モード Domain K・countSpokenEntries。保存の要否はこちらで数える）。
 * @param {(error: unknown) => void} [deps.onError]
 * @param {(recording: boolean) => void} [deps.onRecordingChange]  走り始めと全部終わったとき（操縦席の「記録中」）。
 * @param {() => number} [deps.nowImpl=Date.now]
 * @returns {{
 *   record: (entriesOverride?: ReadonlyArray<any>, materials?: WriterMaterials, onUnconfirmedExit?: () => void) => Promise<void>;
 *   isRecording: () => boolean;
 *   whenIdle: () => Promise<void>;
 *   hasUnconfirmedWriter: (place: any) => boolean;
 * }}
 *   record の戻りは、その頼みを受け持った 1 回の保存が終わったら解決する（失敗しても reject しない）。
 */
export function createMemoryRecorder(deps) {
  const nowImpl = deps.nowImpl ?? Date.now;
  /** @type {Promise<void> | null} 走っている保存の一続き（待たせた分まで含む）。 */
  let chain = null;
  /** @type {Array<MemoryRecordJob & { promise: Promise<string>; resolve: (result: string) => void }>} 待っている保存（置き場ごと）。 */
  const waiting = [];
  /** @type {Set<string | undefined>} */
  const unconfirmedWriterDirs = new Set();
  /** @type {Set<string | undefined>} */
  const needsReviewDirs = new Set();

  const callSafely = (/** @type {Function | undefined} */ fn, /** @type {any} */ arg) => {
    if (typeof fn !== "function") return;
    try {
      fn(arg);
    } catch {
      // 通知先の失敗で保存の係を止めない。
    }
  };

  const placeNow = () => {
    if (typeof deps.getPlace !== "function") return undefined;
    try {
      return deps.getPlace();
    } catch {
      return null;
    }
  };

  const wordingNow = () => {
    if (typeof deps.getWording !== "function") return null;
    try {
      return deps.getWording() ?? null;
    } catch {
      return null;
    }
  };

  /** @param {MemoryRecordJob} job */
  const runOnce = async ({ entries, place, wording, writerBrain, materials, onUnconfirmedExit }) => {
    try {
      const writerDir = place?.dir;
      if (needsReviewDirs.has(writerDir)) return "needs-review";
      if (unconfirmedWriterDirs.has(writerDir)) {
        throw new Error("前の書き出し役の終了を確認できていません。");
      }
      const result = await deps.writeImpl(entries, place, wording, materials, () => {
        unconfirmedWriterDirs.add(writerDir);
        onUnconfirmedExit?.();
      }, writerBrain);
      if (result?.needsReview) {
        needsReviewDirs.add(writerDir);
        return "needs-review";
      }
      if (result && result.written) {
        // 置き場（getPlace があるときだけ）も渡す: main() が「頼んだ時点の場」の保存だけを数える（配信の組み直し Domain D）。
        callSafely(deps.onSaved, {
          atMs: nowImpl(),
          entriesLength: entries.length,
          // Discord モード Domain K: 保存の要否の数え（出来事の行を除いた件数・countSpokenEntries）。
          spokenLength: countSpokenEntries(entries),
          commit: result.commit,
          ...(place !== undefined ? { place } : {})
        });
      }
      if (result?.written && result.commit?.ok) return "saved";
      return result?.commit?.ok === false || result?.garbled && result.commit?.committed ? "needs-review" : "failed";
    } catch (error) {
      callSafely(deps.onError, error);
      return unconfirmedWriterDirs.has(place?.dir) ? "needs-review" : "failed";
    }
  };

  /** @param {MemoryRecordJob} job */
  const start = (job) => {
    /** @type {(result: string) => void} */
    let resolveOwn = () => {};
    /** @type {Promise<string>} */
    const own = new Promise((resolve) => { resolveOwn = resolve; });
    callSafely(deps.onRecordingChange, true);
    chain = (async () => {
      try {
        resolveOwn(await runOnce(job));
        while (waiting.length > 0) {
          const next = /** @type {(typeof waiting)[number]} */ (waiting.shift());
          next.resolve(await runOnce(next));
        }
      } finally {
        resolveOwn("failed");
        chain = null;
        callSafely(deps.onRecordingChange, false);
      }
    })();
    return own;
  };

  return {
    record(entriesOverride, materials, onUnconfirmedExit) {
      const entries = entriesOverride ?? deps.getLiveEntries();
      if (!Array.isArray(entries) || (entries.length === 0 && !hasWriterMaterials(materials))) return Promise.resolve("not-needed");
      const place = placeNow();
      const wording = wordingNow();
      const writerBrain = deps.getWriterBrain?.();
      const job = { entries, place, wording, writerBrain, materials, onUnconfirmedExit };
      if (!chain) return start(job);
      const last = waiting[waiting.length - 1];
      if (last && last.place === place && last.writerBrain === writerBrain) {
        if (entries.length >= last.entries.length) {
          last.entries = entries;
          last.wording = wording;
        }
        if (materials) last.materials = materials;
        if (onUnconfirmedExit) last.onUnconfirmedExit = onUnconfirmedExit;
        return last.promise;
      }
      /** @type {(result: string) => void} */
      let resolve = () => {};
      /** @type {Promise<string>} */
      const promise = new Promise((r) => { resolve = r; });
      waiting.push({ ...job, promise, resolve });
      return promise;
    },
    isRecording: () => chain != null,
    whenIdle: () => chain ?? Promise.resolve(),
    hasUnconfirmedWriter: (place) => unconfirmedWriterDirs.has(place?.dir)
  };
}
