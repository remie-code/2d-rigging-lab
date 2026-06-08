import { createInitialAuthoringRevision } from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { PackageIdSchema, PartIdSchema } from "@private-2d-rigging-lab/contracts";

export const ROOT_PART_ID = PartIdSchema.parse("part_root");

export function createEmptyAuthoringSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_editor_workspace"),
      packageDisplayName: "Untitled model",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: {
        width: 2048,
        height: 3072
      },
      parts: [
        {
          partId: ROOT_PART_ID,
          displayName: "Project Root",
          childPartIds: [],
          drawableIds: []
        }
      ],
      drawables: [],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [],
      rigControlRootIds: [],
      stableOrder: [ROOT_PART_ID],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}
