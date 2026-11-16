from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, subprocess

root = Path(__file__).resolve().parents[4]
source = Path(__file__).resolve().parent
out = root/'tmp/speech-motion/nod-comparison-v1'
right = root/'tmp/speech-motion/understanding-nod-v1'
left = out/'left'
presentation = out/'presentation'
presentation.mkdir(exist_ok=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
rprov = json.loads((right/'provenance.json').read_text())
assert sha(source.parent/'speech-motion-understanding-nod-v1/performance.json') == rprov['performanceSha256']
assert json.loads((right/'definition.json').read_text())['view'] == json.loads((left/'definition.json').read_text())['view']
font = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 27)
small = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 19)
rf = json.loads((right/'evidence.json').read_text())['frames']
lf = json.loads((left/'evidence.json').read_text())['frames']
assert len(lf) == len(rf) == 85
for a,b in zip(lf,rf):
    assert a['timeMs'] == b['timeMs']
    assert a['stageScale'] == b['stageScale'] == 1
    assert a['stageRenderedPanYPx'] == b['stageRenderedPanYPx'] == 0
    assert sha(right/'frames'/b['file']) == b['pngSha256']
    canvas = Image.new('RGB', (1308, 780), '#dedbe5')
    draw = ImageDraw.Draw(canvas)
    draw.text((30,12), '受け取る（既存）',font=font,fill='black')
    draw.text((678,12), '腑に落ちる（試作）',font=font,fill='black')
    for x,p in [(18,left),(666,right)]:
        im=Image.open(p/'frames'/a['file']).convert('RGBA')
        assert im.size == (624,660)
        canvas.paste(im,(x,58),im)
    draw.line((654,12,654,719),fill='#a6a2b2',width=1)
    draw.text((25,730), '定義の動きを同じモデルで比較・音声なし（接続用lead-inは除外）',font=small,fill='#44404c')
    draw.text((1130,730),f"{a['timeMs']/1000:.2f} 秒",font=small,fill='#44404c')
    canvas.save(presentation/a['file'])
video=out/'nod-comparison.mp4'
subprocess.run(['ffmpeg','-y','-framerate','20','-i',str(presentation/'%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(video)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
Image.open(presentation/'008.png').save(out/'sample.png')
sheet=Image.new('RGB',(1308,1170),'#dedbe5')
for i,n in enumerate([0,8,21,29,35,54]):
    im=Image.open(presentation/f'{n:03d}.png').resize((654,390),Image.Resampling.LANCZOS)
    sheet.paste(im,((i%2)*654,(i//2)*390))
sheet.save(out/'contact-sheet.png')
lprov=json.loads((left/'provenance.json').read_text())
assert all(lprov[k] for k in ['sourceUnchanged','liveSourceUnchanged','liveExportUnchanged'])
assert lf[0]['pngSha256']==lf[-1]['pngSha256']==rf[0]['pngSha256']==rf[-1]['pngSha256']
verification={'framesPerSide':85,'fps':20,'reusedRightFramesAllHashesMatch':True,'matchingViewportAndOutputSize':True,'startEndNeutralIdenticalAcrossBothSides':True,'snapshotUnchanged':True,'liveSourceUnchanged':True,'liveExportUnchanged':True,'finiteGeometry':'checked by renderer','videoFullDecodePassed':True,'videoSha256':sha(video)}
(source/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
print('assembled, decoded, hashes and neutral match')
