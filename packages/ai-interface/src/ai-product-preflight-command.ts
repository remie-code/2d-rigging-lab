import {
  ProductPreflightEvidenceRefDtoSchema,
  ProductPreflightReportDiffDtoSchema,
  ProductPreflightReportDtoSchema,
  ProductPreflightRerunAffordanceBlockerDtoSchema,
  ProductPreflightRerunAffordanceIdDtoSchema,
  ProductPreflightRerunAffordanceResponseDtoSchema,
  ProductPreflightRerunAffordanceStatusDtoSchema,
  ProductPreflightRerunRequiredInputDtoSchema,
  ProductPreflightRerunTriggerModeDtoSchema,
  type ProductPreflightReportDiffDto,
  type ProductPreflightReportDto,
  type ProductPreflightRerunAffordanceResponseDto,
  type ProductPreflightRerunRequiredInputDto,
  type ProductPreflightRerunTriggerModeDto
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import { AiCommandBasisSchema, AiCommandSessionSchema } from "./ai-command-request.js";
import { AiCommandStatusSchema } from "./ai-command-response.js";
import {
  ObserveProductPreflightReportResultSchema,
  observeProductPreflightReport
} from "./ai-product-preflight-observation.js";

const DEFAULT_GENERATED_AT = "1970-01-01T00:00:00.000Z";
const RERUN_TRIGGER_MODE_ORDER: readonly ProductPreflightRerunTriggerModeDto[] = [
  "manual",
  "callerTriggered"
];

export const AiProductPreflightCommandNameSchema = z.enum([
  "readProductPreflightReport",
  "diffProductPreflightReports",
  "getProductPreflightRerunAffordance"
]);
export type AiProductPreflightCommandName = z.infer<
  typeof AiProductPreflightCommandNameSchema
>;

export const ReadProductPreflightReportPayloadSchema = z.object({
  report: ProductPreflightReportDtoSchema
}).strict();
export type ReadProductPreflightReportPayload = z.infer<
  typeof ReadProductPreflightReportPayloadSchema
>;

export const ReadProductPreflightReportResultSchema =
  ObserveProductPreflightReportResultSchema;
export type ReadProductPreflightReportResult = z.infer<
  typeof ReadProductPreflightReportResultSchema
>;

export const DiffProductPreflightReportsPayloadSchema = z.object({
  beforeReport: ProductPreflightReportDtoSchema,
  afterReport: ProductPreflightReportDtoSchema
}).strict();
export type DiffProductPreflightReportsPayload = z.infer<
  typeof DiffProductPreflightReportsPayloadSchema
>;

export const DiffProductPreflightReportsResultSchema =
  ProductPreflightReportDiffDtoSchema;
export type DiffProductPreflightReportsResult = z.infer<
  typeof DiffProductPreflightReportsResultSchema
>;

export const GetProductPreflightRerunAffordancePayloadSchema = z.object({
  report: ProductPreflightReportDtoSchema,
  generatedAt: z.string().datetime().optional(),
  affordanceId: ProductPreflightRerunAffordanceIdDtoSchema.optional(),
  status: ProductPreflightRerunAffordanceStatusDtoSchema.default("available"),
  summary: z.string().min(1).optional(),
  allowedTriggerModes: z.array(
    ProductPreflightRerunTriggerModeDtoSchema
  ).min(1).default(["manual", "callerTriggered"]),
  requiredInputs: z.array(ProductPreflightRerunRequiredInputDtoSchema).optional(),
  blockingReasons: z.array(ProductPreflightRerunAffordanceBlockerDtoSchema).default([])
}).strict();
export type GetProductPreflightRerunAffordancePayload = z.infer<
  typeof GetProductPreflightRerunAffordancePayloadSchema
>;
export type GetProductPreflightRerunAffordancePayloadInput = z.input<
  typeof GetProductPreflightRerunAffordancePayloadSchema
>;

export const GetProductPreflightRerunAffordanceResultSchema =
  ProductPreflightRerunAffordanceResponseDtoSchema;
export type GetProductPreflightRerunAffordanceResult = z.infer<
  typeof GetProductPreflightRerunAffordanceResultSchema
>;

export const AiProductPreflightCommandPayloadSchema = z.discriminatedUnion(
  "command",
  [
    z.object({
      command: z.literal("readProductPreflightReport"),
      payload: ReadProductPreflightReportPayloadSchema
    }),
    z.object({
      command: z.literal("diffProductPreflightReports"),
      payload: DiffProductPreflightReportsPayloadSchema
    }),
    z.object({
      command: z.literal("getProductPreflightRerunAffordance"),
      payload: GetProductPreflightRerunAffordancePayloadSchema
    })
  ]
);
export type AiProductPreflightCommandPayload = z.infer<
  typeof AiProductPreflightCommandPayloadSchema
>;

export const AiProductPreflightCommandRequestSchema = z.intersection(
  z.object({
    schemaVersion: z.literal("ai-product-preflight-command-request-v0"),
    commandId: z.string().min(1),
    session: AiCommandSessionSchema,
    basis: AiCommandBasisSchema
  }),
  AiProductPreflightCommandPayloadSchema
);
export type AiProductPreflightCommandRequest = z.infer<
  typeof AiProductPreflightCommandRequestSchema
>;

export const AiProductPreflightCommandResponsePayloadSchema = z.discriminatedUnion(
  "command",
  [
    z.object({
      command: z.literal("readProductPreflightReport"),
      payload: ReadProductPreflightReportResultSchema
    }),
    z.object({
      command: z.literal("diffProductPreflightReports"),
      payload: DiffProductPreflightReportsResultSchema
    }),
    z.object({
      command: z.literal("getProductPreflightRerunAffordance"),
      payload: GetProductPreflightRerunAffordanceResultSchema
    })
  ]
);
export type AiProductPreflightCommandResponsePayload = z.infer<
  typeof AiProductPreflightCommandResponsePayloadSchema
>;

export const AiProductPreflightCommandResponseSchema = z.intersection(
  z.object({
    schemaVersion: z.literal("ai-product-preflight-command-response-v0"),
    commandId: z.string().min(1),
    status: AiCommandStatusSchema,
    evidenceRefs: z.array(ProductPreflightEvidenceRefDtoSchema).default([])
  }),
  AiProductPreflightCommandResponsePayloadSchema
);
export type AiProductPreflightCommandResponse = z.infer<
  typeof AiProductPreflightCommandResponseSchema
>;

export interface ProductPreflightReportDiffProviderInput {
  readonly beforeReport: ProductPreflightReportDto;
  readonly afterReport: ProductPreflightReportDto;
  readonly rerunAffordance?: ProductPreflightRerunAffordanceResponseDto;
}

export type ProductPreflightReportDiffProvider = (
  input: ProductPreflightReportDiffProviderInput
) => ProductPreflightReportDiffDto | Promise<ProductPreflightReportDiffDto>;

export interface DiffProductPreflightReportsInput
  extends DiffProductPreflightReportsPayload {
  readonly diffProvider: ProductPreflightReportDiffProvider;
  readonly rerunAffordance?: ProductPreflightRerunAffordanceResponseDto;
}

export const readProductPreflightReport = (
  input: ReadProductPreflightReportPayload
): ReadProductPreflightReportResult => {
  const parsed = ReadProductPreflightReportPayloadSchema.parse(input);

  return ReadProductPreflightReportResultSchema.parse(
    observeProductPreflightReport(parsed)
  );
};

export const diffProductPreflightReports = async (
  input: DiffProductPreflightReportsInput
): Promise<DiffProductPreflightReportsResult> => {
  const parsed = DiffProductPreflightReportsPayloadSchema.parse({
    beforeReport: input.beforeReport,
    afterReport: input.afterReport
  });
  const rerunAffordance =
    input.rerunAffordance === undefined
      ? undefined
      : ProductPreflightRerunAffordanceResponseDtoSchema.parse(input.rerunAffordance);
  const diff = await input.diffProvider({
    beforeReport: parsed.beforeReport,
    afterReport: parsed.afterReport,
    ...(rerunAffordance === undefined ? {} : { rerunAffordance })
  });

  return DiffProductPreflightReportsResultSchema.parse(diff);
};

export const createProductPreflightRerunAffordanceResponse = (
  input: GetProductPreflightRerunAffordancePayloadInput
): GetProductPreflightRerunAffordanceResult => {
  const parsed = GetProductPreflightRerunAffordancePayloadSchema.parse(input);
  const report = parsed.report;
  const allowedTriggerModes = sortAndDedupeTriggerModes(parsed.allowedTriggerModes);
  const requiredInputs = parsed.requiredInputs === undefined
    ? deriveRequiredInputs(allowedTriggerModes)
    : sortAndDedupeRequiredInputs(parsed.requiredInputs);

  return GetProductPreflightRerunAffordanceResultSchema.parse({
    schemaVersion: "product-preflight-rerun-affordance-response-v0",
    affordanceId: parsed.affordanceId ?? createRerunAffordanceId(report),
    generatedAt: parsed.generatedAt ?? DEFAULT_GENERATED_AT,
    sourceReportId: report.reportId,
    packageId: report.packageId,
    packageRevision: report.packageRevision,
    status: parsed.status,
    summary: parsed.summary ?? createRerunAffordanceSummary(report, parsed.status),
    canRequestRerun: parsed.status === "available",
    allowedTriggerModes,
    automaticRerunAllowed: false,
    autoFixAllowed: false,
    automaticCommitAllowed: false,
    requiredInputs,
    blockingReasons: parsed.blockingReasons,
    responseShape: {
      responseKind: "productPreflightReport",
      reportSchemaVersion: "product-preflight-report-v0",
      sessionGeneratedReportOnly: true,
      persistedArtifactCreated: false,
      automaticCommitAllowed: false,
      autoFixAllowed: false
    }
  });
};

const createRerunAffordanceId = (
  report: ProductPreflightReportDto
): string =>
  `preflightRerun_${sanitizeToken(report.reportId.replace(/^preflight_/, ""))}_r${report.packageRevision}`;

const createRerunAffordanceSummary = (
  report: ProductPreflightReportDto,
  status: GetProductPreflightRerunAffordancePayload["status"]
): string => {
  if (status === "available") {
    return `Product Preflight report ${report.reportId} can be rerun by manual or caller-triggered request; no automatic rerun, auto-fix, or commit is allowed.`;
  }

  if (status === "blocked") {
    return `Product Preflight report ${report.reportId} cannot be rerun until required caller context is supplied.`;
  }

  return `Product Preflight rerun availability for report ${report.reportId} has not been evaluated.`;
};

const deriveRequiredInputs = (
  triggerModes: readonly ProductPreflightRerunTriggerModeDto[]
): readonly ProductPreflightRerunRequiredInputDto[] => {
  const requiredInputs: ProductPreflightRerunRequiredInputDto[] = [
    "currentPackageState",
    "validatorEvidenceContext"
  ];

  if (triggerModes.includes("manual")) {
    requiredInputs.push("manualTrigger");
  }

  if (triggerModes.includes("callerTriggered")) {
    requiredInputs.push("callerTriggeredRequest");
  }

  return requiredInputs;
};

const sortAndDedupeTriggerModes = (
  triggerModes: readonly ProductPreflightRerunTriggerModeDto[]
): readonly ProductPreflightRerunTriggerModeDto[] => {
  const modeSet = new Set(triggerModes);

  return RERUN_TRIGGER_MODE_ORDER.filter((mode) => modeSet.has(mode));
};

const sortAndDedupeRequiredInputs = (
  requiredInputs: readonly ProductPreflightRerunRequiredInputDto[]
): readonly ProductPreflightRerunRequiredInputDto[] => {
  const inputSet = new Set(requiredInputs);
  const inputOrder: readonly ProductPreflightRerunRequiredInputDto[] = [
    "currentPackageState",
    "validatorEvidenceContext",
    "manualTrigger",
    "callerTriggeredRequest"
  ];

  return inputOrder.filter((requiredInput) => inputSet.has(requiredInput));
};

const sanitizeToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "report";
