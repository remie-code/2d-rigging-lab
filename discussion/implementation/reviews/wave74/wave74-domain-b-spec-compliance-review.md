# Wave74 Domain B Spec Compliance Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: Wave74 Domain B `wave74-save-load-keyform-visibility-hardening`
- Review lane: Spec Compliance Review

## Scope Reviewed

- Basis documents listed in the review assignment, including Wave74/Wave73 plans, Wave73/Wave72 baseline reports, development conventions, and screen design docs.
- Domain B implementation report: `discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md`.
- Current Domain B source/test diffs under:
  - `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`
  - `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
  - `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
  - `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
  - `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
  - `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
- Parallel Wave74 Domain A changes were reviewed only for boundary/conflict awareness. The Warp mesh-bounds changes in `rig-tool-state.ts` / `rig-tool-state.test.ts` are owned by Domain A per `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`.

## Basis Used

- `discussion/implementation/orchestration/wave74-plan.md`
- `discussion/implementation/orchestration/wave73-plan.md`
- `discussion/implementation/waves/wave73/wave73-final-integration-report.md`
- `discussion/implementation/reviews/wave73/wave73-final-clean-integration-review.md`
- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`
- `discussion/implementation/waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md`
- `discussion/implementation/waves/wave72/wave72-final-integration-report.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/screens/project-storage-task.md`

## Requirement Classification

| Requirement / basis item | Classification | Review evidence |
|---|---|---|
| Wave74 7.3: browser/e2e or equivalent user-visible save, reload, reselect assertions for Warp `controlPointOffsets` | `implemented` | E2E authors Warp offset keyform and asserts after-load UI values plus Canvas evaluated offset attributes at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:92`, `:256`, and `:263`. |
| Wave74 7.3: after-load Rotation `angleDegrees` assertion | `implemented` | E2E authors angle keyform and asserts after-load input and Canvas angle at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:70`, `:240`, and `:246`. |
| Wave74 7.3: after-load Rotation `translation` assertion | `implemented` | E2E authors translation keyform and asserts after-load translation inputs plus Canvas x/y attributes at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:78`, `:242`, and `:251`. |
| Tests distinguish data loss from selection/current parameter reset invisibility | `implemented` | Before save the current value is set to `30`; after load the test asserts Project/no selected row/no target/default `0`, then discovers badges and reselects to prove data exists at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:113`, `:147`, `:152`, `:153`, `:163`, and `:236`. |
| Tests assert UI state/value and evaluated Canvas behavior where practical | `implemented` | E2E checks binding inputs and `data-deformer-overlay-*` evaluated attributes for rotation angle, translation, and warp offsets after load. |
| After-load tree reorder assertion | `implemented` | E2E reorders drawable rows before save and verifies relative order after load at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:19`, `:28`, and `:188`. |
| After-load deformer reparent assertion | `implemented` | E2E verifies the restored Rotation Deformer row has the loaded Warp Deformer as parent through `data-parent-rig-control-id` at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:166`. |
| After-load Drawable runtime visibility assertion | `implemented` | E2E hides a drawable, verifies loaded row shows the restore action, then shows it and asserts renderable count increases at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:118`, `:192`, and `:196`. |
| Wave74 7.4: deterministic keyform discovery after load without prior selection/current slider pose persistence | `implemented` | Rig read model summarizes rig-control keyform set/key counts at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:610`; Deformer Tree renders visible `Keyed N` badges and deterministic data attributes at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:180` and `:224`; E2E asserts badges before selecting a deformer at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:160`. |
| Discovery affordance is user-visible and not hidden test-only text | `implemented` | The `Keyed N` badge is visible UI with `KeyRound` icon/text; data attributes are supplemental test hooks at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:220`. |
| Discovery does not restore/persist selection or current slider pose | `implemented` | Load path clears selection and parameter values at `apps/editor/src/features/editor-session/editor-session-context.tsx:458`; E2E asserts no selected Parts/Deformer row and current value `0` after load before reselection. |
| User can reselect keyed target and inspect/edit normally | `implemented` | E2E reselects restored deformer rows and verifies Parameter Binding inputs are populated and editable at exact key positions. Parameter Binding Add/Update/Delete remains normal UI at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:71`. |
| Negative protection: selection/current parameter values are not persisted | `implemented` | Save path exports session plus `editorHiddenPartIds` only at `apps/editor/src/features/editor-session/editor-session-context.tsx:534`; load clears selection/current values at `:463` and `:465`; E2E asserts reset at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:147` and `:152`. |
| Negative protection: active tool/canvas view are not package-persisted | `implemented` | No package/export path was added for them. Active tool lives in UI store defaults at `apps/editor/src/state/editor-ui-store.ts:29`; Canvas view is local component state initialized from `DEFAULT_VIEW` at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:84` and `:124`. The portable e2e reloads the page before opening the bundle, so durable restoration from the bundle is not occurring. |
| No arbitrary auto-jump to a keyform on load | `implemented` | E2E sets current value to `30` before save and observes default `0` / `No target` after load; reinspection happens only after explicit user reselection. |
| Package/session tests are not the only keyform restoration evidence | `implemented` | Domain B evidence is a Playwright user-visible flow, supported by component/model tests. |
| Parameter Keyform design: Inspector/Parameter Binding supports Add/Update/Delete for selected target property | `implemented` | `Add` was added when no current key exists at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:124`; existing update/delete remains for current keys. |
| Parameter Keyform design: non-key editing remains locked until a key is added | `implemented` | Projection still sets `canEditValue` only when a current keyform exists and `canAddCurrent` when it does not at `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:326`. Component test asserts Add is enabled while value inputs remain disabled at `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:121`. |
| Rig Tool design: Deformer Tree exposes keyform count/discovery in rig context | `implemented` | Deformer read models and rows carry `keyformSetCount` / `keyformKeyCount`; UI renders badge/count in Deformer Tree. |
| Canvas Preview design: no raw payload/evidence UI added | `implemented` | Domain B uses existing Canvas data attributes for e2e evidence and does not add raw payload UI to the product surface. |
| Project Storage Task design: reuse existing portable save/load flow | `implemented` | E2E continues through App Bar Save Project and file input Open; no storage task format or archive/filesystem UI was added. |
| UX-backed package logic authority | `not relevant` | Domain B did not discover a package save/load bug and did not change package logic for its UI affordance. |
| Operation policy: UI mutations route through Operation Core paths | `implemented` | Parameter Binding uses `editKeyformKey(createEditKeyformPayload(...))`; `addCurrent`/`updateCurrent` payload creation is in `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:363`. |
| Source organization policy | `implemented` | No new catch-all/source-entrypoint files. `node scripts/check-source-organization.mjs` passed in this review. |
| Dependency policy | `implemented` | No `package.json` / `pnpm-lock.yaml` changes. `node scripts/check-dependencies.mjs` passed in this review. |
| Schema and ID conventions | `implemented` | No package schema or machine-readable ID format changes. Added data attributes use existing kebab-case HTML attribute conventions and no space-containing IDs. |
| Preserve Wave72/Wave73 portable bundle and editor hidden part baseline | `implemented` | Domain B reuses existing save/load path and retains hidden Part Container assertion in the e2e. |
| Package format change / new save format / browser-local slot / archive/filesystem / native filesystem | `explicit non-goal` | No such diff was found in Domain B files; no `packages/package-format/**`, manifest, or lockfile changes. |
| Persisting editor-local pose: selection, current slider pose/current parameter values, active tool, canvas view, undo, drafts, feedback, manual collapse | `explicit non-goal` | Domain B does not add persistence for these. Existing load reset/source boundaries remain in place. |
| Domain A foundation fixes by Domain B | `explicit non-goal` | Warp mesh-bounds and Rotation translation interpolation evidence are owned by Domain A; reviewed Domain A report confirms those overlapping `rig-tool-state.ts` changes are Domain A scope. |
| Slider performance optimization, Viewer/Runtime View, Texture Atlas, Variant/Expression, Cubism compatibility, external transport, LLM/provider integration | `explicit non-goal` | No matching implementation or dependency diff found. |

## Findings

No blocking findings.

No needs-change findings.

## Residual Risks / Non-Blockers

- The portable save/load Playwright test is intentionally broad and can fail from unrelated PSD import, tree, Canvas, or storage regressions. This is acceptable for this spec lane because focused model/component tests cover the new projection/UI pieces and the broad e2e proves the user-visible workflow.
- Active tool and Canvas view are source-reviewed as non-package-persisted, and the e2e page reload proves they are not restored from the portable bundle. Domain B does not add a direct same-page "open while tool/view changed" negative assertion; if the product later requires load-time reset rather than only non-persistence, that should be made explicit in a future plan.
- Browser proof targets exact keyforms at the default parameter value. Interpolated Rotation translation and Warp offset behavior are covered by lower-level Domain A/runtime/editor evidence and should remain part of final integration validation.
- The Deformer Tree badge is compact (`Keyed N`) and does not identify individual properties. This matches the accepted discovery affordance, while richer browsing remains future Parameter Manager/timeline scope.

## Validation Performed

- `git diff --check --` Domain B source/test/report paths: passed with CRLF normalization warnings only.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts`: sandbox run failed with esbuild `spawn EPERM`; approved rerun passed, 2 files / 9 tests.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts`: sandbox run failed with `spawn EPERM`; approved rerun passed, 1 Playwright test. The generated portable project JSON under `apps/editor/test-results` was removed after validation.

## User-Decision Points

None.
