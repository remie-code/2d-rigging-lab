import type {
  VariantGroupDto,
  VariantGroupIdDto,
  VariantIdDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const getVariantGroups = (graph: AuthoringGraph): VariantGroupDto[] => {
  graph.variantGroups ??= [];
  return graph.variantGroups;
};

export const getVariantGroupById = (
  graph: AuthoringGraph,
  variantGroupId: VariantGroupIdDto
): VariantGroupDto | undefined =>
  getVariantGroups(graph).find((group) => group.variantGroupId === variantGroupId);

export const getVariantById = (
  graph: AuthoringGraph,
  variantId: VariantIdDto
): { readonly group: VariantGroupDto; readonly variant: VariantGroupDto["variants"][number] } | undefined => {
  for (const group of getVariantGroups(graph)) {
    const variant = group.variants.find((candidate) => candidate.variantId === variantId);
    if (variant !== undefined) {
      return { group, variant };
    }
  }

  return undefined;
};

export const getVariantGroupForDrawable = (
  graph: AuthoringGraph,
  drawableId: string
): VariantGroupDto | undefined =>
  getVariantGroups(graph).find((group) =>
    group.targetDrawableIds.some((targetDrawableId) => targetDrawableId === drawableId)
  );
