import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpeechMotionSnapshot } from '../../../../apps/runtime-player/src/main/control-channel/speech-motion-assets.ts';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const out = resolve(root, 'tmp/speech-motion/astra-62-library');
const validation = join(out, 'validation');
await mkdir(validation, { recursive: true });
await cp(join(out, 'candidate-assets'), join(validation, 'speech-motions'), { recursive: true });
const messages = [];
const snapshot = await loadSpeechMotionSnapshot(validation, message => messages.push(message));
await snapshot.archiveSettled;
assert.equal(messages.length, 1, messages.join('\n'));
const expected = [];
const assetPath = 'apps/runtime-player/assets/speech-motions';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
for (const name of git(['ls-tree', '--name-only', '4caa13b8:' + assetPath]).trim().split(/\r?\n/)) {
  const old = JSON.parse(git(['show', '4caa13b8:' + assetPath + '/' + name]));
  for (const [nuance, value] of Object.entries(old.nuances ?? { '': old })) {
    const performanceId = nuance ? old.id + '--' + nuance : old.id;
    for (const [attentionTargetId, clipId] of Object.entries(value.targets)) {
      expected.push(JSON.stringify([performanceId, attentionTargetId, clipId]));
      const { clip } = snapshot.resolve(performanceId, attentionTargetId);
      assert.ok(clip, clipId);
      assert.notDeepEqual(clip, old.clips[clipId], clipId);
    }
  }
}
assert.deepEqual(snapshot.catalog.pairs.map(p => JSON.stringify([p.performanceId, p.attentionTargetId, p.clipId])).sort(), expected.sort());
if (process.argv.includes('--assets-only')) {
  console.log(JSON.stringify({ performances: Object.keys(snapshot.catalog.performances).length, targets: expected.length }));
  process.exit(0);
}
const page = await readFile(join(out, 'index.html'), 'utf8');
const clips = [...page.matchAll(/<video\b[^>]* src="([^"]+)"/g)].map(m => m[1]);
assert.equal(clips.length, 28);
assert.equal(new Set(clips).size, clips.length);
let totalDuration = 0;
for (const path of clips) {
  const filename = join(out, path);
  const streams = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', filename])).streams;
  const video = streams.find(s => s.codec_type === 'video');
  assert.equal(video?.width, 1248, path);
  totalDuration += Number(video.duration);
  assert.ok(streams.some(s => s.codec_type === 'audio'), path);
  execFileSync('ffmpeg', ['-nostdin', '-xerror', '-v', 'error', '-i', filename, '-f', 'null', '-']);
}
const reel = join(out, 'all-comparisons.mp4');
const reelInfo = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_chapters', '-show_format', '-of', 'json', reel]));
assert.equal(reelInfo.chapters.length, clips.length);
assert.ok(Math.abs(Number(reelInfo.format.duration) - totalDuration) < 0.2);
execFileSync('ffmpeg', ['-nostdin', '-xerror', '-v', 'error', '-i', reel, '-f', 'null', '-']);
console.log(JSON.stringify({ performances: Object.keys(snapshot.catalog.performances).length, targets: expected.length, videos: clips.length }));
