import type {
  EditorPreviewDrawableDto,
  EditorPreviewDrawableTexturePreviewReferenceDto,
  EditorPreviewProjectionDto
} from "../../editor-preview/preview-dto.js";
import { editorTestIds } from "../../editor-state/index.js";

const svgNamespace = "http://www.w3.org/2000/svg";

export const createPreviewVisual = (
  preview: EditorPreviewProjectionDto | null
): SVGSVGElement => {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("preview-visual");
  svg.dataset.testid = editorTestIds.previewVisual;
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Runtime preview visual");

  if (preview === null || preview.drawables.length === 0) {
    svg.setAttribute("viewBox", "0 0 128 128");
    svg.append(createEmptyText("No runtime drawables"));
    return svg;
  }

  const viewBox = resolvePreviewViewBox(preview);
  svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute("aria-label", createPreviewVisualAriaLabel(preview));

  const defs = createTexturePatternDefs(preview);
  if (defs !== null) {
    svg.append(defs);
  }

  for (const drawable of preview.drawables) {
    if (!drawable.visible) {
      continue;
    }

    svg.append(createDrawableShape(drawable, getTexturePatternFill(drawable)));
  }

  return svg;
};

const createDrawableShape = (
  drawable: EditorPreviewDrawableDto,
  texturePatternFill: string | null
): SVGElement => {
  const points = drawable.geometry.polygonPoints;

  if (points !== undefined && points.length >= 3) {
    const polygon = document.createElementNS(svgNamespace, "polygon");
    polygon.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
    applyDrawableShapeAttributes(polygon, drawable, texturePatternFill);
    return polygon;
  }

  const rect = document.createElementNS(svgNamespace, "rect");
  rect.setAttribute("x", String(drawable.bounds.x));
  rect.setAttribute("y", String(drawable.bounds.y));
  rect.setAttribute("width", String(Math.max(drawable.bounds.width, 0.5)));
  rect.setAttribute("height", String(Math.max(drawable.bounds.height, 0.5)));
  applyDrawableShapeAttributes(rect, drawable, texturePatternFill);
  return rect;
};

const applyDrawableShapeAttributes = (
  element: SVGElement,
  drawable: EditorPreviewDrawableDto,
  texturePatternFill: string | null
): void => {
  element.setAttribute("data-drawable-id", drawable.drawableId);
  element.setAttribute("fill", texturePatternFill ?? "#4c8d87");
  element.setAttribute("stroke", "#1f2a2e");
  element.setAttribute("stroke-width", "1.5");
  element.setAttribute("vector-effect", "non-scaling-stroke");
  element.setAttribute("opacity", String(drawable.opacity));
  element.setAttribute("data-texture-status", drawable.texture.status);
  element.setAttribute(
    "data-texture-render",
    texturePatternFill === null ? "solid_fallback" : "texture_pattern"
  );
  if (drawable.texture.textureId !== undefined) {
    element.setAttribute("data-texture-id", drawable.texture.textureId);
  }
  if (drawable.texture.previewReference !== undefined) {
    element.setAttribute("data-texture-preview-asset-id", drawable.texture.previewReference.previewAssetId);
  }
  element.append(createDrawableTitle(drawable, texturePatternFill));
};

const createTexturePatternDefs = (preview: EditorPreviewProjectionDto): SVGDefsElement | null => {
  const texturedDrawables = preview.drawables.filter(
    (drawable) => drawable.visible && isBrowserRenderableTextureReference(drawable.texture.previewReference)
  );
  if (texturedDrawables.length === 0) {
    return null;
  }

  const defs = document.createElementNS(svgNamespace, "defs");
  for (const drawable of texturedDrawables) {
    const previewReference = drawable.texture.previewReference;
    if (previewReference === undefined) {
      continue;
    }

    defs.append(createTexturePattern(drawable, previewReference));
  }

  return defs;
};

const createTexturePattern = (
  drawable: EditorPreviewDrawableDto,
  previewReference: EditorPreviewDrawableTexturePreviewReferenceDto
): SVGPatternElement => {
  const pattern = document.createElementNS(svgNamespace, "pattern");
  const bounds = resolveDrawablePatternBounds(drawable);
  pattern.setAttribute("id", createTexturePatternId(drawable));
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("patternContentUnits", "userSpaceOnUse");
  pattern.setAttribute("x", String(bounds.x));
  pattern.setAttribute("y", String(bounds.y));
  pattern.setAttribute("width", String(bounds.width));
  pattern.setAttribute("height", String(bounds.height));
  pattern.setAttribute("data-texture-preview-asset-id", previewReference.previewAssetId);

  const base = document.createElementNS(svgNamespace, "rect");
  base.setAttribute("x", String(bounds.x));
  base.setAttribute("y", String(bounds.y));
  base.setAttribute("width", String(bounds.width));
  base.setAttribute("height", String(bounds.height));
  base.setAttribute("fill", "#d8ede9");

  const image = document.createElementNS(svgNamespace, "image");
  image.setAttribute("href", previewReference.href);
  image.setAttribute("x", String(bounds.x));
  image.setAttribute("y", String(bounds.y));
  image.setAttribute("width", String(bounds.width));
  image.setAttribute("height", String(bounds.height));
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("data-texture-reference-kind", previewReference.referenceKind);

  pattern.append(base, image);
  return pattern;
};

const createDrawableTitle = (
  drawable: EditorPreviewDrawableDto,
  texturePatternFill: string | null
): SVGTitleElement => {
  const title = document.createElementNS(svgNamespace, "title");
  const textureLabel =
    texturePatternFill === null
      ? createTextureFallbackLabel(drawable)
      : `texture preview ${drawable.texture.previewReference?.previewAssetId ?? "reference"}`;
  title.textContent = `${drawable.name}: ${textureLabel}`;
  return title;
};

const createPreviewVisualAriaLabel = (preview: EditorPreviewProjectionDto): string => {
  const summary = summarizeVisibleTextureRendering(preview);
  if (summary.textureDrawableCount === 0) {
    return "Runtime preview visual";
  }

  return `Runtime preview visual, ${summary.patternCount} texture pattern, ${summary.fallbackCount} texture fallback`;
};

const summarizeVisibleTextureRendering = (
  preview: EditorPreviewProjectionDto
): {
  readonly textureDrawableCount: number;
  readonly patternCount: number;
  readonly fallbackCount: number;
} => {
  const textureDrawables = preview.drawables.filter(
    (drawable) => drawable.visible && isTextureDrawable(drawable)
  );
  return {
    textureDrawableCount: textureDrawables.length,
    patternCount: textureDrawables.filter((drawable) =>
      isBrowserRenderableTextureReference(drawable.texture.previewReference)
    ).length,
    fallbackCount: textureDrawables.filter(
      (drawable) => !isBrowserRenderableTextureReference(drawable.texture.previewReference)
    ).length
  };
};

const createTextureFallbackLabel = (drawable: EditorPreviewDrawableDto): string => {
  if (!isTextureDrawable(drawable)) {
    return "solid geometry preview";
  }

  if (isPackageLocalTexturePreviewUnavailable(drawable)) {
    return "solid fallback, package-local texture preview not browser materialized";
  }

  switch (drawable.texture.status) {
    case "missing":
      return "solid fallback, missing texture";
    case "not_materialized":
      return "solid fallback, texture preview not materialized";
    case "resolved":
      return "solid fallback, preview reference unavailable";
  }
};

const isTextureDrawable = (drawable: EditorPreviewDrawableDto): boolean =>
  drawable.texture.textureId !== undefined ||
  drawable.texture.previewReference !== undefined ||
  drawable.texture.status === "resolved" ||
  drawable.texture.status === "missing";

const getTexturePatternFill = (drawable: EditorPreviewDrawableDto): string | null =>
  isBrowserRenderableTextureReference(drawable.texture.previewReference)
    ? `url(#${createTexturePatternId(drawable)})`
    : null;

const isBrowserRenderableTextureReference = (
  previewReference: EditorPreviewDrawableDto["texture"]["previewReference"]
): boolean => previewReference?.referenceKind === "deterministic-data-url-v1";

const isPackageLocalTexturePreviewUnavailable = (drawable: EditorPreviewDrawableDto): boolean =>
  drawable.texture.previewReference?.referenceKind === "package-local-file-v1";

const createTexturePatternId = (drawable: EditorPreviewDrawableDto): string =>
  `preview-texture-${drawable.drawableId.replace(/[^A-Za-z0-9_-]+/g, "-")}`;

const resolveDrawablePatternBounds = (
  drawable: EditorPreviewDrawableDto
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } => ({
  x: drawable.bounds.x,
  y: drawable.bounds.y,
  width: Math.max(drawable.bounds.width, 0.5),
  height: Math.max(drawable.bounds.height, 0.5)
});

const createEmptyText = (text: string): SVGTextElement => {
  const label = document.createElementNS(svgNamespace, "text");
  label.setAttribute("x", "64");
  label.setAttribute("y", "64");
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("dominant-baseline", "middle");
  label.textContent = text;
  return label;
};

const resolvePreviewViewBox = (
  preview: EditorPreviewProjectionDto
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } => {
  if (preview.canvasSize !== undefined) {
    return {
      x: 0,
      y: 0,
      width: preview.canvasSize.width,
      height: preview.canvasSize.height
    };
  }

  const bounds = preview.drawables.map((drawable) => drawable.bounds);
  const minX = Math.min(...bounds.map((bound) => bound.x));
  const minY = Math.min(...bounds.map((bound) => bound.y));
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));
  const padding = 8;

  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(maxX - minX + padding * 2, 1),
    height: Math.max(maxY - minY + padding * 2, 1)
  };
};
