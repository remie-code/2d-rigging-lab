export const formatBoundsLabel = (bounds: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): string =>
  `${formatPreviewNumber(bounds.x)}, ${formatPreviewNumber(bounds.y)} / ${formatPreviewNumber(bounds.width)} x ${formatPreviewNumber(bounds.height)}`;

export const formatPreviewNumber = (value: number): string =>
  Number.isInteger(value) ? `${value}` : Number.parseFloat(value.toFixed(4)).toString();
