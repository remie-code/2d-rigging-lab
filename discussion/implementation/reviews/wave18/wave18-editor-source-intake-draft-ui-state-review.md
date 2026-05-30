# Wave 18 Domain C Review: editor source intake draft UI / state

- verdict: `pass`
- reviewer: Review-Sylph
- target: `wave18-editor-source-intake-draft-ui-state`

## Review Context Separation Evidence

本レビューは Gnome 実装担当とは別の fresh Review-Sylph context で実施した。実装 context は `019e78c5-dd11-79a0-9abb-a1b73e18fc8c` (`Gnome the 24th`)。Review-Sylph context は `019e78d2-98b1-7e80-bf3f-6c103a648e66` (`Sylph the 25th`)。

実装報告だけを根拠にせず、basis documents、scoped diff、untracked source/test files、completion report、verification summary を直接確認した。source implementation files / tests は編集していない。書き込みはこの review report のみ。

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave18-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/mvp-authoring-runtime/02-gui-editor-screen-spec.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave18/wave18-editor-source-intake-draft-ui-state-completion.md`

## Changed Files Reviewed

Scoped diff reviewed with:

- `git diff -- apps/editor/src/editor-state apps/editor/src/ui/source-assets apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/app/editor-app.ts apps/editor/src/styles discussion/implementation/waves/wave18/wave18-editor-source-intake-draft-ui-state-completion.md`

Tracked modified Domain C files reviewed:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/styles/editor.css`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`

New / untracked Domain C files read directly:

- `apps/editor/src/editor-state/source-intake-draft-state.test.ts`
- `apps/editor/src/editor-state/source-intake-draft-state.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/ui/source-assets/index.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.ts`
- `discussion/implementation/waves/wave18/wave18-editor-source-intake-draft-ui-state-completion.md`

Worktree status contains package-side and validator-side Wave18 changes outside Domain C. They were treated as other domains' work and were not reviewed as Domain C implementation changes.

## Verification Reviewed

Orch-Sylph reported verification:

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/source-intake-draft-state.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`
  - sandbox first run hit Vitest `node_modules` `EPERM`
  - escalated rerun: pass, 3 files / 19 tests
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - sandbox first run hit TypeScript `node_modules` `EPERM`
  - escalated rerun: pass
- `pnpm.cmd run check:source`: pass, Source organization guard passed
- `git diff --check -- <Domain C scope>`: pass with LF/CRLF warnings only
- `rg -n "[ \t]+$" <new Domain C source/test/report files>`: no matches

Reviewer spot checks performed:

- `git ls-files --others --exclude-standard -- apps/editor/src/editor-state apps/editor/src/ui/source-assets discussion/implementation/waves/wave18/wave18-editor-source-intake-draft-ui-state-completion.md`
- `git status --short -uall`
- `rg -n "operationType|commit|importSplitPngSourceAsset|setRightsMetadata" <Domain C app/editor files>`
- `rg -n "export \\*|function|const|class|interface|type" apps/editor/src/editor-state/index.ts apps/editor/src/ui/source-assets/index.ts`

Focused tests / typecheck were not independently rerun in this review context because Orch-Sylph already supplied the required escalated pass results.

## Lane 1: Design / Development Compliance

`pass`.

- Domain C scope is respected by the reviewed file set. `git status` shows other Wave18 package / validator changes, but the Domain C files under review are limited to `apps/editor/src/editor-state/**`, `apps/editor/src/ui/source-assets/**`, `app-shell`, `editor-app`, styles, focused tests, and the completion report.
- The UI does not directly commit an operation payload. `source-intake-form.ts` submits through `confirmSourceIntakeDraft(...)` and calls `onConfirmDraft` only; operation strings in Domain C are limited to existing unrelated app callbacks and tests that assert no `operationType` field is produced.
- `editor-app.ts` keeps the source intake draft app-local and overlays it onto the workflow state for rendering (`sourceIntakeDraft` at lines 15-19), then updates only that local draft on confirm (lines 52-54). Load/reset return the draft to the workflow-projected default (lines 61-68).
- Draft state models split PNG intake purpose directly: manifest path, source asset ID, content hash, default part, placement policy, layer rows, and rights/provenance metadata are explicit in `SourceIntakeDraftState`; `confirmSourceIntakeDraft` normalizes and validates draft data before marking it confirmed.
- View model projection is separate from state. `projectSourceIntakeDraftViewModel` exposes manifest / source / rights / provenance / layer summary labels and diagnostics, and root `projectEditorWorkflowViewModel` exposes it as `sourceIntake`.
- `index.ts` files remain barrel-only. `apps/editor/src/editor-state/index.ts` adds only re-exports for the new state/view-model files, and `apps/editor/src/ui/source-assets/index.ts` only re-exports the panel.
- No giant source file or catch-all file was introduced. Draft state, view model, form, panel, and tests are split by responsibility.
- Domain A/D boundaries are not bypassed. There is no editor-session/editor-workflow write in this Domain C diff, and no packages operation handler or persistence mutation is invoked by the UI.

## Lane 2: Test Adequacy

`pass`.

- State tests cover the initial draft default, required manifest / creator / license diagnostics, valid confirmation of manifest / layer row / rights / placement metadata, and invalid geometry diagnostics.
- UI tests cover rendering of manifest, placement policy, rights status, layer row controls, valid draft confirmation, local invalid-input diagnostics, and explicit absence of an `operationType` on confirmed draft output.
- App shell tests cover visibility of the Source Intake panel without removing Drawable Authoring or Mesh Vertex Controls.
- Stable test ids are sufficient for Domain D/F handoff: source intake panel/form/submit/summary/diagnostics/layer rows/add-layer/manifest/placement/rights ids are centralized in `editor-test-ids.ts`, with a dynamic layer-row helper.
- Accessible label coverage is smoke-level but adequate for Domain C: the form has an explicit `aria-label`, panel uses `aria-labelledby`, layer rows have `aria-label`, and visible label wrappers are used for inputs/selects.

No missing test is blocking for Domain C. Browser-level e2e persistence and mobile a11y verification correctly remain Domain F scope after workflow integration.

## Lane 3: UI / Accessibility Smoke

`pass`.

- `app-shell.ts` mounts the Source Intake panel into the existing shell after Drawable Authoring and before project persistence, without changing existing callback signatures beyond the new draft confirmation callback.
- CSS gives the intake panel a full-row placement (`grid-column: 1 / -1`) and uses responsive one-column layout for `.source-intake-form`, `.source-intake-summary`, and `.source-intake-layer-row` at small widths.
- Inputs/selects use the existing `.editor-field` pattern, so labels remain associated by label wrapping. Diagnostics use `role="status"`.
- The CSS uses `min-width: 0` and `overflow-wrap: anywhere` on summary and row text surfaces, which is enough for smoke-level overflow risk in this minimal metadata UI.

No obvious overlap or overflow blocker was found from source/CSS inspection. A real desktop/mobile screenshot pass remains appropriate for Domain F.

## Blocking Findings

None.

## Remaining Risks / Follow-up Notes

- `contentHash` is collected and shown, but Domain C validation does not require it. This is not blocking because the current import payload treats `contentHash` as optional and Domain C is draft-only, but Domain D/integration should decide whether an operation-ready import draft needs a stricter warning or required field.
- Draft confirmation can represent `blocked` rights as metadata. That is acceptable for a non-committing draft UI, but Domain D must avoid treating a blocked-rights draft as a successful source import; operation preconditions / UI diagnostics should make the rejection visible.
- The draft is intentionally app-local and not saved through project persistence in Domain C. Persistence of source manifest / rights / provenance is Domain D/E/F responsibility.
- Layer rows are metadata-only. Real PNG bytes, file picker, image decoding, texture atlas generation, and actual texture rendering remain future scope per Wave18 plan.

## Verdict

`pass`. Domain C meets the split PNG source intake draft state / view model / minimal UI requirement and does not need a Gnome fix loop before the next Wave18 domain.
