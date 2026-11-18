import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const receiptRoot = fileURLToPath(new URL("../../tmp/remote-discord-venue/", import.meta.url));
export const remoteVenueLedgerPath = join(receiptRoot, "codex-rollouts.json");
export const isRemoteVenueId = (value) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);

function receiptPath(id, root) {
  if (!isRemoteVenueId(id)) throw new Error("場の識別子の形式が違います。");
  return join(root, `${id}.json`);
}

export async function writeRemoteVenueReceipt(id, outcome, root = receiptRoot) {
  const path = receiptPath(id, root);
  await mkdir(root, { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify({ venueId: id, pid: process.pid, ...outcome }), { flag: "wx" });
  await rename(`${path}.tmp`, path);
}

export async function readRemoteVenueReceipt(id, root = receiptRoot) {
  try {
    const receipt = JSON.parse(await readFile(receiptPath(id, root), "utf8"));
    if (receipt.venueId !== id || !Number.isSafeInteger(receipt.pid) || receipt.pid <= 0) {
      throw new Error("Cockpit の終了記録の形式が違います。");
    }
    const { pid, ...outcome } = receipt;
    try {
      process.kill(pid, 0);
      return { venueId: id, closing: "in-progress" };
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
      return { ...outcome, closing: "complete" };
    }
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function reserveRemoteVenuePort(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
  });
  return server;
}
