# Wave19 Domain C Review: Editor Source Layer Part / Texture Draft UI

- Verdict: pass
- Review-Sylph context id: not visible in this subagent context
- Target: `wave19-editor-source-layer-part-texture-draft-ui`
- Implementation agent: `019e7923-28d8-7e11-9e5a-36f1325531d6` (`Gnome the 39th`)
- Review date: 2026-05-30

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- Actual repository diff and file reads for the six Domain C changed files.

## Scope Reviewed

Reviewed diff and source state for:

- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/styles/editor.css`
- `apps/editor/src/editor-state/source-intake-draft-state.test.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`

Workspace contains additional Wave19 changes under `apps/editor/src/editor-preview/**`, `packages/**`, and discussion maps. Per assignment, I did not treat those as Domain C findings except where useful for residual compatibility context.

## Findings

No blocking findings.

## Pass Evidence

- Per-layer draft state now carries `texturePreviewReference`, `textureId`, and `targetPartId` fields in `SourceIntakeLayerDraftState` (`apps/editor/src/editor-state/source-intake-draft-state.ts:37-49`), with deterministic defaults for new source intake rows (`apps/editor/src/editor-state/source-intake-draft-state.ts:90-109`).
- Draft validation rejects missing preview references, invalid non-package/generated references, missing texture IDs, and missing or malformed effective target part IDs (`apps/editor/src/editor-state/source-intake-draft-state.ts:201-224`). It accepts only `assets/textures/`, `assets/thumbnails/`, or `generated://texture-preview/` references after local safety checks (`apps/editor/src/editor-state/source-intake-draft-state.ts:306-323`).
- Confirmed drafts normalize and preserve the new layer fields without adding operation payload fields (`apps/editor/src/editor-state/source-intake-draft-state.ts:242-285`).
- The view model exposes the new labels and diagnostics through `projectSourceIntakeDraftViewModel`, including missing target part summaries (`apps/editor/src/editor-state/source-intake-view-model.ts:68-89`, `apps/editor/src/editor-state/source-intake-view-model.ts:115-121`, `apps/editor/src/editor-state/source-intake-view-model.ts:197-234`).
- The form renders labeled inputs for `Texture preview reference`, `Texture ID`, and `Target part ID` (`apps/editor/src/ui/source-assets/source-intake-form.ts:339-355`) and reads them back from form data (`apps/editor/src/ui/source-assets/source-intake-form.ts:454-460`).
- The changed form does not construct or commit an operation payload directly. Submit only confirms the local draft and invokes `onConfirmDraft` when diagnostics are empty (`apps/editor/src/ui/source-assets/source-intake-form.ts:156-166`). Existing app/workflow commit wiring is outside this Domain C write scope and was not changed here.
- Layout change is narrow: one wrapping mapping summary row under each source layer row (`apps/editor/src/styles/editor.css:492-499`), with existing mobile single-column behavior still covering `.source-intake-layer-row` (`apps/editor/src/styles/editor.css:972-979`).
- Focused tests cover valid draft confirmation without `operationType`, invalid external texture reference plus missing target part diagnostics, UI labels, and local rejection behavior (`apps/editor/src/editor-state/source-intake-draft-state.test.ts:37-143`, `apps/editor/src/ui/source-assets/source-intake-panel.test.ts:35-157`).
- Source organization scope is respected. No forbidden `apps/editor/src/editor-session/**`, `apps/editor/src/editor-workflow/**`, `packages/**`, or E2E files are part of the Domain C diff. `index.ts` remains barrel-only and was not expanded with implementation logic.

## Verification Considered

- Inspected `git diff -- <six Domain C files>` directly.
- Inspected relevant file bodies with line references.
- Ran `git diff --check -- <six Domain C files>`: pass, with CRLF warnings only.
- Considered Orch-Sylph verification evidence:
  - `pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts`: pass, 2 files / 9 tests after sandbox EPERM rerun.
  - `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`: pass after sandbox EPERM rerun.
  - `pnpm.cmd run check:source`: pass.
  - `pnpm.cmd test:unit`: implementation-agent-reported pass; not independently rerun in this review.

## Remaining Risks / Test Gaps

- The local texture reference validator does not reuse the package-format `isPackageRelativePath` helper. It blocks backslashes, `..`, trailing slash, and bare external URLs, but focused tests do not cover malformed package-local-like strings such as empty path segments or `.` segments. This is non-blocking for Domain C because the UI now rejects external URLs and does not materialize package files, but Domain D/E should align materialization/validator behavior with package-format path semantics.
- There is no focused test for the default-part fallback path where a layer leaves `targetPartId` blank but `defaultPartId` is valid. Current code treats that as effective part mapping in validation and view-model labels (`apps/editor/src/editor-state/source-intake-draft-state.ts:203-224`, `apps/editor/src/editor-state/source-intake-view-model.ts:197-234`); adding a regression later would make the intended fallback explicit.
- No browser/E2E or visual layout verification was rerun for this review. That is acceptable for Domain C's allowed scope, but Domain G should cover desktop/mobile source intake reachability and accessible names once the workflow is integrated.

## User-Decision Points

None.
