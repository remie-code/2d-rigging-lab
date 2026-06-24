import type { PackageModelFilesDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import {
  createPackageEditorStateFile,
  type PackageDocumentEditorStateOptions
} from "./package-document-editor-state.js";

export const buildPackageDocumentModelFiles = (
  session: AuthoringSession,
  baseModelFiles: PackageModelFilesDto,
  options: PackageDocumentEditorStateOptions = {}
): PackageModelFilesDto => {
  const modelFiles: PackageModelFilesDto = {
    graph: {
      ...cloneDto(baseModelFiles.graph),
      coordinateSystem: session.graph.coordinateSystem,
      canvasSize: cloneDto(session.graph.canvasSize),
      parts: cloneDto(session.graph.parts),
      rigControlRootIds: cloneDto(session.graph.rigControlRootIds),
      stableOrder: cloneDto(session.graph.stableOrder)
    },
    drawables: {
      ...cloneDto(baseModelFiles.drawables),
      drawables: cloneDto(session.graph.drawables)
    },
    meshes: {
      ...cloneDto(baseModelFiles.meshes),
      meshes: cloneDto(session.graph.meshes)
    },
    parameters: {
      ...cloneDto(baseModelFiles.parameters),
      parameters: cloneDto(session.graph.parameters)
    },
    keyforms: {
      ...cloneDto(baseModelFiles.keyforms),
      keyformSets: cloneDto(session.graph.keyformSets)
    },
    rigControls: {
      ...cloneDto(baseModelFiles.rigControls),
      rigControls: cloneDto(session.graph.rigControls)
    },
    dynamics: {
      ...cloneDto(baseModelFiles.dynamics),
      schemaVersion: "dynamics-file-v2",
      dynamicsGroups: cloneDto(session.graph.dynamicsGroups)
    },
    masks: {
      ...cloneDto(baseModelFiles.masks),
      masks: cloneDto(session.graph.masks)
    },
    drawOrder: {
      ...cloneDto(baseModelFiles.drawOrder),
      entries: cloneDto(session.graph.drawOrder)
    },
    variants: {
      schemaVersion: "variants-file-v1",
      variantGroups: cloneDto(session.graph.variantGroups ?? [])
    }
  };

  const editorState = createPackageEditorStateFile(session, options);
  if (editorState !== undefined) {
    modelFiles.editorState = editorState;
  } else if (baseModelFiles.editorState !== undefined) {
    modelFiles.editorState = cloneDto(baseModelFiles.editorState);
  }

  return modelFiles;
};

const cloneDto = <TValue>(value: TValue): TValue => structuredClone(value);
