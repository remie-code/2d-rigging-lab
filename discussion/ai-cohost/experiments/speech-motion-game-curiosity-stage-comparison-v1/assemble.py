from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json
src=Path(__file__).resolve().parent;root=src.parents[3];out=root/'tmp/speech-motion/game-curiosity-stage-comparison-v1'
variants=json.loads((src/'variants.json').read_text(encoding='utf-8'));font=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',25);smallfont=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',16)
(out/'comparison').mkdir(exist_ok=True)
for v in variants:(out/v['id']/'presentation').mkdir(exist_ok=True)
for n in range(129):
 full=Image.new('RGB',(1280,960),'#dedbe5')
 for j,v in enumerate(variants):
  im=Image.open(out/v['id']/'frames'/f'{n:03}.png').convert('RGBA');panel=Image.new('RGB',(640,480),'#dedbe5');d=ImageDraw.Draw(panel);d.text((16,8),v['id']+'  '+v['label'],font=font,fill='black')
  main=im.resize((393,416),Image.Resampling.LANCZOS);panel.paste(main,(0,55),main);tiny=im.resize((175,185),Image.Resampling.LANCZOS);panel.paste(tiny,(445,225),tiny);d.text((440,194),'配信サイズ例',font=smallfont,fill='black');d.text((440,430),f'{n/20:.2f}s',font=smallfont,fill='black')
  panel.save(out/v['id']/'presentation'/f'{n:03}.png');full.paste(panel,((j%2)*640,(j//2)*480))
 full.save(out/'comparison'/f'{n:03}.png')
 if n==60:full.save(out/'comparison-sheet.png')
for name,frames in [('comparison',out/'comparison')]+[(v['id'],out/v['id']/'presentation')for v in variants]:
 dest=out/(name+'.mp4');subprocess.run(['ffmpeg','-y','-framerate','20','-i',str(frames/'%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);subprocess.run(['ffmpeg','-v','error','-i',str(dest),'-f','null','-'],check=True)
print('5 videos assembled and decoded')
