import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ControlWindowRoleBadge } from "./control-window-shell";

describe("Control Window role badge", () => {
  it("renders the Tracking Host label with its accent colour", () => {
    const markup = renderToStaticMarkup(
      createElement(ControlWindowRoleBadge, {
        role: { id: "trackingHost", label: "Tracking Host" }
      })
    );

    expect(markup).toContain("Tracking Host");
    // Text + colour double-encoding: the teal accent class is present.
    expect(markup).toContain("text-teal-200");
  });

  it("renders the Autonomous Host label with a distinct accent colour", () => {
    const markup = renderToStaticMarkup(
      createElement(ControlWindowRoleBadge, {
        role: { id: "autonomousHost", label: "Autonomous Host" }
      })
    );

    expect(markup).toContain("Autonomous Host");
    expect(markup).toContain("text-violet-200");
    // The two roles do not share an accent colour.
    expect(markup).not.toContain("text-teal-200");
  });
});
