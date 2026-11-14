from pathlib import Path
import json, subprocess, hashlib
from tempfile import TemporaryDirectory
from PIL import Image,ImageDraw,ImageFont
source=Path(__file__).resolve().parent
root=source.parents[3]/'tmp/speech-motion/brief-relief-variants-v1-reproduction'
d=json.loads((source/'definition.json').read_text(encoding='utf-8'))
w,h=d['view']['outputWidth'],d['view']['outputHeight'];fps=d['fps'];n=round(d['durationMs']*fps/1000)
font=ImageFont.truetype('C:/Windows/Fonts/YuGothM.ttc',22)
small=ImageFont.truetype('C:/Windows/Fonts/YuGothM.ttc',17)
bg='#252932';fg='#f6f4f1'
def tile(v,i):
    im=Image.new('RGB',(w,h+48),bg);draw=ImageDraw.Draw(im)
    frame=Image.open(root/'frames'/v['id']/f'{i:03}.png').convert('RGBA');im.paste(frame,(0,48),frame)
    draw.text((18,24),v['label'],font=font,fill=fg,anchor='lm')
    draw.text((w-18,24),f'{i/fps:.2f}秒 / 無音',font=small,fill=fg,anchor='rm')
    return im
def encode(folder,path):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(fps),'-i',str(folder/'%03d.png'),'-vf','format=yuv420p','-c:v','libx264','-crf','17','-movflags','+faststart',str(path)],check=True)
with TemporaryDirectory(prefix='assemble-',dir=root) as tmp:
    tmp=Path(tmp)
    for v in d['variants']:
        folder=tmp/v['id'];folder.mkdir()
        for i in range(n):tile(v,i).save(folder/f'{i:03}.png')
        encode(folder,root/f"{v['id']}.mp4")
        if v["id"] == "partner":
            approved=json.loads((source/"approved-partner-reference.json").read_text(encoding="utf-8"))
            assert hashlib.sha256((root/"partner.mp4").read_bytes()).hexdigest() == approved["mp4Sha256"], "approved partner MP4 must be byte-identical"
    folder=tmp/'comparison';folder.mkdir()
    for i in range(n):
        im=Image.new('RGB',(w*len(d['variants']),h+48),bg)
        for col,v in enumerate(d['variants']):im.paste(tile(v,i),(col*w,0))
        im.save(folder/f'{i:03}.png')
    encode(folder,root/'comparison.mp4')
points=[0,.5,1.1,1.65,2.3,3.1,4.25,5.125]
tw,th=260,250
im=Image.new('RGB',(110+tw*len(points),38+th*len(d['variants'])),bg);draw=ImageDraw.Draw(im)
for col,t in enumerate(points):draw.text((110+col*tw+10,19),f'{t:.2f}秒',font=small,fill=fg,anchor='lm')
for row,v in enumerate(d['variants']):
    draw.text((10,38+row*th+th//2),v['label'],font=small,fill=fg,anchor='lm')
    for col,t in enumerate(points):
        fr=Image.open(root/'frames'/v['id']/f'{round(t*fps):03}.png').convert('RGBA').resize((tw,th),Image.Resampling.LANCZOS)
        im.paste(fr,(110+col*tw,38+row*th),fr)
im.save(root/'contact-sheet.png')
