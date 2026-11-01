// @ts-check
/**
 * Discord モード Domain D: 鍵の読み方（discord-token.mjs・discord-mode.md §5・§10）と、人ごとの音の小さな部品（discord-audio.mjs）。
 * 本物の鍵（apps/soul/agent/.env*.local）は読まない: 一時フォルダの偽ファイルか readFileImpl の差し替えだけ。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_DISCORD_BOT_KEY_FILE,
  DISCORD_BOT_KEY_DIR,
  DISCORD_BOT_TOKEN_NAME,
  DISCORD_KEY_FILE_NAME_REFUSED,
  isDiscordBotKeyFileName,
  loadDiscordBotToken,
  readDiscordBotTokenFile
} from "./discord-token.mjs";
import {
  DISCORD_EAR_SAMPLE_RATE,
  createOpusDecoder16k,
  createSpeakerAudioSource,
  isOpusSilenceFrame,
  silencePcm,
  toPcmBuffer
} from "./discord-audio.mjs";

const FAKE_TOKEN = "fake.discord-token_for-test-only";

/** @param {(dir: string) => void} fn */
function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "discord-d-token-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("鍵の読み方: ファイル名を引数に取り、一時フォルダの偽ファイルから DISCORD_BOT_TOKEN を読む・process.env を変えない", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, ".env.discord.local"), `# comment\nOTHER=1\n${DISCORD_BOT_TOKEN_NAME}=${FAKE_TOKEN}\n`, "utf8");
    writeFileSync(join(dir, ".env.discord-bot2.local"), `${DISCORD_BOT_TOKEN_NAME}= second-${FAKE_TOKEN} \n`, "utf8");
    const before = { ...process.env };
    assert.deepEqual(loadDiscordBotToken({ dir }), { ok: true, token: FAKE_TOKEN }, "既定は .env.discord.local");
    assert.deepEqual(loadDiscordBotToken({ dir, fileName: ".env.discord-bot2.local" }), { ok: true, token: `second-${FAKE_TOKEN}` });
    assert.deepEqual({ ...process.env }, before, "process.env に入れない");
    assert.equal(process.env[DISCORD_BOT_TOKEN_NAME], before[DISCORD_BOT_TOKEN_NAME]);
  });
});

test("鍵の読み方: 既定のフォルダは apps/soul/agent・既定のファイル名は .env.discord.local（readFileImpl の差し替えで確かめる・本物は読まない）", () => {
  /** @type {string[]} */
  const seen = [];
  const r = loadDiscordBotToken({ readFileImpl: (p) => (seen.push(p), `${DISCORD_BOT_TOKEN_NAME}=${FAKE_TOKEN}\n`) });
  assert.deepEqual(r, { ok: true, token: FAKE_TOKEN });
  assert.equal(seen.length, 1);
  assert.equal(seen[0], join(DISCORD_BOT_KEY_DIR, DEFAULT_DISCORD_BOT_KEY_FILE));
  assert.match(DISCORD_BOT_KEY_DIR.replace(/\\/g, "/"), /apps\/soul\/agent$/);
  assert.equal(DEFAULT_DISCORD_BOT_KEY_FILE, ".env.discord.local");
});

test("鍵の読み方: .env.discord*.local に合わない名前・パスの区切りを含む名前は読まずに断る（理由に値を入れない）", () => {
  const refused = [
    "../.env.discord.local",
    "sub/.env.discord.local",
    "sub\\.env.discord.local",
    "C:.env.discord.local",
    ".env.discord..local",
    ".env.local",
    ".env.elevenlabs.local",
    ".env.discord.local.bak",
    "env.discord.local",
    ".env.discord local.local",
    "",
    `.env.discord${"x".repeat(60)}.local`
  ];
  for (const name of refused) {
    assert.equal(isDiscordBotKeyFileName(name), false, name);
    /** @type {string[]} */
    const seen = [];
    const r = loadDiscordBotToken({ fileName: name, readFileImpl: (p) => (seen.push(p), "") });
    assert.deepEqual(r, { ok: false, reason: DISCORD_KEY_FILE_NAME_REFUSED }, name);
    assert.deepEqual(seen, [], `読みに行かない: ${name}`);
  }
  for (const value of [42, {}, ["x"], true]) assert.equal(loadDiscordBotToken({ fileName: value, readFileImpl: () => "" }).ok, false);
  for (const name of [".env.discord.local", ".env.discord-2.local", ".env.discord.bot_b.local", ".env.discordA.local"]) {
    assert.equal(isDiscordBotKeyFileName(name), true, name);
  }
});

test("鍵の読み方: ファイルが無い・キーが無い・空・形が読めない → 短い理由（鍵の値を含めない）", () => {
  withTempDir((dir) => {
    const missing = loadDiscordBotToken({ dir });
    assert.equal(missing.ok, false);
    assert.match(/** @type {any} */ (missing).reason, /Discord の鍵のファイルが読めない（apps\/soul\/agent\/\.env\.discord\.local）/);
    writeFileSync(join(dir, ".env.discord.local"), `SOMETHING_ELSE=${FAKE_TOKEN}\n`, "utf8");
    const noKey = loadDiscordBotToken({ dir });
    assert.equal(noKey.ok, false);
    assert.match(/** @type {any} */ (noKey).reason, /DISCORD_BOT_TOKEN/);
    assert.ok(!(/** @type {any} */ (noKey).reason.includes(FAKE_TOKEN)));
    writeFileSync(join(dir, ".env.discord.local"), `${DISCORD_BOT_TOKEN_NAME}=   \n`, "utf8");
    assert.equal(loadDiscordBotToken({ dir }).ok, false);
  });
  const thrown = readDiscordBotTokenFile({
    path: "x",
    label: "label-x",
    readFileImpl: () => {
      throw new Error(`EACCES ${FAKE_TOKEN}`);
    }
  });
  assert.deepEqual(thrown, { ok: false, reason: "Discord の鍵のファイルが読めない（label-x）" });
});

// ── 人ごとの音の小さな部品 ─────────────────────────────────────────────

test("3 バイトの無音のフレーム（F8 FF FE）だけを無音のフレームとみなす", () => {
  assert.equal(isOpusSilenceFrame(Buffer.from([0xf8, 0xff, 0xfe])), true);
  assert.equal(isOpusSilenceFrame(new Uint8Array([0xf8, 0xff, 0xfe])), true);
  assert.equal(isOpusSilenceFrame(Buffer.from([0xf8, 0xff, 0xfe, 0x00])), false);
  assert.equal(isOpusSilenceFrame(Buffer.from([0xf8, 0xff, 0xfd])), false);
  assert.equal(isOpusSilenceFrame(null), false);
  assert.equal(isOpusSilenceFrame("abc"), false);
});

test("silencePcm: 16kHz モノラル s16le の無音（800ms = 25600 バイト・全部 0）", () => {
  const pcm = silencePcm(800);
  assert.equal(DISCORD_EAR_SAMPLE_RATE, 16000);
  assert.equal(pcm.length, 25600);
  assert.ok(pcm.every((b) => b === 0));
  assert.equal(silencePcm(0).length, 0);
});

test("本物の opusscript で、48kHz ステレオの Opus を直に 16kHz モノラルにデコードできる（20ms = 640 バイト）", async () => {
  const o = /** @type {any} */ (await import("opusscript"));
  const OpusScript = o.default ?? o;
  const encoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO);
  const decoder = createOpusDecoder16k(OpusScript);
  try {
    const frame = Buffer.alloc(960 * 2 * 2);
    for (let i = 0; i < 960; i += 1) {
      const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / 48000) * 0.5 * 32767);
      frame.writeInt16LE(v, i * 4);
      frame.writeInt16LE(v, i * 4 + 2);
    }
    const packet = encoder.encode(frame, 960);
    const pcm = toPcmBuffer(decoder.decode(packet));
    assert.equal(pcm.length, 640);
  } finally {
    encoder.delete();
    decoder.delete();
  }
});

test("耳の音の入口: 耳が captureFactory を呼ぶまで溜め、呼ばれたら順に流す・上限を超えた古い分は捨てる・畳んだら流さない", () => {
  const source = createSpeakerAudioSource({ maxPendingMs: 40 });
  const a = Buffer.alloc(640, 1);
  const b = Buffer.alloc(640, 2);
  const c = Buffer.alloc(640, 3);
  source.push(a);
  source.push(b);
  source.push(c); // 40ms = 1280 バイトまで → a を捨てる。
  assert.equal(source.pendingBytes(), 1280);
  /** @type {Buffer[]} */
  const got = [];
  const capture = source.captureFactory({ onPcm: (chunk) => got.push(chunk) });
  assert.deepEqual(got, [b, c]);
  assert.equal(source.isAttached(), true);
  source.push(a);
  assert.deepEqual(got, [b, c, a]);
  capture.dispose();
  assert.equal(capture.isDisposed(), true);
  source.push(b);
  assert.equal(got.length, 3, "畳んだあとは流さない");
  assert.deepEqual(source.stats(), { pushedBytes: 640 * 4, droppedBytes: 640 });
});
