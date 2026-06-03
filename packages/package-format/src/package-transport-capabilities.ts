import {
  PACKAGE_TRANSPORT_CAPABILITY_CATALOG,
  PackageTransportCapabilityCatalogDtoSchema,
  type PackageTransportCapabilityDto
} from "@private-2d-rigging-lab/contracts";

import {
  PortablePackageBundleKindDtoSchema,
  PortablePackageBundleVersionDtoSchema
} from "./portable-package-bundle-contract.js";

export const PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG =
  PackageTransportCapabilityCatalogDtoSchema.parse(PACKAGE_TRANSPORT_CAPABILITY_CATALOG);

export const PACKAGE_FORMAT_PORTABLE_BUNDLE_TRANSPORT_CAPABILITY =
  bindSupportedPortableBundleCapability(
    PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG.capabilities.find((capability) =>
      capability.capabilityId === "projectDefinedJsonBundleV0"
    )
  );

export const PACKAGE_FORMAT_SUPPORTED_TRANSPORT_CAPABILITIES =
  PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG.capabilities.filter((capability) =>
    capability.status === "supported"
  );

function bindSupportedPortableBundleCapability(
  capability: PackageTransportCapabilityDto | undefined
): PackageTransportCapabilityDto {
  if (capability === undefined) {
    throw new Error("Missing projectDefinedJsonBundleV0 package transport capability.");
  }

  if (capability.portableBundle === undefined) {
    throw new Error("projectDefinedJsonBundleV0 must bind portable bundle metadata.");
  }

  PortablePackageBundleVersionDtoSchema.parse(capability.portableBundle.schemaVersion);
  PortablePackageBundleKindDtoSchema.parse(capability.portableBundle.bundleKind);

  return capability;
}
