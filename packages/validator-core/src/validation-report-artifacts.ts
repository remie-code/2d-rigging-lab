import {
  ValidationReportIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";

import {
  ValidationReportSchema
} from "./validation-report.js";
import type {
  ValidationReportDto,
  ValidationReportInput
} from "./validation-report.js";

export const VALIDATION_REPORT_ARTIFACT_DIRECTORY = "validation/reports";
export const VALIDATION_REPORT_ARTIFACT_EXTENSION = ".validation.json";
export const CANONICAL_OPERATION_LOG_PATH = "operations/log.jsonl";

export type ValidationReportArtifactPath = `${typeof VALIDATION_REPORT_ARTIFACT_DIRECTORY}/${string}${typeof VALIDATION_REPORT_ARTIFACT_EXTENSION}`;

export interface ValidationReportArtifact {
  readonly path: ValidationReportArtifactPath;
  readonly content: string;
  readonly report: ValidationReportDto;
}

export const createValidationReportArtifactPath = (
  reportId: ValidationReportId | string
): ValidationReportArtifactPath => {
  const parsedReportId = ValidationReportIdSchema.parse(reportId);

  return `${VALIDATION_REPORT_ARTIFACT_DIRECTORY}/${parsedReportId}${VALIDATION_REPORT_ARTIFACT_EXTENSION}`;
};

export const materializeValidationReportArtifact = (
  input: ValidationReportDto | ValidationReportInput
): ValidationReportArtifact => {
  const report = ValidationReportSchema.parse(input);

  return {
    path: createValidationReportArtifactPath(report.reportId),
    content: serializeValidationReportArtifactContent(report),
    report
  };
};

export const serializeValidationReportArtifactContent = (
  input: ValidationReportDto | ValidationReportInput
): string => {
  const report = ValidationReportSchema.parse(input);

  return `${stringifyDeterministicJson(report)}\n`;
};

const stringifyDeterministicJson = (value: unknown): string => {
  const text = JSON.stringify(sortJsonObjectKeys(value), null, 2);

  if (text === undefined) {
    throw new Error("Validation report artifact content must be JSON serializable.");
  }

  return text;
};

const sortJsonObjectKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonObjectKeys(item));
  }

  if (!isJsonRecord(value)) {
    return value;
  }

  const sorted: Record<string, unknown> = {};

  for (const key of Object.keys(value).sort()) {
    const propertyValue = value[key];

    if (propertyValue !== undefined) {
      sorted[key] = sortJsonObjectKeys(propertyValue);
    }
  }

  return sorted;
};

const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
