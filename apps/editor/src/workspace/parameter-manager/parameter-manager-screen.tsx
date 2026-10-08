import type { ParameterId } from "@private-2d-rigging-lab/contracts";
import type { CreateParameterPayloadDto, UpdateParameterPayloadDto } from "@private-2d-rigging-lab/operation-core";
import { Check, ListChecks, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createParameterManagerProjection,
  createSuggestedCustomParameterId,
  formatParameterNumber,
  PARAMETER_MANAGER_GROUP_FILTERS,
  PARAMETER_TABLE_COLUMNS,
  parseParameterIdInput,
  type ParameterManagerGroupFilter,
  type ParameterManagerParameterRow,
  type ParameterManagerProjection
} from "../../features/editor-session/model/parameter-manager-projection";
import { cn } from "../../lib/class-name";
import { useEditorUiStore } from "../../state/editor-ui-store";

type CreateFormState = {
  readonly displayName: string;
  readonly parameterId: string;
  readonly min: string;
  readonly defaultValue: string;
  readonly max: string;
  readonly recommendedUiStep: string;
  readonly idEdited: boolean;
};

type EditFormState = {
  readonly displayName: string;
  readonly min: string;
  readonly defaultValue: string;
  readonly max: string;
  readonly recommendedUiStep: string;
};

type ParameterUpdateDraft = {
  parameterId: ParameterId;
  displayName?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  default?: number | undefined;
  recommendedUiStep?: number | undefined;
};

const DEFAULT_CUSTOM_PARAMETER_NAME = "Custom Parameter";

export function ParameterManagerScreen() {
  const {
    activeParameterId,
    createCustomParameter,
    deleteCustomParameter,
    parameterOperationFeedback,
    session,
    setActiveParameterId,
    updateCustomParameter
  } = useEditorSession();
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const [groupFilter, setGroupFilter] = useState<ParameterManagerGroupFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedParameterId, setSelectedParameterId] = useState<ParameterId | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const projection = useMemo(
    () => createParameterManagerProjection(session, { groupFilter, search }),
    [groupFilter, search, session]
  );
  const existingIds = useMemo(
    () => new Set(projection.rows.map((row) => row.parameterId)),
    [projection.rows]
  );
  const [createForm, setCreateForm] = useState<CreateFormState>(() =>
    createInitialCreateForm(new Set())
  );
  const selectedRow =
    projection.rows.find((row) => row.parameterId === selectedParameterId) ??
    projection.filteredRows[0] ??
    projection.rows[0] ??
    null;

  useEffect(() => {
    if (selectedRow !== null && selectedParameterId !== selectedRow.parameterId) {
      setSelectedParameterId(selectedRow.parameterId);
    }
  }, [selectedParameterId, selectedRow]);

  useEffect(() => {
    setShowUsage(false);
    setLocalFeedback(null);
  }, [selectedRow?.parameterId]);

  const openCreateFlow = () => {
    setCreateForm(createInitialCreateForm(existingIds));
    setCreateOpen(true);
    setLocalFeedback(null);
  };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseCreateForm(createForm, existingIds);
    if (!parsed.ok) {
      setLocalFeedback(parsed.message);
      return;
    }

    const result = createCustomParameter(parsed.payload);
    if (result.committed) {
      setSelectedParameterId(parsed.payload.parameterId ?? null);
      setCreateOpen(false);
      setCreateForm(createInitialCreateForm(existingIds));
      return;
    }

    setLocalFeedback(result.diagnostics[0]?.message ?? "Custom parameter could not be created.");
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-[#151514]">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-neutral-50">Parameter Manager</h1>
          <p className="truncate text-xs text-neutral-500">
            Preset catalog, custom parameters, usage, and active parameter selection
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="inline-flex h-8 items-center gap-2 rounded border border-teal-700/70 bg-teal-950/40 px-2.5 text-xs font-semibold text-teal-100 transition hover:border-teal-400"
            onClick={openCreateFlow}
            type="button"
          >
            <Plus aria-hidden="true" size={15} strokeWidth={1.8} />
            <span>Custom</span>
          </button>
          <button
            aria-label="Close Parameter Manager"
            className="inline-flex size-8 items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-neutral-300 transition hover:border-amber-500/70 hover:text-amber-100"
            onClick={() => setActiveEntry("workspace")}
            type="button"
          >
            <X aria-hidden="true" size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {PARAMETER_MANAGER_GROUP_FILTERS.map((filter) => (
            <button
              aria-pressed={groupFilter === filter.id}
              className={cn(
                "h-7 rounded border px-2 text-xs font-medium transition",
                "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-teal-700/70 hover:text-teal-100",
                groupFilter === filter.id && "border-teal-600/70 bg-teal-950/30 text-teal-100"
              )}
              key={filter.id}
              onClick={() => setGroupFilter(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex h-8 min-w-56 items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-500 focus-within:border-teal-600">
          <Search aria-hidden="true" size={14} strokeWidth={1.8} />
          <span className="sr-only">Search parameters</span>
          <input
            aria-label="Search parameters"
            className="min-w-0 flex-1 bg-transparent text-neutral-100 outline-none placeholder:text-neutral-600"
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search"
            value={search}
          />
        </label>
      </div>

      {createOpen ? (
        <form
          className="grid gap-3 border-b border-neutral-800 bg-neutral-950/40 px-4 py-3 md:grid-cols-[1.2fr_1.3fr_repeat(4,0.7fr)_auto]"
          onSubmit={submitCreate}
        >
          <CompactInput
            label="Display name"
            onChange={(value) => {
              setCreateForm((current) => ({
                ...current,
                displayName: value,
                parameterId: current.idEdited
                  ? current.parameterId
                  : createSuggestedCustomParameterId(value, existingIds)
              }));
            }}
            value={createForm.displayName}
          />
          <CompactInput
            label="Stable id"
            onChange={(value) =>
              setCreateForm((current) => ({
                ...current,
                idEdited: true,
                parameterId: value
              }))
            }
            value={createForm.parameterId}
          />
          <CompactInput
            inputMode="decimal"
            label="Min"
            onChange={(value) => setCreateForm((current) => ({ ...current, min: value }))}
            value={createForm.min}
          />
          <CompactInput
            inputMode="decimal"
            label="Default"
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, defaultValue: value }))
            }
            value={createForm.defaultValue}
          />
          <CompactInput
            inputMode="decimal"
            label="Max"
            onChange={(value) => setCreateForm((current) => ({ ...current, max: value }))}
            value={createForm.max}
          />
          <CompactInput
            inputMode="decimal"
            label="UI step"
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, recommendedUiStep: value }))
            }
            value={createForm.recommendedUiStep}
          />
          <div className="flex items-end gap-2">
            <button
              className="inline-flex h-8 items-center gap-2 rounded border border-emerald-700/70 bg-emerald-950/40 px-2.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-400"
              type="submit"
            >
              <Check aria-hidden="true" size={14} strokeWidth={1.8} />
              Create
            </button>
            <button
              className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-600"
              onClick={() => setCreateOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(520px,1fr)_380px]">
        <div className="min-h-0 overflow-auto border-b border-neutral-800 xl:border-b-0 xl:border-r">
          <ParameterManagerTable
            activeParameterId={activeParameterId}
            onSelect={(parameterId) => setSelectedParameterId(parameterId)}
            rows={projection.filteredRows}
            selectedParameterId={selectedRow?.parameterId ?? null}
          />
        </div>
        <ParameterDetailsPanel
          activeParameterId={activeParameterId}
          feedback={localFeedback ?? parameterOperationFeedback}
          onDelete={(row) => {
            const result = deleteCustomParameter({ parameterId: row.parameterId });
            if (result.committed) {
              setSelectedParameterId(null);
              return;
            }

            setLocalFeedback(
              result.diagnostics[0]?.message ?? "Custom parameter could not be deleted."
            );
          }}
          onSetActive={(row) => {
            setLocalFeedback(setActiveParameterFromManager(row, setActiveParameterId));
          }}
          onUpdate={(payload) => {
            const result = updateCustomParameter(payload);
            if (!result.committed) {
              setLocalFeedback(
                result.diagnostics[0]?.message ?? "Custom parameter could not be updated."
              );
            }
          }}
          row={selectedRow}
          showUsage={showUsage}
          setShowUsage={setShowUsage}
        />
      </div>

      <ParameterCheckStrip projection={projection} />
    </section>
  );
}

export function ParameterManagerTable({
  activeParameterId,
  onSelect,
  rows,
  selectedParameterId
}: {
  readonly activeParameterId: ParameterId | null;
  readonly onSelect: (parameterId: ParameterId) => void;
  readonly rows: readonly ParameterManagerParameterRow[];
  readonly selectedParameterId: ParameterId | null;
}) {
  return (
    <table className="min-w-full table-fixed border-separate border-spacing-0 text-left text-xs">
      <thead className="sticky top-0 z-10 bg-[#181817] text-neutral-500">
        <tr>
          {PARAMETER_TABLE_COLUMNS.map((column) => (
            <th
              className="border-b border-neutral-800 px-3 py-2 font-semibold"
              key={column}
              scope="col"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-900">
        {rows.length === 0 ? (
          <tr>
            <td className="px-3 py-6 text-center text-neutral-500" colSpan={PARAMETER_TABLE_COLUMNS.length}>
              No parameters match the current filter.
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const selected = selectedParameterId === row.parameterId;
            const active = activeParameterId === row.parameterId;

            return (
              <tr
                className={cn(
                  "bg-[#151514] transition hover:bg-neutral-900/70",
                  selected && "bg-teal-950/20"
                )}
                key={row.parameterId}
              >
                <td className="w-[42%] px-3 py-2">
                  <button
                    className="flex min-w-0 items-center gap-2 text-left"
                    onClick={() => onSelect(row.parameterId)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        active ? "bg-emerald-400" : "bg-neutral-700"
                      )}
                    />
                    <span className="min-w-0 truncate font-medium text-neutral-100">
                      {row.displayName}
                    </span>
                  </button>
                </td>
                <td className="w-[18%] px-3 py-2 text-neutral-300">{row.kindLabel}</td>
                <td className="w-[24%] px-3 py-2 font-mono text-[11px] text-neutral-300">
                  {row.rangeLabel}
                </td>
                <td className="w-[16%] px-3 py-2 text-neutral-300">{row.usageCount}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

export function ParameterDetailsPanel({
  activeParameterId,
  feedback,
  onDelete,
  onSetActive,
  onUpdate,
  row,
  setShowUsage,
  showUsage
}: {
  readonly activeParameterId: ParameterId | null;
  readonly feedback: string | null;
  readonly onDelete: (row: ParameterManagerParameterRow) => void;
  readonly onSetActive: (row: ParameterManagerParameterRow) => void;
  readonly onUpdate: (payload: UpdateParameterPayloadDto) => void;
  readonly row: ParameterManagerParameterRow | null;
  readonly setShowUsage: (value: boolean) => void;
  readonly showUsage: boolean;
}) {
  const [editForm, setEditForm] = useState<EditFormState | null>(() =>
    row === null ? null : createEditForm(row)
  );
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setEditForm(row === null ? null : createEditForm(row));
    setEditError(null);
  }, [row]);

  if (row === null) {
    return (
      <aside className="min-h-0 overflow-auto p-4">
        <p className="text-xs text-neutral-500">Select a parameter to inspect details.</p>
      </aside>
    );
  }

  const active = activeParameterId === row.parameterId;
  const canDelete = row.kind === "custom" && row.usageCount === 0;

  const submitUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (row.kind !== "custom" || editForm === null) {
      return;
    }

    const parsed = parseEditForm(editForm, row);
    if (!parsed.ok) {
      setEditError(parsed.message);
      return;
    }

    if (!hasUpdateFields(parsed.payload)) {
      setEditError("No editable field changed.");
      return;
    }

    setEditError(null);
    onUpdate(parsed.payload);
  };

  return (
    <aside className="flex min-h-0 flex-col overflow-auto">
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-neutral-100">Parameter Details</h2>
            <p className="truncate text-xs text-neutral-500">{row.displayName}</p>
          </div>
          <span
            className={cn(
              "rounded border px-2 py-1 text-[11px] font-semibold",
              row.kind === "preset"
                ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                : "border-teal-700/70 bg-teal-950/30 text-teal-100"
            )}
          >
            {row.kindLabel}
          </span>
        </div>
        {feedback === null && editError === null ? null : (
          <p className="mt-2 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-300">
            {editError ?? feedback}
          </p>
        )}
      </div>

      <form className="flex flex-col gap-4 px-4 py-3" onSubmit={submitUpdate}>
        <button
          className={cn(
            "inline-flex h-8 items-center justify-center gap-2 rounded border px-2.5 text-xs font-semibold transition",
            active
              ? "border-emerald-700/70 bg-emerald-950/40 text-emerald-100"
              : "border-teal-700/70 bg-teal-950/30 text-teal-100 hover:border-teal-400"
          )}
          onClick={() => onSetActive(row)}
          type="button"
        >
          <Check aria-hidden="true" size={14} strokeWidth={1.8} />
          {active ? "Active in Parameter Bar" : "Set Active"}
        </button>

        {row.kind === "preset" ? (
          <PresetDetails row={row} />
        ) : (
          <CustomDetails editForm={editForm} row={row} setEditForm={setEditForm} />
        )}

        <section className="border-t border-neutral-800 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold uppercase text-neutral-500">Usage</h3>
              <p className="mt-1 text-xs text-neutral-300">{row.usageSummary}</p>
            </div>
            <button
              className="inline-flex h-8 items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2.5 text-xs font-medium text-neutral-300 transition hover:border-teal-700/70 hover:text-teal-100"
              onClick={() => setShowUsage(!showUsage)}
              type="button"
            >
              <ListChecks aria-hidden="true" size={14} strokeWidth={1.8} />
              View Usage
            </button>
          </div>
          {showUsage ? <UsageDetails row={row} /> : null}
        </section>

        {row.kind === "custom" ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3">
            <button
              className="inline-flex h-8 items-center gap-2 rounded border border-emerald-700/70 bg-emerald-950/40 px-2.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-400"
              type="submit"
            >
              <Check aria-hidden="true" size={14} strokeWidth={1.8} />
              Save Changes
            </button>
            <button
              className="inline-flex h-8 items-center gap-2 rounded border border-rose-800/70 bg-rose-950/25 px-2.5 text-xs font-semibold text-rose-100 transition hover:border-rose-500 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
              disabled={!canDelete}
              onClick={() => onDelete(row)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
              Delete
            </button>
            <p className="basis-full text-xs text-neutral-500">
              {canDelete
                ? "Delete is available because no keyforms or dynamics reference this custom parameter."
                : "Delete is disabled while keyforms or dynamics reference this custom parameter."}
            </p>
          </div>
        ) : (
          <p className="border-t border-neutral-800 pt-3 text-xs text-neutral-500">
            Preset parameters are catalog locked and cannot be deleted.
          </p>
        )}
      </form>
    </aside>
  );
}

function PresetDetails({ row }: { readonly row: ParameterManagerParameterRow }) {
  return (
    <section className="divide-y divide-neutral-800">
      <DetailsRow label="Stable id" value={row.parameterId} />
      <DetailsRow label="Role" value={row.presetRole ?? "locked preset role"} />
      <DetailsRow label="Group" value={`${row.groupLabel} locked`} />
      <DetailsRow label="Type" value={`${row.typeLabel} locked`} />
      <DetailsRow label="Range" value={`${row.rangeLabel} locked`} />
      <DetailsRow
        label="Sign convention"
        value={row.signConventionSummary ?? "Catalog sign convention locked"}
      />
      <p className="py-2 text-xs text-neutral-500">
        Role, group, range, type, stable id, and sign convention come from the preset catalog.
      </p>
    </section>
  );
}

function CustomDetails({
  editForm,
  row,
  setEditForm
}: {
  readonly editForm: EditFormState | null;
  readonly row: ParameterManagerParameterRow;
  readonly setEditForm: (updater: (current: EditFormState | null) => EditFormState | null) => void;
}) {
  if (editForm === null) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <CompactInput
        label="Display name"
        onChange={(value) =>
          setEditForm((current) => (current === null ? current : { ...current, displayName: value }))
        }
        value={editForm.displayName}
      />
      <DisabledField
        label="Stable id"
        reason="Stable id refactor requires reference migration and is not supported by Domain A v0."
        value={row.parameterId}
      />
      <DisabledField
        label="Type"
        reason="Domain A v0 supports scalar parameters only."
        value={row.typeLabel}
      />
      <DisabledField
        label="Role"
        reason="Custom parameters do not carry preset roles; external mappings belong to facade work."
        value="none"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactInput
          inputMode="decimal"
          label="Min"
          onChange={(value) =>
            setEditForm((current) => (current === null ? current : { ...current, min: value }))
          }
          value={editForm.min}
        />
        <CompactInput
          inputMode="decimal"
          label="Default"
          onChange={(value) =>
            setEditForm((current) =>
              current === null ? current : { ...current, defaultValue: value }
            )
          }
          value={editForm.defaultValue}
        />
        <CompactInput
          inputMode="decimal"
          label="Max"
          onChange={(value) =>
            setEditForm((current) => (current === null ? current : { ...current, max: value }))
          }
          value={editForm.max}
        />
        <CompactInput
          inputMode="decimal"
          label="UI step"
          onChange={(value) =>
            setEditForm((current) =>
              current === null ? current : { ...current, recommendedUiStep: value }
            )
          }
          value={editForm.recommendedUiStep}
        />
      </div>
      <button
        className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2.5 text-left text-xs font-medium text-neutral-600"
        disabled
        type="button"
      >
        Refactor stable id disabled: reference migration is not part of Domain A v0.
      </button>
    </section>
  );
}

function UsageDetails({ row }: { readonly row: ParameterManagerParameterRow }) {
  if (row.usageItems.length === 0) {
    return <p className="mt-3 text-xs text-neutral-500">No keyforms or dynamics reference this parameter.</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-neutral-800 border-t border-neutral-800">
      {row.usageItems.map((item, index) => (
        <li className="py-2 text-xs text-neutral-300" key={`${item.targetLabel}-${index}`}>
          <div className="font-medium text-neutral-200">{item.targetLabel}</div>
          <div className="mt-1 text-neutral-500">
            {item.propertyLabel} / {item.detailLabel}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ParameterCheckStrip({
  projection
}: {
  readonly projection: ParameterManagerProjection;
}) {
  if (projection.checks.length === 0) {
    return (
      <div className="border-t border-neutral-800 px-4 py-2 text-xs text-neutral-500">
        No parameter warnings or errors.
      </div>
    );
  }

  const first = projection.checks[0];

  return (
    <div
      className={cn(
        "flex min-h-10 items-center justify-between gap-3 border-t px-4 py-2 text-xs",
        projection.errorCount > 0
          ? "border-rose-900/70 bg-rose-950/20 text-rose-100"
          : "border-amber-900/70 bg-amber-950/20 text-amber-100"
      )}
    >
      <span>
        {projection.errorCount > 0 ? `${projection.errorCount} error` : `${projection.warningCount} warning`}
        {projection.errorCount + projection.warningCount === 1 ? "" : "s"}: {first?.message}
      </span>
      <span className="shrink-0 text-neutral-500">Review</span>
    </div>
  );
}

function CompactInput({
  inputMode,
  label,
  onChange,
  value
}: {
  readonly inputMode?: "decimal" | "text";
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-500">
      {label}
      <input
        aria-label={label}
        className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
        inputMode={inputMode}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </label>
  );
}

function DisabledField({
  label,
  reason,
  value
}: {
  readonly label: string;
  readonly reason: string;
  readonly value: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-500">
      {label}
      <input
        aria-label={label}
        className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-500"
        disabled
        value={value}
      />
      <span>{reason}</span>
    </label>
  );
}

function DetailsRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="grid min-h-9 grid-cols-[7rem_1fr] gap-3 py-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="min-w-0 break-words text-xs font-medium text-neutral-200">{value}</span>
    </div>
  );
}

function createInitialCreateForm(existingIds: ReadonlySet<string>): CreateFormState {
  return {
    displayName: DEFAULT_CUSTOM_PARAMETER_NAME,
    parameterId: createSuggestedCustomParameterId(DEFAULT_CUSTOM_PARAMETER_NAME, existingIds),
    min: "0",
    defaultValue: "0",
    max: "1",
    recommendedUiStep: "0.01",
    idEdited: false
  };
}

function createEditForm(row: ParameterManagerParameterRow): EditFormState {
  return {
    displayName: row.displayName,
    min: formatParameterNumber(row.parameter.min),
    defaultValue: formatParameterNumber(row.parameter.default),
    max: formatParameterNumber(row.parameter.max),
    recommendedUiStep: formatParameterNumber(row.parameter.recommendedUiStep)
  };
}

function parseCreateForm(
  form: CreateFormState,
  existingIds: ReadonlySet<string>
):
  | { readonly ok: true; readonly payload: CreateParameterPayloadDto }
  | { readonly ok: false; readonly message: string } {
  const displayName = form.displayName.trim();
  if (displayName.length === 0) {
    return { ok: false, message: "Display name is required." };
  }

  const parameterId = parseParameterIdInput(form.parameterId);
  if (!parameterId.ok) {
    return parameterId;
  }
  if (existingIds.has(parameterId.parameterId)) {
    return { ok: false, message: "Stable id already exists." };
  }

  const range = parseRange(form);
  if (!range.ok) {
    return range;
  }

  return {
    ok: true,
    payload: {
      parameterId: parameterId.parameterId,
      displayName,
      valueSource: "authoredInput",
      min: range.min,
      default: range.defaultValue,
      max: range.max,
      recommendedUiStep: range.recommendedUiStep
    }
  };
}

function parseEditForm(
  form: EditFormState,
  row: ParameterManagerParameterRow
):
  | { readonly ok: true; readonly payload: ParameterUpdateDraft }
  | { readonly ok: false; readonly message: string } {
  const displayName = form.displayName.trim();
  if (displayName.length === 0) {
    return { ok: false, message: "Display name is required." };
  }

  const range = parseRange(form);
  if (!range.ok) {
    return range;
  }

  const payload: ParameterUpdateDraft = {
    parameterId: row.parameterId
  };
  if (displayName !== row.displayName) {
    payload.displayName = displayName;
  }
  if (range.min !== row.parameter.min) {
    payload.min = range.min;
  }
  if (range.defaultValue !== row.parameter.default) {
    payload.default = range.defaultValue;
  }
  if (range.max !== row.parameter.max) {
    payload.max = range.max;
  }
  if (range.recommendedUiStep !== row.parameter.recommendedUiStep) {
    payload.recommendedUiStep = range.recommendedUiStep;
  }

  return { ok: true, payload };
}

function parseRange(form: {
  readonly min: string;
  readonly defaultValue: string;
  readonly max: string;
  readonly recommendedUiStep: string;
}):
  | {
      readonly ok: true;
      readonly min: number;
      readonly defaultValue: number;
      readonly max: number;
      readonly recommendedUiStep: number;
    }
  | { readonly ok: false; readonly message: string } {
  const min = parseFiniteNumber("Min", form.min);
  const defaultValue = parseFiniteNumber("Default", form.defaultValue);
  const max = parseFiniteNumber("Max", form.max);
  const recommendedUiStep = parseFiniteNumber("UI step", form.recommendedUiStep);
  const invalid = [min, defaultValue, max, recommendedUiStep].find((field) => !field.ok);
  if (invalid !== undefined && !invalid.ok) {
    return invalid;
  }
  if (!min.ok || !defaultValue.ok || !max.ok || !recommendedUiStep.ok) {
    return { ok: false, message: "Range values must be finite numbers." };
  }
  if (min.value > max.value) {
    return { ok: false, message: "Min must be less than or equal to max." };
  }
  if (defaultValue.value < min.value || defaultValue.value > max.value) {
    return { ok: false, message: "Default must be inside the range." };
  }
  if (recommendedUiStep.value <= 0) {
    return { ok: false, message: "UI step must be greater than zero." };
  }

  return {
    ok: true,
    min: min.value,
    defaultValue: defaultValue.value,
    max: max.value,
    recommendedUiStep: recommendedUiStep.value
  };
}

function parseFiniteNumber(label: string, value: string):
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string } {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? { ok: true, value: parsed }
    : { ok: false, message: `${label} must be a finite number.` };
}

function hasUpdateFields(payload: ParameterUpdateDraft): payload is UpdateParameterPayloadDto {
  return (
    payload.displayName !== undefined ||
    payload.min !== undefined ||
    payload.max !== undefined ||
    payload.default !== undefined ||
    payload.recommendedUiStep !== undefined
  );
}

export function setActiveParameterFromManager(
  row: ParameterManagerParameterRow,
  setActiveParameterId: (parameterId: ParameterId) => void
): string {
  setActiveParameterId(row.parameterId);
  return `${row.displayName} is active in the Parameter Bar.`;
}
