import { DiagnosticSchema, type DiagnosticDto, type TargetRefDto } from "@private-2d-rigging-lab/contracts";

export const materialDiagnostic = (code: string, message: string, target: TargetRefDto, phase = "material-drawable-image"): DiagnosticDto =>
  DiagnosticSchema.parse({ checkId: `material.${code}`, status: "fail", severity: "error",
    phase, target, message });

/** A rejection carrying a stable diagnostic code; callers that only need a message may treat it as an Error. */
export class MaterialRejection extends Error {
  constructor(readonly code: string, message: string, readonly target?: TargetRefDto) {
    super(message);
    this.name = "MaterialRejection";
  }
}
