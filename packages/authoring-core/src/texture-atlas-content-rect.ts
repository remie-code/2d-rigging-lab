import type {
  TextureAtlasRectPixelsDto,
  TextureAtlasUvRectDto,
  TextureContentInsetDto
} from "@private-2d-rigging-lab/package-format";

// Zero content inset for legacy `bounds ≡ raster` tiles (and any texture that
// never had a transparent covering-margin border baked): the content sub-rect
// equals the whole raster placement. An `undefined` inset is treated as this
// zero inset, inheriting the semantics of the former packing-local
// `ZERO_CONTENT_INSET`.
export const ZERO_CONTENT_INSET: TextureContentInsetDto = {
  left: 0,
  top: 0,
  right: 0,
  bottom: 0
};

/**
 * Single source of truth for deriving a placement's normalized `uvRect` — the
 * **content sub-rect** — from the raster content rect (atlas pixels), the source
 * texture's `contentInset` (source pixels; native 1:1 atlas copy ⇒ direct) and
 * the atlas page dimensions.
 *
 * Since Wave108 the placement `uvRect` is the content sub-rect — the raster
 * placement inset by `contentInset` — not the whole raster placement, so that
 * layer-local UV 0/1 map to the content edges (which sit `inset` px inside the
 * raster) and covering-margin overshoot lands in the raster's own transparent
 * band rather than the neighbouring placement. `uvRect` is the single truth;
 * consumers linearly consume it and never re-inset
 * (boundary-transparent-margin-design.md §3.1/§4).
 *
 * Both the packing writer (`createTextureAtlasPlacement`) and the Runtime Export
 * preflight validator (`doesUvRectMatchContentRect`) call THIS function, so the
 * written value and the validator's expected value are produced by one identical
 * float computation. This structurally prevents the two derivations from drifting
 * apart again — the re-drift that left the preflight validator on the old
 * `uvRect == contentRect` contract (blocking every non-zero-inset placement)
 * until Wave109 reconciled it.
 *
 * The float operation order matches the historical packing derivation exactly so
 * output values are strictly unchanged: the per-side inset is applied in pixel
 * space, then each edge is divided by the page dimension (the only float op).
 */
export const deriveContentSubRectUv = (input: {
  readonly contentRect: TextureAtlasRectPixelsDto;
  readonly contentInset: TextureContentInsetDto | undefined;
  readonly pageWidth: number;
  readonly pageHeight: number;
}): TextureAtlasUvRectDto => {
  const inset = input.contentInset ?? ZERO_CONTENT_INSET;
  const contentUvRect = {
    x: input.contentRect.x + inset.left,
    y: input.contentRect.y + inset.top,
    width: input.contentRect.width - inset.left - inset.right,
    height: input.contentRect.height - inset.top - inset.bottom
  };

  return {
    topLeft: {
      x: contentUvRect.x / input.pageWidth,
      y: contentUvRect.y / input.pageHeight
    },
    bottomRight: {
      x: (contentUvRect.x + contentUvRect.width) / input.pageWidth,
      y: (contentUvRect.y + contentUvRect.height) / input.pageHeight
    }
  };
};
