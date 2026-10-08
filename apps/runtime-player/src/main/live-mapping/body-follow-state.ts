import type {
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";

const maxSmoothing = 0.95;

export class RuntimePlayerBodyFollowState {
  private readonly values = new Map<RuntimePlayerMappingSlotId, number>();

  reset(): void {
    this.values.clear();
  }

  apply(input: {
    readonly slotId: RuntimePlayerMappingSlotId;
    readonly targetValue: number;
    readonly smoothing: number;
  }): number {
    const targetValue = Number.isFinite(input.targetValue)
      ? input.targetValue
      : 0;
    const smoothing = clamp(input.smoothing, 0, maxSmoothing);
    const previousValue = this.values.get(input.slotId);

    if (previousValue === undefined) {
      this.values.set(input.slotId, targetValue);
      return targetValue;
    }

    const nextValue = previousValue + (targetValue - previousValue) *
      (1 - smoothing);
    this.values.set(input.slotId, nextValue);

    return nextValue;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
