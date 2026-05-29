import {
  ValidatePackagePayloadSchema,
  ValidatePackageResultSchema,
  type ValidatePackagePayload,
  type ValidatePackageResult
} from "@private-2d-rigging-lab/ai-interface";
import { validatePackageRuntime } from "@private-2d-rigging-lab/validator-core";

export interface ProjectEditorAiValidationInput {
  readonly packageDocument: unknown;
  readonly payload: ValidatePackagePayload;
  readonly createdAt?: string;
}

export const projectEditorAiValidation = (
  input: ProjectEditorAiValidationInput
): ValidatePackageResult => {
  const payload = ValidatePackagePayloadSchema.parse(input.payload);
  const report = validatePackageRuntime({
    packageDocument: input.packageDocument,
    profile: payload.profile,
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt })
  });

  return ValidatePackageResultSchema.parse({
    reportId: report.reportId,
    report
  });
};
