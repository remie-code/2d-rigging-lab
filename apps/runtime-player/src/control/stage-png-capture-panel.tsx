import type { ReactElement } from "react";
import { Camera, FolderOpen } from "lucide-react";

import { IconTextButton, Panel, StatusRow } from "./control-window-components";
import type {
  RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";
import type { RuntimeExportStatus } from "../preload/runtime-export-bridge-contract";

export type StagePngCaptureAvailability = {
  readonly available: boolean;
  readonly label: string;
};

/**
 * Capture PNG needs a loaded model and a live Stage Window, and is held while a
 * capture is in flight. Main re-checks the first two on its side.
 */
export function getStagePngCaptureAvailability(input: {
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly busy: boolean;
}): StagePngCaptureAvailability {
  if (input.busy) {
    return { available: false, label: "Capturing" };
  }

  if (input.runtimeExportStatus?.status !== "loaded") {
    return { available: false, label: "Load a model to capture" };
  }

  if (input.stageState === null) {
    return { available: false, label: "Checking" };
  }

  if (input.stageState.stageWindow.windowState === "destroyed") {
    return { available: false, label: "Stage Window closed" };
  }

  return { available: true, label: "Ready" };
}

export function StagePngCapturePanel({
  runtimeExportStatus,
  stageState,
  busy,
  onCapturePng,
  onOpenFolder
}: {
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly busy: boolean;
  readonly onCapturePng: () => void;
  readonly onOpenFolder: () => void;
}): ReactElement {
  const availability = getStagePngCaptureAvailability({
    runtimeExportStatus,
    stageState,
    busy
  });

  return (
    <Panel title="Thumbnail Capture">
      <StatusRow label="Capture" value={availability.label} />
      <StatusRow label="Saves to" value="Pictures\Runtime Player" />
      <div className="mt-2 rounded-md border border-neutral-800 bg-[#111312] p-3 text-xs text-neutral-300">
        Saves the Stage canvas as a transparent PNG at the window's actual
        pixel size.
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <IconTextButton
          icon={Camera}
          label="Capture PNG"
          onClick={onCapturePng}
          variant="primary"
          disabled={!availability.available}
        />
        <IconTextButton
          icon={FolderOpen}
          label="Open Folder"
          onClick={onOpenFolder}
          variant="secondary"
        />
      </div>
    </Panel>
  );
}
