import { z } from "zod";

import { SeveritySchema } from "./enums.js";

const MACHINE_ID_PATTERN = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/;

export const PackageTransportCapabilitySchemaVersionSchema = z.literal(
  "package-transport-capability-v0"
);
export type PackageTransportCapabilitySchemaVersionDto = z.infer<
  typeof PackageTransportCapabilitySchemaVersionSchema
>;
export const PackageTransportCapabilitySchemaVersionDtoSchema =
  PackageTransportCapabilitySchemaVersionSchema;

export const PackageTransportCapabilityCatalogVersionSchema = z.literal(
  "package-transport-capabilities-v0"
);
export type PackageTransportCapabilityCatalogVersionDto = z.infer<
  typeof PackageTransportCapabilityCatalogVersionSchema
>;
export const PackageTransportCapabilityCatalogVersionDtoSchema =
  PackageTransportCapabilityCatalogVersionSchema;

export const PackageTransportCapabilityIdSchema = z.enum([
  "projectDefinedJsonBundleV0",
  "standardArchiveZipV0",
  "fileSystemAccessApiV0",
  "directoryPickerV0",
  "dragDropFileIntakeV0",
  "nativeFilesystemPersistenceV0"
]);
export type PackageTransportCapabilityIdDto = z.infer<
  typeof PackageTransportCapabilityIdSchema
>;
export const PackageTransportCapabilityIdDtoSchema = PackageTransportCapabilityIdSchema;

const SUPPORTED_PACKAGE_TRANSPORT_CAPABILITY_ID = "projectDefinedJsonBundleV0";

export const PackageTransportKindSchema = z.enum([
  "portableBundle",
  "archive",
  "filesystem",
  "browserFileIntake"
]);
export type PackageTransportKindDto = z.infer<typeof PackageTransportKindSchema>;
export const PackageTransportKindDtoSchema = PackageTransportKindSchema;

export const PackageTransportCapabilityStatusSchema = z.enum([
  "supported",
  "unsupported",
  "future-gated",
  "dependency-gated"
]);
export type PackageTransportCapabilityStatusDto = z.infer<
  typeof PackageTransportCapabilityStatusSchema
>;
export const PackageTransportCapabilityStatusDtoSchema =
  PackageTransportCapabilityStatusSchema;

export const PackageTransportCapabilityGateKindSchema = z.enum([
  "waveImplementation",
  "dependencyApproval",
  "browserApiDecision",
  "securityReview",
  "uxDecision",
  "productDecision"
]);
export type PackageTransportCapabilityGateKindDto = z.infer<
  typeof PackageTransportCapabilityGateKindSchema
>;
export const PackageTransportCapabilityGateKindDtoSchema =
  PackageTransportCapabilityGateKindSchema;

export const PackageTransportCapabilityGateStatusSchema = z.enum(["open", "notRequired"]);
export type PackageTransportCapabilityGateStatusDto = z.infer<
  typeof PackageTransportCapabilityGateStatusSchema
>;
export const PackageTransportCapabilityGateStatusDtoSchema =
  PackageTransportCapabilityGateStatusSchema;

export const PackageTransportCapabilityIssueCodeSchema = z.enum([
  "transport.notImplemented",
  "transport.unsupported",
  "transport.futureScope",
  "transport.dependencyApprovalRequired",
  "transport.noArchiveCompatibilityClaim",
  "transport.noFilesystemCompatibilityClaim",
  "transport.noDragDropIntake"
]);
export type PackageTransportCapabilityIssueCodeDto = z.infer<
  typeof PackageTransportCapabilityIssueCodeSchema
>;
export const PackageTransportCapabilityIssueCodeDtoSchema =
  PackageTransportCapabilityIssueCodeSchema;

export const PackageTransportPortableBundleBindingDtoSchema = z.object({
  schemaVersion: z.literal("portable-package-bundle-v0"),
  bundleKind: z.literal("project-defined-json-bundle-v0")
}).strict();
export type PackageTransportPortableBundleBindingDto = z.infer<
  typeof PackageTransportPortableBundleBindingDtoSchema
>;

export const PackageTransportCapabilityGateDtoSchema = z.object({
  gateKind: PackageTransportCapabilityGateKindSchema,
  gateId: z.string().regex(MACHINE_ID_PATTERN),
  status: PackageTransportCapabilityGateStatusSchema,
  summary: z.string().min(1)
}).strict();
export type PackageTransportCapabilityGateDto = z.infer<
  typeof PackageTransportCapabilityGateDtoSchema
>;

export const PackageTransportCapabilityIssueDtoSchema = z.object({
  code: PackageTransportCapabilityIssueCodeSchema,
  severity: SeveritySchema,
  message: z.string().min(1)
}).strict();
export type PackageTransportCapabilityIssueDto = z.infer<
  typeof PackageTransportCapabilityIssueDtoSchema
>;

export const PackageTransportCapabilityDtoSchema = z.object({
  schemaVersion: PackageTransportCapabilitySchemaVersionSchema,
  capabilityId: PackageTransportCapabilityIdSchema,
  transportKind: PackageTransportKindSchema,
  status: PackageTransportCapabilityStatusSchema,
  summary: z.string().min(1),
  portableBundle: PackageTransportPortableBundleBindingDtoSchema.optional(),
  gates: z.array(PackageTransportCapabilityGateDtoSchema).default([]),
  issues: z.array(PackageTransportCapabilityIssueDtoSchema).default([])
}).strict().superRefine((capability, context) => {
  if (
    capability.status === "supported" &&
    capability.capabilityId !== SUPPORTED_PACKAGE_TRANSPORT_CAPABILITY_ID
  ) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "Only projectDefinedJsonBundleV0 may claim supported package transport status."
    });
  }

  if (capability.status === "supported" && capability.gates.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["gates"],
      message: "Supported package transport capabilities must not carry open gates."
    });
  }

  if (capability.status !== "supported" && capability.issues.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["issues"],
      message: "Non-supported package transport capabilities must explain the boundary."
    });
  }

  if (capability.status === "dependency-gated" && !hasGateKind(capability, "dependencyApproval")) {
    context.addIssue({
      code: "custom",
      path: ["gates"],
      message: "Dependency-gated package transport capabilities need a dependencyApproval gate."
    });
  }

  if (capability.status === "future-gated" && !hasFutureGate(capability)) {
    context.addIssue({
      code: "custom",
      path: ["gates"],
      message: "Future-gated package transport capabilities need an explicit future gate."
    });
  }

  if (capability.transportKind !== "portableBundle" && capability.portableBundle !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["portableBundle"],
      message: "Only portableBundle transport capabilities may bind a portable bundle kind."
    });
  }

  if (capability.capabilityId === "projectDefinedJsonBundleV0") {
    if (capability.status !== "supported") {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "projectDefinedJsonBundleV0 is the supported Wave36 portable transport."
      });
    }

    if (capability.transportKind !== "portableBundle") {
      context.addIssue({
        code: "custom",
        path: ["transportKind"],
        message: "projectDefinedJsonBundleV0 must be a portableBundle transport."
      });
    }

    if (capability.portableBundle === undefined) {
      context.addIssue({
        code: "custom",
        path: ["portableBundle"],
        message: "projectDefinedJsonBundleV0 must bind the portable package bundle v0 contract."
      });
    }
  }
});
export type PackageTransportCapabilityDto = z.infer<
  typeof PackageTransportCapabilityDtoSchema
>;

export const PackageTransportCapabilityCatalogDtoSchema = z.object({
  schemaVersion: PackageTransportCapabilityCatalogVersionSchema,
  capabilities: z.array(PackageTransportCapabilityDtoSchema).min(1)
}).strict().superRefine((catalog, context) => {
  const seenCapabilityIds = new Set<PackageTransportCapabilityIdDto>();

  catalog.capabilities.forEach((capability, index) => {
    if (seenCapabilityIds.has(capability.capabilityId)) {
      context.addIssue({
        code: "custom",
        path: ["capabilities", index, "capabilityId"],
        message: `Duplicate package transport capability id "${capability.capabilityId}".`
      });
    }

    seenCapabilityIds.add(capability.capabilityId);
  });
});
export type PackageTransportCapabilityCatalogDto = z.infer<
  typeof PackageTransportCapabilityCatalogDtoSchema
>;

export const PACKAGE_TRANSPORT_CAPABILITY_CATALOG = {
  schemaVersion: "package-transport-capabilities-v0",
  capabilities: [
    {
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "projectDefinedJsonBundleV0",
      transportKind: "portableBundle",
      status: "supported",
      summary: "Project-defined JSON portable package bundle with base64 byte payloads.",
      portableBundle: {
        schemaVersion: "portable-package-bundle-v0",
        bundleKind: "project-defined-json-bundle-v0"
      },
      gates: [],
      issues: []
    },
    {
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "standardArchiveZipV0",
      transportKind: "archive",
      status: "dependency-gated",
      summary: "ZIP/archive package transport boundary; no writer or importer is implemented.",
      gates: [
        {
          gateKind: "dependencyApproval",
          gateId: "transport.archiveDependencyApproval",
          status: "open",
          summary: "Archive dependency, license, provenance, and security approval is required."
        }
      ],
      issues: [
        {
          code: "transport.dependencyApprovalRequired",
          severity: "blocking",
          message: "ZIP/archive support requires an approved archive dependency before implementation."
        },
        {
          code: "transport.noArchiveCompatibilityClaim",
          severity: "blocking",
          message: "The current package format must not be treated as ZIP/archive compatible."
        }
      ]
    },
    {
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "fileSystemAccessApiV0",
      transportKind: "filesystem",
      status: "future-gated",
      summary: "Browser File System Access API package transport boundary; not implemented.",
      gates: [
        {
          gateKind: "browserApiDecision",
          gateId: "transport.fileSystemAccessApiDecision",
          status: "open",
          summary: "Browser support, permission UX, and security policy need approval."
        },
        {
          gateKind: "waveImplementation",
          gateId: "transport.fileSystemAccessApiImplementation",
          status: "open",
          summary: "A later wave must implement and test this API before it can be supported."
        }
      ],
      issues: [
        {
          code: "transport.notImplemented",
          severity: "blocking",
          message: "No File System Access API route is implemented."
        },
        {
          code: "transport.noFilesystemCompatibilityClaim",
          severity: "blocking",
          message: "The current package format does not claim filesystem handle compatibility."
        }
      ]
    },
    {
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "directoryPickerV0",
      transportKind: "filesystem",
      status: "future-gated",
      summary: "Directory picker package transport boundary; not implemented.",
      gates: [
        {
          gateKind: "uxDecision",
          gateId: "transport.directoryPickerUx",
          status: "open",
          summary: "Directory picker UX and permission behavior need a product decision."
        },
        {
          gateKind: "waveImplementation",
          gateId: "transport.directoryPickerImplementation",
          status: "open",
          summary: "A later wave must implement and test directory picker behavior."
        }
      ],
      issues: [
        {
          code: "transport.notImplemented",
          severity: "blocking",
          message: "No directory picker route is implemented."
        },
        {
          code: "transport.noFilesystemCompatibilityClaim",
          severity: "blocking",
          message: "The current package format does not claim directory filesystem compatibility."
        }
      ]
    },
    {
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "dragDropFileIntakeV0",
      transportKind: "browserFileIntake",
      status: "future-gated",
      summary: "Drag-drop file intake boundary; not implemented as a package transport.",
      gates: [
        {
          gateKind: "uxDecision",
          gateId: "transport.dragDropUx",
          status: "open",
          summary: "Drag-drop scope, affordance, and error UX need a product decision."
        },
        {
          gateKind: "waveImplementation",
          gateId: "transport.dragDropImplementation",
          status: "open",
          summary: "A later wave must implement and test drag-drop before support is claimed."
        }
      ],
      issues: [
        {
          code: "transport.notImplemented",
          severity: "blocking",
          message: "No drag-drop package transport route is implemented."
        },
        {
          code: "transport.noDragDropIntake",
          severity: "blocking",
          message: "Current file intake support must not imply drag-drop support."
        }
      ]
    },
    {
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "nativeFilesystemPersistenceV0",
      transportKind: "filesystem",
      status: "unsupported",
      summary: "Native OS filesystem persistence guarantee; unsupported by the current browser package flow.",
      gates: [],
      issues: [
        {
          code: "transport.unsupported",
          severity: "blocking",
          message: "The current package flow provides no native OS filesystem persistence guarantee."
        },
        {
          code: "transport.noFilesystemCompatibilityClaim",
          severity: "blocking",
          message: "Browser-local persistence and portable JSON bundles are not OS filesystem persistence."
        }
      ]
    }
  ]
} as const;

function hasGateKind(
  capability: PackageTransportCapabilityDto,
  gateKind: PackageTransportCapabilityGateKindDto
): boolean {
  return capability.gates.some((gate) => gate.gateKind === gateKind);
}

function hasFutureGate(capability: PackageTransportCapabilityDto): boolean {
  return capability.gates.some((gate) =>
    gate.gateKind === "browserApiDecision" ||
    gate.gateKind === "productDecision" ||
    gate.gateKind === "securityReview" ||
    gate.gateKind === "uxDecision" ||
    gate.gateKind === "waveImplementation"
  );
}
