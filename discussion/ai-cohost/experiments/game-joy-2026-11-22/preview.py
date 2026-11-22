"""Compare three screen-facing joy studies against their registered neighbors."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
root = here.parents[3]
out = root / "tmp/speech-motion/game-joy-2026-11-22"
prior = root / "tmp/speech-motion/game-smiles-2026-11-22"
fps = 20


def read(path):
    return json.loads(path.read_bytes())


new = read(here / "clips.json")
library = read(root / "apps/runtime-player/assets/speech-motions/smile-nuances.json")
labels = {
    "hit": "一手が決まった", "opening": "好機が見えた", "victory": "決着がついた",
    "echo": "笑顔がうつる", "fond": "ふっとほころぶ", "joy": "嬉しさが弾む",
}
clips = dict(new)
for key, nuance, target in [("echo", "echo", "game"), ("fond", "soft", "game"), ("joy", "joy", "partner")]:
    clip_id = library["nuances"][nuance]["targets"][target]
    clips[key] = library["clips"][clip_id]


def render(key):
    clip = clips[key]
    count = (clip["durationMs"] + 450) * fps // 1000 + 1
    folder = out / key
    inputs = {"clips": {"frames": clip}, "mouth": [0] * count, "speech-end": clip["durationMs"]}
    # Previous comparisons use the same renderer, model, viewport and fps.
    for cache in [prior / key, folder]:
        if (all((cache / (name + ".json")).is_file() and read(cache / (name + ".json")) == value
                for name, value in inputs.items()) and
                all((cache / "frames" / f"{i:03}.png").is_file() for i in range(count))):
            return key, (cache / "frames", count)
    folder.mkdir(parents=True, exist_ok=True)
    for name, value in inputs.items():
        (folder / (name + ".json")).write_text(json.dumps(value), encoding="utf8")
    subprocess.run(["node", "--experimental-transform-types", "--no-warnings", "--import",
                    "./apps/authoring-host/register-workspace-source-resolver.mjs",
                    here.parent / "game-curiosity-astra-62/render.mjs", folder], cwd=root, check=True)
    return key, (folder / "frames", count)


def encode(keys, frames, tile, output):
    height = tile + 64
    size = (tile * 3, height * (len(keys) // 3))
    layout = Image.new("RGB", size, "#f6f3f0")
    draw = ImageDraw.Draw(layout)
    title = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 25)
    caption = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 16)
    for j, key in enumerate(keys):
        x, y = (j % 3 + 0.5) * tile, j // 3 * height
        group = "試作  ·  ゲーム画面" if key in new else "登録済  ·  " + ("相方" if key == "joy" else "ゲーム画面")
        draw.text((x, y+15), group, anchor="mm", font=caption, fill="#655e72")
        draw.text((x, y+43), labels[key], anchor="mm", font=title, fill="#262233")
    args = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-s", f"{size[0]}x{size[1]}", "-r", str(fps), "-i", "-", "-c:v", "libx264",
            "-threads", "4", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", out / output]
    with subprocess.Popen(args, stdin=subprocess.PIPE) as enc:
        for i in range(max(frames[key][1] for key in keys)):
            canvas = layout.copy()
            for j, key in enumerate(keys):
                directory, count = frames[key]
                with Image.open(directory / f"{min(i, count-1):03}.png") as image:
                    face = image.convert("RGBA").crop((62, 12, 562, 512)).resize((tile, tile), Image.Resampling.LANCZOS)
                canvas.paste(face, (j % 3 * tile, j // 3 * height + 64), face)
            enc.stdin.write(canvas.tobytes())
        enc.stdin.close()
        if enc.wait():
            raise RuntimeError(output)


if __name__ == "__main__":
    out.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        frames = dict(pool.map(render, clips))
    encode(list(new), frames, 480, "three-game-joy.mp4")
    encode(list(labels), frames, 400, "with-registered-smiles.mp4")
