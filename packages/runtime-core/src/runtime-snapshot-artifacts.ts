import type { RuntimeSnapshotId } from "@private-2d-rigging-lab/contracts";
import { RuntimeSnapshotIdSchema } from "@private-2d-rigging-lab/contracts";

import {
  runtimeArtifactJsonMediaType,
  stringifyRuntimeArtifactJson
} from "./runtime-artifact-json.js";
import {
  RuntimeSnapshotSchema
} from "./snapshot.js";
import type { RuntimeSnapshotDto } from "./snapshot.js";

export type RuntimeSnapshotArtifactPath = `runtime/snapshots/${string}.runtime-snapshot.json`;

export interface RuntimeSnapshotArtifact {
  readonly kind: "runtimeSnapshot";
  readonly path: RuntimeSnapshotArtifactPath;
  readonly mediaType: typeof runtimeArtifactJsonMediaType;
  readonly content: string;
  readonly snapshotId: RuntimeSnapshotId;
}

export const createRuntimeSnapshotArtifactPath = (
  snapshotId: RuntimeSnapshotId
): RuntimeSnapshotArtifactPath =>
  `runtime/snapshots/${RuntimeSnapshotIdSchema.parse(snapshotId)}.runtime-snapshot.json`;

export const materializeRuntimeSnapshotArtifact = (
  snapshotValue: RuntimeSnapshotDto
): RuntimeSnapshotArtifact => {
  const snapshot = RuntimeSnapshotSchema.parse(snapshotValue);

  return {
    kind: "runtimeSnapshot",
    path: createRuntimeSnapshotArtifactPath(snapshot.snapshotId),
    mediaType: runtimeArtifactJsonMediaType,
    content: stringifyRuntimeArtifactJson(snapshot),
    snapshotId: snapshot.snapshotId
  };
};

export const materializeRuntimeSnapshotArtifacts = (
  snapshots: readonly RuntimeSnapshotDto[]
): readonly RuntimeSnapshotArtifact[] => {
  const artifacts: RuntimeSnapshotArtifact[] = [];
  const seenPaths = new Set<string>();

  for (const snapshot of snapshots) {
    const artifact = materializeRuntimeSnapshotArtifact(snapshot);
    if (seenPaths.has(artifact.path)) {
      continue;
    }

    seenPaths.add(artifact.path);
    artifacts.push(artifact);
  }

  return artifacts;
};
