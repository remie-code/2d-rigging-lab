"""Generate the same Japanese guide voice and lip input for both performances."""
import json
import math
import subprocess
import sys
import wave
from array import array
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

source = Path(__file__).resolve().parent
root = source.parents[3]
study_file = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else source / "curiosity.json"
study = json.loads(study_file.read_text(encoding="utf8"))
out = root / "tmp/speech-motion" / study["output"]
lines_file = study_file.parent / study["lines"]
lines = lines_file.read_text(encoding="utf8").splitlines()
out.mkdir(parents=True, exist_ok=True)
subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "RemoteSigned", "-File",
                source / "preview-voice.ps1", "-OutputDirectory", out, "-LinesFile", lines_file], check=True)
rate, fps = 16000, 20
sound = array("h", [0] * round(rate * 0.18))
starts = []
for i in range(len(lines)):
    starts.append(len(sound) / rate)
    data = subprocess.check_output(["ffmpeg", "-v", "error", "-i", out / f"line-{i}.wav",
                                    "-ar", str(rate), "-ac", "1", "-f", "s16le", "-"])
    sound.frombytes(data)
    sound.extend([0] * round(rate * 0.13))
original = json.loads(subprocess.check_output(["git", "show", "4caa13b8:apps/runtime-player/assets/speech-motions/" + study["baseline"]], cwd=root))
remake = json.loads((study_file.parent / "performance.json").read_text(encoding="utf8"))
clips = {"original": original["clips"][study["original"]], "remake": remake["clips"][study["remake"]]}
(out / "clips.json").write_text(json.dumps(clips), encoding="utf8")
duration = max(clip["durationMs"] for clip in clips.values())
speech_end = round(1000 * len(sound) / rate) - 130
(out / "speech-end.json").write_text(json.dumps(speech_end), encoding="utf8")
for clip in clips.values():
    ends_in_pose = any(points[-1][1] != clip.get("defaults", {}).get(name, 0)
                       for name, points in clip.get("tracks", {}).items())
    if ends_in_pose or clip.get("hold") or clip["entry"] == "lead-in":
        end = clip["durationMs"] + (180 if clip["entry"] == "lead-in" else 0)
        hold = clip.get("hold", {})
        if hold.get("untilSpeechEnd"):
            end = max(end, speech_end)
        duration = max(duration, end + hold.get("ms", 0) + 400)
count = max(math.ceil(len(sound) * fps / rate), math.ceil(duration * fps / 1000) + 1)
sound.extend([0] * (count * rate // fps - len(sound)))
with wave.open(str(out / "voice.wav"), "wb") as wav:
    wav.setparams((1, 2, rate, 0, "NONE", ""))
    wav.writeframes(sound.tobytes())
mouth = []
for n in range(count):
    window = sound[n * rate // fps:(n + 1) * rate // fps]
    rms = math.sqrt(sum(x*x for x in window) / len(window))
    mouth.append(round(min(0.85, max(0, (rms - 100) / 3600)) ** 0.8, 4))
(out / "mouth.json").write_text(json.dumps(mouth), encoding="utf8")
subprocess.run(["node", "--experimental-transform-types", "--no-warnings",
                "--import", "./apps/authoring-host/register-workspace-source-resolver.mjs",
                source / "render.mjs", out], cwd=root, check=True)

font = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 26)
video = out / "comparison.mp4"
command = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", "1248x760", "-r", str(fps), "-i", "-", "-i", str(out / "voice.wav"),
           "-c:v", "libx264", "-threads", "2", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac",
           "-movflags", "+faststart", str(video)]
with subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
    for n in range(count):
        panel = Image.new("RGB", (1248, 760), "#e3e0e6")
        draw = ImageDraw.Draw(panel)
        for k, (folder, title) in enumerate([("original", "GPT-6 Astra"), ("remake", "GPT-6.2 Astra")]):
            with Image.open(out / folder / f"{n:03}.png") as frame:
                panel.paste(frame, (624*k, 48), frame.getchannel("A"))
            draw.text((624*k + 312, 25), title, font=font, fill="#252332", anchor="mm")
        draw.line((624, 8, 624, 708), fill="#c4bfcb")
        line_index = sum(n / fps >= onset for onset in starts[1:])
        draw.text((624, 733), lines[line_index], font=font, fill="#252332", anchor="mm")
        encoder.stdin.write(panel.tobytes())
    encoder.stdin.close()
    if encoder.wait():
        raise RuntimeError("Video encoding failed")
