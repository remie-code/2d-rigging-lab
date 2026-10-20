import { DiagnosticSchema, type DiagnosticDto, type TargetRefDto } from "@private-2d-rigging-lab/contracts";

export const materialDiagnostic = (code: string, message: string, target: TargetRefDto, phase = "material-candidate"): DiagnosticDto =>
  DiagnosticSchema.parse({ checkId: `material.${code}`, status: "fail", severity: "error",
    phase, target, message });

/** A rejection carrying a stable diagnostic code; callers that only need a message may treat it as an Error. */
export class MaterialRejection extends Error {
  constructor(readonly code: string, message: string, readonly target?: TargetRefDto) {
    super(message);
    this.name = "MaterialRejection";
  }
}

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
