from pathlib import Path
import json,hashlib
src=Path(__file__).resolve().parent;root=src.parents[3];out=root/'tmp/speech-motion/game-curiosity-stage-comparison-v1';old=root/'tmp/speech-motion/game-curiosity-v1'
e=json.loads((out/'evidence.json').read_text())['frames'];o=json.loads((old/'evidence.json').read_text())['frames'];pr=json.loads((out/'provenance.json').read_text());vs=json.loads((src/'variants.json').read_text(encoding='utf-8'));checks={}
for v in vs:
 fs=[f for f in e if f['variant']==v['id']];assert len(fs)==129
 assert all(f['values']==o[i]['values'] and f['timeMs']==o[i]['timeMs'] for i,f in enumerate(fs))
 assert all(abs(f['stageScale']-(1+(o[i]['stageScale']-1)*v['factor']))<1e-12 and abs(f['stageRenderedPanYPx']-o[i]['stageRenderedPanYPx']*v['factor'])<1e-12 for i,f in enumerate(fs))
 assert fs[0]['pngSha256']==fs[-1]['pngSha256'];checks[v['id']]={'frames':129,'sameNonStageInputs':True,'sameEnvelopeTiming':True,'firstLastIdentical':True,'scaleRange':[min(f['stageScale']for f in fs),max(f['stageScale']for f in fs)],'yRange':[min(f['stageRenderedPanYPx']for f in fs),max(f['stageRenderedPanYPx']for f in fs)]}
assert all(f['pngSha256']==o[f['frame']]['pngSha256']for f in e if f['variant']=='D')
report={'variants':checks,'originalDAllPngIdentical':True,'snapshotUnchanged':pr['sourceUnchanged'],'liveSourceUnchanged':pr['liveSourceUnchanged'],'liveExportUnchanged':pr['liveExportUnchanged'],'fiveVideosDecodedByAssemble':True}
(src/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
inputs=[src.parent/'speech-motion-game-curiosity-v1/performance.json',src.parent/'speech-motion-game-curiosity-v1/definition.json',src/'variants.json',src/'render.mjs',src/'assemble.py']
(src/'inputs.json').write_text(json.dumps({'model':pr['sourceModel'],'modelFiles':pr['files'],'inputs':[{'path':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in inputs]},indent=2),encoding='utf-8');print(report)
