import { encodeRgba8ToPng } from "@private-2d-rigging-lab/render-software";

/**
 * Contact-sheet composition (Wave104 Domain A, §3.2).
 *
 * Composites N equally sized RGBA8 cell buffers into a single grid image and
 * PNG-encodes it. The grid layout is deterministic: a near-square column count
 * derived only from the cell count, filled left-to-right, top-to-bottom. Empty
 * trailing grid slots stay transparent.
 */

export interface ContactSheetCell {
  /** Straight-alpha RGBA8, row-major, top-left origin. */
  readonly rgba8: Uint8Array;
}

export interface ContactSheetLayout {
  readonly columns: number;
  readonly rows: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly sheetWidth: number;
  readonly sheetHeight: number;
}

export interface ContactSheetResult {
  readonly png: Uint8Array;
  readonly rgba8: Uint8Array;
  readonly layout: ContactSheetLayout;
}

/** Deterministic near-square column count for `cellCount` cells. */
export const contactSheetColumns = (cellCount: number): number =>
  Math.max(1, Math.ceil(Math.sqrt(cellCount)));

export const composeContactSheet = (input: {
  readonly cells: readonly ContactSheetCell[];
  readonly cellWidth: number;
  readonly cellHeight: number;
}): ContactSheetResult => {
  const { cells, cellWidth, cellHeight } = input;
  if (cells.length === 0) {
    throw new Error("composeContactSheet requires at least one cell.");
  }

  const columns = contactSheetColumns(cells.length);
  const rows = Math.ceil(cells.length / columns);
  const sheetWidth = columns * cellWidth;
  const sheetHeight = rows * cellHeight;

  const sheet = new Uint8Array(sheetWidth * sheetHeight * 4);
  const cellRowBytes = cellWidth * 4;
  const sheetRowBytes = sheetWidth * 4;

  cells.forEach((cell, cellIndex) => {
    const expectedLength = cellWidth * cellHeight * 4;
    if (cell.rgba8.byteLength !== expectedLength) {
      throw new Error(
        `Contact-sheet cell ${cellIndex} has ${cell.rgba8.byteLength} bytes; expected ${expectedLength} (${cellWidth}x${cellHeight}x4).`
      );
    }

    const column = cellIndex % columns;
    const row = Math.floor(cellIndex / columns);
    const originX = column * cellWidth;
    const originY = row * cellHeight;

    for (let cellRow = 0; cellRow < cellHeight; cellRow += 1) {
      const sourceOffset = cellRow * cellRowBytes;
      const destOffset = (originY + cellRow) * sheetRowBytes + originX * 4;
      sheet.set(cell.rgba8.subarray(sourceOffset, sourceOffset + cellRowBytes), destOffset);
    }
  });

  return {
    png: encodeRgba8ToPng(sheet, sheetWidth, sheetHeight),
    rgba8: sheet,
    layout: { columns, rows, cellWidth, cellHeight, sheetWidth, sheetHeight }
  };
};
