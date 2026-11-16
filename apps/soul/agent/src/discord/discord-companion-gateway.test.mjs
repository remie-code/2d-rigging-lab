import test from "node:test";
import assert from "node:assert/strict";
import { createDiscordChatReceiver, downloadDiscordAttachment } from "./discord-companion-gateway.mjs";
import { DISCORD_ATTACHMENT_SIZE_ERROR } from "./discord-chat-materials.mjs";

const SOURCE = "https://cdn.discordapp.com/attachments/1/2/fixture.pdf";

test("Discord Gateway Resume の未受信 ID は受信先の各有効化時刻より後の投稿だけを通す", (t) => {
  const guildId = "fixture-guild";
  const textId = "100000000000000001";
  const voiceId = "100000000000000002";
  const denied = new Set();
  const cache = new Map([textId, voiceId].map((id, type) => [id, {
    id, guildId, name: id, type,
    permissionsFor: () => ({ has: () => !denied.has(id) })
  }]));
  let now = 100_000;
  t.mock.method(Date, "now", () => now);
  const receiver = createDiscordChatReceiver({
    plan: { guildId }, guild: { channels: { cache }, members: { me: {} } },
    discord: { ChannelType: { GuildText: 0, GuildVoice: 1 }, PermissionFlagsBits: { ViewChannel: 1024n } },
    chatIntent: "enabled"
  }, {
    getDiscordChatChannel: () => ({ guildId, channelId: textId }),
    setDiscordChatChannel: () => true
  }, () => true);

  function deliver(id, createdTimestamp) {
    receiver.accept({ id, createdTimestamp, guildId, channelId: textId, author: { id: "fixture-author" }, content: id });
  }
  function texts() {
    return receiver.getChatMaterials().map(({ text }) => text);
  }

  try {
    const restoredAt = now;
    deliver("before-restore", restoredAt - 1);
    deliver("at-restore", restoredAt);
    assert.deepEqual(texts(), []);
    now += 10;
    receiver.list();
    assert.equal(receiver.select(textId).ok, true);
    deliver("after-restore", restoredAt + 1);
    assert.deepEqual(texts(), ["after-restore"], "同じ設定を読み直す・保存する操作では境界を動かさない");

    now += 10;
    assert.equal(receiver.select(voiceId).ok, true);
    now += 10;
    assert.equal(receiver.select(textId).ok, true);
    const selectedAt = now;
    now += 10;
    deliver("unseen-before-switch-back", selectedAt - 1);
    deliver("unseen-before-venue", restoredAt - 1000);
    assert.deepEqual(texts(), []);
    deliver("after-switch-back", selectedAt + 1);
    assert.deepEqual(texts(), ["after-switch-back"]);

    denied.add(textId);
    receiver.refreshPermissions();
    assert.deepEqual(texts(), []);
    now += 10;
    denied.delete(textId);
    receiver.refreshPermissions();
    const restoredPermissionAt = now;
    now += 10;
    deliver("unseen-during-denial", restoredPermissionAt - 1);
    assert.deepEqual(texts(), []);
    deliver("after-permission-restore", restoredPermissionAt + 1);
    assert.deepEqual(texts(), ["after-permission-restore"]);
  } finally {
    receiver.clear();
  }
});

test("Discord 添付取得は正式な HTTPS 添付 URL だけを渡し redirect を禁止する", async () => {
  const source = SOURCE + "?ex=" + (Math.floor(Date.now() / 1000) + 60).toString(16);
  const controller = new AbortController();
  const calls = [];
  const fixtureFetch = async (url, options) => {
    calls.push([String(url), options.redirect]);
    return new Response(Buffer.from("fixture"));
  };
  for (const bad of [
    SOURCE.replace("https:", "http:"),
    SOURCE.replace(".com", ".com.invalid"),
    SOURCE.replace("cdn.discordapp.com", "cdn.discordapp.com:444"),
    SOURCE.replace("https://", "https://name@"),
    SOURCE.replace("/attachments/", "/avatars/"),
    SOURCE.replace("/1/2/", "/not-an-id/2/"),
    SOURCE + "?ex=1",
    SOURCE + "?ex=not-hex"
  ]) {
    await assert.rejects(downloadDiscordAttachment(bad, controller.signal, fixtureFetch));
  }
  assert.deepEqual(calls, []);
  assert.deepEqual(await downloadDiscordAttachment(source, controller.signal, fixtureFetch), Buffer.from("fixture"));
  const media = SOURCE.replace("cdn.discordapp.com", "media.discordapp.net");
  assert.deepEqual(await downloadDiscordAttachment(media, controller.signal, fixtureFetch), Buffer.from("fixture"));
  assert.deepEqual(calls, [[source, "error"], [media, "error"]]);
});

test("Discord 添付は Content-Length と実際のストリームの両方に 8 MiB 上限を適用する", async () => {
  const signal = new AbortController().signal;
  const limit = 8 * 1024 * 1024;
  const declared = async () => new Response("short fixture", { headers: { "content-length": String(limit + 1) } });
  let reads = 0;
  const streamed = async () => new Response(new ReadableStream({
    pull(controller) {
      reads += 1;
      controller.enqueue(reads === 1 ? new Uint8Array(limit) : new Uint8Array(1));
    }
  }, { highWaterMark: 0 }));
  for (const fixtureFetch of [declared, streamed]) {
    await assert.rejects(downloadDiscordAttachment(SOURCE, signal, fixtureFetch), { code: DISCORD_ATTACHMENT_SIZE_ERROR });
  }
  assert.equal(reads, 2);
});

test("Discord 添付の fetch と途中キャンセルは場から渡した AbortSignal に従う", async () => {
  const controller = new AbortController();
  const started = Promise.withResolvers();
  const download = downloadDiscordAttachment(SOURCE, controller.signal, async (_url, { signal }) => new Response(
    new ReadableStream({
      start(stream) {
        signal.addEventListener("abort", () => stream.error(signal.reason), { once: true });
        started.resolve();
      }
    })
  ));
  await started.promise;
  controller.abort();
  await assert.rejects(download, { name: "AbortError" });
});
