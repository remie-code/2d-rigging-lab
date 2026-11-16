from pathlib import Path
import json
p=Path(__file__).resolve().parent;root=p.parents[3]
asset=json.loads((root/'apps/runtime-player/assets/speech-motions/wry-headshake.json').read_text(encoding='utf-8'))
base=asset['clips']['wry-headshake-v1']
def make(label,utterance,tracks,poses,intent):
    fixed=dict(base['defaults']);duration=6500
    return dict(label=label,utterance=utterance,durationMs=duration,entry='preserve-clock',intent=intent,previewTimesMs=poses,fixed=fixed,tracks={f'param_{k}':[[round(t*1000),v] for t,v in seq] for k,seq in tracks.items()},stage={'scale':[[0,1],[duration,1]],'y':[[0,0],[duration,0]]})
reference=json.loads(json.dumps(base));reference.update(label='やれやれ（登録済み基準）',utterance='おかわり頼んでないんだよなあ。（抜粋）',intent='Exact registered wry-headshake tracks, fixed values, duration and stage y.',previewTimesMs=[0,1050,1700,2350,3300,6000]);reference['stage']['scale']=[[0,1],[6000,1]]
clips={'01-reference':reference,
'02-empathize':make('きつさに同調する','一発が重いのに連射までしてくるの、きついよね。',{
'wry_smile':[(0,0),(1,0),(1.85,.85),(3.8,.85),(5.2,0),(6.5,0)],
'face_angle_y':[(0,0),(.4,0),(1,-3),(1.55,-1),(3.8,-1),(5.6,0),(6.5,0)],
'face_angle_x':[(0,0),(1.65,0),(2.35,-5),(3.2,3),(3.95,0),(6.5,0)],
'face_angle_z':[(0,0),(1,0),(1.9,2),(3.8,2),(5.5,0),(6.5,0)]},[0,1000,1850,2400,3600,6500],'Receive first with a small dip, then a slower restrained headshake sharing difficulty.'),
'03-deflated':make('報われなさに力が抜ける','あれだけ揉まれて、帰ってきたのは元の場所っていうね。',{
'wry_smile':[(0,0),(.5,0),(1.25,1),(3.75,1),(5.2,0),(6.5,0)],
'face_angle_y':[(0,0),(1.1,0),(2.45,-7),(3.8,-7),(5.7,0),(6.5,0)],
'face_angle_z':[(0,0),(1.2,0),(2.6,4),(3.8,4),(5.7,0),(6.5,0)],
'body_angle_z':[(0,0),(1.25,0),(2.6,1.8),(3.8,1.8),(5.8,0),(6.5,0)]},[0,1250,1800,2600,3800,6500],'Smile arrives before posture gives way; approximate loss of energy with chin and torso, not a literal shoulder shrug.'),
'04-tease':make('可笑しな状況を茶化す','患者を自分で増やして、火薬の香りを楽しむ医者……嫌すぎるな。',{
'wry_smile':[(0,0),(.4,0),(1.05,.9),(3.4,.9),(4.85,0),(6.5,0)],
'face_angle_y':[(0,0),(.6,0),(1.35,3),(2.3,3),(3.5,0),(6.5,0)],
'face_angle_x':[(0,0),(1.05,0),(1.7,-6),(2.4,4),(3.1,0),(6.5,0)],
'face_angle_z':[(0,0),(.7,0),(1.5,-2.5),(2.7,-2.5),(4.8,0),(6.5,0)]},[0,1050,1700,2400,3400,6500],'A lightly raised chin and compact quicker headshake, adding a joke rather than wilting.'),
'05-self-deprecate':make('自分の頼りなさを笑う','道案内のほうも、もうちょっと頼れるといいんだけどね。',{
'wry_smile':[(0,0),(1.1,0),(1.9,.8),(3.4,.8),(4.8,0),(6.5,0)],
'face_angle_x':[(0,0),(.8,0),(1.8,7),(2.85,7),(4.15,0),(6.5,0)],
'face_angle_y':[(0,0),(1,0),(2,-3),(3,-3),(4.4,0),(6.5,0)],
'face_angle_z':[(0,0),(1,0),(2.1,-3),(3,-3),(4.4,0),(6.5,0)]},[0,1100,1900,2900,4200,6500],'Brief aside toward self, then return to the listener; modest awkwardness without strong self-reproach.'),
'06-soft-limit':make('柔らかく限界を伝える','見えてない間に曲がった道までは埋まらないんだよね。（抜粋）',{
'wry_smile':[(0,0),(.75,0),(1.65,.75),(3.8,.75),(5,0),(6.5,0)],
'face_angle_z':[(0,0),(.65,0),(1.8,5),(3.7,5),(5.1,0),(6.5,0)],
'face_angle_y':[(0,0),(3.6,0),(4.3,-2),(5.15,0),(6.5,0)]},[0,750,1800,3000,4300,6500],'Stay facing listener, mild head tilt holds the difficulty; straighten with a tiny dip as the helpful alternative follows.')}
(p/'performance.json').write_text(json.dumps(dict(version=1,id='wry-nuances-study-v1',clips=clips),ensure_ascii=False,indent=2),encoding='utf-8')
(p/'definition.json').write_text(json.dumps(dict(id='wry-nuances-v1',modelRevision=843,fps=20,comparisonDurationMs=6500,performanceFile='performance.json',view=dict(stageViewport=dict(minX=540,minY=-40,width=1040,height=1100),outputWidth=624,outputHeight=660),lipPulses=[]),indent=2),encoding='utf-8')
