import { DiagnosticSchema, type DiagnosticDto, type TargetRefDto } from "@private-2d-rigging-lab/contracts";

export const materialDiagnostic = (code: string, message: string, target: TargetRefDto): DiagnosticDto =>
  DiagnosticSchema.parse({ checkId: `material.${code}`, status: "fail", severity: "error",
    phase: "material-candidate", target, message });

export const materialEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a instanceof Uint8Array && b instanceof Uint8Array) return a.length === b.length && a.every((value, i) => value === b[i]);
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && materialEqual(left[key], right[key]));
};

export const materialSha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
};
