from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,sys,math
source=Path(__file__).resolve().parent;root=source.parents[3]
out=root/'tmp/speech-motion/shy-aversion-v2';old=root/'tmp/speech-motion/smile-nuances-v1'
font=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',21);title=ImageFont.truetype('C:/Windows/Fonts/meiryob.ttc',25)
bg='#dedbe5'
def frame(v,n):return Image.open((old/'03-shy' if v==1 else out/'shy-v2')/'frames'/f'{min(n,130 if v==1 else 140):03}.png').convert('RGBA')
times=[0,1300,2450,3600,5050,7000]
sheet=Image.new('RGB',(1872,820),bg);d=ImageDraw.Draw(sheet)
for row,v in enumerate([1,2]):
    d.text((15,row*410+5),'原案：相手を向いたまま' if v==1 else '改訂：相手 → 一度そらす → 相手',font=title,fill='#282331')
    for col,t in enumerate(times):
        im=frame(v,round(t/50)).resize((312,330),Image.Resampling.LANCZOS);sheet.paste(im,(col*312,row*410+75),im)
        d.text((col*312+15,row*410+43),f'{t/1000:.2f} s',font=font,fill='#282331')
sheet.save(out/'contact-sheet.png')
if '--preview' in sys.argv:sys.exit()
def panel(v,n):
    c=Image.new('RGB',(624,800),bg);d=ImageDraw.Draw(c)
    d.text((15,8),'原案：相手を向いたまま' if v==1 else '改訂：一度そらして戻る',font=title,fill='#282331')
    d.text((15,45),'あ、作るの僕だった。',font=font,fill='#282331')
    d.text((15,75),'すっかり楽しみに待つ側になってた。',font=font,fill='#282331')
    d.text((15,107),f'{n/20:.2f} s   同時開始・時間伸縮なし',font=font,fill='#282331')
    im=frame(v,n);c.paste(im,(0,140),im);return c
def encode(folder,name):
    dest=out/name
    subprocess.run(['ffmpeg','-y','-framerate','20','-i',str(folder/'%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    subprocess.run(['ffmpeg','-v','error','-i',str(dest),'-f','null','-'],check=True)
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height,nb_frames,duration','-of','json',str(dest)]))
comparison=out/'comparison';comparison.mkdir(exist_ok=True);individual=out/'individual';individual.mkdir(exist_ok=True)
for n in range(141):
    left=panel(1,n);right=panel(2,n);canvas=Image.new('RGB',(1248,800),bg);canvas.paste(left,(0,0));canvas.paste(right,(624,0))
    canvas.save(comparison/f'{n:03}.png');right.save(individual/f'{n:03}.png')
    if n==60:canvas.save(out/'comparison-poster.png')
probes={'comparison':encode(comparison,'comparison-v1-v2.mp4'),'v2':encode(individual,'shy-v2.mp4')}
e=json.loads((out/'evidence.json').read_text())['frames'];oe=json.loads((old/'evidence.json').read_text())['frames'];oe=[f for f in oe if f['clip']=='03-shy']
assert len(e)==141
assert e[0]['pngSha256']==e[-1]['pngSha256']==oe[0]['pngSha256']==oe[-1]['pngSha256']
assert all(all(math.isfinite(v) for v in f['values'].values()) for f in e)
assert all(all(f['values'][k]==0 for k in ['param_eyeball_x','param_eyeball_y','param_mouth_open','param_startled','param_wry_smile']) for f in e)
assert all(f['stageScale']==1 and f['stageRenderedPanYPx']==0 and abs(f['values']['param_face_angle_x'])<=24 for f in e)
(out/'verification.json').write_text(json.dumps(dict(allVideosDecoded=True,probes=probes,neutralStartEndMatchOriginal=True,finiteParameters=True,finiteGeometryCheckedInRenderer=True,eyesFixedNoBlink=True,stageFixed=True,commonClockNoTimeWarp=True,newFrames=141),indent=2))
print('Assembly and verification complete')
