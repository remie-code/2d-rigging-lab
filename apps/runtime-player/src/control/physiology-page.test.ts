import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PhysiologyPage } from "./physiology-page";
import type {
  PhysiologySectionResetRequest,
  PhysiologySectionStatus,
  PhysiologyStagePresenceEnabledRequest,
  PhysiologyStatus,
  PhysiologyToneUpdateRequest
} from "../preload/physiology-bridge-contract";

describe("PhysiologyPage", () => {
  it("renders the tracking-host empty state (no physiology, driven by tracking)", () => {
    const markup = renderPhysiologyMarkup({
      physiologyStatus: createStatus({
        available: false,
        status: "unavailable"
      })
    });

    expect(markup).toContain(
      "This host has no physiology; the body is driven by tracking."
    );
    // No sliders when there is no physiology subsystem.
    expect(markup).not.toContain("Camera Focus");
  });

  it("renders the Runtime-Export-required empty state", () => {
    const markup = renderPhysiologyMarkup({
      physiologyStatus: createStatus({
        available: true,
        status: "unavailable"
      })
    });

    expect(markup).toContain(
      "Physiology comes alive once a Runtime Export is loaded."
    );
    expect(markup).not.toContain("Camera Focus");
  });

  it("renders all quality-word sections and sliders when available and loaded", () => {
    const markup = renderPhysiologyMarkup();

    expect(markup).toContain("Physiology");
    // Section titles.
    expect(markup).toContain("Blink");
    expect(markup).toContain("Gaze");
    expect(markup).toContain("Head");
    expect(markup).toContain("Posture");
    expect(markup).toContain("Speech");
    expect(markup).toContain("Stage Presence");
    // Quality-word slider labels.
    expect(markup).toContain("Frequency");
    expect(markup).toContain("Calmness");
    expect(markup).toContain("Crispness");
    expect(markup).toContain("Quirk");
    expect(markup).toContain("Camera Focus");
    expect(markup).toContain("Dwell");
    expect(markup).toContain("Sway");
    expect(markup).toContain("Follow");
    expect(markup).toContain("Drift");
    expect(markup).toContain("Articulation");
    expect(markup).toContain("Strength");
  });

  it("renders the always-on one-line caption for every slider (UX §3.1 verbatim)", () => {
    // React escapes the apostrophe (body's) to &#x27; in static markup; decode it so
    // the assertion compares against the verbatim UX §3.1 text.
    const markup = renderPhysiologyMarkup().replace(/&#x27;/g, "'");

    // All 12 captions, verbatim from UX §3.1 — spec突合 blocking on any typo.
    const captions = [
      "How often the blink comes. Right = more often.",
      "Evenness of the blink rhythm. Right = steadier.",
      "Speed of close and open. Right = snappier.",
      "Chance of a quick double blink. Right = more often.",
      "How strongly the gaze returns to the camera. Right = more eye contact.",
      "How often and how far the eyes wander. Right = busier.",
      "How long the gaze rests in one place. Right = longer.",
      "Size of the idle head motion. Right = larger.",
      "How deeply the head follows big gaze jumps. Right = deeper.",
      "Slow sway of the body's center. Right = larger.",
      "How often the body re-seats. Right = more often. Takes minutes to observe.",
      "How sharply the mouth re-forms between beats. Right = crisper.",
      "How far the stage position follows posture. Right = farther."
    ];
    for (const caption of captions) {
      expect(markup).toContain(caption);
    }
  });

  it("never exposes engineering numbers (ms / Hz / probability) — quality words only", () => {
    const markup = renderPhysiologyMarkup();

    // Units that would only appear if an engineering value leaked into the UI.
    expect(markup).not.toContain("Hz");
    expect(markup).not.toContain("probability");
    expect(markup).not.toContain("/min");
    expect(markup).not.toContain("blinks");
    // Internal schema values must not leak into the UI (design §6 is main's knowledge).
    expect(markup).not.toContain("3529");
    expect(markup).not.toContain("1400");
    expect(markup).not.toContain("6000");
    expect(markup).not.toContain("0.55");
    expect(markup).not.toContain("0.12");
  });

  it("wires per-section Reset and disables it when the section has no override", () => {
    const onResetSection = vi.fn();
    const tree = createPhysiologyTree({
      physiologyStatus: createStatus({
        sections: [
          createSection("blink", { hasOverride: true }),
          createSection("gaze"),
          createSection("head"),
          createSection("posture"),
          createStagePresenceSection()
        ]
      }),
      onResetSection
    });

    // Blink has an override → its Reset is enabled and fires with the section id.
    clickButton(tree, "Reset Blink");
    expect(onResetSection).toHaveBeenCalledWith({ section: "blink" });

    // Gaze has no override → its Reset is disabled.
    const gazeReset = findElementByAriaLabelOrLabel(tree, "Reset Gaze");
    expect(gazeReset?.disabled).toBe(true);
  });

  it("wires tone sliders and the Stage Presence toggle", () => {
    const onUpdateTone = vi.fn();
    const onSetStagePresenceEnabled = vi.fn();
    const tree = createPhysiologyTree({
      onUpdateTone,
      onSetStagePresenceEnabled
    });

    changeRange(tree, "Physiology Gaze Camera Focus", "0.8");
    expect(onUpdateTone).toHaveBeenCalledWith({
      section: "gaze",
      field: "cameraFocus",
      tone: 0.8
    });

    changeRange(tree, "Physiology Stage Presence Strength", "0.4");
    expect(onUpdateTone).toHaveBeenCalledWith({
      section: "stagePresence",
      field: "strength",
      tone: 0.4
    });

    changeCheckbox(tree, "Stage Presence Enabled", true);
    expect(onSetStagePresenceEnabled).toHaveBeenCalledWith({ enabled: true });
  });

  it("reflects the Stage Presence toggle state into the checkbox", () => {
    const offTree = createPhysiologyTree({
      physiologyStatus: createStatus({
        sections: [
          createSection("blink"),
          createSection("gaze"),
          createSection("head"),
          createSection("posture"),
          createStagePresenceSection({ stagePresenceEnabled: false })
        ]
      })
    });
    const onTree = createPhysiologyTree({
      physiologyStatus: createStatus({
        sections: [
          createSection("blink"),
          createSection("gaze"),
          createSection("head"),
          createSection("posture"),
          createStagePresenceSection({ stagePresenceEnabled: true })
        ]
      })
    });

    expect(
      findElementByAriaLabelOrLabel(offTree, "Stage Presence Enabled")?.checked
    ).toBe(false);
    expect(
      findElementByAriaLabelOrLabel(onTree, "Stage Presence Enabled")?.checked
    ).toBe(true);
  });
});

function renderPhysiologyMarkup(input: PhysiologyPageTestInput = {}): string {
  return renderToStaticMarkup(createPhysiologyTree(input));
}

function createPhysiologyTree(
  input: PhysiologyPageTestInput = {}
): ReactElement {
  return createElement(PhysiologyPage, {
    physiologyStatus: input.physiologyStatus ?? createStatus(),
    onUpdateTone: input.onUpdateTone ?? (() => undefined),
    onSetStagePresenceEnabled:
      input.onSetStagePresenceEnabled ?? (() => undefined),
    onResetSection: input.onResetSection ?? (() => undefined),
    onRetryProfileSave: input.onRetryProfileSave ?? (() => undefined)
  });
}

function createStatus(patch: Partial<PhysiologyStatus> = {}): PhysiologyStatus {
  const sections = patch.sections ?? [
    createSection("blink"),
    createSection("gaze"),
    createSection("head"),
    createSection("posture"),
    createSection("speech"),
    createStagePresenceSection()
  ];

  return {
    available: true,
    status: "ready",
    statusLabel: "Physiology sections 0 / 6 tuned",
    runtimeExport: {
      packageId: "pkg-physiology",
      packageRevision: 1,
      loadedAtIso: "2026-07-01T00:00:00.000Z",
      modelDisplayName: "Physiology Test Model"
    },
    profileStatus: {
      kind: "default",
      label: "No saved profile; using universal physiology",
      warningMessages: []
    },
    sections,
    overriddenSectionCount: 0,
    revision: 1,
    updatedAtIso: "2026-07-01T00:00:00.000Z",
    ...patch
  };
}

function createSection(
  section: PhysiologySectionStatus["section"],
  patch: Partial<PhysiologySectionStatus> = {}
): PhysiologySectionStatus {
  const tonesBySection: Record<string, Record<string, number>> = {
    blink: { frequency: 0.5, calmness: 0.5, crispness: 0.5, quirk: 0.5 },
    gaze: { cameraFocus: 0.5, restlessness: 0.5, dwell: 0.5 },
    head: { sway: 0.5, follow: 0.5 },
    posture: { drift: 0.5, restlessness: 0.5 },
    speech: { articulation: 0.5 }
  };

  return {
    section,
    hasOverride: false,
    tones: tonesBySection[section] ?? {},
    ...patch
  };
}

function createStagePresenceSection(
  patch: Partial<PhysiologySectionStatus> = {}
): PhysiologySectionStatus {
  return {
    section: "stagePresence",
    hasOverride: false,
    tones: { strength: 0.3 },
    stagePresenceEnabled: false,
    ...patch
  };
}

function changeRange(node: ReactNode, ariaLabel: string, value: string): void {
  const props = findElementByAriaLabelOrLabel(node, ariaLabel);
  expect(props?.onChange).toBeTypeOf("function");
  props?.onChange?.({ currentTarget: { value, checked: false } });
}

function changeCheckbox(
  node: ReactNode,
  ariaLabel: string,
  checked: boolean
): void {
  const props = findElementByAriaLabelOrLabel(node, ariaLabel);
  expect(props?.onChange).toBeTypeOf("function");
  props?.onChange?.({ currentTarget: { value: "", checked } });
}

function clickButton(node: ReactNode, label: string): void {
  const props = findElementByAriaLabelOrLabel(node, label);
  expect(props?.onClick).toBeTypeOf("function");
  expect(props?.disabled).not.toBe(true);
  props?.onClick?.();
}

function findElementByAriaLabelOrLabel(
  node: ReactNode,
  label: string
): ElementProps | null {
  if (!isValidElement(node)) {
    return null;
  }

  const props = node.props as ElementProps;
  if (props["aria-label"] === label || props.label === label) {
    return props;
  }

  if (typeof node.type === "function") {
    return findElementByAriaLabelOrLabel(
      (node.type as ComponentFunction)(node.props),
      label
    );
  }

  for (const child of Children.toArray(props.children)) {
    const match = findElementByAriaLabelOrLabel(child, label);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

type PhysiologyPageTestInput = {
  readonly physiologyStatus?: PhysiologyStatus;
  readonly onUpdateTone?: (request: PhysiologyToneUpdateRequest) => void;
  readonly onSetStagePresenceEnabled?: (
    request: PhysiologyStagePresenceEnabledRequest
  ) => void;
  readonly onResetSection?: (request: PhysiologySectionResetRequest) => void;
  readonly onRetryProfileSave?: () => void;
};

type ComponentFunction = (props: unknown) => ReactNode;

type ElementProps = {
  readonly "aria-label"?: unknown;
  readonly label?: unknown;
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly checked?: boolean;
  readonly onChange?: (event: {
    readonly currentTarget: {
      readonly value: string;
      readonly checked: boolean;
    };
  }) => void;
};
