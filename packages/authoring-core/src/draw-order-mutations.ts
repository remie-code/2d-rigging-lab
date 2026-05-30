import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import type { DrawOrderEntryDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const createNextDrawOrderEntry = (
  graph: AuthoringGraph,
  drawableId: DrawableId
): DrawOrderEntryDto => {
  const nextOrder = nextDrawOrderValue(graph.drawOrder);

  return {
    drawableId,
    baseDrawOrder: nextOrder,
    stableOrder: nextOrder
  };
};

export const addDrawOrderEntry = (
  graph: AuthoringGraph,
  entry: DrawOrderEntryDto
): void => {
  graph.drawOrder.push(structuredClone(entry));
};

const nextDrawOrderValue = (entries: readonly DrawOrderEntryDto[]): number => {
  if (entries.length === 0) {
    return 0;
  }

  return Math.max(...entries.map((entry) => entry.stableOrder)) + 1;
};
