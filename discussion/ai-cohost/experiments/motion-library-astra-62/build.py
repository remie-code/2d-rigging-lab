"""Build the comparison library; each original target still resolves to its original clip ID."""
import argparse
import html
import json
import shutil
import subprocess
import sys
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

here = Path(__file__).resolve().parent
root = here.parents[3]
preview = here.parent / "game-curiosity-astra-62/preview.py"
temp = root / "tmp/speech-motion"
out = temp / "astra-62-library"
baseline = "4caa13b8"
asset_dir = "apps/runtime-player/assets/speech-motions"


def read(path):
    return json.loads(path.read_text(encoding="utf8"))


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf8")


def prepare():
    catalog = []
    for path in sorted((here / "takes").glob("*.json")):
        asset = json.loads(subprocess.check_output(["git", "show", f"{baseline}:{asset_dir}/{path.name}"], cwd=root))
        takes = read(path)
        if set(asset["clips"]) != set(takes):
            raise ValueError(f"Clip inventory differs: {path.name}")
        for key, take in takes.items():
            slug = path.stem + "--" + key
            work = out / "inputs" / slug
            work.mkdir(parents=True, exist_ok=True)
            if "previous" in take:
                config_file = here.parent / take["previous"]
                config = read(config_file)
                clip = read(config_file.parent / "performance.json")["clips"][config["remake"]]
                lines = (config_file.parent / config["lines"]).read_text(encoding="utf8").splitlines()
                folder = temp / config["output"]
            else:
                clip = take["clip"]
                lines = take["lines"]
                (work / "lines.txt").write_text("\n".join(lines) + "\n", encoding="utf8")
                config_file = work / "study.json"
                folder = out / slug
                write(config_file, {"lines": "lines.txt", "output": str(folder.relative_to(temp)),
                                    "baseline": path.name, "original": key, "remake": key})
                write(work / "performance.json", {"clips": {key: clip}})
            asset["clips"][key] = clip
            targets = [target for entry in asset.get("nuances", {"base": asset}).values()
                       for target, clip_id in entry["targets"].items() if clip_id == key]
            catalog.append(dict(name=take["name"], family=take["family"], targets=targets, lines=lines,
                                id=key, config=config_file, folder=folder, previous="previous" in take))
        write(out / "candidate-assets" / path.name, asset)
    expected = subprocess.check_output(["git", "ls-tree", "--name-only", f"{baseline}:{asset_dir}"], cwd=root, text=True).splitlines()
    if sorted(expected) != sorted(p.name for p in (here / "takes").glob("*.json")):
        raise ValueError("Asset inventory differs")
    return catalog


def render(item):
    if item["previous"] and (item["folder"] / "comparison.mp4").is_file():
        return
    subprocess.run([sys.executable, preview, item["config"]], cwd=root, check=True)
    print("Rendered", item["id"], flush=True)


def make_reel(items):
    concat = []
    chapters = [";FFMETADATA1"]
    captions = []
    start = 0
    def stamp(ms):
        seconds, hundredths = divmod(ms // 10, 100)
        return f"{seconds // 3600}:{seconds // 60 % 60:02}:{seconds % 60:02}.{hundredths:02}"
    for group, name, path in items:
        info = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0",
                                        "-show_entries", "stream=nb_frames", "-of", "csv=p=0", out / path])
        duration = int(info.strip()) * 50  # all previews are 20 fps
        end = start + duration
        concat.extend([f"file '{path}'", f"duration {duration / 1000:.3f}"])
        chapters.extend(["[CHAPTER]", "TIMEBASE=1/1000", f"START={start}", f"END={end}", f"title={group} / {name}"])
        captions.append(f"Dialogue: 0,{stamp(start)},{stamp(end)},Title,,0,0,0,,{name}")
        start = end
    (out / "sequence.txt").write_text("\n".join(concat) + "\n", encoding="utf8")
    (out / "chapters.txt").write_text("\n".join(chapters) + "\n", encoding="utf8")
    subtitle_header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1248
PlayResY: 760
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Meiryo,23,&H00473331,&H00473331,&H00E6E0E3,&H00E6E0E3,0,0,0,0,100,100,0,0,1,1,0,8,0,0,8,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    (out / "titles.ass").write_text(subtitle_header + "\n".join(captions), encoding="utf8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", "sequence.txt",
                    "-f", "ffmetadata", "-i", "chapters.txt", "-map", "0:v:0", "-map", "0:a:0",
                    "-map_chapters", "1", "-vf", "ass=titles.ass", "-af", "aresample=async=1:first_pts=0",
                    "-c:v", "libx264", "-threads", "4", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac",
                    "-movflags", "+faststart", "all-comparisons.mp4"], check=True, cwd=out)


def gallery(catalog):
    targets = {"partner": "相方", "viewers": "視聴者", "game": "画面"}
    groups = ["笑み", "一緒に笑う", "会話", "安堵", "探索・確認", "驚き", "苦笑"]
    sections = []
    reel_items = []
    for group in groups:
        cards = []
        for item in (entry for entry in catalog if entry["family"] == group):
            video = item["folder"] / "comparison.mp4"
            if not video.is_file():
                raise FileNotFoundError(video)
            local = "videos/" + item["folder"].name + ".mp4"
            reel_items.append((group, item["name"], local))
            dest = out / local
            dest.parent.mkdir(exist_ok=True)
            shutil.copyfile(video, dest)
            poster = local[:-4] + ".jpg"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.25", "-i", dest,
                            "-frames:v", "1", "-vf", "scale=624:-2", out / poster], check=True)
            target = "・".join(targets[t] for t in item["targets"])
            cards.append(f'<article><h3>{html.escape(item["name"])} <small>{target}</small></h3>'
                         f'<video controls playsinline preload="none" poster="{poster}" src="{local}"></video>'
                         f'<p>{html.escape(" ".join(item["lines"]))}</p></article>')
        sections.append(f'<section id="g{len(sections)}"><h2>{group}</h2><div>{"".join(cards)}</div></section>')
    nav = "　".join(f'<a href="#g{i}">{group}</a>' for i,group in enumerate(groups))
    page = f"""<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>チャッピーの演技比較</title><style>
body{{font:1rem/1.55 system-ui,sans-serif;background:#f6f4f4;color:#272033;max-width:1500px;margin:auto;padding:1rem 3vw}}
nav a{{color:#59476f}} section>div{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(520px,100%),1fr));gap:1.2rem}}
article{{background:white;padding:1rem;border-radius:.6rem}} h3,p{{margin:.3rem 0}} small{{font-weight:400;color:#625d69}}
video{{display:block;width:100%;aspect-ratio:1248/760;background:#e3e0e6}} </style>
<h1>チャッピーの演技比較</h1><p>左がGPT-6 Astraの登録版、右がGPT-6.2 Astraの試作。各ペアは同じ仮音声・口パクで再生。</p>
<nav>{nav}</nav>{"".join(sections)}<script>document.addEventListener('play',e=>{{
for(const v of document.querySelectorAll('video'))if(v!==e.target)v.pause();
}},true)</script></html>"""
    (out / "index.html").write_text(page, encoding="utf8")
    make_reel(reel_items)
    with zipfile.ZipFile(out / "comparison-library.zip", "w") as archive:
        archive.write(out / "index.html", "index.html")
        for file in sorted((out / "videos").iterdir()):
            archive.write(file, "videos/" + file.name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--jobs", type=int, default=4)
    parser.add_argument("--only", nargs="+")
    parser.add_argument("--gallery-only", action="store_true")
    args = parser.parse_args()
    catalog = prepare()
    if not args.gallery_only:
        selected = [e for e in catalog if not args.only or e["id"] in args.only]
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            list(pool.map(render, selected))
    if not args.only or args.gallery_only:
        gallery(catalog)
