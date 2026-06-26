import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Activity, Copy, RefreshCcw, Square } from "lucide-react";

import {
  IconTextButton,
  Panel,
  StatusRow
} from "./control-window-components";
import {
  createPerformanceDiagnosticsCaptureSample,
  createPerformanceDiagnosticsReport,
  formatPerformanceDiagnosticsReport,
  type PerformanceDiagnosticsCaptureSample,
  type PerformanceDiagnosticsReport,
  type PerformanceDiagnosticsTarget
} from "./performance-diagnostics-report";
import { formatControlNumber } from "./control-window-formatters";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";
import type {
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type {
  RuntimePlayerRuntimeCoreProfilingMode,
  RuntimePlayerStageRenderMetricsSnapshot
} from "../preload/performance-diagnostics-contract";
import type {
  RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";

type CaptureUiState =
  | {
      readonly status: "idle";
      readonly sampleCount: number;
      readonly report: null;
      readonly reportText: string | null;
    }
  | {
      readonly status: "running";
      readonly startedAtIso: string;
      readonly requestedDurationMs: number;
      readonly sampleCount: number;
      readonly report: null;
      readonly reportText: null;
    }
  | {
      readonly status: "complete";
      readonly sampleCount: number;
      readonly report: PerformanceDiagnosticsReport;
      readonly reportText: string;
    };

type CaptureDraft = {
  readonly target: PerformanceDiagnosticsTarget;
  readonly startedAtIso: string;
  readonly startedAtMs: number;
  readonly requestedDurationMs: number;
  readonly samples: PerformanceDiagnosticsCaptureSample[];
};

const durationOptions = [
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" }
] as const;

const targetOptions: readonly {
  readonly value: PerformanceDiagnosticsTarget;
  readonly label: string;
}[] = [
  { value: "native-stage", label: "Native Stage" },
  { value: "both", label: "Both" },
  { value: "browser-source", label: "Browser Source" }
];

export function PerformanceDiagnosticsPage({
  inputStatus,
  stageState,
  nativeStageMetrics,
  browserSourceStatus,
  onCopyReport,
  onSetRuntimeCoreProfiling
}: {
  readonly inputStatus: RuntimePlayerInputStatus | null;
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly nativeStageMetrics: RuntimePlayerStageRenderMetricsSnapshot | null;
  readonly browserSourceStatus: RuntimePlayerBrowserSourceStatus | null;
  readonly onCopyReport: (reportText: string) => void;
  readonly onSetRuntimeCoreProfiling?: (request: {
    readonly target: PerformanceDiagnosticsTarget;
    readonly mode: RuntimePlayerRuntimeCoreProfilingMode;
  }) => void | Promise<void>;
}): ReactElement {
  const [target, setTarget] =
    useState<PerformanceDiagnosticsTarget>("native-stage");
  const [durationSeconds, setDurationSeconds] = useState(10);
  const [capture, setCapture] = useState<CaptureUiState>({
    status: "idle",
    sampleCount: 0,
    report: null,
    reportText: null
  });
  const latestSampleRef = useRef(createSafeCurrentSample({
    inputStatus,
    stageState,
    nativeStageMetrics,
    browserSourceStatus
  }));
  const draftRef = useRef<CaptureDraft | null>(null);
  const timerRef = useRef<number | null>(null);
  const profilingTargetRef = useRef<PerformanceDiagnosticsTarget | null>(null);
  const setRuntimeCoreProfilingRef = useRef(onSetRuntimeCoreProfiling);

  latestSampleRef.current = createSafeCurrentSample({
    inputStatus,
    stageState,
    nativeStageMetrics,
    browserSourceStatus
  });
  setRuntimeCoreProfilingRef.current = onSetRuntimeCoreProfiling;

  useEffect(() => {
    const draft = draftRef.current;
    if (draft === null) {
      return;
    }

    draft.samples.push(stampCaptureSample(latestSampleRef.current));
    setCapture((current) =>
      current.status === "running"
        ? {
            ...current,
            sampleCount: draft.samples.length
          }
        : current
    );
  }, [inputStatus, stageState, nativeStageMetrics, browserSourceStatus]);

  useEffect(() => () => {
    clearCaptureTimer(timerRef);
    disableCaptureRuntimeCoreProfiling();
  }, []);

  function startCapture(): void {
    if (draftRef.current !== null) {
      return;
    }

    clearCaptureTimer(timerRef);
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const requestedDurationMs = durationSeconds * 1000;
    profilingTargetRef.current = target;
    requestCaptureRuntimeCoreProfiling(target, "deep");
    const draft: CaptureDraft = {
      target,
      startedAtIso,
      startedAtMs,
      requestedDurationMs,
      samples: [stampCaptureSample(latestSampleRef.current)]
    };

    draftRef.current = draft;
    setCapture({
      status: "running",
      startedAtIso,
      requestedDurationMs,
      sampleCount: draft.samples.length,
      report: null,
      reportText: null
    });
    timerRef.current = window.setTimeout(() => {
      finishCapture();
    }, requestedDurationMs);
  }

  function finishCapture(): void {
    const draft = draftRef.current;
    if (draft === null) {
      return;
    }

    clearCaptureTimer(timerRef);
    draft.samples.push(stampCaptureSample(latestSampleRef.current));
    const endedAtMs = Date.now();
    const report = createPerformanceDiagnosticsReport({
      target: draft.target,
      startedAtIso: draft.startedAtIso,
      endedAtIso: new Date(endedAtMs).toISOString(),
      durationMs: endedAtMs - draft.startedAtMs,
      requestedDurationMs: draft.requestedDurationMs,
      samples: draft.samples
    });
    const reportText = formatPerformanceDiagnosticsReport(report);

    disableCaptureRuntimeCoreProfiling();
    draftRef.current = null;
    setCapture({
      status: "complete",
      sampleCount: draft.samples.length,
      report,
      reportText
    });
  }

  function clearCapture(): void {
    clearCaptureTimer(timerRef);
    draftRef.current = null;
    disableCaptureRuntimeCoreProfiling();
    setCapture({
      status: "idle",
      sampleCount: 0,
      report: null,
      reportText: null
    });
  }

  const currentReport = capture.report;
  const reportText = capture.reportText;

  function requestCaptureRuntimeCoreProfiling(
    captureTarget: PerformanceDiagnosticsTarget,
    mode: RuntimePlayerRuntimeCoreProfilingMode
  ): void {
    try {
      const result = setRuntimeCoreProfilingRef.current?.({
        target: captureTarget,
        mode
      });
      if (result !== undefined) {
        void Promise.resolve(result).catch((error: unknown) => {
          console.error(
            "Performance Diagnostics profiling request failed.",
            error
          );
        });
      }
    } catch (error) {
      console.error(
        "Performance Diagnostics profiling request failed.",
        error
      );
    }
  }

  function disableCaptureRuntimeCoreProfiling(): void {
    const captureTarget = profilingTargetRef.current;
    if (captureTarget === null) {
      return;
    }

    profilingTargetRef.current = null;
    requestCaptureRuntimeCoreProfiling(captureTarget, "disabled");
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Performance Diagnostics Capture">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-semibold text-neutral-500">
                Target
              </span>
              <select
                aria-label="Performance Diagnostics Target"
                value={target}
                onChange={(event) =>
                  setTarget(event.currentTarget.value as PerformanceDiagnosticsTarget)
                }
                disabled={capture.status === "running"}
                className="min-h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-neutral-100 outline-none focus:border-teal-500 disabled:opacity-60"
              >
                {targetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-semibold text-neutral-500">
                Duration
              </span>
              <select
                aria-label="Performance Diagnostics Duration"
                value={durationSeconds}
                onChange={(event) =>
                  setDurationSeconds(Number(event.currentTarget.value))
                }
                disabled={capture.status === "running"}
                className="min-h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-neutral-100 outline-none focus:border-teal-500 disabled:opacity-60"
              >
                {durationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <StatusRow label="Capture" value={formatCaptureStatus(capture)} />
          <StatusRow
            label="Samples"
            value={String(capture.sampleCount)}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <IconTextButton
              icon={Activity}
              label="Start Capture"
              onClick={startCapture}
              variant="primary"
              disabled={capture.status === "running"}
            />
            <IconTextButton
              icon={Square}
              label="Stop Capture"
              onClick={finishCapture}
              variant="secondary"
              disabled={capture.status !== "running"}
            />
            <IconTextButton
              icon={Copy}
              label="Copy Report"
              onClick={() => {
                if (reportText !== null) {
                  onCopyReport(reportText);
                }
              }}
              variant="ghost"
              disabled={reportText === null}
            />
            <IconTextButton
              icon={RefreshCcw}
              label="Clear Report"
              onClick={clearCapture}
              variant="ghost"
              disabled={capture.status === "idle" && capture.sampleCount === 0}
            />
          </div>
        </Panel>

        <Panel title="Target Availability">
          <StatusRow
            label="Native Stage"
            value={formatNativeAvailability(stageState, nativeStageMetrics)}
          />
          <StatusRow
            label="Browser Source"
            value={formatBrowserSourceAvailability(browserSourceStatus)}
          />
          <StatusRow
            label="Stage Motion"
            value={formatStageMotion(stageState)}
          />
          <StatusRow
            label="Input Receive FPS"
            value={formatNullableFps(
              currentReport?.input.inputReceiveFpsLatest ??
                inputStatus?.estimatedFps ??
                null
            )}
          />
          <StatusRow
            label="Input Packet Count"
            value={formatNullableCount(
              currentReport?.input.inputPacketCount ??
                inputStatus?.packetCount ??
                null
            )}
          />
          <StatusRow
            label="Native Render FPS"
            value={formatNullableFps(currentReport?.nativeStage.renderFps ?? null)}
          />
          <StatusRow
            label="Browser Render FPS"
            value={formatNullableFps(
              currentReport?.browserSource.renderFps ?? null
            )}
          />
          <StatusRow
            label="Browser Source Timestamp FPS"
            value={formatNullableFps(
              currentReport?.browserSource.liveFrameSourceTimestampFpsLatest ??
                browserSourceStatus?.latestRendererDiagnostics?.sourceFps ??
                browserSourceStatus?.latestRendererDiagnostics?.fps ??
                null
            )}
          />
        </Panel>
      </section>

      <Panel title="Comparison Runs">
        <StatusRow label="Native Stage only" value="Target Native Stage" />
        <StatusRow
          label="Browser Source connected"
          value="Target Browser Source or Both"
        />
        <StatusRow label="Stage Motion" value="Capture Off and On states" />
        <StatusRow label="OBS custom FPS" value="Manual observation" />
      </Panel>

      <Panel title="Report Preview">
        {reportText === null ? (
          <div className="rounded-md border border-neutral-800 bg-[#111312] p-3 text-sm text-neutral-300">
            No capture report yet.
          </div>
        ) : (
          <pre className="max-h-96 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-200">
            {reportText}
          </pre>
        )}
      </Panel>
    </div>
  );
}

function createSafeCurrentSample(input: {
  readonly inputStatus: RuntimePlayerInputStatus | null;
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly nativeStageMetrics: RuntimePlayerStageRenderMetricsSnapshot | null;
  readonly browserSourceStatus: RuntimePlayerBrowserSourceStatus | null;
}): PerformanceDiagnosticsCaptureSample {
  return createPerformanceDiagnosticsCaptureSample({
    capturedAtMs: 0,
    inputStatus: input.inputStatus,
    stageState: input.stageState,
    nativeStageMetrics: input.nativeStageMetrics,
    browserSourceStatus: input.browserSourceStatus
  });
}

function stampCaptureSample(
  sample: PerformanceDiagnosticsCaptureSample
): PerformanceDiagnosticsCaptureSample {
  return {
    ...sample,
    capturedAtMs: Date.now()
  };
}

function clearCaptureTimer(timerRef: { current: number | null }): void {
  if (timerRef.current === null) {
    return;
  }

  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

function formatCaptureStatus(capture: CaptureUiState): string {
  if (capture.status === "running") {
    return `Capturing since ${capture.startedAtIso}`;
  }

  if (capture.status === "complete") {
    return "Complete";
  }

  return "Idle";
}

function formatNativeAvailability(
  stageState: RuntimePlayerStageStateSnapshot | null,
  metrics: RuntimePlayerStageRenderMetricsSnapshot | null
): string {
  if (stageState?.stageWindow.windowState === "destroyed") {
    return "Stage Window unavailable";
  }

  if (metrics === null) {
    return "Waiting for native Stage metrics";
  }

  return `Metrics ready, canvas ${metrics.canvasWidth} x ${metrics.canvasHeight}`;
}

function formatBrowserSourceAvailability(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.connectedClientCount <= 0) {
    return "No Browser Source client connected";
  }

  if (status.latestRendererDiagnostics?.renderMetrics === undefined ||
    status.latestRendererDiagnostics.renderMetrics === null) {
    return `${status.connectedClientCount} client(s), waiting for metrics`;
  }

  return `${status.connectedClientCount} client(s), metrics ready`;
}

function formatStageMotion(
  stageState: RuntimePlayerStageStateSnapshot | null
): string {
  if (stageState === null) {
    return "Checking";
  }

  return stageState.stageMotion.settings.enabled ? "On" : "Off";
}

function formatNullableFps(value: number | null): string {
  return value === null ? "Unknown" : `${formatControlNumber(value)} fps`;
}

function formatNullableCount(value: number | null): string {
  return value === null ? "Unknown" : String(Math.max(0, Math.round(value)));
}
