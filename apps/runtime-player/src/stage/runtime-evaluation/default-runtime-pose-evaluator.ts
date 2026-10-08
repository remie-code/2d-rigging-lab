import {
  evaluateRuntimeExportPose,
  type RuntimeExportPoseEvaluation
} from "./runtime-export-pose-evaluator";
import type { RuntimeExportRuntimeGraphAdapterInput } from "./runtime-export-runtime-graph-adapter";

export type RuntimeExportDefaultPoseEvaluation = RuntimeExportPoseEvaluation;

export function evaluateRuntimeExportDefaultPose(
  input: RuntimeExportRuntimeGraphAdapterInput
): RuntimeExportDefaultPoseEvaluation {
  return evaluateRuntimeExportPose(input);
}
