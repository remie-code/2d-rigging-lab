import { DrawableIdSchema, MeshIdSchema } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createPerceptionFixture,
  registerTextureBytesWithoutDimensions,
  registerTextureWithDimensions
} from "../test-support/perception-fixtures.js";
import {
  resolveRenderTextureSources,
  resolveTextureDimensionSources,
  TextureResolutionError
} from "./texture-resolution.js";

/**
 * §3.4 revised (2026-07-03) "derived-verified" ladder rung tests.
 *
 * The derivation source is the referencing drawable's REST mesh bounds. The
 * expectations are established independently: the fixture mesh bounds are read
 * from the session graph, and the registered byte length is constructed to
 * match (positive) or miss (negative) `width*height*4` exactly.
 */

const meshBoundsFor = (
  session: ReturnType<typeof createPerceptionFixture>["session"],
  drawableId: string
): { readonly width: number; readonly height: number } => {
  const drawable = session.graph.drawables.find((entry) => entry.drawableId === drawableId);
  if (drawable === undefined) {
    throw new Error(`fixture drawable ${drawableId} missing`);
  }
  const mesh = session.graph.meshes.find((entry) => entry.meshId === drawable.meshId);
  if (mesh === undefined) {
    throw new Error(`fixture mesh for ${drawableId} missing`);
  }
  return { width: mesh.bounds.width, height: mesh.bounds.height };
};

const eyeTextureId = "tex_tutorial_eye";

describe("texture dimension derivation (§3.4 revised)", () => {
  it("derives and verifies dimensions from the referencing drawable's mesh bounds", () => {
    const { session, ids } = createPerceptionFixture();
    const bounds = meshBoundsFor(session, ids.eyeDrawableId);
    // Precondition of the derivation: the fixture mesh bounds are integer.
    expect(Number.isInteger(bounds.width)).toBe(true);
    expect(Number.isInteger(bounds.height)).toBe(true);

    registerTextureBytesWithoutDimensions(
      session,
      eyeTextureId,
      bounds.width * bounds.height * 4
    );

    const [source] = resolveRenderTextureSources({
      session,
      textureIds: [eyeTextureId]
    });
    expect(source?.width).toBe(bounds.width);
    expect(source?.height).toBe(bounds.height);

    const [record] = resolveTextureDimensionSources({
      session,
      textureIds: [eyeTextureId]
    });
    expect(record).toEqual({
      textureId: eyeTextureId,
      dimensionSource: "derived-verified",
      width: bounds.width,
      height: bounds.height
    });
  });

  it("rejects deterministically when the derived candidate does not match the byte length", () => {
    const { session, ids } = createPerceptionFixture();
    const bounds = meshBoundsFor(session, ids.eyeDrawableId);

    // Off by one pixel: candidate exists but byteLength verification fails.
    registerTextureBytesWithoutDimensions(
      session,
      eyeTextureId,
      bounds.width * bounds.height * 4 + 4
    );

    const attempt = () =>
      resolveRenderTextureSources({ session, textureIds: [eyeTextureId] });
    expect(attempt).toThrowError(TextureResolutionError);
    try {
      attempt();
      throw new Error("expected rejection");
    } catch (error) {
      expect((error as TextureResolutionError).code).toBe("byteLengthMismatch");
    }
  });

  it("rejects deterministically when no integer mesh-bounds candidate exists", () => {
    const { session, ids } = createPerceptionFixture();
    const drawable = session.graph.drawables.find(
      (entry) => entry.drawableId === ids.eyeDrawableId
    );
    const mesh = session.graph.meshes.find((entry) => entry.meshId === drawable?.meshId);
    if (mesh === undefined) {
      throw new Error("fixture mesh missing");
    }
    // A non-integer bound is not a pixel-dimension claim: no candidate.
    mesh.bounds = { ...mesh.bounds, width: mesh.bounds.width + 0.5 };

    registerTextureBytesWithoutDimensions(session, eyeTextureId, 64);

    try {
      resolveRenderTextureSources({ session, textureIds: [eyeTextureId] });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(TextureResolutionError);
      expect((error as TextureResolutionError).code).toBe("missingDimensions");
    }
  });

  it("rejects deterministically when multiple distinct candidates verify (ambiguous)", () => {
    const { session, ids } = createPerceptionFixture();
    const drawable = session.graph.drawables.find(
      (entry) => entry.drawableId === ids.eyeDrawableId
    );
    const mesh = session.graph.meshes.find((entry) => entry.meshId === drawable?.meshId);
    if (drawable === undefined || mesh === undefined) {
      throw new Error("fixture graph entries missing");
    }
    // Force two referencing drawables with different integer shapes of equal
    // area (4x4 and 8x2 → both satisfy byteLength = 64): the candidate set is
    // indeterminate, so the resolver must reject rather than guess.
    mesh.bounds = { ...mesh.bounds, width: 4, height: 4 };
    const ambiguousMeshId = MeshIdSchema.parse("mesh_ambiguous_shape");
    const secondMesh = {
      ...mesh,
      meshId: ambiguousMeshId,
      bounds: { ...mesh.bounds, width: 8, height: 2 }
    };
    session.graph.meshes.push(secondMesh);
    session.graph.drawables.push({
      ...drawable,
      drawableId: DrawableIdSchema.parse("draw_ambiguous_shape"),
      meshId: ambiguousMeshId
    });

    registerTextureBytesWithoutDimensions(session, eyeTextureId, 64);

    try {
      resolveRenderTextureSources({ session, textureIds: [eyeTextureId] });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(TextureResolutionError);
      expect((error as TextureResolutionError).code).toBe("missingDimensions");
      expect((error as TextureResolutionError).detail).toContain("ambiguous");
    }
  });

  it("prefers declared dimensions over derivation and reports dimensionSource=declared", () => {
    const { session } = createPerceptionFixture();
    // Declared 4x4 with matching bytes (fixture default) — even though a mesh
    // bounds candidate may also exist, the declared rung wins.
    registerTextureWithDimensions(session, eyeTextureId, { width: 4, height: 4 });

    const [record] = resolveTextureDimensionSources({
      session,
      textureIds: [eyeTextureId]
    });
    expect(record?.dimensionSource).toBe("declared");
    expect(record?.width).toBe(4);
    expect(record?.height).toBe(4);
  });
});
