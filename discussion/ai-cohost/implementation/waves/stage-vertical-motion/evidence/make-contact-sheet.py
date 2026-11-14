from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


evidence = Path(__file__).resolve().parent
sheet = Image.new("RGB", (1120, 666), "#1d2025")
draw = ImageDraw.Draw(sheet)
heading = ImageFont.truetype("segoeui.ttf", 18)
caption = ImageFont.truetype("segoeui.ttf", 15)

draw.text((14, 12), "r804 · Stage Presence Off", fill="#e6e8eb", font=heading)
samples = (
    ("baseline", "Manual position"),
    ("up", "Up 90 px"),
    ("down", "Down 65 px"),
    ("returned", "Returned"),
)
for column, (_, label) in enumerate(samples):
    draw.text((14 + column * 278, 40), label, fill="#c8ced8", font=caption)

for row, (output, title) in enumerate((
    ("native", "Native Stage · 600 × 720"),
    ("browser", "Browser Source · 850 × 900"),
)):
    top = 66 + row * 296
    draw.text((14, top), title, fill="#e6e8eb", font=caption)
    for column, (sample, _) in enumerate(samples):
        with Image.open(evidence / f"{output}-{sample}.png") as frame:
            frame.thumbnail((260, 264), Image.Resampling.LANCZOS)
            x = 14 + column * 278 + (260 - frame.width) // 2
            sheet.paste(frame, (x, top + 24))

sheet.save(evidence / "stage-y-contact-sheet.png", optimize=True)
