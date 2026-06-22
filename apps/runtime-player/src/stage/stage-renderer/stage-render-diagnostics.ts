import type { DiagnosticDto } from "@private-2d-rigging-lab/contracts";

export function createStageRuntimeDiagnosticDetails(
  diagnostics: readonly DiagnosticDto[]
): readonly string[] {
  return diagnostics.map((diagnostic) => {
    const target = `${diagnostic.target.kind}:${diagnostic.target.id}`;
    const evidence = diagnostic.evidence.length > 0
      ? ` Evidence: ${diagnostic.evidence.join("; ")}`
      : "";

    return `${diagnostic.severity} ${diagnostic.checkId} (${diagnostic.phase}, ${target}): ${diagnostic.message}${evidence}`;
  });
}
