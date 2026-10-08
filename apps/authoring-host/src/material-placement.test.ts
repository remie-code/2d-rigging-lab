import { describe,expect,it } from "vitest";
import { createMaterialImageFixture, type MaterialCorrespondence } from "@private-2d-rigging-lab/contracts";
import { resolveMaterialPlacement } from "./material-placement.js";
const pair=(x:number,y:number,sx:number,sy:number):MaterialCorrespondence=>({pixel:{space:"source-image-pixel-edge-v1",x,y},stage:{space:"rest-stage-canvas-y-down-v1",x:sx,y:sy}});
describe("material placement",()=>{
  it("maps different resolution/margins to the same stage alpha without fitting the full image bbox",()=>{
    for(const variant of ["compact","wide"] as const) {
      const f=createMaterialImageFixture(variant),b=f.image.descriptor.alpha.bounds!;
      const fit=resolveMaterialPlacement({correspondences:[pair(b.x,b.y,11,11),pair(b.x+b.width,b.y+b.height,15,15)]});
      expect(fit.placement).toEqual(f.placement); expect(fit.fitEvidence!.maxErrorStage).toBe(0);
      expect(resolveMaterialPlacement({placement:f.placement}).placement).toEqual(f.placement);
    }
  });
  it("reports actual residuals for non-isotropic correspondences",()=>{
    const result=resolveMaterialPlacement({correspondences:[pair(0,0,0,0),pair(2,0,6,0),pair(0,2,0,2)]});
    expect(result.placement.scale).toBeCloseTo(2); expect(result.fitEvidence!.rmsErrorStage).toBeCloseTo(4/3);
    expect(result.fitEvidence!.maxErrorStage).toBeGreaterThan(1);
  });
  it("diagnoses coincident, mirrored, nonfinite, and invalid scale inputs",()=>{
    expect(()=>resolveMaterialPlacement({correspondences:[pair(1,1,2,2),pair(1,1,3,3)]})).toThrow("spread");
    expect(()=>resolveMaterialPlacement({correspondences:[pair(0,0,0,0),pair(1,1,-1,-1)]})).toThrow("Positive isotropic");
    expect(()=>resolveMaterialPlacement({correspondences:[pair(NaN,0,0,0),pair(1,1,1,1)]})).toThrow();
    expect(()=>resolveMaterialPlacement({placement:{...createMaterialImageFixture().placement,scale:-1}})).toThrow();
  });
});
