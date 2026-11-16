from pathlib import Path
import json
p=Path(__file__).resolve().parent
old=json.loads((p.parent/'speech-motion-smile-nuances-v1/performance.json').read_text(encoding='utf-8'))['clips']['03-shy']
clip=json.loads(json.dumps(old));clip.update(label='照れ笑い：一度そらして戻る',durationMs=7000,intent='Research-inspired hypothesis: attend to partner, avert head once and lower chin during restrained smile, return to partner while smile releases, neutral.',previewTimesMs=[0,1300,2450,3600,5050,7000])
tracks={
'face_angle_x':[(0,0),(.35,0),(1.05,-10),(1.45,-10),(2.45,7),(3.7,7),(5.05,-10),(5.55,-10),(6.65,0),(7,0)],
'face_angle_y':[(0,0),(1.25,0),(2.55,-5),(3.7,-5),(5.05,-1),(5.55,-1),(6.65,0),(7,0)],
'face_angle_z':[(0,0),(1.55,0),(2.6,-3),(3.7,-3),(5.05,0),(7,0)],
'shared_laughter':[(0,0),(1.65,0),(2.5,.87),(3.7,.87),(5.15,0),(7,0)]}
clip['tracks']={f'param_{k}':[[round(t*1000),v] for t,v in seq] for k,seq in tracks.items()}
clip['stage']={'scale':[[0,1],[7000,1]],'y':[[0,0],[7000,0]]}
(p/'performance.json').write_text(json.dumps(dict(version=2,id='shy-aversion-study-v2',clips={'shy-v2':clip}),ensure_ascii=False,indent=2),encoding='utf-8')
d=json.loads((p.parent/'speech-motion-smile-nuances-v1/definition.json').read_text());d.update(id='shy-aversion-v2',comparisonDurationMs=7000)
(p/'definition.json').write_text(json.dumps(d,indent=2),encoding='utf-8')
