import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RuntimePlayerMappingSlot, RuntimePlayerMappingTarget } from "../../preload/model-mapping-bridge-contract";

export type MotionTrack = readonly (readonly [timeMs: number, value: number])[];
export const speechMotionStageRanges = {
  y: { min: -200, max: 200 },
  scale: { min: 0.1, max: 10 },
  horizontal: { min: -1, max: 1 },
  depth: { min: -1, max: 1 }
} as const;
export type MotionStageChannel = keyof typeof speechMotionStageRanges;
export type MotionClip = {
  readonly entry: "lead-in" | "preserve-clock";
  readonly durationMs: number;
  readonly tracks?: Readonly<Record<string, MotionTrack>>;
  readonly fixed?: Readonly<Record<string, number>>;
  readonly defaults?: Readonly<Record<string, number>>;
  readonly hold?: { readonly ms: number; readonly untilSpeechEnd?: boolean };
  readonly stage?: Readonly<Partial<Record<MotionStageChannel, MotionTrack>>>;
  readonly stageYLeadIn?: boolean;
  readonly stageScaleLinear?: boolean;
  readonly stageScaleEntryMs?: number;
};

const attentionTargets = Object.freeze({
  "partner": "相方（キャラ右・画面左）",
  "game": "ゲーム画面（正面）",
  "viewers": "視聴者（上）"
});
type Target = keyof typeof attentionTargets;
type MotionAsset = {
  readonly version: 1;
  readonly id: string;
  readonly description: string;
  readonly targets: Readonly<Partial<Record<Target, string>>>;
  readonly clips: Readonly<Record<string, MotionClip>>;
};
export type SpeechMotionCatalog = {
  readonly performances: Readonly<Record<string, string>>;
  readonly attentionTargets: Readonly<Record<string, string>>;
  readonly pairs: readonly { readonly performanceId: string; readonly attentionTargetId: string }[];
};
export type SpeechMotionSnapshot = {
  readonly catalog: SpeechMotionCatalog;
  resolve(performanceId: string, attentionTargetId: string): { clip: MotionClip } | { reason: string };
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fields(value: unknown, allowed: string): value is Record<string, unknown> {
  return record(value) && Object.keys(value).every((key) => allowed.split(" ").includes(key));
}

function id(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value) &&
    !Object.hasOwn(Object.prototype, value);
}

function numberIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function validateTrack(value: unknown, durationMs: number, min: number, max: number): boolean {
  if (!Array.isArray(value) || value.length < 1 || value.length > 1024 || value[0]?.[0] !== 0) return false;
  let last = -1;
  for (const point of value) {
    if (!Array.isArray(point) || point.length !== 2 || !numberIn(point[0], 0, durationMs) ||
        point[0] <= last || !numberIn(point[1], min, max)) return false;
    last = point[0];
  }
  return true;
}

function validateClip(value: unknown, label: string): void {
  if (!fields(value, "entry durationMs tracks fixed defaults hold stage stageYLeadIn stageScaleLinear stageScaleEntryMs") ||
      (value.entry !== "lead-in" && value.entry !== "preserve-clock") ||
      !numberIn(value.durationMs, 1, 10_000) || !Number.isInteger(value.durationMs)) {
    throw new Error(`${label}: invalid clip fields, entry or durationMs`);
  }
  const durationMs = value.durationMs;
  const tracks = value.tracks === undefined ? {} : value.tracks;
  const fixed = value.fixed === undefined ? {} : value.fixed;
  const defaults = value.defaults === undefined ? {} : value.defaults;
  if (!record(tracks) || !record(fixed) || !record(defaults)) throw new Error(`${label}: invalid parameter maps`);
  for (const [name, points] of Object.entries(tracks)) {
    if (!id(name) || Object.hasOwn(fixed, name) || !validateTrack(points, durationMs, -1e6, 1e6)) {
      throw new Error(`${label}: invalid or conflicting track ${name}`);
    }
  }
  for (const [name, scalar] of Object.entries(fixed)) {
    if (!id(name) || !numberIn(scalar, -1e6, 1e6)) throw new Error(`${label}: invalid fixed value ${name}`);
  }
  for (const [name, scalar] of Object.entries(defaults)) {
    if (!(Object.hasOwn(tracks, name) || Object.hasOwn(fixed, name)) || !numberIn(scalar, -1e6, 1e6)) {
      throw new Error(`${label}: invalid default ${name}`);
    }
  }
  if (value.hold !== undefined && (!fields(value.hold, "ms untilSpeechEnd") ||
      !numberIn(value.hold.ms, 0, 30_000) || !Number.isInteger(value.hold.ms) ||
      (value.hold.untilSpeechEnd !== undefined && typeof value.hold.untilSpeechEnd !== "boolean"))) {
    throw new Error(`${label}: invalid hold`);
  }
  if (value.stage !== undefined) {
    if (!fields(value.stage, "y scale horizontal depth")) throw new Error(`${label}: invalid Stage fields`);
    for (const [channel, points] of Object.entries(value.stage)) {
      const { min, max } = speechMotionStageRanges[channel as MotionStageChannel];
      if (!validateTrack(points, durationMs, min, max)) throw new Error(`${label}: invalid Stage track ${channel}`);
    }
  }
  if ((value.stageYLeadIn !== undefined &&
        (typeof value.stageYLeadIn !== "boolean" || !record(value.stage) || !value.stage.y)) ||
      (value.stageScaleLinear !== undefined &&
        (typeof value.stageScaleLinear !== "boolean" || !record(value.stage) || !value.stage.scale)) ||
      (value.stageScaleEntryMs !== undefined &&
        (!numberIn(value.stageScaleEntryMs, 1, 400) || !record(value.stage) || !value.stage.scale))) {
    throw new Error(`${label}: invalid Stage timing option`);
  }
  if (![tracks, fixed, value.stage ?? {}].some((map) => Object.keys(map).length > 0)) {
    throw new Error(`${label}: clip contains no controls`);
  }
}

function parseAsset(value: unknown): MotionAsset {
  if (!fields(value, "version id description targets clips") || value.version !== 1 ||
      !id(value.id) || value.id === "none" || typeof value.description !== "string" ||
      !value.description.trim() || value.description.length > 1000 || !record(value.clips) ||
      !record(value.targets) || Object.keys(value.targets).length === 0) {
    throw new Error("invalid asset version, id, description, targets or clips");
  }
  const used = new Set<string>();
  for (const [target, clip] of Object.entries(value.targets)) {
    if (!Object.hasOwn(attentionTargets, target) || !id(clip) || !Object.hasOwn(value.clips, clip)) {
      throw new Error(`invalid clip reference for target ${target}`);
    }
    used.add(clip);
  }
  for (const [name, clip] of Object.entries(value.clips)) {
    if (!used.has(name)) throw new Error(`unreferenced clip ${name}`);
    validateClip(clip, name);
  }
  return value as MotionAsset;
}

export async function loadSpeechMotionSnapshot(
  userData: string,
  report: (message: string) => void
): Promise<SpeechMotionSnapshot> {
  const directory = resolve(userData, "speech-motions");
  report(`Speech motion assets: ${directory}`);
  const files = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    report(`Speech motion assets: ${directory}: ${error.code ?? error.message}`);
    return [];
  });
  const sources = new Map<string, { filename: string; asset?: MotionAsset }[]>();
  for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!file.isFile() || !file.name.toLowerCase().endsWith(".json")) continue;
    const filename = join(directory, file.name);
    try {
      const value: unknown = JSON.parse(await readFile(filename, "utf8"));
      const source: { filename: string; asset?: MotionAsset } = { filename };
      if (record(value) && id(value.id) && value.id !== "none") {
        const entries = sources.get(value.id) ?? [];
        entries.push(source);
        sources.set(value.id, entries);
      }
      source.asset = parseAsset(value);
    } catch (error) {
      report(`${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const assets = new Map<string, MotionAsset>();
  for (const [performanceId, entries] of sources) {
    if (entries.length > 1) {
      report(`Duplicate speech motion id ${performanceId}: ${entries.map(({ filename }) => filename).join(", ")}`);
    } else if (entries[0]?.asset) {
      assets.set(performanceId, entries[0].asset);
    }
  }
  const catalog = Object.freeze({
    performances: Object.freeze(Object.fromEntries(Array.from(assets, ([key, asset]) => [key, asset.description]))),
    attentionTargets,
    pairs: Object.freeze(Array.from(assets, ([performanceId, asset]) =>
      Object.keys(asset.targets).map((attentionTargetId) => Object.freeze({ performanceId, attentionTargetId }))).flat())
  });
  return {
    catalog,
    resolve(performanceId, attentionTargetId) {
      const asset = assets.get(performanceId);
      if (!asset) return { reason: "unsupported-performance" };
      if (!Object.hasOwn(attentionTargets, attentionTargetId)) return { reason: "unknown-attention-target" };
      const clip = asset.targets[attentionTargetId as Target];
      return clip === undefined ? { reason: "unproduced-pair" } : { clip: asset.clips[clip]! };
    }
  };
}

export function speechMotionModelIssue(
  clip: MotionClip,
  parameters: readonly RuntimePlayerMappingTarget[] | null,
  slots: readonly RuntimePlayerMappingSlot[] | null
): string | null {
  if (parameters === null) return "No model is loaded.";
  for (const name of [...Object.keys(clip.tracks ?? {}), ...Object.keys(clip.fixed ?? {})]) {
    const parameter = parameters.find(({ parameterId }) => parameterId === name);
    if (!parameter) return `Missing writable model parameter: ${name}.`;
    if (slots?.some((slot) => slot.group === "mouth" &&
        slot.target?.parameterId === name)) return `Model parameter ${name} is reserved for lip sync.`;
    const expected = clip.defaults?.[name];
    if (expected !== undefined && parameter.default !== expected) {
      return `Model parameter ${name} requires default ${expected}; found ${parameter.default}.`;
    }
    const values = clip.tracks?.[name]?.map(([, value]) => value) ?? [clip.fixed![name]!];
    if (values.some((value) => value < parameter.min || value > parameter.max)) {
      return `Model parameter ${name} has insufficient range [${parameter.min}, ${parameter.max}].`;
    }
  }
  return null;
}
