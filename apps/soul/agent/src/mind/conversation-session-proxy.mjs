import { CHANNEL_URL_NOT_SET_MESSAGE } from "../channel/cockpit-channel.mjs";

/**
 * session.ask への透過プロキシを作る（S3 の Channel URL 未設定チェック + 遅延生成は不変）。
 * S5: `ask(input)` は文字列（通常 Fire）と content ブロック配列（視覚発火）の両方を素通しする。
 * Progressive Speech C1: additive な ask options（onTextDelta）も同じ session へ透過する。
 * （分岐しない＝透過。型ガードは session 側が担う）。
 * @param {object} options
 * 配信の組み直し Domain C: URL の確かめは `hasBody()` が true のとき（今のロールに体があるとき）だけ。体なしは
 * URL が無くても頭に聞く。hasBody を渡さなければ今どおり（いつも確かめる）。
 * @param {() => string | null} options.getUrl  現在の Channel URL（lazyChannel.getUrl）。
 * @param {() => boolean} [options.hasBody]  今のロールに体があるか（聞くたびに読む・既定 いつも true）。
 * @param {() => void} options.ensureFireResources  session/player の遅延生成（冪等）。
 * @param {() => void | Promise<void>} [options.ensureSessionCurrent] 次の accepted Fire の設定反映。
 * @param {() => { ask: (input: string | Array<any>, askOptions?: object) => Promise<any> } | null} options.getSession
 * @returns {{ ask: (input: string | Array<any>, askOptions?: object) => Promise<any> }}
 */
export function createSessionProxy(options) {
  const { getUrl, ensureFireResources, getSession, ensureSessionCurrent } = options;
  const hasBody = typeof options.hasBody === "function" ? options.hasBody : () => true;
  return {
    /** @param {string | Array<any>} input @param {object} [askOptions] */
    async ask(input, askOptions) {
      if (typeof ensureSessionCurrent === "function") {
        await ensureSessionCurrent();
      }
      if (hasBody() !== false && getUrl() == null) {
        throw new Error(CHANNEL_URL_NOT_SET_MESSAGE);
      }
      ensureFireResources();
      return /** @type {any} */ (getSession()).ask(input, askOptions);
    }
  };
}
