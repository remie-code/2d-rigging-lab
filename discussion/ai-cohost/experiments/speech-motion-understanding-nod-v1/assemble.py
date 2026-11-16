from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json
root=Path(__file__).resolve().parents[4];p=root/'tmp/speech-motion/understanding-nod-v1';out=p
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20);(p/'presentation').mkdir(exist_ok=True)
for file in sorted((p/'frames').glob('*.png')):
 im=Image.open(file).convert('RGBA');c=Image.new('RGB',(1000,720),'#dedbe5');d=ImageDraw.Draw(c);d.text((18,12),'Understanding / one soft nod / silent motion study',font=font,fill='black');c.paste(im,(30,48),im);small=im.resize((212,224),Image.Resampling.LANCZOS);c.paste(small,(745,275),small);d.text((718,238),'Small display example',font=font,fill='black');c.save(p/'presentation'/file.name)
subprocess.run(['ffmpeg','-y','-framerate','20','-i',str(p/'presentation/%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'understanding-nod.mp4')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['ffmpeg','-v','error','-i',str(out/'understanding-nod.mp4'),'-f','null','-'],check=True)
frames=[0,16,22,27,31,35,37,42,48,54,66,84];c=Image.new('RGB',(1250,600),'#dedbe5');d=ImageDraw.Draw(c)
for i,n in enumerate(frames):
 im=Image.open(p/'frames'/f'{n:03}.png').convert('RGBA');im.thumbnail((208,260));x=i%6*208;y=i//6*300;d.text((x+6,y+5),str(round(n/20,2))+'s',font=font,fill='black');c.paste(im,(x,y+30),im)
c.save(out/'contact-sheet.png')
print('assembled and decoded')
