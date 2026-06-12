import {
  listInitializedParameters,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import { ParameterIdSchema, type ParameterId } from "@private-2d-rigging-lab/contracts";

type InitializedParameter = ReturnType<typeof listInitializedParameters>[number];
type ParameterGroupId = InitializedParameter["group"];

export type ParameterManagerGroupFilter = "all" | ParameterGroupId;

export const PARAMETER_MANAGER_GROUP_FILTERS: readonly {
  readonly id: ParameterManagerGroupFilter;
  readonly label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "face", label: "Face" },
  { id: "eyes", label: "Eyes" },
  { id: "mouth", label: "Mouth" },
  { id: "browCheek", label: "Brow/Cheek" },
  { id: "body", label: "Body" },
  { id: "secondary", label: "Secondary" },
  { id: "custom", label: "Custom" }
];

export const PARAMETER_TABLE_COLUMNS = ["Name", "Kind", "Range", "Used"] as const;

export type ParameterManagerUsageItem = {
  readonly targetLabel: string;
  readonly propertyLabel: string;
  readonly detailLabel: string;
};

export type ParameterManagerCheck = {
  readonly severity: "warning" | "error";
  readonly checkId: string;
  readonly message: string;
  readonly parameterId: ParameterId | null;
};

export type ParameterManagerParameterRow = {
  readonly parameter: InitializedParameter;
  readonly parameterId: ParameterId;
  readonly displayName: string;
  readonly kind: "preset" | "custom";
  readonly kindLabel: string;
  readonly group: ParameterGroupId;
  readonly groupLabel: string;
  readonly typeLabel: string;
  readonly rangeLabel: string;
  readonly usageCount: number;
  readonly usageSummary: string;
  readonly usageItems: readonly ParameterManagerUsageItem[];
  readonly presetRole: string | null;
  readonly signConventionSummary: string | null;
};

export type ParameterManagerProjection = {
  readonly rows: readonly ParameterManagerParameterRow[];
  readonly filteredRows: readonly ParameterManagerParameterRow[];
  readonly checks: readonly ParameterManagerCheck[];
  readonly warningCount: number;
  readonly errorCount: number;
};

export function createParameterManagerProjection(
  session: AuthoringSession,
  options: {
    readonly groupFilter?: ParameterManagerGroupFilter;
    readonly search?: string;
  } = {}
): ParameterManagerProjection {
  const usageByParameterId = createUsageIndex(session);
  const rows = listInitializedParameters(session.graph).map((parameter) =>
    createParameterRow(parameter, usageByParameterId.get(parameter.parameterId) ?? [])
  );
  const checks = createManagerChecks(session, rows);
  const filteredRows = filterRows(rows, options);

  return {
    rows,
    filteredRows,
    checks,
    warningCount: checks.filter((check) => check.severity === "warning").length,
    errorCount: checks.filter((check) => check.severity === "error").length
  };
}

export function getParameterGroupLabel(group: ParameterGroupId): string {
  return PARAMETER_GROUP_LABELS[group];
}

export function formatParameterRange(parameter: InitializedParameter): string {
  return `${formatParameterNumber(parameter.min)} / ${formatParameterNumber(
    parameter.default
  )} / ${formatParameterNumber(parameter.max)}`;
}

export function formatParameterNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}

export function createSuggestedCustomParameterId(
  displayName: string,
  existingIds: ReadonlySet<string> = new Set()
): ParameterId {
  const baseId = `param_${sanitizeIdToken(displayName)}`;
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}_${index}`;
    index += 1;
  }

  return ParameterIdSchema.parse(candidate);
}

export function parseParameterIdInput(input: string):
  | { readonly ok: true; readonly parameterId: ParameterId }
  | { readonly ok: false; readonly message: string } {
  const trimmed = input.trim();
  const parsed = ParameterIdSchema.safeParse(trimmed);

  if (parsed.success) {
    return { ok: true, parameterId: parsed.data };
  }

  return {
    ok: false,
    message: "Stable id must start with param_ and use letters, numbers, underscores, or hyphens."
  };
}

function createParameterRow(
  parameter: InitializedParameter,
  usageItems: readonly ParameterManagerUsageItem[]
): ParameterManagerParameterRow {
  return {
    parameter,
    parameterId: parameter.parameterId,
    displayName: parameter.displayName,
    kind: parameter.kind,
    kindLabel: parameter.kind === "preset" ? "Preset locked" : "Custom",
    group: parameter.group,
    groupLabel: getParameterGroupLabel(parameter.group),
    typeLabel: parameter.parameterType,
    rangeLabel: formatParameterRange(parameter),
    usageCount: usageItems.length,
    usageSummary: formatUsageSummary(usageItems.length),
    usageItems,
    presetRole: typeof parameter.presetRole === "string" ? parameter.presetRole : null,
    signConventionSummary:
      parameter.signConvention === undefined
        ? null
        : `Min: ${parameter.signConvention.min}; Default: ${parameter.signConvention.default}; Max: ${parameter.signConvention.max}`
  };
}

function filterRows(
  rows: readonly ParameterManagerParameterRow[],
  options: {
    readonly groupFilter?: ParameterManagerGroupFilter;
    readonly search?: string;
  }
): readonly ParameterManagerParameterRow[] {
  const groupFilter = options.groupFilter ?? "all";
  const query = (options.search ?? "").trim().toLowerCase();

  return rows.filter((row) => {
    if (groupFilter !== "all" && row.group !== groupFilter) {
      return false;
    }

    if (query.length === 0) {
      return true;
    }

    return [
      row.displayName,
      row.parameterId,
      row.kindLabel,
      row.groupLabel,
      row.presetRole ?? ""
    ].some((value) => value.toLowerCase().includes(query));
  });
}

function createUsageIndex(
  session: AuthoringSession
): Map<ParameterId, readonly ParameterManagerUsageItem[]> {
  const mutableUsage = new Map<ParameterId, ParameterManagerUsageItem[]>();

  const addUsage = (parameterId: ParameterId, item: ParameterManagerUsageItem) => {
    const existing = mutableUsage.get(parameterId);
    if (existing === undefined) {
      mutableUsage.set(parameterId, [item]);
      return;
    }

    existing.push(item);
  };

  session.graph.keyformSets.forEach((keyformSet) => {
    if (keyformSet.evaluator === "linear-1d-v1") {
      addUsage(keyformSet.parameterId, createKeyformUsageItem(session, keyformSet, "Parameter axis"));
      return;
    }

    if (keyformSet.parameterX === keyformSet.parameterY) {
      addUsage(keyformSet.parameterX, createKeyformUsageItem(session, keyformSet, "X/Y axes"));
      return;
    }

    addUsage(keyformSet.parameterX, createKeyformUsageItem(session, keyformSet, "X axis"));
    addUsage(keyformSet.parameterY, createKeyformUsageItem(session, keyformSet, "Y axis"));
  });

  session.graph.dynamicsGroups.forEach((group) => {
    group.drivers.forEach((driver) => {
      addUsage(driver.sourceParameterId, {
        targetLabel: `Dynamics: ${group.displayName}`,
        propertyLabel: "driver input parameter",
        detailLabel: `Driver ${driver.driverId}`
      });
    });

    addUsage(group.output.targetParameterId, {
      targetLabel: `Dynamics: ${group.displayName}`,
      propertyLabel: "output target parameter",
      detailLabel: `Output ${group.output.outputId}`
    });
  });

  return mutableUsage;
}

function createKeyformUsageItem(
  session: AuthoringSession,
  keyformSet: AuthoringSession["graph"]["keyformSets"][number],
  axisLabel: string
): ParameterManagerUsageItem {
  return {
    detailLabel: `${axisLabel} / ${formatKeyCount(keyformSet.keys.length)}`,
    propertyLabel: formatTargetProperty(keyformSet.target.property),
    targetLabel: formatTargetLabel(session, keyformSet.target)
  };
}

function createManagerChecks(
  session: AuthoringSession,
  rows: readonly ParameterManagerParameterRow[]
): readonly ParameterManagerCheck[] {
  const checks: ParameterManagerCheck[] = [];
  const parameterById = new Map(rows.map((row) => [row.parameterId, row.parameter]));

  checks.push(...createDuplicateStoredParameterChecks(session));

  rows.forEach((row) => {
    if (row.parameter.min > row.parameter.max) {
      checks.push({
        severity: "error",
        checkId: "parameterManager.invalidRange",
        message: `${row.displayName} has min greater than max.`,
        parameterId: row.parameterId
      });
    } else if (
      row.parameter.default < row.parameter.min ||
      row.parameter.default > row.parameter.max
    ) {
      checks.push({
        severity: "error",
        checkId: "parameterManager.defaultOutOfRange",
        message: `${row.displayName} has a default outside its range.`,
        parameterId: row.parameterId
      });
    }

    if (row.kind === "custom" && row.usageCount === 0) {
      checks.push({
        severity: "warning",
        checkId: "parameterManager.unusedCustom",
        message: `${row.displayName} is unused.`,
        parameterId: row.parameterId
      });
    }
  });

  session.graph.keyformSets.forEach((keyformSet) => {
    if (keyformSet.evaluator === "linear-1d-v1") {
      const parameter = parameterById.get(keyformSet.parameterId);
      if (parameter === undefined) {
        checks.push({
          severity: "error",
          checkId: "parameterManager.keyformParameterMissing",
          message: `A keyform references missing parameter ${keyformSet.parameterId}.`,
          parameterId: null
        });
        return;
      }

      checks.push(
        ...keyformSet.keys
          .filter((key) => key.value < parameter.min || key.value > parameter.max)
          .map((key) => ({
            severity: "error" as const,
            checkId: "parameterManager.keyformOutOfRange",
            message: `${parameter.displayName} has a keyform outside ${formatParameterRange(
              parameter
            )}.`,
            parameterId: parameter.parameterId
          }))
      );
      return;
    }

    [
      { parameterId: keyformSet.parameterX, coordinate: "X", values: keyformSet.keys.map((key) => key.x) },
      { parameterId: keyformSet.parameterY, coordinate: "Y", values: keyformSet.keys.map((key) => key.y) }
    ].forEach((axis) => {
      const parameter = parameterById.get(axis.parameterId);
      if (parameter === undefined) {
        checks.push({
          severity: "error",
          checkId: "parameterManager.keyformParameterMissing",
          message: `A grid keyform references missing ${axis.coordinate} parameter ${axis.parameterId}.`,
          parameterId: null
        });
        return;
      }

      if (axis.values.some((value) => value < parameter.min || value > parameter.max)) {
        checks.push({
          severity: "error",
          checkId: "parameterManager.keyformOutOfRange",
          message: `${parameter.displayName} has a ${axis.coordinate} keyform outside ${formatParameterRange(
            parameter
          )}.`,
          parameterId: parameter.parameterId
        });
      }
    });
  });

  return checks;
}

function createDuplicateStoredParameterChecks(
  session: AuthoringSession
): readonly ParameterManagerCheck[] {
  const firstIndexById = new Map<string, number>();
  const checks: ParameterManagerCheck[] = [];

  session.graph.parameters.forEach((parameter, index) => {
    const firstIndex = firstIndexById.get(parameter.parameterId);
    if (firstIndex === undefined) {
      firstIndexById.set(parameter.parameterId, index);
      return;
    }

    checks.push({
      severity: "error",
      checkId: "parameterManager.duplicateStoredParameter",
      message: `Stored parameter id ${parameter.parameterId} appears more than once.`,
      parameterId: parameter.parameterId
    });
  });

  return checks;
}

function formatUsageSummary(usageCount: number): string {
  if (usageCount === 0) {
    return "Unused";
  }

  return usageCount === 1 ? "Used by 1 target" : `Used by ${usageCount} targets`;
}

function formatKeyCount(keyCount: number): string {
  return keyCount === 1 ? "1 key" : `${keyCount} keys`;
}

function formatTargetLabel(
  session: AuthoringSession,
  target: AuthoringSession["graph"]["keyformSets"][number]["target"]
): string {
  if (target.kind === "rigControl") {
    const rigControl = session.graph.rigControls.find(
      (candidate) => candidate.rigControlId === target.id
    );
    if (rigControl === undefined) {
      return "Missing Deformer";
    }

    const kindLabel =
      rigControl.kind === "warpLattice2d" ? "Warp Deformer" : "Rotation Deformer";
    return `${kindLabel}: ${rigControl.displayName}`;
  }

  if (target.kind === "drawable" || target.kind === "opacity" || target.kind === "visibility") {
    const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === target.id);
    return drawable === undefined ? "Missing Drawable" : `Drawable: ${drawable.displayName}`;
  }

  if (target.kind === "mesh") {
    const mesh = session.graph.meshes.find((candidate) => candidate.meshId === target.id);
    const drawable =
      mesh === undefined
        ? undefined
        : session.graph.drawables.find((candidate) => candidate.drawableId === mesh.drawableId);
    return drawable === undefined ? "Mesh target" : `Mesh: ${drawable.displayName}`;
  }

  if (target.kind === "drawOrder") {
    const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === target.id);
    return drawable === undefined ? "Draw order target" : `Draw order: ${drawable.displayName}`;
  }

  return "Keyform target";
}

function formatTargetProperty(property: string): string {
  const labels: Record<string, string> = {
    angleDegrees: "angle keyforms",
    controlPointOffsets: "lattice keyforms",
    defaultOpacity: "opacity keyforms",
    opacity: "opacity keyforms",
    opacityMultiplier: "opacity multiplier keyforms",
    restAngleDegrees: "rest angle keyforms",
    runtimeVisibility: "visibility keyforms",
    vertices: "mesh vertex keyforms"
  };

  return labels[property] ?? `${property} keyforms`;
}

const PARAMETER_GROUP_LABELS: Record<ParameterGroupId, string> = {
  face: "Face",
  eyes: "Eyes",
  mouth: "Mouth",
  browCheek: "Brow/Cheek",
  body: "Body",
  secondary: "Secondary",
  custom: "Custom"
};

function sanitizeIdToken(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "custom_parameter";
}
