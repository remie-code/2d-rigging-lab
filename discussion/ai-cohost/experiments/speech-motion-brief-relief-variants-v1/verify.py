from pathlib import Path
import json,subprocess,hashlib
source=Path(__file__).resolve().parent
root=source.parents[3]/'tmp/speech-motion/brief-relief-variants-v1-reproduction'
d=json.loads((source/'definition.json').read_text(encoding='utf-8'))
report={}
for name in [v['id'] for v in d['variants']]+['comparison']:
    path=root/f'{name}.mp4'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(path),'-f','null','-'],check=True)
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_type,width,height,nb_read_frames,r_frame_rate,duration','-of','json',str(path)]))
    streams=data['streams'];assert len(streams)==1 and streams[0]['codec_type']=='video'
    assert streams[0]['nb_read_frames']=='125' and streams[0]['r_frame_rate']=='24/1'
    assert streams[0]['height']==548
    assert streams[0]['width']==(1560 if name=='comparison' else 520)
    report[name]={**streams[0],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'allFramesDecoded':True}
approved=json.loads((source/'approved-partner-reference.json').read_text(encoding='utf-8'))
assert report['partner']['sha256']==approved['mp4Sha256']
report['approvedPartnerByteIdentical']=True
(root/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
