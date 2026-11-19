import { hasWriterMaterials } from "../../mind/memory.mjs";
import {
  MEMORY_CHECKPOINT_INTERVAL_MS,
  shouldSkipMemoryCheckpoint,
  countSpokenEntries,
  isMemoryCheckpointDue
} from "../../mind/venue-memory-recorder.mjs";

/** @typedef {import("./task-resources.mjs").VenueWriterMaterials} WriterMaterials */
/** @typedef {import("../../mind/venue-memory-organiser.mjs").MemoryOrganiserRunner} MemoryOrganiserRunner */

/** 体のあるロールで器（runtime-player）につながらず、場を開かなかったときの知らせ（配信の組み直し Domain D・scope §19）。 */
export const BODY_CONNECT_FAILED_MESSAGE =
  "体の器（runtime-player）につながらない — runtime-player が起動していないか、channel が開いていない。" +
  "runtime-player を起動して channel を開いてから、もう一度「配信を始める」を押す。";

/** 体のあるロールで器の URL が入っていないまま「配信を始める」を押したときの知らせ（配信の組み直し Domain D）。 */
export const BODY_URL_NOT_SET_MESSAGE =
  "体の器（runtime-player）の URL が入っていない — 準備・設定の Channel 欄に runtime-player の channel の URL を入れてから、" +
  "もう一度「配信を始める」を押す。";

/**
 * 場（配信を始める / 終える）の cockpit.mjs 側の口と、場ごとの記録（配信の組み直し Domain D・stream-restructure.md §3）。
 * cockpit-server の openStream / closeStream が `hooks` を順に呼ぶ（server の `streamHooks`）。
 *
 *  - hooks.renewRecords（始める 2）: 場の記録を作り直す。場の番号を進め、この場の記憶の保存の持ち回り（場の日付と、この場で
 *    ②が書いた本体のファイル・memoryPlaces.beginStream → createStreamRecordLog）と
 *    頭の文脈の記録のファイル（renewUsageLog）を新しくし、保存の数え（lastRecordedSeq / lastRecordAtMs）を 0 / null に
 *    戻す（新しい場の転写は 0 から始まるので、前の場の seq と比べて保存を飛ばさない）。そのロールの置き場の準備
 *    （git init・種）もここで待つ（ロールの切り替えの応答を git init で待たせない・場の始まりで用意されている）。
 *  - hooks.openSession（始める 5）: 頭のセッションを今のロールのモデルと指示で作る（前の場のセッションは使わない）。
 *  - hooks.connectBody（始める 6）: ロールに体があれば器につなぐ（resolveFireChannel と同じく今のロールの body を見る）。
 *    URL が無い・つながらないなら `{ ok:false, reason }`（場は開かない）。体なしは器を見ない・つながない。
 *  - hooks.closeSession / hooks.closeBody（畳む）: 頭のセッションを畳む・器を畳む（器は体の有無に関わらず）。
 *  - hooks.saveFinal（終える 3）: 転写や追加の材料が増えていれば最後の保存を頼み、保存の完了または失敗を待つ。
 *    記憶の整理 Domain C: そのあと（頼まなかった閉じでも）、organiser があれば、閉じたロールの置き場（saveFinal を呼んだ
 *    時点の memoryPlaces.place()）の整理の時期を見て、時期なら③整理役を走らせ、終わるまで上限なしで待つ
 *    （createMemoryOrganiserRunner・その間も場は closing のまま）。②の終了を確認できていなければ整理は見送る。
 *  - checkpoint(): 20 分ごとの保存の 1 回分。場が開いている間だけ、前の保存から転写が増えていれば頼む。
 *  - noteSaved(info): 保存の係の onSaved。頼んだ時点の場（置き場の streamNo）が今の場のときだけ数える（前の場の
 *    遅れて終わった保存で、新しい場の数えを上書きしない）。
 *  - waitForRunningSaves(): Ctrl+C で場が閉じていたとき、走っている保存（前の場の最後の保存の残りなど）を待つ（頼まない）。
 *
 * @param {object} deps
 * @param {{ beginStream: (startedAtMs: number) => void; place: () => any; streamNo: () => number }} deps.memoryPlaces
 * @param {{ record: (entries?: ReadonlyArray<any>, materials?: WriterMaterials, onUnconfirmedExit?: () => void) => Promise<string | void>; whenIdle: () => Promise<void>; isRecording: () => boolean; hasUnconfirmedWriter?: (place: any) => boolean }} deps.memoryRecorder
 * @param {(startedAtMs: number) => void} [deps.renewUsageLog]  頭の文脈の記録のファイルを新しくする（本番は createSessionUsageLog の作り直し）。
 * @param {() => (void | Promise<void>)} deps.openSession  頭のセッションを作り直す（前のセッションを畳んでから作る）。
 * @param {() => (void | Promise<void>)} deps.closeSession  頭のセッションを畳む（冪等）。
 * @param {() => boolean} deps.hasBody  今のロールに体があるか（roleHooks.current().body）。
 * @param {{ getUrl: () => string | null; connect: () => Promise<void>; close: () => Promise<void> }} deps.channel  器（lazyChannel）。
 * @param {() => boolean} [deps.isStreamOpen]  場が開いているか（20 分ごとの保存の判定・server.streamStatus）。
 * @param {() => ReadonlyArray<any>} [deps.getEntries]  ライブの転写（server.getTranscript）。
 * @param {() => number} [deps.nowImpl=Date.now]  場の始まりの時刻と、途中保存の経過時間（Discord モード Domain H）の時計。
 * @param {number} [deps.checkpointIntervalMs=MEMORY_CHECKPOINT_INTERVAL_MS]  途中保存を頼むまでの経過（Discord モード Domain H）。
 * @param {() => void} [deps.onMemoryWait]  保存を待ち始めたとき（ターミナルに 1 行）。
 * @param {Pick<MemoryOrganiserRunner, "organiseIfDue">} [deps.organiser]  ③整理役の係（記憶の整理 Domain C・
 *   createMemoryOrganiserRunner）。無ければ閉じで整理しない（今までのふるまい）。
 */
export function createStreamVenueHooks(deps) {
  const nowImpl = deps.nowImpl ?? Date.now;
  const checkpointIntervalMs = deps.checkpointIntervalMs ?? MEMORY_CHECKPOINT_INTERVAL_MS;
  /** この場で最後に保存が成り立った時刻（snapshot の memory.lastRecordAtMs）。場の始まりで null に戻す。 @type {number | null} */
  let lastRecordAtMs = null;
  // Discord モード Domain H（discord-mode.md §13.6）: 途中保存の経過時間の起点（どれも nowImpl の時計・場の始まりで戻す）。
  /** この場の始まり（renewRecords の時刻）。 @type {number | null} */
  let venueStartedAtMs = null;
  /** この場で最後に保存が成り立ったと数えた時刻（noteSaved を受けた時点の nowImpl・途中・手動・最後のどれでも）。 @type {number | null} */
  let lastSavedAtMs = null;
  /** この場で最後に途中保存を頼んだ時刻（checkpoint が頼んだ時点・保存が失敗し続けても頼み直しを 20 分おきに保つ）。 @type {number | null} */
  let lastCheckpointRequestedAtMs = null;
  /** この場で最後に保存が成り立った時点の転写の件数（保存を飛ばす判定）。場の始まりで 0 に戻す。 */
  let lastRecordedSeq = 0;
  /** @param {Promise<unknown>} done */
  const waitForSave = async (done) => {
    try {
      deps.onMemoryWait?.();
    } catch {
      // 知らせの失敗で待ちを止めない。
    }
    await done;
  };

  return {
    hooks: {
      async renewRecords() {
        const startedAtMs = nowImpl();
        lastRecordedSeq = 0;
        lastRecordAtMs = null;
        venueStartedAtMs = startedAtMs;
        lastSavedAtMs = null;
        lastCheckpointRequestedAtMs = null;
        deps.renewUsageLog?.(startedAtMs);
        deps.memoryPlaces.beginStream(startedAtMs);
        await deps.memoryPlaces.place()?.ready;
      },
      async openSession() {
        try {
          await deps.openSession();
          return { ok: true };
        } catch (error) {
          return { ok: false, reason: `頭のセッションを作れない（${error instanceof Error ? error.message : String(error)}）` };
        }
      },
      async connectBody() {
        if (deps.hasBody() === false) return { ok: true, body: false };
        if (deps.channel.getUrl() == null) return { ok: false, reason: BODY_URL_NOT_SET_MESSAGE };
        try {
          await deps.channel.connect();
          return { ok: true, body: true };
        } catch {
          return { ok: false, reason: BODY_CONNECT_FAILED_MESSAGE };
        }
      },
      async closeSession() {
        try {
          await deps.closeSession();
        } catch {
          // best-effort（畳めなかったセッションは使わない）。
        }
      },
      async closeBody() {
        try {
          await deps.channel.close();
        } catch {
          // best-effort
        }
      },
      /** @param {ReadonlyArray<any>} transcript @param {WriterMaterials} [materials] @param {() => void} [onUnconfirmedExit] */
      async saveFinal(transcript, materials, onUnconfirmedExit, strict = false, previous = /** @type {{recording?: string|null}} */ ({})) {
        // 記憶の整理 Domain C: 整理するのは、閉じの保存を頼むのと同じ時点のロールの置き場（保存の係の getPlace と同じ）。
        /** @type {any} */
        let place = null;
        if (deps.organiser) {
          try {
            place = deps.memoryPlaces.place();
          } catch {
            place = null;
          }
        }
        // Discord モード Domain K（J の持ち越し 1）: 要否は出来事の行を除いた件数で見る（出来事の行だけなら頼まない）。頼むときの
        // 中身は出来事の行を載せたままの転写。
        const spoken = countSpokenEntries(transcript);
        const entries =
          hasWriterMaterials(materials) || (spoken > 0 && !shouldSkipMemoryCheckpoint(spoken, lastRecordedSeq)) ? transcript : [];
        const recorded = previous.recording === "saved" || previous.recording === "not-needed"
          ? Promise.resolve(previous.recording)
          : deps.memoryRecorder.record(entries, materials, onUnconfirmedExit);
        const done = Promise.all([recorded, deps.memoryRecorder.whenIdle()]);
        if (deps.memoryRecorder.isRecording()) await waitForSave(done);
        const [recording] = await done;
        if (strict && recording !== "saved" && recording !== "not-needed") return { recording, organising: null };
        let organising = "not-due";
        // 記憶の整理 Domain C: 閉じの書き出しのあと（新しい文字起こしが無く頼まなかった閉じでも）、時期なら③整理役を走らせて
        // 終わるまで待つ。同じフォルダの git で②と③を同時に走らせない。
        if (deps.organiser) {
          organising = await deps.organiser.organiseIfDue(place, { ...(strict ? { strict } : {}), writerBusy: () => deps.memoryRecorder.isRecording() || deps.memoryRecorder.hasUnconfirmedWriter?.(place) === true });
        }
        return { recording, organising };
      }
    },
    /**
     * 20 分ごとの保存の 1 回分（場が開いている間だけ・転写が前の保存から増えていなければ頼まない）。
     * Discord モード Domain H（discord-mode.md §13.6）: main のタイマーは起動時に張ったまま 1 分ごと
     * （MEMORY_CHECKPOINT_TICK_MS）に呼ぶ。頼むのは、場の始まり・前の保存（途中・手動）・前に頼んだ時刻のうち一番遅い
     * ものから 20 分たったときだけ（isMemoryCheckpointDue）。体験の種類は見ない（配信の場にも同じく効く）。
     * @returns {boolean}  頼んだら true。
     */
    checkpoint() {
      if (typeof deps.isStreamOpen !== "function" || !deps.isStreamOpen()) return false;
      const entries = typeof deps.getEntries === "function" ? deps.getEntries() : [];
      // 空回しでトークンを燃やさない。Discord モード Domain K: 数えるのは出来事の行を除いた件数（出来事の行だけ・出来事の行が
      // 増えただけでは頼まない）。頼むときの中身は出来事の行を載せたまま。
      const spoken = countSpokenEntries(entries);
      if (spoken === 0 || shouldSkipMemoryCheckpoint(spoken, lastRecordedSeq)) return false;
      const nowMs = nowImpl();
      const since = { startedAtMs: venueStartedAtMs, lastSavedAtMs, lastRequestedAtMs: lastCheckpointRequestedAtMs };
      if (!isMemoryCheckpointDue(nowMs, since, checkpointIntervalMs)) return false; // 場の始まり・前の保存から 20 分たっていない。
      lastCheckpointRequestedAtMs = nowMs;
      deps.memoryRecorder.record(entries).catch(() => {});
      return true;
    },
    /**
     * 保存の係の onSaved。今の場の保存だけを数える（置き場を持たない保存 = テストの係は数える）。
     * @param {{ atMs: number; entriesLength: number; spokenLength?: number; place?: any }} info
     * @returns {boolean}  数えたら true。
     */
    noteSaved(info) {
      const place = info ? info.place : undefined;
      if (place && typeof place.streamNo === "number" && place.streamNo !== deps.memoryPlaces.streamNo()) return false;
      lastRecordAtMs = info.atMs;
      // Discord モード Domain K: 保存の要否の数えは出来事の行を除いた件数（保存の係が spokenLength を渡す・無ければ件数そのもの）。
      lastRecordedSeq = typeof info.spokenLength === "number" ? info.spokenLength : info.entriesLength;
      // Discord モード Domain H: 途中保存の起点を戻す（途中・手動の「今日を記録」のどちらでも）。info.atMs は保存の係の
      // 時計で保存が終わった時刻（writeImpl が返った直後）。ここでは場の時計（nowImpl）で、受けた時刻を起点にする
      // （onSaved は終わった直後に同期で呼ばれるので同じ時刻・テストで時計を差し替えても起点が揃う）。
      lastSavedAtMs = nowImpl();
      return true;
    },
    lastRecordAtMs: () => lastRecordAtMs,
    lastRecordedSeq: () => lastRecordedSeq,
    /** 走っている保存を待つ。 */
    async waitForRunningSaves() {
      if (!deps.memoryRecorder.isRecording()) return;
      await waitForSave(deps.memoryRecorder.whenIdle());
    }
  };
}

/**
 * 場に入るロールの束（Discord モード Domain B・discord-mode.md §5）。cockpit-server の `roles` に渡す一覧の要素。
 * main() の今の 1 つずつの変数（今のロール・場の口・声の engine と再生器・④）を包んで 1 つの束にする。束の口はどれも
 * 呼んだ時点の今のロールを読む（ロールの切り替えで束を作り直さない・場の間はサーバが一覧ごと固め、ロールの選択も断る）。
 * 「束を作る工場」（main() の結び合った変数をロールごとに作る所）の切り出しは 2 つ目のロールのとき（設計 §5・§12.2）。
 *
 *  - id() / identity(): 今のロールの id と名前（名前・whisper の手がかり・呼びかけの照合・判定に渡す名前・soul の行）。
 *  - hooks: 場の口 6 つ（createStreamVenueHooks の hooks = 場の記録・頭のセッション・器・記憶の最後の保存）。同じものを渡す。
 *  - voice.prepare(kind): 声の engine を用意する（始める 6・入口を開く前・ElevenLabs のキーはここで読む）。
 *  - voice.startResources(): 再生器と声の差し替え口を起こす（始める 6・待たない）。投げたら警告の 1 行にして場は止めない。
 *  - voice.openOutlet(info)（Discord モード Domain E・渡したときだけ）: Discord の入口が VC に入った直後に呼ぶ出口
 *    （`{ connection, voice, groupId }` → `{ dispose }`）。cockpit.mjs は Discord 向けの再生器を作ってこのロールの声に差す
 *    （§createVenuePlayerSlot）。渡さなければ null（出口なし）。
 *  - discordBotKeyFileRefused()（Discord モード Domain E・渡したときだけ）: role.json の discordBotKeyFile の形が合わず、Discord の
 *    入口が断るか（roleDiscordBotKeyFileRefused）。
 *  - recall.run(job): ④思い出し役を走らせる（今のロールの記憶の置き場を読む）。無ければ null。job.wording（場の語の組・
 *    Discord モード Domain C。null = 配信の語）もそのまま渡す。
 *
 * @param {object} deps
 * @param {() => string} deps.currentId
 * @param {() => any} deps.identity
 * @param {object} deps.streamHooks
 * @param {(kind: "aivis" | "elevenlabs") => any} deps.prepareVoice
 * @param {() => void} deps.startVoiceResources
 * @param {((job: import("../../mind/recall-desk.mjs").RecallJob) => Promise<any>) | null} [deps.recallRunner]
 * @param {(job: import("../../mind/recall-desk.mjs").RecallJob) => () => Promise<any>} [deps.prepareRecall]
 * @param {(() => string) | null} [deps.discordBotKeyFile]  今のロールの Discord の Bot の鍵のファイル名（Discord モード Domain D・
 *   role.json の discordBotKeyFile・無ければ既定 `.env.discord.local`）。束の discordBotKeyFile() で引く（無ければ null）。
 * @param {(() => boolean) | null} [deps.discordBotKeyFileRefused]  今のロールの鍵のファイル名の形が合わず断るか（Domain E）。
 * @param {((info: { connection: any; voice: any; groupId: string }) => ({ dispose: () => void } | null)) | null} [deps.openVoiceOutlet]
 *   Discord の出口（Domain E）。束の voice.openOutlet で引く（無ければ null）。
 * @param {(line: string) => void} [deps.onWarning]  警告の 1 行（本文・キーは入れない）。
 */
export function createVenueRoleBundle(deps) {
  const recallRunner = typeof deps.recallRunner === "function" ? deps.recallRunner : null;
  const prepareRecall = deps.prepareRecall;
  const discordBotKeyFile = typeof deps.discordBotKeyFile === "function" ? deps.discordBotKeyFile : null;
  const discordBotKeyFileRefused = typeof deps.discordBotKeyFileRefused === "function" ? deps.discordBotKeyFileRefused : null;
  const openVoiceOutlet = typeof deps.openVoiceOutlet === "function" ? deps.openVoiceOutlet : null;
  return Object.freeze({
    id: () => deps.currentId(),
    identity: () => deps.identity(),
    // Discord モード Domain D: Discord の入口が鍵を読むファイル名（鍵の中身は持たない）。
    discordBotKeyFile: discordBotKeyFile ? () => discordBotKeyFile() : null,
    // Discord モード Domain E: 鍵のファイル名の形が合わないとき Discord の入口が断る印。
    discordBotKeyFileRefused: discordBotKeyFileRefused ? () => discordBotKeyFileRefused() === true : null,
    hooks: deps.streamHooks,
    voice: Object.freeze({
      prepare: (/** @type {"aivis" | "elevenlabs"} */ kind) => deps.prepareVoice(kind),
      startResources: () => {
        try {
          deps.startVoiceResources();
        } catch (error) {
          try {
            deps.onWarning?.(`voice resources failed to start: ${error instanceof Error ? error.message : String(error)}`);
          } catch {
            // 知らせの失敗で場を止めない。
          }
        }
      },
      // Discord モード Domain E: Discord の出口（このロールの Bot の接続に結んだ再生器）。
      openOutlet: openVoiceOutlet ? (/** @type {any} */ info) => openVoiceOutlet(info) : null
    }),
    recall: recallRunner ? Object.freeze({ run: recallRunner, prepare: prepareRecall }) : null
  });
}
