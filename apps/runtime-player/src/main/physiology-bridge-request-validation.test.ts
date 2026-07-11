import { describe, expect, it } from "vitest";

import { PHYSIOLOGY_SECTION_TONE_FIELDS } from "./physiology-profiles/physiology-tone-config";
import {
  PHYSIOLOGY_SECTION_ID_WHITELIST,
  readPhysiologySectionResetRequest,
  readPhysiologyToneUpdateRequest
} from "./physiology-bridge-request-validation";

describe("physiology bridge request validation", () => {
  it("whitelists EXACTLY the contract's full section-id set (drift guard)", () => {
    // The C6 Domain F regression root cause: the validation whitelist and the contract
    // section list were maintained separately and drifted apart ("speech" fell out of the
    // whitelist). PHYSIOLOGY_SECTION_TONE_FIELDS is a Record keyed by the FULL contract
    // union PhysiologySectionId, so its keys are the compiler-enforced complete section
    // set. This test fails the moment a future section is added to the contract (hence to
    // this record) but forgotten in the validation whitelist — the exact miss that shipped.
    const contractSections = Object.keys(PHYSIOLOGY_SECTION_TONE_FIELDS).sort();
    const whitelisted = [...PHYSIOLOGY_SECTION_ID_WHITELIST].sort();

    expect(whitelisted).toEqual(contractSections);
  });

  it("accepts the Speech section for a tone update (F Domain regression)", () => {
    const request = readPhysiologyToneUpdateRequest({
      section: "speech",
      field: "articulation",
      tone: 0.8
    });

    expect(request).toEqual({
      section: "speech",
      field: "articulation",
      tone: 0.8
    });
  });

  it("accepts the Speech section for a reset request (F Domain regression)", () => {
    expect(readPhysiologySectionResetRequest({ section: "speech" })).toEqual({
      section: "speech"
    });
  });

  it("rejects an unknown section with the known-section error", () => {
    expect(() =>
      readPhysiologyToneUpdateRequest({
        section: "nope",
        field: "articulation",
        tone: 0.5
      })
    ).toThrow("Physiology section is not a known section.");
  });
});
