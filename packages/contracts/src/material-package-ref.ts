import { z } from "zod";
import { PackageIdSchema } from "./ids.js";

/**
 * Package identity at one saved revision, without a content fingerprint.
 * Git owns reverting and committing package content; material artifacts only record which package revision they describe.
 */
export const MaterialPackageRefSchema = z.object({
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative()
}).strict();
export type MaterialPackageRef = z.infer<typeof MaterialPackageRefSchema>;
export const materialPackageRefsEqual = (a: MaterialPackageRef, b: MaterialPackageRef): boolean =>
  a.packageId === b.packageId && a.packageRevision === b.packageRevision;
