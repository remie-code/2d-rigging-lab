import type { AuthoringGraph } from "./authoring-graph.js";

export const addStableOrderId = (graph: AuthoringGraph, id: string): void => {
  if (!graph.stableOrder.includes(id)) {
    graph.stableOrder.push(id);
  }
};
