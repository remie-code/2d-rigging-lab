from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,sys
source=Path(__file__).resolve().parent
root=source.parents[3];out=root/'tmp/speech-motion/search-nuances-v1'
clips=json.loads((source/'performance.json').read_text(encoding='utf-8'))['clips']
definition=json.loads((source/'definition.json').read_text(encoding='utf-8'))
font=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',23)
title=ImageFont.truetype('C:/Windows/Fonts/meiryob.ttc',27)
small=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',19)
bg='#dedbe5'
def wrap(text,width=580):
    rows=['']
    for c in text:
        if font.getlength(rows[-1]+c)>width: rows.append('')
        rows[-1]+=c
    return rows
def panel(id,clip,n):
    c=Image.new('RGB',(624,780),bg);d=ImageDraw.Draw(c)
    d.text((15,8),id[:2]+'  '+clip['label'],font=title,fill='#282331')
    for j,line in enumerate(wrap(clip['utterance'])): d.text((15,47+j*29),line,font=font,fill='#38313e')
    im=Image.open(out/id/'frames'/f'{n:03}.png').convert('RGBA');c.paste(im,(0,120),im)
    return c
sheet=Image.new('RGB',(1872,6*410),bg);d=ImageDraw.Draw(sheet)
for row,(id,clip) in enumerate(clips.items()):
    d.text((14,row*410+5),id[:2]+'  '+clip['label']+'    '+clip['utterance'],font=font,fill='#282331')
    for col,t in enumerate(clip['previewTimesMs']):
        n=round(t/50);im=Image.open(out/id/'frames'/f'{n:03}.png').convert('RGBA');im=im.resize((312,330),Image.Resampling.LANCZOS)
        sheet.paste(im,(col*312,row*410+70),im)
        d.text((col*312+12,row*410+40),f'{t/1000:.2f} s',font=small,fill='#282331')
sheet.save(out/'contact-sheet.png')
if '--preview' in sys.argv: sys.exit()
def encode(folder,dest):
    subprocess.run(['ffmpeg','-y','-framerate','20','-i',str(folder/'%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    subprocess.run(['ffmpeg','-v','error','-i',str(dest),'-f','null','-'],check=True)
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height,nb_frames,duration','-of','json',str(dest)]))
probes={}
for id,clip in clips.items():
    folder=out/id/'presentation';folder.mkdir(exist_ok=True)
    for n in range(round(clip['durationMs']/50)+1):panel(id,clip,n).save(folder/f'{n:03}.png')
    probes[id]=encode(folder,out/(id+'.mp4'))
folder=out/'comparison';folder.mkdir(exist_ok=True)
for n in range(round(definition['comparisonDurationMs']/50)+1):
    canvas=Image.new('RGB',(1872,1560),bg)
    for i,(id,clip) in enumerate(clips.items()):
        frame=min(n,round(clip['durationMs']/50))
        canvas.paste(panel(id,clip,frame),((i%3)*624,(i//3)*780))
    canvas.save(folder/f'{n:03}.png')
    if n==76: canvas.save(out/'comparison-poster.png')
probes['comparison']=encode(folder,out/'comparison-3x2.mp4')
evidence=json.loads((out/'evidence.json').read_text(encoding='utf-8'))
neutralHashes=[]
for id,clip in clips.items():
    frames=[f for f in evidence['frames'] if f['clip']==id]
    assert frames[0]['pngSha256']==frames[-1]['pngSha256'],id
    neutralHashes.append(frames[0]['pngSha256'])
    assert len(frames)==round(clip['durationMs']/50)+1
    assert all(f['stageScale']==1 and f['stageRenderedPanYPx']==0 for f in frames)
    assert all(f['values']['param_eye_left_open']==1 and f['values']['param_eye_right_open']==1 and f['values']['param_mouth_open']==0 for f in frames)
    assert all(abs(f['values']['param_face_angle_x'])<=24 for f in frames)
    assert all(all(f['values'][k]==0 for k in ['param_eyeball_x','param_eyeball_y','param_shared_laughter','param_startled','param_wry_smile']) for f in frames)
assert len(set(neutralHashes))==1
verification=dict(allVideosDecoded=True,probes=probes,allInitialAndEndPngsIdentical=True,stageFixed=True,eyesNormalNoBlink=True,mouthClosedRenderOnly=True,finiteGeometryCheckedInRenderer=True,commonClockNoTimeWarp=True,totalFrames=len(evidence['frames']))
(out/'verification.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')
print(json.dumps(verification,indent=2))
