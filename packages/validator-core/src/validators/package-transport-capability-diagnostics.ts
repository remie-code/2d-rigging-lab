import {
  PackageTransportCapabilityCatalogDtoSchema,
  PackageTransportCapabilityDtoSchema,
  type PackageTransportCapabilityDto
} from "@private-2d-rigging-lab/contracts";
import type { z } from "zod";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

type TransportCapabilityCheckId =
  | "transportCapability.evidenceMissing"
  | "transportCapability.schemaInvalid"
  | "transportCapability.unsupported"
  | "transportCapability.futureGated"
  | "transportCapability.dependencyGated";

type TransportCapabilityEvidenceShape = "catalog" | "capability";

interface ParsedTransportCapabilityEvidence {
  readonly shape: TransportCapabilityEvidenceShape;
  readonly capabilities: readonly PackageTransportCapabilityDto[];
}

interface TransportCapabilitySchemaIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export interface PackageTransportCapabilityDiagnosticsInput {
  readonly transportCapabilityEvidence?: unknown;
  readonly requireTransportCapabilityEvidence?: boolean;
  readonly packageId?: string;
}

export const validatePackageTransportCapabilityEvidence = (
  input: PackageTransportCapabilityDiagnosticsInput
): readonly ValidationCheckResultDto[] => {
  if (input.transportCapabilityEvidence === undefined) {
    return input.requireTransportCapabilityEvidence === true
      ? [createEvidenceMissingCheck(input.packageId)]
      : [];
  }

  const parseResult = parseTransportCapabilityEvidence(input.transportCapabilityEvidence);
  if (!parseResult.success) {
    return createSchemaInvalidChecks({
      evidence: input.transportCapabilityEvidence,
      intendedShape: parseResult.intendedShape,
      issues: parseResult.issues,
      packageId: input.packageId
    });
  }

  return parseResult.data.capabilities.flatMap((capability, capabilityIndex) =>
    createCapabilityStatusCheck({
      capability,
      capabilityIndex: parseResult.data.shape === "catalog" ? capabilityIndex : undefined,
      evidenceShape: parseResult.data.shape,
      packageId: input.packageId
    })
  );
};

const parseTransportCapabilityEvidence = (
  evidence: unknown
):
  | {
      readonly success: true;
      readonly data: ParsedTransportCapabilityEvidence;
    }
  | {
      readonly success: false;
      readonly intendedShape: TransportCapabilityEvidenceShape;
      readonly issues: readonly z.ZodIssue[];
    } => {
  const intendedShape = inferTransportCapabilityEvidenceShape(evidence);
  if (intendedShape === "catalog") {
    const catalogResult = PackageTransportCapabilityCatalogDtoSchema.safeParse(evidence);
    return catalogResult.success
      ? {
          success: true,
          data: {
            shape: "catalog",
            capabilities: catalogResult.data.capabilities
          }
        }
      : {
          success: false,
          intendedShape,
          issues: catalogResult.error.issues
        };
  }

  const capabilityResult = PackageTransportCapabilityDtoSchema.safeParse(evidence);
  return capabilityResult.success
    ? {
        success: true,
        data: {
          shape: "capability",
          capabilities: [capabilityResult.data]
        }
      }
    : {
        success: false,
        intendedShape,
        issues: capabilityResult.error.issues
      };
};

const inferTransportCapabilityEvidenceShape = (
  evidence: unknown
): TransportCapabilityEvidenceShape => {
  const schemaVersion = readRecordField(evidence, "schemaVersion");

  if (schemaVersion === "package-transport-capabilities-v0") {
    return "catalog";
  }
  if (schemaVersion === "package-transport-capability-v0") {
    return "capability";
  }
  if (readRecordField(evidence, "capabilities") !== undefined) {
    return "catalog";
  }
  if (
    readRecordField(evidence, "capabilityId") !== undefined ||
    readRecordField(evidence, "transportKind") !== undefined ||
    readRecordField(evidence, "status") !== undefined
  ) {
    return "capability";
  }

  return "catalog";
};

const createCapabilityStatusCheck = (input: {
  readonly capability: PackageTransportCapabilityDto;
  readonly capabilityIndex: number | undefined;
  readonly evidenceShape: TransportCapabilityEvidenceShape;
  readonly packageId: string | undefined;
}): readonly ValidationCheckResultDto[] => {
  switch (input.capability.status) {
    case "supported":
      return [];
    case "unsupported":
      return [createCapabilityBoundaryCheck({
        ...input,
        checkId: "transportCapability.unsupported",
        message: `Package transport capability ${input.capability.capabilityId} is unsupported.`,
        impact: "The current package flow must not treat this unsupported transport as available."
      })];
    case "future-gated":
      return [createCapabilityBoundaryCheck({
        ...input,
        checkId: "transportCapability.futureGated",
        message: `Package transport capability ${input.capability.capabilityId} is future-gated.`,
        impact: "The current package flow must not treat future-gated transport as implemented."
      })];
    case "dependency-gated":
      return [createCapabilityBoundaryCheck({
        ...input,
        checkId: "transportCapability.dependencyGated",
        message: `Package transport capability ${input.capability.capabilityId} is dependency-gated.`,
        impact: "The current package flow must not claim dependency-gated archive transport before dependency approval and implementation."
      })];
  }

  const exhaustiveStatus: never = input.capability.status;
  return exhaustiveStatus;
};

const createCapabilityBoundaryCheck = (input: {
  readonly capability: PackageTransportCapabilityDto;
  readonly capabilityIndex: number | undefined;
  readonly evidenceShape: TransportCapabilityEvidenceShape;
  readonly checkId: TransportCapabilityCheckId;
  readonly message: string;
  readonly impact: string;
  readonly packageId: string | undefined;
}): ValidationCheckResultDto => {
  const targetPath = createCapabilityTargetPath(input.capabilityIndex);

  return ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: "fail",
    severity: "blocking",
    phase: "source_import",
    target: {
      kind: "package",
      id: input.packageId ?? "transport-capability-evidence",
      path: targetPath
    },
    targetPath,
    message: input.message,
    evidence: [
      ...createCapabilityEvidence(input.capability, input.evidenceShape, input.capabilityIndex),
      `verificationIssueCode=${input.checkId}`
    ],
    relatedAC: ["AC-MVP-013", "AC-MVP-015", "AC-MVP-016"],
    relatedScenarios: ["SC-IN-002"],
    impact: input.impact
  });
};

const createEvidenceMissingCheck = (packageId: string | undefined): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "transportCapability.evidenceMissing",
    status: "fail",
    severity: "blocking",
    phase: "source_import",
    target: {
      kind: "package",
      id: packageId ?? "transport-capability-evidence",
      path: "/transportCapabilityEvidence"
    },
    targetPath: "/transportCapabilityEvidence",
    message: "Package transport capability evidence is missing.",
    evidence: [
      "transportCapabilityEvidence=missing",
      "requireTransportCapabilityEvidence=true",
      "verificationIssueCode=transportCapability.evidenceMissing"
    ],
    relatedAC: ["AC-MVP-013", "AC-MVP-015", "AC-MVP-016"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The validator cannot prove package transport truthfulness without explicit transport capability evidence."
  });

const createSchemaInvalidChecks = (input: {
  readonly evidence: unknown;
  readonly intendedShape: TransportCapabilityEvidenceShape;
  readonly issues: readonly TransportCapabilitySchemaIssue[];
  readonly packageId: string | undefined;
}): readonly ValidationCheckResultDto[] =>
  input.issues
    .map((issue) => createSchemaInvalidCheck({
      evidence: input.evidence,
      intendedShape: input.intendedShape,
      issue,
      packageId: input.packageId
    }))
    .sort((left, right) =>
      `${left.targetPath ?? ""}:${left.evidence.join("|")}`.localeCompare(
        `${right.targetPath ?? ""}:${right.evidence.join("|")}`
      )
    );

const createSchemaInvalidCheck = (input: {
  readonly evidence: unknown;
  readonly intendedShape: TransportCapabilityEvidenceShape;
  readonly issue: TransportCapabilitySchemaIssue;
  readonly packageId: string | undefined;
}): ValidationCheckResultDto => {
  const issueTargetPath = createIssueTargetPath(input.issue.path);

  return ValidationCheckResultSchema.parse({
    checkId: "transportCapability.schemaInvalid",
    status: "fail",
    severity: "blocking",
    phase: "source_import",
    target: {
      kind: "package",
      id: input.packageId ?? "transport-capability-evidence",
      path: issueTargetPath
    },
    targetPath: issueTargetPath,
    message: "Package transport capability evidence does not match the Domain A transport capability contract.",
    evidence: [
      `transportCapabilityEvidenceShape=${input.intendedShape}`,
      `transportCapabilitySchemaVersion=${formatEvidenceValue(readRecordField(input.evidence, "schemaVersion"))}`,
      `issueCode=${input.issue.code}`,
      `issueTargetPath=${issueTargetPath}`,
      `issueMessage=${input.issue.message}`,
      "verificationIssueCode=transportCapability.schemaInvalid"
    ],
    relatedAC: ["AC-MVP-013", "AC-MVP-015", "AC-MVP-016"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The validator cannot use malformed transport capability evidence to distinguish supported portable JSON from unsupported archive or filesystem transport claims."
  });
};

const createCapabilityEvidence = (
  capability: PackageTransportCapabilityDto,
  evidenceShape: TransportCapabilityEvidenceShape,
  capabilityIndex: number | undefined
): readonly string[] => [
  `transportCapabilityEvidenceShape=${evidenceShape}`,
  ...(capabilityIndex === undefined ? [] : [`capabilityIndex=${capabilityIndex}`]),
  `capabilityId=${capability.capabilityId}`,
  `transportKind=${capability.transportKind}`,
  `status=${capability.status}`,
  `portableBundleSchemaVersion=${formatEvidenceValue(capability.portableBundle?.schemaVersion)}`,
  `portableBundleKind=${formatEvidenceValue(capability.portableBundle?.bundleKind)}`,
  `gateCount=${capability.gates.length}`,
  ...capability.gates.map((gate, gateIndex) =>
    `gate.${gateIndex}=${gate.gateKind}:${gate.gateId}:${gate.status}`
  ),
  `issueCount=${capability.issues.length}`,
  ...capability.issues.map((issue, issueIndex) =>
    `issue.${issueIndex}=${issue.code}:${issue.severity}`
  )
];

const createCapabilityTargetPath = (capabilityIndex: number | undefined): string =>
  capabilityIndex === undefined
    ? "/transportCapabilityEvidence"
    : `/transportCapabilityEvidence/capabilities/${capabilityIndex}`;

const createIssueTargetPath = (
  path: readonly PropertyKey[]
): string =>
  path.length === 0
    ? "/transportCapabilityEvidence"
    : `/transportCapabilityEvidence/${path.map((segment) => String(segment)).join("/")}`;

const readRecordField = (
  value: unknown,
  fieldName: string
): unknown => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return (value as Readonly<Record<string, unknown>>)[fieldName];
};

const formatEvidenceValue = (value: unknown): string => {
  if (value === undefined) {
    return "missing";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  return typeof value;
};
