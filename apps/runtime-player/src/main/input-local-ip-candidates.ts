import { networkInterfaces } from "node:os";

export function getRuntimePlayerLocalIpCandidates(): readonly string[] {
  const candidates = new Set<string>();

  for (const addresses of Object.values(networkInterfaces())) {
    if (addresses === undefined) {
      continue;
    }

    for (const address of addresses) {
      if (address.family === "IPv4" && !address.internal) {
        candidates.add(address.address);
      }
    }
  }

  return [...candidates].sort((left, right) => left.localeCompare(right));
}
