// @ts-check
/**
 * view-logic: Discord の場の画面の表示導出（Discord モード Domain G・discord-mode.md §9・§4.1・§4.5。preact 非依存の純関数）。
 *
 *  - 体験は場を開くときに選ぶ（scope §21）: 場が閉じているとき、メイン画面の「配信を始める」の横に「Discord の VC に入る」
 *    （discordJoinView）。Discord の入口が無いサーバ（snapshot の discord が null）では出さない（今の配信の画面のまま）。
 *  - 入る / 抜ける: 開きかけは「VC に入っています…」、閉じかけは「VC から抜けています…」（体験の語・配信の文言は変えない）。
 *    下の帯の 2 回押しは glance-meters.mjs の endStreamButtonView が体験の語で出す。
 *  - 接続の状態（venueConnectionView）: snapshot の stream.connection を名指しで（入っている途中・入っている・切れた）。
 *  - Discord の準備のタブ: サーバー・ボイスチャンネルの選択肢（discordGuildOptions / discordChannelOptions・表示は名前だけ・
 *    id は option の value にだけ持つ）、見る窓（discordVisionOptions）、文字起こしの方式。
 *  - 話し始めの方式は Discord の場では選ばせない（DISCORD_SPEAK_START_FIXED_NOTE・サーバの DISCORD_SPEAK_START_FIXED_MESSAGE と
 *    同じ文面。ui は cockpit-server を import しないので写しをここに置き、一致はテストで固定する）。
 *
 * 守り（§10）: サーバーやチャンネルの id は表示の文字列に入れない（選択肢の label は名前か決まった文面だけ）。
 */

/** メイン画面・Discord の準備のタブの「Discord の VC に入る」。 */
export const DISCORD_JOIN_TEXT = "Discord の VC に入る";
/** 開きかけ（Discord の場）の文言。 */
export const DISCORD_JOINING_TEXT = "VC に入っています…";
/** 閉じかけ（Discord の場・記憶の最後の保存を待つ間）の文言。 */
export const DISCORD_LEAVING_TEXT = "VC から抜けています…";
/** 下の帯の「VC から抜ける」（2 回押し）。 */
export const DISCORD_LEAVE_TEXT = "VC から抜ける";
/** 下の帯の「VC から抜ける」の 1 回目（armed）。 */
export const DISCORD_LEAVE_ARMED_TEXT = "もう一度押すと VC から抜ける";
/**
 * Discord の場の間に話し始めの方式を見せるときの断り（サーバの DISCORD_SPEAK_START_FIXED_MESSAGE の写し・一致はテストで固定）。
 */
export const DISCORD_SPEAK_START_FIXED_NOTE = "Discord の通話では話し始めは speak-now に固定（替えられない）";
/** Discord の場の間、配信の準備の YouTube の欄に添える案内（Connect は出さない・サーバも 409 で断る）。 */
export const DISCORD_CHAT_HIDDEN_NOTE = "Discord の通話の間は YouTube のコメントにつながない（VC から抜けてから）";
/** Discord の場の間、配信の準備のタブのいちばん下に出す案内（配信を始めるのは VC から抜けてから）。 */
export const DISCORD_OPEN_NOTE_IN_STREAM_PREP = "Discord の VC に入っている（配信を始めるのは下の帯の「VC から抜ける」のあと）";
/** Discord の準備のタブのいちばん下（場が開いている間）の案内。 */
export const DISCORD_OPEN_NOTE = "Discord の VC に入っている（抜けるときは下の帯の「VC から抜ける」）";
/** 配信の場の間、Discord の準備のタブのいちばん下に出す案内。 */
export const STREAM_OPEN_NOTE_IN_DISCORD_PREP = "配信の途中（VC に入るのは配信を終えてから）";
/** 場が開いている間（Discord の場）は Discord の準備を替えられない（サーバも 409 で断る）。 */
export const DISCORD_PREP_LOCKED_NOTE = "VC に入っている間は Discord の準備を替えられない（VC から抜けてから）";
/** Discord の入口が無いサーバの Discord の準備のタブ。 */
export const DISCORD_UNAVAILABLE_NOTE = "この操縦席には Discord の入口が無い（Discord の VC には入れない）";
/** 会話の行の you の名前が無いとき（Discord の場・名前が取れなかった人）。判定の入力のラベル（speak-now.mjs）と同じ語。 */
export const DISCORD_PARTICIPANT_LABEL = "参加者";
/** 「選んでいない」の選択肢の文面。 */
export const DISCORD_NOT_CHOSEN_LABEL = "（選んでいない）";
/** 保存した値が一覧に無いときの選択肢の文面（id は出さない）。 */
export const DISCORD_SAVED_GUILD_LABEL = "保存したサーバー（「読み込む」で名前が出る）";
export const DISCORD_SAVED_CHANNEL_LABEL = "保存したボイスチャンネル（「読み込む」で名前が出る）";
/** 見る窓を使わない（目を起こさない）の選択肢。 */
export const DISCORD_NO_VISION_LABEL = "使わない（目を起こさない）";

/** 接続の状態の表示名（snapshot の stream.connection・VENUE_CONNECTION_STATES と同じ語彙）。 */
export const DISCORD_CONNECTION_LABELS = Object.freeze({
  joining: "VC に入っている途中",
  joined: "VC に入っている",
  disconnected: "VC から切れた（つなぎ直しを待っている）",
  // Discord モード Domain I（§13.4）: どの VC にもいない（体験は開いたまま）。パネル・文言の作り込みは Domain K。
  outside: "VC の外で待っている"
});

/**
 * 開いている（開きかけ・閉じかけを含む）場が Discord の場か（snapshot の stream.experience）。
 * @param {{ experience?: string | null } | null | undefined} stream
 * @returns {boolean}
 */
export function isDiscordVenue(stream) {
  return !!(stream && stream.experience === "discord");
}

/** @param {{ phase?: string } | null | undefined} stream @returns {"closed" | "opening" | "open" | "closing"} */
function phaseOf(stream) {
  const phase = stream && typeof stream.phase === "string" ? stream.phase : null;
  return phase === "opening" || phase === "open" || phase === "closing" ? phase : "closed";
}

/**
 * Discord の入口がこの操縦席にあるか（snapshot の discord = { available: true }・無い古いサーバ / 入口なしは false）。
 * @param {unknown} discord  snapshot の discord。
 */
export function discordAvailable(discord) {
  return !!(discord && typeof discord === "object" && /** @type {any} */ (discord).available === true);
}

/**
 * メイン画面・Discord の準備のタブの「Discord の VC に入る」。Discord の入口が無ければ出さない（show: false）。押せるのは場が
 * 閉じているときだけ。Discord の場の開きかけは「VC に入っています…」、閉じかけは「VC から抜けています…」。配信の場の間は
 * 「Discord の VC に入る」のまま押せない（場は同時に 1 つ）。
 * @param {{ phase?: string; experience?: string | null } | null | undefined} stream  snapshot の stream。
 * @param {boolean} available  discordAvailable(snapshot.discord)。
 * @returns {{ show: boolean; text: string; disabled: boolean }}
 */
export function discordJoinView(stream, available) {
  const phase = phaseOf(stream);
  const discord = isDiscordVenue(stream);
  const text = discord && phase === "opening" ? DISCORD_JOINING_TEXT : discord && phase === "closing" ? DISCORD_LEAVING_TEXT : DISCORD_JOIN_TEXT;
  return { show: !!available, text, disabled: phase !== "closed" };
}

/**
 * 接続の状態（上の帯に小さく・Discord の場の間だけ）。配信の場・閉じている間・知らない値は null（出さない）。
 * @param {{ experience?: string | null; connection?: string | null } | null | undefined} stream
 * @returns {{ text: string; className: string; title: string } | null}
 */
export function venueConnectionView(stream) {
  if (!isDiscordVenue(stream)) return null;
  const c = stream && typeof stream.connection === "string" ? stream.connection : null;
  if (c !== "joining" && c !== "joined" && c !== "disconnected" && c !== "outside") return null;
  return {
    text: DISCORD_CONNECTION_LABELS[c],
    className: "venue-connection " + c,
    title: c === "disconnected" ? "接続が切れた。場は閉じない（つなぎ直しはライブラリに任せる）" : DISCORD_CONNECTION_LABELS[c]
  };
}

/**
 * 会話の行の you の話者名（体験で替える・discord-mode.md §9「あなたの行も Discord の名前で出す」）。配信（と閉じている間・体験が
 * 分からないとき）は呼び出し側の既定（「配信者」）。Discord の場は行の displayName（無ければ「参加者」）。
 * @param {string | null | undefined} experience  snapshot の stream.experience。
 * @param {string | null | undefined} displayName  行の displayName。
 * @param {string} streamLabel  配信の you のラベル。
 * @returns {string}
 */
export function youLabelFor(experience, displayName, streamLabel) {
  if (experience !== "discord") return streamLabel;
  return typeof displayName === "string" && displayName.trim().length > 0 ? displayName.trim() : DISCORD_PARTICIPANT_LABEL;
}

/**
 * サーバーの選択肢（「読み込む」の一覧から・表示は名前だけ）。保存したサーバーが一覧に無い（まだ読み込んでいない）ときは
 * 決まった文面の選択肢で残す（id は表示しない）。
 * @param {{ guilds?: Array<{ id: string; name: string }> } | null | undefined} catalog
 * @param {string | null | undefined} savedGuildId
 * @returns {Array<{ value: string; label: string }>}
 */
export function discordGuildOptions(catalog, savedGuildId) {
  const guilds = catalog && Array.isArray(catalog.guilds) ? catalog.guilds : [];
  const options = [{ value: "", label: DISCORD_NOT_CHOSEN_LABEL }];
  for (const g of guilds) {
    if (!g || typeof g.id !== "string") continue;
    options.push({ value: g.id, label: typeof g.name === "string" && g.name ? g.name : "（名前の無いサーバー）" });
  }
  if (savedGuildId && !options.some((o) => o.value === savedGuildId)) options.push({ value: savedGuildId, label: DISCORD_SAVED_GUILD_LABEL });
  return options;
}

/**
 * ボイスチャンネルの選択肢（選んだサーバーのボイスチャンネル・表示は名前だけ）。保存したチャンネルが一覧に無いときは決まった文面で残す。
 * @param {{ guilds?: Array<{ id: string; channels?: Array<{ id: string; name: string }> }> } | null | undefined} catalog
 * @param {string | null | undefined} guildId  選んでいるサーバー。
 * @param {string | null | undefined} savedChannelId
 * @returns {Array<{ value: string; label: string }>}
 */
export function discordChannelOptions(catalog, guildId, savedChannelId) {
  const guilds = catalog && Array.isArray(catalog.guilds) ? catalog.guilds : [];
  const guild = guildId ? guilds.find((g) => g && g.id === guildId) : null;
  const channels = guild && Array.isArray(guild.channels) ? guild.channels : [];
  const options = [{ value: "", label: DISCORD_NOT_CHOSEN_LABEL }];
  for (const c of channels) {
    if (!c || typeof c.id !== "string") continue;
    options.push({ value: c.id, label: typeof c.name === "string" && c.name ? c.name : "（名前の無いチャンネル）" });
  }
  if (savedChannelId && !options.some((o) => o.value === savedChannelId)) {
    options.push({ value: savedChannelId, label: DISCORD_SAVED_CHANNEL_LABEL });
  }
  return options;
}

/**
 * 見る窓（目）の選択肢: 「使わない」+ 窓の一覧（配信の準備のゲームの窓と同じ GET /api/windows）。保存した窓が今の一覧に無ければ
 * 「（今は見当たらない）」を添えて残す。
 * @param {Array<{ value: string; label: string }>} windowOptions  windowListView の options（空の値の行は除く）。
 * @param {string | null | undefined} saved
 * @returns {Array<{ value: string; label: string }>}
 */
export function discordVisionOptions(windowOptions, saved) {
  const options = [{ value: "", label: DISCORD_NO_VISION_LABEL }];
  for (const o of Array.isArray(windowOptions) ? windowOptions : []) {
    if (o && typeof o.value === "string" && o.value !== "") options.push({ value: o.value, label: o.label });
  }
  if (saved && !options.some((o) => o.value === saved)) options.push({ value: saved, label: saved + "（今は見当たらない）" });
  return options;
}

/**
 * 見る窓の今の値の表示（Discord の準備のタブ）。
 * @param {string | null | undefined} title
 */
export function discordVisionLabel(title) {
  return title ? "見る窓: " + title : "見る窓: 使わない（Discord の場では目を起こさない）";
}

/**
 * Discord の準備の保存（POST /api/discord/prep・/api/discord/vision-target）の失敗文言。成功は null。
 * @param {{ ok: boolean; status: number; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function discordPrepPostErrorText(res) {
  if (res.ok) return null;
  if (res.status === 503) return DISCORD_UNAVAILABLE_NOTE;
  return (res.j && res.j.error) || "Discord の準備を保存できない";
}

/**
 * 一覧の読み込み（POST /api/discord/catalog）の失敗文言。成功は null。理由はサーバの決まった文面（鍵・id・名前を含まない）。
 * @param {{ ok: boolean; status: number; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function discordCatalogErrorText(res) {
  if (res.ok) return null;
  if (res.status === 503) return DISCORD_UNAVAILABLE_NOTE;
  return (res.j && res.j.error) || "サーバーとボイスチャンネルの一覧を読めない";
}
