"""Render the five reviewed situations with one stage, model and guide voice."""
from array import array
from concurrent.futures import ThreadPoolExecutor
import json
import math
from pathlib import Path
import subprocess
import wave

from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
root = here.parents[3]
shared = here.parent / "game-curiosity-astra-62"
out = root / "tmp/speech-motion/surprise-nuances-astra-62"
studies = json.loads((here / "studies.json").read_bytes())
fps, rate = 20, 16000
background = "#e3e0e6"
font = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 23)


def prepare(study):
    folder = out / study["key"]
    folder.mkdir(parents=True, exist_ok=True)
    if "registered" in study:
        asset = json.loads(subprocess.check_output(["git", "show",
            "c575b3e4:apps/runtime-player/assets/speech-motions/startled-recoil.json"], cwd=root))
        clip = asset["clips"][study["registered"]]
    else:
        clip = study["clip"]
    lines = folder / "lines.txt"
    lines.write_text("\n".join(study["lines"]), encoding="utf8")
    subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "RemoteSigned", "-File",
                    shared / "preview-voice.ps1", "-OutputDirectory", folder, "-LinesFile", lines], check=True)
    pcm = array("h", [0] * round(.18 * rate))
    starts = []
    for n in range(len(study["lines"])):
        starts.append(len(pcm) / rate)
        pcm.frombytes(subprocess.check_output(["ffmpeg", "-v", "error", "-i", folder / f"line-{n}.wav",
                                               "-ar", str(rate), "-ac", "1", "-f", "s16le", "-"]))
        pcm.extend([0] * round(.13 * rate))
    end = round(1000 * len(pcm) / rate) - 130
    count = max(math.ceil(len(pcm) * fps / rate), math.ceil(clip["durationMs"] * fps / 1000)) + 1
    pcm.extend([0] * (count * rate // fps - len(pcm)))
    with wave.open(str(folder / "voice.wav"), "wb") as f:
        f.setparams((1, 2, rate, 0, "NONE", ""))
        f.writeframes(pcm.tobytes())
    mouth = []
    for i in range(count):
        samples = pcm[i*rate//fps:(i+1)*rate//fps]
        rms = math.sqrt(sum(v*v for v in samples) / len(samples))
        mouth.append(round(min(.85, max(0, (rms-100) / 3600)) ** .8, 4))
    for name, data in [("mouth", mouth), ("speech-end", end), ("clips", {"frames": clip})]:
        (folder / (name + ".json")).write_text(json.dumps(data), encoding="utf8")
    subprocess.run(["node", "--experimental-transform-types", "--no-warnings", "--import",
                    "./apps/authoring-host/register-workspace-source-resolver.mjs", shared / "render.mjs", folder],
                   cwd=root, check=True)
    return count, starts


def model_frame(key, index):
    with Image.open(out / key / "frames" / f"{index:03}.png") as im:
        return im.convert("RGBA")


def encode(path, size, frames, audio=None):
    args = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", size,
            "-r", str(fps), "-i", "-"]
    if audio:
        args.extend(["-i", str(audio), "-c:a", "aac"])
    args.extend(["-c:v", "libx264", "-threads", "3", "-pix_fmt", "yuv420p", "-crf", "18",
                 "-movflags", "+faststart", str(path)])
    with subprocess.Popen(args, stdin=subprocess.PIPE) as enc:
        for frame in frames:
            enc.stdin.write(frame.tobytes())
        enc.stdin.close()
        if enc.wait():
            raise RuntimeError(path)


def individual(study, count, starts):
    for i in range(count):
        panel = Image.new("RGB", (720, 768), background)
        model = model_frame(study["key"], i)
        panel.paste(model, (48, 46), model)
        draw = ImageDraw.Draw(panel)
        draw.text((360, 24), study["label"], font=font, fill="#252332", anchor="mm")
        line = study["lines"][sum(i / fps >= t for t in starts[1:])]
        draw.text((360, 735), line, font=font, fill="#252332", anchor="mm")
        yield panel


def grid(counts):
    positions = [(0, 0), (416, 0), (832, 0), (208, 480), (624, 480)]
    for i in range(max(counts)):
        panel = Image.new("RGB", (1248, 960), background)
        draw = ImageDraw.Draw(panel)
        for study, count, (x, y) in zip(studies, counts, positions):
            model = model_frame(study["key"], min(i, count - 1)).resize((416, 440), Image.Resampling.LANCZOS)
            panel.paste(model, (x, y+34), model)
            draw.text((x+208, y+18), study["label"], font=font, fill="#252332", anchor="mm")
        yield panel


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=4) as workers:
        timing = list(workers.map(prepare, studies))
    for study, (count, starts) in zip(studies, timing):
        key = study["key"]
        encode(out / (key+".mp4"), "720x768", individual(study, count, starts), out / key / "voice.wav")
    encode(out / "comparison.mp4", "1248x960", grid([count for count, _ in timing]))
    (out / "sequence.txt").write_text("".join("file '" + s["key"] + ".mp4'\n" for s in studies), encoding="utf8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", "sequence.txt",
                    "-c:v", "copy", "-af", "aresample=async=1:first_pts=0", "-c:a", "aac", "-movflags",
                    "+faststart", "with-voice.mp4"], cwd=out, check=True)
