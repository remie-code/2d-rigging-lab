import {
  ValidationProfileSchema,
  ValidationReportIdSchema
} from "@private-2d-rigging-lab/contracts";
import { ValidationReportSchema } from "@private-2d-rigging-lab/validator-core";
import { z } from "zod";

export const ValidatePackagePayloadSchema = z.object({
  profile: ValidationProfileSchema,
  packageRevision: z.number().int().nonnegative().optional()
});
export type ValidatePackagePayload = z.infer<typeof ValidatePackagePayloadSchema>;

export const ValidatePackageResultSchema = z.object({
  reportId: ValidationReportIdSchema,
  report: ValidationReportSchema
});
export type ValidatePackageResult = z.infer<typeof ValidatePackageResultSchema>;
