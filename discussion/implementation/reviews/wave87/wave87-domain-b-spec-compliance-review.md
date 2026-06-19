# Wave87 Domain B Spec Compliance Review

Verdict: `pass`

Target: `wave87-texture-atlas-task-ui-routing-preview`

## Findings

Blocking findings: none.

No spec-compliance blocker was found in the reviewed Domain B implementation. The Atlas UI is connected as a dedicated Task screen, the existing Toolbox `Texture Atlas` entry routes to it, Back returns to the normal Authoring Workspace route without invoking PSD import, and the preview/apply workflow delegates target selection, packing preview, and Apply to Domain A APIs.

Specifically, the blocking conditions named in the review request were not observed:

- Hidden bound Drawables are not excluded; they remain included and receive a `Currently hidden` indication.
- Unbound Drawable Pool items are not included; they appear in the excluded list with `Unbound drawable in Drawable Pool`.
- Target selection and packing are not duplicated as UI-local source of truth; UI code calls Domain A APIs.
- Generate/Apply guards exist at both projection/button level and apply-handler level.
- The dedicated route/toolbox evidence is present.
- No workspace directory export claim or UI was found in the reviewed Atlas UI/source.

## Scope Reviewed And Basis Used

Basis documents read:

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/_map.md`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-spec-compliance-review.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md`

Source/tests inspected directly:

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/workspace-data.ts`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`

## Compliance Matrix

| Requirement | Result | Evidence |
|---|---|---|
| Texture Atlas is a dedicated Task screen, not Inspector UI | pass | `AuthoringWorkspaceContent` detects `activeEntry === "atlas"` and renders `<TextureAtlasTaskScreen />` in the dedicated screen branch (`apps/editor/src/workspace/authoring-workspace.tsx:38`, `apps/editor/src/workspace/authoring-workspace.tsx:44`, `apps/editor/src/workspace/authoring-workspace.tsx:49`). Parameter Bar is suppressed for Atlas (`apps/editor/src/workspace/authoring-workspace.tsx:91`). |
| Existing Toolbox `Texture Atlas` entry opens the dedicated screen | pass | Toolbox data has `{ id: "atlas", label: "Texture Atlas", kind: "task" }` (`apps/editor/src/workspace/workspace-data.ts:46`). Toolbox task activation calls `setActiveEntry(entry)` and only opens PSD import for `entry === "import"` (`apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:25`). Focused test covers Toolbox Atlas activation (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:321`). |
| Back returns to Authoring Workspace and does not open PSD import | pass | Atlas Back calls `setActiveEntry("import")` directly (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:101`), which falls back to the normal Authoring Workspace branch because Atlas/Viewer/Diagnostics/etc. are the dedicated-screen cases. Test asserts Back calls `setActiveEntry("import")` and does not call `openPsdImport` (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:307`). |
| Atlas preview has a large central preview area | pass | The Atlas screen is a two-region task layout with preview first and a fixed-width sidebar at xl (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:141`). Preview area is a flex-backed main region with `data-testid="atlas-preview-area"` (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:163`) and the sidebar is separate. |
| Included / Excluded / Warnings summary counts are shown | pass | Summary renders Included, Excluded, and Warnings metrics (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:259`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:264`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:269`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:274`). Projection fills counts from Domain A selection/warning rows (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:143`). |
| Included / Excluded / Warnings lists use readable labels | pass | Included rows show display name, part path, texture/mesh source, hidden badge, and Ready/Blocked state (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:478`). Excluded reason `unboundDrawablePool` maps to `Unbound drawable in Drawable Pool` (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:242`). Warning codes map to human labels (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:257`). Focused tests assert hidden and unbound labels (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:152`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:170`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:176`). |
| Page size, padding, and edge extrusion settings are shown | pass | Sidebar shows Page, Usage, Padding, and Edge extrusion summary (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:277`) and controls for page size, padding, and edge extrusion (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:294`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:314`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:334`). |
| `Generate Preview` and `Apply Atlas` actions exist | pass | Header actions render `Generate Preview` and `Apply Atlas` (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:120`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:127`). Generate calls `createTextureAtlasTaskPreviewState()` (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:57`). Apply calls the editor-session apply hook only after guard checks (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:68`). |
| Apply is disabled/guarded when preview is missing, stale, or failed | pass | Projection sets `canApply` only when preview is ready, not stale, and has placements (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:123`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:140`). Button disables on `!projection.canApply` (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:129`). Handler returns early if preview is not ready or `canApply` is false (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:68`). Tests cover ready and stale cases (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:181`). Domain A Apply also guards not-ready/stale preview (`packages/authoring-core/src/texture-atlas-mutations.ts:71`, `packages/authoring-core/src/texture-atlas-mutations.ts:359`, `packages/authoring-core/src/texture-atlas-mutations.ts:374`). |
| Hidden bound drawables appear included with hidden indication | pass | Domain A includes bound drawables before hidden status is applied (`packages/authoring-core/src/texture-atlas-targets.ts:97`, `packages/authoring-core/src/texture-atlas-targets.ts:130`, `packages/authoring-core/src/texture-atlas-targets.ts:139`). Projection passes `editorHiddenPartIds` into Domain A and maps hidden reasons to `Currently hidden` (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:109`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:249`). Focused test covers the hidden included row (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:152`). |
| Unbound Drawable Pool items appear excluded, not included | pass | Domain A classifies non-bound drawables as `unboundDrawablePool` (`packages/authoring-core/src/texture-atlas-targets.ts:124`). Projection maps that reason to readable text (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:242`). Focused test asserts the pool drawable is excluded (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:176`). |
| Domain A APIs are used for target selection, preview generation, and Apply | pass | Projection imports and calls `selectTextureAtlasTargets()` and `createTextureAtlasPreview()` (`apps/editor/src/workspace/atlas/atlas-task-projection.ts:11`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:109`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:176`). Session command imports and calls Domain A `applyTextureAtlasPreview()` (`apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:7`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:28`). Domain A exports these APIs from package index (`packages/authoring-core/src/index.ts:45`). |
| v0 stays single-page deterministic and avoids forbidden feature scope | pass | UI preview renders Domain A placements as DOM rectangles and has no drag/manual placement controls (`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:198`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:222`). Domain A preview uses single-page packing (`packages/authoring-core/src/texture-atlas-packing.ts:19`, `packages/authoring-core/src/texture-atlas-packing.ts:58`, `packages/authoring-core/src/texture-atlas-packing.ts:138`). Source search over reviewed Atlas UI/session files found no workspace directory export, File System Access, camera/capture, manual placement, Cubism, `.moc3`, or `.model3.json` implementation/claim. |

## Tests And Evidence Considered

Evidence considered:

- Domain B report records focused Atlas UI test pass: `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts` passed after escalated rerun.
- Domain B report records broader related UI test pass across Atlas, Diagnostics, Viewer, and Toolbox: 4 files / 27 tests.
- Domain B report records `pnpm.cmd typecheck`, source organization guard, dependency guard, and `git diff --check` passing.
- This review lane inspected the focused test source directly. The tests cover Domain A-derived included/excluded/hidden projection, Generate Preview readiness and stale guard, Domain A Apply command helper, dedicated route rendering, Parameter Bar suppression, Back behavior without PSD import, and Toolbox Atlas activation.

No additional commands were rerun in this review lane; the verdict is based on direct source/test inspection plus the validation evidence recorded in the Domain B report.

## Residual Risks

- The preview is a DOM layout-rectangle visualization, not a pixel-rendered generated atlas image. This matches the v0 Task preview scope, but final integration should still verify Canvas/Viewer rendering after Apply.
- The UI stale signature is robust for normal editor revisions and sampled texture bytes, but an in-place byte mutation that also avoids revision changes and sampled-byte changes could evade the UI-level stale detector. Domain A still guards preview readiness and key drawable/UV drift.
- Back uses `setActiveEntry("import")` as the current normal-workspace fallback route. It does not invoke `openPsdImport()`, but future route naming could make this clearer if `import` continues to double as both default workspace entry and Import PSD task id.
- Apply remains a narrow editor-session history-backed hook around Domain A mutation, not a full Operation Core command. This was reported by Domain B as residual risk and is not a spec blocker for this UI/routing wave.

## User-Decision Points

- Whether Atlas Apply should later be wrapped as an Operation Core command before broader UX acceptance.
- Whether generated atlas pages should receive a human preview asset record beyond the current layout/binary-backed preview.
- Workspace Directory Export remains deferred outside Wave87 and should stay a separate planning decision before any user-visible export workflow is added.
