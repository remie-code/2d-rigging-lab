import type {
  SetVariantDefaultActiveSelectionPayloadDto,
  UpdateVariantGroupPayloadDto
} from "@private-2d-rigging-lab/operation-core";
import type { AuthoringSession, VariantActiveSelectionEntry } from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import { createInitialCollapsedPartIds } from "../../features/editor-session/model/part-tree-collapse-state";
import {
  createSuggestedVariantGroupId,
  createSuggestedVariantId,
  createSuggestedVariantName,
  createVariantDrawablePickerProjection,
  createVariantManagerProjection,
  formatActiveSelectionLabel,
  formatVariantGroupMode,
  type VariantDrawablePickerRow
} from "../../features/variants/model/variant-manager-projection";
import { resolveVariantPreviewActiveSelection } from "../../features/variants/model/variant-preview-state";
import { cn } from "../../lib/class-name";
import { useEditorUiStore } from "../../state/editor-ui-store";
import { IconButton } from "../../ui/icon-button";
import { CanvasPreviewPanel } from "../panels/canvas-preview-panel";

type VariantGroup = NonNullable<AuthoringSession["graph"]["variantGroups"]>[number];
type Variant = VariantGroup["variants"][number];
type VariantGroupMode = VariantGroup["mode"];
type VariantGroupId = VariantGroup["variantGroupId"];
type VariantId = Variant["variantId"];
type VariantDefaultActiveSelection = SetVariantDefaultActiveSelectionPayloadDto["defaultActive"];

type GroupFormState = {
  readonly displayName: string;
  readonly mode: VariantGroupMode;
};

type VariantNameDrafts = Readonly<Record<string, string>>;

const DEFAULT_GROUP_NAME = "Expression";

export function VariantManagerScreen() {
  const {
    addVariantTargetDrawable,
    createVariant,
    createVariantGroup,
    deleteVariant,
    deleteVariantGroup,
    removeVariantTargetDrawable,
    resetVariantPreviewActiveSelections,
    session,
    setVariantDefaultActiveSelection,
    setVariantMembership,
    setVariantPreviewActiveSelection,
    updateVariant,
    updateVariantGroup,
    variantPreviewActiveSelections
  } = useEditorSession();
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const [selectedGroupId, setSelectedGroupId] = useState<VariantGroupId | null>(null);
  const [createForm, setCreateForm] = useState<GroupFormState>({
    displayName: DEFAULT_GROUP_NAME,
    mode: "singleSelect"
  });
  const [groupForm, setGroupForm] = useState<GroupFormState | null>(null);
  const [variantNameDrafts, setVariantNameDrafts] = useState<VariantNameDrafts>({});
  const [newVariantName, setNewVariantName] = useState("Variant 2");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCollapsedPartIds, setPickerCollapsedPartIds] = useState<ReadonlySet<PartId>>(
    () => createInitialCollapsedPartIds(session)
  );
  const [pickerSelectedDrawableIds, setPickerSelectedDrawableIds] = useState<ReadonlySet<DrawableId>>(
    () => new Set()
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const projection = useMemo(
    () => createVariantManagerProjection(session, { selectedGroupId }),
    [selectedGroupId, session]
  );
  const selectedGroup = projection.selectedGroup;
  const previewSelection = selectedGroup === null
    ? null
    : resolveVariantPreviewActiveSelection(
        session.graph.variantGroups ?? [],
        variantPreviewActiveSelections,
        selectedGroup.variantGroupId
      );

  useEffect(() => {
    if (projection.selectedGroupId !== selectedGroupId) {
      setSelectedGroupId(projection.selectedGroupId);
    }
  }, [projection.selectedGroupId, selectedGroupId]);

  useEffect(() => {
    if (selectedGroup === null) {
      setGroupForm(null);
      setVariantNameDrafts({});
      return;
    }

    setGroupForm({
      displayName: selectedGroup.displayName,
      mode: selectedGroup.mode
    });
    setVariantNameDrafts(
      Object.fromEntries(
        selectedGroup.variants.map((variant) => [variant.variantId, variant.displayName])
      )
    );
    setNewVariantName(createSuggestedVariantName(selectedGroup));
    setPickerOpen(false);
    setPickerSelectedDrawableIds(new Set());
    setFeedback(null);
  }, [selectedGroup]);

  const submitCreateGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const displayName = createForm.displayName.trim();
    if (displayName.length === 0) {
      setFeedback("Group name is required.");
      return;
    }

    const variantGroupId = createSuggestedVariantGroupId(session, displayName);
    const result = createVariantGroup({
      variantGroupId,
      displayName,
      mode: createForm.mode
    });
    if (result.committed) {
      setSelectedGroupId(variantGroupId);
      setFeedback(null);
      return;
    }

    setFeedback(result.diagnostics[0]?.message ?? "Variant Group could not be created.");
  };

  const submitGroupUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedGroup === null || groupForm === null) {
      return;
    }

    const payload: UpdateVariantGroupPayloadDto = {
      variantGroupId: selectedGroup.variantGroupId,
      ...(groupForm.displayName.trim() !== selectedGroup.displayName
        ? { displayName: groupForm.displayName.trim() }
        : {}),
      ...(groupForm.mode !== selectedGroup.mode ? { mode: groupForm.mode } : {})
    };
    if (payload.displayName === undefined && payload.mode === undefined) {
      setFeedback("No Variant Group change was applied.");
      return;
    }

    const result = updateVariantGroup(payload);
    setFeedback(result.committed
      ? null
      : result.diagnostics[0]?.message ?? "Variant Group could not be updated.");
  };

  const submitCreateVariant = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedGroup === null) {
      return;
    }

    const displayName = newVariantName.trim();
    if (displayName.length === 0) {
      setFeedback("Variant name is required.");
      return;
    }

    const result = createVariant({
      variantGroupId: selectedGroup.variantGroupId,
      variantId: createSuggestedVariantId(session, displayName),
      displayName
    });
    setFeedback(result.committed
      ? null
      : result.diagnostics[0]?.message ?? "Variant could not be created.");
  };

  const backToWorkspace = () => setActiveEntry("workspace");

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-[#111110]"
      data-testid="variant-manager-screen"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton
            className="size-8 shrink-0"
            label="Back to Authoring Workspace"
            onClick={backToWorkspace}
            tooltipSide="bottom"
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          </IconButton>
          <div className="h-6 w-px shrink-0 bg-neutral-800" />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-teal-700/70 bg-teal-950/30 text-teal-100">
            <Layers aria-hidden="true" size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase text-neutral-500">
              Variants
            </div>
            <h1 className="truncate text-sm font-semibold text-neutral-50">
              Variant / Expression Manager
            </h1>
          </div>
        </div>
        <button
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2.5 text-xs font-semibold text-neutral-300 transition hover:border-teal-700/70 hover:text-teal-100"
          onClick={resetVariantPreviewActiveSelections}
          type="button"
        >
          <X aria-hidden="true" size={14} strokeWidth={1.8} />
          Reset Preview
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_minmax(20rem,36%)] overflow-hidden xl:grid-cols-[260px_minmax(0,1fr)_minmax(320px,38%)] xl:grid-rows-1">
        <aside className="min-h-0 overflow-auto border-b border-neutral-800 bg-[#151514] p-3 xl:border-b-0 xl:border-r">
          <form className="grid gap-2" onSubmit={submitCreateGroup}>
            <label className="grid gap-1 text-xs text-neutral-500">
              Group
              <input
                className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
                onChange={(event) => {
                  const displayName = event.currentTarget.value;
                  setCreateForm((current) => ({
                    ...current,
                    displayName
                  }));
                }}
                value={createForm.displayName}
              />
            </label>
            <label className="grid gap-1 text-xs text-neutral-500">
              Mode
              <select
                className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
                onChange={(event) => {
                  const mode = event.currentTarget.value as VariantGroupMode;
                  setCreateForm((current) => ({
                    ...current,
                    mode
                  }));
                }}
                value={createForm.mode}
              >
                <option value="singleSelect">Single select</option>
                <option value="multiToggle">Multi toggle</option>
              </select>
            </label>
            <button
              className="inline-flex h-8 items-center justify-center gap-2 rounded border border-teal-700/70 bg-teal-950/40 px-2.5 text-xs font-semibold text-teal-100 transition hover:border-teal-400"
              type="submit"
            >
              <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
              New Group
            </button>
          </form>

          <div className="mt-3 divide-y divide-neutral-800 overflow-hidden rounded border border-neutral-800">
            {projection.groupRows.length === 0 ? (
              <div className="bg-neutral-950/45 px-3 py-4 text-xs text-neutral-500">
                No Variant Groups.
              </div>
            ) : (
              projection.groupRows.map((row) => (
                <button
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2 text-left text-xs transition",
                    row.selected
                      ? "bg-teal-950/35 text-teal-100"
                      : "bg-neutral-950/35 text-neutral-300 hover:bg-neutral-900/70"
                  )}
                  key={row.variantGroupId}
                  onClick={() => setSelectedGroupId(row.variantGroupId)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{row.displayName}</span>
                    <span className="mt-0.5 block text-[11px] text-neutral-500">
                      {row.modeLabel}
                    </span>
                  </span>
                  <span className="text-right text-[11px] text-neutral-500">
                    {row.variantCount} / {row.targetDrawableCount}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="min-h-0 overflow-auto bg-[#131312]">
          {selectedGroup === null || groupForm === null ? (
            <div className="grid min-h-full place-items-center p-6 text-center text-xs text-neutral-500">
              Existing workspace has no Variant Groups.
            </div>
          ) : (
            <div className="grid gap-4 p-4">
              <form
                className="grid gap-3 rounded-md border border-neutral-800 bg-neutral-950/35 p-3 md:grid-cols-[minmax(12rem,1fr)_12rem_auto_auto]"
                onSubmit={submitGroupUpdate}
              >
                <label className="grid gap-1 text-xs text-neutral-500">
                  Group name
                  <input
                    className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
                    onChange={(event) => {
                      const displayName = event.currentTarget.value;
                      setGroupForm((current) =>
                        current === null ? current : {
                          ...current,
                          displayName
                        }
                      );
                    }}
                    value={groupForm.displayName}
                  />
                </label>
                <label className="grid gap-1 text-xs text-neutral-500">
                  Mode
                  <select
                    className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
                    onChange={(event) => {
                      const mode = event.currentTarget.value as VariantGroupMode;
                      setGroupForm((current) =>
                        current === null ? current : {
                          ...current,
                          mode
                        }
                      );
                    }}
                    value={groupForm.mode}
                  >
                    <option disabled={selectedGroup.variants.length === 0} value="singleSelect">
                      Single select
                    </option>
                    <option value="multiToggle">Multi toggle</option>
                  </select>
                </label>
                <button
                  className="inline-flex h-8 items-center justify-center gap-2 self-end rounded border border-emerald-700/70 bg-emerald-950/40 px-2.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-400"
                  type="submit"
                >
                  <Check aria-hidden="true" size={14} strokeWidth={1.8} />
                  Save Group
                </button>
                <button
                  className="inline-flex h-8 items-center justify-center gap-2 self-end rounded border border-rose-800/70 bg-rose-950/30 px-2.5 text-xs font-semibold text-rose-100 transition hover:border-rose-500"
                  onClick={() => {
                    const result = deleteVariantGroup({
                      variantGroupId: selectedGroup.variantGroupId
                    });
                    if (result.committed) {
                      setSelectedGroupId(null);
                    }
                    setFeedback(result.committed
                      ? null
                      : result.diagnostics[0]?.message ?? "Variant Group could not be deleted.");
                  }}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
                  Delete Group
                </button>
              </form>

              <section className="rounded-md border border-neutral-800 bg-neutral-950/35">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
                  <h2 className="text-sm font-semibold text-neutral-100">Variants</h2>
                  <form className="flex min-w-0 items-center gap-2" onSubmit={submitCreateVariant}>
                    <input
                      aria-label="New Variant name"
                      className="h-8 min-w-40 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
                      onChange={(event) => {
                        const displayName = event.currentTarget.value;
                        setNewVariantName(displayName);
                      }}
                      value={newVariantName}
                    />
                    <button
                      className="inline-flex h-8 items-center gap-2 rounded border border-teal-700/70 bg-teal-950/40 px-2.5 text-xs font-semibold text-teal-100 transition hover:border-teal-400"
                      type="submit"
                    >
                      <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
                      Variant
                    </button>
                  </form>
                </div>
                <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedGroup.variants.length === 0 ? (
                    <div className="text-xs text-neutral-500">No Variants.</div>
                  ) : (
                    selectedGroup.variants.map((variant) => (
                      <VariantNameEditor
                        canDelete={
                          selectedGroup.mode !== "singleSelect" ||
                          selectedGroup.variants.length > 1
                        }
                        group={selectedGroup}
                        key={variant.variantId}
                        onDelete={(target) => {
                          const result = deleteVariant({
                            variantGroupId: selectedGroup.variantGroupId,
                            variantId: target.variantId
                          });
                          setFeedback(result.committed
                            ? null
                            : result.diagnostics[0]?.message ?? "Variant could not be deleted.");
                        }}
                        onRename={(target, displayName) => {
                          if (displayName === target.displayName) {
                            return;
                          }
                          const result = updateVariant({
                            variantGroupId: selectedGroup.variantGroupId,
                            variantId: target.variantId,
                            displayName
                          });
                          setFeedback(result.committed
                            ? null
                            : result.diagnostics[0]?.message ?? "Variant could not be renamed.");
                        }}
                        setVariantNameDrafts={setVariantNameDrafts}
                        variant={variant}
                        variantNameDraft={variantNameDrafts[variant.variantId] ?? variant.displayName}
                      />
                    ))
                  )}
                </div>
              </section>

              <ActiveSelectionEditors
                group={selectedGroup}
                previewSelection={previewSelection}
                setVariantDefaultActiveSelection={(defaultActive) => {
                  const result = setVariantDefaultActiveSelection({
                    variantGroupId: selectedGroup.variantGroupId,
                    defaultActive
                  });
                  setFeedback(result.committed
                    ? null
                    : result.diagnostics[0]?.message ?? "Default active selection could not be saved.");
                }}
                setVariantPreviewActiveSelection={(activeSelection) =>
                  setVariantPreviewActiveSelection({
                    variantGroupId: selectedGroup.variantGroupId,
                    activeSelection
                  })
                }
              />

              <section className="rounded-md border border-neutral-800 bg-neutral-950/35">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-neutral-100">Target Drawables</h2>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {projection.targetRows.length} targets / {selectedGroup.variants.length} variants
                    </p>
                  </div>
                  <button
                    className="inline-flex h-8 items-center gap-2 rounded border border-teal-700/70 bg-teal-950/40 px-2.5 text-xs font-semibold text-teal-100 transition hover:border-teal-400"
                    onClick={() => {
                      setPickerOpen(!pickerOpen);
                      setPickerCollapsedPartIds(createInitialCollapsedPartIds(session));
                      setPickerSelectedDrawableIds(new Set());
                    }}
                    type="button"
                  >
                    <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
                    Add Drawables
                  </button>
                </div>
                {pickerOpen ? (
                  <VariantDrawablePicker
                    collapsedPartIds={pickerCollapsedPartIds}
                    onAddSelected={(drawableIds) => {
                      let firstFailure: string | null = null;
                      for (const drawableId of drawableIds) {
                        const result = addVariantTargetDrawable({
                          variantGroupId: selectedGroup.variantGroupId,
                          drawableId
                        });
                        if (!result.committed && firstFailure === null) {
                          firstFailure = result.diagnostics[0]?.message ?? "Drawable could not be added.";
                        }
                      }
                      setPickerSelectedDrawableIds(new Set());
                      setFeedback(firstFailure);
                    }}
                    onTogglePart={(partId) =>
                      setPickerCollapsedPartIds((current) => {
                        const next = new Set(current);
                        if (next.has(partId)) {
                          next.delete(partId);
                        } else {
                          next.add(partId);
                        }
                        return next;
                      })
                    }
                    onToggleSelection={(drawableId) =>
                      setPickerSelectedDrawableIds((current) => {
                        const next = new Set(current);
                        if (next.has(drawableId)) {
                          next.delete(drawableId);
                        } else {
                          next.add(drawableId);
                        }
                        return next;
                      })
                    }
                    selectedDrawableIds={pickerSelectedDrawableIds}
                    session={session}
                    variantGroupId={selectedGroup.variantGroupId}
                  />
                ) : null}
                <MembershipMatrix
                  group={selectedGroup}
                  onRemoveTarget={(drawableId) => {
                    const result = removeVariantTargetDrawable({
                      variantGroupId: selectedGroup.variantGroupId,
                      drawableId
                    });
                    setFeedback(result.committed
                      ? null
                      : result.diagnostics[0]?.message ?? "Drawable could not be removed.");
                  }}
                  onSetMembership={(drawableId, variantId, member) => {
                    const result = setVariantMembership({
                      variantGroupId: selectedGroup.variantGroupId,
                      drawableId,
                      variantId,
                      member
                    });
                    setFeedback(result.committed
                      ? null
                      : result.diagnostics[0]?.message ?? "Membership could not be updated.");
                  }}
                  rows={projection.targetRows}
                />
              </section>
            </div>
          )}
        </main>

        <div className="min-h-0 border-t border-neutral-800 p-2 xl:border-l xl:border-t-0">
          <CanvasPreviewPanel />
        </div>
      </div>

      <VariantCheckStrip
        checks={projection.checks}
        errorCount={projection.errorCount}
        feedback={feedback}
        warningCount={projection.warningCount}
      />
    </section>
  );
}

function VariantNameEditor({
  canDelete,
  group,
  onDelete,
  onRename,
  setVariantNameDrafts,
  variant,
  variantNameDraft
}: {
  readonly canDelete: boolean;
  readonly group: VariantGroup;
  readonly onDelete: (variant: Variant) => void;
  readonly onRename: (variant: Variant, displayName: string) => void;
  readonly setVariantNameDrafts: (
    updater: (current: VariantNameDrafts) => VariantNameDrafts
  ) => void;
  readonly variant: Variant;
  readonly variantNameDraft: string;
}) {
  const lockedReason = group.mode === "singleSelect" && !canDelete
    ? "Last Variant delete is blocked."
    : undefined;

  return (
    <div className="grid gap-2 rounded border border-neutral-800 bg-neutral-950/45 p-2">
      <label className="grid gap-1 text-xs text-neutral-500">
        Variant
        <input
          className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
          onBlur={() => onRename(variant, variantNameDraft.trim())}
          onChange={(event) => {
            const displayName = event.currentTarget.value;
            setVariantNameDrafts((current) => ({
              ...current,
              [variant.variantId]: displayName
            }));
          }}
          value={variantNameDraft}
        />
      </label>
      <button
        className="inline-flex h-8 items-center justify-center gap-2 rounded border border-rose-800/70 bg-rose-950/30 px-2.5 text-xs font-semibold text-rose-100 transition hover:border-rose-500 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
        disabled={!canDelete}
        onClick={() => onDelete(variant)}
        title={lockedReason}
        type="button"
      >
        <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
        Delete
      </button>
    </div>
  );
}

function ActiveSelectionEditors({
  group,
  previewSelection,
  setVariantDefaultActiveSelection,
  setVariantPreviewActiveSelection
}: {
  readonly group: VariantGroup;
  readonly previewSelection: VariantDefaultActiveSelection | null;
  readonly setVariantDefaultActiveSelection: (selection: VariantDefaultActiveSelection) => void;
  readonly setVariantPreviewActiveSelection: (selection: VariantActiveSelectionEntry["activeSelection"]) => void;
}) {
  return (
    <section className="grid gap-3 rounded-md border border-neutral-800 bg-neutral-950/35 p-3 lg:grid-cols-2">
      <div>
        <h2 className="text-sm font-semibold text-neutral-100">Default active</h2>
        <p className="mt-1 text-xs text-neutral-500">
          {formatActiveSelectionLabel(group, group.defaultActive)}
        </p>
        <SelectionInput
          group={group}
          selection={group.defaultActive}
          setSelection={setVariantDefaultActiveSelection}
        />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-neutral-100">Preview active</h2>
        <p className="mt-1 text-xs text-neutral-500">
          {previewSelection === null ? "None" : formatActiveSelectionLabel(group, previewSelection)}
        </p>
        <SelectionInput
          group={group}
          selection={previewSelection ?? group.defaultActive}
          setSelection={setVariantPreviewActiveSelection}
        />
      </div>
    </section>
  );
}

function SelectionInput({
  group,
  selection,
  setSelection
}: {
  readonly group: VariantGroup;
  readonly selection: VariantDefaultActiveSelection;
  readonly setSelection: (selection: VariantDefaultActiveSelection) => void;
}) {
  if (group.mode === "singleSelect") {
    return (
      <select
        className="mt-2 h-8 w-full rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
        onChange={(event) => {
          const variantId = event.currentTarget.value as VariantId;
          setSelection({
            kind: "singleSelect",
            variantId
          });
        }}
        value={selection.kind === "singleSelect" ? selection.variantId : group.variants[0]?.variantId}
      >
        {group.variants.map((variant) => (
          <option key={variant.variantId} value={variant.variantId}>
            {variant.displayName}
          </option>
        ))}
      </select>
    );
  }

  const selectedIds = new Set(selection.kind === "multiToggle" ? selection.variantIds : []);
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {group.variants.map((variant) => (
        <label
          className="inline-flex h-8 items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-200"
          key={variant.variantId}
        >
          <input
            checked={selectedIds.has(variant.variantId)}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              const nextIds = new Set(selectedIds);
              if (checked) {
                nextIds.add(variant.variantId);
              } else {
                nextIds.delete(variant.variantId);
              }
              setSelection({
                kind: "multiToggle",
                variantIds: [...nextIds]
              });
            }}
            type="checkbox"
          />
          {variant.displayName}
        </label>
      ))}
    </div>
  );
}

function VariantDrawablePicker({
  collapsedPartIds,
  onAddSelected,
  onTogglePart,
  onToggleSelection,
  selectedDrawableIds,
  session,
  variantGroupId
}: {
  readonly collapsedPartIds: ReadonlySet<PartId>;
  readonly onAddSelected: (drawableIds: readonly DrawableId[]) => void;
  readonly onTogglePart: (partId: PartId) => void;
  readonly onToggleSelection: (drawableId: DrawableId) => void;
  readonly selectedDrawableIds: ReadonlySet<DrawableId>;
  readonly session: AuthoringSession;
  readonly variantGroupId: VariantGroupId;
}) {
  const projection = useMemo(
    () =>
      createVariantDrawablePickerProjection(session, {
        variantGroupId,
        collapsedPartIds,
        selectedDrawableIds
      }),
    [collapsedPartIds, selectedDrawableIds, session, variantGroupId]
  );
  const selectedIds = projection.rows
    .filter((row): row is Extract<VariantDrawablePickerRow, { readonly kind: "drawable" }> =>
      row.kind === "drawable" && row.selected
    )
    .map((row) => row.drawableId);

  return (
    <div className="border-b border-neutral-800 bg-[#121211] p-3" data-testid="variant-drawable-picker">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>
          eligible {projection.eligibleCount} / total {projection.totalDrawableCount}
        </span>
        <button
          className="inline-flex h-8 items-center gap-2 rounded border border-emerald-700/70 bg-emerald-950/40 px-2.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
          disabled={selectedIds.length === 0}
          onClick={() => onAddSelected(selectedIds)}
          type="button"
        >
          <Check aria-hidden="true" size={14} strokeWidth={1.8} />
          Add selected
        </button>
      </div>
      <div className="max-h-72 overflow-auto rounded border border-neutral-800" role="tree">
        {projection.rows.map((row) =>
          row.kind === "part" ? (
            <button
              className="grid min-h-8 w-full grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-neutral-900 bg-neutral-950/45 px-2 text-left text-xs text-neutral-300"
              key={`part:${row.partId}`}
              onClick={() => row.canCollapse && onTogglePart(row.partId)}
              role="treeitem"
              style={{ paddingLeft: `${8 + row.depth * 14}px` }}
              type="button"
            >
              <span className="flex size-5 items-center justify-center text-neutral-500">
                {row.canCollapse ? (
                  row.collapsed ? (
                    <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
                  ) : (
                    <ChevronDown aria-hidden="true" size={14} strokeWidth={1.8} />
                  )
                ) : null}
              </span>
              <Folder aria-hidden="true" className="text-neutral-500" size={14} strokeWidth={1.8} />
              <span className="min-w-0 truncate font-semibold">{row.displayName}</span>
              <span className="text-[11px] text-neutral-500">
                eligible {row.eligibleCount} / total {row.totalCount}
              </span>
            </button>
          ) : (
            <label
              className={cn(
                "grid min-h-8 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-neutral-900 bg-neutral-950/25 px-2 text-xs",
                row.selectable ? "text-neutral-200" : "text-neutral-600"
              )}
              key={`drawable:${row.drawableId}`}
              style={{ paddingLeft: `${8 + row.depth * 14}px` }}
            >
              <input
                checked={row.checked}
                disabled={!row.selectable}
                onChange={() => onToggleSelection(row.drawableId)}
                type="checkbox"
              />
              <Layers aria-hidden="true" size={14} strokeWidth={1.8} />
              <span className="min-w-0 truncate">{row.displayName}</span>
              <span className="text-[11px] text-neutral-500">
                {row.ownerGroupName === undefined
                  ? row.eligibilityLabel
                  : `${row.eligibilityLabel}: ${row.ownerGroupName}`}
              </span>
            </label>
          )
        )}
      </div>
    </div>
  );
}

function MembershipMatrix({
  group,
  onRemoveTarget,
  onSetMembership,
  rows
}: {
  readonly group: VariantGroup;
  readonly onRemoveTarget: (drawableId: DrawableId) => void;
  readonly onSetMembership: (drawableId: DrawableId, variantId: VariantId, member: boolean) => void;
  readonly rows: ReturnType<typeof createVariantManagerProjection>["targetRows"];
}) {
  const columnCount = group.variants.length + 2;

  return (
    <div className="overflow-auto">
      <table className="min-w-full table-fixed border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-10 bg-[#181817] text-neutral-500">
          <tr>
            <th className="w-52 border-b border-neutral-800 px-3 py-2 font-semibold" scope="col">
              Drawable
            </th>
            {group.variants.map((variant) => (
              <th
                className="w-32 border-b border-neutral-800 px-3 py-2 text-center font-semibold"
                key={variant.variantId}
                scope="col"
              >
                {variant.displayName}
              </th>
            ))}
            <th className="w-24 border-b border-neutral-800 px-3 py-2 font-semibold" scope="col">
              Remove
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900">
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-neutral-500" colSpan={columnCount}>
                No target Drawables.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="bg-[#151514]" key={row.drawableId}>
                <td className="px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-neutral-100">{row.displayName}</div>
                    <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                      {row.partLabel}
                    </div>
                  </div>
                </td>
                {group.variants.map((variant) => {
                  const member = row.memberships.find((candidate) =>
                    candidate.variantId === variant.variantId
                  )?.member ?? false;
                  return (
                    <td className="px-3 py-2 text-center" key={variant.variantId}>
                      <input
                        aria-label={`${row.displayName} in ${variant.displayName}`}
                        checked={member}
                        onChange={(event) => {
                          const member = event.currentTarget.checked;
                          onSetMembership(
                            row.drawableId,
                            variant.variantId,
                            member
                          );
                        }}
                        type="checkbox"
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <button
                    aria-label={`Remove ${row.displayName}`}
                    className="inline-flex size-8 items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-rose-100 transition hover:border-rose-500"
                    onClick={() => onRemoveTarget(row.drawableId)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function VariantCheckStrip({
  checks,
  errorCount,
  feedback,
  warningCount
}: {
  readonly checks: ReturnType<typeof createVariantManagerProjection>["checks"];
  readonly errorCount: number;
  readonly feedback: string | null;
  readonly warningCount: number;
}) {
  if (feedback !== null) {
    return (
      <div className="border-t border-amber-900/70 bg-amber-950/20 px-4 py-2 text-xs text-amber-100">
        {feedback}
      </div>
    );
  }

  if (checks.length === 0) {
    return (
      <div className="border-t border-neutral-800 px-4 py-2 text-xs text-neutral-500">
        No Variant warnings or errors.
      </div>
    );
  }

  const first = checks[0];
  const countLabel = errorCount > 0
    ? `${errorCount} error${errorCount === 1 ? "" : "s"}`
    : warningCount > 0
      ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
      : "1 note";

  return (
    <div
      className={cn(
        "border-t px-4 py-2 text-xs",
        errorCount > 0
          ? "border-rose-900/70 bg-rose-950/20 text-rose-100"
          : warningCount > 0
            ? "border-amber-900/70 bg-amber-950/20 text-amber-100"
            : "border-neutral-800 bg-neutral-950/30 text-neutral-500"
      )}
    >
      {countLabel}: {first.message}
    </div>
  );
}

export function createVariantGroupModeUpdatePayload(
  group: VariantGroup,
  mode: VariantGroupMode
): UpdateVariantGroupPayloadDto | null {
  if (group.mode === mode) {
    return null;
  }

  if (mode === "singleSelect" && group.variants.length === 0) {
    return null;
  }

  return {
    variantGroupId: group.variantGroupId,
    mode
  };
}

export function describeVariantGroupMode(group: VariantGroup): string {
  return formatVariantGroupMode(group.mode);
}
