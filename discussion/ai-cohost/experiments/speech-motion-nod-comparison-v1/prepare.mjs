import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const source=dirname(fileURLToPath(import.meta.url)),root=resolve(source,'../../../..');
const file=resolve(root,'apps/runtime-player/assets/speech-motions/receive.json');
const bytes=readFileSync(file),original=JSON.parse(bytes).clips.receive;
const fixed=JSON.parse(readFileSync(resolve(source,'../speech-motion-understanding-nod-v1/performance.json'))).clips['understanding-nod-v1'].fixed;
const tracks=structuredClone(original.tracks);
for(const [id,points] of Object.entries(tracks)){
  if(points.at(-1)[0]<original.durationMs)points.push([original.durationMs,points.at(-1)[1]]);
  points.push([original.durationMs+400,original.defaults[id]],[4200,original.defaults[id]]);
}
writeFileSync(resolve(source,'performance.json'),JSON.stringify({version:1,id:'nod-comparison-receive-v1',clips:{'receive-comparison':{entry:'preserve-clock',durationMs:4200,tracks,fixed,stage:{scale:[[0,1],[4200,1]],y:[[0,0],[4200,0]]}}}},null,2)+'\n');
writeFileSync(resolve(source,'comparison-input.json'),JSON.stringify({leftSource:'apps/runtime-player/assets/speech-motions/receive.json',leftSourceSha256:createHash('sha256').update(bytes).digest('hex'),clip:'receive',clipDurationMs:original.durationMs,entryLeadInMsExcluded:180,releaseMs:400,rightSource:'../speech-motion-understanding-nod-v1/performance.json',commonClipStartMs:0},null,2)+'\n');
