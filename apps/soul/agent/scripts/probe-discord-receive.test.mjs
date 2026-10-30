// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseProbeArgs,
  loadDiscordBotToken,
  beepPcm,
  parseDecryptFailure,
  isOpusSilenceFrame,
  rmsOfS16le,
  redactSecrets,
  errorKind,
  createProbeTally,
  speakerOf,
  markReady,
  elapsedSec,
  recordPresentAtJoin,
  recordVoiceEvent,
  recordDebugLine,
  recordError,
  recordConnectionState,
  beginUtterance,
  addPacket,
  addRms,
  addDecodeError,
  endUtterance,
  recordNameResolved,
  buildSummary,
  formatUtteranceLine,
  formatVoiceEventLine,
  readInstalledVersions,
  DEFAULT_DISCORD_ENV_PATH,
  DEFAULT_SUMMARY_DIR,
  PCM_FORMAT,
  PROBE_SCRIPT_LINES
} from "./probe-discord-receive.mjs";

// probe-discord-receive.mjs の純関数の機械テスト（Discord に繋がない・依存の discord.js /
// @discordjs/voice / opusscript を読まない）。main() は direct execution ガードで走らない。

const GUILD = "123456789012345678";
const CHANNEL = "234567890123456789";
const USER = "345678901234567890";
const FAKE_TOKEN = "fake.token-for-test_only";

// ── 引数 ──────────────────────────────────────────────────────────

test("parseProbeArgs: --guild と --channel を数字の ID として受け取る", () => {
  assert.deepEqual(parseProbeArgs(["--guild", GUILD, "--channel", CHANNEL]), { ok: true, guildId: GUILD, channelId: CHANNEL });
  assert.deepEqual(parseProbeArgs([`--guild=${GUILD}`, `--channel=${CHANNEL}`]), { ok: true, guildId: GUILD, channelId: CHANNEL });
});

test("parseProbeArgs: 片方でも無ければ失敗（既定値を持たない）", () => {
  const noChannel = parseProbeArgs(["--guild", GUILD]);
  assert.equal(noChannel.ok, false);
  assert.match(/** @type {any} */ (noChannel).reason, /--channel/);
  const noGuild = parseProbeArgs(["--channel", CHANNEL]);
  assert.equal(noGuild.ok, false);
  assert.match(/** @type {any} */ (noGuild).reason, /--guild/);
  assert.equal(parseProbeArgs([]).ok, false);
});

test("parseProbeArgs: 数字でない ID・知らない引数・位置引数は失敗", () => {
  assert.equal(parseProbeArgs(["--guild", "abc", "--channel", CHANNEL]).ok, false);
  assert.equal(parseProbeArgs(["--guild", "123", "--channel", CHANNEL]).ok, false);
  assert.equal(parseProbeArgs(["--guild", GUILD, "--channel", CHANNEL, "--token", "x"]).ok, false);
  assert.equal(parseProbeArgs(["--guild", GUILD, "--channel", CHANNEL, "extra"]).ok, false);
});

// ── 鍵の読み取り ─────────────────────────────────────────────────────

test("loadDiscordBotToken: 一時ディレクトリの偽ファイルから DISCORD_BOT_TOKEN を読み、process.env を変えない", () => {
  const dir = mkdtempSync(join(tmpdir(), "probe-discord-receive-"));
  try {
    const path = join(dir, ".env.discord.local");
    writeFileSync(path, `# comment\nOTHER=1\nDISCORD_BOT_TOKEN=${FAKE_TOKEN}\n`, "utf8");
    const before = { ...process.env };
    assert.deepEqual(loadDiscordBotToken({ path }), { ok: true, token: FAKE_TOKEN });
    assert.deepEqual({ ...process.env }, before);
    assert.equal(process.env.DISCORD_BOT_TOKEN, before.DISCORD_BOT_TOKEN);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadDiscordBotToken: ファイルが無い・キーが無い・空なら短いエラー（鍵の中身を含めない）", () => {
  const dir = mkdtempSync(join(tmpdir(), "probe-discord-receive-"));
  try {
    const missing = loadDiscordBotToken({ path: join(dir, "nope.local") });
    assert.equal(missing.ok, false);

    const noKey = join(dir, "no-key.local");
    writeFileSync(noKey, `SOMETHING_ELSE=${FAKE_TOKEN}\n`, "utf8");
    const r1 = loadDiscordBotToken({ path: noKey });
    assert.equal(r1.ok, false);
    assert.match(/** @type {any} */ (r1).reason, /DISCORD_BOT_TOKEN/);
    assert.ok(!/** @type {any} */ (r1).reason.includes(FAKE_TOKEN));

    const empty = join(dir, "empty.local");
    writeFileSync(empty, "DISCORD_BOT_TOKEN=   \n", "utf8");
    assert.equal(loadDiscordBotToken({ path: empty }).ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadDiscordBotToken: readFileImpl を差し替えられ、既定の置き場は apps/soul/agent/.env.discord.local", () => {
  /** @type {string[]} */
  const seen = [];
  const r = loadDiscordBotToken({ readFileImpl: (p) => (seen.push(p), `DISCORD_BOT_TOKEN= ${FAKE_TOKEN} \n`) });
  assert.deepEqual(r, { ok: true, token: FAKE_TOKEN });
  assert.deepEqual(seen, [DEFAULT_DISCORD_ENV_PATH]);
  assert.match(DEFAULT_DISCORD_ENV_PATH.replace(/\\/g, "/"), /apps\/soul\/agent\/\.env\.discord\.local$/);
  assert.match(DEFAULT_SUMMARY_DIR.replace(/\\/g, "/"), /apps\/soul\/agent\/tmp\/discord-receive$/);
});

// ── ビープ ────────────────────────────────────────────────────────

test("beepPcm: 48kHz・2ch・s16le で 3840 バイトの倍数、既定は 1 秒", () => {
  const buf = beepPcm();
  assert.equal(PCM_FORMAT.frameBytes, PCM_FORMAT.frameSamples * PCM_FORMAT.channels * 2);
  assert.equal(buf.length % 3840, 0);
  assert.equal(buf.length, 48000 * 2 * 2);
  // 端数の長さは 20ms 単位に切り上げる。
  assert.equal(beepPcm({ ms: 301 }).length, 16 * 3840);
  assert.equal(beepPcm({ ms: 0 }).length, 3840);
});

test("beepPcm: 左右が同じ値で、振幅は amp に収まり、無音ではない", () => {
  const amp = 0.2;
  const buf = beepPcm({ hz: 440, ms: 100, amp });
  let peak = 0;
  for (let i = 0; i < buf.length; i += 4) {
    const l = buf.readInt16LE(i);
    assert.equal(buf.readInt16LE(i + 2), l);
    peak = Math.max(peak, Math.abs(l));
  }
  assert.ok(peak <= Math.round(amp * 32767));
  assert.ok(peak > amp * 32767 * 0.9);
  const rms = rmsOfS16le(buf);
  assert.ok(Math.abs(rms - amp / Math.SQRT2) < 0.01, `rms=${rms}`);
});

// ── 復号失敗の解析 ───────────────────────────────────────────────────

test("parseDecryptFailure: debug 行の 3 つの形と、それ以外", () => {
  assert.deepEqual(parseDecryptFailure("[NW] [DAVE] Failed to decrypt a packet (3 consecutive fails)"), { kind: "consecutive", consecutive: 3 });
  assert.deepEqual(parseDecryptFailure("[DAVE] Failed to decrypt a packet (1 consecutive fail)"), { kind: "consecutive", consecutive: 1 });
  assert.deepEqual(parseDecryptFailure("[NW] [DAVE] Failed to decrypt a packet (reinitializing session)"), { kind: "reinitializing" });
  assert.deepEqual(parseDecryptFailure("[NW] [DAVE] Failed to decrypt a packet (2 pending transitions)"), { kind: "pendingTransition", pending: 2 });
  assert.deepEqual(parseDecryptFailure("[NW] [DAVE] Failed to decrypt a packet (1 pending transition)"), { kind: "pendingTransition", pending: 1 });
  assert.deepEqual(parseDecryptFailure("[NW] [DAVE] Failed to decrypt a packet (something new)"), { kind: "other" });
  assert.equal(parseDecryptFailure("[NW] [DAVE] Preparing for transition (1, v1)"), null);
  assert.equal(parseDecryptFailure("[WS] >> {}"), null);
  assert.equal(parseDecryptFailure(undefined), null);
});

test("recordDebugLine: 種類ごと・合計・連続の最大を数え、関係ない行は数えない", () => {
  const t = createProbeTally({ startedAtMs: 0 });
  recordDebugLine(t, "[NW] [DAVE] Failed to decrypt a packet (1 consecutive fails)");
  recordDebugLine(t, "[NW] [DAVE] Failed to decrypt a packet (2 consecutive fails)");
  recordDebugLine(t, "[NW] [DAVE] Failed to decrypt a packet (reinitializing session)");
  recordDebugLine(t, "[NW] [DAVE] Failed to decrypt a packet (1 pending transition)");
  recordDebugLine(t, "[NW] [DAVE] MLS commit processed (transition id: 0)");
  recordDebugLine(t, "[NW] [DAVE] Failed to decrypt a packet (1 consecutive fails)");
  assert.deepEqual(t.decrypt, { total: 5, consecutive: 3, reinitializing: 1, pendingTransition: 1, other: 0, maxConsecutive: 2 });
});

// ── パケット・RMS ──────────────────────────────────────────────────

test("isOpusSilenceFrame: 3 バイトの F8 FF FE だけを無音とみなす", () => {
  assert.equal(isOpusSilenceFrame(Buffer.from([0xf8, 0xff, 0xfe])), true);
  assert.equal(isOpusSilenceFrame(Buffer.from([0xf8, 0xff, 0xfe, 0x00])), false);
  assert.equal(isOpusSilenceFrame(Buffer.from([0xf8, 0xff, 0xfd])), false);
  assert.equal(isOpusSilenceFrame(/** @type {any} */ ([0xf8, 0xff, 0xfe])), false);
});

test("rmsOfS16le: 無音 0・満振幅の矩形 ≈1・空 0", () => {
  assert.equal(rmsOfS16le(Buffer.alloc(3840)), 0);
  assert.equal(rmsOfS16le(Buffer.alloc(0)), 0);
  const square = Buffer.alloc(8);
  square.writeInt16LE(-32768, 0);
  square.writeInt16LE(-32768, 2);
  square.writeInt16LE(-32768, 4);
  square.writeInt16LE(-32768, 6);
  assert.equal(rmsOfS16le(square), 1);
});

// ── エラーの種類 ─────────────────────────────────────────────────────

test("errorKind / redactSecrets: 鍵を伏せ、数字を N にまとめ、本文は短く", () => {
  assert.equal(redactSecrets(`a ${FAKE_TOKEN} b`, [FAKE_TOKEN]), "a <redacted> b");
  const e = Object.assign(new Error(`bad ${FAKE_TOKEN} after 37 consecutive fails for ${USER}`), { code: "E1" });
  const kind = errorKind("stream", e, [FAKE_TOKEN]);
  assert.ok(!kind.includes(FAKE_TOKEN));
  assert.ok(!kind.includes(USER));
  assert.match(kind, /^stream:Error:E1 bad <redacted> after N consecutive/);
  assert.ok(kind.length <= "stream:Error:E1 ".length + 60);
  // 連続回数が違っても同じ種類にまとまる。
  assert.equal(errorKind("stream", new Error("x 37")), errorKind("stream", new Error("x 38")));
  assert.equal(errorKind("process", "plain"), "process:string plain");
});

test("recordError / recordConnectionState: 種類ごとに数える", () => {
  const t = createProbeTally({ startedAtMs: 0 });
  recordError(t, "stream", new Error("boom 1"));
  recordError(t, "stream", new Error("boom 2"));
  recordError(t, "connection", new TypeError("other"));
  assert.deepEqual(t.errors, { "stream:Error boom N": 2, "connection:TypeError other": 1 });
  recordConnectionState(t, "signalling");
  recordConnectionState(t, "ready");
  recordConnectionState(t, "ready");
  assert.deepEqual(t.connectionStates, { signalling: 1, ready: 2 });
});

// ── 数え上げ ─────────────────────────────────────────────────────────

test("speakerOf: 初めて見た順に 話者#1, 話者#2 と番号を付け、同じ人は同じ番号", () => {
  const t = createProbeTally({ startedAtMs: 0 });
  assert.equal(speakerOf(t, "a").label, "話者#1");
  assert.equal(speakerOf(t, "b").label, "話者#2");
  assert.equal(speakerOf(t, "a").label, "話者#1");
});

test("経過秒: Ready 前は null、Ready からの秒（0.1 秒単位）", () => {
  const t = createProbeTally({ startedAtMs: 0 });
  assert.equal(elapsedSec(t, 500), null);
  markReady(t, 2000, 1200);
  assert.equal(t.readyAfterMs, 800);
  assert.equal(elapsedSec(t, 2000), 0);
  assert.equal(elapsedSec(t, 5440), 3.4);
});

test("発言の数え上げ: パケット・バイト・無音・RMS・その間の復号失敗・前の発言からの間", () => {
  const t = createProbeTally({ startedAtMs: 0 });
  markReady(t, 1000, 0);
  recordPresentAtJoin(t, [USER]);
  assert.equal(t.presentAtJoin, 1);

  recordDebugLine(t, "Failed to decrypt a packet (1 consecutive fails)"); // 発言の前: 数えない
  const u1 = beginUtterance(t, USER, 2000);
  assert.equal(addPacket(u1, Buffer.alloc(60, 1)), false);
  addRms(u1, 0.1);
  assert.equal(addPacket(u1, Buffer.from([0xf8, 0xff, 0xfe])), true);
  assert.equal(addPacket(u1, Buffer.alloc(40, 1)), false);
  addRms(u1, 0.3);
  assert.equal(addPacket(u1, Buffer.alloc(10, 1)), false);
  addDecodeError(u1);
  recordDebugLine(t, "Failed to decrypt a packet (2 consecutive fails)");
  recordDebugLine(t, "Failed to decrypt a packet (3 consecutive fails)");
  const r1 = endUtterance(t, USER, u1, 4500, "silence");
  assert.deepEqual(r1, {
    index: 1,
    speaker: "話者#1",
    ordinalSinceJoin: 1,
    startSec: 1,
    durationSec: 2.5,
    gapBeforeSec: null,
    packets: 4,
    bytes: 113,
    silenceFrames: 1,
    decodeErrors: 1,
    rmsMax: 0.3,
    rmsMean: 0.2,
    decryptFails: 2,
    endedBy: "silence",
    streamError: null
  });

  const u2 = beginUtterance(t, USER, 9500);
  const r2 = endUtterance(t, USER, u2, 10000, "error", "stream:Error x");
  assert.equal(r2.ordinalSinceJoin, 2);
  assert.equal(r2.gapBeforeSec, 5);
  assert.equal(r2.packets, 0);
  assert.equal(r2.rmsMean, 0);
  assert.equal(r2.decryptFails, 0);
  assert.equal(r2.streamError, "stream:Error x");
});

test("出入り: 経過秒と話者の番号で記録し、入り直したら発言の順番を数え直す", () => {
  const t = createProbeTally({ startedAtMs: 0 });
  markReady(t, 1000, 0);
  const u = beginUtterance(t, USER, 1500);
  endUtterance(t, USER, u, 2000, "silence");
  assert.deepEqual(recordVoiceEvent(t, USER, "leave", 3000), { sec: 2, speaker: "話者#1", type: "leave" });
  assert.deepEqual(recordVoiceEvent(t, USER, "join", 4200), { sec: 3.2, speaker: "話者#1", type: "join" });
  const u2 = beginUtterance(t, USER, 5000);
  assert.equal(u2.ordinalSinceJoin, 1);
  assert.equal(t.voiceEvents.length, 2);
});

test("buildSummary: 数だけを話者ごと・全体で集計し、名前も userId も入れない", () => {
  const t = createProbeTally({ startedAtMs: 1_000_000 });
  markReady(t, 1_001_000, 1_000_500);
  recordPresentAtJoin(t, [USER]);
  recordVoiceEvent(t, USER, "leave", 1_005_000);
  recordVoiceEvent(t, USER, "join", 1_006_000);
  const a = beginUtterance(t, USER, 1_002_000);
  addPacket(a, Buffer.alloc(50, 1));
  addRms(a, 0.2);
  addPacket(a, Buffer.from([0xf8, 0xff, 0xfe]));
  endUtterance(t, USER, a, 1_003_000, "silence");
  const b = beginUtterance(t, USER, 1_007_000);
  endUtterance(t, USER, b, 1_008_000, "silence");
  recordDebugLine(t, "Failed to decrypt a packet (1 consecutive fails)");
  recordError(t, "stream", new Error(`bad ${FAKE_TOKEN}`), [FAKE_TOKEN]);
  recordNameResolved(t, USER, true);
  t.beeps.requested = 2;
  t.beeps.played = 1;

  const s = buildSummary(t, { endedAtMs: 1_010_000, versions: { "discord.js": "14.27.0", "@discordjs/voice": "0.19.2", opusscript: null } });
  assert.equal(s.probe, "discord-receive");
  assert.equal(s.durationSec, 10);
  assert.equal(s.versions.node, process.versions.node);
  assert.equal(s.versions["@discordjs/voice"], "0.19.2");
  assert.equal(s.connection.readyAfterMs, 500);
  assert.equal(s.presentAtJoin, 1);
  assert.deepEqual(s.totals, {
    utterances: 2,
    emptyUtterances: 1,
    packets: 2,
    bytes: 53,
    silenceFrames: 1,
    decodeErrors: 0,
    rmsMax: 0.2,
    rmsMeanOfUtterances: 0.1
  });
  assert.deepEqual(s.speakers, [
    {
      speaker: "話者#1",
      nameResolved: true,
      utterances: 2,
      emptyUtterances: 1,
      packets: 2,
      bytes: 53,
      silenceFrames: 1,
      decryptFails: 0,
      rmsMax: 0.2,
      rmsMeanOfUtterances: 0.1
    }
  ]);
  assert.deepEqual(s.voiceEvents, [
    { sec: 4, speaker: "話者#1", type: "leave" },
    { sec: 5, speaker: "話者#1", type: "join" }
  ]);
  assert.equal(s.decryptFailures.total, 1);
  assert.deepEqual(s.beeps, { requested: 2, played: 1, errors: 0 });

  const text = JSON.stringify(s);
  assert.ok(!text.includes(USER), "userId を書かない");
  assert.ok(!text.includes(FAKE_TOKEN), "鍵を書かない");
  // 名前は入れ物にもまとめにも持たない（取れたかだけ）。
  assert.ok(!("name" in s.speakers[0]));
});

test("buildSummary: 名前を試していない話者は nameResolved=false、発言 0 でも壊れない", () => {
  const t = createProbeTally({ startedAtMs: 0 });
  speakerOf(t, USER);
  const s = buildSummary(t, { endedAtMs: 0, versions: {} });
  assert.equal(s.speakers[0].nameResolved, false);
  assert.equal(s.totals.utterances, 0);
  assert.equal(s.totals.rmsMax, 0);
  assert.equal(s.speakers[0].rmsMeanOfUtterances, 0);
});

// ── 表示 ─────────────────────────────────────────────────────────

test("formatUtteranceLine / formatVoiceEventLine: 経過秒・話者の番号・数を 1 行に", () => {
  const t = createProbeTally({ startedAtMs: 0 });
  markReady(t, 0, 0);
  const u = beginUtterance(t, USER, 12_300);
  addPacket(u, Buffer.alloc(30, 1));
  addRms(u, 0.25);
  const line = formatUtteranceLine(endUtterance(t, USER, u, 14_100, "silence"));
  assert.equal(line, "[  12.3s] 話者#1 発言1 / パケット 1 / 無音 0 / RMS 最大 0.250 平均 0.250 / 復号失敗 0 / 1.8秒");
  assert.ok(!line.includes(USER));
  assert.equal(formatVoiceEventLine({ sec: 3.2, speaker: "話者#1", type: "join" }), "[   3.2s] 話者#1 が VC に入った");
  assert.equal(formatVoiceEventLine({ sec: null, speaker: "話者#1", type: "leave" }), "[  --.-s] 話者#1 が VC を抜けた");
});

test("PROBE_SCRIPT_LINES: 台本の 4 つの手順とキー操作を含む", () => {
  const text = PROBE_SCRIPT_LINES.join("\n");
  for (const n of ["1.", "2.", "3.", "4."]) assert.ok(text.includes(n));
  assert.match(text, /b を押して/);
  assert.match(text, /q か Ctrl\+C/);
});

// ── 部品の版 ───────────────────────────────────────────────────────

test("readInstalledVersions: node_modules の package.json から版を読み、無ければ null", async () => {
  /** @type {Record<string, string>} */
  const files = {
    [join("NM", "discord.js", "package.json")]: JSON.stringify({ version: "14.27.0" }),
    [join("NM", "@discordjs", "voice", "package.json")]: JSON.stringify({ version: "0.19.2" })
  };
  const v = await readInstalledVersions(["discord.js", "@discordjs/voice", "opusscript"], {
    nodeModulesDir: "NM",
    readFileImpl: async (p) => {
      if (!(p in files)) throw new Error("ENOENT");
      return files[p];
    }
  });
  assert.deepEqual(v, { "discord.js": "14.27.0", "@discordjs/voice": "0.19.2", opusscript: null });
});
