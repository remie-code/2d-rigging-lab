export function createInputProfileId(input: {
  readonly displayName: string;
  readonly nowMs: number;
}): string {
  const normalizedName = input.displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const nameSegment = normalizedName.length === 0 ? "profile" : normalizedName;

  return `profile_${nameSegment}_${input.nowMs}`;
}
