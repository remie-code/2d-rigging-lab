import type { CanvasViewportSize } from "./canvas-projection";

export interface CanvasAutoFitPolicyState {
  readonly fallbackCanvasFitApplied: boolean;
  readonly renderableArtworkFitApplied: boolean;
}

export interface CanvasAutoFitPolicyDecision {
  readonly shouldFit: boolean;
  readonly nextState: CanvasAutoFitPolicyState;
}

export const INITIAL_CANVAS_AUTO_FIT_POLICY_STATE: CanvasAutoFitPolicyState = {
  fallbackCanvasFitApplied: false,
  renderableArtworkFitApplied: false
};

export function resolveCanvasAutoFitPolicy(input: {
  readonly state: CanvasAutoFitPolicyState;
  readonly viewport: CanvasViewportSize;
  readonly hasRenderableArtwork: boolean;
}): CanvasAutoFitPolicyDecision {
  if (input.viewport.width <= 0 || input.viewport.height <= 0) {
    return {
      shouldFit: false,
      nextState: input.state
    };
  }

  if (input.hasRenderableArtwork) {
    if (input.state.renderableArtworkFitApplied) {
      return {
        shouldFit: false,
        nextState: input.state
      };
    }

    return {
      shouldFit: true,
      nextState: {
        ...input.state,
        renderableArtworkFitApplied: true
      }
    };
  }

  if (input.state.fallbackCanvasFitApplied || input.state.renderableArtworkFitApplied) {
    return {
      shouldFit: false,
      nextState: input.state
    };
  }

  return {
    shouldFit: true,
    nextState: {
      ...input.state,
      fallbackCanvasFitApplied: true
    }
  };
}
