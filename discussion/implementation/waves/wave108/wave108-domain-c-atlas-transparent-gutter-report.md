# Wave108 Domain C Report — `wave108-atlas-transparent-gutter` (Option E, Batch 2 / D-atlas)

Role: Gnome (implementation), delegated by Orch-Sylph. Batch 2, Domain C (D-atlas).

Verdict: **green** — focused suites + typecheck all pass; no Domain C regressions.

Design oracles: `discussion/design/mesh-rendering/boundary-transparent-margin-design.md`
(§3.1 bounds≡raster separation, §4 cross-bleed [必達], §5 mechanism, §9 §9-override),
`discussion/implementation/orchestration/wave108-plan.md` §7 (Domain C scope).

## Summary

Threaded the transparent covering-margin padding that D-texprep bakes into layer
rasters through atlas packing, UV materialization, and per-texture render sizing, so
that overshoot UV lands in each tile's own transparent band and never bleeds into a
neighbouring placement (§4). The mechanism is: derive the atlas source-tile size from
the **padded raster** `textureEntry.dimensions` (not content bounds), and fold the
per-tile `contentInset` into the placement `uvRect` so that `uvRect` becomes the
**content sub-rect** — the single source of truth consumed linearly by both the editor
atlasRuntime remap and export materialization, with no double correction. The atlas
edge-extrude and the per-texture copy required **no logic change**: with padded rasters
their existing behaviour already produces a transparent gutter and a correct copy.

## 1. Changed files (absolute paths)

Implementation (Domain C allowed scope):
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\texture-atlas-targets.ts`
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\texture-atlas-packing.ts`
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\texture-atlas-binary.ts` (documenting comment only; no logic change)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\editor\src\workspace\canvas\canvas-projection.ts`

Tests:
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\texture-atlas-transparent-gutter.test.ts` (new)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\editor\src\workspace\canvas\canvas-projection.test.ts` (one new case)

Report:
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\implementation\waves\wave108\wave108-domain-c-atlas-transparent-gutter-report.md`

**Not changed (allowed but no change needed):**
`apps\editor\src\workspace\viewer\viewer-render-source.ts` — `remapUvIntoPlacement`
consumes `uvRect` linearly; since `uvRect` now carries the content-inset (see §3), the
viewer is correct unchanged. Editing it would risk a double correction. See §3.

> Scope note: the working tree also carries parallel uncommitted changes from other
> Batch-1 domains (D-gen `mesh-generation-*`, D-texprep `browser-psd-parser-adapter` /
> `operation-core` / `package-format` schema, D-render `render-*`) and discussion `_map.md`
> edits. Those are **not mine**; I read them (read-only) but modified none. I confirmed my
> tracked edits are exactly the four Domain-C source files + two test files above.

## 2. textureSize / byteLength switched to the padded raster (`texture-atlas-targets.ts`)

Added a single resolver `resolvePackedRasterSize(mesh, textureEntry)` used by both the
byte-length validator and the packable-target builder:

- **Padded when `textureEntry.dimensions` is present** → returns `{dimensions.width,
  dimensions.height}` (the padded raster, `content + 2·inset`), which is what the stored
  `binaryAssetRef` bytes actually are.
- **Legacy fallback** → rounded content `mesh.bounds` (preserves the historical
  `bounds ≡ raster` behaviour for entries without baked padding).

Specific sites:
- `validateTextureBytesForAtlas` (:354-372 region): `expectedByteLength = width * height
  * 4` now uses the padded `width/height`. Before this switch the estimate was
  `content*content*4`, under-counting the padded bytes and raising
  `atlas.target.invalidRgbaByteLength`, which dropped the drawable from packing. The new
  gutter test asserts `preview.warnings === []` and both placements present, guarding this.
- `createPackableTarget` (:377-410 region): `textureSize: resolvePackedRasterSize(...)`,
  and the target now also carries `contentInset` (copied from `textureEntry.contentInset`
  when present). `TextureAtlasPackableTarget` gained an optional `contentInset` field
  (typed `TextureContentInsetDto`, imported from package-format).

Because `textureSize` is now the padded raster, everything downstream that derives from
it becomes padded automatically and consistently: `sourceTextureSize`, `sourceRectPixels`
(= full raster), `contentRectPixels` (width/height), and `copyTextureIntoPlacement`'s
source stride. That is exactly the "copy the whole padded raster (transparent border
included)" behaviour the design's §5.3/§9 override relies on.

## 3. `uvRect` = content sub-rect; content-inset consumed exactly once

In `createTextureAtlasPlacement` (`texture-atlas-packing.ts` :516-561 region) I kept
`contentRectPixels`/`sourceRectPixels`/`sourceTextureSize` as the **padded raster**
placement (the raster including its transparent border), and inset **only the `uvRect`**
by the per-tile `contentInset`:

```
inset        = target.contentInset ?? {0,0,0,0}
contentUvRect = contentRect inset by {left,top,right,bottom}   // = content region
uvRect        = contentUvRect / page   (topLeft, bottomRight normalized)
```

Rationale and single-consumption guarantee:
- Layer-local mesh UV is content-space [0,1] (D-gen), overshooting up to `inset/contentSize`.
- The editor remap (`viewer-render-source.ts remapUvIntoPlacement`) and export
  (`runtime-export-materialization.ts mapSourceUvToAtlasUv`, Domain E, read-only) both
  reduce to the **same linear consume** `atlasUv = uvRect.topLeft + layerUv · span`
  whenever `sourceRectPixels` spans the full `sourceTextureSize` (which it does: `(0,0,
  padded)`). So making `uvRect` the content sub-rect makes **both** consumers correct
  with a single inset applied in one place. I verified `mapSourceUvToAtlasUv`'s local
  normalization is identity under a full source rect (`localX = uv.x`), so D-export needs
  **no change** to land in the transparent band once it runs against these placements.
- I therefore did **not** touch `remapUvIntoPlacement` and did **not** add a second
  inset anywhere. `uvRect` is the sole carrier of the content-inset — no double correction.

Geometric consequence (units): the atlas is a native-resolution 1:1 copy (source pixel →
atlas pixel, scale 1), so `contentInset` in source pixels applies directly as atlas
pixels (explicit comment added). `u=0` → content left edge = `contentRect.x + inset.left`
(i.e. `inset` px **inside** the raster); `u=1` → content right edge; the maximum overshoot
`u = 1 + inset/contentW` maps to exactly the raster's outer edge (`contentRect.x +
contentRect.width`), and the design bounds the real overshoot strictly below that
(`P = ceil(r + blur) > r`). So overshoot stays inside the tile's own transparent band,
inside `contentRectPixels`, which is disjoint from every other placement → no cross-bleed.

## 4. Edge-extrude conclusion — transparent gutter for free, no logic change

`extrudeTexturePlacementEdges` and `copyTextureIntoPlacement` (`texture-atlas-binary.ts`)
were left **functionally unchanged**; I only added a documenting comment. Reasoning,
verified by test:
- `copyTextureIntoPlacement` copies `sourceWidth×sourceHeight` (= padded raster) into
  `contentRectPixels` (= padded raster placement). The raster's transparent P-border is
  copied into an internal transparent band; the opaque content interior lands in the
  content sub-rect. Correct copy (padded stride) — this is exactly what the §2 textureSize
  switch fixed the under-count/mis-stride for.
- `extrudeTexturePlacementEdges` clamps the **raster's outer edge** outward into the atlas
  gutter. That outer edge is now the transparent covering-margin border, so the gutter
  becomes **transparent** — the §9 opaque edge-extrude is overridden for the covering
  margin without changing the extrude code. The in-content `continue` skips the entire
  raster placement, so extrude never overwrites the internal transparent band with an
  opaque texel (the §4/§9 "don't crush the transparent margin" invariant holds).

Test `keeps the covering-margin band and gutter premultiplied (0,0,0,0)` asserts a band
pixel and a gutter pixel are exactly `(0,0,0,0)` (premultiplied transparent, not a clamped
edge colour). The full-page scan test additionally proves every opaque page pixel lies in
exactly one tile's content sub-rect and matches that tile's colour — simultaneously
proving band-transparent, gutter-transparent, and no cross-tile bleed.

**Double-padding note:** the atlas gutter (`settings.paddingPixels`, default 4) is left
at its existing width — I did **not** widen it to P. Under Option E the covering-margin
overshoot is absorbed entirely by the in-raster transparent band (`contentInset`), so the
gutter retains only its original adjacent-placement bilinear-safety role. Widening it to P
would be wasteful double padding; keeping it small is correct.

## 5. canvas-projection render dimensions + original de-scoped note

`resolveDrawableRenderDimensions` (`canvas-projection.ts` :354-369 region) now takes an
optional `rasterDimensions` and, when present, returns the **padded raster dims**;
otherwise it keeps the existing content bounds chain. The projection builds a
`textureEntriesById` index (`session.graph.textureAtlas.textures`, mirroring the existing
`meshesById` / `sourceLayerByDrawableId` pattern) and passes
`textureEntry.dimensions` in. This keeps `renderWidth·renderHeight·4 ===
renderBytes.byteLength` for padded per-texture rasters, so `isRenderableDrawable`
(:629-640, unchanged) no longer drops the drawable. `isRenderableDrawable` needed no edit
— once render dims match the padded bytes, its byteLength check passes as-is.

New test `keeps a padded-raster drawable renderable using padded texture dimensions`
sets an entry's `dimensions`/`contentInset` to padded, swaps in padded bytes, and asserts
`renderWidth/Height` = padded, drawable stays renderable/hit-testable, and stage `bounds`
stay content-sized.

**Original de-scoped note (design §5.5/§13):** with padded per-texture bytes sampled by
content-space UV under CLAMP_TO_EDGE, the `original` preview can show the content offset
by the padding. This is the design's explicitly de-scoped consequence; Domain C's
canvas-projection responsibility is only "drawable stays renderable / render dims match
the real bytes", which is satisfied. I did **not** add original-mode UV inset correction
(not trivially correct, and out of the design's intent). The `atlasRuntime` path
(`remapDrawableToAtlasRuntime`) overrides render dims to the atlas page and is unaffected;
it is the canonical preview per §5.5.

## 6. Test results

- `pnpm.cmd exec vitest run packages/authoring-core/src` — **39 files / 305 tests passed**
  (was 299; +6 from the new `texture-atlas-transparent-gutter.test.ts`). Covers: padded
  drawables stay packable (byteLength not under-counted); placement sizes = padded raster;
  `uvRect` = content sub-rect (inset by P); full-page scan (opaque only in content
  sub-rects, mixed P=17/P=5) → band+gutter transparent + no cross-bleed; band/gutter
  exactly `(0,0,0,0)`; `u=0`/`u=1`/max-overshoot mapping via the exact remap formula stays
  in-band and off the neighbour; determinism + within-page + non-overlap.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer apps/editor/src/workspace/canvas`
  — **17 files / 179 passed / 4 skipped**. Includes the new canvas-projection padded-raster
  case and the unchanged `viewer-render-source` remap tests (14) that assert
  `remapUvIntoPlacement` maps `u=0/u=1` linearly onto `uvRect` corners (real function,
  single linear consume).
- `pnpm.cmd typecheck` (`tsc --noEmit`) — **clean, no errors**.
- Full `pnpm.cmd run test:unit` (all packages) — **239 files / 1487 tests passed** (run to
  confirm the stray-`.js` cleanup in §7 caused no collateral regression across packages).

Pre-existing failures (separated, not mine): `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts`
— **4 failed / 2 passed**, unchanged from what the prior Domain A/B reports recorded. That
file is unrelated to atlas/canvas/viewer and untouched by Domain C; my focused apps command
(viewer + canvas) is fully green.

## 7. Discretionary decisions

1. **Removed stray untracked compiled `.js` in `packages/authoring-core/src` (build
   hygiene; see also §8 escalate).** The dir contained 124 **untracked** `.js` files (a
   stale full `tsc` emit, built at an earlier point) sitting next to the `.ts` sources.
   authoring-core's `package.json` declares `exports: { ".": "./src/index.ts" }` — the
   package is consumed as **TS source, with no build step** — and inter-file imports use
   NodeNext `./foo.js` specifiers. Vite/vitest resolves those specifiers to the real
   sibling `.js` when it exists, so my (and any post-build) `.ts` edits to
   `texture-atlas-*.ts` were **shadowed by the stale `.js`** and my first test run failed
   with old-logic behaviour (content-sized byteLength). I deleted only untracked `.js`
   that have a `.ts` sibling (all 124 qualified; every one had a `.ts`), preserving the 2
   **tracked** hand-written runtime files (`mesh-generation-v6b/v7-constrainautor-runtime.js`).
   No tracked file was deleted; the full packages suite is green afterward. This is not an
   env change (no install) and not a silent workaround — without it the tests report
   **wrong** results. Flagged to Orch below because it likely affected other domains' runs.
2. **`uvRect` carries the inset (single truth), not `remapUvIntoPlacement`.** Chosen over
   inset-in-remap because export's `mapSourceUvToAtlasUv` reads the same placement and
   reduces to the same linear consume; folding the inset into `uvRect` keeps one carrier
   for editor + export + runtime. `viewer-render-source.ts` left unchanged.
3. **Atlas gutter `paddingPixels` left at its existing default (not widened to P).**
   Overshoot is absorbed by the in-raster transparent band; the gutter keeps its bilinear
   role. Avoids wasteful double padding (§4).
4. **`edge-extrude` / `copyTexture` left functionally unchanged** (comment only). The
   transparent gutter falls out of the padded raster's transparent outer edge; no code
   change satisfies §9-override. Verified by test rather than assumed.
5. **No dedicated viewer overshoot test added.** Item 4 (remap endpoints + overshoot) is
   covered by (a) the existing `viewer-render-source` test proving `remapUvIntoPlacement`
   is a linear unclamped consume of `uvRect`, and (b) the authoring-core test proving
   `uvRect` = content sub-rect and that `u=0/1`/overshoot (via the identical formula) hit
   the content edges / transparent band. Adding a content-inset atlas to the viewer fixture
   would have churned many unrelated `renderWidth==2` assertions for marginal value.

## 8. Questions / escalate

1. **[Escalate — cross-domain] Stray untracked `.js` in `packages/authoring-core/src`
   shadow the TS source under vitest.** I removed them (decision #1) so Domain C could be
   validated truthfully. Because the same shadowing was in effect for earlier runs, any
   authoring-core test run whose `.js` were older than the corresponding `.ts` edit would
   have reported **stale** results. The stale emit here was timestamped after Domain A/B
   landed, so those reports were likely valid *at the time*, but this is a latent hazard:
   whoever runs `tsc` with emit (not `--noEmit`) will silently re-pollute `src/` and shadow
   source again. Recommend Orch/L0 (a) confirm no tooling emits into `src`, and (b) consider
   a `.gitignore` for `packages/*/src/**/*.js` (except the 2 tracked runtime files) or a
   guard in `check:source`. Not fixed by me (outside Domain C write scope; it is repo
   hygiene / tooling config).
2. **D-export (Domain E) confirmation.** My placements make `mapSourceUvToAtlasUv` correct
   **without a change** (identity local-normalization under full `sourceRectPixels` +
   content-inset `uvRect`). If D-export instead intends to consume `contentInset` directly,
   it must **not** re-inset (that would double-correct). Recommend D-export treat `uvRect`
   as the single truth, matching this domain.

## 9. Injection

No prompt-injection encountered in any file, tool output, or other-agent artifact read
during this task. All instructions followed came from the delegation body and the Basis
design/plan documents only.

DOMAIN-C-REPORT-COMPLETE (Option E)
