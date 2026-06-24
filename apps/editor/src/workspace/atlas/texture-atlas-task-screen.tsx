import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Grid3X3,
  RefreshCcw
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import { cn } from "../../lib/class-name";
import { useEditorUiStore } from "../../state/editor-ui-store";
import { IconButton } from "../../ui/icon-button";
import {
  DEFAULT_TEXTURE_ATLAS_TASK_SETTINGS,
  TEXTURE_ATLAS_PADDING_OPTIONS,
  TEXTURE_ATLAS_PAGE_SIZE_OPTIONS,
  createTextureAtlasTaskPreviewState,
  createTextureAtlasTaskProjection,
  type TextureAtlasIncludedRow,
  type TextureAtlasExcludedRow,
  type TextureAtlasPreviewImage,
  type TextureAtlasPreviewPlacement,
  type TextureAtlasTaskPreviewState,
  type TextureAtlasTaskProjection,
  type TextureAtlasTaskSettings
} from "./atlas-task-projection";

type ApplyStatus =
  | { readonly status: "idle" }
  | { readonly status: "applying" }
  | { readonly status: "applied"; readonly message: string }
  | { readonly status: "failed"; readonly message: string };

export function TextureAtlasTaskScreen() {
  const {
    applyTextureAtlasPreview,
    editorHiddenPartIds,
    session
  } = useEditorSession();
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const [settings, setSettings] = useState<TextureAtlasTaskSettings>(
    DEFAULT_TEXTURE_ATLAS_TASK_SETTINGS
  );
  const [previewState, setPreviewState] = useState<TextureAtlasTaskPreviewState | null>(null);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>({ status: "idle" });
  const projection = useMemo(
    () =>
      createTextureAtlasTaskProjection({
        session,
        editorHiddenPartIds,
        settings,
        previewState
      }),
    [editorHiddenPartIds, previewState, session, settings]
  );

  const generatePreview = () => {
    setPreviewState(
      createTextureAtlasTaskPreviewState({
        session,
        editorHiddenPartIds,
        settings
      })
    );
    setApplyStatus({ status: "idle" });
  };

  const applyPreview = async () => {
    if (projection.preview?.status !== "ready" || !projection.canApply) {
      return;
    }

    setApplyStatus({ status: "applying" });
    const result = await applyTextureAtlasPreview(projection.preview);

    if (result.committed) {
      setPreviewState(null);
      setApplyStatus({
        status: "applied",
        message: `Applied ${result.layoutSummary.pages[0]?.placements.length ?? 0} atlas placements.`
      });
      return;
    }

    setApplyStatus({
      status: "failed",
      message: result.warnings[0]?.message ?? "Texture Atlas Apply was rejected."
    });
  };

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-[#111110]"
      data-testid="texture-atlas-task-screen"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton
            className="size-8 shrink-0"
            label="Back to Authoring Workspace"
            onClick={() => setActiveEntry("workspace")}
            tooltipSide="bottom"
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          </IconButton>
          <div className="h-6 w-px shrink-0 bg-neutral-800" />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-teal-700/70 bg-teal-950/30 text-teal-100">
            <Grid3X3 aria-hidden="true" size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase text-neutral-500">
              Texture Atlas
            </div>
            <h1 className="truncate text-sm font-semibold text-neutral-50">
              Single Page Atlas Task
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AtlasActionButton
            dataTestId="atlas-generate-preview"
            icon={<RefreshCcw aria-hidden="true" size={15} strokeWidth={1.8} />}
            label="Generate Preview"
            onClick={generatePreview}
            tone="teal"
          />
          <AtlasActionButton
            dataTestId="atlas-apply"
            disabled={!projection.canApply || applyStatus.status === "applying"}
            icon={<CheckCircle2 aria-hidden="true" size={15} strokeWidth={1.8} />}
            label={applyStatus.status === "applying" ? "Applying" : "Apply Atlas"}
            onClick={() => {
              void applyPreview();
            }}
            tone="emerald"
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(22rem,1fr)_minmax(22rem,48%)] overflow-hidden xl:grid-cols-[minmax(0,1fr)_390px] xl:grid-rows-1">
        <AtlasPreview projection={projection} />
        <AtlasSidebar
          applyStatus={applyStatus}
          onSettingsChange={(nextSettings) => {
            setSettings(nextSettings);
            setApplyStatus({ status: "idle" });
          }}
          projection={projection}
        />
      </div>
    </section>
  );
}

export function AtlasPreview({ projection }: { readonly projection: TextureAtlasTaskProjection }) {
  const page = projection.previewPage;
  const previewStatusLabel = formatPreviewStatus(projection);

  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden bg-[#131312]"
      data-atlas-preview-status={projection.previewStatus}
      data-testid="atlas-preview-area"
    >
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-neutral-800 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-neutral-100">
            Atlas Preview
          </h2>
          <div
            className="mt-0.5 truncate text-[11px] font-medium uppercase text-neutral-500"
            data-testid="atlas-preview-state"
          >
            {previewStatusLabel}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-neutral-400">
          <span>{projection.summary.pageSizeLabel}</span>
          <span className="h-4 w-px bg-neutral-800" />
          <span>{projection.summary.usageLabel}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <div
          className="relative w-full max-w-[760px] overflow-hidden rounded border border-neutral-700 bg-neutral-950 shadow-inner"
          data-testid="atlas-preview-page"
          style={{ aspectRatio: page === null ? "1 / 1" : `${page.width} / ${page.height}` }}
        >
          {page === null ? (
            <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs font-medium text-neutral-500">
              {projection.previewStatus === "failed" ? (
                <AtlasPreviewFailureCard projection={projection} />
              ) : projection.previewStatus === "stale" ? (
                "Preview stale"
              ) : (
                "Generate Preview"
              )}
            </div>
          ) : (
            <>
              <AtlasPreviewImageLayer image={page.image} />
              {page.placements.map((placement) => (
                <AtlasPlacement key={placement.placementId} placement={placement} />
              ))}
            </>
          )}
          {projection.previewStatus === "stale" ? (
            <div
              className="absolute inset-x-3 top-3 rounded border border-amber-700/80 bg-amber-950/80 px-3 py-2 text-xs font-semibold text-amber-100"
              data-testid="atlas-preview-stale-warning"
            >
              Atlas preview is stale
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AtlasPreviewImageLayer({
  image
}: {
  readonly image: TextureAtlasPreviewImage;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const context = canvas.getContext("2d");
    if (context === null) {
      return;
    }

    context.putImageData(
      new ImageData(new Uint8ClampedArray(image.rgbaBytes), image.width, image.height),
      0,
      0
    );
  }, [image]);

  return (
    <canvas
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      data-atlas-image-bytes={image.byteLength}
      data-atlas-image-signature={image.signature}
      data-testid="atlas-preview-image"
      height={image.height}
      ref={canvasRef}
      width={image.width}
    />
  );
}

function AtlasPlacement({
  placement
}: {
  readonly placement: TextureAtlasPreviewPlacement;
}) {
  const style: CSSProperties = {
    left: `${placement.leftPercent}%`,
    top: `${placement.topPercent}%`,
    width: `${placement.widthPercent}%`,
    height: `${placement.heightPercent}%`
  };

  return (
    <div
      className={cn(
        "absolute min-h-5 min-w-8 overflow-hidden border bg-teal-500/10 p-0.5 text-[10px] font-semibold text-teal-50 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]",
        placement.hidden
          ? "border-amber-400/90 bg-amber-500/10 text-amber-100"
          : "border-teal-300/85"
      )}
      data-atlas-drawable-id={placement.drawableId}
      data-atlas-hidden={String(placement.hidden)}
      data-testid="atlas-preview-placement"
      style={style}
      title={placement.displayName}
    >
      <span className="block truncate rounded-sm bg-neutral-950/75 px-1 py-0.5 shadow-sm">
        {placement.displayName}
      </span>
    </div>
  );
}

export function AtlasSidebar({
  applyStatus,
  onSettingsChange,
  projection
}: {
  readonly applyStatus: ApplyStatus;
  readonly onSettingsChange: (settings: TextureAtlasTaskSettings) => void;
  readonly projection: TextureAtlasTaskProjection;
}) {
  return (
    <aside className="min-h-0 overflow-auto border-t border-neutral-800 bg-[#171716] xl:border-l xl:border-t-0">
      <section className="border-b border-neutral-800 p-3">
        <h2 className="text-xs font-semibold uppercase text-neutral-500">Target Summary</h2>
        <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <SummaryMetric
            label="Included"
            testId="atlas-included-count"
            value={projection.summary.includedCount}
          />
          <SummaryMetric
            label="Excluded"
            testId="atlas-excluded-count"
            value={projection.summary.excludedCount}
          />
          <SummaryMetric
            label="Warnings"
            testId="atlas-warning-count"
            value={projection.summary.warningCount}
          />
          <SummaryMetric
            label="Blocking"
            testId="atlas-blocking-count"
            value={projection.summary.blockingIssueCount}
          />
        </dl>
        <dl className="mt-3 grid gap-1.5 text-xs">
          <InlineMetric label="Page" value={projection.summary.pageSizeLabel} />
          <InlineMetric label="Usage" value={projection.summary.usageLabel} />
          <InlineMetric label="Padding" value={projection.summary.paddingLabel} />
          <InlineMetric label="Edge extrusion" value={projection.summary.edgeExtrusionLabel} />
        </dl>
        <ApplyStatusMessage status={applyStatus} />
      </section>

      <BlockingIssuesSection projection={projection} />

      <section className="border-b border-neutral-800 p-3">
        <h2 className="text-xs font-semibold uppercase text-neutral-500">Settings</h2>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-neutral-300">
            <span>Page size</span>
            <select
              className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
              data-testid="atlas-page-size"
              onChange={(event) =>
                onSettingsChange({
                  ...projection.settings,
                  pageSize: Number(event.currentTarget.value)
                })
              }
              value={projection.settings.pageSize}
            >
              {TEXTURE_ATLAS_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} x {size}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-neutral-300">
            <span>Padding</span>
            <select
              className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
              data-testid="atlas-padding"
              onChange={(event) =>
                onSettingsChange({
                  ...projection.settings,
                  paddingPixels: Number(event.currentTarget.value)
                })
              }
              value={projection.settings.paddingPixels}
            >
              {TEXTURE_ATLAS_PADDING_OPTIONS.map((padding) => (
                <option key={padding} value={padding}>
                  {padding}px
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-8 items-center gap-2 text-xs font-medium text-neutral-300">
            <input
              checked={projection.settings.edgeExtrusionEnabled}
              className="size-4 accent-teal-500"
              data-testid="atlas-edge-extrusion"
              onChange={(event) =>
                onSettingsChange({
                  ...projection.settings,
                  edgeExtrusionEnabled: event.currentTarget.checked
                })
              }
              type="checkbox"
            />
            <span>Edge extrusion</span>
          </label>
        </div>
      </section>

      <AtlasList
        rows={projection.includedRows}
        title="Included"
        type="included"
      />
      <AtlasList
        rows={projection.excludedRows}
        title="Excluded"
        type="excluded"
      />
      <section className="p-3">
        <h2 className="text-xs font-semibold uppercase text-neutral-500">Warnings</h2>
        {projection.warningRows.length === 0 ? (
          <div
            className="mt-3 rounded border border-neutral-800 bg-neutral-950/45 px-3 py-2 text-xs font-medium text-neutral-500"
            data-testid="atlas-warning-empty"
          >
            No atlas warnings
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-800 overflow-hidden rounded border border-neutral-800">
            {projection.warningRows.map((warning) => (
              <li
                className="bg-amber-950/20 px-3 py-2 text-xs"
                data-atlas-warning-code={warning.code}
                data-testid="atlas-warning-row"
                key={warning.id}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-amber-300"
                    size={14}
                    strokeWidth={1.9}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-amber-100">{warning.label}</div>
                    <div className="mt-1 break-words text-neutral-300">{warning.message}</div>
                    <div className="mt-1 break-words font-mono text-[11px] text-neutral-500">
                      {warning.targetPath}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function AtlasPreviewFailureCard({
  projection
}: {
  readonly projection: TextureAtlasTaskProjection;
}) {
  const primaryIssue = projection.blockingIssues[0];

  return (
    <div
      className="max-w-72 rounded border border-rose-800/80 bg-neutral-950/90 px-4 py-3 text-left shadow-lg"
      data-testid="atlas-preview-failure-card"
    >
      <div className="text-xs font-semibold uppercase text-rose-200">
        {primaryIssue?.title ?? "Preview failed"}
      </div>
      <div className="mt-1 text-xs font-medium text-neutral-200">
        {primaryIssue?.targetLabel ?? "Texture Atlas"}
      </div>
      <div className="mt-1 text-[11px] leading-5 text-neutral-400">
        {primaryIssue?.contextLabel ?? projection.summary.pageSizeLabel}
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase text-neutral-500">
        See Blocking Issues
      </div>
    </div>
  );
}

function BlockingIssuesSection({
  projection
}: {
  readonly projection: TextureAtlasTaskProjection;
}) {
  return (
    <section
      className="border-b border-neutral-800 p-3"
      data-testid="atlas-blocking-issues-section"
    >
      <h2 className="text-xs font-semibold uppercase text-neutral-500">Blocking Issues</h2>
      {projection.blockingIssues.length === 0 ? (
        <div
          className="mt-3 rounded border border-neutral-800 bg-neutral-950/45 px-3 py-2 text-xs font-medium text-neutral-500"
          data-testid="atlas-blocking-empty"
        >
          No blocking issues
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-rose-950 overflow-hidden rounded border border-rose-900/75">
          {projection.blockingIssues.map((issue) => (
            <li
              className="bg-rose-950/25 px-3 py-2 text-xs"
              data-atlas-blocking-code={issue.code}
              data-testid="atlas-blocking-issue-row"
              key={issue.id}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-rose-300"
                  size={14}
                  strokeWidth={1.9}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-rose-100">{issue.title}</div>
                  <div className="mt-1 break-words text-neutral-200">{issue.message}</div>
                  <div className="mt-1 break-words text-neutral-400">{issue.contextLabel}</div>
                  <div className="mt-1 break-words font-mono text-[11px] text-neutral-500">
                    {issue.sourceRef}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SummaryMetric({
  label,
  testId,
  value
}: {
  readonly label: string;
  readonly testId: string;
  readonly value: number;
}) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/45 px-2 py-2">
      <dt className="text-[10px] font-semibold uppercase text-neutral-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-neutral-100" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function InlineMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-neutral-900 py-1">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-neutral-200">{value}</dd>
    </div>
  );
}

function ApplyStatusMessage({ status }: { readonly status: ApplyStatus }) {
  if (status.status === "idle" || status.status === "applying") {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-3 rounded border px-3 py-2 text-xs font-semibold",
        status.status === "applied"
          ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-100"
          : "border-rose-700/70 bg-rose-950/30 text-rose-100"
      )}
      data-testid="atlas-apply-status"
    >
      {status.message}
    </div>
  );
}

function AtlasList({
  rows,
  title,
  type
}: {
  readonly rows: readonly TextureAtlasIncludedRow[] | readonly TextureAtlasExcludedRow[];
  readonly title: string;
  readonly type: "included" | "excluded";
}) {
  return (
    <section className="border-b border-neutral-800 p-3">
      <h2 className="text-xs font-semibold uppercase text-neutral-500">{title}</h2>
      {rows.length === 0 ? (
        <div className="mt-3 rounded border border-neutral-800 bg-neutral-950/45 px-3 py-2 text-xs font-medium text-neutral-500">
          None
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-800 overflow-hidden rounded border border-neutral-800">
          {rows.map((row) =>
            type === "included" ? (
              <IncludedRow key={row.drawableId} row={row as TextureAtlasIncludedRow} />
            ) : (
              <ExcludedRow
                key={row.drawableId}
                row={row as TextureAtlasTaskProjection["excludedRows"][number]}
              />
            )
          )}
        </ul>
      )}
    </section>
  );
}

function IncludedRow({ row }: { readonly row: TextureAtlasIncludedRow }) {
  return (
    <li
      className="bg-neutral-950/25 px-3 py-2 text-xs"
      data-atlas-drawable-id={row.drawableId}
      data-atlas-hidden={String(row.currentlyHidden)}
      data-testid="atlas-included-row"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-neutral-100">{row.displayName}</div>
          <div className="mt-1 truncate text-neutral-500">{row.partPathLabel}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-neutral-400">
            {row.textureSourceLabel}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.currentlyHidden ? (
            <span className="rounded border border-amber-700/70 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-100">
              {row.hiddenReasonLabel}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              row.packable
                ? "border-emerald-800/70 bg-emerald-950/30 text-emerald-200"
                : "border-rose-800/70 bg-rose-950/30 text-rose-200"
            )}
          >
            {row.packable ? "Ready" : "Blocked"}
          </span>
        </div>
      </div>
    </li>
  );
}

function ExcludedRow({
  row
}: {
  readonly row: TextureAtlasTaskProjection["excludedRows"][number];
}) {
  return (
    <li
      className="bg-neutral-950/25 px-3 py-2 text-xs"
      data-atlas-drawable-id={row.drawableId}
      data-atlas-reason={row.reason}
      data-testid="atlas-excluded-row"
    >
      <div className="font-semibold text-neutral-100">{row.displayName}</div>
      <div className="mt-1 text-neutral-300">{row.reasonLabel}</div>
      <div className="mt-1 break-words font-mono text-[11px] text-neutral-500">
        {row.targetPath}
      </div>
    </li>
  );
}

function AtlasActionButton({
  dataTestId,
  disabled,
  icon,
  label,
  onClick,
  tone
}: {
  readonly dataTestId: string;
  readonly disabled?: boolean;
  readonly icon: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly tone: "emerald" | "teal";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600",
        tone === "emerald"
          ? "border-emerald-700/70 bg-emerald-950/40 text-emerald-100 hover:border-emerald-400"
          : "border-teal-700/70 bg-teal-950/40 text-teal-100 hover:border-teal-400"
      )}
      data-testid={dataTestId}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function formatPreviewStatus(projection: TextureAtlasTaskProjection): string {
  switch (projection.previewStatus) {
    case "failed":
      return projection.blockingIssues[0] === undefined
        ? "Preview failed"
        : `Preview failed: ${projection.blockingIssues[0].title}`;
    case "missing":
      return "No preview";
    case "ready":
      return "Preview ready";
    case "stale":
      return "Preview stale";
  }
}
