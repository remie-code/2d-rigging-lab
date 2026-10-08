import type { DynamicsGroupId, ParameterId } from "@private-2d-rigging-lab/contracts";
import {
  createDynamicsGroupIdFromDisplayName,
  type DynamicsChainPayloadDto,
  type DynamicsInputPayloadDto,
  type DynamicsOutputPayloadDto,
  type UpdateDynamicsGroupPayloadDto
} from "@private-2d-rigging-lab/operation-core";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Waves
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createDefaultDynamicsOutput,
  createDefaultDynamicsInput,
  createDynamicsGroupCreatePayloadFromDraft,
  createDynamicsGroupDraftFromGroup,
  createDynamicsGroupDraftFromSession,
  createDynamicsToolGroupDiagnosticSummaries,
  createDynamicsGroupUpdatePayloadFromDraft,
  DYNAMICS_TOOL_PREVIEW_STEP_MS,
  DYNAMICS_TOOL_PRESETS,
  getDynamicsToolPreset,
  hasBlockingDynamicsToolIssues,
  removeInputFromDynamicsDraft,
  updateDynamicsDraftChain,
  updateDynamicsDraftInput,
  updateDynamicsDraftOutput,
  validateDynamicsToolDraft,
  type DynamicsAxisKind,
  type DynamicsToolDraft,
  type DynamicsToolGroupDiagnosticSummary,
  type DynamicsToolGroup,
  type DynamicsToolPresetId,
  type DynamicsToolValidationIssue
} from "../../features/editor-session/model/dynamics-tool-state";
import {
  formatParameterValue,
  listEditorParameters,
  type EditorParameter
} from "../../features/editor-session/model/parameter-keyform-state";
import { cn } from "../../lib/class-name";
import { Tooltip } from "../../ui/tooltip";
import { useRafCoalescedNumberCommit } from "../controls/raf-coalesced-number";

const AXIS_KIND_OPTIONS: readonly DynamicsAxisKind[] = ["angle", "positionX", "positionY"];

type DynamicsInspectorMode =
  | { readonly kind: "list" }
  | { readonly kind: "group"; readonly groupId: DynamicsGroupId }
  | { readonly kind: "create" }
  | { readonly kind: "edit"; readonly groupId: DynamicsGroupId };

export function DynamicsToolInspector() {
  const {
    advanceDynamicsToolPreviewSimulation,
    clearDynamicsToolPreviewDefinitionOverride,
    createDynamicsGroup,
    deleteDynamicsGroup,
    dynamicsToolPreview,
    resetDynamicsToolPreviewSimulation,
    session,
    setDynamicsToolPreviewDefinitionOverride,
    setDynamicsToolPreviewDriverValue,
    setDynamicsToolPreviewGroupId,
    updateDynamicsGroup
  } = useEditorSession();
  const parameters = useMemo(() => listEditorParameters(session), [session]);
  const groupDiagnosticSummaries = useMemo(
    () => createDynamicsToolGroupDiagnosticSummaries(session),
    [session]
  );
  const [mode, setMode] = useState<DynamicsInspectorMode>({ kind: "list" });
  const [draft, setDraft] = useState<DynamicsToolDraft>(() =>
    createDynamicsGroupDraftFromSession(session)
  );
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const activeGroup = useMemo(
    () =>
      mode.kind === "group" || mode.kind === "edit"
        ? session.graph.dynamicsGroups.find((group) => group.dynamicsGroupId === mode.groupId)
        : undefined,
    [mode, session.graph.dynamicsGroups]
  );

  useEffect(() => {
    if ((mode.kind === "group" || mode.kind === "edit") && activeGroup === undefined) {
      setMode({ kind: "list" });
      setDynamicsToolPreviewGroupId(null);
    }
  }, [activeGroup, mode, setDynamicsToolPreviewGroupId]);

  useEffect(() => {
    if (mode.kind === "create") {
      setDraft(createDynamicsGroupDraftFromSession(session, draft.presetId));
      setOperationMessage(null);
      return;
    }

    if (mode.kind === "edit" && activeGroup !== undefined) {
      setDraft(createDynamicsGroupDraftFromGroup(activeGroup));
      setOperationMessage(null);
    }
  }, [activeGroup, mode, session]);

  const validationIssues = useMemo(
    () =>
      mode.kind === "create" || mode.kind === "edit"
        ? validateDynamicsToolDraft(
            session,
            draft,
            mode.kind === "edit" ? mode.groupId : undefined
          )
        : [],
    [draft, mode, session]
  );
  const hasBlockingIssues = hasBlockingDynamicsToolIssues(validationIssues);

  const openGroup = (groupId: DynamicsGroupId) => {
    setMode({ kind: "group", groupId });
    setDynamicsToolPreviewGroupId(groupId);
    setOperationMessage(null);
  };

  const openCreate = () => {
    setDraft(createDynamicsGroupDraftFromSession(session, draft.presetId));
    setMode({ kind: "create" });
    setDynamicsToolPreviewGroupId(null);
    setOperationMessage(null);
  };

  const openEdit = (group: DynamicsToolGroup) => {
    setDraft(createDynamicsGroupDraftFromGroup(group));
    setMode({ kind: "edit", groupId: group.dynamicsGroupId });
    setOperationMessage(null);
  };

  const returnToList = () => {
    setMode({ kind: "list" });
    setDynamicsToolPreviewGroupId(null);
    setOperationMessage(null);
  };

  const returnToGroup = (groupId: DynamicsGroupId) => {
    setMode({ kind: "group", groupId });
    setDynamicsToolPreviewGroupId(groupId);
    setOperationMessage(null);
  };

  const applyPreset = (presetId: DynamicsToolPresetId) => {
    const preset = getDynamicsToolPreset(presetId);
    const currentOutput = draft.outputs[0];
    const outputParameter =
      currentOutput === undefined
        ? parameters[1] ?? parameters[0]
        : parameters.find((parameter) => parameter.parameterId === currentOutput.parameterId);

    setDraft({
      ...draft,
      presetId,
      chain: structuredClone(preset.chain),
      outputs:
        outputParameter === undefined
          ? draft.outputs
          : [createDefaultDynamicsOutput(outputParameter)]
    });
  };

  const createGroup = () => {
    if (hasBlockingIssues) {
      return;
    }

    const dynamicsGroupId = createUniqueDynamicsGroupId(
      session.graph.dynamicsGroups,
      draft.displayName
    );
    const result = createDynamicsGroup(
      createDynamicsGroupCreatePayloadFromDraft(draft, dynamicsGroupId)
    );
    if (result.committed) {
      setOperationMessage("Dynamics Group created.");
      setMode({ kind: "group", groupId: dynamicsGroupId });
      setDynamicsToolPreviewGroupId(dynamicsGroupId);
      return;
    }

    setOperationMessage(formatOperationDiagnostics(result.diagnostics));
  };

  const updateGroup = () => {
    if (mode.kind !== "edit" || activeGroup === undefined || hasBlockingIssues) {
      return;
    }

    const result = updateDynamicsGroup(
      createDynamicsGroupUpdatePayloadFromDraft(draft, activeGroup.dynamicsGroupId)
    );
    if (result.committed) {
      setOperationMessage("Dynamics Group updated.");
      setMode({ kind: "group", groupId: activeGroup.dynamicsGroupId });
      setDynamicsToolPreviewGroupId(activeGroup.dynamicsGroupId);
      return;
    }

    setOperationMessage(formatOperationDiagnostics(result.diagnostics));
  };

  const deleteGroup = (group: DynamicsToolGroup) => {
    const result = deleteDynamicsGroup({ dynamicsGroupId: group.dynamicsGroupId });
    if (result.committed) {
      setDynamicsToolPreviewGroupId(null);
      setMode({ kind: "list" });
      setOperationMessage(null);
      return;
    }

    setOperationMessage(formatOperationDiagnostics(result.diagnostics));
  };

  const commitQuickTune = (payload: UpdateDynamicsGroupPayloadDto): boolean => {
    const result = updateDynamicsGroup(payload);
    if (result.committed) {
      setOperationMessage("Dynamics Group tuned.");
      return true;
    }

    if (result.diagnostics.length > 0) {
      setOperationMessage(formatOperationDiagnostics(result.diagnostics));
    }
    return false;
  };

  const updateInput = (index: number, patch: Partial<DynamicsInputPayloadDto>) => {
    setDraft((current) => updateDynamicsDraftInput(session, current, index, patch));
  };

  const updateOutput = (patch: Partial<DynamicsOutputPayloadDto>) => {
    setDraft((current) => updateDynamicsDraftOutput(session, current, patch));
  };

  const updateChain = (patch: Partial<DynamicsChainPayloadDto>) => {
    setDraft((current) => updateDynamicsDraftChain(current, patch));
  };

  return (
    <>
      <DynamicsToolHeader />

      {mode.kind === "list" ? (
        <GroupList
          diagnosticSummaries={groupDiagnosticSummaries}
          groups={session.graph.dynamicsGroups}
          onNewGroup={openCreate}
          onOpenGroup={openGroup}
        />
      ) : null}

      {mode.kind === "group" && activeGroup !== undefined ? (
        <ExistingGroupInspector
          dynamicsToolPreview={dynamicsToolPreview}
          group={activeGroup}
          groupDiagnosticSummary={groupDiagnosticSummaries.get(activeGroup.dynamicsGroupId)}
          onAdvancePreview={advanceDynamicsToolPreviewSimulation}
          onBack={returnToList}
          onClearQuickTunePreview={clearDynamicsToolPreviewDefinitionOverride}
          onDelete={() => deleteGroup(activeGroup)}
          onEdit={() => openEdit(activeGroup)}
          onPreviewDriverChange={setDynamicsToolPreviewDriverValue}
          onQuickTuneCommit={commitQuickTune}
          onQuickTunePreviewChange={setDynamicsToolPreviewDefinitionOverride}
          onResetPreview={() => resetDynamicsToolPreviewSimulation(activeGroup.dynamicsGroupId)}
          operationMessage={operationMessage}
          parameters={parameters}
        />
      ) : null}

      {mode.kind === "create" ? (
        <DraftInspector
          actionLabel="Create"
          actionTestId="dynamics-create-group"
          draft={draft}
          hasBlockingIssues={hasBlockingIssues}
          mode="create"
          onAction={createGroup}
          onBack={returnToList}
          onCancel={returnToList}
          onInputChange={updateInput}
          onOutputChange={updateOutput}
          onChainChange={updateChain}
          onPresetChange={applyPreset}
          onSetDraft={setDraft}
          operationMessage={operationMessage}
          parameters={parameters}
          validationIssues={validationIssues}
        />
      ) : null}

      {mode.kind === "edit" && activeGroup !== undefined ? (
        <DraftInspector
          actionLabel="Apply"
          actionTestId="dynamics-apply-group"
          draft={draft}
          hasBlockingIssues={hasBlockingIssues}
          mode="edit"
          onAction={updateGroup}
          onBack={() => returnToGroup(activeGroup.dynamicsGroupId)}
          onCancel={() => returnToGroup(activeGroup.dynamicsGroupId)}
          onInputChange={updateInput}
          onOutputChange={updateOutput}
          onChainChange={updateChain}
          onPresetChange={applyPreset}
          onSetDraft={setDraft}
          operationMessage={operationMessage}
          parameters={parameters}
          validationIssues={validationIssues}
        />
      ) : null}
    </>
  );
}

function DynamicsToolHeader() {
  return (
    <div
      className="rounded-md border border-neutral-800 bg-neutral-950/50 p-3"
      data-testid="dynamics-tool-inspector"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
        <Waves aria-hidden="true" size={16} strokeWidth={1.8} />
        <span>Dynamics Tool</span>
      </div>
    </div>
  );
}

function GroupList({
  diagnosticSummaries,
  groups,
  onNewGroup,
  onOpenGroup
}: {
  readonly diagnosticSummaries: ReadonlyMap<DynamicsGroupId, DynamicsToolGroupDiagnosticSummary>;
  readonly groups: readonly DynamicsToolGroup[];
  readonly onNewGroup: () => void;
  readonly onOpenGroup: (groupId: DynamicsGroupId) => void;
}) {
  return (
    <Section title="Groups">
      <div className="flex flex-col gap-2" data-testid="dynamics-group-list">
        {groups.length === 0 ? (
          <div
            className="rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-neutral-500"
            data-testid="dynamics-empty-groups"
          >
            No Dynamics Groups.
          </div>
        ) : null}
        {groups.map((group) => {
          const summary = diagnosticSummaries.get(group.dynamicsGroupId);
          return (
            <button
              className="flex min-h-8 items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-left text-xs font-medium text-neutral-300 transition hover:border-teal-700"
              data-dynamics-group-id={group.dynamicsGroupId}
              data-testid="dynamics-group-row"
              key={group.dynamicsGroupId}
              onClick={() => onOpenGroup(group.dynamicsGroupId)}
              type="button"
            >
              <span className="min-w-0 truncate">{group.displayName}</span>
              <span className="ml-2 flex shrink-0 items-center gap-1">
                {summary === undefined ? null : (
                  <span
                    aria-label={formatDynamicsGroupWarningLabel(summary)}
                    className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-amber-700/70 bg-amber-950/45 px-1 text-[10px] font-semibold text-amber-100"
                    data-testid="dynamics-group-warning-icon"
                    data-warning-count={summary.issues.length}
                    title={formatDynamicsGroupWarningLabel(summary)}
                  >
                    <AlertTriangle aria-hidden="true" size={11} strokeWidth={1.9} />
                    <span className="ml-0.5">{summary.issues.length}</span>
                  </span>
                )}
                <span className="text-[10px] uppercase text-neutral-500">
                  {group.enabled ? "On" : "Off"}
                </span>
              </span>
            </button>
          );
        })}
        <button
          className="flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100"
          data-testid="dynamics-new-draft"
          onClick={onNewGroup}
          type="button"
        >
          <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
          New Group
        </button>
      </div>
    </Section>
  );
}

function ExistingGroupInspector({
  dynamicsToolPreview,
  group,
  groupDiagnosticSummary,
  onAdvancePreview,
  onBack,
  onClearQuickTunePreview,
  onDelete,
  onEdit,
  onPreviewDriverChange,
  onQuickTuneCommit,
  onQuickTunePreviewChange,
  onResetPreview,
  operationMessage,
  parameters
}: {
  readonly dynamicsToolPreview: ReturnType<typeof useEditorSession>["dynamicsToolPreview"];
  readonly group: DynamicsToolGroup;
  readonly groupDiagnosticSummary?: DynamicsToolGroupDiagnosticSummary | undefined;
  readonly onAdvancePreview: (
    dynamicsGroupId: DynamicsGroupId,
    dtMs: number
  ) => void;
  readonly onBack: () => void;
  readonly onClearQuickTunePreview: (dynamicsGroupId: DynamicsGroupId) => void;
  readonly onDelete: () => void;
  readonly onEdit: () => void;
  readonly onPreviewDriverChange: (
    dynamicsGroupId: DynamicsGroupId,
    parameterId: ParameterId,
    value: number
  ) => void;
  readonly onQuickTuneCommit: (payload: UpdateDynamicsGroupPayloadDto) => boolean;
  readonly onQuickTunePreviewChange: (
    dynamicsGroupId: DynamicsGroupId,
    definition: DynamicsToolGroup
  ) => void;
  readonly onResetPreview: () => void;
  readonly operationMessage: string | null;
  readonly parameters: readonly EditorParameter[];
}) {
  const previewDriverValues = dynamicsToolPreview.driverValuesByGroupId[group.dynamicsGroupId] ?? {};
  const committedQuickTuneSignature = useMemo(
    () => createQuickTuneSignature(createQuickTuneDraftFromGroup(group)),
    [group]
  );
  const [quickTuneDraft, setQuickTuneDraft] = useState<QuickTuneDraft>(() =>
    createQuickTuneDraftFromGroup(group)
  );
  const finalizedQuickTuneSignatureRef = useRef<string | null>(null);
  const quickTunePreviewDefinition = useMemo(
    () => applyQuickTuneDraftToGroup(group, quickTuneDraft),
    [group, quickTuneDraft]
  );

  useDynamicsPreviewAnimationLoop({
    enabled: dynamicsToolPreview.selectedGroupId === group.dynamicsGroupId,
    groupId: group.dynamicsGroupId,
    onAdvance: onAdvancePreview
  });

  useEffect(() => {
    finalizedQuickTuneSignatureRef.current = null;
    setQuickTuneDraft(createQuickTuneDraftFromGroup(group));
  }, [committedQuickTuneSignature, group]);

  useEffect(
    () => () => {
      onClearQuickTunePreview(group.dynamicsGroupId);
    },
    [group.dynamicsGroupId, onClearQuickTunePreview]
  );

  useEffect(() => {
    if (sameQuickTuneDraftAsGroup(group, quickTuneDraft)) {
      onClearQuickTunePreview(group.dynamicsGroupId);
      return;
    }

    onQuickTunePreviewChange(group.dynamicsGroupId, quickTunePreviewDefinition);
  }, [
    group,
    onClearQuickTunePreview,
    onQuickTunePreviewChange,
    quickTuneDraft,
    quickTunePreviewDefinition
  ]);

  const updateQuickTuneDraft = (field: QuickTuneField, rawValue: number) => {
    setQuickTuneDraft((current) => updateQuickTuneDraftValue(current, field, rawValue));
  };

  const finalizeQuickTuneDraft = (field: QuickTuneField, rawValue: number) => {
    const nextDraft = updateQuickTuneDraftValue(quickTuneDraft, field, rawValue);
    const nextSignature = createQuickTuneSignature(nextDraft);
    setQuickTuneDraft(nextDraft);
    if (sameQuickTuneDraftAsGroup(group, nextDraft)) {
      onClearQuickTunePreview(group.dynamicsGroupId);
      return;
    }
    if (finalizedQuickTuneSignatureRef.current === nextSignature) {
      return;
    }

    const nextGroup = applyQuickTuneDraftToGroup(group, nextDraft);
    const committed = onQuickTuneCommit({
      dynamicsGroupId: group.dynamicsGroupId,
      chain: cloneDynamicsChainForPayload(nextGroup.chain),
      outputs: nextGroup.outputs.map(cloneDynamicsOutputForPayload)
    });
    if (committed) {
      finalizedQuickTuneSignatureRef.current = nextSignature;
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="dynamics-group-inspector">
      <PanelButton label="Back to Groups" onClick={onBack} testId="dynamics-back-to-groups">
        <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.8} />
        Back to Groups
      </PanelButton>

      <Section title="Dynamics Group">
        <div className="divide-y divide-neutral-800 rounded border border-neutral-800 bg-neutral-950/60 px-2">
          <SummaryRow label="Name" value={group.displayName} />
          <SummaryRow label="Enabled" value={group.enabled ? "On" : "Off"} />
        </div>
      </Section>

      <Section title="Validation">
        <GroupDiagnosticIssues summary={groupDiagnosticSummary} />
      </Section>

      <Section title="Preview">
        <div className="flex flex-col gap-3">
          {group.inputs.map((input) => {
            const parameter = parameters.find(
              (candidate) => candidate.parameterId === input.parameterId
            );
            const value =
              previewDriverValues[input.parameterId] ??
              parameter?.default ??
              0;

            return (
              <PreviewDriverControl
                groupId={group.dynamicsGroupId}
                input={input}
                key={input.parameterId}
                onChange={onPreviewDriverChange}
                parameter={parameter}
                value={value}
              />
            );
          })}
          <PanelButton label="Reset Preview" onClick={onResetPreview} testId="dynamics-preview-reset">
            <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
            Reset Preview
          </PanelButton>
        </div>
      </Section>

      <Section title="Quick Tune">
        <div
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2"
          data-testid="dynamics-quick-tune"
        >
          {QUICK_TUNE_FIELDS.map((field) => (
            <QuickTuneControl
              field={field}
              key={field}
              onFinalize={finalizeQuickTuneDraft}
              onLiveChange={updateQuickTuneDraft}
              value={quickTuneDraft[field]}
            />
          ))}
        </div>
      </Section>

      <Section title="Actions">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <PanelButton label="Edit" onClick={onEdit} testId="dynamics-edit-group">
            <Pencil aria-hidden="true" size={14} strokeWidth={1.8} />
            Edit
          </PanelButton>
          <button
            className="flex min-h-8 items-center justify-center gap-2 rounded border border-red-900/60 bg-red-950/20 px-2 text-xs font-medium text-red-100 transition hover:border-red-700"
            data-testid="dynamics-delete-group"
            onClick={onDelete}
            type="button"
          >
            <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
            Delete Group
          </button>
        </div>
      </Section>

      {operationMessage === null ? null : (
        <OperationMessage message={operationMessage} />
      )}
    </div>
  );
}

function PreviewDriverControl({
  groupId,
  input,
  onChange,
  parameter,
  value
}: {
  readonly groupId: DynamicsGroupId;
  readonly input: DynamicsInputPayloadDto;
  readonly onChange: (
    dynamicsGroupId: DynamicsGroupId,
    parameterId: ParameterId,
    value: number
  ) => void;
  readonly parameter: EditorParameter | undefined;
  readonly value: number;
}) {
  const sliderCommit = useRafCoalescedNumberCommit({
    counterPrefix: "dynamicsPreview.slider",
    onCommit: (nextValue) => onChange(groupId, input.parameterId, nextValue)
  });

  return (
    <label
      className="flex flex-col gap-1 text-xs text-neutral-500"
      data-testid="dynamics-preview-driver"
    >
      {parameter?.displayName ?? input.parameterId}
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
        <input
          className="h-2 accent-teal-400"
          max={parameter?.max ?? 1}
          min={parameter?.min ?? -1}
          onBlur={sliderCommit.flush}
          onChange={(event) =>
            sliderCommit.schedule(readFiniteInputValue(event.currentTarget.value, value))
          }
          onPointerCancel={sliderCommit.flush}
          onPointerUp={sliderCommit.flush}
          step={parameter?.recommendedUiStep ?? 0.01}
          type="range"
          value={value}
        />
        <input
          aria-label={`${parameter?.displayName ?? input.parameterId} preview value`}
          className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500"
          max={parameter?.max ?? 1}
          min={parameter?.min ?? -1}
          onChange={(event) =>
            onChange(
              groupId,
              input.parameterId,
              readFiniteInputValue(event.currentTarget.value, value)
            )
          }
          step={parameter?.recommendedUiStep ?? 0.01}
          type="number"
          value={formatParameterValue(value)}
        />
      </div>
    </label>
  );
}

// §9 runtime-player tuning profile v2 vocabulary. outputScale / lengthScale are multipliers on the
// committed base (default 1.0); limit / damping / gravityScale are direct values. Quick Tune is a
// live delta over the committed group, so multipliers read back as 1.0 after each commit.
type QuickTuneField =
  | "outputScale"
  | "limit"
  | "damping"
  | "gravityScale"
  | "lengthScale";

const QUICK_TUNE_MULTIPLIER_FIELDS = new Set<QuickTuneField>(["outputScale", "lengthScale"]);

interface QuickTuneDraft {
  readonly outputScale: number;
  readonly limit: number;
  readonly damping: number;
  readonly gravityScale: number;
  readonly lengthScale: number;
}

const QUICK_TUNE_FIELDS: readonly QuickTuneField[] = [
  "outputScale",
  "limit",
  "damping",
  "gravityScale",
  "lengthScale"
];

function QuickTuneControl({
  field,
  onFinalize,
  onLiveChange,
  value
}: {
  readonly field: QuickTuneField;
  readonly onFinalize: (field: QuickTuneField, value: number) => void;
  readonly onLiveChange: (field: QuickTuneField, value: number) => void;
  readonly value: number;
}) {
  const label = getQuickTuneLabel(field);
  const description = getQuickTuneDescription(field);
  const bounds = getQuickTuneBounds(field, value);
  const latestValueRef = useRef(value);
  const sliderCommit = useRafCoalescedNumberCommit({
    counterPrefix: "dynamicsQuickTune.slider",
    onCommit: (nextValue) => onLiveChange(field, nextValue)
  });

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const scheduleSliderValue = (rawValue: number) => {
    const nextValue = normalizeQuickTuneValue(field, rawValue);
    latestValueRef.current = nextValue;
    sliderCommit.schedule(nextValue);
  };

  const finalize = () => {
    sliderCommit.flush();
    onFinalize(field, latestValueRef.current);
  };

  return (
    <div
      className="flex min-w-0 flex-col gap-1 text-xs text-neutral-500"
      data-testid={`dynamics-quick-tune-${field}`}
    >
      <div className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate">{label}</span>
        <Tooltip label={description} side="top">
          <button
            aria-label={`${label}の説明: ${description}`}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded text-neutral-600 outline-none transition hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-400"
            type="button"
          >
            <Info aria-hidden="true" size={12} strokeWidth={1.9} />
          </button>
        </Tooltip>
      </div>
      <input
        aria-label={`${label} quick tune`}
        className="h-2 accent-teal-400"
        max={bounds.max}
        min={bounds.min}
        onBlur={finalize}
        onChange={(event) =>
          scheduleSliderValue(readFiniteInputValue(event.currentTarget.value, value))
        }
        onPointerCancel={finalize}
        onPointerUp={finalize}
        step={bounds.step}
        type="range"
        value={value}
      />
      <input
        aria-label={`${label} quick tune value`}
        className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500"
        min={bounds.min}
        onBlur={finalize}
        onChange={(event) => {
          const nextValue = normalizeQuickTuneValue(
            field,
            readFiniteInputValue(event.currentTarget.value, value)
          );
          latestValueRef.current = nextValue;
          onLiveChange(field, nextValue);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            finalize();
          }
        }}
        step={bounds.step}
        type="number"
        value={formatParameterValue(value)}
      />
    </div>
  );
}

function createQuickTuneDraftFromGroup(group: DynamicsToolGroup): QuickTuneDraft {
  const output = group.outputs[0];

  // Multipliers read back as 1.0 over the committed base; direct values mirror the committed group.
  return {
    outputScale: 1,
    limit: output?.limit ?? 0,
    damping: group.chain.damping,
    gravityScale: group.chain.gravityScale,
    lengthScale: 1
  };
}

function updateQuickTuneDraftValue(
  draft: QuickTuneDraft,
  field: QuickTuneField,
  rawValue: number
): QuickTuneDraft {
  const value = normalizeQuickTuneValue(field, rawValue);
  return sameNumericValue(draft[field], value)
    ? draft
    : {
        ...draft,
        [field]: value
      };
}

function applyQuickTuneDraftToGroup(
  group: DynamicsToolGroup,
  draft: QuickTuneDraft
): DynamicsToolGroup {
  const output = group.outputs[0];

  return {
    dynamicsGroupId: group.dynamicsGroupId,
    displayName: group.displayName,
    enabled: group.enabled,
    ...(group.presetId === undefined ? {} : { presetId: group.presetId }),
    inputs: group.inputs.map(cloneDynamicsInputForPayload),
    chain: {
      rootOffset: { x: group.chain.rootOffset.x, y: group.chain.rootOffset.y },
      // §9 lengthScale: multiplier on every segment length.
      segmentLengths: group.chain.segmentLengths.map((length) => length * draft.lengthScale),
      damping: draft.damping,
      gravityScale: draft.gravityScale
    },
    outputs:
      output === undefined
        ? []
        : [
            {
              parameterId: output.parameterId,
              segmentIndex: output.segmentIndex,
              // §9 outputScale: multiplier on the committed output scale.
              scale: output.scale * draft.outputScale,
              limit: draft.limit
            }
          ]
  };
}

function sameQuickTuneDraftAsGroup(
  group: DynamicsToolGroup,
  draft: QuickTuneDraft
): boolean {
  const committed = createQuickTuneDraftFromGroup(group);
  return (
    sameNumericValue(committed.outputScale, draft.outputScale) &&
    sameNumericValue(committed.limit, draft.limit) &&
    sameNumericValue(committed.damping, draft.damping) &&
    sameNumericValue(committed.gravityScale, draft.gravityScale) &&
    sameNumericValue(committed.lengthScale, draft.lengthScale)
  );
}

function createQuickTuneSignature(draft: QuickTuneDraft): string {
  return [
    draft.outputScale,
    draft.limit,
    draft.damping,
    draft.gravityScale,
    draft.lengthScale
  ].join(":");
}

function getQuickTuneLabel(field: QuickTuneField): string {
  switch (field) {
    case "outputScale":
      return "Output x";
    case "limit":
      return "Limit";
    case "damping":
      return "Damping";
    case "gravityScale":
      return "Gravity";
    case "lengthScale":
      return "Length x";
  }
}

function getQuickTuneDescription(field: QuickTuneField): string {
  switch (field) {
    case "outputScale":
      return "出力の倍率。上げると出力パラメータの動きが大きくなります。";
    case "limit":
      return "最大振れ幅。出力オフセットの絶対値の上限です。";
    case "damping":
      return "減衰の強さ。上げると揺れが早く収まります。";
    case "gravityScale":
      return "重力の強さ。上げると速く戻り、周期が短くなります。";
    case "lengthScale":
      return "チェーン長の倍率。上げるとゆったり長い周期で揺れます。";
  }
}

function getQuickTuneBounds(
  field: QuickTuneField,
  value: number
): {
  readonly min: number;
  readonly max: number;
  readonly step: number;
} {
  const magnitude = Math.abs(value);
  switch (field) {
    case "outputScale":
      return { min: 0, max: Math.max(3, magnitude * 2), step: 0.01 };
    case "limit":
      return { min: 0, max: Math.max(1, magnitude * 2), step: 0.01 };
    case "damping":
      return { min: 0, max: Math.max(60, magnitude * 2), step: 0.1 };
    case "gravityScale":
      return { min: 0, max: Math.max(5, magnitude * 2), step: 0.05 };
    case "lengthScale":
      return { min: 0.01, max: Math.max(3, magnitude * 2), step: 0.01 };
  }
}

function normalizeQuickTuneValue(field: QuickTuneField, value: number): number {
  const min = QUICK_TUNE_MULTIPLIER_FIELDS.has(field) ? 0.01 : 0;
  if (!Number.isFinite(value)) {
    return min;
  }

  return Number(Math.max(value, min).toFixed(6));
}

function cloneDynamicsInputForPayload(input: DynamicsInputPayloadDto): DynamicsInputPayloadDto {
  return {
    parameterId: input.parameterId,
    kind: input.kind,
    scale: input.scale
  };
}

function cloneDynamicsChainForPayload(chain: DynamicsChainPayloadDto): DynamicsChainPayloadDto {
  return {
    rootOffset: { x: chain.rootOffset.x, y: chain.rootOffset.y },
    segmentLengths: [...chain.segmentLengths],
    damping: chain.damping,
    gravityScale: chain.gravityScale
  };
}

function cloneDynamicsOutputForPayload(output: DynamicsOutputPayloadDto): DynamicsOutputPayloadDto {
  return {
    parameterId: output.parameterId,
    segmentIndex: output.segmentIndex,
    scale: output.scale,
    limit: output.limit
  };
}

function useDynamicsPreviewAnimationLoop({
  enabled,
  groupId,
  onAdvance
}: {
  readonly enabled: boolean;
  readonly groupId: DynamicsGroupId;
  readonly onAdvance: (groupId: DynamicsGroupId, dtMs: number) => void;
}) {
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof globalThis.requestAnimationFrame !== "function") {
      lastTimestampRef.current = null;
      return;
    }

    let active = true;
    let frameId: number | null = null;
    const tick = (timestamp: number) => {
      if (!active) {
        return;
      }

      const dtMs =
        lastTimestampRef.current === null
          ? DYNAMICS_TOOL_PREVIEW_STEP_MS
          : timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;
      onAdvance(groupId, Math.max(0, dtMs));
      frameId = globalThis.requestAnimationFrame(tick);
    };

    frameId = globalThis.requestAnimationFrame(tick);

    return () => {
      active = false;
      lastTimestampRef.current = null;
      if (frameId !== null && typeof globalThis.cancelAnimationFrame === "function") {
        globalThis.cancelAnimationFrame(frameId);
      }
    };
  }, [enabled, groupId, onAdvance]);
}

function ChainEditor({
  chain,
  onChainChange
}: {
  readonly chain: DynamicsChainPayloadDto;
  readonly onChainChange: (patch: Partial<DynamicsChainPayloadDto>) => void;
}) {
  const setSegmentLength = (index: number, length: number) => {
    const next = chain.segmentLengths.map((current, currentIndex) =>
      currentIndex === index ? length : current
    );
    onChainChange({ segmentLengths: next });
  };

  const addSegment = () => {
    const last = chain.segmentLengths[chain.segmentLengths.length - 1] ?? 10;
    onChainChange({ segmentLengths: [...chain.segmentLengths, last] });
  };

  const removeSegment = (index: number) => {
    if (chain.segmentLengths.length <= 1) {
      return;
    }
    onChainChange({
      segmentLengths: chain.segmentLengths.filter((_, currentIndex) => currentIndex !== index)
    });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="dynamics-chain-editor">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Root Offset X (cm)"
          onChange={(x) => onChainChange({ rootOffset: { ...chain.rootOffset, x } })}
          value={chain.rootOffset.x}
        />
        <NumberField
          label="Root Offset Y (cm)"
          onChange={(y) => onChainChange({ rootOffset: { ...chain.rootOffset, y } })}
          value={chain.rootOffset.y}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs text-neutral-500">Segment Lengths (cm)</div>
        {chain.segmentLengths.map((length, index) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_2rem] items-end gap-2"
            data-testid="dynamics-chain-segment-row"
            key={index}
          >
            <NumberField
              label={`Segment ${index + 1}`}
              min={0}
              onChange={(nextLength) => setSegmentLength(index, nextLength)}
              value={length}
            />
            <IconPanelButton
              disabled={chain.segmentLengths.length <= 1}
              label={`Remove segment ${index + 1}`}
              onClick={() => removeSegment(index)}
            >
              <Trash2 aria-hidden="true" size={13} strokeWidth={1.8} />
            </IconPanelButton>
          </div>
        ))}
        <button
          className="flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100"
          data-testid="dynamics-add-segment"
          onClick={addSegment}
          type="button"
        >
          <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
          Add Segment
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Damping (1/s)"
          min={0}
          onChange={(damping) => onChainChange({ damping })}
          value={chain.damping}
        />
        <NumberField
          label="Gravity Scale"
          min={0}
          onChange={(gravityScale) => onChainChange({ gravityScale })}
          value={chain.gravityScale}
        />
      </div>
    </div>
  );
}

function DraftInspector({
  actionLabel,
  actionTestId,
  draft,
  hasBlockingIssues,
  mode,
  onAction,
  onBack,
  onCancel,
  onInputChange,
  onOutputChange,
  onChainChange,
  onPresetChange,
  onSetDraft,
  operationMessage,
  parameters,
  validationIssues
}: {
  readonly actionLabel: string;
  readonly actionTestId: string;
  readonly draft: DynamicsToolDraft;
  readonly hasBlockingIssues: boolean;
  readonly mode: "create" | "edit";
  readonly onAction: () => void;
  readonly onBack: () => void;
  readonly onCancel: () => void;
  readonly onInputChange: (index: number, patch: Partial<DynamicsInputPayloadDto>) => void;
  readonly onOutputChange: (patch: Partial<DynamicsOutputPayloadDto>) => void;
  readonly onChainChange: (patch: Partial<DynamicsChainPayloadDto>) => void;
  readonly onPresetChange: (presetId: DynamicsToolPresetId) => void;
  readonly onSetDraft: (updater: (current: DynamicsToolDraft) => DynamicsToolDraft) => void;
  readonly operationMessage: string | null;
  readonly parameters: readonly EditorParameter[];
  readonly validationIssues: readonly DynamicsToolValidationIssue[];
}) {
  return (
    <div
      className="flex flex-col gap-3"
      data-testid={mode === "create" ? "dynamics-create-inspector" : "dynamics-edit-inspector"}
    >
      <PanelButton
        label={mode === "create" ? "Back to Groups" : "Back to Group"}
        onClick={onBack}
        testId={mode === "create" ? "dynamics-back-to-groups" : "dynamics-back-to-group"}
      >
        <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.8} />
        {mode === "create" ? "Back to Groups" : "Back to Group"}
      </PanelButton>

      <Section title="Settings">
        <div className="flex flex-col gap-3">
          <TextField
            label="Name"
            onChange={(displayName) => onSetDraft((current) => ({ ...current, displayName }))}
            value={draft.displayName}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <SelectField
              label="Preset"
              onChange={(value) => onPresetChange(value as DynamicsToolPresetId)}
              value={draft.presetId}
            >
              {DYNAMICS_TOOL_PRESETS.map((preset) => (
                <option key={preset.presetId} value={preset.presetId}>
                  {preset.label}
                </option>
              ))}
            </SelectField>
            <label className="flex h-8 items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300">
              <input
                checked={draft.enabled}
                className="accent-teal-400"
                onChange={(event) =>
                  onSetDraft((current) => ({ ...current, enabled: event.currentTarget.checked }))
                }
                type="checkbox"
              />
              Enabled
            </label>
          </div>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="flex flex-col gap-3">
          {draft.inputs.map((input, index) => (
            <div
              className="rounded border border-neutral-800 bg-neutral-950/60 p-2"
              data-testid="dynamics-input-row"
              key={`${input.parameterId}:${index}`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_5.75rem_2rem] items-end gap-2">
                <SelectField
                  label={`Driver ${index + 1}`}
                  onChange={(value) =>
                    onInputChange(index, { parameterId: value as ParameterId })
                  }
                  value={input.parameterId}
                >
                  {renderParameterOptions(parameters)}
                </SelectField>
                <SelectField
                  label="Kind"
                  onChange={(value) => onInputChange(index, { kind: value as DynamicsAxisKind })}
                  value={input.kind}
                >
                  {AXIS_KIND_OPTIONS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </SelectField>
                <IconPanelButton
                  disabled={draft.inputs.length <= 1}
                  label="Remove input"
                  onClick={() =>
                    onSetDraft((current) => removeInputFromDynamicsDraft(current, index))
                  }
                >
                  <Trash2 aria-hidden="true" size={13} strokeWidth={1.8} />
                </IconPanelButton>
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)] items-end gap-2">
                <NumberField
                  label={input.kind === "angle" ? "Scale (deg/unit)" : "Scale (cm/unit)"}
                  onChange={(scale) => onInputChange(index, { scale })}
                  value={input.scale}
                />
              </div>
            </div>
          ))}
          <button
            className="flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100 disabled:cursor-not-allowed disabled:text-neutral-700"
            data-testid="dynamics-add-input"
            disabled={parameters.length === 0}
            onClick={() => onSetDraft((current) => addInputToDynamicsDraftFromParameters(current, parameters))}
            type="button"
          >
            <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
            Add Input
          </button>
        </div>
      </Section>

      <Section title="Chain">
        <ChainEditor chain={draft.chain} onChainChange={onChainChange} />
      </Section>

      <Section title="Outputs">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_5.75rem] gap-2">
            <SelectField
              label="Output"
              onChange={(value) => onOutputChange({ parameterId: value as ParameterId })}
              value={draft.outputs[0]?.parameterId ?? ""}
            >
              {renderParameterOptions(parameters)}
            </SelectField>
            <NumberField
              label="Segment"
              min={1}
              onChange={(segmentIndex) =>
                onOutputChange({ segmentIndex: Math.max(1, Math.round(segmentIndex)) })
              }
              step={1}
              testId="dynamics-output-segment"
              value={draft.outputs[0]?.segmentIndex ?? 1}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-2">
            <NumberField
              label="Scale (unit/deg)"
              onChange={(scale) => onOutputChange({ scale })}
              value={draft.outputs[0]?.scale ?? 0}
            />
            <NumberField
              label="Limit"
              min={0}
              onChange={(limit) => onOutputChange({ limit })}
              value={draft.outputs[0]?.limit ?? 0}
            />
          </div>
        </div>
      </Section>

      <Section title="Validation">
        <ValidationIssues issues={validationIssues} />
      </Section>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <button
          className="flex min-h-8 items-center justify-center gap-2 rounded border border-teal-800/70 bg-teal-950/30 px-2 text-xs font-medium text-teal-100 transition hover:border-teal-500 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:bg-neutral-950 disabled:text-neutral-700"
          data-testid={actionTestId}
          disabled={hasBlockingIssues}
          onClick={onAction}
          type="button"
        >
          {mode === "create" ? (
            <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
          ) : (
            <Save aria-hidden="true" size={14} strokeWidth={1.8} />
          )}
          {actionLabel}
        </button>
        <PanelButton label="Cancel" onClick={onCancel} testId="dynamics-cancel">
          Cancel
        </PanelButton>
      </div>

      {operationMessage === null ? null : <OperationMessage message={operationMessage} />}
    </div>
  );
}

function addInputToDynamicsDraftFromParameters(
  draft: DynamicsToolDraft,
  parameters: readonly EditorParameter[]
): DynamicsToolDraft {
  const usedParameterIds = new Set(draft.inputs.map((input) => input.parameterId));
  const parameter =
    parameters.find((candidate) => !usedParameterIds.has(candidate.parameterId)) ??
    parameters[0];

  return parameter === undefined
    ? draft
    : {
        ...draft,
        inputs: [...draft.inputs, createDefaultDynamicsInput(parameter)]
      };
}

function ValidationIssues({
  issues
}: {
  readonly issues: readonly DynamicsToolValidationIssue[];
}) {
  if (issues.length === 0) {
    return (
      <div
        className="flex min-h-8 items-center gap-2 rounded border border-teal-900/70 bg-teal-950/25 px-2 text-xs font-medium text-teal-100"
        data-testid="dynamics-validation-ok"
      >
        <Check aria-hidden="true" size={14} strokeWidth={1.9} />
        Ready
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue) => (
        <li
          className={cn(
            "flex gap-2 rounded border px-2 py-1.5 text-xs",
            issue.severity === "error"
              ? "border-red-900/70 bg-red-950/30 text-red-100"
              : "border-amber-900/70 bg-amber-950/25 text-amber-100"
          )}
          data-code={issue.code}
          data-testid={
            issue.severity === "error"
              ? "dynamics-validation-error"
              : "dynamics-validation-warning"
          }
          key={`${issue.code}:${issue.path ?? ""}`}
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={13}
            strokeWidth={1.8}
          />
          <span className="min-w-0">{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

function GroupDiagnosticIssues({
  summary
}: {
  readonly summary?: DynamicsToolGroupDiagnosticSummary | undefined;
}) {
  if (summary === undefined || summary.issues.length === 0) {
    return (
      <div
        className="flex min-h-8 items-center gap-2 rounded border border-teal-900/70 bg-teal-950/25 px-2 text-xs font-medium text-teal-100"
        data-testid="dynamics-group-validation-ok"
      >
        <Check aria-hidden="true" size={14} strokeWidth={1.9} />
        Ready
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="dynamics-group-validation-summary">
      {summary.issues.map((issue) => (
        <li
          className="flex gap-2 rounded border border-amber-900/70 bg-amber-950/25 px-2 py-1.5 text-xs text-amber-100"
          data-code={issue.code}
          data-testid="dynamics-group-validation-warning"
          key={issue.id}
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={13}
            strokeWidth={1.8}
          />
          <span className="min-w-0">{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

function formatDynamicsGroupWarningLabel(summary: DynamicsToolGroupDiagnosticSummary): string {
  return summary.issues.map((issue) => issue.title).join("; ");
}

function Section({
  children,
  title
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
      <h3 className="text-xs font-semibold uppercase text-neutral-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TextField({
  label,
  onChange,
  value
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      {label}
      <input
        aria-label={label}
        className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </label>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  step,
  testId,
  value
}: {
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly onChange: (value: number) => void;
  readonly step?: number;
  readonly testId?: string;
  readonly value: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-500">
      {label}
      <input
        aria-label={label}
        className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500"
        {...(testId === undefined ? {} : { "data-testid": testId })}
        {...(max === undefined ? {} : { max })}
        {...(min === undefined ? {} : { min })}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
        step={step ?? 0.01}
        type="number"
        value={formatParameterValue(value)}
      />
    </label>
  );
}

function SelectField({
  children,
  label,
  onChange,
  testId,
  value
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly testId?: string;
  readonly value: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-500">
      {label}
      <select
        aria-label={label}
        className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
        data-testid={testId}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function IconPanelButton({
  children,
  disabled,
  label,
  onClick
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-neutral-300 transition hover:border-teal-700 hover:text-teal-100 disabled:cursor-not-allowed disabled:text-neutral-700"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function PanelButton({
  children,
  disabled,
  label,
  onClick,
  testId
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
  readonly testId?: string;
}) {
  return (
    <button
      aria-label={label}
      className="flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100 disabled:cursor-not-allowed disabled:text-neutral-700"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SummaryRow({
  label,
  value
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="truncate text-xs font-medium text-neutral-200">{value}</span>
    </div>
  );
}

function OperationMessage({ message }: { readonly message: string }) {
  return (
    <div
      className="rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-neutral-300"
      data-testid="dynamics-operation-message"
    >
      {message}
    </div>
  );
}

function renderParameterOptions(parameters: readonly EditorParameter[]) {
  if (parameters.length === 0) {
    return <option value="">No parameters</option>;
  }

  return parameters.map((parameter) => (
    <option key={parameter.parameterId} value={parameter.parameterId}>
      {parameter.displayName}
    </option>
  ));
}

function createUniqueDynamicsGroupId(
  groups: readonly { readonly dynamicsGroupId: DynamicsGroupId }[],
  displayName: string
): DynamicsGroupId {
  const existingIds = new Set(groups.map((group) => group.dynamicsGroupId));
  const base = displayName.trim().length === 0 ? "Dynamics Group" : displayName.trim();
  const initial = createDynamicsGroupIdFromDisplayName(base);
  if (!existingIds.has(initial)) {
    return initial;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = createDynamicsGroupIdFromDisplayName(`${base} ${index}`);
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  return createDynamicsGroupIdFromDisplayName(`${base} ${groups.length + 1}`);
}

function formatOperationDiagnostics(diagnostics: readonly { readonly message?: string }[]): string {
  return diagnostics[0]?.message ?? "Dynamics operation was rejected.";
}

function readFiniteInputValue(value: string, fallbackValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function sameNumericValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.000001;
}
