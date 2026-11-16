import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
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
type MotionCandidate = {
  readonly description: string;
  readonly targets: Readonly<Partial<Record<Target, string>>>;
  readonly clips: Readonly<Record<string, MotionClip>>;
};
type MotionAsset = {
  readonly definition: Record<string, unknown>;
  readonly candidates: ReadonlyMap<string, MotionCandidate>;
};
type DefinitionArchiveEntry = {
  readonly sha256: string;
  status: "pending" | "saved" | "failed";
};
export type SpeechMotionCatalog = {
  readonly performances: Readonly<Record<string, string>>;
  readonly attentionTargets: Readonly<Record<string, string>>;
  readonly pairs: readonly {
    readonly performanceId: string;
    readonly attentionTargetId: string;
    readonly clipId?: string;
  }[];
  readonly definitionArchive?: {
    readonly directory: string;
    readonly definitions: Readonly<Record<string, Readonly<DefinitionArchiveEntry>>>;
  };
};
export type SpeechMotionSnapshot = {
  readonly catalog: SpeechMotionCatalog;
  readonly archiveSettled: Promise<void>;
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

function description(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= 1000;
}

function validateTargets(
  targets: unknown, clips: Record<string, unknown>, used: Set<string>
): asserts targets is MotionCandidate["targets"] {
  if (!record(targets) || Object.keys(targets).length === 0) throw new Error("invalid targets");
  for (const [target, clip] of Object.entries(targets)) {
    if (!Object.hasOwn(attentionTargets, target) || !id(clip) || !Object.hasOwn(clips, clip)) {
      throw new Error(`invalid clip reference for target ${target}`);
    }
    used.add(clip);
  }
}

function parseAsset(value: unknown): MotionAsset {
  if (!record(value) || !id(value.id) || value.id === "none" ||
      !description(value.description) || !record(value.clips)) {
    throw new Error("invalid asset id, description or clips");
  }
  const candidates = new Map<string, MotionCandidate>();
  const clips = value.clips as MotionCandidate["clips"];
  const used = new Set<string>();
  if (value.version === 1 && fields(value, "version id description targets clips")) {
    validateTargets(value.targets, clips, used);
    candidates.set(value.id, { description: value.description, targets: value.targets, clips });
  } else if (value.version === 2 && fields(value, "version id description nuances clips")) {
    if (!record(value.nuances) || Object.keys(value.nuances).length === 0) throw new Error("invalid nuances");
    for (const [nuanceId, nuance] of Object.entries(value.nuances)) {
      const selectionId = `${value.id}--${nuanceId}`;
      if (!id(nuanceId) || !id(selectionId) || !fields(nuance, "description targets") ||
          !description(nuance.description)) throw new Error(`invalid nuance ${nuanceId}`);
      const combinedDescription = `${value.description}\n${nuance.description}`;
      if (!description(combinedDescription)) throw new Error(`invalid combined description for ${selectionId}`);
      validateTargets(nuance.targets, clips, used);
      candidates.set(selectionId, { description: combinedDescription, targets: nuance.targets, clips });
    }
  } else {
    throw new Error("invalid asset version or fields");
  }
  for (const [name, clip] of Object.entries(value.clips)) {
    if (!used.has(name)) throw new Error(`unreferenced clip ${name}`);
    validateClip(clip, name);
  }
  return { definition: value, candidates };
}

async function publishDefinition(directory: string, sha256: string, content: string): Promise<void> {
  const path = join(directory, sha256 + ".json");
  const verify = async () => {
    if (await readFile(path, "utf8") !== content) throw new Error("existing archive bytes differ");
  };
  try {
    await verify();
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const staging = join(directory, randomUUID() + ".tmp");
  await mkdir(directory, { recursive: true });
  await writeFile(staging, content, { encoding: "utf8", flag: "wx", mode: 0o600 }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") await unlink(staging).catch(() => {});
    throw error;
  });
  try {
    try {
      await link(staging, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await verify();
    }
  } finally {
    await unlink(staging).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
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
  const uniqueSources = new Map<string, MotionAsset>();
  for (const [parentId, entries] of sources) {
    if (entries.length > 1) {
      report(`Duplicate speech motion id ${parentId}: ${entries.map(({ filename }) => filename).join(", ")}`);
    } else if (entries[0]?.asset) {
      uniqueSources.set(parentId, entries[0].asset);
    }
  }
  const owners = new Map<string, string[]>();
  for (const [parentId, asset] of uniqueSources) {
    for (const selectionId of asset.candidates.keys()) {
      const parents = owners.get(selectionId) ?? [];
      parents.push(parentId);
      owners.set(selectionId, parents);
    }
  }
  const conflictingParents = new Set<string>();
  for (const [selectionId, parents] of owners) {
    if (parents.length > 1) {
      report(`Duplicate speech motion selection id ${selectionId}: ${parents.join(", ")}`);
      for (const parentId of parents) conflictingParents.add(parentId);
    }
  }
  const assets = new Map<string, MotionCandidate>();
  const archiveDirectory = resolve(userData, "speech-motion-archive");
  const definitions = new Map<string, DefinitionArchiveEntry>();
  const archiveWrites: Promise<void>[] = [];
  for (const [parentId, asset] of uniqueSources) {
    if (conflictingParents.has(parentId)) continue;
    const content = JSON.stringify(asset.definition, (_key, value: unknown) =>
      record(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value,
    2) + "\n";
    const sha256 = createHash("sha256").update(content).digest("hex");
    const entry: DefinitionArchiveEntry = { sha256, status: "pending" };
    for (const [selectionId, candidate] of asset.candidates) {
      assets.set(selectionId, candidate);
      definitions.set(selectionId, entry);
    }
    archiveWrites.push(publishDefinition(archiveDirectory, sha256, content).then(() => {
      entry.status = "saved";
    }, (error: unknown) => {
      entry.status = "failed";
      report(`Speech motion archive: ${parentId} ${join(archiveDirectory, sha256 + ".json")}: ${error instanceof Error ? error.message : String(error)}`);
    }));
  }
  const candidates = Object.freeze({
    performances: Object.freeze(Object.fromEntries(Array.from(assets, ([key, asset]) => [key, asset.description]))),
    attentionTargets,
    pairs: Object.freeze(Array.from(assets, ([performanceId, asset]) =>
      Object.entries(asset.targets).map(([attentionTargetId, clipId]) =>
        Object.freeze({ performanceId, attentionTargetId, clipId }))).flat())
  });
  return {
    archiveSettled: Promise.all(archiveWrites).then(() => {}),
    get catalog() {
      return {
        ...candidates,
        definitionArchive: {
          directory: archiveDirectory,
          definitions: Object.fromEntries(Array.from(definitions, ([id, entry]) => [id, { ...entry }]))
        }
      };
    },
    resolve(performanceId, attentionTargetId) {
      const asset = assets.get(performanceId);
      if (!asset) return { reason: "unsupported-performance" };
      if (!Object.hasOwn(attentionTargets, attentionTargetId)) return { reason: "unknown-attention-target" };
      const target = attentionTargetId as Target;
      if (!Object.hasOwn(asset.targets, target)) return { reason: "unproduced-pair" };
      return { clip: asset.clips[asset.targets[target]!]! };
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
