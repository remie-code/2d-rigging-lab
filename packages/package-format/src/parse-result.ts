import type { z } from "zod";

export interface PackageParseSuccess<TValue> {
  readonly success: true;
  readonly data: TValue;
}

export interface PackageParseFailure {
  readonly success: false;
  readonly issues: readonly z.ZodIssue[];
}

export type PackageParseResult<TValue> = PackageParseSuccess<TValue> | PackageParseFailure;

type SafeParseLike<TValue> =
  | { readonly success: true; readonly data: TValue }
  | { readonly success: false; readonly error: { readonly issues: readonly z.ZodIssue[] } };

export function toPackageParseResult<TValue>(result: SafeParseLike<TValue>): PackageParseResult<TValue> {
  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  return {
    success: false,
    issues: result.error.issues
  };
}
