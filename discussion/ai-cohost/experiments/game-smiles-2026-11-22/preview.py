"""Render screen-facing smile studies and the current comparison clips at native speed."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
root = here.parents[3]
out = root / "tmp/speech-motion/game-smiles-2026-11-22"
assets = root / "apps/runtime-player/assets/speech-motions"
fps = 20


def read(path):
    return json.loads(path.read_bytes())


new = read(here / "clips.json")
smiles = read(assets / "smile-nuances.json")
shared = read(assets / "shared-laughter.json")
studies = [
    ("fond", "ふっとほころぶ", new["fond"]),
    ("echo", "笑顔がうつる", new["echo"]),
    ("moved", "じんときて微笑む", new["moved"]),
]
for key, label in [("soft", "柔らかく微笑む"), ("joy", "嬉しさが弾む"),
                   ("shy", "照れながら笑う"), ("proud", "少し得意げに笑う"),
                   ("relief", "息を抜いて微笑む")]:
    clip_id = smiles["nuances"][key]["targets"]["partner"]
    studies.append((key, label, smiles["clips"][clip_id]))
studies.append(("shared", "一緒に笑う", shared["clips"][shared["targets"]["game"]]))


def render(study):
    key, _, clip = study
    folder = out / key
    folder.mkdir(parents=True, exist_ok=True)
    frames = (clip["durationMs"] + 450) * fps // 1000 + 1
    for file, data in [("clips", {"frames": clip}), ("mouth", [0] * frames),
                       ("speech-end", clip["durationMs"])]:
        (folder / (file + ".json")).write_text(json.dumps(data), encoding="utf8")
    subprocess.run(["node", "--experimental-transform-types", "--no-warnings", "--import",
                    "./apps/authoring-host/register-workspace-source-resolver.mjs",
                    here.parent / "game-curiosity-astra-62/render.mjs", folder], cwd=root, check=True)
    return key, frames


def encode(name, items, width, image_height, cols, counts):
    rows = (len(items) + cols - 1) // cols
    tile_height = image_height + 58
    size = (cols * width, rows * tile_height)
    layout = Image.new("RGB", size, "#f6f3f0")
    draw = ImageDraw.Draw(layout)
    title = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 24)
    caption = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 15)
    for j, (key, label, _) in enumerate(items):
        x, y = (j % cols) * width, (j // cols) * tile_height
        section = "試作  ·  画面" if key in new else ("登録済  ·  画面" if key == "shared" else "登録済  ·  相方")
        draw.text((x + width/2, y+14), section, anchor="mm", font=caption, fill="#655e72")
        draw.text((x + width/2, y+40), label, anchor="mm", font=title, fill="#262233")
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{size[0]}x{size[1]}", "-r", str(fps), "-i", "-", "-c:v", "libx264",
           "-pix_fmt", "yuv420p", "-threads", "4", "-crf", "18", "-movflags", "+faststart",
           str(out / (name + ".mp4"))]
    with subprocess.Popen(cmd, stdin=subprocess.PIPE) as enc:
        for i in range(max(counts.values())):
            panel = layout.copy()
            for j, (key, _, _) in enumerate(items):
                file = out / key / "frames" / f"{min(i, counts[key]-1):03}.png"
                with Image.open(file) as image:
                    # Same crop for every pose. Retain the head, shoulders and their movement.
                    tile = image.convert("RGBA").crop((62, 12, 562, 512)).resize(
                        (image_height, image_height), Image.Resampling.LANCZOS)
                x = (j % cols) * width + (width-image_height)//2
                panel.paste(tile, (x, (j // cols) * tile_height + 58), tile)
            enc.stdin.write(panel.tobytes())
        enc.stdin.close()
        if enc.wait():
            raise RuntimeError(name)


if __name__ == "__main__":
    for key, _, _ in studies:
        (out / key).mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as workers:
        counts = dict(workers.map(render, studies))
    encode("three-game-smiles", studies[:3], 480, 480, 3, counts)
    encode("with-registered-smiles", studies, 388, 352, 3, counts)
