import type {
  EditorPreviewDrawableDto,
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

  for (const drawable of preview.drawables) {
    if (!drawable.visible) {
      continue;
    }

    svg.append(createDrawableShape(drawable));
  }

  return svg;
};

const createDrawableShape = (drawable: EditorPreviewDrawableDto): SVGElement => {
  const points = drawable.geometry.polygonPoints;

  if (points !== undefined && points.length >= 3) {
    const polygon = document.createElementNS(svgNamespace, "polygon");
    polygon.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
    applyDrawableShapeAttributes(polygon, drawable);
    return polygon;
  }

  const rect = document.createElementNS(svgNamespace, "rect");
  rect.setAttribute("x", String(drawable.bounds.x));
  rect.setAttribute("y", String(drawable.bounds.y));
  rect.setAttribute("width", String(Math.max(drawable.bounds.width, 0.5)));
  rect.setAttribute("height", String(Math.max(drawable.bounds.height, 0.5)));
  applyDrawableShapeAttributes(rect, drawable);
  return rect;
};

const applyDrawableShapeAttributes = (
  element: SVGElement,
  drawable: EditorPreviewDrawableDto
): void => {
  element.setAttribute("data-drawable-id", drawable.drawableId);
  element.setAttribute("fill", "#4c8d87");
  element.setAttribute("stroke", "#1f2a2e");
  element.setAttribute("stroke-width", "1.5");
  element.setAttribute("vector-effect", "non-scaling-stroke");
  element.setAttribute("opacity", String(drawable.opacity));
};

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
