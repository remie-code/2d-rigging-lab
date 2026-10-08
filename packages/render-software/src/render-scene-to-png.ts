import type { RenderScene } from "@private-2d-rigging-lab/render-core";

import { encodeRgba8ToPng } from "./png/png-encoder.js";
import {
  renderSceneToRgba8,
  type SoftwareRenderResult
} from "./software-renderer.js";
import type { SoftwareRenderView } from "./view/view-transform.js";

/**
 * Result of rendering a scene straight to PNG. Includes the intermediate
 * software render result so callers can also inspect the raw RGBA8 buffers and
 * the resolved view (px <-> stage mapping).
 */
export interface SoftwareRenderPngResult {
  readonly render: SoftwareRenderResult;
  /** PNG-encoded bytes of the straight-alpha RGBA8 buffer. */
  readonly png: Uint8Array;
}

/**
 * Render a RenderScene to PNG bytes with an explicit view.
 *
 * The PNG carries straight (non-premultiplied) alpha, per the PNG standard; the
 * un-premultiply is deterministic (see readFramebufferStraightRgba8). Fully
 * deterministic end to end: identical scene + view -> byte-identical PNG.
 */
export const renderSceneToPng = (
  scene: RenderScene,
  view: SoftwareRenderView
): SoftwareRenderPngResult => {
  const render = renderSceneToRgba8(scene, view);
  const png = encodeRgba8ToPng(render.straightRgba8, render.width, render.height);
  return { render, png };
};
