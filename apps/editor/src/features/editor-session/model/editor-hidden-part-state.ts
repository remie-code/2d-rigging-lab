import type { PartId } from "@private-2d-rigging-lab/contracts";

export function mergeEditorHiddenPartIds(
  current: ReadonlySet<PartId>,
  importedPartIds: readonly PartId[]
): ReadonlySet<PartId> {
  if (importedPartIds.length === 0) {
    return current;
  }

  const next = new Set(current);
  let changed = false;

  for (const partId of importedPartIds) {
    if (!next.has(partId)) {
      next.add(partId);
      changed = true;
    }
  }

  return changed ? next : current;
}
