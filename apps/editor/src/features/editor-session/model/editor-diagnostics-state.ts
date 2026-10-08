import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DynamicsGroupId, ParameterId, RigControlId } from "@private-2d-rigging-lab/contracts";

import { listEditorParameters } from "./parameter-keyform-state";

export type EditorDiagnosticSeverity = "warning";
export type EditorDiagnosticCategory = "mesh" | "references" | "dynamics";
export type EditorDiagnosticCode =
  | "mesh.drawableMeshMissing"
  | "references.keyformParameterMissing"
  | "references.keyformTargetDrawableMissing"
  | "references.keyformTargetDeformerMissing"
  | "references.deformerParentMissing"
  | "references.deformerChildMissing"
  | "references.deformerParentCycle"
  | "dynamics.inputParameterMissing"
  | "dynamics.outputParameterMissing"
  | "dynamics.outputOwnershipDuplicate"
  | "dynamics.outputKeyformMissing";
export type EditorDiagnosticTargetKind =
  | "drawable"
  | "deformer"
  | "parameter"
  | "keyformSet"
  | "dynamicsGroup";
export type EditorDiagnosticActionHintKind =
  | "openMeshTool"
  | "openRigTool"
  | "openParameters"
  | "openDynamicsTool";

export interface EditorDiagnosticTarget {
  readonly kind: EditorDiagnosticTargetKind;
  readonly id: string;
  readonly label?: string;
}

export interface EditorDiagnosticActionHint {
  readonly kind: EditorDiagnosticActionHintKind;
  readonly target: EditorDiagnosticTarget;
}

export type EditorDiagnosticDetails = Readonly<Record<string, string | readonly string[]>>;

export interface EditorDiagnosticItem {
  readonly id: string;
  readonly severity: EditorDiagnosticSeverity;
  readonly category: EditorDiagnosticCategory;
  readonly code: EditorDiagnosticCode;
  readonly title: string;
  readonly message: string;
  readonly target: EditorDiagnosticTarget;
  readonly details?: EditorDiagnosticDetails;
  readonly actionHints?: readonly EditorDiagnosticActionHint[];
}

export interface EditorDiagnosticsProjection {
  readonly items: readonly EditorDiagnosticItem[];
  readonly warningItemCount: number;
}

type KeyformSetDto = AuthoringSession["graph"]["keyformSets"][number];
type MeshDto = AuthoringSession["graph"]["meshes"][number];
type RigControlDto = AuthoringSession["graph"]["rigControls"][number];
type DynamicsGroupDto = AuthoringSession["graph"]["dynamicsGroups"][number];

export const createEditorDiagnosticsProjection = (
  session: AuthoringSession
): EditorDiagnosticsProjection => {
  const items = [
    ...createMeshDiagnostics(session),
    ...createKeyformReferenceDiagnostics(session),
    ...createDeformerReferenceDiagnostics(session),
    ...createDynamicsDiagnostics(session)
  ].sort(compareEditorDiagnosticItems);

  return {
    items,
    warningItemCount: countWarningItems(items)
  };
};

export const countEditorDiagnosticWarnings = (session: AuthoringSession): number =>
  createEditorDiagnosticsProjection(session).warningItemCount;

const createMeshDiagnostics = (session: AuthoringSession): readonly EditorDiagnosticItem[] => {
  const meshesById = new Map(session.graph.meshes.map((mesh) => [mesh.meshId, mesh]));
  const rigUseByDrawableId = createRigUseByDrawableId(session);
  const keyformUseByDrawableId = createDrawableKeyformUseByDrawableId(session);
  const items: EditorDiagnosticItem[] = [];

  for (const drawable of session.graph.drawables) {
    if (isGeneratedDrawableMesh(meshesById.get(drawable.meshId), drawable.drawableId)) {
      continue;
    }

    const boundByRigControlIds = rigUseByDrawableId.get(drawable.drawableId) ?? [];
    const keyformSetIds = keyformUseByDrawableId.get(drawable.drawableId) ?? [];
    if (boundByRigControlIds.length === 0 && keyformSetIds.length === 0) {
      continue;
    }

    items.push({
      id: diagnosticId("mesh.drawableMeshMissing", drawable.drawableId),
      severity: "warning",
      category: "mesh",
      code: "mesh.drawableMeshMissing",
      title: "Drawable mesh is missing",
      message:
        "This Drawable is used by a Deformer or keyform target, but its mesh is missing.",
      target: {
        kind: "drawable",
        id: drawable.drawableId,
        label: drawable.displayName
      },
      details: {
        drawableId: drawable.drawableId,
        meshId: drawable.meshId,
        ...(boundByRigControlIds.length === 0
          ? {}
          : { boundByRigControlIds: sortedStrings(boundByRigControlIds) }),
        ...(keyformSetIds.length === 0 ? {} : { keyformSetIds: sortedStrings(keyformSetIds) })
      },
      actionHints: [
        {
          kind: "openMeshTool",
          target: {
            kind: "drawable",
            id: drawable.drawableId,
            label: drawable.displayName
          }
        }
      ]
    });
  }

  return items;
};

const isGeneratedDrawableMesh = (
  mesh: MeshDto | undefined,
  drawableId: string
): boolean =>
  mesh !== undefined &&
  mesh.drawableId === drawableId &&
  mesh.vertices.length > 0 &&
  mesh.triangles.length > 0;

const createKeyformReferenceDiagnostics = (
  session: AuthoringSession
): readonly EditorDiagnosticItem[] => {
  const parameterIds = new Set(listEditorParameters(session).map((parameter) => parameter.parameterId));
  const drawableLabels = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable.displayName])
  );
  const rigLabels = new Map(
    session.graph.rigControls.map((rigControl) => [
      rigControl.rigControlId,
      rigControl.displayName
    ])
  );
  const items: EditorDiagnosticItem[] = [];

  for (const keyformSet of session.graph.keyformSets) {
    for (const parameterRef of getKeyformParameterRefs(keyformSet)) {
      if (parameterIds.has(parameterRef.parameterId)) {
        continue;
      }

      items.push({
        id: diagnosticId(
          "references.keyformParameterMissing",
          keyformSet.keyformSetId,
          parameterRef.path
        ),
        severity: "warning",
        category: "references",
        code: "references.keyformParameterMissing",
        title: "Keyform parameter is missing",
        message: `Keyform set ${keyformSet.keyformSetId} references missing parameter ${parameterRef.parameterId}.`,
        target: {
          kind: "keyformSet",
          id: keyformSet.keyformSetId
        },
        details: {
          keyformSetId: keyformSet.keyformSetId,
          parameterId: parameterRef.parameterId,
          path: parameterRef.path
        },
        actionHints: [
          {
            kind: "openParameters",
            target: {
              kind: "parameter",
              id: parameterRef.parameterId
            }
          }
        ]
      });
    }

    if (isDrawableKeyformTarget(keyformSet.target) && !drawableLabels.has(keyformSet.target.id)) {
      items.push({
        id: diagnosticId(
          "references.keyformTargetDrawableMissing",
          keyformSet.keyformSetId,
          keyformSet.target.id
        ),
        severity: "warning",
        category: "references",
        code: "references.keyformTargetDrawableMissing",
        title: "Keyform target Drawable is missing",
        message: `Keyform set ${keyformSet.keyformSetId} references missing Drawable ${keyformSet.target.id}.`,
        target: {
          kind: "keyformSet",
          id: keyformSet.keyformSetId
        },
        details: {
          keyformSetId: keyformSet.keyformSetId,
          targetKind: keyformSet.target.kind,
          targetId: keyformSet.target.id,
          targetProperty: keyformSet.target.property
        }
      });
      continue;
    }

    if (keyformSet.target.kind === "rigControl" && !rigLabels.has(keyformSet.target.id)) {
      items.push({
        id: diagnosticId(
          "references.keyformTargetDeformerMissing",
          keyformSet.keyformSetId,
          keyformSet.target.id
        ),
        severity: "warning",
        category: "references",
        code: "references.keyformTargetDeformerMissing",
        title: "Keyform target Deformer is missing",
        message: `Keyform set ${keyformSet.keyformSetId} references missing Deformer ${keyformSet.target.id}.`,
        target: {
          kind: "keyformSet",
          id: keyformSet.keyformSetId
        },
        details: {
          keyformSetId: keyformSet.keyformSetId,
          targetKind: keyformSet.target.kind,
          targetId: keyformSet.target.id,
          targetProperty: keyformSet.target.property
        },
        actionHints: [
          {
            kind: "openRigTool",
            target: {
              kind: "deformer",
              id: keyformSet.target.id
            }
          }
        ]
      });
    }
  }

  return items;
};

const createDeformerReferenceDiagnostics = (
  session: AuthoringSession
): readonly EditorDiagnosticItem[] => {
  const rigControlsById = new Map(
    session.graph.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );
  const drawableLabels = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable.displayName])
  );
  const items: EditorDiagnosticItem[] = [];

  for (const rigControl of session.graph.rigControls) {
    if (rigControl.parentId !== undefined && !rigControlsById.has(rigControl.parentId)) {
      items.push({
        id: diagnosticId("references.deformerParentMissing", rigControl.rigControlId),
        severity: "warning",
        category: "references",
        code: "references.deformerParentMissing",
        title: "Deformer parent is missing",
        message: `Deformer ${rigControl.displayName} references missing parent ${rigControl.parentId}.`,
        target: createDeformerTarget(rigControl),
        details: {
          rigControlId: rigControl.rigControlId,
          parentRigControlId: rigControl.parentId
        },
        actionHints: [
          {
            kind: "openRigTool",
            target: createDeformerTarget(rigControl)
          }
        ]
      });
    }

    for (const childDrawableId of rigControl.childDrawableIds) {
      if (drawableLabels.has(childDrawableId)) {
        continue;
      }

      items.push(
        createMissingDeformerChildDiagnostic(
          rigControl,
          "drawable",
          childDrawableId,
          "Drawable"
        )
      );
    }

    for (const childRigControlId of rigControl.childRigControlIds) {
      if (rigControlsById.has(childRigControlId)) {
        continue;
      }

      items.push(
        createMissingDeformerChildDiagnostic(
          rigControl,
          "deformer",
          childRigControlId,
          "Deformer"
        )
      );
    }
  }

  return [...items, ...createDeformerParentCycleDiagnostics(session)];
};

const createDynamicsDiagnostics = (session: AuthoringSession): readonly EditorDiagnosticItem[] => {
  const parameterIds = new Set(listEditorParameters(session).map((parameter) => parameter.parameterId));
  const keyformParameterIds = createKeyformParameterIdSet(session);
  const outputOwnersByParameterId = createDynamicsOutputOwnersByParameterId(session);
  const items: EditorDiagnosticItem[] = [];

  for (const group of session.graph.dynamicsGroups) {
    group.inputs.forEach((input, index) => {
      if (parameterIds.has(input.parameterId)) {
        return;
      }

      items.push({
        id: diagnosticId(
          "dynamics.inputParameterMissing",
          group.dynamicsGroupId,
          String(index),
          input.parameterId
        ),
        severity: "warning",
        category: "dynamics",
        code: "dynamics.inputParameterMissing",
        title: "Dynamics input parameter is missing",
        message: `Dynamics group ${group.displayName} references missing input parameter ${input.parameterId}.`,
        target: createDynamicsGroupTarget(group),
        details: {
          dynamicsGroupId: group.dynamicsGroupId,
          parameterId: input.parameterId,
          path: `/inputs/${index}/parameterId`
        },
        actionHints: [
          {
            kind: "openDynamicsTool",
            target: createDynamicsGroupTarget(group)
          }
        ]
      });
    });

    group.outputs.forEach((output, index) => {
      if (!parameterIds.has(output.parameterId)) {
        items.push({
          id: diagnosticId(
            "dynamics.outputParameterMissing",
            group.dynamicsGroupId,
            String(index),
            output.parameterId
          ),
          severity: "warning",
          category: "dynamics",
          code: "dynamics.outputParameterMissing",
          title: "Dynamics output parameter is missing",
          message: `Dynamics group ${group.displayName} references missing output parameter ${output.parameterId}.`,
          target: createDynamicsGroupTarget(group),
          details: {
            dynamicsGroupId: group.dynamicsGroupId,
            parameterId: output.parameterId,
            path: `/outputs/${index}/parameterId`
          },
          actionHints: [
            {
              kind: "openDynamicsTool",
              target: createDynamicsGroupTarget(group)
            }
          ]
        });
        return;
      }

      if (!keyformParameterIds.has(output.parameterId)) {
        items.push({
          id: diagnosticId(
            "dynamics.outputKeyformMissing",
            group.dynamicsGroupId,
            output.parameterId
          ),
          severity: "warning",
          category: "dynamics",
          code: "dynamics.outputKeyformMissing",
          title: "Dynamics output keyform is missing",
          message:
            "This Dynamics output parameter has no keyform set, so computed values may not reach authored drawing changes.",
          target: createDynamicsGroupTarget(group),
          details: {
            dynamicsGroupId: group.dynamicsGroupId,
            outputParameterId: output.parameterId
          },
          actionHints: [
            {
              kind: "openDynamicsTool",
              target: createDynamicsGroupTarget(group)
            }
          ]
        });
      }
    });
  }

  for (const [parameterId, owners] of outputOwnersByParameterId) {
    if (owners.length < 2) {
      continue;
    }

    const sortedOwners = [...owners].sort((left, right) =>
      left.dynamicsGroupId.localeCompare(right.dynamicsGroupId)
    );
    items.push({
      id: diagnosticId("dynamics.outputOwnershipDuplicate", parameterId),
      severity: "warning",
      category: "dynamics",
      code: "dynamics.outputOwnershipDuplicate",
      title: "Dynamics output is owned by multiple groups",
      message: `Multiple Dynamics groups write to output parameter ${parameterId}.`,
      target: {
        kind: "parameter",
        id: parameterId
      },
      details: {
        outputParameterId: parameterId,
        dynamicsGroupIds: sortedOwners.map((owner) => owner.dynamicsGroupId),
        dynamicsGroupNames: sortedOwners.map((owner) => owner.displayName)
      },
      actionHints: sortedOwners.map((owner) => ({
        kind: "openDynamicsTool",
        target: createDynamicsGroupTarget(owner)
      }))
    });
  }

  return items;
};

const createRigUseByDrawableId = (
  session: AuthoringSession
): ReadonlyMap<string, readonly string[]> => {
  const result = new Map<string, string[]>();
  for (const rigControl of session.graph.rigControls) {
    for (const drawableId of rigControl.childDrawableIds) {
      appendMapValue(result, drawableId, rigControl.rigControlId);
    }
  }

  return result;
};

const createDrawableKeyformUseByDrawableId = (
  session: AuthoringSession
): ReadonlyMap<string, readonly string[]> => {
  const result = new Map<string, string[]>();
  for (const keyformSet of session.graph.keyformSets) {
    if (isDrawableKeyformTarget(keyformSet.target)) {
      appendMapValue(result, keyformSet.target.id, keyformSet.keyformSetId);
    }
  }

  return result;
};

const createKeyformParameterIdSet = (session: AuthoringSession): ReadonlySet<string> => {
  const result = new Set<string>();
  for (const keyformSet of session.graph.keyformSets) {
    for (const parameterRef of getKeyformParameterRefs(keyformSet)) {
      result.add(parameterRef.parameterId);
    }
  }

  return result;
};

const createDynamicsOutputOwnersByParameterId = (
  session: AuthoringSession
): ReadonlyMap<ParameterId, readonly DynamicsGroupDto[]> => {
  const result = new Map<ParameterId, DynamicsGroupDto[]>();
  for (const group of session.graph.dynamicsGroups) {
    for (const output of group.outputs) {
      appendMapValue(result, output.parameterId, group);
    }
  }

  return result;
};

const createDeformerParentCycleDiagnostics = (
  session: AuthoringSession
): readonly EditorDiagnosticItem[] => {
  const rigControlsById = new Map(
    session.graph.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );
  const emittedCycleKeys = new Set<string>();
  const items: EditorDiagnosticItem[] = [];
  const sortedRigControlIds = sortedStrings(session.graph.rigControls.map((rigControl) => rigControl.rigControlId));

  for (const rigControlId of sortedRigControlIds) {
    const localPath: RigControlId[] = [];
    const localIndexById = new Map<RigControlId, number>();
    let currentId: RigControlId | undefined = rigControlId as RigControlId;

    while (currentId !== undefined) {
      const existingIndex = localIndexById.get(currentId);
      if (existingIndex !== undefined) {
        const cycleIds = canonicalCycleIds(localPath.slice(existingIndex));
        const cycleKey = cycleIds.join(".");
        if (!emittedCycleKeys.has(cycleKey)) {
          emittedCycleKeys.add(cycleKey);
          const targetRigControl = rigControlsById.get(cycleIds[0] as RigControlId);
          items.push({
            id: diagnosticId("references.deformerParentCycle", cycleKey),
            severity: "warning",
            category: "references",
            code: "references.deformerParentCycle",
            title: "Deformer parent cycle detected",
            message: `Deformer parent links form a cycle: ${cycleIds.join(" -> ")}.`,
            target:
              targetRigControl === undefined
                ? {
                    kind: "deformer",
                    id: cycleIds[0] ?? cycleKey
                  }
                : createDeformerTarget(targetRigControl),
            details: {
              rigControlIds: cycleIds
            },
            actionHints:
              targetRigControl === undefined
                ? undefined
                : [
                    {
                      kind: "openRigTool",
                      target: createDeformerTarget(targetRigControl)
                    }
                  ]
          });
        }
        break;
      }

      const rigControl = rigControlsById.get(currentId);
      if (rigControl === undefined) {
        break;
      }

      localIndexById.set(currentId, localPath.length);
      localPath.push(currentId);
      currentId = rigControl.parentId;
    }
  }

  return items;
};

const createMissingDeformerChildDiagnostic = (
  rigControl: RigControlDto,
  targetKind: "drawable" | "deformer",
  childId: string,
  childLabel: "Drawable" | "Deformer"
): EditorDiagnosticItem => ({
  id: diagnosticId("references.deformerChildMissing", rigControl.rigControlId, targetKind, childId),
  severity: "warning",
  category: "references",
  code: "references.deformerChildMissing",
  title: "Deformer child is missing",
  message: `Deformer ${rigControl.displayName} references missing child ${childLabel} ${childId}.`,
  target: createDeformerTarget(rigControl),
  details: {
    rigControlId: rigControl.rigControlId,
    childKind: targetKind,
    childId
  },
  actionHints: [
    {
      kind: "openRigTool",
      target: createDeformerTarget(rigControl)
    }
  ]
});

const getKeyformParameterRefs = (
  keyformSet: KeyformSetDto
): readonly {
  readonly parameterId: ParameterId;
  readonly path: string;
}[] => {
  if (keyformSet.evaluator === "linear-1d-v1") {
    return [
      {
        parameterId: keyformSet.parameterId,
        path: "/parameterId"
      }
    ];
  }

  return [
    {
      parameterId: keyformSet.parameterX,
      path: "/parameterX"
    },
    {
      parameterId: keyformSet.parameterY,
      path: "/parameterY"
    }
  ];
};

const createDeformerTarget = (rigControl: RigControlDto): EditorDiagnosticTarget => ({
  kind: "deformer",
  id: rigControl.rigControlId,
  label: rigControl.displayName
});

const createDynamicsGroupTarget = (group: DynamicsGroupDto): EditorDiagnosticTarget => ({
  kind: "dynamicsGroup",
  id: group.dynamicsGroupId,
  label: group.displayName
});

const isDrawableKeyformTarget = (target: KeyformSetDto["target"]): boolean =>
  target.kind === "drawable" ||
  target.kind === "opacity" ||
  target.kind === "visibility" ||
  target.kind === "drawOrder";

const canonicalCycleIds = (cycleIds: readonly RigControlId[]): readonly string[] => {
  const stringIds = cycleIds.map((id) => String(id));
  if (stringIds.length <= 1) {
    return stringIds;
  }

  const minId = [...stringIds].sort((left, right) => left.localeCompare(right))[0];
  const minIndex = minId === undefined ? 0 : stringIds.indexOf(minId);
  return [...stringIds.slice(minIndex), ...stringIds.slice(0, minIndex)];
};

const appendMapValue = <TKey extends string, TValue>(
  map: Map<TKey, TValue[]>,
  key: TKey,
  value: TValue
): void => {
  const values = map.get(key);
  if (values === undefined) {
    map.set(key, [value]);
    return;
  }

  values.push(value);
};

const countWarningItems = (items: readonly EditorDiagnosticItem[]): number =>
  items.filter((item) => item.severity === "warning").length;

const compareEditorDiagnosticItems = (
  left: EditorDiagnosticItem,
  right: EditorDiagnosticItem
): number =>
  categorySortOrder[left.category] - categorySortOrder[right.category] ||
  left.code.localeCompare(right.code) ||
  left.id.localeCompare(right.id);

const sortedStrings = (values: readonly string[]): readonly string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

const diagnosticId = (code: EditorDiagnosticCode, ...segments: readonly string[]): string =>
  ["editorDiagnostics", code, ...segments.map(sanitizeIdSegment)].join(".");

const sanitizeIdSegment = (segment: string): string => segment.replace(/[^A-Za-z0-9_-]/g, "_");

const categorySortOrder = {
  mesh: 0,
  references: 1,
  dynamics: 2
} satisfies Record<EditorDiagnosticCategory, number>;
