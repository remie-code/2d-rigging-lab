import {
  PackageDocumentSchema,
  VARIANTS_FILE_SCHEMA_VERSION,
  VARIANTS_MODEL_FILE_PATH,
  type PackageDocumentDto,
  type PackageRightsSummaryDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import type { PackageDocumentEditorStateOptions } from "./package-document-editor-state.js";
import { toPackageDocument } from "./to-package-document.js";

export interface PackageDocumentFromAuthoringSessionOptions
  extends PackageDocumentEditorStateOptions {
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
}

export const createPackageDocumentBaseFromAuthoringSession = (
  session: AuthoringSession,
  options: PackageDocumentFromAuthoringSessionOptions = {}
): PackageDocumentDto => {
  const timestamp = toIsoString(options.createdAt ?? options.updatedAt);

  return PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: session.packageIdentity.packageId,
      packageDisplayName: session.packageIdentity.packageDisplayName,
      formatVersion: session.packageIdentity.formatVersion,
      packageRevision: session.packageRevision,
      createdAt: timestamp,
      updatedAt: toIsoString(options.updatedAt ?? timestamp),
      schemaVersions: {
        manifest: "open-model-package-manifest-v1",
        graph: "model-graph-v1",
        drawables: "drawables-file-v1",
        meshes: "meshes-file-v1",
        parameters: "parameters-file-v1",
        keyforms: "keyforms-file-v1",
        rigControls: "rig-controls-file-v1",
        dynamics: "dynamics-file-v3",
        masks: "masks-file-v1",
        drawOrder: "draw-order-file-v1",
        variants: VARIANTS_FILE_SCHEMA_VERSION,
        sourceManifest: "source-manifest-v1",
        textureAtlas: "texture-atlas-v1",
        provenance: "provenance-file-v1",
        rights: "rights-file-v1"
      },
      evaluatorVersions: {},
      modelFiles: {
        graph: "model/graph.json",
        drawables: "model/drawables.json",
        meshes: "model/meshes.json",
        parameters: "model/parameters.json",
        keyforms: "model/keyforms.json",
        rigControls: "model/rig-controls.json",
        dynamics: "model/dynamics.json",
        masks: "model/masks.json",
        drawOrder: "model/draw-order.json",
        variants: VARIANTS_MODEL_FILE_PATH
      },
      assetIndex: "assets/sources/source-manifest.json",
      operationLog: "operations/log.jsonl",
      rightsSummary: createRightsSummary(session),
      provenanceSummary: {
        sourceAssetCount: session.graph.sourceAssets.length
      },
      packageStableOrderVersion: "stable-order-v1"
    },
    model: {
      graph: {
        schemaVersion: "model-graph-v1",
        coordinateSystem: session.graph.coordinateSystem,
        canvasSize: session.graph.canvasSize,
        parts: session.graph.parts,
        rigControlRootIds: session.graph.rigControlRootIds,
        stableOrder: session.graph.stableOrder
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: session.graph.drawables
      },
      meshes: {
        schemaVersion: "meshes-file-v1",
        meshes: session.graph.meshes
      },
      parameters: {
        schemaVersion: "parameters-file-v1",
        parameters: session.graph.parameters
      },
      keyforms: {
        schemaVersion: "keyforms-file-v1",
        keyformSets: session.graph.keyformSets
      },
      rigControls: {
        schemaVersion: "rig-controls-file-v1",
        rigControls: session.graph.rigControls
      },
      dynamics: {
        schemaVersion: "dynamics-file-v3",
        dynamicsGroups: session.graph.dynamicsGroups
      },
      masks: {
        schemaVersion: "masks-file-v1",
        masks: session.graph.masks
      },
      drawOrder: {
        schemaVersion: "draw-order-file-v1",
        entries: session.graph.drawOrder
      },
      variants: {
        schemaVersion: VARIANTS_FILE_SCHEMA_VERSION,
        variantGroups: session.graph.variantGroups ?? []
      }
    },
    assets: {
      sourceManifest: {
        schemaVersion: "source-manifest-v1",
        sourceAssets: session.graph.sourceAssets
      },
      ...(session.graph.textureAtlas === undefined
        ? {}
        : { textureAtlas: session.graph.textureAtlas }),
      provenance: {
        schemaVersion: "provenance-file-v1",
        records: session.graph.provenanceRecords
      },
      rights: {
        schemaVersion: "rights-file-v1",
        records: session.graph.rightsRecords
      }
    }
  });
};

export const toPackageDocumentFromAuthoringSession = (
  session: AuthoringSession,
  options: PackageDocumentFromAuthoringSessionOptions & {
    readonly baseDocument?: unknown;
  } = {}
): PackageDocumentDto => {
  const baseDocument =
    options.baseDocument === undefined
      ? createPackageDocumentBaseFromAuthoringSession(session, options)
      : PackageDocumentSchema.parse(options.baseDocument);

  return toPackageDocument(session, baseDocument, {
    ...(options.editorHiddenPartIds === undefined
      ? {}
      : { editorHiddenPartIds: options.editorHiddenPartIds }),
    ...(options.updatedAt === undefined ? {} : { updatedAt: options.updatedAt })
  });
};

const createRightsSummary = (session: AuthoringSession): PackageRightsSummaryDto => {
  if (session.graph.rightsRecords.some((record) => record.rightsStatus === "blocked")) {
    return { status: "blocked" };
  }

  if (session.graph.rightsRecords.some((record) => record.rightsStatus === "needs_review")) {
    return { status: "needs_review" };
  }

  return { status: "cleared" };
};

const toIsoString = (value: Date | string | undefined): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
};
