import { createStreamRecordLog } from "../mind/memory.mjs";
import { memoryDirForRole, prepareMemoryFolder } from "./memory-store.mjs";

/**
 * @typedef {object} RoleMemoryPlace
 * @property {string} roleId  この置き場のロール。
 * @property {string} dir  ロールの記憶のフォルダ（`memories/<role-id>/`・②④の作業フォルダ）。
 * @property {Promise<void>} ready  準備（git init・ローカル設定・`_conventions.md` の種）が終わったら解決する（失敗しても reject しない）。
 * @property {import("../mind/memory.mjs").StreamRecordLog} streamRecord  このロールのこの場の保存の持ち回り（場の日付と、
 *   この場の②のコミットで足された・変わった本体のファイル・createStreamRecordLog・記憶の整理 Domain A）。
 * @property {number} streamNo  この置き場を作った場の番号（beginStream のたびに 1 つ進む・まだ場が無ければ 0）。
 */

/**
 * 記憶の置き場を今のロールに付いていかせる（配信の組み直し Domain B・stream-restructure.md §2.3）。
 *
 *  - place(): 今のロールの置き場を返す。ロールごとに 1 回だけ作って持ち回る（同じロールなら同じ値）。作るときに
 *    そのロールのフォルダの準備（prepareMemoryFolder・`_conventions.md` が無ければ種の「チャッピー」をロールの呼び名に
 *    差し替えて書く）を始め、この場の保存の持ち回り（createStreamRecordLog・場の始まりの日付と、この場で書いた本体の
 *    ファイル）を作る。同じ場の中でロールを戻したときは前に作った置き場（同じ持ち回り）を使う。
 *  - beginStream(startedAtMs): 配信の組み直し Domain D。場の始まりで置き場を作り直す（作った置き場を捨て、場の番号を
 *    進め、次の place() でそのときのロールの置き場を新しい持ち回りで作る・準備もそこでもう一度走らせる =
 *    冪等）。場の始まりで place() を呼び、その ready を待てば「場の始まりでそのロールの置き場が用意されている」。
 *  - available が false（記憶の引っ越しが失敗した起動）のときは、どのロールのフォルダも準備せず、place() は null
 *    （前の形の記録が残る根の中に、ロールのフォルダや git を作らない）。
 *  - 準備の失敗は配信を止めない（onPrepareFailed へ・保存のたびにコミットが失敗として警告に出る・今までと同じ）。
 *
 * @param {object} deps
 * @param {string} deps.root  記憶の根（本番は DEFAULT_MEMORY_DIR）。
 * @param {() => { id: string; name: { canonical: string } }} deps.currentRole  今のロール（roleHooks.current）。
 * @param {number} deps.startedAtMs  配信の始まり（場の日付）。
 * @param {boolean} [deps.available=true]
 * @param {(options: { dir: string; soulName: string }) => Promise<{ ok: boolean; error?: string }>} [deps.prepareImpl]
 * @param {(options: { startedAtMs: number }) => import("../mind/memory.mjs").StreamRecordLog} [deps.createRecordLogImpl]
 * @param {(info: { roleId: string; error: string }) => void} [deps.onPrepareFailed]
 * @returns {{ place: () => Readonly<RoleMemoryPlace> | null; beginStream: (startedAtMs: number) => void; streamNo: () => number }}
 */
export function createRoleMemoryPlaces(deps) {
  const prepareImpl = deps.prepareImpl ?? ((/** @type {any} */ options) => prepareMemoryFolder(options));
  const createRecordLogImpl = deps.createRecordLogImpl ?? createStreamRecordLog;
  const available = deps.available !== false;
  /** @type {Map<string, Readonly<RoleMemoryPlace>>} */
  const places = new Map();
  // 今の場の始まり（場の日付）と番号（配信の組み直し Domain D）。まだ場が無ければ起動の時刻と 0。
  let startedAtMs = deps.startedAtMs;
  let streamNo = 0;
  const reportFailure = (/** @type {string} */ roleId, /** @type {string} */ error) => {
    try {
      deps.onPrepareFailed?.({ roleId, error });
    } catch {
      // 知らせ先の失敗で準備を止めない。
    }
  };
  return {
    place() {
      if (!available) return null;
      const role = deps.currentRole();
      const cached = places.get(role.id);
      if (cached) return cached;
      /** @type {string} */
      let dir;
      try {
        dir = memoryDirForRole(deps.root, role.id);
      } catch {
        return null;
      }
      const ready = Promise.resolve()
        .then(() => prepareImpl({ dir, soulName: role.name.canonical }))
        .then(
          (result) => {
            if (!result || !result.ok) reportFailure(role.id, String(result?.error ?? "unknown"));
          },
          (error) => reportFailure(role.id, error instanceof Error ? error.message : String(error))
        );
      const place = Object.freeze({
        roleId: role.id,
        dir,
        ready,
        streamRecord: createRecordLogImpl({ startedAtMs }),
        streamNo
      });
      places.set(role.id, place);
      return place;
    },
    /**
     * 今のロールの置き場が「どのロールの・どのフォルダか」だけを返す（配信の組み直し Domain E・記憶のタブの表示）。
     * place() と同じ決め方（今のロール・memoryDirForRole）で、置き場を作らない・準備（git init・種）を走らせない。
     * 記憶を読み書きしない起動（引っ越しの失敗）は null。
     * @returns {{ roleId: string; dir: string } | null}
     */
    placeInfo() {
      if (!available) return null;
      const role = deps.currentRole();
      const cached = places.get(role.id);
      if (cached) return { roleId: cached.roleId, dir: cached.dir };
      try {
        return { roleId: role.id, dir: memoryDirForRole(deps.root, role.id) };
      } catch {
        return null;
      }
    },
    beginStream(nextStartedAtMs) {
      startedAtMs = nextStartedAtMs;
      streamNo += 1;
      places.clear();
    },
    streamNo: () => streamNo
  };
}
