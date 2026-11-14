import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRuntimeExportDirectory} from '../../../../apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts';
import {createEvaluatedRuntimeExportStageRenderInput} from '../../../../apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts';
import {RuntimeExportEvaluationCache} from '../../../../apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts';
import {RuntimeExportRuntimeModelInstanceCache} from '../../../../apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts';
import {renderSceneToPng} from '../../../../packages/render-software/src/render-scene-to-png.ts';

const here=fileURLToPath(new URL('.',import.meta.url));
const out=resolve(process.argv[3]??resolve(here,'../../../../tmp/speech-motion/received-v1-replay'));
const definition=JSON.parse(readFileSync(resolve(here,'definition.json'),'utf8').replace(/^\uFEFF/,''));
const provenance=JSON.parse(readFileSync(resolve(here,'provenance.json'),'utf8').replace(/^\uFEFF/,''));
mkdirSync(resolve(out,'frames'),{recursive:true});
const model=resolve(process.argv[2]??provenance.sourceModel);
for(const file of provenance.files){
  const hash=createHash('sha256').update(readFileSync(resolve(model,file.path))).digest('hex');
  if(hash!==file.sha256)throw Error('Source model differs from preserved version: '+file.path);
}
const {payload}=await loadRuntimeExportDirectory(model);
const evaluationCache=new RuntimeExportEvaluationCache();
const runtimeModelInstanceCache=new RuntimeExportRuntimeModelInstanceCache();
const smooth=x=>x*x*x*(10+x*(-15+6*x));
function curve(t,keys){
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
    const [a,x]=keys[i-1],[b,y]=keys[i];
    return x+(y-x)*smooth(Math.max(0,Math.min(1,(t-a)/(b-a))));
  }
  return keys.at(-1)[1];
}
const keys=definition.strengthKeys;
const fps=definition.evaluationFps;
const report={model,intent:definition.intent,fps,renderFps:fps/definition.renderEveryFrames,duration:definition.durationSeconds,keys,frames:[],finiteGeometry:true};
for(let i=0;i<=Math.round(definition.durationSeconds*fps);i++){
  const t=i/fps,nod=curve(t,keys);
  const input=Object.fromEntries(Object.entries(definition.parameters).map(([id,p])=>[id,p.base+p.gain*nod]));
  const result=createEvaluatedRuntimeExportStageRenderInput(payload,{evaluationCache,runtimeModelInstanceCache,
    poseEvaluationMode:'snapshot',authoredParameterValues:input,frameIndex:i,deltaTimeMs:1000/fps,resetReasons:i?[]:['packageLoad']});
  for(const d of result.scene.drawables)for(const p of d.mesh.vertices)if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Nonfinite geometry');
  if(i%definition.renderEveryFrames===0){
    const frame=i/definition.renderEveryFrames;
    const png=renderSceneToPng(result.scene,definition.view).png;
    writeFileSync(resolve(out,'frames',String(frame).padStart(3,'0')+'.png'),png);
    report.frames.push({frame,t,input,effective:result.poseEvaluation.snapshot.parameters.map(p=>({id:p.parameterId,value:p.effectiveValue}))});
    if(frame%20===0)console.log('Rendered '+frame+'/64');
  }
}
writeFileSync(resolve(out,'motion.json'),JSON.stringify(report,null,2));
console.log('Rendered '+report.frames.length+' frames in '+out);
