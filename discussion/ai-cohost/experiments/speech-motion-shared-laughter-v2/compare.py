from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess

p = Path(__file__).resolve().parent
old = p.parents[3] / 'tmp/speech-motion/shared-laughter-v1'
bg = (25, 30, 42)
font = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 22)
dest = p / 'comparison-frames'
dest.mkdir(exist_ok=True)
for i in range(125):
    sheet = Image.new('RGB', (960, 560), bg)
    draw = ImageDraw.Draw(sheet)
    for j, folder in enumerate([old, p]):
        frame = Image.open(folder / 'frames' / f'{i:03d}.png').convert('RGBA')
        face = frame.crop((120, 30, 474, 402)).resize((460, 484), Image.Resampling.LANCZOS)
        sheet.paste(face, (j * 480 + 10, 65), face)
        draw.text((j * 480 + 15, 16), ['v1：視線を上へ', 'v2：瞳を制作時の位置に固定'][j], font=font, fill='white')
    sheet.save(dest / f'{i:03d}.png')
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '20', '-i', str(dest / '%03d.png'), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(p / 'gaze-comparison.mp4')], check=True)
sheet = Image.new('RGB', (960, 560 * 3), bg)
for row, i in enumerate([12, 16, 20]):
    shot = Image.open(dest / f'{i:03d}.png')
    ImageDraw.Draw(shot).text((445, 45), f'{i/20:.1f}s', font=font, fill='white')
    sheet.paste(shot, (0, row * 560))
sheet.save(p / 'closing-comparison.png')
