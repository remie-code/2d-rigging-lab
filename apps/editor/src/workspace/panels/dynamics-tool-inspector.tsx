import type { DynamicsGroupId, ParameterId } from "@private-2d-rigging-lab/contracts";
import {
  createDynamicsGroupIdFromDisplayName,
  type DynamicsInputPayloadDto,
  type DynamicsOutputPayloadDto,
  type DynamicsPendulumPayloadDto
} from "@private-2d-rigging-lab/operation-core";
import {
  AlertTriangle,
  Check,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Waves
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  addInputToDynamicsDraft,
  createDefaultDynamicsOutput,
  createDynamicsGroupCreatePayloadFromDraft,
  createDynamicsGroupDraftFromGroup,
  createDynamicsGroupDraftFromSession,
  createDynamicsGroupUpdatePayloadFromDraft,
  DYNAMICS_TOOL_PRESETS,
  getDynamicsToolPreset,
  hasBlockingDynamicsToolIssues,
  removeInputFromDynamicsDraft,
  updateDynamicsDraftInput,
  updateDynamicsDraftOutput,
  updateDynamicsDraftPendulum,
  validateDynamicsToolDraft,
  type DynamicsAxisKind,
  type DynamicsToolDraft,
  type DynamicsToolPresetId
} from "../../features/editor-session/model/dynamics-tool-state";
import {
  formatParameterValue,
  listEditorParameters,
  type EditorParameter
} from "../../features/editor-session/model/parameter-keyform-state";
import { cn } from "../../lib/class-name";

const AXIS_KIND_OPTIONS: readonly DynamicsAxisKind[] = ["angle", "positionX", "positionY"];

export function DynamicsToolInspector() {
  const {
    createDynamicsGroup,
    deleteDynamicsGroup,
    dynamicsToolPreview,
    dynamicsToolPreviewEvaluation,
    resetDynamicsToolPreviewSimulation,
    session,
    setDynamicsToolPreviewDriverValue,
    setDynamicsToolPreviewGroupId,
    updateDynamicsGroup
  } = useEditorSession();
  const parameters = useMemo(() => listEditorParameters(session), [session]);
  const selectedGroupId = dynamicsToolPreview.selectedGroupId;
  const selectedGroup = useMemo(
    () =>
      selectedGroupId === null
        ? undefined
        : session.graph.dynamicsGroups.find((group) => group.dynamicsGroupId === selectedGroupId),
    [selectedGroupId, session.graph.dynamicsGroups]
  );
  const [draft, setDraft] = useState<DynamicsToolDraft>(() =>
    selectedGroup === undefined
      ? createDynamicsGroupDraftFromSession(session)
      : createDynamicsGroupDraftFromGroup(selectedGroup)
  );
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const isCreating = selectedGroup === undefined;

  useEffect(() => {
    if (session.graph.dynamicsGroups.length === 0) {
      if (selectedGroupId !== null) {
        setDynamicsToolPreviewGroupId(null);
      }
      return;
    }

    const selectionExists = session.graph.dynamicsGroups.some(
      (group) => group.dynamicsGroupId === selectedGroupId
    );
    if (!selectionExists) {
      setDynamicsToolPreviewGroupId(session.graph.dynamicsGroups[0]!.dynamicsGroupId);
    }
  }, [selectedGroupId, session.graph.dynamicsGroups, setDynamicsToolPreviewGroupId]);

  useEffect(() => {
    setDraft(
      selectedGroup === undefined
        ? createDynamicsGroupDraftFromSession(session)
        : createDynamicsGroupDraftFromGroup(selectedGroup)
    );
    setOperationMessage(null);
  }, [selectedGroup, session]);

  const validationIssues = useMemo(
    () => validateDynamicsToolDraft(session, draft, selectedGroup?.dynamicsGroupId),
    [draft, selectedGroup?.dynamicsGroupId, session]
  );
  const hasBlockingIssues = hasBlockingDynamicsToolIssues(validationIssues);

  const selectNewDraft = () => {
    setDynamicsToolPreviewGroupId(null);
    setDraft(createDynamicsGroupDraftFromSession(session, draft.presetId));
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
      pendulums: [structuredClone(preset.pendulum)],
      outputs:
        outputParameter === undefined
          ? draft.outputs
          : [createDefaultDynamicsOutput(outputParameter, preset)]
    });
  };

  const createGroup = () => {
    if (hasBlockingIssues) {
      return;
    }

    const dynamicsGroupId = createUniqueDynamicsGroupId(session.graph.dynamicsGroups, draft.displayName);
    const result = createDynamicsGroup(
      createDynamicsGroupCreatePayloadFromDraft(draft, dynamicsGroupId)
    );
    if (result.committed) {
      setOperationMessage("Dynamics Group created.");
      setDynamicsToolPreviewGroupId(dynamicsGroupId);
      return;
    }

    setOperationMessage(formatOperationDiagnostics(result.diagnostics));
  };

  const updateGroup = () => {
    if (selectedGroup === undefined || hasBlockingIssues) {
      return;
    }

    const result = updateDynamicsGroup(
      createDynamicsGroupUpdatePayloadFromDraft(draft, selectedGroup.dynamicsGroupId)
    );
    setOperationMessage(
      result.committed ? "Dynamics Group updated." : formatOperationDiagnostics(result.diagnostics)
    );
  };

  const deleteGroup = () => {
    if (selectedGroup === undefined) {
      return;
    }

    const currentIndex = session.graph.dynamicsGroups.findIndex(
      (group) => group.dynamicsGroupId === selectedGroup.dynamicsGroupId
    );
    const nextGroup =
      session.graph.dynamicsGroups[currentIndex + 1] ??
      session.graph.dynamicsGroups[currentIndex - 1];
    const result = deleteDynamicsGroup({ dynamicsGroupId: selectedGroup.dynamicsGroupId });
    if (result.committed) {
      setOperationMessage("Dynamics Group deleted.");
      setDynamicsToolPreviewGroupId(nextGroup?.dynamicsGroupId ?? null);
      return;
    }

    setOperationMessage(formatOperationDiagnostics(result.diagnostics));
  };

  const updateInput = (index: number, patch: Partial<DynamicsInputPayloadDto>) => {
    setDraft((current) => updateDynamicsDraftInput(session, current, index, patch));
  };

  const updateOutput = (patch: Partial<DynamicsOutputPayloadDto>) => {
    setDraft((current) => updateDynamicsDraftOutput(session, current, patch));
  };

  const updatePendulum = (patch: Partial<DynamicsPendulumPayloadDto>) => {
    setDraft((current) => updateDynamicsDraftPendulum(current, patch));
  };

  const previewGroup = selectedGroup;
  const previewDriverValues =
    previewGroup === undefined
      ? {}
      : dynamicsToolPreview.driverValuesByGroupId[previewGroup.dynamicsGroupId] ?? {};

  return (
    <>
      <div
        className="rounded-md border border-neutral-800 bg-neutral-950/50 p-3"
        data-testid="dynamics-tool-inspector"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
          <Waves aria-hidden="true" size={16} strokeWidth={1.8} />
          <span>Dynamics Tool</span>
        </div>
      </div>

      <Section title="Groups">
        <div className="flex flex-col gap-2" data-testid="dynamics-group-list">
          {session.graph.dynamicsGroups.map((group) => (
            <button
              className={cn(
                "flex min-h-8 items-center justify-between rounded border px-2 text-left text-xs font-medium transition",
                group.dynamicsGroupId === selectedGroup?.dynamicsGroupId
                  ? "border-teal-500 bg-teal-950/40 text-teal-50"
                  : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-teal-700"
              )}
              data-dynamics-group-id={group.dynamicsGroupId}
              key={group.dynamicsGroupId}
              onClick={() => setDynamicsToolPreviewGroupId(group.dynamicsGroupId)}
              type="button"
            >
              <span className="min-w-0 truncate">{group.displayName}</span>
              <span className="ml-2 text-[10px] uppercase text-neutral-500">
                {group.enabled ? "On" : "Off"}
              </span>
            </button>
          ))}
          <button
            className={cn(
              "flex min-h-8 items-center justify-center gap-2 rounded border px-2 text-xs font-medium transition",
              isCreating
                ? "border-teal-500 bg-teal-950/40 text-teal-50"
                : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-teal-700"
            )}
            data-testid="dynamics-new-draft"
            onClick={selectNewDraft}
            type="button"
          >
            <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
            New Group
          </button>
        </div>
      </Section>

      <Section title={isCreating ? "Create" : "Settings"}>
        <div className="flex flex-col gap-3">
          <TextField
            label="Name"
            onChange={(displayName) => setDraft((current) => ({ ...current, displayName }))}
            value={draft.displayName}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <SelectField
              label="Preset"
              onChange={(value) => applyPreset(value as DynamicsToolPresetId)}
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
                  setDraft((current) => ({ ...current, enabled: event.currentTarget.checked }))
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
                  onChange={(value) => updateInput(index, { parameterId: value as ParameterId })}
                  value={input.parameterId}
                >
                  {renderParameterOptions(parameters)}
                </SelectField>
                <SelectField
                  label="Kind"
                  onChange={(value) => updateInput(index, { kind: value as DynamicsAxisKind })}
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
                    setDraft((current) => removeInputFromDynamicsDraft(current, index))
                  }
                >
                  <Trash2 aria-hidden="true" size={13} strokeWidth={1.8} />
                </IconPanelButton>
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <NumberField
                  label="Influence"
                  onChange={(influencePercent) => updateInput(index, { influencePercent })}
                  step={1}
                  value={input.influencePercent}
                />
                <label className="flex h-8 items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-300">
                  <input
                    checked={input.invert}
                    className="accent-teal-400"
                    onChange={(event) => updateInput(index, { invert: event.currentTarget.checked })}
                    type="checkbox"
                  />
                  Invert
                </label>
              </div>
            </div>
          ))}
          <button
            className="flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100 disabled:cursor-not-allowed disabled:text-neutral-700"
            data-testid="dynamics-add-input"
            disabled={parameters.length === 0}
            onClick={() => setDraft((current) => addInputToDynamicsDraft(session, current))}
            type="button"
          >
            <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
            Add Input
          </button>
        </div>
      </Section>

      <Section title="Advanced">
        <div className="flex flex-col gap-2">
          {draft.inputs.map((input, index) => (
            <div
              className="grid grid-cols-3 gap-2"
              data-testid="dynamics-normalization-row"
              key={`${input.parameterId}:${index}:normalization`}
            >
              <NumberField
                label={`Min ${index + 1}`}
                onChange={(min) =>
                  updateInput(index, { normalization: { ...input.normalization, min } })
                }
                value={input.normalization.min}
              />
              <NumberField
                label="Center"
                onChange={(center) =>
                  updateInput(index, { normalization: { ...input.normalization, center } })
                }
                value={input.normalization.center}
              />
              <NumberField
                label="Max"
                onChange={(max) =>
                  updateInput(index, { normalization: { ...input.normalization, max } })
                }
                value={input.normalization.max}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Pendulum">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Length"
            min={0}
            onChange={(length) => updatePendulum({ length })}
            value={draft.pendulums[0]?.length ?? 0}
          />
          <NumberField
            label="Sway"
            min={0}
            onChange={(sway) => updatePendulum({ sway })}
            value={draft.pendulums[0]?.sway ?? 0}
          />
          <NumberField
            label="Reaction"
            min={0}
            onChange={(reactionSpeed) => updatePendulum({ reactionSpeed })}
            value={draft.pendulums[0]?.reactionSpeed ?? 0}
          />
          <NumberField
            label="Converge"
            min={0}
            onChange={(convergenceSpeed) => updatePendulum({ convergenceSpeed })}
            value={draft.pendulums[0]?.convergenceSpeed ?? 0}
          />
        </div>
      </Section>

      <Section title="Outputs">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_5.75rem] gap-2">
            <SelectField
              label="Output"
              onChange={(value) => updateOutput({ parameterId: value as ParameterId })}
              value={draft.outputs[0]?.parameterId ?? ""}
            >
              {renderParameterOptions(parameters)}
            </SelectField>
            <SelectField
              label="Kind"
              onChange={(value) => updateOutput({ kind: value as DynamicsAxisKind })}
              testId="dynamics-output-kind"
              value={draft.outputs[0]?.kind ?? "angle"}
            >
              {AXIS_KIND_OPTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
            <NumberField
              label="Strength"
              onChange={(strength) => updateOutput({ strength })}
              value={draft.outputs[0]?.strength ?? 0}
            />
            <NumberField
              label="Limit"
              min={0}
              onChange={(limit) => updateOutput({ limit })}
              value={draft.outputs[0]?.limit ?? 0}
            />
            <label className="flex h-8 items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-300">
              <input
                checked={draft.outputs[0]?.invert ?? false}
                className="accent-teal-400"
                onChange={(event) => updateOutput({ invert: event.currentTarget.checked })}
                type="checkbox"
              />
              Invert
            </label>
          </div>
        </div>
      </Section>

      <Section title="Validation">
        {validationIssues.length === 0 ? (
          <div
            className="flex min-h-8 items-center gap-2 rounded border border-teal-900/70 bg-teal-950/25 px-2 text-xs font-medium text-teal-100"
            data-testid="dynamics-validation-ok"
          >
            <Check aria-hidden="true" size={14} strokeWidth={1.9} />
            Ready
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {validationIssues.map((issue) => (
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
        )}
      </Section>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <button
          className="flex min-h-8 items-center justify-center gap-2 rounded border border-teal-800/70 bg-teal-950/30 px-2 text-xs font-medium text-teal-100 transition hover:border-teal-500 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:bg-neutral-950 disabled:text-neutral-700"
          data-testid="dynamics-create-group"
          disabled={!isCreating || hasBlockingIssues}
          onClick={createGroup}
          type="button"
        >
          <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
          Create
        </button>
        <button
          className="flex min-h-8 items-center justify-center gap-2 rounded border border-teal-800/70 bg-teal-950/30 px-2 text-xs font-medium text-teal-100 transition hover:border-teal-500 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:bg-neutral-950 disabled:text-neutral-700"
          data-testid="dynamics-apply-group"
          disabled={isCreating || hasBlockingIssues}
          onClick={updateGroup}
          type="button"
        >
          <Save aria-hidden="true" size={14} strokeWidth={1.8} />
          Apply
        </button>
      </div>

      <Section title="Preview">
        {previewGroup === undefined ? (
          <div className="rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-neutral-500">
            No saved Dynamics Group selected.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {previewGroup.inputs.map((input) => {
              const parameter = parameters.find(
                (candidate) => candidate.parameterId === input.parameterId
              );
              const value =
                previewDriverValues[input.parameterId] ??
                parameter?.default ??
                input.normalization.center;
              return (
                <label
                  className="flex flex-col gap-1 text-xs text-neutral-500"
                  data-testid="dynamics-preview-driver"
                  key={input.parameterId}
                >
                  {parameter?.displayName ?? input.parameterId}
                  <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
                    <input
                      className="h-2 accent-teal-400"
                      max={parameter?.max ?? input.normalization.max}
                      min={parameter?.min ?? input.normalization.min}
                      onChange={(event) =>
                        setDynamicsToolPreviewDriverValue(
                          previewGroup.dynamicsGroupId,
                          input.parameterId,
                          Number(event.currentTarget.value)
                        )
                      }
                      step={parameter?.recommendedUiStep ?? 0.01}
                      type="range"
                      value={value}
                    />
                    <input
                      aria-label={`${parameter?.displayName ?? input.parameterId} preview value`}
                      className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500"
                      max={parameter?.max ?? input.normalization.max}
                      min={parameter?.min ?? input.normalization.min}
                      onChange={(event) =>
                        setDynamicsToolPreviewDriverValue(
                          previewGroup.dynamicsGroupId,
                          input.parameterId,
                          Number(event.currentTarget.value)
                        )
                      }
                      step={parameter?.recommendedUiStep ?? 0.01}
                      type="number"
                      value={formatParameterValue(value)}
                    />
                  </div>
                </label>
              );
            })}
            <div className="divide-y divide-neutral-800 rounded border border-neutral-800 bg-neutral-950/60 px-2">
              <SummaryRow label="Source" value={formatParameterValue(dynamicsToolPreviewEvaluation.source)} />
              <SummaryRow
                label="Angle"
                value={formatParameterValue(dynamicsToolPreviewEvaluation.state?.angle ?? 0)}
              />
              <SummaryRow
                label="Offset"
                value={formatParameterValue(dynamicsToolPreviewEvaluation.output?.offset ?? 0)}
              />
              <SummaryRow
                label="Effective"
                value={formatParameterValue(
                  dynamicsToolPreviewEvaluation.output?.effectiveValue ??
                    dynamicsToolPreviewEvaluation.output?.baseValue ??
                    0
                )}
              />
            </div>
            <button
              className="flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100"
              data-testid="dynamics-preview-reset"
              onClick={() => resetDynamicsToolPreviewSimulation(previewGroup.dynamicsGroupId)}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
              Reset Preview
            </button>
          </div>
        )}
      </Section>

      <button
        className="flex min-h-8 items-center justify-center gap-2 rounded border border-red-900/60 bg-red-950/20 px-2 text-xs font-medium text-red-100 transition hover:border-red-700 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:bg-neutral-950 disabled:text-neutral-700"
        data-testid="dynamics-delete-group"
        disabled={isCreating}
        onClick={deleteGroup}
        type="button"
      >
        <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
        Delete Group
      </button>

      {operationMessage === null ? null : (
        <div
          className="rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-neutral-300"
          data-testid="dynamics-operation-message"
        >
          {operationMessage}
        </div>
      )}
    </>
  );
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
  value
}: {
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly onChange: (value: number) => void;
  readonly step?: number;
  readonly value: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-500">
      {label}
      <input
        aria-label={label}
        className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500"
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
