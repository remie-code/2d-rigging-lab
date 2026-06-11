import type { NodeChild } from "@webtoon/psd";
import { describe, expect, it } from "vitest";

import { isPsdNodeHiddenForEditorImport } from "./browser-psd-parser-adapter";

describe("browser PSD parser adapter hidden-state compatibility", () => {
  it("uses the public Layer isHidden flag when available", () => {
    expect(isPsdNodeHiddenForEditorImport(createPublicHiddenNode(true))).toBe(true);
    expect(isPsdNodeHiddenForEditorImport(createPublicHiddenNode(false))).toBe(false);
  });

  it("reads the @webtoon/psd Group private hidden flag when the public flag is absent", () => {
    expect(isPsdNodeHiddenForEditorImport(createPrivateGroupNode(true))).toBe(true);
    expect(isPsdNodeHiddenForEditorImport(createPrivateGroupNode(false))).toBe(false);
  });

  it("falls back to visible when the private Group shape is absent", () => {
    expect(isPsdNodeHiddenForEditorImport(createGroupNodeWithoutPrivateShape())).toBe(false);
  });
});

function createPublicHiddenNode(isHidden: boolean): NodeChild {
  return {
    type: "Layer",
    isHidden
  } as unknown as NodeChild;
}

function createPrivateGroupNode(hidden: boolean): NodeChild {
  return {
    type: "Group",
    layerFrame: {
      layerProperties: {
        hidden
      }
    }
  } as unknown as NodeChild;
}

function createGroupNodeWithoutPrivateShape(): NodeChild {
  return {
    type: "Group"
  } as unknown as NodeChild;
}
