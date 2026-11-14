import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

function waitForMessage(socket, matches) {
  return new Promise((resolveMessage, reject) => {
    const finish = (error, message) => {
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("error", onClose);
      socket.removeEventListener("close", onClose);
      if (error) reject(error);
      else resolveMessage(message);
    };
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (matches(message)) finish(null, message);
    };
    const onClose = () => finish(new Error("Control Channel disconnected."));
    const timer = setTimeout(() => finish(new Error("Control Channel response timed out.")), 4000);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onClose, { once: true });
    socket.addEventListener("close", onClose, { once: true });
  });
}

export async function connectMotionReplay(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Set RUNTIME_PLAYER_CHANNEL_URL to the URL shown in Runtime Player's Channel tab.");
  }
  if (url.protocol !== "ws:" || url.hostname !== "127.0.0.1" || url.pathname !== "/channel") {
    throw new Error("Expected the local Runtime Player Channel URL.");
  }

  const socket = new WebSocket(url);
  try {
    const hello = await waitForMessage(socket, (message) => message.kind === "server.hello");
    if (!hello.payload.supportedKinds.includes("intent.motion")) {
      throw new Error("Runtime Player did not advertise intent.motion.");
    }
  } catch (error) {
    socket.close();
    throw error;
  }

  return {
    async send(payload, kind = "intent.motion") {
      const id = randomUUID();
      const reply = waitForMessage(socket, (message) => message.replyTo === id);
      socket.send(JSON.stringify({ v: 1, id, kind, payload }));
      const response = await reply;
      if (response.result !== "accepted") {
        throw new Error(`Motion ${payload.op} rejected (${response.error?.code ?? "unknown"}).`);
      }
    },
    close() {
      socket.close();
    }
  };
}

export async function loadMotionDefinition(file) {
  const { stageY } = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(stageY)) throw new Error("The diagnostic requires a stageY track.");
  return { stageY };
}


async function main() {
  const [file] = process.argv.slice(2);
  if (!file || process.argv.length !== 3) {
    throw new Error("Usage: node apps/runtime-player/scripts/replay-stage-y.mjs <stage-y-motion.json>");
  }
  const motion = await loadMotionDefinition(file);
  const channel = await connectMotionReplay(process.env.RUNTIME_PLAYER_CHANNEL_URL);
  const key = { generation: 0, sectionIndex: 0 };
  try {
    await channel.send({ op: "begin", ...key });
    await channel.send({ op: "play", ...key, ...motion });
    console.log("Motion play accepted.");
    await delay(Math.max(2000, (motion.stageY.at(-1)?.[0] ?? 0) + 650));
    await channel.send({ op: "end", ...key });
    console.log("Motion ended.");
  } finally {
    channel.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
