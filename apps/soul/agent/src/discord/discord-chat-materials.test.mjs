// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate, setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { crc32, deflateSync, inflateSync } from "node:zlib";
import { addDiscordChatMaterials, createDiscordChatMaterials, DISCORD_ATTACHMENT_SIZE_ERROR } from "./discord-chat-materials.mjs";
import { decodeDiscordImage } from "./discord-image-decoder.mjs";
import { MAX_ATTACHMENT_BYTES, renderDiscordPdfPage } from "./discord-pdf-renderer.mjs";
import { createVenueTaskResources } from "../cockpit/venue-task-resources.mjs";
import { makeLocalTaskPdf } from "../test-support/local-task-pdf.mjs";

const first = { guildId: "1", channelId: "11", channelName: "共有" };
const second = { guildId: "1", channelId: "12" };
const now = 1760000000000;
const jpeg = Buffer.from([255, 216, 255, 217]);
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const samplePdf = Buffer.from("%PDF-1.4");
const acceptFakeImage = async () => /** @type {const} */ ("ok");

/** @param {Partial<import("./discord-chat-materials.mjs").Post>} [patch] */
function post(patch = {}) {
  return { ...first, messageId: "100", authorId: "10", authorName: "投稿者",
    postedAtMs: now, text: "見られる？", ...patch };
}

/** @param {Partial<import("./discord-chat-materials.mjs").Attachment>} [patch] */
function attachment(patch = {}) {
  return { id: "21", name: "photo.jpg", contentType: "image/jpeg", load: async () => jpeg, ...patch };
}

test("Discord chat materials deduplicate before download and expire", async () => {
  let nowMs = now;
  let loads = 0;
  const store = createDiscordChatMaterials({ now: () => nowMs, decodeImage: acceptFakeImage });
  store.setChannel(first);
  const message = post({ attachments: [attachment({ load: async () => { loads++; return jpeg; } })] });
  assert.equal(store.acceptPost(post({ ...second })), false);
  assert.equal(store.acceptPost(message), true);
  assert.equal(store.getChatMaterials()[0].attachments[0].state, "pending");
  store.setChannel({ ...first, channelName: "名前変更" });
  assert.equal(store.acceptPost(message), false);
  await setImmediate();
  assert.equal(loads, 1);
  const [received] = store.getChatMaterials();
  assert.equal(received.channelName, "共有");
  assert.equal(received.authorId, "10");
  assert.equal(received.attachments[0].state, "ready");
  nowMs += 30 * 60 * 1000;
  assert.deepEqual(store.getChatMaterials(), []);
  assert.equal(store.acceptPost(message), false);
});

test("channel switch discards late downloads and keeps saved originals across reselect and expiration", async (t) => {
  const download = Promise.withResolvers();
  const latePdf = Promise.withResolvers();
  const venue = createVenueTaskResources();
  t.after(() => venue.release());
  const signals = [];
  let nowMs = now;
  const store = createDiscordChatMaterials({ now: () => nowMs });
  store.setChannel(first);
  const ready = post({ messageId: "99", attachments: [
    attachment({ name: "ready.pdf", contentType: "application/pdf", load: async () => samplePdf })
  ] });
  assert.equal(store.acceptPost(ready, venue.access), true);
  await setImmediate();
  const [original] = venue.access.listDocuments();
  const message = post({ attachments: [
    attachment({ load: (signal) => { signals.push(signal); return download.promise; } }),
    attachment({ id: "22", name: "scan.pdf", contentType: "application/pdf", load: (signal) => {
      signals.push(signal);
      return latePdf.promise;
    } })
  ] });
  assert.equal(store.acceptPost(message, venue.access), true);
  const oldGeneration = store.getChatMaterials()[0].generation;
  await setImmediate();
  store.setChannel(second);
  assert.deepEqual(store.getChatMaterials(), []);
  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => signal?.aborted));
  store.setChannel(first);
  assert.equal(store.acceptPost(post({ text: "新しい世代" })), true);
  assert.equal(store.acceptPost(ready, venue.access), true);
  download.resolve(jpeg);
  latePdf.resolve(samplePdf);
  await setImmediate();
  const [received] = store.getChatMaterials();
  assert.notEqual(received.generation, oldGeneration);
  assert.equal(received.text, "新しい世代");
  assert.deepEqual(received.attachments, []);
  assert.deepEqual(venue.access.listDocuments(), [original]);
  assert.equal(store.getChatMaterials()[1].attachments[0].materialId, original.id);
  nowMs += 30 * 60 * 1000;
  assert.deepEqual(store.getChatMaterials(), []);
  assert.deepEqual(readFileSync(original.path), samplePdf);
  store.clear();
  assert.deepEqual(store.getChatMaterials(), []);
  assert.equal(store.acceptPost(message), false);
});

test("bounded newest posts keep omission, invalid bytes and saved PDF references", async (t) => {
  const store = createDiscordChatMaterials({ now: () => now });
  const venue = createVenueTaskResources();
  t.after(() => venue.release());
  store.setChannel(first);
  for (let id = 1; id <= 12; id++) {
    assert.equal(store.acceptPost(post({ messageId: String(id), postedAtMs: now - 20 + id })), true);
  }
  let skipped = false;
  store.acceptPost(post({ text: "あ".repeat(4001), attachments: [
    attachment({ name: "C:\\tmp\\scan.pdf", contentType: "application/pdf", load: async () => samplePdf }),
    attachment({ id: "22", load: async () => Buffer.alloc(MAX_ATTACHMENT_BYTES + 1) }),
    attachment({ id: "23", load: async () => { throw Error("https://example.com/private-path"); } }),
    attachment({ id: "24", load: async () => png }),
    attachment({ id: "25", load: async () => { skipped = true; return jpeg; } })
  ] }), venue.access);
  assert.equal(store.acceptPost(post({ messageId: "1", postedAtMs: now - 19 })), false);
  await setImmediate();
  const snapshot = store.getChatMaterials();
  assert.equal(snapshot.length, 12);
  assert.equal(snapshot[0].text.length, 4000);
  assert.equal(snapshot[0].textOmitted, true);
  assert.equal(snapshot[0].attachmentsOmitted, 1);
  assert.equal(skipped, false);
  assert.deepEqual(snapshot[0].attachments.map(({ state, reason }) => [state, reason]), [
    ["ready", undefined], ["unavailable", "取得上限"], ["unavailable", "取得失敗"], ["unavailable", "未対応または形式不一致"]
  ]);
  const content = JSON.stringify(addDiscordChatMaterials("conversation", snapshot));
  assert.match(content, /scan\.pdf/);
  assert.match(content, new RegExp(venue.access.listDocuments()[0].id));
  assert.equal(snapshot[0].attachments[0].images.length, 0);
  assert.doesNotMatch(content, /example\.com|tmp/);
  store.clear();
});

test("PDF references do not consume the direct Fire image budget", async (t) => {
  const venue = createVenueTaskResources();
  t.after(() => venue.release());
  const store = createDiscordChatMaterials({
    now: () => now,
    decodeImage: acceptFakeImage
  });
  store.setChannel(first);
  store.acceptPost(post({ messageId: "99", postedAtMs: now - 1, attachments: [
    attachment({ name: "scan.pdf", contentType: "application/pdf", load: async () => samplePdf })
  ] }), venue.access);
  store.acceptPost(post({ attachments: Array.from({ length: 4 }, (_, i) => attachment({ id: String(i) })) }));
  await setImmediate();
  const content = addDiscordChatMaterials("conversation", store.getChatMaterials());
  assert.ok(Array.isArray(content));
  assert.deepEqual(content.filter((block) => block.type === "image").map((block) => block.source.media_type),
    ["image/jpeg", "image/jpeg", "image/jpeg", "image/jpeg"]);
  assert.match(JSON.stringify(content), new RegExp(venue.access.listDocuments()[0].id));
  store.clear();
});

test("store and Fire byte ceilings omit older images and report streaming download limits", async () => {
  const store = createDiscordChatMaterials({ now: () => now, decodeImage: acceptFakeImage });
  store.setChannel(first);
  const large = Buffer.alloc(4 * 1024 * 1024);
  jpeg.copy(large);
  for (let index = 0; index < 5; index++) {
    store.acceptPost(post({ messageId: String(index), attachments: [attachment({ load: async () => large })] }));
  }
  store.acceptPost(post({ attachments: [
    attachment({ load: async () => { throw Object.assign(new Error("internal"), { code: DISCORD_ATTACHMENT_SIZE_ERROR }); } })
  ] }));
  await setImmediate();
  const snapshot = store.getChatMaterials();
  assert.equal(snapshot[0].attachments[0].reason, "取得上限");
  assert.equal(snapshot.at(-1)?.attachments[0].reason, "保存上限");
  const content = addDiscordChatMaterials("conversation", snapshot);
  assert.ok(Array.isArray(content));
  assert.equal(content.filter((block) => block.type === "image").length, 1);
  store.clear();
});

test("Windows PDF renderer accepts page 5 of both compressed text and image-only documents", {
  skip: process.platform !== "win32", timeout: 10000
}, async () => {
  for (const imageOnly of [false, true]) {
    const { bytes, token } = makeLocalTaskPdf({ imageOnly, page: 5 });
    assert.equal(bytes.includes(token), false);
    const result = await renderDiscordPdfPage(bytes, 5);
    assert.equal(result.status, "ok");
    assert.equal(result.totalPages, 5);
    assert.equal(result.pages.length, 1);
    const [page] = result.pages;
    assert.deepEqual(page.subarray(0, 8), png);
    assert.equal(page.readUInt32BE(16), 1536);
    assert.equal(page.readUInt32BE(20), 563);
  }
  assert.deepEqual(await renderDiscordPdfPage(makeLocalTaskPdf().bytes, 6), { status: "out-of-range", totalPages: 5, pages: [] });
});

test("PDF renderer reports an unreadable input without exposing process errors", {
  skip: process.platform !== "win32", timeout: 10000
}, async () => {
  assert.deepEqual(await renderDiscordPdfPage(samplePdf, 1), { status: "pdf-unreadable", totalPages: 0, pages: [] });
});

// The color-only 8x8 fixtures are synthetic. WinRT validates them through the
// same attachment preparation path used in Cockpit.
const validImageFixtures = [
  ["scan.png", "image/png", "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAWSURBVChTY9ikpPQfH2ZAF0DHw0MBAHzofUHmu2seAAAAAElFTkSuQmCC"],
  ["scan.jpg", "image/jpeg", "/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjI4LjEwMgD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABNAAEBAAAAAAAAAAAAAAAAAAAABgEBAQEAAAAAAAAAAAAAAAAAAAUHEAEAAAAAAAAAAAAAAAAAAAAAEQEAAAAAAAAAAAAAAAAAAAAA/8AAEQgACAAIAwESAAISAAMSAP/aAAwDAQACEQMRAD8AjBGGkD//2Q=="],
  ["scan.webp", "image/webp", "UklGRh4AAABXRUJQVlA4TBEAAAAvB8ABAAdQkcpWpP+BiOh/AAA="]
];

test("Windows image preparation decodes PNG, JPEG and WebP and rejects invalid pixel data", {
  skip: process.platform !== "win32", timeout: 10000
}, async () => {
  const store = createDiscordChatMaterials({ now: () => now });
  store.setChannel(first);
  const valid = validImageFixtures.map(([name, contentType, data], index) =>
    attachment({ id: String(index), name, contentType, load: async () => Buffer.from(data, "base64") }));
  // Alter the pixel stream and repair its CRC, so the container checks pass.
  const corruptPng = Buffer.from(validImageFixtures[0][2], "base64");
  const idatStart = corruptPng.indexOf("IDAT");
  const crcOffset = idatStart + 4 + corruptPng.readUInt32BE(idatStart - 4);
  corruptPng.fill(0, idatStart + 4, crcOffset);
  corruptPng.writeUInt32BE(crc32(corruptPng.subarray(idatStart, crcOffset)), crcOffset);
  assert.throws(() => inflateSync(corruptPng.subarray(idatStart + 4, crcOffset)), { code: "Z_DATA_ERROR" });
  store.acceptPost(post({ attachments: [...valid,
    attachment({ id: "invalid", name: "broken.png", contentType: "image/png", load: async () => corruptPng })
  ] }));
  const deadline = performance.now() + 9000;
  try {
    let snapshot = store.getChatMaterials();
    while (snapshot[0].attachments.some(({ state }) => state === "pending") && performance.now() < deadline) {
      await setTimeout(25);
      snapshot = store.getChatMaterials();
    }
    assert.deepEqual(snapshot[0].attachments.map(({ state }) => state), ["ready", "ready", "ready", "unavailable"]);
    assert.equal(snapshot[0].attachments[3].reason, "画像読み込み失敗");
    const content = addDiscordChatMaterials("conversation", snapshot);
    assert.ok(Array.isArray(content));
    assert.deepEqual(content.filter(({ type }) => type === "image").map(({ source }) => source.media_type),
      ["image/png", "image/jpeg", "image/webp"]);
  } finally {
    store.clear();
  }
});

test("JPEG with a valid SOS header and EOI but missing all scan data is unavailable", async () => {
  const jpeg = Buffer.from(validImageFixtures[1][2], "base64");
  const sos = jpeg.indexOf(Buffer.from([0xff, 0xda]));
  const scanStart = sos + 2 + jpeg.readUInt16BE(sos + 2);
  const corrupt = Buffer.concat([jpeg.subarray(0, scanStart), jpeg.subarray(-2)]);
  assert.equal(await decodeDiscordImage(corrupt, "image/jpeg"), "invalid");
});

/** @param {string} type @param {Buffer} data */
function pngChunk(type, data) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return chunk;
}

test("interlaced PNG with packed grayscale samples and split IDAT uses the exact pass sizes", {
  skip: process.platform !== "win32", timeout: 10000
}, async () => {
  const header = Buffer.from([0, 0, 0, 9, 0, 0, 0, 9, 1, 0, 0, 0, 1]);
  // A 9×9 one-bit image has 15 two-byte rows and 4 three-byte rows across the Adam7 passes.
  for (const length of [42, 41, 43]) {
    const compressed = deflateSync(Buffer.alloc(length));
    const image = Buffer.concat([
      png, pngChunk("IHDR", header), pngChunk("IDAT", compressed.subarray(0, 5)),
      pngChunk("IDAT", compressed.subarray(5)), pngChunk("IEND", Buffer.alloc(0))
    ]);
    assert.equal(await decodeDiscordImage(image, "image/png"), length === 42 ? "ok" : "invalid");
  }
});
