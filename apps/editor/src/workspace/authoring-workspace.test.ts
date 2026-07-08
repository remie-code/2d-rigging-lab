import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EditorSessionProvider } from "../features/editor-session/editor-session-context";
import { TooltipProvider } from "../ui/tooltip";
import { AuthoringWorkspaceContent } from "./authoring-workspace";

describe("AuthoringWorkspace Workspace Gate", () => {
  it("starts in the Workspace Gate and does not render editing surfaces", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(
          EditorSessionProvider,
          null,
          createElement(AuthoringWorkspaceContent, { activeEntry: "workspace" })
        )
      )
    );

    expect(markup).toContain("Create Workspace");
    expect(markup).toContain("Open Workspace");
    expect(markup).toContain("No workspace is open");
    expect(markup).not.toContain("Toolbox");
    expect(markup).not.toContain("Canvas");
    expect(markup).not.toContain("Inspector");
    expect(markup).not.toContain("Parameter Bar");
    expect(markup).not.toContain("Import PSD");
  });

  it("renders the Variant Manager route without the normal workspace panels or Parameter Bar", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(
          EditorSessionProvider,
          { initialWorkspaceOpen: true },
          createElement(AuthoringWorkspaceContent, { activeEntry: "variants" })
        )
      )
    );

    expect(markup).toContain('data-testid="variant-manager-screen"');
    expect(markup).toContain("Variant / Expression Manager");
    expect(markup).toContain("Existing workspace has no Variant Groups.");
    expect(markup).toContain("No Variant Groups.");
    expect(markup).toContain("Canvas / Preview");
    expect(markup).not.toContain("Parts / Structure Tree");
    expect(markup).not.toContain("Inspector");
    expect(markup).not.toContain("Parameter Bar");
  });
});
