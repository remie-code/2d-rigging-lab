import { describe, expect, it } from "vitest";

import { fixedEditorTestIds } from "./editor-test-ids.js";

describe("editor test ids", () => {
  it("keeps fixed test id constants unique", () => {
    expect(new Set(fixedEditorTestIds).size).toBe(fixedEditorTestIds.length);
  });
});
