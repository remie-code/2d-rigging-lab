import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_SPEECH_INTENT_NONE_DIR = fileURLToPath(new URL("../../tmp/speech-intent-none/", import.meta.url));

const pendingWrites = new Map();

async function publishRecord(path, directory, section, playbackState) {
  try {
    await access(path);
    return path;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const staging = resolve(directory, randomUUID() + ".tmp");
  const format = section.reason
    ? { version: 3, result: "unsupported" }
    : { version: section.audioPlayback ? 2 : 1, result: "none" };
  const record = { ...format, recordedAt: new Date().toISOString(), playbackState, ...section };
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(staging, JSON.stringify(record, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
    // Publish the complete record without replacing one written by another process.
    await link(staging, path).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    return path;
  } finally {
    await unlink(staging).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

export function createSpeechIntentNoneRecorder({ directory = DEFAULT_SPEECH_INTENT_NONE_DIR } = {}) {
  return (section, playbackState) => {
    const key = JSON.stringify([section.sceneId, section.utteranceId, section.generation, section.sectionId, section.sectionIndex]);
    const id = createHash("sha256").update(key).digest("hex");
    const path = resolve(directory, id + ".json");
    const pending = pendingWrites.get(path);
    if (pending) return pending;
    const write = publishRecord(path, directory, section, playbackState).finally(() => pendingWrites.delete(path));
    pendingWrites.set(path, write);
    return write;
  };
}
