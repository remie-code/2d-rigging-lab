import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultDirectory = fileURLToPath(new URL("../../tmp/speech-intent-motion/", import.meta.url));

export function createSpeechIntentSectionRecorder({ directory = defaultDirectory } = {}) {
  return async (section) => {
    const { sceneId, utteranceId, generation, sectionId, sectionIndex } = section;
    const key = JSON.stringify([sceneId, utteranceId, generation, sectionId, sectionIndex]);
    const id = createHash("sha256").update(key).digest("hex");
    const path = resolve(directory, id + ".json");
    const staging = resolve(directory, randomUUID() + ".tmp");
    const record = { version: 1, recordedAt: new Date().toISOString(), ...section };
    await mkdir(directory, { recursive: true });
    await writeFile(staging, JSON.stringify(record, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 })
      .catch(async (error) => {
        if (error.code !== "EEXIST") await unlink(staging).catch(() => {});
        throw error;
      });
    try {
      await link(staging, path).catch((error) => {
        if (error.code !== "EEXIST") throw error;
      });
      return path;
    } finally {
      await unlink(staging).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  };
}
