# 閉じ切った「にっこり笑顔」の参照

2026-11-12。v3をユーザーが「にっこりより穏やかに何かしている印象」と評価。半眼の笑顔を共有する難しさを減らすため、両目を閉じ切った笑顔を画像で合わせる方針へ変更した。今回は参照作成のみであり、モデルへの適用や本人採用ではない。

- 出力: [laugh-closed-eyes-v1.png](laugh-closed-eyes-v1.png)
- 入力/編集対象: [laugh-relaxed-v2.png](laugh-relaxed-v2.png)
- 手段: 内蔵 `image_gen.imagegen`、transparent_background=true。CLI不使用。
- 生成原本: `C:/Users/remie/.codex/generated_images/01a1b0eb-244e-7dd0-b437-dd3ff57fcf07/exec-bc10a334-199e-4748-913c-6f35e6828961.png`。原本を残しworkspaceへコピー。
- root目視: 両目が閉じ、左右のまつ毛が柔らかな上向きの弧を作る。開いた笑い口を維持した参照案。本人の印象確認待ち。

## v1 使用prompt

```text
Use case: identity-preserve.
Asset type: expression reference illustration for this exact Live2D character.
Edit the supplied image, preserving the same character, drawing style, head pose, framing, hair silhouette, hair ornament attachment, clothing, lighting, and existing open smiling mouth.
Change the eye expression to a clear warm, cheerful, fully closed-eye smile: にっこり笑って両目を完全に閉じている。Both eyes are completely shut, with no visible irises, pupils or sclera. The closed lash lines make soft upward-arching smiling curves, gently lifted by the cheeks; natural beautifully continuous curved contours, not sharp angular symbols. It should read as enjoying a shared joke, unmistakably smiling with her eyes, rather than sleeping, looking downward, or merely calm. Relaxed happy brows and subtle raised cheeks support the eye smile, without tense squeezing, painful scrunching, or exaggerated wrinkles.
Keep the original mouth shape and smile, face proportions, nose, jaw, and recognizable identity. Preserve original composition and all non-facial details. One character, one expression, no text, no labels, no comparison panels. Preserve a truly transparent background and clean alpha edges.
```
## v2 — 通常の口に近い控えめな閉口

ユーザーは大きな笑い口が通常の口パクと印象を違わせるため、目元を保ったまま口を落ち着かせ、実際に変形するモデルに近い印象で参照を見たいと指示した。

- 出力: [laugh-closed-eyes-quiet-mouth-v2.png](laugh-closed-eyes-quiet-mouth-v2.png)
- 編集対象: 閉眼参照v1。補助参照: `C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-expression-v3/v3-face-closed.png`（モデルの通常閉口だけを参考）。
- 内蔵imagegen、透明背景。生成原本 `C:/Users/remie/.codex/generated_images/01a1b0eb-244e-7dd0-b437-dd3ff57fcf07/exec-0b416a22-c0b5-484a-994b-dbd1ec795cf2.png` を残してworkspaceへコピー。
- root目視: 閉じた目の笑う弧を保つ方向で、口が小さなほぼ水平の線になった。本人の印象確認待ち。モデルは変更していない。

### v2 使用prompt

```text
Use case: identity-preserve.
Edit target: Image 1, the closed-eye smiling character illustration. Image 2 is supporting reference ONLY for the existing model's small, understated closed mouth.
Change ONLY the mouth in Image 1. Replace the broad open laughing mouth with a small, closed, quiet mouth closely resembling the resting mouth in Image 2: a thin delicate nearly horizontal lip line, relaxed, with at most a very slight gentle curve. No visible teeth, tongue or open mouth cavity, no wide grin, no prominently lifted corners, no elaborate new smiling lip shape. The purpose is to judge a smiling-eye expression that will be used with the model's normal unmodified lip-sync mouth, so do not rely on a specially expressive smiling mouth to sell the expression.
Preserve Image 1's fully closed smiling eyes EXACTLY in their current shapes and positions, lash curves, brows, cheeks, blush, nose, face shape, head pose, hairstyle, accessories, clothing, composition, rendering style and colors. Do not copy the open eyes or framing of Image 2. Keep Image 1 as the image being edited, including its entire bust framing. One portrait only, no labels or text, no comparison panels. Preserve a genuinely transparent background.
```
