import { createSpeechIntentMotion } from "../mind/speech-intent-motion.mjs";
import { connectChannel } from "./channel-client.mjs";

/**
 * 初回 sendSpeech で接続し、成功した接続をキャッシュする lazy チャネル（S3 設計判断・ヘッダ注記）。
 * 接続失敗はキャッシュせず throw（次回 fire で再試行）。close() は接続済みのときだけ畳む。
 *
 * S3 追撃 domain-c: URL を**後から設定/変更**できる（操縦席入力）。setUrl(url) で URL を差し替えると
 * 既存の接続キャッシュを破棄し、次回 fire で新 URL に再接続する（旧接続は best-effort で畳む）。
 * URL 未設定（null）で sendSpeech は**明示エラー**（操縦席で URL を入れる前の発火を弾く）。
 *
 * @param {string | null | undefined} url  初期 Channel URL（`ws://127.0.0.1:<port>/channel?token=..`）。
 *   未設定（null/undefined/空）なら操縦席から setUrl されるまで sendSpeech はエラー。
 * @param {object} [options]
 * @param {typeof connectChannel} [options.connectImpl]  接続実装（テスト注入・既定 connectChannel）。
 * @param {typeof createSpeechIntentMotion} [options.createMotion]  発話モーション判定のテスト差し替え口。
 * @param {(event: string, fields?: Record<string, unknown>) => void} [options.onTrace] passive diagnostics hook.
 * @returns {{
 *   sendSpeech: (timeline: unknown) => Promise<any>;
 *   openSpeech: (utteranceId: string) => Promise<any>;
 *   appendSpeech: (utteranceId: string, timeline: unknown) => Promise<any>;
 *   endSpeech: (utteranceId: string) => Promise<any>;
 *   sendEnvelope: (intent: unknown) => Promise<any>;
 *   sendSet: (intent: unknown) => Promise<any>;
 *   setUrl: (next: string | null | undefined) => void;
 *   getUrl: () => string | null;
 *   connectionStatus: () => string;
 *   connectionGeneration: () => number;
 *   acceptedConnectionGeneration: () => number;
 *   speechIntentMotion: () => ReturnType<typeof createSpeechIntentMotion>;
 *   connect: () => Promise<void>;
 *   close: () => Promise<void>;
 * }}
 */
export function createLazyChannel(url, options = {}) {
  const connectImpl = options.connectImpl ?? connectChannel;
  const createMotion = options.createMotion ?? createSpeechIntentMotion;
  const onTrace = options.onTrace;
  let currentUrl = typeof url === "string" && url.length > 0 ? url : null;
  /** @type {Promise<{ sendSpeech: Function; sendEnvelope: Function; close: () => Promise<void> }> | null} */
  let channelPromise = null;
  /** @type {"unset" | "idle" | "connecting" | "connected" | "error"} */
  let connState = currentUrl == null ? "unset" : "idle";
  let connectionGeneration = 0;
  let speechMotion = null;
  const retireSpeechMotion = () => {
    const previous = speechMotion;
    speechMotion = null;
    void previous?.retire();
  };

  const ensure = () => {
    if (currentUrl == null) {
      // URL 未設定で sendSpeech は明示エラー（操縦席で URL を入れる前の発火を弾く）。
      return Promise.reject(
        new Error("createLazyChannel: channel URL is not set (set it in the cockpit before firing).")
      );
    }
    if (channelPromise == null) {
      connState = "connecting";
      connectionGeneration += 1;
      const generation = connectionGeneration;
      const pending = Promise.resolve(connectImpl(currentUrl, {
        connectionGeneration: generation,
        onTrace(event, fields) {
          if (event === "channel.close" && channelPromise && connectionGeneration === generation) {
            invalidateExact(channelPromise, { code: "channel_closed" });
          }
          onTrace?.(event, fields);
        }
      }))
        .then((channel) => {
          if (channelPromise === pending) connState = "connected";
          return channel;
        })
        .catch((error) => {
          // A superseded URL/connection must never clear a newer cache.
          if (channelPromise === pending) {
            channelPromise = null; // 失敗は非キャッシュ = 次回 fire で再接続を試みる。
            connState = "error";
            retireSpeechMotion();
          }
          throw error;
        });
      channelPromise = pending;
    }
    return channelPromise;
  };

  const terminalConnectionCodes = new Set([
    "channel_closed",
    "channel_socket_error",
    "channel_send_failed",
    "reply_timeout"
  ]);
  const invalidateExact = (pending, error) => {
    if (channelPromise !== pending || !terminalConnectionCodes.has(error?.code)) return;
    channelPromise = null;
    connState = "error";
    retireSpeechMotion();
    Promise.resolve(pending)
      .then((channel) => channel.close())
      .catch(() => {});
  };
  const delegate = async (method, ...values) => {
    const pending = ensure();
    const channel = await pending;
    try {
      return await channel[method](...values);
    } catch (error) {
      // Never retry an ambiguous request. Only retire the exact failed cached
      // generation; the next Fire/request is allowed to connect once afresh.
      invalidateExact(pending, error);
      throw error;
    }
  };

  return {
    async sendSpeech(timeline) {
      return delegate("sendSpeech", timeline);
    },
    /**
     * intent.speechStream（声の差し替え Wave 2・発話の流し込み）。sendSpeech と同型に ensure()→接続へ委譲。
     * 同じ接続の上で呼んだ順に送られる（open → append… → end）。
     * @param {string} utteranceId
     */
    async openSpeech(utteranceId) {
      return delegate("openSpeech", utteranceId);
    },
    /** @param {string} utteranceId @param {unknown} timeline */
    async appendSpeech(utteranceId, timeline) {
      return delegate("appendSpeech", utteranceId, timeline);
    },
    /** @param {string} utteranceId */
    async endSpeech(utteranceId) {
      return delegate("endSpeech", utteranceId);
    },
    /**
     * intent.envelope を送る（S4 表情演出）。sendSpeech と同型に ensure()→接続へ委譲。
     * orchestrator が channel.sendEnvelope をスロット毎に呼ぶ。
     * @param {unknown} intent
     */
    async sendEnvelope(intent) {
      return delegate("sendEnvelope", intent);
    },
    /**
     * intent.set を送る（S6 barge-in の口閉じ）。sendSpeech/sendEnvelope と同型に ensure()→接続へ委譲。
     * orchestrator の interrupt() が mouth-open へ value=0 を着弾させるために呼ぶ。
     * @param {unknown} intent
     */
    async sendSet(intent) {
      return delegate("sendSet", intent);
    },
    /**
     * URL を後から設定/変更する。変更時は既存接続キャッシュを破棄（次回 fire で新 URL に再接続）。
     * 同一 URL は現状維持（接続を切らない）。空/null はクリア（以後 sendSpeech は明示エラー）。
     * @param {string | null | undefined} next
     */
    setUrl(next) {
      const normalized = typeof next === "string" && next.length > 0 ? next : null;
      if (normalized === currentUrl) return;
      const previous = channelPromise;
      channelPromise = null;
      retireSpeechMotion();
      currentUrl = normalized;
      connState = normalized == null ? "unset" : "idle";
      if (previous) {
        // 旧接続は畳む（未接続/接続失敗なら畳むものはない）。fire 経路をブロックしないよう非同期に。
        Promise.resolve(previous)
          .then((channel) => channel.close())
          .catch(() => {});
      }
    },
    /** 現在の URL（生・内部用。UI/ログには redactToken を通すこと）。 */
    getUrl() {
      return currentUrl;
    },
    /** 接続の現況（unset/idle/connecting/connected/error）。操縦席の状態表示用。 */
    connectionStatus() {
      return connState;
    },
    connectionGeneration() {
      return connectionGeneration;
    },
    /**
     * This accepted Fire's exact logical connection generation. A cached
     * connection keeps its generation; an idle proxy reserves the one ensure()
     * will allocate on that Fire's first send without connecting early.
     */
    acceptedConnectionGeneration() {
      return channelPromise == null ? connectionGeneration + 1 : connectionGeneration;
    },
    speechIntentMotion() {
      if (!speechMotion) {
        const motion = createMotion({
          async getCatalog() {
            if (speechMotion !== motion) return null;
            const pending = ensure();
            const channel = await pending;
            return speechMotion === motion && channelPromise === pending ? channel.speechMotions : null;
          },
          channel: {
            async sendMotion(intent) {
              const pending = channelPromise ?? (intent.op === "begin" && speechMotion === motion ? ensure() : null);
              const retiredError = () => Object.assign(new Error("Speech motion connection retired."), { code: "channel_motion_retired" });
              if (!pending || speechMotion !== motion) throw retiredError();
              const channel = await pending.catch((error) => {
                throw Object.assign(new Error("Speech motion connection did not open.", { cause: error }), {
                  code: typeof error?.code === "string" ? error.code : "channel_motion_connect_failed",
                  diagnosticStage: "control_channel.preflight"
                });
              });
              if (speechMotion !== motion || channelPromise !== pending) throw retiredError();
              try {
                return await channel.sendMotion(intent);
              } catch (error) {
                invalidateExact(pending, error);
                throw error;
              }
            }
          }
        });
        speechMotion = motion;
      }
      return speechMotion;
    },
    /**
     * 今の URL で器につないでおく（配信の組み直し Domain D:「配信を始める」で体のあるロールの器を確かめる口）。
     * つながっていればそのまま。URL が無い・つながらない（runtime-player が起動していない・channel が開いていない・
     * hello が来ない）なら投げる（失敗は非キャッシュ = 次の始める / Fire でもう一度つなぐ）。
     * @returns {Promise<void>}
     */
    async connect() {
      await ensure();
    },
    /**
     * 接続を畳む。URL はそのまま残し、次の送信（か connect）でつなぎ直せる（配信の組み直し Domain D: 場の終わりで畳み、
     * 次の場の始まりでつなぐ）。
     */
    async close() {
      retireSpeechMotion();
      if (channelPromise == null) return;
      const pending = channelPromise;
      channelPromise = null;
      connState = currentUrl == null ? "unset" : "idle";
      try {
        const channel = await pending;
        await channel.close();
      } catch {
        // 未接続（接続失敗）だった場合は畳むものがない。
      }
    }
  };
}

/** 体のあるロールで器の URL が無いまま発火したときの断りの文面（今と同じ）。 */
export const CHANNEL_URL_NOT_SET_MESSAGE = "Channel URL is not set — set it in the cockpit (Channel field) before firing.";

/**
 * 受理する Fire の器を決める（配信の組み直し Domain C・stream-restructure.md §4）。
 *  - 体あり: 今どおり、器の URL が無ければ断る（受理しない）。器（lazyChannel）と受理の時点の URL を返す。
 *  - 体なし: 器を使わない。URL の有無を見ず、器は渡さない（channel: null）。運び手は手元の再生器だけで鳴らす。
 * @param {object} options
 * @param {boolean} options.body  受理の時点のロールの体の有無。
 * @param {{ getUrl: () => string | null }} options.channel  器（lazyChannel）。
 * @returns {{ body: boolean; channel: any | null; channelUrl: string | null }}
 */
export function resolveFireChannel({ body, channel }) {
  if (body === false) return { body: false, channel: null, channelUrl: null };
  const channelUrl = channel.getUrl();
  if (channelUrl == null) throw new Error(CHANNEL_URL_NOT_SET_MESSAGE);
  return { body: true, channel, channelUrl };
}
