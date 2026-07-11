import type { ReactElement } from "react";
import { Activity, RefreshCw, RotateCcw } from "lucide-react";

import {
  ErrorNotice,
  IconTextButton,
  Panel,
  StatusRow
} from "./control-window-components";
import type {
  PhysiologySectionId,
  PhysiologySectionResetRequest,
  PhysiologySectionStatus,
  PhysiologyStagePresenceEnabledRequest,
  PhysiologyStatus,
  PhysiologyToneUpdateRequest
} from "../preload/physiology-bridge-contract";

/**
 * Physiology page (C3 Domain C, UX c3-physiology-profile.md). Every slider is a
 * QUALITY WORD (質感語): no ms / Hz / probability numbers are shown (UX §3), no value
 * readout, no waveform / graph / numeric field (UX §5). No preview button — the Stage
 * is the always-on preview (UX §1). Two empty states (UX §6): tracking host (no
 * physiology) and Runtime Export not loaded. Stage Presence alone carries a toggle
 * (既定 Off); its Strength slider is placed here but DRIVEN by Domain D.
 */

type PhysiologySliderSpec = {
  readonly field: string;
  readonly label: string;
  // Always-on one-line caption under the label (UX §3.1). Verbatim quality-word
  // guidance; no ms / Hz / probability numbers (UX §3, 数字非露出の規律).
  readonly caption: string;
};

type PhysiologySectionSpec = {
  readonly section: PhysiologySectionId;
  readonly title: string;
  readonly sliders: readonly PhysiologySliderSpec[];
};

// The behaviour-adjustment cluster of sections (UX §2). Labels are English quality
// words (UX §3); the internal element each maps to is design §6 knowledge, not the UI's.
const physiologySectionSpecs: readonly PhysiologySectionSpec[] = [
  {
    section: "blink",
    title: "Blink",
    sliders: [
      {
        field: "frequency",
        label: "Frequency",
        caption: "How often the blink comes. Right = more often."
      },
      {
        field: "calmness",
        label: "Calmness",
        caption: "Evenness of the blink rhythm. Right = steadier."
      },
      {
        field: "crispness",
        label: "Crispness",
        caption: "Speed of close and open. Right = snappier."
      },
      {
        field: "quirk",
        label: "Quirk",
        caption: "Chance of a quick double blink. Right = more often."
      }
    ]
  },
  {
    section: "gaze",
    title: "Gaze",
    sliders: [
      {
        field: "cameraFocus",
        label: "Camera Focus",
        caption:
          "How strongly the gaze returns to the camera. Right = more eye contact."
      },
      {
        field: "restlessness",
        label: "Restlessness",
        caption: "How often and how far the eyes wander. Right = busier."
      },
      {
        field: "dwell",
        label: "Dwell",
        caption: "How long the gaze rests in one place. Right = longer."
      }
    ]
  },
  {
    section: "head",
    title: "Head",
    sliders: [
      {
        field: "sway",
        label: "Sway",
        caption: "Size of the idle head motion. Right = larger."
      },
      {
        field: "follow",
        label: "Follow",
        caption: "How deeply the head follows big gaze jumps. Right = deeper."
      }
    ]
  },
  {
    section: "posture",
    title: "Posture",
    sliders: [
      {
        field: "drift",
        label: "Drift",
        caption: "Slow sway of the body's center. Right = larger."
      },
      {
        field: "restlessness",
        label: "Restlessness",
        caption:
          "How often the body re-seats. Right = more often. Takes minutes to observe."
      }
    ]
  }
];

const STAGE_PRESENCE_TITLE = "Stage Presence";

export function PhysiologyPage({
  physiologyStatus,
  onUpdateTone,
  onSetStagePresenceEnabled,
  onResetSection,
  onRetryProfileSave
}: {
  readonly physiologyStatus: PhysiologyStatus | null;
  readonly onUpdateTone: (request: PhysiologyToneUpdateRequest) => void;
  readonly onSetStagePresenceEnabled: (
    request: PhysiologyStagePresenceEnabledRequest
  ) => void;
  readonly onResetSection: (request: PhysiologySectionResetRequest) => void;
  readonly onRetryProfileSave: () => void;
}): ReactElement {
  const statusLabel = physiologyStatus?.profileStatus.label ?? "Checking";

  return (
    <div className="grid gap-4">
      <Panel title="Physiology">
        <StatusRow
          label="Runtime Export"
          value={physiologyStatus?.runtimeExport?.modelDisplayName ?? "Not loaded"}
        />
        <StatusRow label="Profile" value={statusLabel} />
        <StatusRow label="Persistence" value="Automatic" />
        {physiologyStatus?.profileStatus.warningMessages.length ? (
          <ErrorNotice
            title="Physiology profile warning"
            details={physiologyStatus.profileStatus.warningMessages}
          />
        ) : null}
        {physiologyStatus?.profileStatus.kind === "save-failed" ? (
          <div className="mt-4">
            <IconTextButton
              icon={RefreshCw}
              label="Retry"
              onClick={onRetryProfileSave}
              variant="secondary"
            />
          </div>
        ) : null}
      </Panel>

      {renderPhysiologyContent({
        physiologyStatus,
        onUpdateTone,
        onSetStagePresenceEnabled,
        onResetSection
      })}
    </div>
  );
}

function renderPhysiologyContent(input: {
  readonly physiologyStatus: PhysiologyStatus | null;
  readonly onUpdateTone: (request: PhysiologyToneUpdateRequest) => void;
  readonly onSetStagePresenceEnabled: (
    request: PhysiologyStagePresenceEnabledRequest
  ) => void;
  readonly onResetSection: (request: PhysiologySectionResetRequest) => void;
}): ReactElement {
  const status = input.physiologyStatus;

  if (status === null) {
    return (
      <Panel title="Physiology">
        <EmptyPhysiologyState
          title="Checking physiology"
          message="Runtime Player is loading the physiology bridge status."
        />
      </Panel>
    );
  }

  // Empty state ② (UX §6.2): the Tracking Host has no physiology subsystem — the
  // body is driven by tracking. A one-line degraded page (C1 方式), no nav工事.
  if (!status.available) {
    return (
      <Panel title="Physiology">
        <EmptyPhysiologyState
          title="No physiology on this host"
          message="This host has no physiology; the body is driven by tracking."
        />
      </Panel>
    );
  }

  // Empty state ① (UX §6.1): physiology comes alive once a Runtime Export is loaded.
  if (status.status === "unavailable") {
    return (
      <Panel title="Physiology">
        <EmptyPhysiologyState
          title="Runtime Export required"
          message="Physiology comes alive once a Runtime Export is loaded."
        />
      </Panel>
    );
  }

  const sectionStatuses = new Map<PhysiologySectionId, PhysiologySectionStatus>(
    status.sections.map((section) => [section.section, section])
  );

  return (
    <div className="grid gap-3">
      {physiologySectionSpecs.map((spec) => (
        <PhysiologySectionCard
          key={spec.section}
          spec={spec}
          sectionStatus={sectionStatuses.get(spec.section) ?? null}
          onUpdateTone={input.onUpdateTone}
          onResetSection={input.onResetSection}
        />
      ))}
      <StagePresenceCard
        sectionStatus={sectionStatuses.get("stagePresence") ?? null}
        onUpdateTone={input.onUpdateTone}
        onSetStagePresenceEnabled={input.onSetStagePresenceEnabled}
        onResetSection={input.onResetSection}
      />
    </div>
  );
}

function PhysiologySectionCard({
  spec,
  sectionStatus,
  onUpdateTone,
  onResetSection
}: {
  readonly spec: PhysiologySectionSpec;
  readonly sectionStatus: PhysiologySectionStatus | null;
  readonly onUpdateTone: (request: PhysiologyToneUpdateRequest) => void;
  readonly onResetSection: (request: PhysiologySectionResetRequest) => void;
}): ReactElement {
  const hasOverride = sectionStatus?.hasOverride ?? false;

  return (
    <Panel title={spec.title}>
      <div className="mb-3 flex justify-end">
        <IconTextButton
          icon={RotateCcw}
          label={`Reset ${spec.title}`}
          onClick={() => onResetSection({ section: spec.section })}
          variant="ghost"
          disabled={!hasOverride}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {spec.sliders.map((slider) => (
          <ToneSlider
            key={slider.field}
            sectionTitle={spec.title}
            section={spec.section}
            slider={slider}
            tone={sectionStatus?.tones[slider.field] ?? 0.5}
            onUpdateTone={onUpdateTone}
          />
        ))}
      </div>
    </Panel>
  );
}

function StagePresenceCard({
  sectionStatus,
  onUpdateTone,
  onSetStagePresenceEnabled,
  onResetSection
}: {
  readonly sectionStatus: PhysiologySectionStatus | null;
  readonly onUpdateTone: (request: PhysiologyToneUpdateRequest) => void;
  readonly onSetStagePresenceEnabled: (
    request: PhysiologyStagePresenceEnabledRequest
  ) => void;
  readonly onResetSection: (request: PhysiologySectionResetRequest) => void;
}): ReactElement {
  const enabled = sectionStatus?.stagePresenceEnabled ?? false;
  const hasOverride = sectionStatus?.hasOverride ?? false;

  return (
    <Panel title={STAGE_PRESENCE_TITLE}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex min-h-8 items-center gap-2 text-xs font-semibold text-neutral-200">
          <input
            type="checkbox"
            aria-label="Stage Presence Enabled"
            checked={enabled}
            onChange={(event) =>
              onSetStagePresenceEnabled({
                enabled: event.currentTarget.checked
              })
            }
            className="size-4 accent-teal-400"
          />
          {enabled ? "On" : "Off"}
        </label>
        <IconTextButton
          icon={RotateCcw}
          label={`Reset ${STAGE_PRESENCE_TITLE}`}
          onClick={() => onResetSection({ section: "stagePresence" })}
          variant="ghost"
          disabled={!hasOverride}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ToneSlider
          sectionTitle={STAGE_PRESENCE_TITLE}
          section="stagePresence"
          slider={{
            field: "strength",
            label: "Strength",
            caption:
              "How far the stage position follows posture. Right = farther."
          }}
          tone={sectionStatus?.tones.strength ?? 0.3}
          onUpdateTone={onUpdateTone}
        />
      </div>
    </Panel>
  );
}

function ToneSlider({
  sectionTitle,
  section,
  slider,
  tone,
  onUpdateTone
}: {
  readonly sectionTitle: string;
  readonly section: PhysiologySectionId;
  readonly slider: PhysiologySliderSpec;
  readonly tone: number;
  readonly onUpdateTone: (request: PhysiologyToneUpdateRequest) => void;
}): ReactElement {
  return (
    <label className="grid gap-1 text-xs font-semibold text-neutral-200">
      <span>{slider.label}</span>
      <span className="text-[11px] font-normal leading-snug text-neutral-400">
        {slider.caption}
      </span>
      <input
        type="range"
        aria-label={`Physiology ${sectionTitle} ${slider.label}`}
        min={0}
        max={1}
        step={0.01}
        value={tone}
        onChange={(event) =>
          onUpdateTone({
            section,
            field: slider.field,
            tone: Number(event.currentTarget.value)
          })
        }
        className="w-full accent-teal-400"
      />
    </label>
  );
}

function EmptyPhysiologyState({
  title,
  message
}: {
  readonly title: string;
  readonly message: string;
}): ReactElement {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200">
          <Activity aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-100">{title}</p>
          <p className="mt-1 text-sm text-neutral-400">{message}</p>
        </div>
      </div>
    </div>
  );
}
