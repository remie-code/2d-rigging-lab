"""Compare the registered nods with the proposed partner take at their original speeds."""
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
root = here.parents[3]
out = root / "tmp/speech-motion/partner-understanding-nod-2026-11-22"
out.mkdir(parents=True, exist_ok=True)
assets = root / "apps/runtime-player/assets/speech-motions"


def registered(name, target):
    data = json.loads((assets / (name + ".json")).read_bytes())
    return data["clips"][data["targets"][target]]


studies = [
    ("receive", "相方への相づち", "登録済　／　受け取った", registered("receive", "partner")),
    ("game", "画面を見たまま納得", "登録済　／　そういうことか", registered("understanding-nod", "game")),
    ("partner", "相方を見て納得", "試作　／　よし、それでいこう", json.loads((here / "clip.json").read_bytes())),
]
fps = 20
end = max(clip["durationMs"] for _, _, _, clip in studies)
frames = (end + 450) * fps // 1000 + 1
for name, value in [("clips", {key: clip for key, _, _, clip in studies}),
                    ("mouth", [0] * frames), ("speech-end", end)]:
    (out / (name + ".json")).write_text(json.dumps(value), encoding="utf8")
subprocess.run(["node", "--experimental-transform-types", "--no-warnings", "--import",
                "./apps/authoring-host/register-workspace-source-resolver.mjs",
                here.parent / "game-curiosity-astra-62/render.mjs", out], cwd=root, check=True)

layout = Image.new("RGB", (1440, 558), "#f6f3f0")
draw = ImageDraw.Draw(layout)
title = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 25)
caption = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 16)
for j, (_, label, note, _) in enumerate(studies):
    x = j * 480 + 240
    draw.text((x, 18), note, anchor="mm", font=caption, fill="#655e72")
    draw.text((x, 48), label, anchor="mm", font=title, fill="#262233")
args = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", "1440x558", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-threads", "4",
        "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", out / "comparison.mp4"]
with subprocess.Popen(args, stdin=subprocess.PIPE) as enc:
    for i in range(frames):
        canvas = layout.copy()
        for j, (key, _, _, _) in enumerate(studies):
            with Image.open(out / key / f"{i:03}.png") as im:
                tile = im.convert("RGBA").crop((62, 12, 562, 512)).resize((480, 480), Image.Resampling.LANCZOS)
            canvas.paste(tile, (480*j, 78), tile)
        enc.stdin.write(canvas.tobytes())
    enc.stdin.close()
    if enc.wait():
        raise RuntimeError("Comparison encoding failed")
