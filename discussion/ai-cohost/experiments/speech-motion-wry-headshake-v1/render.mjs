import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {loadAuthoringPackageDirectory} from '../../../../apps/authoring-host/src/package-directory-io.ts';
import {evaluatePerceptionSnapshot} from '../../../../apps/authoring-host/src/perception/evaluation-adapter.ts';
import {createPerceptionRenderScene} from '../../../../apps/authoring-host/src/perception/render-scene-adapter.ts';
import {compileRuntimeModel} from '../../../../packages/runtime-core/src/runtime-core.ts';
import {renderSceneToPng} from '../../../../packages/render-software/src/render-scene-to-png.ts';
const source=dirname(fileURLToPath(import.meta.url)),out=process.env.WRY_HEADSHAKE_OUT??resolve(source,'../../../../tmp/speech-motion/wry-headshake-v1'),model='C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843';
mkdirSync(out,{recursive:true});const definitionBytes=readFileSync(resolve(source,'definition.json'));writeFileSync(resolve(out,'definition.json'),definitionBytes);const def=JSON.parse(definitionBytes);const sha=b=>createHash('sha256').update(b).digest('hex');
function inventory(dir,prefix=''){return readdirSync(resolve(dir,prefix),{withFileTypes:true}).flatMap(e=>{const path=prefix?prefix+'/'+e.name:e.name;return e.isDirectory()?inventory(dir,path):[{path,sha256:sha(readFileSync(resolve(dir,path)))}];}).sort((a,b)=>a.path.localeCompare(b.path));}
const liveSource='C:/workspace/remie/rigging/astra-chan/workspace',liveExport='C:/workspace/remie/rigging/astra-chan/exports/astra-chan-runtime',liveBefore=inventory(liveSource),exportBefore=inventory(liveExport);
const before=inventory(model),{session}=await loadAuthoringPackageDirectory(model);if(session.packageRevision!==843)throw Error('r843 required');
const initial=evaluatePerceptionSnapshot(session),graph=initial.graph,template=createPerceptionRenderScene({session,graph,snapshot:initial.snapshot}),byId=new Map(template.drawables.map(d=>[d.drawableId,d]));const instance=compileRuntimeModel(graph).createInstance();
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
function track(points,t){for(let i=1;i<points.length;i++){if(t>points[i][0])continue;return points[i-1][1]+(points[i][1]-points[i-1][1])*smooth((t-points[i-1][0])/(points[i][0]-points[i-1][0]));}return points.at(-1)[1];}
mkdirSync(resolve(out,'frames'),{recursive:true});const evidence=[];
for(let i=0;i<=Math.round(def.durationMs*def.fps/1000);i++){
 const t=i*1000/def.fps,values=Object.fromEntries(Object.entries(def.tracks).map(([p,points])=>[p,track(points,t)]));let vowel=null;values.param_mouth_open=0;for(const [a,b,c,v,peak]of def.lipPulses)if(t>=a&&t<=c){vowel=v;values.param_mouth_open=peak*(t<b?smooth((t-a)/(b-a)):1-smooth((t-b)/(c-b)));if(v!=='a')values['param_mouth_vowel_'+v]=1;}
 const {frame}=instance.evaluateRenderFrame({schemaVersion:'runtime-evaluation-input-v1',frameIndex:i,deltaTimeMs:0,resetReasons:['packageLoad'],authoredParameterValues:values,targetIds:[]},{controlOptions:{snapshotValidation:'skip'}});
 const scene={...template,drawables:frame.drawables.map(d=>{const b=byId.get(d.drawableId);for(const p of d.vertices)if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('nonfinite');return {...b,mesh:{...b.mesh,vertices:d.vertices},opacity:d.opacity,drawOrder:d.drawOrder,visible:d.visible};})};
 const requested=0,panY=0;
 const view={...def.view,stageViewport:{...def.view.stageViewport,minY:def.view.stageViewport.minY-panY*def.view.stageViewport.height/def.view.outputHeight}};
 const file=String(i).padStart(3,'0')+'.png',png=renderSceneToPng(scene,view).png;writeFileSync(resolve(out,'frames',file),png);evidence.push({frame:i,timeMs:t,file,values,vowel,stageRequestedPx:requested,stageRenderedPanYPx:panY,pngSha256:sha(png)});if(i%20===0)console.log('frame '+i);
}
const liveSourceUnchanged=JSON.stringify(liveBefore)===JSON.stringify(inventory(liveSource)),liveExportUnchanged=JSON.stringify(exportBefore)===JSON.stringify(inventory(liveExport));if(!liveSourceUnchanged||!liveExportUnchanged)throw Error('live files changed');const after=inventory(model);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('source changed');
writeFileSync(resolve(out,'evidence.json'),JSON.stringify({modelRevision:843,stagePresenceEnabled:false,evaluation:'authoring graph compiled runtime-core render frame; no runtime export',frames:evidence},null,2));writeFileSync(resolve(out,'provenance.json'),JSON.stringify({sourceModel:model,revision:843,files:before,sourceUnchanged:true,liveSourceUnchanged,liveExportUnchanged,liveSourceFiles:liveBefore,liveExportFiles:exportBefore,definitionSha256:sha(readFileSync(resolve(out,'definition.json'))),productExportUnchangedByThisScript:true},null,2));console.log('Rendered '+evidence.length+' frames');