import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  imagePixelToStagePoint,
  resolveSoftwareRenderView,
  stagePointToImagePixel
} from "@private-2d-rigging-lab/render-software";

import {
  createEmptyParameterPerceptionFixture,
  createPerceptionFixture,
  registerTextureWithDimensions
} from "../test-support/perception-fixtures.js";
import { evaluatePerceptionSnapshot } from "./evaluation-adapter.js";
import { evaluatedDrawableBounds } from "./evaluated-bounds.js";
import { renderPerceptionView } from "./render-view-command.js";
import { resolvePerceptionRenderView } from "./view-resolution.js";
import { TextureResolutionError } from "./texture-resolution.js";

const png = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");

interface DecodedRgba {
  readonly width: number;
  readonly height: number;
  readonly rgba8: Uint8Array;
}

/**
 * Minimal PNG decoder for the exact subset render-software emits (8-bit, color
 * type 6 RGBA, no interlace, filter type 0 rows). Kept local so the test can
 * probe individual contact-sheet cells without depending on render-software
 * test-only internals.
 */
const decodePng = (bytes: Uint8Array): DecodedRgba => {
  let offset = 8; // skip 8-byte PNG signature
  let width = 0;
  let height = 0;
  const idatParts: Uint8Array[] = [];

  const readUint32 = (at: number): number =>
    (((bytes[at] ?? 0) << 24) |
      ((bytes[at + 1] ?? 0) << 16) |
      ((bytes[at + 2] ?? 0) << 8) |
      (bytes[at + 3] ?? 0)) >>>
    0;

  while (offset < bytes.length) {
    const length = readUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4] ?? 0,
      bytes[offset + 5] ?? 0,
      bytes[offset + 6] ?? 0,
      bytes[offset + 7] ?? 0
    );
    const dataStart = offset + 8;
    const data = bytes.subarray(dataStart, dataStart + length);
    if (type === "IHDR") {
      width = readUint32(dataStart);
      height = readUint32(dataStart + 4);
    } else if (type === "IDAT") {
      idatParts.push(new Uint8Array(data));
    } else if (type === "IEND") {
      break;
    }
    offset = dataStart + length + 4; // skip data + CRC
  }

  const idatTotal = idatParts.reduce((sum, part) => sum + part.length, 0);
  const idat = new Uint8Array(idatTotal);
  let idatOffset = 0;
  for (const part of idatParts) {
    idat.set(part, idatOffset);
    idatOffset += part.length;
  }

  const raw = new Uint8Array(inflateSync(idat));
  const rowBytes = width * 4;
  const rgba8 = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const rawRowStart = y * (rowBytes + 1);
    const filterType = raw[rawRowStart] ?? 0;
    if (filterType !== 0) {
      throw new Error(`Test decoder only supports filter type 0; got ${filterType}.`);
    }
    rgba8.set(raw.subarray(rawRowStart + 1, rawRowStart + 1 + rowBytes), y * rowBytes);
  }

  return { width, height, rgba8 };
};

/** Extracts the row-major RGBA8 bytes of one contact-sheet cell. */
const extractCellRgba8 = (
  decoded: DecodedRgba,
  cell: { readonly column: number; readonly row: number },
  cellWidth: number,
  cellHeight: number
): Uint8Array => {
  const out = new Uint8Array(cellWidth * cellHeight * 4);
  const originX = cell.column * cellWidth;
  const originY = cell.row * cellHeight;
  for (let y = 0; y < cellHeight; y += 1) {
    const srcRowStart = ((originY + y) * decoded.width + originX) * 4;
    out.set(
      decoded.rgba8.subarray(srcRowStart, srcRowStart + cellWidth * 4),
      y * cellWidth * 4
    );
  }
  return out;
};

describe("renderPerceptionView", () => {
  it("renders a deterministic rest-pose PNG (byte-identical across two runs)", () => {
    const first = renderPerceptionView({
      session: createPerceptionFixture().session,
      payload: { parameterOverrides: {}, outDir: "unused", outputName: "render" }
    });
    const second = renderPerceptionView({
      session: createPerceptionFixture().session,
      payload: { parameterOverrides: {}, outDir: "unused", outputName: "render" }
    });

    expect(first.png.byteLength).toBeGreaterThan(0);
    // Determinism: identical package state + identical request -> byte-identical PNG.
    expect(png(first.png)).toBe(png(second.png));
  });

  it("reflects parameterOverrides in the rendered pixels", () => {
    const { session, ids } = createPerceptionFixture();
    // The fixture binds both drawables' opacity to `eyeRegionOpacityParameterId`
    // (min -> fully transparent, max == default -> fully opaque). At rest (no
    // override) everything is fully opaque; overriding the parameter to its min
    // fades the model out, so the two renders MUST differ pixel-for-pixel.
    const rest = renderPerceptionView({
      session,
      payload: { parameterOverrides: {}, outDir: "unused", outputName: "render" }
    });
    const overridden = renderPerceptionView({
      session,
      payload: {
        parameterOverrides: { [ids.eyeRegionOpacityParameterId]: -1 },
        outDir: "unused",
        outputName: "render"
      }
    });

    expect(rest.png.byteLength).toBeGreaterThan(0);
    expect(overridden.png.byteLength).toBeGreaterThan(0);
    // Load-bearing assertion: the override changes the eye's opacity, so the
    // encoded PNG bytes differ from the rest render. Were the fixture free of
    // parameter-driven deformation (as it was before), these would be equal.
    expect(png(overridden.png)).not.toBe(png(rest.png));
  });

  it("frames a drawable focus from its evaluated bbox with the given margin (numeric)", () => {
    const { session, ids } = createPerceptionFixture();
    const { snapshot } = evaluatePerceptionSnapshot(session);
    const bounds = evaluatedDrawableBounds(snapshot, ids.eyeDrawableId);
    expect(bounds).toBeDefined();
    const rect = bounds!.bounds;

    const marginRatio = 0.25;
    const view = resolvePerceptionRenderView({
      snapshot,
      view: { kind: "drawableFocus", drawableId: ids.eyeDrawableId, marginRatio },
      outputWidth: 200,
      outputHeight: 200
    });

    // Expected viewport computed independently from the known bbox and margin.
    const expectedMinX = rect.x - rect.width * marginRatio;
    const expectedMinY = rect.y - rect.height * marginRatio;
    const expectedWidth = rect.width * (1 + marginRatio * 2);
    const expectedHeight = rect.height * (1 + marginRatio * 2);

    expect(view.stageViewport.minX).toBeCloseTo(expectedMinX, 6);
    expect(view.stageViewport.minY).toBeCloseTo(expectedMinY, 6);
    expect(view.stageViewport.width).toBeCloseTo(expectedWidth, 6);
    expect(view.stageViewport.height).toBeCloseTo(expectedHeight, 6);
  });

  it("renders per-cell deformation into a contact sheet + sidecar cell map for a sweep", () => {
    const { session, ids } = createPerceptionFixture();
    // Sweep the eye-region-opacity parameter the fixture drives with keyforms,
    // so each cell renders a DIFFERENT opacity (min -> transparent ... max ->
    // opaque) instead of an identity image. Its min/max frame the endpoint cells.
    // (Resolved through the evaluated graph's keys to keep the branded id type.)
    const { graph: sweepGraph } = evaluatePerceptionSnapshot(session);
    const parameterId = [...sweepGraph.parameters.keys()].find(
      (key) => key === ids.eyeRegionOpacityParameterId
    )!;
    expect(parameterId).toBeDefined();
    const steps = 4;

    const result = renderPerceptionView({
      session,
      payload: {
        parameterOverrides: {},
        sweep: { parameterId, steps },
        outputWidth: 40,
        outputHeight: 40,
        outDir: "unused",
        outputName: "sweep"
      }
    });

    const sidecar = result.sidecar({ packagePath: "/pkg", pngPath: "/pkg/out/sweep.png" });
    expect(sidecar.sweep).toBeDefined();
    const sweep = sidecar.sweep!;

    // 4 cells -> 2 columns x 2 rows near-square grid.
    expect(sweep.columns).toBe(2);
    expect(sweep.rows).toBe(2);
    expect(sweep.cells).toHaveLength(steps);
    expect(result.outputWidth).toBe(sweep.columns * sweep.cellWidth);
    expect(result.outputHeight).toBe(sweep.rows * sweep.cellHeight);

    // Cell 0 = min endpoint, last cell = max endpoint; grid positions follow
    // left-to-right, top-to-bottom.
    const parameter = sweepGraph.parameters.get(parameterId);
    expect(parameter).toBeDefined();
    expect(sweep.cells[0]!.parameterValue).toBeCloseTo(parameter!.min, 6);
    expect(sweep.cells[steps - 1]!.parameterValue).toBeCloseTo(parameter!.max, 6);
    expect(sweep.cells.every((cell) => cell.parameterId === parameterId)).toBe(true);
    expect(sweep.cells[0]).toMatchObject({ cellIndex: 0, column: 0, row: 0 });
    expect(sweep.cells[3]).toMatchObject({ cellIndex: 3, column: 1, row: 1 });

    // Load-bearing pixel assertion: adjacent cells hold DIFFERENT parameter
    // values and therefore different eye-region opacity, so their decoded RGBA8
    // regions must differ. Before the fixture carried keyforms, every cell was
    // an identical (identity) image and this comparison would have been equal.
    const decoded = decodePng(result.png);
    const cellRgba8 = sweep.cells.map((cell) =>
      extractCellRgba8(decoded, cell, sweep.cellWidth, sweep.cellHeight)
    );
    for (let index = 1; index < cellRgba8.length; index += 1) {
      expect(
        Buffer.from(cellRgba8[index]!).equals(Buffer.from(cellRgba8[index - 1]!))
      ).toBe(false);
    }
  });

  it("records a numerically correct view transform in the sidecar", () => {
    const { session } = createPerceptionFixture();
    const result = renderPerceptionView({
      session,
      payload: {
        parameterOverrides: {},
        view: { kind: "stageViewport", stageViewport: { minX: 10, minY: 20, width: 80, height: 40 } },
        outputWidth: 160,
        outputHeight: 40,
        outDir: "unused",
        outputName: "render"
      }
    });

    const sidecar = result.sidecar({ packagePath: "/pkg", pngPath: "/pkg/out/render.png" });
    const resolved = sidecar.resolvedView;

    // pixelsPerStage derived from the known viewport: 160/80 = 2, 40/40 = 1.
    expect(resolved.pixelsPerStageX).toBeCloseTo(2, 9);
    expect(resolved.pixelsPerStageY).toBeCloseTo(1, 9);
    expect(resolved.stageViewport).toEqual({ minX: 10, minY: 20, width: 80, height: 40 });

    // The recorded transform must round-trip a known stage point to the pixel it
    // maps to and back. Rebuild the resolved view from the sidecar numbers.
    const rebuilt = resolveSoftwareRenderView({
      stageViewport: resolved.stageViewport,
      outputWidth: resolved.outputWidth,
      outputHeight: resolved.outputHeight
    });
    // Stage (50, 40) -> pixel ((50-10)*2, (40-20)*1) = (80, 20).
    const pixel = stagePointToImagePixel(rebuilt, { x: 50, y: 40 });
    expect(pixel.x).toBeCloseTo(80, 9);
    expect(pixel.y).toBeCloseTo(20, 9);
    const roundTrip = imagePixelToStagePoint(rebuilt, pixel);
    expect(roundTrip.x).toBeCloseTo(50, 9);
    expect(roundTrip.y).toBeCloseTo(40, 9);
  });

  it("renders a rest pose for a package that declares no parameters", () => {
    const { session } = createEmptyParameterPerceptionFixture();
    // The package declares no authored parameters (the runtime graph still gets
    // the project preset parameter surface). Rest-pose evaluation + render must
    // succeed without any parameter override being supplied.
    expect(session.graph.parameters).toHaveLength(0);

    const result = renderPerceptionView({
      session,
      payload: { parameterOverrides: {}, outDir: "unused", outputName: "render" }
    });
    expect(result.png.byteLength).toBeGreaterThan(0);
  });

  it("rejects a texture whose byteLength does not match its declared dimensions (§3.4)", () => {
    const { session, ids } = createPerceptionFixture();
    // Corrupt the eye texture: declare 8x8 (256 bytes) but keep a mismatched
    // byte length. registerTextureWithDimensions with byteLengthOverride writes
    // deliberately inconsistent bytes.
    registerTextureWithDimensions(session, "tex_tutorial_eye", { width: 8, height: 8 }, {
      byteLengthOverride: 16
    });
    void ids;

    expect(() =>
      renderPerceptionView({
        session,
        payload: { parameterOverrides: {}, outDir: "unused", outputName: "render" }
      })
    ).toThrowError(TextureResolutionError);
  });
});
