import {
  PartIdSchema,
  SourceAssetIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import {
  PsdStructuralScaffoldApprovalBridgeEvidenceSchema,
  PsdStructuralScaffoldCapPolicySchema
} from "../psd-structural-scaffold-evidence.js";

const LockedTargetIdsSchema = z.array(z.string().min(1)).default([]);

export const PsdStructuralScaffoldDestinationSchema = z.object({
  destinationKind: z.literal("structuralScaffold"),
  parentPartId: PartIdSchema
}).strict();
export type PsdStructuralScaffoldDestinationDto = z.infer<
  typeof PsdStructuralScaffoldDestinationSchema
>;

export const ImportPsdStructuralScaffoldPayloadSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  batchId: z.string().regex(/^batch_[A-Za-z0-9_-]+$/),
  destination: PsdStructuralScaffoldDestinationSchema,
  structuralScaffoldBridge: PsdStructuralScaffoldApprovalBridgeEvidenceSchema,
  capPolicy: PsdStructuralScaffoldCapPolicySchema,
  lockedTargetIds: LockedTargetIdsSchema
}).strict();
export type ImportPsdStructuralScaffoldPayloadDto = z.infer<
  typeof ImportPsdStructuralScaffoldPayloadSchema
>;
