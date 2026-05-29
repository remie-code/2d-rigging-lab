import { OperationLogEntrySchema } from "./operation-log-entry.js";
import type { OperationLogEntryDto } from "./operation-log-entry.js";

export const serializeOperationLogEntryToJsonlLine = (
  entry: OperationLogEntryDto
): string => JSON.stringify(OperationLogEntrySchema.parse(entry));

export const serializeOperationLogEntriesToJsonl = (
  entries: readonly OperationLogEntryDto[]
): string => {
  if (entries.length === 0) {
    return "";
  }

  return `${entries.map(serializeOperationLogEntryToJsonlLine).join("\n")}\n`;
};

export const parseOperationLogEntriesFromJsonl = (
  jsonl: string
): OperationLogEntryDto[] => {
  if (jsonl.length === 0) {
    return [];
  }

  const lines = jsonl.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }

  return lines.map((line, index) => parseOperationLogEntryJsonlLine(line, index + 1));
};

export const parseOperationLogEntryJsonlLine = (
  line: string,
  lineNumber = 1
): OperationLogEntryDto => {
  if (line.trim().length === 0) {
    throw new Error(`Invalid operation log JSONL line ${lineNumber}: empty lines are not valid entries.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid operation log JSONL line ${lineNumber}: line is not valid JSON.`, {
      cause: error
    });
  }

  const result = OperationLogEntrySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid operation log JSONL line ${lineNumber}: ${result.error.issues
        .map((issue) => issue.message)
        .join("; ")}`
    );
  }

  return result.data;
};
