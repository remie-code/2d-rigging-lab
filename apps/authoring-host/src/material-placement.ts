import { MaterialPlacementSchema, MaterialCorrespondenceSchema, MaterialFitEvidenceSchema, type MaterialPlacement, type MaterialCorrespondence } from "@private-2d-rigging-lab/contracts";
import type { z } from "zod";
import { MaterialHostError } from "./material-host-error.js";
export type MaterialFitEvidence = z.infer<typeof MaterialFitEvidenceSchema>;
export type MaterialPlacementInput = { placement: MaterialPlacement; correspondences?: never } | { correspondences: readonly MaterialCorrespondence[]; placement?: never };
export const resolveMaterialPlacement = (input: MaterialPlacementInput): { placement: MaterialPlacement; fitEvidence?: MaterialFitEvidence } => {
  if (input.placement !== undefined) {
    if (input.correspondences !== undefined) throw new MaterialHostError("ambiguous-placement", "Supply explicit placement or correspondences, not both.");
    const parsed = MaterialPlacementSchema.safeParse(input.placement);
    if (!parsed.success) throw new MaterialHostError("invalid-placement", parsed.error.message);
    return { placement: parsed.data };
  }
  const result = MaterialCorrespondenceSchema.array().min(2).safeParse(input.correspondences);
  if (!result.success) throw new MaterialHostError("invalid-correspondences", result.error.message);
  const points = result.data, n = points.length;
  const px = points.reduce((s,p)=>s+p.pixel.x/n,0), py = points.reduce((s,p)=>s+p.pixel.y/n,0);
  const sx = points.reduce((s,p)=>s+p.stage.x/n,0), sy = points.reduce((s,p)=>s+p.stage.y/n,0);
  let denominator = 0, numerator = 0;
  for (const p of points) {
    denominator += (p.pixel.x-px)**2 + (p.pixel.y-py)**2;
    numerator += (p.pixel.x-px)*(p.stage.x-sx) + (p.pixel.y-py)*(p.stage.y-sy);
  }
  if (!Number.isFinite(denominator) || denominator <= Number.EPSILON) throw new MaterialHostError("degenerate-correspondences", "Source points have no numerically resolvable spread.");
  const scale = numerator / denominator;
  if (!Number.isFinite(scale) || scale <= 0) throw new MaterialHostError("nonpositive-fit-scale", "Positive isotropic scale cannot fit these correspondences.");
  const placement = MaterialPlacementSchema.parse({ from: "source-image-pixel-edge-v1", to: "rest-stage-canvas-y-down-v1", scale, translation: { x: sx-scale*px, y: sy-scale*py } });
  const residualsStage = points.map(p=>Math.hypot(scale*p.pixel.x+placement.translation.x-p.stage.x, scale*p.pixel.y+placement.translation.y-p.stage.y));
  const fitEvidence = MaterialFitEvidenceSchema.parse({ placement, residualsStage, rmsErrorStage: Math.sqrt(residualsStage.reduce((s,r)=>s+r*r/n,0)), maxErrorStage: Math.max(...residualsStage) });
  return { placement, fitEvidence };
};
