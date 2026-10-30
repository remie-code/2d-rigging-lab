// @ts-check
/**
 * 受信の試し「probe-discord-receive」— apps/soul/agent。Discord の Bot が試しの VC に入り、
 * ユーザー 1 人の声が届くかを**数だけ**で確かめる。
 *
 * 目的: この部品（@discordjs/voice 0.19.2 + DAVE）で Discord 参加モードを作り始めてよいかを決める。
 * 合格・不合格の基準は discussion/ai-cohost/discord-vc/scope.md §16、置き場などの決めごとは §17。
 * 部品の版・復号失敗の数え方・ビープの最小形・名前の取り方は
 * discussion/ai-cohost/discord-vc/research/probe-external-2026-10.md。
 * 不具合 #11653 の修正案は当てない（素の 0.19.2 で数える。§17）。
 *
 * ── 数えるもの ─────────────────────────────────────────────────────
 *  発言（receiver.speaking の start → 購読ストリームの close）ごとに、パケット数・合計バイト数・
 *  Opus の無音フレーム（F8 FF FE）の数・opusscript で一度デコードして測った RMS（最大と平均）・
 *  その間の復号失敗（connection の debug の「Failed to decrypt a packet ...」行）。
 *  connection / 受信ストリーム / プレイヤーの error は種類ごとに数える。
 *  VC への入る・抜けるは Bot が入って（Ready）からの経過秒で記録する。
 *
 * ── 残さないもの（§15「声も文字起こしも残さない」）─────────────────────────
 *  デコードした PCM は RMS を測ったらその場で捨てる。声をファイルに書かない。文字起こしもしない。
 *  userId は表示上「話者#1」のような番号にする。名前は 1 人 1 回だけ取り、**ターミナルにだけ**出す。
 *  まとめファイルには名前も userId も書かず、「名前が取れたか」だけ書く。
 *  connection の debug 行はそのまま出さない（音声ゲートウェイの送受信の中身が載るため）。
 *  決まった形の復号失敗の行だけを数える。
 *
 * ── 鍵 ──────────────────────────────────────────────────────────
 *  `apps/soul/agent/.env.discord.local`（gitignore 済み）の `DISCORD_BOT_TOKEN` を
 *  loadDiscordBotToken で**コード内で直接読み**、その場で login に渡す（process.env に入れない。
 *  `--env-file` は使わない）。鍵の値はログ・例外メッセージ・まとめのどこにも載せない。
 *
 * ── 依存 ──────────────────────────────────────────────────────────
 *  discord.js 14.27.0 / @discordjs/voice 0.19.2 / opusscript 0.0.8（install はユーザー）。
 *  これらは main() の中で動的 import する。純関数（下の export）は Node 組み込みだけで動くので、
 *  依存が未 install でも node:test から import できる。
 *
 * 実行（apps/soul/agent で npm install 済みのこと）:
 *   node apps/soul/agent/scripts/probe-discord-receive.mjs --guild <guild> --channel <channel>
 *  キー操作: b = ピー（1 秒・440Hz）を鳴らす / q か Ctrl+C = 終わる。
 * 結果: apps/soul/agent/tmp/discord-receive/ に JSON を 1 本書く（tmp/ は root .gitignore で無視）。
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, parseEnv } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));

/** 鍵を置く env ファイルの変数名。 */
export const DISCORD_BOT_TOKEN_NAME = "DISCORD_BOT_TOKEN";

/** 鍵の置き場の既定（`apps/soul/agent/.env.discord.local`・gitignore 済み）。 */
export const DEFAULT_DISCORD_ENV_PATH = join(here, "..", ".env.discord.local");

/** まとめの置き場（`apps/soul/agent/tmp/discord-receive/`）。 */
export const DEFAULT_SUMMARY_DIR = join(here, "..", "tmp", "discord-receive");

/** 発言の区切り: 話し終わり（speaking end）からこの無音で購読ストリームを閉じる。 */
export const SILENCE_END_MS = 1000;

/** connection が Ready になるまでの待ち。 */
export const READY_TIMEOUT_MS = 30_000;

/** まとめに書く部品の版（node_modules の package.json から読む）。 */
export const VERSIONED_PACKAGES = Object.freeze([
  "discord.js",
  "@discordjs/voice",
  "@snazzah/davey",
  "prism-media",
  "opusscript"
]);

/** Opus の無音フレーム（3 バイト）。 */
const OPUS_SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

/** Discord の音声の形: 48kHz・2ch・s16le・20ms（960 サンプル）= 3840 バイト。 */
export const PCM_FORMAT = Object.freeze({ sampleRate: 48000, channels: 2, frameSamples: 960, frameBytes: 3840 });

const USAGE = "使い方: node apps/soul/agent/scripts/probe-discord-receive.mjs --guild <guild id> --channel <channel id>";

// ── 純関数（export・node:test の対象）─────────────────────────────────────

/**
 * 引数を読む。`--guild` と `--channel` は必須（ID はコードにも既定値にも置かない）。
 * @param {string[]} argv  process.argv.slice(2) 相当。
 * @returns {{ ok: true; guildId: string; channelId: string } | { ok: false; reason: string }}
 */
export function parseProbeArgs(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { guild: { type: "string" }, channel: { type: "string" } },
      strict: true,
      allowPositionals: false
    }));
  } catch (error) {
    return { ok: false, reason: `引数が読めない（${error instanceof Error ? error.message : String(error)}）。${USAGE}` };
  }
  /** @param {string} name @param {string | undefined} value */
  const check = (name, value) => {
    if (value === undefined || value.trim() === "") return `--${name} が無い。${USAGE}`;
    if (!/^\d{15,25}$/.test(value.trim())) return `--${name} は数字だけの ID を渡す。${USAGE}`;
    return null;
  };
  const problem = check("guild", values.guild) ?? check("channel", values.channel);
  if (problem) return { ok: false, reason: problem };
  return { ok: true, guildId: String(values.guild).trim(), channelId: String(values.channel).trim() };
}

/**
 * `.env.discord.local` から DISCORD_BOT_TOKEN を読む（process.env には入れない）。
 * 失敗理由に鍵の値は含めない。
 * @param {object} [options]
 * @param {string} [options.path=DEFAULT_DISCORD_ENV_PATH]
 * @param {(path: string) => string} [options.readFileImpl]  テスト注入（既定 readFileSync utf8）。
 * @returns {{ ok: true; token: string } | { ok: false; reason: string }}
 */
export function loadDiscordBotToken(options = {}) {
  const filePath = options.path ?? DEFAULT_DISCORD_ENV_PATH;
  const readFileImpl = options.readFileImpl ?? ((/** @type {string} */ p) => readFileSync(p, "utf8"));
  let text;
  try {
    text = readFileImpl(filePath);
  } catch {
    return { ok: false, reason: "Discord の鍵のファイルが読めない（apps/soul/agent/.env.discord.local）" };
  }
  let parsed;
  try {
    parsed = parseEnv(String(text));
  } catch {
    return { ok: false, reason: "Discord の鍵のファイルが読めない形になっている（apps/soul/agent/.env.discord.local）" };
  }
  const value = parsed[DISCORD_BOT_TOKEN_NAME];
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: `Discord の鍵が見つからない（apps/soul/agent/.env.discord.local の ${DISCORD_BOT_TOKEN_NAME}）` };
  }
  return { ok: true, token: value.trim() };
}

/**
 * ビープの PCM（48kHz・2ch・s16le）をその場で作る。長さは 20ms（3840 バイト）の倍数に切り上げる。
 * @param {object} [opts]
 * @param {number} [opts.hz=440]
 * @param {number} [opts.ms=1000]
 * @param {number} [opts.amp=0.2]  0..1。
 * @returns {Buffer}
 */
export function beepPcm(opts = {}) {
  const hz = opts.hz ?? 440;
  const ms = opts.ms ?? 1000;
  const amp = opts.amp ?? 0.2;
  const { sampleRate, channels, frameSamples } = PCM_FORMAT;
  const samples = Math.max(1, Math.ceil(ms / 20)) * frameSamples;
  const buf = Buffer.alloc(samples * channels * 2);
  for (let i = 0; i < samples; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * hz * i) / sampleRate) * amp * 32767);
    for (let ch = 0; ch < channels; ch++) buf.writeInt16LE(v, (i * channels + ch) * 2);
  }
  return buf;
}

/**
 * connection の debug 行から復号失敗を拾う（@discordjs/voice 0.19.2 の DAVE の文言。安定 API ではない）。
 *  - `Failed to decrypt a packet (N consecutive fails)` → consecutive（N 付き）
 *  - `Failed to decrypt a packet (reinitializing session)` → reinitializing
 *  - `Failed to decrypt a packet (K pending transition[s])` → pendingTransition（K 付き）
 *  - 上以外の `Failed to decrypt a packet` → other
 * @param {unknown} line
 * @returns {null | { kind: "consecutive"; consecutive: number } | { kind: "reinitializing" } | { kind: "pendingTransition"; pending: number } | { kind: "other" }}
 */
export function parseDecryptFailure(line) {
  if (typeof line !== "string" || !line.includes("Failed to decrypt a packet")) return null;
  const consecutive = /Failed to decrypt a packet \((\d+) consecutive fails?\)/.exec(line);
  if (consecutive) return { kind: "consecutive", consecutive: Number(consecutive[1]) };
  if (/Failed to decrypt a packet \(reinitializing session\)/.test(line)) return { kind: "reinitializing" };
  const pending = /Failed to decrypt a packet \((\d+) pending transitions?\)/.exec(line);
  if (pending) return { kind: "pendingTransition", pending: Number(pending[1]) };
  return { kind: "other" };
}

/**
 * Opus の無音フレーム（3 バイトの F8 FF FE）か。
 * @param {unknown} packet
 * @returns {boolean}
 */
export function isOpusSilenceFrame(packet) {
  return Buffer.isBuffer(packet) && packet.length === 3 && packet.equals(OPUS_SILENCE_FRAME);
}

/**
 * s16le PCM の RMS（0..1、32768 で割る）。空なら 0。端数の 1 バイトは無視する。
 * @param {Buffer} pcm
 * @returns {number}
 */
export function rmsOfS16le(pcm) {
  const n = Math.floor(pcm.length / 2);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = pcm.readInt16LE(i * 2) / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}

/**
 * 文字列の中の秘密（鍵）を伏せる。
 * @param {string} text
 * @param {string[]} [secrets]
 * @returns {string}
 */
export function redactSecrets(text, secrets = []) {
  let out = text;
  for (const s of secrets) {
    if (typeof s === "string" && s.length > 0) out = out.split(s).join("<redacted>");
  }
  return out;
}

/**
 * エラーの種類（数え上げの鍵）を短く作る: `出どころ:名前[:code] 本文の頭`。
 * 鍵は伏せ、数字は N にまとめる（連続回数で種類が割れないように。ID も残らない）。本文は 60 字まで。
 * @param {string} source  "connection" | "stream" | "player" | "process" など。
 * @param {unknown} error
 * @param {string[]} [secrets]
 * @returns {string}
 */
export function errorKind(source, error, secrets = []) {
  const e = /** @type {any} */ (error);
  const name = typeof e?.name === "string" && e.name ? e.name : typeof error;
  const code = e?.code !== undefined && e?.code !== null ? `:${String(e.code)}` : "";
  const rawMessage = typeof e?.message === "string" ? e.message : typeof error === "string" ? error : "";
  const message = redactSecrets(rawMessage, secrets).replace(/\d+/g, "N").replace(/\s+/g, " ").trim().slice(0, 60);
  return redactSecrets(`${source}:${name}${code}${message ? ` ${message}` : ""}`, secrets).replace(/\d{6,}/g, "N");
}

/** @param {number} n @param {number} [digits=1] */
const round = (n, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/**
 * 数え上げの入れ物。userId はここ（speakers の Map の鍵）にだけ持ち、まとめには出さない。
 * @param {object} [opts]
 * @param {number} [opts.startedAtMs]  起動時刻（壁時計 ms）。
 */
export function createProbeTally(opts = {}) {
  return {
    startedAtMs: opts.startedAtMs ?? Date.now(),
    /** Bot が VC に入った（Ready）時刻。経過秒の原点。 */
    t0: /** @type {number | null} */ (null),
    readyAfterMs: /** @type {number | null} */ (null),
    presentAtJoin: 0,
    /** @type {Map<string, { label: string; index: number; nameTried: boolean; nameResolved: boolean | null; lastJoinSec: number | null; ordinalSinceJoin: number; lastEndSec: number | null }>} */
    speakers: new Map(),
    /** @type {ReturnType<typeof endUtterance>[]} */
    utterances: [],
    decrypt: { total: 0, consecutive: 0, reinitializing: 0, pendingTransition: 0, other: 0, maxConsecutive: 0 },
    /** @type {Record<string, number>} */
    errors: {},
    /** @type {{ sec: number | null; speaker: string; type: "join" | "leave" }[]} */
    voiceEvents: [],
    /** @type {Record<string, number>} */
    connectionStates: {},
    beeps: { requested: 0, played: 0, errors: 0 }
  };
}

/** @typedef {ReturnType<typeof createProbeTally>} ProbeTally */

/**
 * userId → 話者の番号（初めて見た順に 話者#1, 話者#2 ...）。
 * @param {ProbeTally} tally
 * @param {string} userId
 */
export function speakerOf(tally, userId) {
  let s = tally.speakers.get(userId);
  if (!s) {
    const index = tally.speakers.size + 1;
    s = { label: `話者#${index}`, index, nameTried: false, nameResolved: null, lastJoinSec: null, ordinalSinceJoin: 0, lastEndSec: null };
    tally.speakers.set(userId, s);
  }
  return s;
}

/**
 * Bot が入った（connection Ready）。経過秒の原点を置く。
 * @param {ProbeTally} tally
 * @param {number} nowMs
 * @param {number} joinStartedMs  joinVoiceChannel を呼んだ時刻。
 */
export function markReady(tally, nowMs, joinStartedMs) {
  tally.t0 = nowMs;
  tally.readyAfterMs = nowMs - joinStartedMs;
}

/**
 * Bot が入ってからの経過秒（0.1 秒単位）。入る前は null。
 * @param {ProbeTally} tally
 * @param {number} nowMs
 * @returns {number | null}
 */
export function elapsedSec(tally, nowMs) {
  return tally.t0 === null ? null : round((nowMs - tally.t0) / 1000);
}

/**
 * Bot が入った時点で VC にいた人を数える（入った直後の取りこぼしの場面かどうかの目印）。
 * @param {ProbeTally} tally
 * @param {string[]} userIds
 */
export function recordPresentAtJoin(tally, userIds) {
  tally.presentAtJoin = userIds.length;
  for (const id of userIds) {
    const s = speakerOf(tally, id);
    s.lastJoinSec = 0;
    s.ordinalSinceJoin = 0;
  }
}

/**
 * VC への入る・抜けるを記録する。
 * @param {ProbeTally} tally
 * @param {string} userId
 * @param {"join" | "leave"} type
 * @param {number} nowMs
 */
export function recordVoiceEvent(tally, userId, type, nowMs) {
  const s = speakerOf(tally, userId);
  const sec = elapsedSec(tally, nowMs);
  if (type === "join") {
    s.lastJoinSec = sec;
    s.ordinalSinceJoin = 0;
  }
  const event = { sec, speaker: s.label, type };
  tally.voiceEvents.push(event);
  return event;
}

/**
 * debug 行を 1 本受け取る。復号失敗なら数えて中身を返す（それ以外は null）。
 * @param {ProbeTally} tally
 * @param {unknown} line
 */
export function recordDebugLine(tally, line) {
  const parsed = parseDecryptFailure(line);
  if (!parsed) return null;
  const d = tally.decrypt;
  d.total += 1;
  d[parsed.kind] += 1;
  if (parsed.kind === "consecutive") d.maxConsecutive = Math.max(d.maxConsecutive, parsed.consecutive);
  return parsed;
}

/**
 * エラーを種類ごとに数える。種類の文字列を返す（ターミナルに出してよい短さ）。
 * @param {ProbeTally} tally
 * @param {string} source
 * @param {unknown} error
 * @param {string[]} [secrets]
 */
export function recordError(tally, source, error, secrets = []) {
  const kind = errorKind(source, error, secrets);
  tally.errors[kind] = (tally.errors[kind] ?? 0) + 1;
  return kind;
}

/**
 * connection の状態の移り変わりを数える。
 * @param {ProbeTally} tally
 * @param {string} status
 */
export function recordConnectionState(tally, status) {
  tally.connectionStates[status] = (tally.connectionStates[status] ?? 0) + 1;
}

/**
 * 発言を始める（speaking start で購読したとき）。
 * @param {ProbeTally} tally
 * @param {string} userId
 * @param {number} nowMs
 */
export function beginUtterance(tally, userId, nowMs) {
  const s = speakerOf(tally, userId);
  s.ordinalSinceJoin += 1;
  return {
    speaker: s.label,
    ordinalSinceJoin: s.ordinalSinceJoin,
    startMs: nowMs,
    gapBeforeSec: s.lastEndSec === null || tally.t0 === null ? null : round((nowMs - tally.t0) / 1000 - s.lastEndSec),
    packets: 0,
    bytes: 0,
    silenceFrames: 0,
    decoded: 0,
    decodeErrors: 0,
    rmsMax: 0,
    rmsSum: 0,
    decryptAtStart: tally.decrypt.total
  };
}

/** @typedef {ReturnType<typeof beginUtterance>} OpenUtterance */

/**
 * パケットを 1 つ数える。無音フレームなら true（デコードは要らない）。
 * @param {OpenUtterance} u
 * @param {Buffer} packet
 * @returns {boolean}
 */
export function addPacket(u, packet) {
  u.packets += 1;
  u.bytes += packet.length;
  const silent = isOpusSilenceFrame(packet);
  if (silent) u.silenceFrames += 1;
  return silent;
}

/**
 * デコードしたパケット 1 つ分の RMS を足す。
 * @param {OpenUtterance} u
 * @param {number} rms
 */
export function addRms(u, rms) {
  u.decoded += 1;
  u.rmsSum += rms;
  if (rms > u.rmsMax) u.rmsMax = rms;
}

/**
 * デコードの失敗を 1 つ数える。
 * @param {OpenUtterance} u
 */
export function addDecodeError(u) {
  u.decodeErrors += 1;
}

/**
 * 発言を閉じて記録する（userId は持たない。話者の番号だけ）。
 * @param {ProbeTally} tally
 * @param {string} userId
 * @param {OpenUtterance} u
 * @param {number} nowMs
 * @param {"silence" | "error" | "shutdown"} endedBy
 * @param {string | null} [streamError]  エラーの種類（errorKind）。
 */
export function endUtterance(tally, userId, u, nowMs, endedBy, streamError = null) {
  const s = speakerOf(tally, userId);
  const startSec = tally.t0 === null ? null : round((u.startMs - tally.t0) / 1000);
  const endSec = elapsedSec(tally, nowMs);
  s.lastEndSec = endSec;
  const record = {
    index: tally.utterances.length + 1,
    speaker: u.speaker,
    ordinalSinceJoin: u.ordinalSinceJoin,
    startSec,
    durationSec: round((nowMs - u.startMs) / 1000),
    gapBeforeSec: u.gapBeforeSec,
    packets: u.packets,
    bytes: u.bytes,
    silenceFrames: u.silenceFrames,
    decodeErrors: u.decodeErrors,
    rmsMax: round(u.rmsMax, 4),
    rmsMean: u.decoded === 0 ? 0 : round(u.rmsSum / u.decoded, 4),
    decryptFails: tally.decrypt.total - u.decryptAtStart,
    endedBy,
    streamError
  };
  tally.utterances.push(record);
  return record;
}

/**
 * 名前が取れたかを記録する（名前そのものは持たない）。
 * @param {ProbeTally} tally
 * @param {string} userId
 * @param {boolean} resolved
 */
export function recordNameResolved(tally, userId, resolved) {
  speakerOf(tally, userId).nameResolved = resolved;
}

/**
 * まとめ（JSON に書く中身）。数だけ。名前も userId も入れない。
 * @param {ProbeTally} tally
 * @param {object} meta
 * @param {number} meta.endedAtMs
 * @param {Record<string, string | null>} meta.versions
 */
export function buildSummary(tally, meta) {
  const speakers = [...tally.speakers.values()].map((s) => {
    const us = tally.utterances.filter((u) => u.speaker === s.label);
    return {
      speaker: s.label,
      nameResolved: s.nameResolved === true,
      utterances: us.length,
      emptyUtterances: us.filter((u) => u.packets === 0).length,
      packets: us.reduce((a, u) => a + u.packets, 0),
      bytes: us.reduce((a, u) => a + u.bytes, 0),
      silenceFrames: us.reduce((a, u) => a + u.silenceFrames, 0),
      decryptFails: us.reduce((a, u) => a + u.decryptFails, 0),
      rmsMax: round(Math.max(0, ...us.map((u) => u.rmsMax)), 4),
      rmsMeanOfUtterances: us.length === 0 ? 0 : round(us.reduce((a, u) => a + u.rmsMean, 0) / us.length, 4)
    };
  });
  const all = tally.utterances;
  return {
    probe: "discord-receive",
    schemaVersion: 1,
    startedAt: new Date(tally.startedAtMs).toISOString(),
    durationSec: round((meta.endedAtMs - tally.startedAtMs) / 1000),
    versions: { node: process.versions.node, ...meta.versions },
    connection: { readyAfterMs: tally.readyAfterMs, states: { ...tally.connectionStates } },
    presentAtJoin: tally.presentAtJoin,
    totals: {
      utterances: all.length,
      emptyUtterances: all.filter((u) => u.packets === 0).length,
      packets: all.reduce((a, u) => a + u.packets, 0),
      bytes: all.reduce((a, u) => a + u.bytes, 0),
      silenceFrames: all.reduce((a, u) => a + u.silenceFrames, 0),
      decodeErrors: all.reduce((a, u) => a + u.decodeErrors, 0),
      rmsMax: round(Math.max(0, ...all.map((u) => u.rmsMax)), 4),
      rmsMeanOfUtterances: all.length === 0 ? 0 : round(all.reduce((a, u) => a + u.rmsMean, 0) / all.length, 4)
    },
    speakers,
    utterances: all.map((u) => ({ ...u })),
    decryptFailures: { ...tally.decrypt },
    errors: { ...tally.errors },
    voiceEvents: tally.voiceEvents.map((e) => ({ ...e })),
    beeps: { ...tally.beeps }
  };
}

/** @param {number | null} sec */
const secLabel = (sec) => (sec === null ? "  --.-s" : `${sec.toFixed(1).padStart(6)}s`);

/**
 * 発言 1 行（ターミナル用）。
 * @param {ReturnType<typeof endUtterance>} r
 * @returns {string}
 */
export function formatUtteranceLine(r) {
  const parts = [
    `[${secLabel(r.startSec)}] ${r.speaker} 発言${r.ordinalSinceJoin}`,
    `パケット ${r.packets}`,
    `無音 ${r.silenceFrames}`,
    `RMS 最大 ${r.rmsMax.toFixed(3)} 平均 ${r.rmsMean.toFixed(3)}`,
    `復号失敗 ${r.decryptFails}`,
    `${r.durationSec.toFixed(1)}秒`
  ];
  if (r.gapBeforeSec !== null) parts.push(`前の発言から ${r.gapBeforeSec.toFixed(1)}秒`);
  if (r.decodeErrors > 0) parts.push(`デコード失敗 ${r.decodeErrors}`);
  if (r.streamError) parts.push(`エラー ${r.streamError}`);
  if (r.endedBy === "shutdown") parts.push("終了で打ち切り");
  return parts.join(" / ");
}

/**
 * 入る・抜けるの 1 行（ターミナル用）。
 * @param {{ sec: number | null; speaker: string; type: "join" | "leave" }} e
 * @returns {string}
 */
export function formatVoiceEventLine(e) {
  return `[${secLabel(e.sec)}] ${e.speaker} が VC ${e.type === "join" ? "に入った" : "を抜けた"}`;
}

/**
 * 入っている部品の版を node_modules の package.json から読む（無ければ null）。
 * @param {readonly string[]} names
 * @param {object} [options]
 * @param {string} [options.nodeModulesDir]
 * @param {(path: string) => Promise<string>} [options.readFileImpl]
 * @returns {Promise<Record<string, string | null>>}
 */
export async function readInstalledVersions(names, options = {}) {
  const dir = options.nodeModulesDir ?? join(here, "..", "node_modules");
  const readFileImpl = options.readFileImpl ?? ((/** @type {string} */ p) => readFile(p, "utf8"));
  /** @type {Record<string, string | null>} */
  const out = {};
  for (const name of names) {
    try {
      const pkg = JSON.parse(await readFileImpl(join(dir, ...name.split("/"), "package.json")));
      out[name] = typeof pkg.version === "string" ? pkg.version : null;
    } catch {
      out[name] = null;
    }
  }
  return out;
}

/** 起動時に出す確かめの台本。 */
export const PROBE_SCRIPT_LINES = Object.freeze([
  "── 確かめの台本 ──",
  "  1. Bot が入ったら、しばらく黙ってからしゃべる（数回）。",
  "  2. いったん VC を抜けて入り直し、しゃべる。",
  "  3. b を押してピーが聞こえるか確かめる。",
  "  4. 不具合の場面は起動し直して確かめる: ユーザーが先に VC にいる状態でスクリプトを起動し、",
  "     Bot が入った直後にしゃべる。2 回目以降の発言で戻るかも見る。",
  "  キー: b = ピー / q か Ctrl+C = 終わる（VC を抜けて、まとめを書く）"
]);

// ── 本体（Discord に繋ぐ。依存はここで動的 import）──────────────────────────

/** @param {string} line */
const say = (line) => process.stdout.write(`${line}\n`);

/** main() の外の例外の表示でも鍵を伏せるため（main() が読んだ鍵を置く）。 */
/** @type {string[]} */
let activeSecrets = [];

async function main() {
  const args = parseProbeArgs(process.argv.slice(2));
  if (!args.ok) {
    process.stderr.write(`[probe-discord-receive] ${args.reason}\n`);
    process.exit(2);
  }
  const loaded = loadDiscordBotToken();
  if (!loaded.ok) {
    process.stderr.write(`[probe-discord-receive] ${loaded.reason}\n`);
    process.exit(1);
  }
  const secrets = [loaded.token];
  activeSecrets = secrets;

  let discord, voice, OpusScript;
  try {
    const d = await import("discord.js");
    discord = /** @type {any} */ (d).Client ? d : /** @type {any} */ (d).default;
    voice = await import("@discordjs/voice");
    const o = await import("opusscript");
    OpusScript = /** @type {any} */ (o).default ?? o;
  } catch {
    process.stderr.write("[probe-discord-receive] 依存が入っていない（apps/soul/agent で npm install）\n");
    process.exit(1);
  }
  const { Client, Events, GatewayIntentBits } = /** @type {any} */ (discord);
  const { joinVoiceChannel, entersState, VoiceConnectionStatus, EndBehaviorType, createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus, generateDependencyReport } =
    /** @type {any} */ (voice);

  const tally = createProbeTally();
  const versions = await readInstalledVersions(VERSIONED_PACKAGES);

  for (const line of PROBE_SCRIPT_LINES) say(line);
  say("");
  say("── 部品 ──");
  say(generateDependencyReport());

  /** @type {Map<string, any>} */
  const decoders = new Map();
  /** @type {Map<string, { stream: any; finalize: (endedBy: "silence" | "error" | "shutdown") => void }>} */
  const open = new Map();
  let shuttingDown = false;
  /** @type {any} */
  let connection = null;
  /** @type {any} */
  let player = null;

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  client.on("error", (/** @type {unknown} */ e) => say(`エラー ${recordError(tally, "client", e, secrets)}`));

  const shutdown = async (/** @type {number} */ code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    say("");
    say("終わる: VC を抜けて、まとめを書く");
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {}
    }
    process.stdin.pause();
    for (const { stream, finalize } of [...open.values()]) {
      finalize("shutdown");
      try {
        stream.destroy();
      } catch {}
    }
    try {
      player?.stop(true);
    } catch {}
    try {
      connection?.destroy();
    } catch {}
    for (const d of decoders.values()) {
      try {
        d.delete?.();
      } catch {}
    }
    try {
      await client.destroy();
    } catch {}
    const summary = buildSummary(tally, { endedAtMs: Date.now(), versions });
    await mkdir(DEFAULT_SUMMARY_DIR, { recursive: true });
    const file = join(DEFAULT_SUMMARY_DIR, `${new Date(tally.startedAtMs).toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(file, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    const t = summary.totals;
    say(`発言 ${t.utterances}（パケット 0 の発言 ${t.emptyUtterances}）/ パケット ${t.packets} / 復号失敗 ${summary.decryptFailures.total} / エラー ${Object.values(summary.errors).reduce((a, n) => a + n, 0)}`);
    say(`まとめ: ${relative(process.cwd(), file)}`);
    process.exit(code);
  };

  process.on("SIGINT", () => void shutdown(0));
  process.on("unhandledRejection", (e) => say(`エラー ${recordError(tally, "process", e, secrets)}`));

  try {
    const ready = new Promise((resolve) => client.once(Events.ClientReady, resolve));
    await client.login(loaded.token);
    await ready;
  } catch (e) {
    process.stderr.write(`[probe-discord-receive] ログインできない（${errorKind("login", e, secrets)}）\n`);
    try {
      await client.destroy();
    } catch {}
    process.exit(1);
  }
  const botId = client.user.id;

  let guild, channel;
  try {
    guild = await client.guilds.fetch(args.guildId);
    channel = await guild.channels.fetch(args.channelId);
  } catch (e) {
    say(`サーバーか VC が見つからない（${errorKind("fetch", e, secrets)}）`);
    await shutdown(1);
    return;
  }
  if (!channel || !channel.isVoiceBased?.()) {
    say("--channel が VC ではない");
    await shutdown(1);
    return;
  }

  // 名前は 1 人 1 回だけ取り、ターミナルにだけ出す。
  const ensureName = async (/** @type {string} */ userId) => {
    const s = speakerOf(tally, userId);
    if (s.nameTried) return;
    s.nameTried = true;
    /** @type {string | null} */
    let name = null;
    try {
      name = (await guild.members.fetch(userId))?.displayName ?? null;
    } catch {}
    if (!name) {
      try {
        name = (await client.users.fetch(userId))?.displayName ?? null;
      } catch {}
    }
    recordNameResolved(tally, userId, name !== null);
    say(name !== null ? `${s.label} の名前: ${name}` : `${s.label} の名前は取れなかった`);
  };

  client.on(Events.VoiceStateUpdate, (/** @type {any} */ oldState, /** @type {any} */ newState) => {
    if (newState.guild?.id !== args.guildId) return;
    const userId = newState.id;
    if (userId === botId) return;
    const was = oldState.channelId === args.channelId;
    const now = newState.channelId === args.channelId;
    if (was === now) return;
    const e = recordVoiceEvent(tally, userId, now ? "join" : "leave", Date.now());
    say(formatVoiceEventLine(e));
    void ensureName(userId);
  });

  const joinStartedMs = Date.now();
  connection = joinVoiceChannel({
    channelId: args.channelId,
    guildId: args.guildId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
    debug: true
  });
  // debug 行はそのまま出さない（音声ゲートウェイの送受信の中身が載る）。復号失敗の行だけ数える。
  connection.on("debug", (/** @type {string} */ line) => {
    recordDebugLine(tally, line);
  });
  connection.on("error", (/** @type {unknown} */ e) => say(`エラー ${recordError(tally, "connection", e, secrets)}`));
  connection.on("stateChange", (/** @type {any} */ _old, /** @type {any} */ next) => {
    recordConnectionState(tally, next.status);
    if (tally.t0 !== null) say(`[${secLabel(elapsedSec(tally, Date.now()))}] connection: ${next.status}`);
    if (next.status === VoiceConnectionStatus.Destroyed && !shuttingDown) void shutdown(1);
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, READY_TIMEOUT_MS);
  } catch (e) {
    say(`VC に入れなかった（${recordError(tally, "ready", e, secrets)}）`);
    await shutdown(1);
    return;
  }
  markReady(tally, Date.now(), joinStartedMs);
  const present = [...channel.members.keys()].filter((id) => id !== botId);
  recordPresentAtJoin(tally, present);
  say(`[${secLabel(0)}] Bot が VC に入った（${tally.readyAfterMs}ms）。先にいた人: ${present.length}`);
  for (const id of present) void ensureName(id);

  const receiver = connection.receiver;
  receiver.speaking.on("start", (/** @type {string} */ userId) => {
    if (userId === botId || shuttingDown) return;
    void ensureName(userId);
    // 同じ人の購読が続いている間（無音で閉じる前）は、同じ発言として数え続ける。
    if (receiver.subscriptions.has(userId)) return;
    const u = beginUtterance(tally, userId, Date.now());
    let decoder = decoders.get(userId);
    if (!decoder) {
      decoder = new OpusScript(PCM_FORMAT.sampleRate, PCM_FORMAT.channels, OpusScript.Application.AUDIO);
      decoders.set(userId, decoder);
    }
    const stream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: SILENCE_END_MS } });
    /** @type {string | null} */
    let streamError = null;
    let finalized = false;
    // close を待たずに終わるとき（shutdown）も、ここで 1 回だけ記録する。
    const finalize = (/** @type {"silence" | "error" | "shutdown"} */ endedBy) => {
      if (finalized) return;
      finalized = true;
      open.delete(userId);
      say(formatUtteranceLine(endUtterance(tally, userId, u, Date.now(), endedBy, streamError)));
    };
    open.set(userId, { stream, finalize });
    stream.on("data", (/** @type {Buffer} */ packet) => {
      if (addPacket(u, packet)) return;
      try {
        // デコードした PCM は RMS を測ったらその場で捨てる（書かない・溜めない）。
        const pcm = decoder.decode(packet);
        addRms(u, rmsOfS16le(Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)));
      } catch {
        addDecodeError(u);
      }
    });
    stream.on("error", (/** @type {unknown} */ e) => {
      streamError = recordError(tally, "stream", e, secrets);
    });
    stream.once("close", () => finalize(streamError ? "error" : shuttingDown ? "shutdown" : "silence"));
  });

  const beep = () => {
    tally.beeps.requested += 1;
    if (connection.state.status !== VoiceConnectionStatus.Ready) {
      say("まだ VC に入っていないので鳴らせない");
      return;
    }
    if (!player) {
      player = createAudioPlayer();
      player.on("error", (/** @type {unknown} */ e) => {
        tally.beeps.errors += 1;
        say(`エラー ${recordError(tally, "player", e, secrets)}`);
      });
      player.on("stateChange", (/** @type {any} */ old, /** @type {any} */ next) => {
        if (next.status === AudioPlayerStatus.Playing && old.status !== AudioPlayerStatus.Playing) {
          tally.beeps.played += 1;
          say(`[${secLabel(elapsedSec(tally, Date.now()))}] ピーを流し始めた`);
        }
        if (next.status === AudioPlayerStatus.Idle && old.status !== AudioPlayerStatus.Idle) {
          say(`[${secLabel(elapsedSec(tally, Date.now()))}] ピーが終わった`);
        }
      });
      connection.subscribe(player);
    }
    player.play(createAudioResource(Readable.from([beepPcm({ hz: 440, ms: 1000 })]), { inputType: StreamType.Raw }));
  };

  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (/** @type {string} */ key) => {
    if (key === "q" || key === "\u0003") void shutdown(0);
    else if (key === "b") beep();
  });
  process.stdin.resume();
  say("聞いている（b = ピー / q = 終わる）");
}

// direct execution ガード（node:test からの import では main() を走らせない。bench-name-prompt.mjs と同じ形）。
const isMainModule = (() => {
  try {
    return process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`[probe-discord-receive] FAILED: ${errorKind("main", error, activeSecrets)}\n`);
    process.exit(1);
  });
}
