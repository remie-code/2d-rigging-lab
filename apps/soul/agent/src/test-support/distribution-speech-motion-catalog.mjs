import { readFile, readdir } from "node:fs/promises";

export async function loadDistributionSpeechMotionCatalog() {
  const directory = new URL("../../../../runtime-player/assets/speech-motions/", import.meta.url);
  const filenames = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const assets = await Promise.all(filenames.map(async (name) =>
    JSON.parse(await readFile(new URL(name, directory), "utf8"))));
  const candidates = assets.flatMap((asset) => asset.version === 2
    ? Object.entries(asset.nuances).map(([nuanceId, nuance]) => ({
      id: `${asset.id}--${nuanceId}`,
      description: `${asset.description}\n${nuance.description}`,
      targets: nuance.targets
    }))
    : [asset]);
  return {
    performances: Object.fromEntries(candidates.map(({ id, description }) => [id, description])),
    attentionTargets: { partner: "相方", game: "ゲーム画面", viewers: "視聴者" },
    pairs: candidates.flatMap(({ id, targets }) => Object.entries(targets)
      .map(([attentionTargetId, clipId]) => ({ performanceId: id, attentionTargetId, clipId })))
  };
}
