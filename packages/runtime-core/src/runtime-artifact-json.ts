export const runtimeArtifactJsonMediaType = "application/json";

export const stringifyRuntimeArtifactJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
