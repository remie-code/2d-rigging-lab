from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,sys
p=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[4]/'tmp/speech-motion/shared-laughter-v2-reproduction';bg=(25,30,42);font=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',24);small=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',18)
e=json.loads((p/'evidence.json').read_text(encoding='utf-8'));dest=p/'video-frames';dest.mkdir(exist_ok=True)
for f in e['frames']:
 im=Image.new('RGB',(1120,740),bg);d=ImageDraw.Draw(im);frame=Image.open(p/'frames'/f['file']).convert('RGBA');im.paste(frame,(20,65),frame);little=frame.resize((220,233),Image.Resampling.LANCZOS);im.paste(little,(810,420),little);d.text((25,15),'一緒に笑う — 視聴者向け / 瞳固定 v2',font=font,fill='white');d.text((680,105),'無音・小さな仮口パク',font=small,fill=(200,210,225));d.text((680,140),'通常の瞬きは重ねていません',font=small,fill=(200,210,225));d.text((780,380),'配信内の小サイズ表示例',font=small,fill='white');d.text((680,690),'音声同期・製品実行ではありません',font=small,fill=(180,190,205));im.save(dest/f['file'])
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','20','-i',str(dest/'%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(p/'viewers.mp4')],check=True)
times=[0,.6,1.1,1.5,1.75,2.0,2.2,2.7,3.3,4.0,4.8,6.2];im=Image.new('RGB',(1400,1170),bg);d=ImageDraw.Draw(im)
for j,t in enumerate(times):
 f=e['frames'][round(t*20)];frame=Image.open(p/'frames'/f['file']).convert('RGBA');frame.thumbnail((350,355));x,y=(j%4)*350,(j//4)*390;im.paste(frame,(x,y+32),frame);d.text((x+12,y+5),f'{t:.2f} s',font=small,fill='white')
im.save(p/'contact-sheet.png')
