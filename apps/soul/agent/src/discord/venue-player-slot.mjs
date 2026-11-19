import { createDiscordStreamPlayer } from "./discord-stream-player.mjs";

/** 「VC にいない」の口が投げる文面（Discord モード Domain I・決まった短い文・運び手の play-failed の診断に乗る）。 */
export const HELD_VENUE_PLAYER_MESSAGE = "venue player held: not in a voice channel (no local playback).";

/**
 * 「VC にいない」の口（Discord モード Domain I・§13.3）。Discord の場で VC から抜けている間、差し口に置く。鳴らさない（open / write /
 * end は投げる = 運び手は play-failed で終わる・手元のスピーカーに落とさない）。stop・onEvent・dispose は何もしない。
 */
export const HELD_VENUE_PLAYER = Object.freeze({
  held: true,
  open() {
    throw new Error(HELD_VENUE_PLAYER_MESSAGE);
  },
  write() {
    throw new Error(HELD_VENUE_PLAYER_MESSAGE);
  },
  end() {
    throw new Error(HELD_VENUE_PLAYER_MESSAGE);
  },
  stop() {},
  onEvent() {
    return () => {};
  },
  whenReady: () => Promise.resolve(false),
  current: () => null,
  isAlive: () => false,
  dispose() {}
});

/**
 * その場の再生器の差し口（Discord モード Domain E・discord-mode.md §4.3「再生器を作る（ロールごと）」・§5・§7）。
 *
 * 場の共通の段が体験に応じて再生器を作り分けるための置き場。配信の場では空（null）のままで、声は今の手元の再生器
 * （createStreamPlayer）から出る。Discord の場では、入口が VC に入った直後にロールの束の voice.openOutlet → open(info) が呼ばれ、
 * そのロールの Bot の接続に結んだ Discord 向けの再生器（src/discord/discord-stream-player.mjs）をここに置く。main() の
 * ensureVoiceResources・acquireAcceptedFireResources・playerProxy は、ここに再生器があればそれを使い、手元の再生器は起こさない
 * （手元のスピーカーから出さない）。入口を閉じると返り値の dispose で再生器を畳んで空に戻す（次の配信の場は手元の再生器）。
 *
 * Discord モード Domain I（discord-mode.md §13.3）: VC から抜けた（場は開いたまま）ときは、返り値の `dispose({ hold: true })` で
 * 再生器を畳み、差し口には「VC にいない」の口（{@link HELD_VENUE_PLAYER}・鳴らさない・open / write / end は投げる）を置く。差し口が
 * 空でないので、ensureVoiceResources・acquireAcceptedFireResources・playerProxy は手元の再生器を作らない・使わない（抜けた瞬間に
 * 鳴っている途中の返事・遅れて届いた声が手元のスピーカーに流れない）。次に VC に入れば open が置き換え、場を閉じれば（hold なしの
 * dispose・サーバを閉じるときの dispose）空に戻る。
 *
 * @param {object} [deps]
 * @param {(info: { connection: any; voice: any; groupId: string }) => any} [deps.createPlayer]  再生器を作る口（既定
 *   createDiscordStreamPlayer。テストは偽物）。
 * @param {number} [deps.startedDelayMs]  Discord の `started` に足す遅れ（既定は再生器の既定・設計 §7.4 の a）。
 * @param {(event: string) => void} [deps.onTrace]  診断（事象の種類だけ）。
 */
export function createVenuePlayerSlot(deps = {}) {
  const held = HELD_VENUE_PLAYER;
  const createPlayer =
    typeof deps.createPlayer === "function"
      ? deps.createPlayer
      : (/** @type {{ connection: any; voice: any; groupId: string }} */ info) =>
          createDiscordStreamPlayer({
            voice: info.voice,
            connection: info.connection,
            ...(typeof deps.startedDelayMs === "number" ? { startedDelayMs: deps.startedDelayMs } : {}),
            ...(typeof deps.onTrace === "function" ? { onTrace: (/** @type {string} */ event) => deps.onTrace?.(event) } : {})
          });
  /** @type {any} */
  let current = null;
  /** @param {any} p */
  const release = (p) => {
    if (current === p) current = null;
    try {
      p.dispose?.();
    } catch {
      // best-effort
    }
  };
  return Object.freeze({
    /** 今の場の再生器（無ければ null = 手元の再生器を使う）。 */
    current: () => current,
    /**
     * Discord の出口（ロールの束の voice.openOutlet）。前の場の残り（・VC にいない間の口）があれば置き換えて畳む。作れなければ
     * 投げ、差し口は今のまま（VC にいない間の口なら、それを残す = 手元のスピーカーに戻さない）。
     * 返り値の dispose(options): 再生器を畳む。`{ hold: true }`（Domain I・VC から抜けた）なら差し口に「VC にいない」の口を残す。
     * hold で残した口は、同じ出口の hold なしの dispose で外れる（場を閉じた）。
     * @param {{ connection: any; voice: any; groupId: string }} info
     */
    open(info) {
      const p = createPlayer(info);
      if (current) release(current);
      current = p;
      let holding = false;
      return Object.freeze({
        /** @param {{ hold?: boolean }} [options] */
        dispose: (options) => {
          const hold = !!options && options.hold === true;
          if (current === p) {
            current = hold ? held : null;
            holding = hold;
          } else if (current === held && holding && !hold) {
            current = null;
            holding = false;
          }
          try {
            p.dispose?.();
          } catch {
            // best-effort
          }
        }
      });
    },
    /** 畳む（サーバを閉じるときなど・冪等）。 */
    dispose() {
      if (current) release(current);
    }
  });
}
