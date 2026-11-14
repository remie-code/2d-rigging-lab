from pathlib import Path
import sys
from PIL import Image, ImageDraw

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[4] / 'tmp/speech-motion/received-v1-replay'
frames = []
for path in sorted((root / 'frames').glob('*.png')):
    src = Image.open(path).convert('RGBA')
    frame = Image.new('RGBA', src.size, (232, 232, 238, 255))
    frame.alpha_composite(src)
    frames.append(frame.convert('RGB'))
assert len(frames) == 65
# One shared palette avoids background and hair color flicker.
palette_source = Image.new('RGB', (650 * 5, 550))
for j, i in enumerate([0, 13, 18, 24, 34]):
    palette_source.paste(frames[i], (650 * j, 0))
palette = palette_source.quantize(colors=256)
gif_frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
gif_frames[0].save(root / 'received-v1.gif', save_all=True, append_images=gif_frames[1:], duration=50, loop=0, optimize=False, disposal=1)
sheet = Image.new('RGB', (325 * 4, 300 * 2), '#e8e8ee')
for j, i in enumerate([0, 10, 14, 18, 22, 27, 32, 38]):
    sheet.paste(frames[i].resize((325, 275)), ((j % 4) * 325, (j // 4) * 300))
    ImageDraw.Draw(sheet).text(((j % 4) * 325 + 12, (j // 4) * 300 + 279), f'{i / 20:.2f}s', fill='#33333b')
sheet.save(root / 'contact-sheet.png')
with Image.open(root / 'received-v1.gif') as gif:
    total = 0
    for i in range(gif.n_frames):
        gif.seek(i)
        total += gif.info['duration']
    print({'frames_after_gif_coalescing': gif.n_frames, 'duration_ms': total, 'size': gif.size})
