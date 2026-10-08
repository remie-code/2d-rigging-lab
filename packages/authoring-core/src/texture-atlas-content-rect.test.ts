import { describe, expect, it } from "vitest";

import {
  ZERO_CONTENT_INSET,
  deriveContentSubRectUv
} from "./texture-atlas-content-rect.js";

describe("deriveContentSubRectUv", () => {
  it("normalizes the whole content rect when the inset is undefined (zero inset)", () => {
    const uvRect = deriveContentSubRectUv({
      contentRect: { x: 1, y: 1, width: 2, height: 2 },
      contentInset: undefined,
      pageWidth: 8,
      pageHeight: 4
    });

    expect(uvRect).toEqual({
      topLeft: { x: 1 / 8, y: 1 / 4 },
      bottomRight: { x: 3 / 8, y: 3 / 4 }
    });
  });

  it("treats an explicit zero inset identically to undefined", () => {
    const contentRect = { x: 2, y: 2, width: 4, height: 2 } as const;

    expect(
      deriveContentSubRectUv({ contentRect, contentInset: ZERO_CONTENT_INSET, pageWidth: 8, pageHeight: 8 })
    ).toEqual(
      deriveContentSubRectUv({ contentRect, contentInset: undefined, pageWidth: 8, pageHeight: 8 })
    );
  });

  it("insets each side and then normalizes to the content sub-rect", () => {
    // contentRect (2,2,4,4) inset by {left:1,top:0,right:1,bottom:2} → (3,2,2,2).
    const uvRect = deriveContentSubRectUv({
      contentRect: { x: 2, y: 2, width: 4, height: 4 },
      contentInset: { left: 1, top: 0, right: 1, bottom: 2 },
      pageWidth: 12,
      pageHeight: 12
    });

    expect(uvRect).toEqual({
      topLeft: { x: 3 / 12, y: 2 / 12 },
      bottomRight: { x: 5 / 12, y: 4 / 12 }
    });
  });

  it("matches the historical packing float order exactly (real-data-scale inset)", () => {
    // 4096 page, content placed at (17,17) sized 512, symmetric 17px inset —
    // the claude-chan topwear shape the old preflight contract falsely blocked.
    const contentRect = { x: 17, y: 17, width: 512, height: 512 } as const;
    const inset = { left: 17, top: 17, right: 17, bottom: 17 } as const;

    const uvRect = deriveContentSubRectUv({
      contentRect,
      contentInset: inset,
      pageWidth: 4096,
      pageHeight: 4096
    });

    // Reproduce the exact packing computation (pixel-space inset, then divide).
    const contentUvRect = {
      x: contentRect.x + inset.left,
      y: contentRect.y + inset.top,
      width: contentRect.width - inset.left - inset.right,
      height: contentRect.height - inset.top - inset.bottom
    };
    expect(uvRect).toEqual({
      topLeft: {
        x: contentUvRect.x / 4096,
        y: contentUvRect.y / 4096
      },
      bottomRight: {
        x: (contentUvRect.x + contentUvRect.width) / 4096,
        y: (contentUvRect.y + contentUvRect.height) / 4096
      }
    });
  });
});
