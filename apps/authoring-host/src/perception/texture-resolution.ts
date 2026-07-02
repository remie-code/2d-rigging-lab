import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { RenderRgba8TextureSource } from "@private-2d-rigging-lab/render-core";
import { createRgba8TextureContentSignature } from "@private-2d-rigging-lab/render-core";

/**
 * Texture supply for perception rendering (Wave104 Domain A, §3.4; derivation
 * ladder added by Domain C under the 2026-07-03 §3.4 revision).
 *
 * Resolves the raw RGBA8 bytes and verified pixel dimensions for a drawable's
 * texture directly from the session (Atlas commit is NOT a precondition, per
 * §3.2 — the per-texture atlas ENTRY carries dimensions + binaryAssetRef
 * independently of any committed atlas layout).
 *
 * Dimension source policy (§3.4, revised 2026-07-03): the essence of §3.4 is
 * "no SILENT estimation", not "no value but a declared one". The resolution
 * ladder is:
 *
 *  1. `declared` — the texture entry's explicit `dimensions` (highest priority,
 *     unchanged from Domain A). `bytes.byteLength === width*height*4` is still
 *     mandatory; mismatch rejects deterministically.
 *  2. `derived-verified` — when the entry has no declared dimensions, candidate
 *     (width, height) pairs are derived from the package's own authoritative
 *     boundary information: the REST mesh bounds of the drawable(s) referencing
 *     the texture (integer, positive). A candidate is adopted ONLY when
 *     `bytes.byteLength === width*height*4` holds exactly and exactly one
 *     distinct verified candidate remains. No match → deterministic reject
 *     (`byteLengthMismatch`); no candidate / ambiguous candidates →
 *     deterministic reject (`missingDimensions`).
 *
 * The adopted source kind (`declared` / `derived-verified`) is exposed via
 * {@link resolveTextureDimensionSources} so renderView can record it in the
 * sidecar / result metadata — the derivation is verified AND announced, never
 * silent. Unverified bounds estimation remains forbidden.
 */

export type TextureResolutionRejectionCode =
  | "missingTextureId"
  | "missingTextureEntry"
  | "missingDimensions"
  | "missingBinaryRef"
  | "missingBytes"
  | "byteLengthMismatch";

/** How the adopted pixel dimensions were established (§3.4 revised ladder). */
export type TextureDimensionSourceKind = "declared" | "derived-verified";

export interface TextureDimensionSourceRecord {
  readonly textureId: string;
  readonly dimensionSource: TextureDimensionSourceKind;
  readonly width: number;
  readonly height: number;
}

export class TextureResolutionError extends Error {
  readonly code: TextureResolutionRejectionCode;
  readonly textureId: string;
  readonly detail: string;

  constructor(input: {
    readonly code: TextureResolutionRejectionCode;
    readonly textureId: string;
    readonly detail: string;
  }) {
    super(
      `Texture resolution rejected for texture "${input.textureId}" (${input.code}): ${input.detail}`
    );
    this.name = "TextureResolutionError";
    this.code = input.code;
    this.textureId = input.textureId;
    this.detail = input.detail;
  }
}

/**
 * Resolve every distinct drawable texture referenced by the graph into a
 * deterministic list of RGBA8 render texture sources (sorted by textureId).
 * Throws {@link TextureResolutionError} on the first inconsistency so a stale or
 * mis-sized texture never renders as a silent guess.
 */
export const resolveRenderTextureSources = (input: {
  readonly session: AuthoringSession;
  readonly textureIds: readonly string[];
}): readonly RenderRgba8TextureSource[] => {
  const distinctTextureIds = [...new Set(input.textureIds)].sort((left, right) =>
    left.localeCompare(right)
  );

  return distinctTextureIds.map((textureId) =>
    resolveRenderTextureSource({ session: input.session, textureId })
  );
};

/**
 * Resolve the adopted dimension-source records for the given textures, sorted
 * by textureId. This runs the exact same §3.4 ladder as texture-source
 * resolution (same rejects), so a record exists if and only if the texture
 * would render. renderView uses this to record `declared` / `derived-verified`
 * per texture in the sidecar.
 */
export const resolveTextureDimensionSources = (input: {
  readonly session: AuthoringSession;
  readonly textureIds: readonly string[];
}): readonly TextureDimensionSourceRecord[] => {
  const distinctTextureIds = [...new Set(input.textureIds)].sort((left, right) =>
    left.localeCompare(right)
  );

  return distinctTextureIds.map((textureId) => {
    const resolved = resolveTextureEntry({ session: input.session, textureId });
    return {
      textureId,
      dimensionSource: resolved.dimensionSource,
      width: resolved.width,
      height: resolved.height
    };
  });
};

interface ResolvedTextureEntry {
  readonly width: number;
  readonly height: number;
  readonly dimensionSource: TextureDimensionSourceKind;
  readonly bytes: Uint8Array;
  readonly binaryAssetId: string;
  readonly binaryAssetPath: string;
  readonly sourceLayerId?: string;
}

const resolveRenderTextureSource = (input: {
  readonly session: AuthoringSession;
  readonly textureId: string;
}): RenderRgba8TextureSource => {
  const resolved = resolveTextureEntry(input);
  const bytes = new Uint8Array(resolved.bytes);

  return {
    kind: "rgba8",
    textureId: input.textureId,
    width: resolved.width,
    height: resolved.height,
    bytes,
    alphaMode: "straight",
    contentSignature: createRgba8TextureContentSignature({
      textureId: input.textureId,
      width: resolved.width,
      height: resolved.height,
      bytes
    }),
    source: {
      binaryAssetId: resolved.binaryAssetId,
      binaryAssetPath: resolved.binaryAssetPath,
      ...(resolved.sourceLayerId === undefined
        ? {}
        : { sourceLayerId: resolved.sourceLayerId })
    }
  };
};

const resolveTextureEntry = (input: {
  readonly session: AuthoringSession;
  readonly textureId: string;
}): ResolvedTextureEntry => {
  const { session, textureId } = input;

  const textureEntry = session.graph.textureAtlas?.textures.find(
    (entry) => entry.textureId === textureId
  );
  if (textureEntry === undefined) {
    throw new TextureResolutionError({
      code: "missingTextureEntry",
      textureId,
      detail: "no texture atlas entry declares this textureId"
    });
  }

  // Ladder rung 1 (declared): behavior identical to Domain A's original path
  // (missingBinaryRef / missingBytes / byteLengthMismatch fire in the original
  // order).
  if (textureEntry.dimensions !== undefined) {
    const { bytes, binaryAssetId, binaryAssetPath } = resolveTextureBytes({
      session,
      textureId,
      textureEntry
    });
    const declaredWidth = textureEntry.dimensions.width;
    const declaredHeight = textureEntry.dimensions.height;
    assertExactByteLength({
      textureId,
      width: declaredWidth,
      height: declaredHeight,
      byteLength: bytes.byteLength
    });

    return {
      width: declaredWidth,
      height: declaredHeight,
      dimensionSource: "declared",
      bytes,
      binaryAssetId,
      binaryAssetPath,
      ...(textureEntry.sourceLayerId === undefined
        ? {}
        : { sourceLayerId: textureEntry.sourceLayerId })
    };
  }

  // Ladder rung 2 (derived-verified): candidates from the rest mesh bounds of
  // the drawable(s) that reference this texture.
  const candidates = deriveDimensionCandidates(session, textureId);
  if (candidates.length === 0) {
    throw new TextureResolutionError({
      code: "missingDimensions",
      textureId,
      detail:
        "texture entry has no declared dimensions and no integer-sized mesh bounds candidate could be derived; unverified estimates are not accepted (§3.4)"
    });
  }

  const { bytes, binaryAssetId, binaryAssetPath } = resolveTextureBytes({
    session,
    textureId,
    textureEntry
  });

  const verified = dedupeCandidates(
    candidates.filter(
      (candidate) => candidate.width * candidate.height * 4 === bytes.byteLength
    )
  );
  if (verified.length === 0) {
    throw new TextureResolutionError({
      code: "byteLengthMismatch",
      textureId,
      detail:
        `no derived candidate matches the byte length: candidates [${formatCandidates(candidates)}], ` +
        `got ${bytes.byteLength} bytes (§3.4 derived candidates must satisfy width*height*4 exactly)`
    });
  }
  if (verified.length > 1) {
    throw new TextureResolutionError({
      code: "missingDimensions",
      textureId,
      detail:
        `derived dimension candidates are ambiguous: [${formatCandidates(verified)}] all match ` +
        `${bytes.byteLength} bytes; an indeterminate candidate set is rejected (§3.4)`
    });
  }

  const adopted = verified[0]!;

  return {
    width: adopted.width,
    height: adopted.height,
    dimensionSource: "derived-verified",
    bytes,
    binaryAssetId,
    binaryAssetPath,
    ...(textureEntry.sourceLayerId === undefined
      ? {}
      : { sourceLayerId: textureEntry.sourceLayerId })
  };
};

interface DimensionCandidate {
  readonly width: number;
  readonly height: number;
}

/**
 * Candidate (width, height) pairs derived from authoritative package boundary
 * information: the REST mesh bounds of every drawable referencing the texture.
 * Only exact integer, positive bounds qualify — a non-integer bound is not a
 * pixel-dimension claim. (Chosen after bounded verification against ref/: all
 * 126 per-layer textures have exactly one referencing drawable whose mesh
 * bounds are integer and satisfy byteLength === w*h*4.)
 */
const deriveDimensionCandidates = (
  session: AuthoringSession,
  textureId: string
): readonly DimensionCandidate[] => {
  const meshById = new Map(session.graph.meshes.map((mesh) => [mesh.meshId, mesh]));
  const candidates: DimensionCandidate[] = [];

  for (const drawable of session.graph.drawables) {
    if (drawable.textureId !== textureId) {
      continue;
    }
    const mesh = meshById.get(drawable.meshId);
    if (mesh === undefined) {
      continue;
    }
    const bounds = mesh.bounds;
    if (
      Number.isInteger(bounds.width) &&
      Number.isInteger(bounds.height) &&
      bounds.width > 0 &&
      bounds.height > 0
    ) {
      candidates.push({ width: bounds.width, height: bounds.height });
    }
  }

  return candidates;
};

const dedupeCandidates = (
  candidates: readonly DimensionCandidate[]
): readonly DimensionCandidate[] => [
  ...new Map(
    candidates.map((candidate) => [`${candidate.width}x${candidate.height}`, candidate])
  ).values()
];

const formatCandidates = (candidates: readonly DimensionCandidate[]): string =>
  candidates.map((candidate) => `${candidate.width}x${candidate.height}`).join(", ");

const resolveTextureBytes = (input: {
  readonly session: AuthoringSession;
  readonly textureId: string;
  readonly textureEntry: {
    // `| undefined` is required for exactOptionalPropertyTypes compatibility
    // with the package-format texture entry type (type-only; no runtime effect).
    readonly binaryAssetRef?:
      | {
          readonly binaryAssetId: string;
          readonly packageRelativePath: string;
        }
      | undefined;
  };
}): {
  readonly bytes: Uint8Array;
  readonly binaryAssetId: string;
  readonly binaryAssetPath: string;
} => {
  const binaryAssetRef = input.textureEntry.binaryAssetRef;
  if (binaryAssetRef === undefined) {
    throw new TextureResolutionError({
      code: "missingBinaryRef",
      textureId: input.textureId,
      detail: "texture entry has no binaryAssetRef"
    });
  }

  const binaryEntry = input.session.binaryAssets?.fileEntries.find(
    (entry) =>
      entry.path === binaryAssetRef.packageRelativePath &&
      entry.binaryAssetId === binaryAssetRef.binaryAssetId
  );
  if (binaryEntry === undefined) {
    throw new TextureResolutionError({
      code: "missingBytes",
      textureId: input.textureId,
      detail: `no loaded bytes for path "${binaryAssetRef.packageRelativePath}"`
    });
  }

  return {
    bytes: binaryEntry.bytes,
    binaryAssetId: binaryAssetRef.binaryAssetId,
    binaryAssetPath: binaryAssetRef.packageRelativePath
  };
};

const assertExactByteLength = (input: {
  readonly textureId: string;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
}): void => {
  const expectedByteLength = input.width * input.height * 4;
  if (!Number.isSafeInteger(expectedByteLength) || input.byteLength !== expectedByteLength) {
    throw new TextureResolutionError({
      code: "byteLengthMismatch",
      textureId: input.textureId,
      detail: `expected ${input.width}x${input.height}x4 = ${expectedByteLength} bytes, got ${input.byteLength}`
    });
  }
};
