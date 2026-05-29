import { describe, expect, it } from "vitest";

import { fixedAiApprovalTestIds } from "./ai-approval-test-ids.js";

describe("AI approval test ids", () => {
  it("keeps fixed test id constants unique", () => {
    expect(new Set(fixedAiApprovalTestIds).size).toBe(fixedAiApprovalTestIds.length);
  });
});
