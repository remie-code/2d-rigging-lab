import type { MotionClip, SpeechMotionSnapshot } from "./speech-motion-assets";
import type { RuntimePlayerMappingTarget } from "../../preload/model-mapping-bridge-contract";
import { SpeechMotionPlayback } from "./speech-motion-playback";

type StageYTrack = readonly (readonly [timeMs: number, offsetPx: number])[];
type MotionKey = { readonly generation: number; readonly sectionIndex: number };
export type SpeechMotionRequest = MotionKey & (
  | { readonly op: "begin" | "end" | "cancel" }
  | { readonly op: "play"; readonly clip: MotionClip; readonly parameters?: readonly RuntimePlayerMappingTarget[] }
  | { readonly op: "play"; readonly stageY: StageYTrack }
);

export function parseSpeechMotionRequest(
  payload: unknown,
  selectionUnavailable?: (reason: string) => void,
  snapshot?: SpeechMotionSnapshot
): SpeechMotionRequest | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { generation, sectionIndex, op, stageY, performanceId, attentionTargetId } =
    payload as Record<string, unknown>;
  if (Object.keys(payload).some((key) => !["generation", "sectionIndex", "op", "stageY", "performanceId", "attentionTargetId"].includes(key)) ||
      typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 0 ||
      typeof sectionIndex !== "number" || !Number.isSafeInteger(sectionIndex) || sectionIndex < 0) return null;
  const hasSelection = performanceId !== undefined || attentionTargetId !== undefined;
  if (op === "begin" || op === "end" || op === "cancel") {
    return stageY === undefined && !hasSelection ? { generation, sectionIndex, op } : null;
  }
  if (op !== "play") return null;
  if (!hasSelection) return isStageYTrack(stageY) ? { generation, sectionIndex, op, stageY } : null;
  if (stageY !== undefined || typeof performanceId !== "string" || typeof attentionTargetId !== "string") return null;
  const selection = snapshot?.resolve(performanceId, attentionTargetId) ?? { reason: "speech-motion-catalog-unavailable" };
  if ("reason" in selection) {
    selectionUnavailable?.(selection.reason);
    return null;
  }
  return { generation, sectionIndex, op, clip: selection.clip };
}

function isStageYTrack(value: unknown): value is StageYTrack {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return false;
  let previousTime = -1;
  for (const point of value) {
    if (!Array.isArray(point) || point.length !== 2) return false;
    const [time, offset] = point;
    if (typeof time !== "number" || !Number.isInteger(time) || time <= previousTime ||
        time > 10_000 || (previousTime === -1 && time !== 0) ||
        typeof offset !== "number" || !Number.isFinite(offset) || Math.abs(offset) > 200) return false;
    previousTime = time;
  }
  return true;
}

const ENTRY_MS = 180;
const RELEASE_MS = 400;

function ease(fraction: number): number {
  const t = Math.max(0, Math.min(1, fraction));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function blend(from: number, to: number, t: number): number {
  return from + (to - from) * ease(t);
}

function sampleTrack(points: readonly (readonly number[])[], time: number): number {
  let [fromTime = 0, fromValue = 0] = points[0] ?? [];
  for (let index = 1; index < points.length; index += 1) {
    const [toTime = 0, toValue = 0] = points[index] ?? [];
    if (time <= toTime) return blend(fromValue, toValue, (time - fromTime) / (toTime - fromTime));
    fromTime = toTime;
    fromValue = toValue;
  }
  return fromValue;
}

type Pose = Record<string, number>;
type StageYMotion =
  | { readonly kind: "clip"; readonly started: number; readonly points: StageYTrack; readonly from: number }
  | { readonly kind: "release"; readonly started: number; readonly from: number };

export class SpeechMotionState {
  readonly #playback = new SpeechMotionPlayback();
  #cursor: (MotionKey & { owner: number; played: boolean; ended: boolean }) | null = null;
  #stageY: StageYMotion | null = null;

  apply(request: SpeechMotionRequest, owner: number, now: number): void {
    const current = this.#cursor;
    if (request.op === "begin") {
      if (current && (owner < current.owner || (owner === current.owner &&
          (request.generation < current.generation || (request.generation === current.generation &&
          request.sectionIndex <= current.sectionIndex))))) return;
      this.#release(now);
      this.#cursor = { generation: request.generation, sectionIndex: request.sectionIndex, owner, played: false, ended: false };
      return;
    }
    if (!current || current.owner !== owner || current.generation !== request.generation ||
        current.sectionIndex !== request.sectionIndex) return;
    if (request.op === "cancel") {
      current.ended = true;
      this.#release(now);
    } else if (request.op === "end" && !current.ended) {
      current.ended = true;
      this.#playback.end(now);
      this.#releaseStageY(now);
    } else if (request.op === "play" && !current.ended && !current.played) {
      current.played = true;
      if ("clip" in request) {
        this.#playback.start(request.clip, now, request.parameters ?? []);
      } else {
        this.#stageY = { kind: "clip", started: now, points: request.stageY, from: this.sampleStageY(now) };
      }
    }
  }

  #release(now: number): void {
    this.#playback.release(now);
    this.#releaseStageY(now);
  }

  sampleModelParameters(now: number, base: Pose): Pose {
    return this.#playback.parameters(now, base);
  }

  sampleStageY(now: number): number {
    const diagnostic = this.#sampleStageY(now);
    return this.#playback.stage(now, "y", diagnostic) ?? diagnostic;
  }

  #sampleStageY(now: number): number {
    const motion = this.#stageY;
    if (!motion) return 0;
    const elapsed = now - motion.started;
    if (motion.kind === "release") {
      if (elapsed >= RELEASE_MS) this.#stageY = null;
      return blend(motion.from, 0, elapsed / RELEASE_MS);
    }
    if (elapsed < ENTRY_MS) {
      return blend(motion.from, motion.points[0]?.[1] ?? 0, elapsed / ENTRY_MS);
    }
    const trackTime = elapsed - ENTRY_MS;
    const [endTime, endOffset] = motion.points.at(-1) ?? [0, 0];
    if (trackTime <= endTime) return sampleTrack(motion.points, trackTime);
    const releaseTime = trackTime - endTime;
    this.#stageY = releaseTime >= RELEASE_MS ? null : {
      kind: "release", started: motion.started + ENTRY_MS + endTime, from: endOffset
    };
    return blend(endOffset, 0, releaseTime / RELEASE_MS);
  }

  sampleStageScale(now: number): number {
    return this.#playback.stage(now, "scale", 1) ?? 1;
  }

  samplePresenceInput(now: number, channel: "horizontal" | "depth", base: number | null): number | null {
    return this.#playback.stage(now, channel, base) ?? base;
  }

  #releaseStageY(now: number): void {
    if (this.#stageY?.kind !== "clip") return;
    const from = this.#sampleStageY(now);
    if (this.#stageY?.kind === "clip") {
      this.#stageY = from === 0 ? null : { kind: "release", started: now, from };
    }
  }

  disconnect(now: number, owner?: number): void {
    if (!this.#cursor || (owner !== undefined && this.#cursor.owner !== owner)) return;
    this.#cursor.ended = true;
    this.#release(now);
  }

  clear(): void {
    this.#playback.clear();
    if (this.#cursor) this.#cursor.ended = true;
    this.#stageY = null;
  }
}
