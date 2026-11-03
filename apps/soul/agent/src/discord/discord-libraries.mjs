// @ts-check
/**
 * Discord の部品（discord.js / @discordjs/voice / opusscript）を読み込む口（Discord モード Domain D・discord-mode.md §4.4）。
 *
 * **使うときに動的 import する**（配信だけのときは読み込まない）。このファイルが Discord の部品を読み込む唯一の所で、
 * 静的 import はしない（scripts/cockpit.mjs の静的な import の木に入らないことを scripts/cockpit-discord-d.test.mjs が固定する）。
 * テストはこの口を差し替え、偽の Discord（src/test-support/fake-discord.mjs）を渡す。
 *
 * @typedef {{ discord: any; voice: any; OpusScript: any }} DiscordLibraries
 */

/**
 * @returns {Promise<DiscordLibraries>}
 */
export async function loadDiscordLibraries() {
  const d = /** @type {any} */ (await import("discord.js"));
  const discord = d.Client ? d : d.default;
  const v = /** @type {any} */ (await import("@discordjs/voice"));
  const voice = v.joinVoiceChannel ? v : v.default;
  const o = /** @type {any} */ (await import("opusscript"));
  const OpusScript = o.default ?? o;
  return { discord, voice, OpusScript };
}
