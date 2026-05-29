export function stringifyJsonDeterministic(value: unknown): string {
  const text = JSON.stringify(toStableJsonValue(value), null, 2);

  if (text === undefined) {
    throw new Error("Cannot serialize undefined as package JSON");
  }

  return `${text}\n`;
}

function toStableJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toStableJsonValue(item));
  }

  const record = value as Record<string, unknown>;
  const sortedRecord: Record<string, unknown> = {};

  for (const key of Object.keys(record).sort()) {
    const stableValue = toStableJsonValue(record[key]);

    if (stableValue !== undefined) {
      sortedRecord[key] = stableValue;
    }
  }

  return sortedRecord;
}
