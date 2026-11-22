"""Render the three screen-facing head tilts from the same neutral pose at native speed."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
root = here.parents[3]
out = root / "tmp/speech-motion" / here.name
clips = json.loads((here / "clips.json").read_bytes())
labels = [
    ("unexpected", "予想が外れて「あれ？」", "今の一振り、出なかったね"),
    ("ponder", "言葉が引っかかって考える", "ミツドキはいつ知ったんだろう"),
    ("echo", "相手につられて小首をかしげる", "そりゃ、何しに来たんだっけってなるよ"),
]
fps = 20
tile = 464


def render(key):
    folder = out / key
    folder.mkdir(parents=True, exist_ok=True)
    clip = clips[key]
    count = (clip["durationMs"] + 450) * fps // 1000 + 1
    for name, value in [("mouth", [0] * count), ("clips", {"frames": clip}), ("speech-end", clip["durationMs"])]:
        (folder / (name + ".json")).write_text(json.dumps(value), encoding="utf8")
    subprocess.run(["node", "--experimental-transform-types", "--no-warnings", "--import",
                    "./apps/authoring-host/register-workspace-source-resolver.mjs",
                    here.parent / "game-curiosity-astra-62/render.mjs", folder], cwd=root, check=True)
    return key, count


def compare(counts):
    layout = Image.new("RGB", (tile * 3, tile + 76), "#f6f3f0")
    draw = ImageDraw.Draw(layout)
    title = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 23)
    subtitle = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 16)
    for index, (_, label, line) in enumerate(labels):
        x = (index + 0.5) * tile
        draw.text((x, 24), label, anchor="mm", font=title, fill="#262233")
        draw.text((x, 55), line, anchor="mm", font=subtitle, fill="#655e72")
    args = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s",
            f"{layout.width}x{layout.height}", "-r", str(fps), "-i", "-", "-c:v", "libx264",
            "-threads", "4", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", out / "comparison.mp4"]
    with subprocess.Popen(args, stdin=subprocess.PIPE) as encoder:
        for i in range(max(counts.values())):
            panel = layout.copy()
            for j, (key, _, _) in enumerate(labels):
                frame = min(i, counts[key] - 1)
                with Image.open(out / key / "frames" / f"{frame:03}.png") as image:
                    crop = image.convert("RGBA").crop((62, 12, 562, 512)).resize((tile, tile), Image.Resampling.LANCZOS)
                panel.paste(crop, (j * tile, 76), crop)
            encoder.stdin.write(panel.tobytes())
        encoder.stdin.close()
        if encoder.wait():
            raise RuntimeError("Head tilt video encoding failed")


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=3) as pool:
        counts = dict(pool.map(render, clips))
    compare(counts)
