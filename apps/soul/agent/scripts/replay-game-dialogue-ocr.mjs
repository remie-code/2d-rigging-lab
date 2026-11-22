import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const scenes = {
  'combat-35': {
    frames: 'combat-35/verified',
    manifest: 'combat-35/verified/ocr.json',
    baseline: 'combat-35/verified/tracking.json',
    revised: 'damage-reread/combat-filtered.json',
  },
  'minho-44': {
    frames: 'minho-44',
    manifest: 'minho-44/replay-1s/ocr.json',
    baseline: 'minho-44/replay-1s/tracking.json',
    revised: 'damage-reread/minho-filtered.json',
  },
  story: {
    frames: 'story',
    manifest: 'story/ocr.json',
    baseline: 'timing/story-split-replay.json',
    revised: 'damage-reread/story-filtered.json',
    // The first two source images still display a seek preview.
    firstAtMs: 2752700,
  },
};

function convertFrameEvidence(ocr, convert) {
  const frame = { ...ocr };
  for (const key of ['strokeMask', 'pixelTiles']) {
    if (frame[key]) frame[key] = { ...frame[key], data: convert(frame[key].data) };
  }
  return frame;
}

const { values } = parseArgs({
  options: {
    probe: { type: 'string' },
    out: { type: 'string' },
    scene: { type: 'string', multiple: true },
    'reuse-ocr': { type: 'boolean' },
    help: { type: 'boolean' },
  },
});
if (values.help) {
  console.log('node apps/soul/agent/scripts/replay-game-dialogue-ocr.mjs [--probe PATH] [--out PATH] [--scene combat-35|--scene minho-44|--scene story] [--reuse-ocr]');
  process.exit(0);
}
const probeDir = values.probe
  ? resolve(values.probe)
  : fileURLToPath(new URL('../../../../tmp/game-dialogue-endfield-probe/', import.meta.url));
const outDir = values.out ? resolve(values.out) : join(probeDir, 'product-replay');
const selectedScenes = values.scene ?? Object.keys(scenes);
for (const name of selectedScenes) {
  if (!Object.hasOwn(scenes, name)) throw new Error(`Unknown scene: ${name}`);
}
const [{ recognizeScreenText }, { createGameDialogueTracker }] = await Promise.all([
  import('../src/eyes/windows-ocr.mjs'),
  import('../src/eyes/game-dialogue-tracker.mjs'),
]);
await mkdir(outDir, { recursive: true });
const reports = [];
for (const name of selectedScenes) {
  const scene = scenes[name];
  const [manifest, baseline, revised] = await Promise.all(
    [scene.manifest, scene.baseline, scene.revised].map(async (file) => (
      JSON.parse((await readFile(join(probeDir, file), 'utf8')).replace(/^\uFEFF/, ''))
    )),
  );
  const inputs = manifest.map(({ image }) => {
    const file = basename(image.replaceAll('\\', '/'));
    const match = /^v(\d+\.\d+)\.png$/u.exec(file);
    if (!match) throw new Error(`Expected a timestamped source PNG, got ${file}`);
    return { file, capturedAtMs: Math.round(Number(match[1]) * 1000) };
  }).filter(({ capturedAtMs }) => capturedAtMs >= (scene.firstAtMs ?? 0))
    .sort((a, b) => a.capturedAtMs - b.capturedAtMs);
  const tracker = createGameDialogueTracker();
  const withoutReread = createGameDialogueTracker();
  const cacheFile = join(outDir, `${name}-ocr.json.gz`);
  const cached = values['reuse-ocr']
    ? JSON.parse(gunzipSync(await readFile(cacheFile)).toString('utf8'))
    : null;
  if (cached && cached.length !== inputs.length) {
    throw new Error(`OCR cache inputs differ from the ${name} manifest`);
  }
  const captured = [];
  const frames = [];
  const events = [];
  const eventsWithoutReread = [];
  for (const [index, input] of inputs.entries()) {
    let ocr;
    if (cached) {
      const entry = cached[index];
      if (entry?.file !== input.file || entry?.capturedAtMs !== input.capturedAtMs) {
        throw new Error(`OCR cache inputs differ from the ${name} manifest`);
      }
      ocr = convertFrameEvidence(entry.ocr, (data) => Buffer.from(data, 'base64'));
    } else {
      const imageBase64 = (await readFile(join(probeDir, scene.frames, input.file))).toString('base64');
      ocr = await recognizeScreenText({ imageBase64, capturedAtMs: input.capturedAtMs });
      captured.push({
        ...input,
        ocr: convertFrameEvidence(ocr, (data) => Buffer.from(data).toString('base64')),
      });
    }
    const finalized = ocr.error ? [] : tracker.update(ocr);
    const finalizedWithoutReread = ocr.error ? [] : withoutReread.update({
      ...ocr,
      lines: [...ocr.lines, ...ocr.damageExclusions],
    });
    events.push(...finalized);
    eventsWithoutReread.push(...finalizedWithoutReread);
    // Visual evidence is passed to the trackers but omitted from the audit log.
    const { strokeMask, pixelTiles, ...auditOcr } = ocr;
    frames.push({ ...input, ocr: auditOcr, finalized, finalizedWithoutReread });
  }
  const pending = tracker.pending();
  const pendingWithoutReread = withoutReread.pending();
  const counts = {
    frames: frames.length,
    errors: frames.filter(({ ocr }) => ocr.error).length,
    finalized: events.length,
    pending: pending.length,
    finalizedWithoutReread: eventsWithoutReread.length,
    pendingWithoutReread: pendingWithoutReread.length,
    unchangedByReread: isDeepStrictEqual(events, eventsWithoutReread)
      && isDeepStrictEqual(pending, pendingWithoutReread),
    baselineFinalized: baseline.events.length,
    baselinePending: baseline.pending.length,
    revisedBaselineFinalized: revised.events.length,
    revisedBaselinePending: revised.pending.length,
  };
  const report = {
    scene: name, reusedOcr: Boolean(cached), counts, frames, events, pending,
    eventsWithoutReread, pendingWithoutReread, baseline, revised,
  };
  const file = join(outDir, `${name}.json`);
  if (!cached && counts.errors === 0) await writeFile(cacheFile, gzipSync(JSON.stringify(captured)));
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ scene: name, ...counts, file }));
  reports.push(report);
}
if (reports.some(({ counts }) => counts.errors > 0)) process.exitCode = 1;
