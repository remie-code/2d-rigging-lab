import type { ReactElement } from "react";
import { Crosshair, Monitor, RefreshCcw } from "lucide-react";

import {
  ErrorNotice,
  IconTextButton,
  Panel,
  StatusRow
} from "./control-window-components";
import { formatControlNumber } from "./control-window-formatters";
import type {
  RuntimePlayerStageStateSnapshot,
  RuntimePlayerWindowBounds
} from "../preload/runtime-player-bridge-contract";

export function StagePage({
  stageState,
  onFocusStage,
  onResetView,
  onCenterModel
}: {
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly onFocusStage: () => void;
  readonly onResetView: () => void;
  readonly onCenterModel: () => void;
}): ReactElement {
  const bounds = stageState?.stageWindow.bounds ?? null;
  const transform = stageState?.stageView.transform ?? null;
  const persistence = stageState?.persistence ?? null;

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Stage Window">
          <StatusRow
            label="Status"
            value={formatStageWindowStatus(stageState)}
          />
          <StatusRow label="Position" value={formatBoundsPosition(bounds)} />
          <StatusRow label="Size" value={formatBoundsSize(bounds)} />
          <StatusRow
            label="Render"
            value={stageState?.stageView.renderStatus.statusLabel ?? "Checking"}
          />
          <div className="mt-4">
            <IconTextButton
              icon={Monitor}
              label="Focus Stage"
              onClick={onFocusStage}
              variant="secondary"
            />
          </div>
        </Panel>

        <Panel title="View">
          <StatusRow
            label="Zoom"
            value={
              transform === null
                ? "Checking"
                : `${Math.round(transform.zoomScale * 100)}%`
            }
          />
          <StatusRow
            label="Pan"
            value={
              transform === null
                ? "Checking"
                : `x ${formatControlNumber(transform.pan.x)} / y ${formatControlNumber(transform.pan.y)}`
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <IconTextButton
              icon={RefreshCcw}
              label="Reset View"
              onClick={onResetView}
              variant="secondary"
            />
            <IconTextButton
              icon={Crosshair}
              label="Center Model"
              onClick={onCenterModel}
              variant="ghost"
            />
          </div>
        </Panel>
      </section>

      <Panel title="Auto Save">
        <StatusRow
          label="Status"
          value={persistence?.statusLabel ?? "Checking"}
        />
        <StatusRow
          label="Updated"
          value={persistence?.updatedAtIso ?? "Checking"}
        />
        <StatusRow
          label="Storage"
          value={persistence?.storageLabel ?? "window-state/runtime-player.json"}
        />
        {persistence !== null && persistence.warningMessages.length > 0 ? (
          <ErrorNotice
            title="Stage state persistence warning"
            details={persistence.warningMessages}
          />
        ) : null}
      </Panel>
    </div>
  );
}

function formatStageWindowStatus(
  stageState: RuntimePlayerStageStateSnapshot | null
): string {
  if (stageState === null) {
    return "Checking";
  }

  return stageState.stageWindow.windowState === "created"
    ? "Open"
    : "Unavailable";
}

function formatBoundsPosition(bounds: RuntimePlayerWindowBounds | null): string {
  if (bounds === null) {
    return "Checking";
  }

  return `x ${bounds.x} / y ${bounds.y}`;
}

function formatBoundsSize(bounds: RuntimePlayerWindowBounds | null): string {
  if (bounds === null) {
    return "Checking";
  }

  return `${bounds.width} x ${bounds.height}`;
}
