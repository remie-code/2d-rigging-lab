import type {
  RuntimePlayerBrowserSourceClientMessage
} from "../../preload/browser-source-transport-contract";
import {
  readOptionalRuntimePlayerStageRenderMetricsSnapshot
} from "../performance-diagnostics-metrics-validation";

const WEBGL2_STATUSES = new Set(["available", "unavailable", "unknown"]);
const RENDER_STATUSES = new Set(["idle", "loading", "rendering", "error"]);
const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 240;

export function readBrowserSourceClientMessage(
  text: string
): RuntimePlayerBrowserSourceClientMessage | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    return null;
  }

  if (parsed.type === "browser-source-resync-request") {
    return {
      type: "browser-source-resync-request",
      requestedAtIso: readOptionalString(parsed.requestedAtIso)
    };
  }

  if (parsed.type === "browser-source-client-heartbeat") {
    return {
      type: "browser-source-client-heartbeat",
      sentAtIso: readOptionalString(parsed.sentAtIso)
    };
  }

  if (parsed.type === "browser-source-renderer-diagnostics") {
    return {
      type: "browser-source-renderer-diagnostics",
      webgl2Available: readEnum(
        parsed.webgl2Available,
        WEBGL2_STATUSES,
        "unknown"
      ),
      runtimeExportLoaded: parsed.runtimeExportLoaded === true,
      renderStatus: readEnum(parsed.renderStatus, RENDER_STATUSES, "idle"),
      message: readOptionalString(
        parsed.message,
        MAX_DIAGNOSTIC_MESSAGE_LENGTH
      ),
      fps: readOptionalFiniteNumber(parsed.fps),
      sourceFps: readOptionalFiniteNumber(parsed.sourceFps),
      frameAgeMs: readOptionalFiniteNumber(parsed.frameAgeMs),
      renderMetrics: readOptionalRuntimePlayerStageRenderMetricsSnapshot(
        parsed.renderMetrics
      )
    };
  }

  return null;
}

function readOptionalString(
  value: unknown,
  maxLength = 80
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value.slice(0, maxLength);
}

function readOptionalFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readEnum<TValue extends string>(
  value: unknown,
  allowed: ReadonlySet<string>,
  fallback: TValue
): TValue {
  return typeof value === "string" && allowed.has(value)
    ? value as TValue
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
