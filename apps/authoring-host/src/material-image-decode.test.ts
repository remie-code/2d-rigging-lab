import { describe, expect, it } from "vitest";
import { encodeRgba8ToPng } from "@private-2d-rigging-lab/render-software";
import { createMaterialImageFixture } from "@private-2d-rigging-lab/contracts";
import { decodeMaterialImage, materialSha256, verifyMaterialImage } from "./material-image-decode.js";
describe("material PNG intake",()=>{
  it("keeps straight translucent RGB, transparent margins, both independent hashes",()=>{
    const fixture=createMaterialImageFixture("wide"); fixture.image.rgbaBytes.set([200,100,50,128],(2*10+3)*4);
    const bytes=encodeRgba8ToPng(fixture.image.rgbaBytes,10,8),image=decodeMaterialImage({bytes});
    expect(image.rgbaBytes).toEqual(fixture.image.rgbaBytes); expect(image.descriptor.originalFileSha256).toBe(materialSha256(bytes));
    expect(image.descriptor.rgbaSha256).toBe(materialSha256(fixture.image.rgbaBytes)); expect(image.descriptor.originalFileSha256).not.toBe(image.descriptor.rgbaSha256);
    expect(image.descriptor.alpha).toEqual({...fixture.image.descriptor.alpha,translucentPixelCount:1});
    expect(image.descriptor.contentInset).toEqual({left:0,top:0,right:0,bottom:0});
  });
  it("rejects original hash mismatch, corruption, fully transparent input",()=>{
    const bytes=encodeRgba8ToPng(createMaterialImageFixture().image.rgbaBytes,4,4);
    expect(()=>decodeMaterialImage({bytes,expectedOriginalFileSha256:"0".repeat(64)})).toThrow("SHA-256 mismatch");
    const corrupt=new Uint8Array(bytes); corrupt[corrupt.length-1]=corrupt[corrupt.length-1]!^1;
    expect(()=>decodeMaterialImage({bytes:corrupt})).toThrow();
    expect(()=>decodeMaterialImage({bytes:encodeRgba8ToPng(new Uint8Array(16),2,2)})).toThrow("Fully transparent");
  });
  it("verifies normalized hash even when alpha and dimensions still agree",()=>{
    const image=createMaterialImageFixture().image; image.rgbaBytes[0]=10;
    expect(()=>verifyMaterialImage(image)).toThrow("RGBA SHA-256");
  });
});

