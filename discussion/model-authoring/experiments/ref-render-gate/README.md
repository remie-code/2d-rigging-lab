# ref render gate (Wave104 Domain C → regenerated Wave105 Domain A)

This directory holds the **judgement-ladder top rung**: artifacts generated against the
delivered, rights-cleared `ref/` model that **you (the user) review visually to approve
rendering correctness** (plan §3.5, §11 "描画の正しさ（人間判定）"). This is the first
exercise of that gate. It sits outside the wave's technical gate (Domain D) — it is the
model-authoring side gate after the wave.

Everything here is produced by the ref e2e smoke
`apps/authoring-host/src/ref-e2e.test.ts`, which loads `ref/` **read-only** (the state
directory is always outside `ref/`; nothing is ever written into `ref/`) through the
same CLI entry point (`runAuthoringHostCommand`) that the perception / read command
surface uses in production.

## Wave105: these PNGs are now the **Default outfit** (Variant gate applied)

The Wave104 version of these PNGs was rendered **without the Variant visibility
gate**, so all three of `ref/`'s outfits (the "Ware" Variant Group: Default / Rodos /
Endoministorator) drew on top of each other — about **9 extra outfit drawables** were
painted that the model, in its Default configuration, does not show. **That caveat is
now resolved.**

Wave105 Domain A composes `base visible AND variantVisibilityPredicate(activeSelections)`
at the snapshot level, so render, measurement and framing share one visibility world.
With no `variantSelections` in the request, the gate resolves to the package
`defaultActive` = the **Default** outfit. The `ref/model/variants.json` "Ware" group
(`singleSelect`, 15 target drawables) therefore passes exactly **6** drawables and
blocks the other **9** (5 Rodos + 4 Endoministorator; the shared `bottomwear` is a
Default member so it stays). The e2e derives that 6/9 partition from the package
memberships and asserts the evaluated snapshot matches — see the
`gates the Ware group to the Default outfit ... (6 pass / 9 blocked ...)` test.

Concretely, the `ref-rest-full.png` model-bounds framing tightened from 392×1024 (with
the extra outfits) to 389×1024 (Default only), and the stacked Rodos/Endoministorator
top/bottom/hand wear no longer overpaint the Default outfit.

## Reproduce

```
npm run test:ref-e2e
# or
npx vitest run apps/authoring-host/src/ref-e2e.test.ts
```

The e2e also asserts determinism: an identical render request produces byte-identical
PNG output.

## The PNGs (what to look at)

All three are the **rest pose** (`ref/model/parameters.json` is empty, so rest is the
only pose). Rendered by the software renderer from the runtime-core evaluated snapshot
— the same evaluation semantics the Player uses.

| File | View | What it shows |
|---|---|---|
| `ref-rest-full.png` | omitted (model bounds framing) | The whole character, framed to the union of all evaluated drawable bounds (392x1024). Check overall assembly: layer order, opacity, part placement, nothing missing/misplaced. |
| `ref-face-focus.png` | `drawableFocus` on `draw_r0_1cea4f6f_5c3cada6_face` (10% margin) | The face region (1024x1013). Check facial feature alignment: eyes, glasses, brows, mouth, hair overlap order. |
| `ref-eyes-viewport.png` | explicit `stageViewport` `{minX:860, minY:385, width:270, height:115}` | Both eyes close up (1024x436). Check iris/eye-white/eyelash layering and mask behavior. |

## The sidecars (`*.render-view.json`)

Every PNG has a machine-readable sidecar recording everything needed to (a) detect a
stale image and (b) translate image pixels back into model (stage) coordinates:

- `packageRevision` — the ref revision the image was rendered from (currently 1844).
  If it does not match `ref/manifest.json`, the image is stale — do not judge from it.
- `parameterOverrides` — the resolved pose (empty here = rest).
- `variantSelections` — **which outfit this photo was taken in** (Wave105). One entry
  per Variant Group, sorted by `variantGroupId`. For these Default renders it reads
  `[{ "kind": "singleSelect", "variantGroupId": "vgrp_expression", "variantId":
  "var_expression_default" }]`. If you regenerate with an explicit selection (e.g. Rodos),
  this field records that instead, so the image is self-describing — you always know
  which outfit you are judging. Empty array `[]` means the package has no Variant Groups.
- `resolvedView` — the image↔stage transform: `stageViewport` (the stage rectangle the
  image covers), `outputWidth/Height`, and `pixelsPerStageX/Y`. To translate an image
  pixel (px, py) to stage coordinates:
  `stageX = stageViewport.minX + px / pixelsPerStageX`,
  `stageY = stageViewport.minY + py / pixelsPerStageY`. This is how a visual
  observation ("the iris is ~20px too far left in ref-eyes-viewport.png") becomes a
  model-space operation quantity (20 / 3.79 ≈ 5.3 stage units).
- `textureDimensionSources` — see next section.

## Texture dimensions are `derived-verified` (§3.4 revised 2026-07-03)

ref's 126 per-layer texture entries declare no explicit `dimensions` (only the
generated atlas page does). These renders therefore use the **revised §3.4 ladder**:
each texture's pixel dimensions were **derived from the referencing drawable's rest
mesh bounds and adopted only because `byteLength === width*height*4` held exactly**.
No unverified estimate is ever used; a mismatch rejects the render deterministically.

Each sidecar records this per texture in `textureDimensionSources[]`
(`dimensionSource: "derived-verified"`, all 126 entries in these renders), so the
derivation is announced, never silent. The e2e additionally proves the exact byteLength
match for all 126 textures as a standalone assertion.

## The measurement companion (`ref-measurement-gate.json`)

Output of the `inspectEvaluatedGeometry` measurement command against ref: evaluated
stage-space rest-pose bounding boxes for representative drawables —

- `draw_r0_1cea4f6f_5c3cada6_face` (face base)
- `draw_r0_1cea4f6f_3a8f7081_irides-l` (left iris)
- `draw_r0_1cea4f6f_3a8f7005_eyewhite-r` (right eye white)

The e2e asserts both eye drawables lie strictly inside the face bbox, and that repeated
requests return identical numbers. These are the NUMBERS a spatial judgement should use
instead of eyeballing pixels (§3.2 Forbidden: "視覚判定に必要な数値を画像目測で代替させ
る設計"); the sidecar transform above connects them to the images.

Wave105 additions to the measurement result: each drawable result carries the gated
`visible` flag (`base visible AND` the Variant predicate) so a gated-hidden outfit
drawable still returns geometry but is clearly marked `visible: false` — the gate is
announced, never silenced. The result also echoes the resolved `variantSelections`, so
the measurement numbers are as self-describing as the PNGs.

## Renderer note (read before judging)

This repository's renderer **participates mask-source drawables in normal drawing as
well** — the Wave103-approved WebGL2-faithful semantics. If a render shows what looks
like a stray eye-white / mask layer, that is not necessarily a renderer defect; it can
be the approved masking semantics. Judge against how the model should look, and flag
anything questionable rather than assuming either way.
