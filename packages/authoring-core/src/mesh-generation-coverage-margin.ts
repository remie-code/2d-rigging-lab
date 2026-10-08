import { clamp } from "./mesh-geometry/geometry-primitives.js";
import {
  V7_MARGIN_RADIUS_MAX_PIXELS,
  V7_MARGIN_RADIUS_MIN_PIXELS,
  V7_MARGIN_RADIUS_TEXTURE_FRACTION
} from "./mesh-generation-v7-parameters.js";

/**
 * Coverage margin — the canonical upper bound (as a FUNCTION of layer size) on
 * how far a boundary-contour mesh generator may push vertices beyond the
 * drawable / texture edge.
 *
 * ## Why this exists
 *
 * Outline mesh generators intentionally cover the source drawable by extending
 * boundary vertices OUTSIDE the drawable/texture (the "covering margin"), so a
 * deformed drawable never reveals a cut edge. Wave108 (boundary transparent
 * margin) drops the historical UV clamp so those overshoot vertices carry
 * layer-local UVs that spill slightly past [0,1]. For that to be safe end to
 * end, every layer downstream must reserve at least as much transparent room as
 * the widest overshoot any generator can produce for that layer's size.
 *
 * ## Option E (2026-07-09): size-dependent padding, generator r NOT bound
 *
 * The earlier design bound every generator's radius r to a single constant K.
 * That capped v7's long-edge-proportional margin (4..16px) down to 4px, killing
 * v7's quality headroom. Option E instead leaves the generators' r at their
 * natural values and bakes a transparent padding whose width is a FUNCTION of
 * the (import-time known) layer size. This function is that upper bound: the
 * widest overshoot any live generator can produce at a given long edge.
 *
 * ## Why the v7 r formula is the upper bound
 *
 * The two live generators that push vertices outward are:
 *   - v6d-adaptive-contour (default): a texture-size-INDEPENDENT mask expansion
 *     of ~2px outward (≈3px including soft-mask spread). Constant, small.
 *   - v7-margin-contour: a long-edge-proportional dilation radius
 *     r = clamp(0.012 × longEdge, 4, 16) px (see V7_MARGIN_RADIUS_* below).
 * v7's r is >= 4px for every size and grows with the layer, so it dominates the
 * constant ~3px of v6d at every size. Taking the v7 r formula as the bound
 * therefore covers BOTH generators, and any future generator that respects
 * r <= maxCoverageMarginSourcePixels(size) is automatically covered too.
 *
 * ## Contract
 *
 * - Unit: SOURCE-TEXTURE PIXELS (the same pixel space the generators sample the
 *   drawable raster in). Atlas-side gutter widths are a DIFFERENT coordinate
 *   system (atlas output pixels) and must convert this by the placement scale;
 *   do not confuse the two (design §5 "継ぎ目").
 * - For every live generator, the effective outward covering margin r at a
 *   layer of the given long edge satisfies r <= maxCoverageMarginSourcePixels(longEdge).
 * - Downstream texture preparation reserves this many px of transparent padding
 *   (and the atlas gutter reserves at least this, scaled) so overshoot UV lands
 *   inside the transparent gutter and never bleeds into a neighbouring placement.
 *
 * The formula reuses the v7 radius constants directly (single source of truth)
 * so that any future tuning of the v7 margin radius automatically flows into
 * the padding bound — the bound can never silently fall behind v7's r.
 */

/**
 * Extra source-pixel spread beyond the dilation radius that the soft alpha mask
 * can introduce before contour tracing. createSoftAlphaMask (alpha-mask.ts)
 * runs a 3×3 weighted blur (blurAlphaAt, kernel radius 1) plus a single-pixel
 * crack close (closeSinglePixelCracks, 3×3, radius 1); either can turn on a
 * background pixel one step outside the nominal opaque boundary. One pixel is a
 * safe upper bound for that blur-driven bleed, and it is added on top of the
 * dilation radius so the transparent padding also covers the softened edge.
 *
 * Named (not inlined) so the soft-mask origin is documented and tuning is a
 * single-site edit, never a magic-number hunt.
 */
export const COVERAGE_MARGIN_SOFT_ALPHA_MASK_BLUR_PIXELS = 1;

/**
 * The maximum outward covering margin, in SOURCE-TEXTURE PIXELS, that any live
 * mesh generator can produce for a layer whose longer side is `longEdgePixels`.
 *
 * ≈ ceil(clamp(0.012 × longEdge, 4, 16) + blur):
 *   - clamp(0.012 × longEdge, 4, 16) is v7's dilation radius r (the widest
 *     outward push of any generator; see module doc). Reused from the v7
 *     constants so this stays a single source of truth with v7's r formula.
 *   - + COVERAGE_MARGIN_SOFT_ALPHA_MASK_BLUR_PIXELS accounts for the soft-mask
 *     bleed that sits on top of r.
 *   - ceil rounds up to a whole reserved pixel (padding is baked at pixel grid).
 *
 * Note the saturation values are the CLAMP endpoints plus blur: a tiny layer
 * saturates at ceil(4 + blur), a huge layer at ceil(16 + blur); in between the
 * bound is long-edge-proportional. v6d's constant ~3px outward is always below
 * the floor (ceil(4 + 1) = 5 > 3), so v6d is covered at every size.
 */
export const maxCoverageMarginSourcePixels = (longEdgePixels: number): number =>
  Math.ceil(
    clamp(
      V7_MARGIN_RADIUS_TEXTURE_FRACTION * longEdgePixels,
      V7_MARGIN_RADIUS_MIN_PIXELS,
      V7_MARGIN_RADIUS_MAX_PIXELS
    ) + COVERAGE_MARGIN_SOFT_ALPHA_MASK_BLUR_PIXELS
  );
