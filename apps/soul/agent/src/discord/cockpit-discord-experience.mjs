import { createDiscordExperience } from "./discord-experience.mjs";

/**
 * Discord の体験の口（Discord モード Domain D・discord-mode.md §4.3・§6・§9）。cockpit-server の `experiences.discord` に渡す。
 * main() の今の変数（設定の置き場・今のロールの鍵のファイル名・標準出力）を包んで src/discord/discord-experience.mjs の口を作る。
 *
 *  - settings: Discord の準備（サーバー・ボイスチャンネル・文字起こしの方式）の get / set（cockpit-settings.local.json）。
 *  - currentKeyFile(): 今のロールの鍵のファイル名（一覧の読み込みで使う。場を開くときはロールの束の discordBotKeyFile）。
 *  - currentKeyFileRefused(): 今のロールの鍵のファイル名の形が合わないか（Discord モード Domain G・一覧の読み込みも入口と同じく
 *    鍵を読まずログインせずに断る）。無ければ断らない。
 *  - settings の getDiscordVisionTarget / setDiscordVisionTarget（Domain G）: Discord の場の見る窓（目）の置き場（配信の見る窓とは別）。
 *  - write(line): ログの口（`[cockpit] discord: …` の 1 行・数と状態だけ。文字起こしの本文・名前・Discord の id は書かない）。
 *  - loadLibraries / loadToken: テスト注入（既定は discord.js などを使うときに動的 import・鍵は role の指すファイルから直に読む）。
 *
 * @param {object} deps
 * @param {{ getDiscordPrep: () => any; setDiscordPrep: (patch: object) => void;
 *   getDiscordVisionTarget?: () => (string | null); setDiscordVisionTarget?: (title: string | null) => void }} deps.settings
 * @param {() => string} deps.currentKeyFile
 * @param {() => boolean} [deps.currentKeyFileRefused]
 * @param {(line: string) => void} deps.write
 * @param {() => Promise<any>} [deps.loadLibraries]
 * @param {(fileName: string) => any} [deps.loadToken]
 * @param {object} [deps.options]  createDiscordExperience へそのまま渡す追加（待ちの長さ・出口の置き場など）。
 */
export function createDiscordVenueExperience(deps) {
  return createDiscordExperience({
    ...(deps.options ?? {}),
    settings: {
      getDiscordPrep: () => deps.settings.getDiscordPrep(),
      setDiscordPrep: (/** @type {object} */ patch) => deps.settings.setDiscordPrep(patch),
      getDiscordChatChannel: () => deps.settings.getDiscordChatChannel?.() ?? null,
      setDiscordChatChannel: (/** @type {{ guildId: string; channelId: string } | null} */ channel) =>
        deps.settings.setDiscordChatChannel?.(channel) ?? false,
      // Discord モード Domain G: Discord の場の見る窓（目）。置き場が無ければ「選んでいない」（目を起こさない）。
      getDiscordVisionTarget: () =>
        typeof deps.settings.getDiscordVisionTarget === "function" ? deps.settings.getDiscordVisionTarget() : null,
      setDiscordVisionTarget: (/** @type {string | null} */ title) => {
        if (typeof deps.settings.setDiscordVisionTarget !== "function") throw new Error("no place to keep the Discord vision target");
        deps.settings.setDiscordVisionTarget(title);
      }
    },
    currentKeyFile: () => deps.currentKeyFile(),
    ...(deps.currentKeyFileRefused ? { currentKeyFileRefused: () => /** @type {() => boolean} */ (deps.currentKeyFileRefused)() } : {}),
    log: (/** @type {string} */ line) => deps.write(`[cockpit] discord: ${line}\n`),
    ...(deps.loadLibraries ? { loadLibraries: deps.loadLibraries } : {}),
    ...(deps.loadToken ? { loadToken: deps.loadToken } : {})
  });
}
