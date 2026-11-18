import { createHash } from "node:crypto";
import { createServer } from "node:net";

/** Reserve a Discord Bot's guild on this PC until the venue leaves service. */
export async function acquireDiscordGuildLease(botId, guildId) {
  if (typeof botId !== "string" || !botId || typeof guildId !== "string" || !guildId) {
    throw new Error("Discord Bot or guild identity is unavailable");
  }
  const digest = createHash("sha256").update(JSON.stringify([botId, guildId])).digest("hex");
  const name = `soul-discord-${digest}`;
  const address = process.platform === "win32" ? { path: `\\\\.\\pipe\\${name}` }
    : process.platform === "linux" ? { path: `\0${name}` }
      : { host: "127.0.0.1", port: 49152 + (Number.parseInt(digest.slice(0, 4), 16) % 16384) };
  const server = createServer((connection) => connection.destroy());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ ...address, exclusive: true }, resolve);
  });
  return () => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
