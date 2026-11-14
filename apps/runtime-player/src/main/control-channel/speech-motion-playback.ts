import { speechMotionStageRanges, type MotionClip, type MotionStageChannel, type MotionTrack } from "./speech-motion-assets";
import type { RuntimePlayerMappingTarget } from "../../preload/model-mapping-bridge-contract";

export const SPEECH_MOTION_ENTRY_MS = 180;
export const SPEECH_MOTION_RELEASE_MS = 400;
export const SPEECH_MOTION_MAX_OPEN_HOLD_MS = 30_000;

export function blendMotion(from: number, to: number, fraction: number): number {
  const t = Math.max(0, Math.min(1, fraction));
  const eased = t * t * t * (t * (t * 6 - 15) + 10);
  return from + (to - from) * eased;
}

export function sampleMotionTrack(points: MotionTrack, elapsed: number, linear = false): number {
  let [fromTime, from] = points[0]!;
  for (let index = 1; index < points.length; index += 1) {
    const [toTime, to] = points[index]!;
    if (elapsed <= toTime) {
      const fraction = (elapsed - fromTime) / (toTime - fromTime);
      return linear ? from + (to - from) * Math.max(0, fraction) : blendMotion(from, to, fraction);
    }
    fromTime = toTime;
    from = to;
  }
  return from;
}

type Pose = Record<string, number>;
type Channel = {
  readonly at: number;
  readonly points: MotionTrack;
  readonly from: number;
  readonly defaultValue: number;
  readonly entry: MotionClip["entry"] | "fixed";
  readonly linear?: boolean;
  readonly entryMs?: number;
  readonly range?: Pick<RuntimePlayerMappingTarget, "min" | "max">;
  readonly animationEnd: number;
  releaseAt: number;
  readonly holdAfterEnd?: number;
};
type Release = { readonly at: number; readonly from: number; readonly defaultValue: number };
type Motion = Channel | Release;

export class SpeechMotionPlayback {
  readonly #parameters = new Map<string, Motion>();
  readonly #stage = new Map<MotionStageChannel, Motion>();
  #parameterBase: Pose = {};
  #stageBase: Partial<Record<MotionStageChannel, number>> = {};

  start(clip: MotionClip, now: number, parameters: readonly RuntimePlayerMappingTarget[]): void {
    const leadIn = clip.entry === "lead-in" ? SPEECH_MOTION_ENTRY_MS : 0;
    const animationEnd = now + leadIn + clip.durationMs;
    const holdAfterEnd = clip.hold?.untilSpeechEnd ? clip.hold.ms : undefined;
    const releaseAt = animationEnd + (holdAfterEnd === undefined ? clip.hold?.ms ?? 0 : SPEECH_MOTION_MAX_OPEN_HOLD_MS);
    for (const [id, points] of Object.entries(clip.tracks ?? {})) {
      const parameter = parameters.find(({ parameterId }) => parameterId === id);
      const defaultValue = parameter?.default ?? clip.defaults?.[id] ?? 0;
      const base = this.#parameterBase[id] ?? defaultValue;
      this.#parameters.set(id, {
        at: now, points, defaultValue, entry: clip.entry, animationEnd, releaseAt,
        from: this.#sample(this.#parameters, id, now, base) ?? base,
        ...(holdAfterEnd === undefined ? {} : { holdAfterEnd }),
        ...(parameter ? { range: parameter } : {})
      });
    }
    for (const [id, value] of Object.entries(clip.fixed ?? {})) {
      this.#parameters.set(id, {
        at: now, points: [[0, value]], from: value,
        defaultValue: parameters.find(({ parameterId }) => parameterId === id)?.default ?? clip.defaults?.[id] ?? 0,
        entry: "fixed", animationEnd, releaseAt, ...(holdAfterEnd === undefined ? {} : { holdAfterEnd })
      });
    }
    for (const id of ["y", "scale", "horizontal", "depth"] as const) {
      const points = clip.stage?.[id];
      if (!points) continue;
      const defaultValue = id === "scale" ? 1 : 0;
      const base = this.#stageBase[id] ?? defaultValue;
      const entry = id === "y" && clip.stageYLeadIn ? "lead-in" : clip.entry;
      // Explicit Stage tracks end at their last key. A single key holds for the clip duration.
      const trackEnd = points.length === 1 ? clip.durationMs : points.at(-1)![0];
      const end = id === "y" || id === "scale"
        ? now + (entry === "lead-in" ? SPEECH_MOTION_ENTRY_MS : 0) + trackEnd
        : animationEnd;
      this.#stage.set(id, {
        at: now, points, defaultValue, entry, animationEnd: end,
        range: speechMotionStageRanges[id],
        releaseAt: id === "y" || id === "scale" ? end : releaseAt,
        ...(id === "scale" && clip.stageScaleLinear ? { linear: true } : {}),
        ...(id === "scale" && clip.stageScaleEntryMs !== undefined ? { entryMs: clip.stageScaleEntryMs } : {}),
        ...(id !== "y" && id !== "scale" && holdAfterEnd !== undefined ? { holdAfterEnd } : {}),
        from: this.#sample(this.#stage, id, now, base) ?? base
      });
    }
  }

  end(now: number): void {
    for (const motion of [...this.#parameters.values(), ...this.#stage.values()]) {
      if ("holdAfterEnd" in motion && motion.holdAfterEnd !== undefined && now < motion.releaseAt) {
        motion.releaseAt = Math.min(motion.releaseAt, Math.max(now, motion.animationEnd) + motion.holdAfterEnd);
      }
    }
  }

  release(now: number): void {
    this.#release(this.#parameters, now, this.#parameterBase);
    this.#release(this.#stage, now, this.#stageBase);
  }

  #release<K extends string>(motions: Map<K, Motion>, now: number, base: Partial<Record<K, number>>): void {
    for (const [id, motion] of motions) {
      if (!("points" in motion) || now >= motion.releaseAt) continue;
      const target = base[id] ?? motion.defaultValue;
      const from = this.#sample(motions, id, now, target) ?? target;
      motions.set(id, { at: now, from, defaultValue: motion.defaultValue });
    }
  }

  parameters(now: number, base: Pose): Pose {
    this.#parameterBase = base;
    if (!this.#parameters.size) return base;
    const values = { ...base };
    for (const [id, motion] of this.#parameters) {
      const value = this.#sample(this.#parameters, id, now, base[id] ?? motion.defaultValue);
      if (value !== undefined) values[id] = value;
    }
    return values;
  }

  stage(now: number, id: MotionStageChannel, base: number | null): number | undefined {
    this.#stageBase[id] = base ?? 0;
    return this.#sample(this.#stage, id, now, this.#stageBase[id]);
  }

  #sample<K>(motions: Map<K, Motion>, id: K, now: number, base: number): number | undefined {
    const motion = motions.get(id);
    if (!motion) return undefined;
    const { from, at } = motion;
    if ("points" in motion && now < motion.releaseAt) {
      const elapsed = Math.max(0, now - at);
      const start = motion.points[0]![1];
      if (motion.entry === "fixed") return start;
      if (motion.entry === "lead-in") {
        return elapsed < SPEECH_MOTION_ENTRY_MS
          ? blendMotion(from, start, elapsed / SPEECH_MOTION_ENTRY_MS)
          : sampleMotionTrack(motion.points, elapsed - SPEECH_MOTION_ENTRY_MS, motion.linear);
      }
      const entryMs = Math.min(motion.entryMs ?? SPEECH_MOTION_RELEASE_MS, motion.animationEnd - at);
      const correction = entryMs > 0 ? blendMotion(from - start, 0, elapsed / entryMs) : 0;
      const value = sampleMotionTrack(motion.points, elapsed, motion.linear) + correction;
      return motion.range ? Math.min(motion.range.max, Math.max(motion.range.min, value)) : value;
    }
    const releaseAt = "points" in motion ? motion.releaseAt : at;
    if (now >= releaseAt + SPEECH_MOTION_RELEASE_MS) {
      motions.delete(id);
      return undefined;
    }
    const final = "points" in motion ? motion.points.at(-1)![1] : from;
    return blendMotion(final, base, (now - releaseAt) / SPEECH_MOTION_RELEASE_MS);
  }

  clear(): void {
    this.#parameters.clear();
    this.#stage.clear();
    this.#parameterBase = {};
    this.#stageBase = {};
  }
}
