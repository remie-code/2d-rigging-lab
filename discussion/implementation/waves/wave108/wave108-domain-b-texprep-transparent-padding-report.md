# Wave108 Domain B Report — `wave108-texprep-transparent-padding` (Option E)

Role: Gnome (implementation), delegated by Orch-Sylph. Batch 1, Domain B (D-texprep).

> **Rebuild note (Option E, 2026-07-09).** This report supersedes the earlier
> "fixed K=4 all-around padding" pass. Per the accepted user decision, the fixed
> `LAYER_RASTER_TRANSPARENT_PADDING_PX = 4` constant is retired and the padding
> width is now a **function of the layer's long edge**: `P =
> maxCoverageMarginSourcePixels(longEdge)` (the authoring-core canonical bound,
> imported via re-export). The rest of the prior skeleton — content-inset
> four-sided schema, evidence → operation → textureEntry propagation, stage
> bounds held at content size — is unchanged; only the padding width source
> changed.

## Summary

Layer PSD rasters carry a baked **transparent alpha-edge border** whose width is
now **per layer size** (`P` px on every side, premultiplied `(0,0,0,0)`), so
contour covering-margin overshoot samples transparency instead of stretched edge
texels. `P = maxCoverageMarginSourcePixels(max(bounds.width, bounds.height))`
saturates at **5px** for small layers, **17px** for large layers, and scales
long-edge-proportionally in between. All materialization evidence (`byteLength` /
`width` / `height` / `digest`, on both the top-level evidence and its
`binaryAssetRef`, plus `layerBytes`) is recomputed against the **padded** raster.
The **content-inset** four-sided field (`{ left, top, right, bottom }`) now
records the actual baked `P` on all four sides and bridges the broken
`bounds ≡ raster` identity for Domain C (D-atlas). Stage `bounds`
(`mesh.bounds` / `resolveInitialBounds`) is left content-sized and unchanged.

## Changed files (this rebuild)

- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
  - Removed the fixed exported constant `LAYER_RASTER_TRANSPARENT_PADDING_PX = 4`
    and its stale "canonical K in packages/authoring-core; that value cannot be
    imported yet" comment.
  - Added `import { maxCoverageMarginSourcePixels } from "@private-2d-rigging-lab/authoring-core";`
    (the canonical bound Domain A defines and re-exports — an existing
    `workspace:*` dependency; no new package dependency, no `pnpm install`).
  - Added a thin named export `layerTransparentPaddingSourcePixels(longEdgePixels)`
    = `maxCoverageMarginSourcePixels(longEdgePixels)`, with an Option-E rationale
    comment, so the texprep call site and its tests reference the padding width by
    an intent-named function rather than a magic number.
  - `createLayerMaterializationEvidence` now computes
    `longEdge = Math.max(bounds.width, bounds.height)` and
    `padding = layerTransparentPaddingSourcePixels(longEdge)`, passing that
    per-layer `padding` to the padding helper. The border width is now per layer.
- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.test.ts`
  - Replaced the fixed-4px evidence tests with **per-size** verification (see
    Test results). Added a direct table-driven test of the padding function
    (lower saturation / proportional / upper saturation) and a
    full-border-on-every-side test at the upper-saturation P.

### Files retained unchanged from the prior pass (skeleton kept)

The prior pass's non-padding-width skeleton is correct for Option E as-is (the
value flowing through is now `P` instead of `4`; the shapes and logic are
identical), so these were **not** modified in this rebuild:

- `packages/package-format/src/texture-atlas.ts` — `TextureContentInsetSchema` +
  `contentInset` on `TextureAtlasEntrySchema`; `dimensions` doc comments.
- `packages/package-format/src/psd-source-evidence.ts` — `contentInset` on the
  package-format evidence DTO.
- `packages/package-format/src/texture-content-inset.test.ts` — schema tests.
- `packages/operation-core/src/payloads/import-source.ts` —
  `PsdAdapterContentInsetSchema` + `contentInset` on the operation-payload
  evidence schema (the load-bearing copy that validates the operation input).
- `packages/operation-core/src/operations/import-psd-layer-materialization.ts` —
  populates `textureEntry.dimensions` (padded) + `textureEntry.contentInset`
  from evidence; `mesh.bounds` / `resolveInitialBounds` left content-sized;
  byteLength invariants (`byteLength == width*height*4`, binaryAssetRef equality)
  are self-consistent because all evidence values are padded together. The
  operation is **data-driven** — it copies the values the evidence carries — so
  it needed **no** change to honour per-size `P`.
- `packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`
  — fixture-driven; its synthetic `contentInset: {4,4,4,4}` is a hand-authored
  input value, not a computed adapter output, so it stays valid.

> Scope note: the working tree also contains parallel Batch 1 changes from other
> domains (`packages/render-*`, `packages/authoring-core/src/mesh-generation-*`,
> including `mesh-generation-coverage-margin.ts` which defines the canonical
> `maxCoverageMarginSourcePixels`). Those are **not** mine (Domain A / D-render);
> I only read/import `maxCoverageMarginSourcePixels` and did not modify it.

## Option E difference vs the prior fixed-4px pass

| Aspect | Prior pass (fixed) | This rebuild (Option E) |
| --- | --- | --- |
| Padding width | constant `4` (exported `LAYER_RASTER_TRANSPARENT_PADDING_PX`) | `maxCoverageMarginSourcePixels(longEdge)` — per layer size |
| Source of the value | texprep-local copy of a generation constant | authoring-core canonical bound, imported via re-export |
| content-inset value | `{4,4,4,4}` | `{P,P,P,P}` (P is the actual baked width) |
| Small layers | 4px | **5px** (`ceil(4+1)`) |
| Large layers | 4px | **17px** (`ceil(16+1)`) |
| Cross-package K unification residual | deferred to D-final | **resolved** — texprep now imports the single canonical function; no duplicate constant remains |

Import path (confirmed, no new dependency):
`import { maxCoverageMarginSourcePixels } from "@private-2d-rigging-lab/authoring-core";`
`apps/editor` already depends on `@private-2d-rigging-lab/authoring-core`
(`workspace:*`) and other files import from it; the function is re-exported from
the authoring-core index (`export * from "./mesh-generation-coverage-margin.js";`).

## Per-size padding — measured values

`P = maxCoverageMarginSourcePixels(longEdge) = ceil(clamp(0.012 × longEdge, 4, 16) + 1)`
(1px = soft-alpha-mask blur term). Verified by the new tests:

| Layer long edge (px) | clamp(0.012·L, 4, 16) | + blur | **P (px)** | Regime |
| --- | --- | --- | --- | --- |
| 3 | 4 (floor) | 5 | **5** | lower saturation |
| 250 | 4 (floor) | 5 | **5** | lower saturation |
| 333 | 4 (floor) | 5 | **5** | lower saturation (edge of floor) |
| 500 | 6 | 7 | **7** | proportional |
| 1000 | 12 | 13 | **13** | proportional |
| 1334 | 16 (ceiling) | 17 | **17** | upper saturation |
| 2048 | 16 (ceiling) | 17 | **17** | upper saturation |

Baked-raster consequence for a representative layer (content `1500 × 2`,
longEdge 1500 → P=17): padded raster = `(1500+34) × (2+34)` = `1534 × 36`,
`byteLength = 1534 × 36 × 4 = 220,896`, content transcribed to inset `(17,17)`,
`contentInset = {17,17,17,17}`, all four P-wide border rings fully transparent.

## content-inset — schema unchanged, value now P-derived

The four-sided inset schema `{ left, top, right, bottom }` (`z.number().int().nonnegative()`)
is unchanged. What changed: every side now equals the layer's actual baked `P`
instead of the fixed 4. Content sub-rect reconstruction is unchanged:
`contentRect = { x: left, y: top, width: dims.width - left - right, height: dims.height - top - bottom }`.
Propagation is unchanged: evidence.contentInset → operation → `textureEntry.contentInset`,
with `textureEntry.dimensions` = padded raster. Stage `mesh.bounds` unchanged.

## Test results

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/browser-psd-parser-adapter.test.ts`
  — **15 tests passed** (1 file). Covers: padding function lower/proportional/upper
  regimes; per-size evidence (P=5, P=13, P=17 cases) padded dims / byteLength /
  content-inset = `{P,P,P,P}`; evidence ↔ binaryAssetRef ↔ layerBytes mutual
  consistency at padded values; full transparent border on every side at P=17;
  digest over padded bytes (≠ content-only digest); determinism (identical layer
  → byte-identical padded output).
- `pnpm.cmd exec vitest run packages/operation-core/src packages/package-format/src`
  — **81 files / 465 tests passed** (package-format incl. `texture-content-inset.test.ts`;
  operation-core incl. the padded-propagation / bounds-unchanged test). Ran the
  two suites together in one invocation; both green.
- `pnpm.cmd typecheck` — **passed clean** (`tsc --noEmit`, no errors).

Note on `apps/editor/src` (full): not re-run in this focused rebuild. The prior
pass recorded 4 pre-existing failures in
`apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts`, verified
unrelated to Domain B (reproduced on the clean tree with Domain B stashed). This
rebuild touches only the adapter + its own test, so that pre-existing set is
unaffected.

## D-atlas dependency — residual temporary inconsistency (expected, not fixed here)

Unchanged from the prior pass, and now with a per-size magnitude:
`packages/authoring-core/src/texture-atlas-targets.ts` (`:354-372`) still
estimates raster `byteLength` as `mesh.bounds.width * height * 4` (content basis).
With padded stored bytes (`(w+2P)(h+2P)*4`) the estimate **under-counts** by a
per-layer amount (larger for large layers, up to the 17px band). This is the
**expected sequential hand-off** to Domain C (D-atlas), which switches that path
to a raster/`dimensions` basis and consumes `contentInset`. It lives in D-atlas
write scope; I did not touch it. My focused commands do not exercise that path,
so it does not surface in the green runs above. Likewise
`canvas-projection.ts` `resolveDrawableRenderDimensions` / `isRenderableDrawable`
still derive raster dims from `bounds` and are realigned by D-atlas.

## Discretionary decisions

1. **Thin named export `layerTransparentPaddingSourcePixels`** rather than
   calling `maxCoverageMarginSourcePixels` inline at the call site. Rationale:
   keeps a texprep-local, intent-named seam (the tests reference the padding
   width the same way the production code computes it, avoiding a re-derived
   magic number in the test), while delegating the actual formula to the single
   canonical authoring-core source. It is a pure pass-through — no second source
   of truth. If Orch prefers a direct inline call with no wrapper, the change is
   a one-line rename; flag it.
2. **`longEdge = Math.max(bounds.width, bounds.height)`** on the content (PSD
   alpha bbox) size (`input.layer.bounds.width/height`), matching the design's
   "layer long edge" wording and the atlas/generation source-pixel space.
3. **Kept the padding helper `padLayerRasterWithTransparentBorder` as-is** — it
   was already a pure function taking `padding` as an argument (not a
   fixed-width-only helper), so Option E needed only a different argument value,
   not a generalization. Its own unit tests (explicit padding args of 1 and 2)
   are unaffected and still pass.
4. **Operation-core and package-format left untouched.** The operation is
   data-driven (copies evidence values), so per-size `P` flows through without a
   logic change; re-touching those files would be out-of-scope churn.

## Questions for Orch-Sylph / L0

1. **K unification now resolved on the texprep side.** The prior pass flagged a
   deferred "two constants with the same value 4" residual. Option E collapses
   that: texprep imports the single canonical `maxCoverageMarginSourcePixels`.
   The only remaining shared-shape residual is the **content-inset schema
   triplication** (package-format `texture-atlas.ts` + `psd-source-evidence.ts`,
   operation-core `import-source.ts`), mirroring the pre-existing duplication of
   the whole materialization-evidence schema. Confirm consolidating those
   duplicate evidence schemas is D-final's job (I kept shapes identical).
2. **Named-wrapper vs inline** (discretion #1) — confirm the thin
   `layerTransparentPaddingSourcePixels` pass-through is acceptable, or I inline
   `maxCoverageMarginSourcePixels` directly at the call site.
3. **content-inset shape** stays four-sided `{left,top,right,bottom}` (all = P).
   If D-atlas would prefer minimal `{x,y}`, the switch is small and localized.
