"""Recreate the six hand-authored timing sketches; no model or product writes."""
from pathlib import Path
import json
p=Path(__file__).resolve().parent
def points(seq): return [[round(t*1000),v] for t,v in seq]
def make(label,utterance,duration,tracks,poses,intent):
    fixed=dict.fromkeys(['param_face_angle_x','param_face_angle_y','param_face_angle_z','param_body_angle_x','param_body_angle_z','param_eyeball_x','param_eyeball_y','param_shared_laughter','param_startled','param_wry_smile'],0)
    fixed.update(param_eye_left_open=1,param_eye_right_open=1)
    return dict(label=label,utterance=utterance,durationMs=duration,entry='preserve-clock',intent=intent,previewTimesMs=poses,fixed=fixed,tracks={f'param_{k}':points(v) for k,v in tracks.items()},stage={'scale':[[0,1],[duration,1]],'y':[[0,0],[duration,0]]})
clips={
'01-search':make('場所を探す','この辺には見当たらないね。階段の先はどうだろう。',6600,{
'face_angle_x':[(0,0),(.6,0),(1.2,-15),(1.65,-15),(2.35,12),(2.75,12),(3.35,18),(3.85,18),(4.5,-7),(5,-7),(6,0),(6.6,0)],
'face_angle_y':[(0,0),(.7,0),(1.3,-3),(1.7,-3),(2.4,2),(2.8,2),(3.4,6),(3.9,6),(4.6,-1),(5,-1),(6,0),(6.6,0)],
'body_angle_x':[(0,0),(.85,0),(1.5,-2),(1.85,-2),(2.65,1.5),(3.7,2),(4.9,-.8),(6.1,0),(6.6,0)]},[0,1400,2500,3600,4700,6600],'Several short inspections, no settled target.'),
'02-discern':make('一か所を見極める','鎧を着た兵士っぽいけど、手すりで武器がよく見えないね。',6500,{
'face_angle_x':[(0,0),(.65,0),(1.45,8),(2,8),(2.85,12),(4.7,12),(5.9,0),(6.5,0)],
'face_angle_y':[(0,0),(.7,0),(1.5,-2),(2.1,-2),(2.9,-4),(4.7,-4),(5.9,0),(6.5,0)],
'face_angle_z':[(0,0),(1.75,0),(2.8,-4),(4.7,-4),(5.9,0),(6.5,0)],
'body_angle_z':[(0,0),(2,0),(3,-.7),(4.65,-.7),(6,0),(6.5,0)]},[0,1500,2200,3100,4600,6500],'Acquire one region, adjust viewing posture once, hold for detail.'),
'03-compare':make('関係を見比べる','今度はスイッチが二つあるんだね。動かす場所を分けてるのかな。',6900,{
'face_angle_x':[(0,0),(.6,0),(1.3,-16),(2,-16),(2.85,16),(3.65,16),(4.45,-16),(5.2,-16),(6.2,0),(6.9,0)],
'face_angle_y':[(0,0),(.65,0),(1.3,-2),(5.2,-2),(6.2,0),(6.9,0)],
'body_angle_x':[(0,0),(.9,0),(1.6,-1.6),(2.15,-1.6),(3.15,1.6),(3.8,1.6),(4.75,-1.6),(5.25,-1.6),(6.3,0),(6.9,0)]},[0,1600,2400,3200,4800,6900],'A, B, then return deliberately to the same A; equal height.'),
'04-recheck':make('状態・残りを確認する','あ、奥の台の上に金色の箱が見える。あれ、まだ取ってないやつかな。',6200,{
'face_angle_x':[(0,0),(.65,0),(1.4,10),(2.1,10),(2.75,4),(3.05,4),(3.65,10),(4.65,10),(5.6,0),(6.2,0)],
'face_angle_y':[(0,0),(.7,0),(1.45,3),(4.65,3),(5.6,0),(6.2,0)]},[0,1600,2800,3700,4600,6200],'Check same region twice with a short intervening reconsideration; no answer nod.'),
'05-follow-cue':make('相方の気づきに追いつく','お、見つけた？ どこにあった？',5700,{
'face_angle_x':[(0,0),(.5,0),(.95,-13),(1.2,-13),(1.95,5),(2.5,5),(3,8),(4.15,8),(5.1,0),(5.7,0)],
'face_angle_y':[(0,0),(1.15,0),(1.95,3),(2.5,3),(3,2),(4.15,2),(5.1,0),(5.7,0)]},[0,1000,2000,2800,3900,5700],'Brief screen-left acknowledgement, then acquire a near-front game region and settle.'),
'06-cautious':make('安全を確かめながらうかがう','ここで見失ってくれるかな。いったん落ち着きたいね。',7200,{
'face_angle_x':[(0,0),(1.25,0),(2.15,5),(2.55,5),(3.55,13),(5.55,13),(6.65,0),(7.2,0)],
'face_angle_y':[(0,0),(.9,0),(1.6,-3),(5.55,-3),(6.65,0),(7.2,0)],
'face_angle_z':[(0,0),(2.4,0),(3.7,-2),(5.55,-2),(6.65,0),(7.2,0)],
'body_angle_x':[(0,0),(2.5,0),(3.85,1),(5.55,1),(6.75,0),(7.2,0)]},[0,1200,2300,3800,5500,7200],'Pause before moving, partial peek then fuller peek, maintain watch without startle.')}
(p/'performance.json').write_text(json.dumps(dict(version=1,id='search-nuances-study-v1',clips=clips),ensure_ascii=False,indent=2),encoding='utf-8')
definition=dict(id='search-nuances-v1',modelRevision=843,fps=20,comparisonDurationMs=7800,performanceFile='performance.json',view=dict(stageViewport=dict(minX=540,minY=-40,width=1040,height=1100),outputWidth=624,outputHeight=660),lipPulses=[])
(p/'definition.json').write_text(json.dumps(definition,indent=2),encoding='utf-8')
