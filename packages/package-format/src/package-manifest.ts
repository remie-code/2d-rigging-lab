import { z } from "zod";

import { PackageIdSchema } from "@private-2d-rigging-lab/contracts";

export const PackageFormatVersionSchema = z.literal("open-model-package-v1");
export const PackageStableOrderVersionSchema = z.literal("stable-order-v1");
export const PackageRevisionSchema = z.number().int().nonnegative();
export type PackageRevisionDto = z.infer<typeof PackageRevisionSchema>;
export const PackageRevisionDtoSchema = PackageRevisionSchema;

export const RequiredModelFilesSchema = z.object({
  graph: z.literal("model/graph.json"),
  drawables: z.literal("model/drawables.json"),
  meshes: z.literal("model/meshes.json"),
  parameters: z.literal("model/parameters.json"),
  keyforms: z.literal("model/keyforms.json"),
  rigControls: z.literal("model/rig-controls.json"),
  dynamics: z.literal("model/dynamics.json"),
  masks: z.literal("model/masks.json"),
  drawOrder: z.literal("model/draw-order.json"),
  editorState: z.literal("model/editor-state.json").optional()
});
export type RequiredModelFilesDto = z.infer<typeof RequiredModelFilesSchema>;

export const PackageRightsSummarySchema = z.object({
  status: z.enum(["cleared", "needs_review", "blocked"])
});
export type PackageRightsSummaryDto = z.infer<typeof PackageRightsSummarySchema>;

export const PackageProvenanceSummarySchema = z.object({
  sourceAssetCount: z.number().int().nonnegative()
});
export type PackageProvenanceSummaryDto = z.infer<typeof PackageProvenanceSummarySchema>;

export const PackageManifestSchema = z.object({
  schemaVersion: z.literal("open-model-package-manifest-v1"),
  packageId: PackageIdSchema,
  packageDisplayName: z.string(),
  formatVersion: PackageFormatVersionSchema,
  packageRevision: PackageRevisionSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  schemaVersions: z.record(z.string(), z.string()),
  evaluatorVersions: z.record(z.string(), z.string()),
  modelFiles: RequiredModelFilesSchema,
  assetIndex: z.literal("assets/sources/source-manifest.json"),
  operationLog: z.literal("operations/log.jsonl"),
  rightsSummary: PackageRightsSummarySchema,
  provenanceSummary: PackageProvenanceSummarySchema,
  packageStableOrderVersion: PackageStableOrderVersionSchema
});
export type PackageManifestDto = z.infer<typeof PackageManifestSchema>;
