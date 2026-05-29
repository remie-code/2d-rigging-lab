import type { ValidationReportEvidenceInput } from "./validation-report.js";

export interface OperationLogEvidenceInput {
  readonly operationLogPresent?: boolean;
  readonly operationLogPath?: string;
}

export const createOperationLogEvidence = (
  input: OperationLogEvidenceInput = {}
): Pick<ValidationReportEvidenceInput, "operationLogPresent" | "operationLogPath"> => ({
  operationLogPresent: input.operationLogPresent ?? false,
  ...(input.operationLogPath === undefined ? {} : { operationLogPath: input.operationLogPath })
});
