"""Package the five approved previews for UnaSlides. Requires FFmpeg and ReportLab."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

from PIL import Image
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'export'
SLIDES = [
    '00-cover-preview.png',
    '01-overview-preview.png',
    '02-modeling-tools-preview.png',
    '03-streaming-tools-preview.png',
    '04-development-duration-preview.png',
]


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def main():
    OUT.mkdir(exist_ok=True)
    ffmpeg = shutil.which('ffmpeg')
    ffprobe = shutil.which('ffprobe')
    if not ffmpeg or not ffprobe:
        raise RuntimeError('ffmpeg and ffprobe must be on PATH')
    sources = []
    for name in SLIDES:
        path = ROOT / name
        with Image.open(path) as im:
            assert im.size == (1600, 900), (name, im.size)
        sources.append({'file': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

    pdf = OUT / 'agent-friendly-2d-lt.pdf'
    doc = canvas.Canvas(str(pdf), pagesize=(1200, 675), pageCompression=1)
    doc.setTitle('エージェントフレンドリーな2Dモデリングシステム')
    for name in SLIDES:
        doc.drawImage(str(ROOT / name), 0, 0, width=1200, height=675)
        doc.showPage()
    doc.save()

    video = OUT / 'agent-friendly-2d-lt-unaslides.mp4'
    temp = ROOT.parents[2] / 'tmp' / 'lt-preview' / 'unaslides-frames'
    temp.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(SLIDES):
        shutil.copyfile(ROOT / name, temp / f'slide-{i:02d}.png')
    run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
         '-framerate', '1', '-start_number', '0', '-i', str(temp / 'slide-%02d.png'),
         '-vf', 'scale=1920:1080:flags=lanczos,fps=30', '-frames:v', '150',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
         '-profile:v', 'baseline', '-level:v', '4.0', '-pix_fmt', 'yuv420p',
         '-bf', '0', '-g', '30', '-keyint_min', '30', '-sc_threshold', '0',
         '-an', '-movflags', '+faststart', str(video)])

    info = json.loads(run([ffprobe, '-v', 'error', '-show_streams', '-show_format',
                           '-of', 'json', str(video)]))
    stream = info['streams'][0]
    assert stream['codec_name'] == 'h264'
    assert stream['has_b_frames'] == 0
    assert stream['width'] == 1920 and stream['height'] == 1080
    assert stream['nb_frames'] == '150' and stream['avg_frame_rate'] == '30/1'
    assert float(info['format']['duration']) == 5.0
    frames = json.loads(run([ffprobe, '-v', 'error', '-select_streams', 'v:0',
                             '-show_frames', '-show_entries', 'frame=key_frame,pts_time,pict_type',
                             '-of', 'json', str(video)]))['frames']
    keys = [float(f['pts_time']) for f in frames if f['key_frame']]
    assert keys == [0, 1, 2, 3, 4], keys
    assert all(f['pict_type'] != 'B' for f in frames)
    manifest = {'source_previews': sources, 'video': video.name, 'pdf': pdf.name,
                'duration_seconds': 5, 'slide_count': 5, 'seconds_per_slide': 1,
                'recommended_offset_seconds': 0.5, 'keyframe_seconds': keys,
                'video_stream': stream, 'venue_tested': False, 'uploaded': False}
    (OUT / 'export-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'mp4_bytes': video.stat().st_size, 'pdf_bytes': pdf.stat().st_size,
                      'frames': 150, 'duration': 5, 'keyframes': keys}))


if __name__ == '__main__':
    main()
