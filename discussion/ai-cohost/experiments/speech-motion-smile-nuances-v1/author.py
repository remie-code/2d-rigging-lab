"""Five hand-authored smile timing sketches. Model and product are read-only."""
from pathlib import Path
import json
p=Path(__file__).resolve().parent
def make(label,utterance,tracks,poses,intent):
    duration=6500
    fixed=dict.fromkeys(['param_face_angle_x','param_face_angle_y','param_face_angle_z','param_body_angle_x','param_body_angle_z','param_eyeball_x','param_eyeball_y','param_shared_laughter','param_startled','param_wry_smile'],0)
    fixed.update(param_eye_left_open=1,param_eye_right_open=1)
    tracks['face_angle_x']=[(0,0),(.4,0),(1.35,-10),(4.6,-10),(6,0),(6.5,0)]
    return dict(label=label,utterance=utterance,durationMs=duration,entry='preserve-clock',intent=intent,target='partner-screen-left; common comparison direction',previewTimesMs=poses,fixed=fixed,tracks={f'param_{k}':[[round(t*1000),v] for t,v in seq] for k,seq in tracks.items()},stage={'scale':[[0,1],[duration,1]],'y':[[0,0],[duration,0]]})
clips={
'01-soft':make('柔らかく微笑む','それが伝わるの、僕もうれしい。',{
'shared_laughter':[(0,0),(.85,0),(2,.72),(3.8,.72),(5.25,0),(6.5,0)],
'face_angle_z':[(0,0),(.7,0),(2.1,3),(3.9,3),(5.8,0),(6.5,0)],
'face_angle_y':[(0,0),(.8,0),(2.1,-1.5),(3.9,-1.5),(5.8,0),(6.5,0)]},[0,1000,1600,2400,4000,6500],'Slow gentle smile and small inclination; intermediate smile is deliberately tested.'),
'02-joy':make('嬉しさが弾む','やった！ ちゃんと隙を見つけて倒したね。',{
'shared_laughter':[(0,0),(.45,0),(1.05,1),(2.7,1),(4.65,0),(6.5,0)],
'face_angle_y':[(0,0),(.5,0),(1.05,5),(1.6,-2),(2.25,1),(3.4,1),(5.6,0),(6.5,0)],
'body_angle_z':[(0,0),(.55,0),(1.1,-1.5),(1.85,.5),(2.7,0),(6.5,0)]},[0,700,1050,1600,2700,6500],'Quick smile, a single buoyant head accent settling without repeated laughter bounce; no pretend clap.'),
'03-shy':make('照れながら笑う','あ、作るの僕だった。楽しみに待つ側になってた。',{
'shared_laughter':[(0,0),(1.5,0),(2.35,.95),(3.9,.95),(5.2,0),(6.5,0)],
'face_angle_y':[(0,0),(.55,0),(1,2),(1.5,2),(2.5,-5),(3.8,-5),(5.7,0),(6.5,0)],
'face_angle_z':[(0,0),(1.5,0),(2.6,-4),(3.8,-4),(5.7,0),(6.5,0)]},[0,1000,1500,2400,3800,6500],'Brief neutral realization, delayed smile and lowered chin; no blush or eye diversion invented.'),
'04-proud':make('少し得意げに笑う','道には迷うけど、足りないルーンは見失わないよ。',{
'shared_laughter':[(0,0),(.9,0),(1.7,.85),(3.65,.85),(4.95,0),(6.5,0)],
'face_angle_y':[(0,0),(.65,0),(1.7,5),(3.65,5),(5.6,0),(6.5,0)],
'face_angle_z':[(0,0),(.9,0),(1.85,-2),(3.65,-2),(5.6,0),(6.5,0)]},[0,900,1700,2700,4000,6500],'Small raised chin held steadily; confidence comes from posture, not a new smirk.'),
'05-relief':make('息を抜いてから微笑む','よかった、声届いたね！ 教えてくれてありがとう。',{
'shared_laughter':[(0,0),(2,0),(2.9,.9),(4.15,.9),(5.3,0),(6.5,0)],
'face_angle_y':[(0,0),(.45,0),(1.35,-4),(1.85,-4),(2.9,-1),(4.15,-1),(5.8,0),(6.5,0)],
'body_angle_z':[(0,0),(.4,0),(1.5,1.2),(2.85,0),(6.5,0)]},[0,750,1500,2400,3300,6500],'Release posture first while eyes remain normal; then smile. Breath is implied, not simulated.')}
(p/'performance.json').write_text(json.dumps(dict(version=1,id='smile-nuances-study-v1',clips=clips),ensure_ascii=False,indent=2),encoding='utf-8')
(p/'definition.json').write_text(json.dumps(dict(id='smile-nuances-v1',modelRevision=843,fps=20,comparisonDurationMs=6500,performanceFile='performance.json',view=dict(stageViewport=dict(minX=540,minY=-40,width=1040,height=1100),outputWidth=624,outputHeight=660),lipPulses=[]),indent=2),encoding='utf-8')
