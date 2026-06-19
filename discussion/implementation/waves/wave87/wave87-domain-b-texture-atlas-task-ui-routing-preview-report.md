# Wave87 Domain B Report: Texture Atlas Task UI / Routing / Preview Workflow

## Gnome Verdict Recommendation

pass

Domain B connected the existing Toolbox `Texture Atlas` entry to a dedicated Texture Atlas Task screen. The screen uses Domain A APIs for target selection, preview generation, and apply mutation, and keeps the UI-local logic limited to display projection, settings, and stale-preview gating.

## Basis Coverage Self-Report

Read and applied:

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/_map.md`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-test-adequacy-review.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Deferred Basis Items:

- No Wave85/Wave86 baseline reports beyond the delegated basis list were re-read in this Gnome pass.
- No browser visual/pixel check was run; the implemented preview is DOM layout-rect projection, not Canvas renderer integration.

## Current-State Confirmation

- Domain A exports were present and used from `@private-2d-rigging-lab/authoring-core`: `selectTextureAtlasTargets()`, `createTextureAtlasPreview()`, and `applyTextureAtlasPreview()`.
- `WorkspaceEntryId` already included `atlas`.
- `workspace-data.ts` already had the Toolbox task entry `{ id: "atlas", label: "Texture Atlas" }`; it was not changed.
- `AuthoringWorkspaceContent` previously routed only `parameters`, `storage`, `validate`, and `viewer` to dedicated screens; `atlas` fell through to the normal Authoring Workspace.
- Domain A files and related reports remained dirty/uncommitted and were treated as upstream work.

## UI Routing / Task Screen Trace

- Added `TextureAtlasTaskScreen` under `apps/editor/src/workspace/atlas/`.
- Updated `apps/editor/src/workspace/authoring-workspace.tsx` so `activeEntry === "atlas"` renders the dedicated Atlas screen.
- Atlas screen Back uses the established `setActiveEntry("import")` pattern and does not call PSD import.
- Atlas screen suppresses `ParameterBar`, matching the dedicated Viewer/Diagnostics screen style.
- The existing Toolbox `Texture Atlas` button continues to call `setActiveEntry("atlas")`; focused tests verify it does not open PSD import.

## Target Summary / Lists Trace

- `atlas-task-projection.ts` calls Domain A `selectTextureAtlasTargets()` as the source of truth.
- The screen displays Included / Excluded / Warnings counts.
- Included list displays Drawable name, part path label, texture/mesh source label, packable state, and `Currently hidden` for hidden-but-bound drawables.
- Excluded list maps Domain A `unboundDrawablePool` to `Unbound drawable in Drawable Pool`.
- Warnings list maps Domain A warning codes to readable labels and keeps the Domain A message/target path visible.

## Preview / Apply Trace

- `createTextureAtlasTaskPreviewState()` calls Domain A `createTextureAtlasPreview()` with page size, padding, edge extrusion, and current editor-hidden Parts.
- The central preview renders the Domain A layout placements as large atlas-page rectangles; no UI-local packing or manual placement editor was added.
- Apply is enabled only when:
  - a preview exists;
  - preview status is `ready`;
  - the preview signature is not stale;
  - there is at least one placement.
- Stale guard:
  - preview signature includes settings, editor-hidden Part ids, authoring/package revision, Domain A included/excluded/warning summaries, packable mesh UVs, texture sizes, and sampled texture-byte signature.
  - settings changes and target input changes mark the preview stale and disable Apply.
- Added `commitTextureAtlasPreview()` under `features/editor-session/model/` to call Domain A `applyTextureAtlasPreview()` on a cloned session.
- Added `EditorSessionProvider.applyTextureAtlasPreview()` as a narrow history-backed hook. On success it records `Apply Texture Atlas` in existing editor history and updates provider state.

## Must-not Compliance Evidence

- No UI-local target selection or packing algorithm was implemented; UI calls Domain A APIs.
- No Inspector-based Atlas UI was added.
- No manual placement editor was added.
- No Workspace Directory Export, ZIP/archive, File System Access API, or visible image export UI was added.
- No unrelated Viewer, Dynamics, Mesh, Deformer, or runtime feature changes were made.
- No external dependency was added.
- No Cubism compatibility or public format claim was added.

## Changed Files

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts`
- `discussion/implementation/waves/wave87/wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md`

## Tests / Checks

- `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
  - sandbox run failed with known esbuild `spawn EPERM`
  - escalated rerun passed: 1 file, 7 tests
- `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
  - escalated run passed: 4 files, 27 tests
- `pnpm.cmd typecheck`: passed
- `node scripts/check-source-organization.mjs`: passed
- `node scripts/check-dependencies.mjs`: passed
- `git diff --check`: passed with LF/CRLF working-copy warnings only
- Additional attempted check: `pnpm.cmd exec tsc --noEmit -p apps/editor/tsconfig.json`
  - failed on pre-existing app-wide type errors in unrelated Dynamics / Diagnostics / Storage / test files; not used as a Domain B gate.

## Scope Justifications

- `apps/editor/src/features/editor-session/editor-session-context.tsx` and `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts` were edited outside the primary `apps/editor/src/workspace/**` scope because Apply needs to update the shared React editor session and history. The hook is intentionally narrow: it accepts a Domain A `TextureAtlasPreview`, delegates mutation to Domain A `applyTextureAtlasPreview()`, records one editor history entry, and exposes warnings back to the Atlas screen.
- No `packages/authoring-core/src/**` edits were made in Domain B.

## Residual Risks

- The user-facing Apply path remains a narrow authoring-core direct mutation hook, not a full Operation Core operation. This follows Domain A's current mutation foundation and existing editor-session history patterns, but final integration should decide whether to wrap Atlas Apply in Operation Core later.
- DOM preview shows layout rectangles and labels, not raw generated atlas pixels. This satisfies v0 task preview without a Canvas rewrite, but future visual parity checks should inspect Canvas/Viewer after Apply.
- The UI stale signature samples texture bytes for performance. Normal editor mutations should increment authoring revision; an in-place byte mutation with unchanged revision and unchanged sampled bytes could theoretically evade the UI stale guard, while Domain A still guards texture-id and UV drift.

## User-Decision Points

- Whether Texture Atlas Apply should become an Operation Core command before broader user-facing acceptance.
- Whether generated atlas pages need a separate human preview asset record, or whether layout/binary-only remains sufficient for v0.
- Workspace Directory Export remains deferred outside Wave87 Domain B.

## Orch-Sylph Closeout

Final Domain B verdict: `escalate`.

Implementation completed the UI/routing/preview workflow and two independent review lanes passed. The Design / Development Compliance Review returned `escalate` because the user-facing `Apply Atlas` path commits package-changing atlas state through a narrow editor-session hook around Domain A `applyTextureAtlasPreview()` rather than through Operation Core. That conflicts with `discussion/development_convention/operation-policy.md` unless Wave87 explicitly accepts an exception or expands scope to add an Operation Core atlas apply operation.

Review lane results:

| Review lane | Verdict | Artifact |
|---|---|---|
| Spec Compliance Review | `pass` | `discussion/implementation/reviews/wave87/wave87-domain-b-spec-compliance-review.md` |
| Design / Development Compliance Review | `escalate` | `discussion/implementation/reviews/wave87/wave87-domain-b-design-development-review.md` |
| Test Adequacy Review | `pass` | `discussion/implementation/reviews/wave87/wave87-domain-b-test-adequacy-review.md` |

No fix loop was started because the blocking finding is not a small Domain B UI defect. Fixing it requires either:

- an explicit wave-level exception accepting the current direct authoring-core mutation hook for Texture Atlas v0; or
- a scope expansion to implement an Operation Core atlas apply operation and route the UI through that operation evidence path.

Current-state confirmation after review:

- `activeEntry === "atlas"` now routes to a dedicated Texture Atlas Task screen.
- The existing Toolbox `Texture Atlas` entry opens that route.
- Back navigation uses `setActiveEntry("import")` directly and does not open PSD import.
- The screen passes `editorHiddenPartIds` into Domain A target selection and preview generation.
- Unbound Drawable Pool items are excluded, and hidden bound Drawables remain included with `Currently hidden` indication.
- Generate Preview and stale/missing/failed preview guards are implemented.
- Apply delegates to Domain A and updates editor state through the new narrow editor-session hook, which is the escalated policy issue.

Additional residual risks:

- Atlas preview is DOM layout rectangles, not generated atlas pixels.
- Canvas / Viewer visual parity after Apply remains final-integration evidence.
- The stale signature samples texture bytes for performance and assumes normal editor mutations advance revision.

Domain C readiness:

- Domain C should not treat Domain B as `pass`.
- Domain C can start only if Undine accepts this explicit escalation as the wave gate input or decides a fix scope for the Operation Core mutation boundary first.
