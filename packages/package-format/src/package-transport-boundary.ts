import {
  type PackageTransportCapabilityDto,
  type PackageTransportCapabilityGateDto,
  type PackageTransportCapabilityIdDto,
  type PackageTransportCapabilityIssueDto,
  type PackageTransportCapabilityStatusDto
} from "@private-2d-rigging-lab/contracts";

import { PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG } from "./package-transport-capabilities.js";

export type PackageTransportBoundaryOperation =
  | "export"
  | "import"
  | "intake"
  | "persist";

export interface EvaluatePackageTransportBoundaryInput {
  readonly capabilityId: PackageTransportCapabilityIdDto;
  readonly operation?: PackageTransportBoundaryOperation;
}

export type SupportedPackageTransportCapability = PackageTransportCapabilityDto & {
  readonly status: "supported";
};

export type NonSupportedPackageTransportCapability = PackageTransportCapabilityDto & {
  readonly status: Exclude<PackageTransportCapabilityStatusDto, "supported">;
};

export interface SupportedPackageTransportBoundaryResult {
  readonly outcome: "supported";
  readonly supported: true;
  readonly requestedCapabilityId: PackageTransportCapabilityIdDto;
  readonly operation?: PackageTransportBoundaryOperation;
  readonly status: "supported";
  readonly capability: SupportedPackageTransportCapability;
  readonly gates: readonly [];
  readonly issues: readonly [];
}

export interface NonSupportedPackageTransportBoundaryResult {
  readonly outcome: "not-supported";
  readonly supported: false;
  readonly requestedCapabilityId: PackageTransportCapabilityIdDto;
  readonly operation?: PackageTransportBoundaryOperation;
  readonly status: Exclude<PackageTransportCapabilityStatusDto, "supported">;
  readonly capability: NonSupportedPackageTransportCapability;
  readonly gates: readonly PackageTransportCapabilityGateDto[];
  readonly issues: readonly PackageTransportCapabilityIssueDto[];
}

export type PackageTransportBoundaryResult =
  | SupportedPackageTransportBoundaryResult
  | NonSupportedPackageTransportBoundaryResult;

export class PackageTransportBoundaryError extends Error {
  readonly result: NonSupportedPackageTransportBoundaryResult;

  constructor(result: NonSupportedPackageTransportBoundaryResult) {
    const firstIssue = result.issues[0];

    super(firstIssue?.message ?? result.capability.summary);
    this.name = "PackageTransportBoundaryError";
    this.result = result;
  }
}

export function evaluatePackageTransportBoundary(
  input: EvaluatePackageTransportBoundaryInput
): PackageTransportBoundaryResult {
  const capability = getPackageTransportCapability(input.capabilityId);
  const operation = input.operation;

  if (capability.status === "supported") {
    return {
      outcome: "supported",
      supported: true,
      requestedCapabilityId: input.capabilityId,
      ...(operation === undefined ? {} : { operation }),
      status: "supported",
      capability: capability as SupportedPackageTransportCapability,
      gates: [],
      issues: []
    };
  }

  return {
    outcome: "not-supported",
    supported: false,
    requestedCapabilityId: input.capabilityId,
    ...(operation === undefined ? {} : { operation }),
    status: capability.status,
    capability: capability as NonSupportedPackageTransportCapability,
    gates: [...capability.gates],
    issues: [...capability.issues]
  };
}

export function requireSupportedPackageTransportBoundary(
  input: EvaluatePackageTransportBoundaryInput
): SupportedPackageTransportBoundaryResult {
  const result = evaluatePackageTransportBoundary(input);

  if (result.outcome === "supported") {
    return result;
  }

  throw new PackageTransportBoundaryError(result);
}

function getPackageTransportCapability(
  capabilityId: PackageTransportCapabilityIdDto
): PackageTransportCapabilityDto {
  const capability = PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG.capabilities.find(
    (candidate) => candidate.capabilityId === capabilityId
  );

  if (capability === undefined) {
    throw new Error(`Missing package transport capability "${capabilityId}".`);
  }

  return capability;
}
