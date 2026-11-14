import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const { source, records } = JSON.parse(await readFile(new URL('./judgments.json', import.meta.url), 'utf8'));
const repo = new URL('../../../../', import.meta.url);
const [recordDirectory] = process.argv.slice(2);
const originals = recordDirectory ? resolve(recordDirectory) : new URL('apps/soul/agent/tmp/speech-intent-none/', repo);
const registryFile = new URL('apps/runtime-player/src/main/control-channel/contract/speech-motion-registry.json', repo);
const registryBytes = await readFile(registryFile);
const { pairs } = JSON.parse(registryBytes);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const selected = [];
for (const name of (await readdir(originals)).filter(name => name.endsWith('.json')).sort()) {
  const path = typeof originals === 'string' ? join(originals, name) : new URL(name, originals);
  const bytes = await readFile(path);
  const record = JSON.parse(bytes);
  if (record.sceneId !== source.sceneId) continue;
  assert.equal(record.result, 'none', name);
  selected.push({ name, hash: sha(bytes), recordedAt: record.recordedAt, intent: record.intent });
}
const digestLines = selected.map(({ name, hash }) => `${name} ${hash.toUpperCase()}`).join('\n');
assert.equal(sha(digestLines), source.sourceSetSha256);
assert.equal(selected.length, source.sourceFileCount);
assert.equal(new Set(selected.map(record => record.intent)).size, source.uniqueIntentStrings);
selected.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.name.localeCompare(b.name));
assert.equal(records.length, selected.length);
assert.equal(selected[0].recordedAt, source.firstRecordedAt);
assert.equal(selected.at(-1).recordedAt, source.lastRecordedAt);

const analysis = records.map((record, index) => {
  const original = selected[index];
  assert.equal(record.order, index + 1);
  assert.equal(`${record.recordId}.json`, original.name);
  assert.equal(record.sha256, original.hash);
  assert(!record.secondary.includes(record.family), record.recordId);
  const pair = pairs.find(pair => pair.performanceId === record.performance && pair.attentionTargetId === record.target);
  const lookup = !record.performance ? 'no-candidate' : record.target === 'unknown' ? 'unknown-target' : pair ? 'registered' : 'unproduced';
  if (['clear', 'near', 'legacy-reconsider'].includes(record.assessment)) assert.equal(lookup, 'registered', record.recordId);
  if (record.assessment === 'unproduced') assert.equal(lookup, 'unproduced', record.recordId);
  if (record.assessment === 'target-unknown') assert.equal(lookup, 'unknown-target', record.recordId);
  return { ...record, lookup, presetId: pair?.presetId ?? '' };
});

function counts(rows, key) {
  const result = {};
  for (const row of rows) {
    const name = row[key] ?? 'no-candidate';
    result[name] = (result[name] ?? 0) + 1;
  }
  return result;
}

const groupBy = (rows, key) => Object.groupBy(rows, row => row[key] ?? 'no-candidate');
const byAssessment = counts(analysis, 'assessment');
const countCoverage = total => ({ total, percent: Number((100 * total / analysis.length).toFixed(2)), remaining: analysis.length - total });
const summary = {
  source,
  registrySha256: sha(registryBytes),
  registryPairs: pairs.length,
  distinctPresets: new Set(pairs.map(pair => pair.presetId)).size,
  byAssessment,
  byFamily: counts(analysis, 'family'),
  uncoveredByFamily: counts(analysis.filter(row => row.assessment !== 'clear'), 'family'),
  byTarget: counts(analysis, 'target'),
  byTargetReading: counts(analysis, 'targetReading'),
  byCandidateMovementSubtype: counts(analysis.filter(row => row.movementSubtype), 'movementSubtype'),
  byPerformance: Object.fromEntries(Object.entries(groupBy(analysis, 'performance')).map(([performance, rows]) => [performance, counts(rows, 'assessment')])),
  coverage: {
    conservative: countCoverage(byAssessment.clear),
    includingNearNew: countCoverage(byAssessment.clear + byAssessment.near),
    includingLegacyReconsideration: countCoverage(byAssessment.clear + byAssessment.near + byAssessment['legacy-reconsider'])
  }
};

const headers = ['order', 'recordId', 'sha256', 'family', 'secondary', 'target', 'targetReading', 'assessment', 'performance', 'lookup', 'presetId', 'movementSubtype', 'note'];
const csvField = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [headers.join(','), ...analysis.map(record => headers.map(key => csvField(record[key])).join(','))].join('\r\n');
await writeFile(new URL('./records.csv', import.meta.url), '\uFEFF' + csv + '\r\n');
await writeFile(new URL('./summary.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
