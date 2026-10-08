# LT用画像の生成記録

## development-duration-burst.png

2026-10-04。ユーザーが本編C用の画像案作成を依頼。built-in `image_gen.imagegen`、`transparent_background: false`。参照・編集対象は `../01-overview-preview.png`。開発期間部分を拡大した見た目に集中線を追加した生成画像であり、ピクセルを保持した単純なスクリーンショット切り抜きではない。画像内の表記「開発期間：約2週間」を目視確認。画像案の段階で、スライドには未配置。

```text
Use case: compositing.
Asset type: a single image insert for the closing slide of a Japanese lightning talk, NOT a complete slide.
Input image 1 is the edit target: the existing presentation screenshot. Extract and enlarge ONLY the one-line text near the top left that reads exactly 「開発期間：約2週間」. Preserve the source's sober Japanese sans-serif typography: 「開発期間：」 in muted blue-gray regular weight, 「約2週間」 in bold blue. Keep this as a single horizontally centered line, large and clearly readable, with its original relative font sizes and weight distinction. It should look like an enlarged crop of that actual screenshot, with flat white background, no card border or shadow.
Add dramatic black manga concentration lines (集中線) radiating inward from ALL four edges toward this text, emphasizing the surprising short development time. Many crisp tapered black strokes with varied lengths and thicknesses, fairly balanced distribution, intense but clean. Keep a generous clear white area around the entire line so no strokes overlap the text. The text occupies about 60% of the canvas width. Wide landscape canvas, approximately 16:9. This is a humorous visual punchline using formal screenshot typography and energetic manga speed lines.
Remove all other content from the reference: no slide title, underline, introductory sentence, system diagram, icons, or other labels. Do not add new text, punctuation, exclamations, characters, illustrations, decorative effects, textures, gradients, or watermark. White background. Exact text only: 開発期間：約2週間
```

2026-10-04、ユーザーの指示でOBSとYouTubeの識別アイコンを生成。built-in `image_gen.imagegen` 使用、`transparent_background: true`、各1点、新規生成。加工せずPNGを保存し、SVGのimage要素でサイズ・位置を指定。ロゴの公式配布原本ではない。

YouTubeは初稿に色むらがあったため同ツールで1回編集し、youtube-generated-v2.pngを採用。

## youtube-generated-v2.png（初稿を編集）

```text
Clean up this YouTube icon for a small presentation diagram. Preserve the same red rounded horizontal rectangle and central white right-pointing triangle and their placement on square transparent canvas. Replace the entire red area with perfectly uniform solid #FF0000, and white triangle with perfectly uniform #FFFFFF. Remove ALL speckles, dark marks, uneven opacity, texture, lighting, gradients, and shadows. Smooth crisp silhouette with antialiasing at boundary only. Inside the rounded rectangle, all red pixels fully opaque; triangle fully opaque white. Outside rectangle completely transparent, no stray pixels. Flat two-color icon, no text or additions.
```

## obs-generated.png

```text
Generate a single isolated OBS Studio application icon for use at small size in a clean presentation diagram. Square canvas. Recognizable OBS Studio mark: a dark charcoal circular disk containing its three white curved interlocking swirl/comma shapes in threefold rotational symmetry. Flat graphic, crisp smoothly antialiased edges, no outline decoration, no gradients, no shadows, no 3D. The circular mark occupies 88% of canvas width, perfectly centered horizontally and vertically with equal margins. True transparent background outside the circular mark, not a checkerboard. No words, letters, caption, extra objects, frame or UI. This is a recognizable software identifier, not a redesign. High contrast black/dark charcoal and white only.
```

## youtube-generated.png

```text
Generate a single isolated YouTube play-button icon for use at small size in a clean presentation diagram. Square canvas. Recognizable YouTube mark: solid vivid red horizontal rounded rectangle with a centered white right-pointing play triangle, optically centered. Flat crisp graphic with clean antialiased edges. Button occupies 88% of canvas width and approximately 60% of canvas height. Perfectly centered horizontally and vertically with equal opposite margins. True transparent background outside the button, not a checkerboard or black background. No words, lettering, shadows, gradient, 3D, frame, UI, extra objects or decoration. Familiar standard red play-button silhouette, not a redesign.
```
