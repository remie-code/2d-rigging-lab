import { z } from "zod";

import type { Brand } from "./brand.js";

export type CheckId = Brand<string, "CheckId">;

export const CheckIdSchema = z.string().regex(/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/) as unknown as z.ZodType<CheckId>;
