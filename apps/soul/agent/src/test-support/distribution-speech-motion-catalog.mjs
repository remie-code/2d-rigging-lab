import { readFile, readdir } from "node:fs/promises";

export async function loadDistributionSpeechMotionCatalog() {
  const directory = new URL("../../../../runtime-player/assets/speech-motions/", import.meta.url);
  const filenames = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const assets = await Promise.all(filenames.map(async (name) =>
    JSON.parse(await readFile(new URL(name, directory), "utf8"))));
  return {
    performances: Object.fromEntries(assets.map(({ id, description }) => [id, description])),
    attentionTargets: { partner: "相方", game: "ゲーム画面", viewers: "視聴者" },
    pairs: assets.flatMap(({ id, targets }) => Object.keys(targets)
      .map((attentionTargetId) => ({ performanceId: id, attentionTargetId })))
  };
}
