# Wave75 Domain A Spec Compliance Review

## Verdict

pass

Fix Loop 1 resolved the previous blocking Wave75 Domain A app type errors. The real Rotation translation authoring workflow, deterministic translation keyform materialization, Rotation/Warp UI cleanup, and must-not scope all remain implemented. `apps/editor` package typecheck still fails, but the remaining failures are in files with no current diff and are outside the Wave75 Domain A changed files and assigned requirement surface.

## Basis Reviewed

- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/orchestration/wave74-plan.md`
- `discussion/implementation/waves/wave74/wave74-final-integration-report.md`
- `discussion/implementation/reviews/wave74/wave74-final-clean-integration-review.md`
- `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`
- `discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md`
- `discussion/implementation/waves/wave75/wave75-domain-a-deformer-keyform-authoring-inspector-density-cleanup-report.md`, including Fix Loop 1
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- Directly reviewed Wave75 Domain A source/tests, especially the four Fix Loop 1 files named in the re-review assignment.

## Requirement Classification

| Requirement | Classification | Evidence |
|---|---|---|
| Exact workflow: PSD import -> mesh -> Rotation Deformer -> `Face Angle Z` -> `Ends + Center` -> max `30` -> angle drag -> translation drag -> midpoint slider interpolation | implemented | `apps/editor/e2e/psd-import.e2e.spec.ts:538` through `apps/editor/e2e/psd-import.e2e.spec.ts:604`; re-review Playwright run passed. |
| Translation drag at exact active key creates/updates Rotation `translation` keyform after angle `Ends + Center` | implemented | `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:723`; `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:212`; `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:291`. |
| Missing translation keyform set materializes from same active parameter and same rigControl angle key positions | implemented | `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:723` through `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:740`; `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:100`. |
| Materialized non-current translation keys use evaluated/rest fallback and only current key gets drag value | implemented | `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:394`; `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:263`; `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:320`. |
| Existing Rotation angle keyform editing continues | implemented | `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:162`; `apps/editor/e2e/psd-import.e2e.spec.ts:569`. |
| Wave74 lower-level Vec2 interpolation remains intact | implemented | `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:550`; Wave74 final review records pass for runtime/editor/package Vec2 interpolation. |
| Slider midpoint shows interpolated translation overlay and visible artwork movement | implemented | `apps/editor/e2e/psd-import.e2e.spec.ts:587` through `apps/editor/e2e/psd-import.e2e.spec.ts:603`. |
| Do not convert exact active key workflow into only `restTranslation` | implemented | `materializeKeyform` is returned before rest fallback at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:723` and rest fallback remains at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:743`; test coverage at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:591`. |
| Do not require manual Translation card keyform before the described drag workflow | implemented | User-flow e2e uses `Ends + Center`, then canvas translation drag; no Translation card Add is used in `apps/editor/e2e/psd-import.e2e.spec.ts:561` through `apps/editor/e2e/psd-import.e2e.spec.ts:576`. |
| Do not rework runtime interpolation primitives | implemented | Package diff remains test-only; no production package-format/runtime rewrite found. |
| Remove per-card Add/Update/Delete from Rotation angle, Translation, Opacity multiplier cards | implemented | `apps/editor/src/workspace/panels/parameter-binding-section.tsx:85`; assertions at `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:61` through `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:92`. |
| Keep useful value displays/controls without duplicate per-card commit buttons | implemented | Value editors remain at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:94`; vec2/control point/numeric controls remain at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:115`, `apps/editor/src/workspace/panels/parameter-binding-section.tsx:141`, and `apps/editor/src/workspace/panels/parameter-binding-section.tsx:169`. |
| Centralize keyform authoring routes in Canvas handles and Parameter Bar | implemented | Parameter Bar target selector/actions at `apps/editor/src/workspace/panels/parameter-bar.tsx:152` and `apps/editor/src/workspace/panels/parameter-bar.tsx:197`; canvas gestures at `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:162`, `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:185`, and `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:212`. |
| Rotation Inspector basic card keeps `Name` and `Parent deformer` | implemented | `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:697` and `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:703`. |
| Remove Rotation basic `Bound children` and `Angle keyforms` rows | implemented | Negative assertions at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:105` and `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:106`. |
| Compact Rotation setup fields while preserving setup editing | implemented | Setup transform grid at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:730` through `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:798`; payload assertion at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:111`. |
| Remove standalone Rotation opacity Inspector section while keeping Parameter Binding path | implemented | Rotation inspector renders `ParameterBindingSection` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:727`; negative opacity assertion at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:109`. |
| Remove Warp basic-card opacity field | implemented | Warp committed basic card contains Name/Parent only before Parameter Binding at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:466` through `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:509`; e2e negative assertion at `apps/editor/e2e/psd-import.e2e.spec.ts:340`. |
| Remove Warp per-card Add/Update/Delete consistently | implemented | Negative assertions at `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:121` through `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:123`. |
| Preserve Warp lattice offset controls and point count | implemented | `apps/editor/src/workspace/panels/parameter-binding-section.tsx:115` through `apps/editor/src/workspace/panels/parameter-binding-section.tsx:137`; test assertion at `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:120`. |
| Preserve Warp/Opacity value display and slider behavior where present | implemented | Numeric slider/value editor remains at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:169`; e2e sees Warp opacity binding slider at `apps/editor/e2e/psd-import.e2e.spec.ts:369`. |
| Focused model/component/canvas tests cover materialization and UI cleanup | implemented | Re-review escalated Vitest run passed 5 files / 29 tests. |
| Focused Playwright proof covers the user workflow | implemented | Re-review escalated Playwright run passed all 10 `psd-import` tests, including the target Rotation authoring test. |
| After-save/load assertion if stable, or rationale | implemented | Source includes portable save/load Rotation translation authoring and restored assertions at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:76` and `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:236`; Gnome report records this path passed. I did not rerun this file in re-review. |
| Preserve package-format / production package behavior | implemented | `git diff --name-status -- packages` remains package-test-only in reviewed scope; `packages/authoring-core/src/portable-project-bundle.test.ts` adds runtime evaluation assertions only. |
| No dependency addition or forbidden Cubism/package-format scope | implemented | Dependency guard passed; no manifest/lockfile/package-format change found. |
| No slider performance, mesh generation, renderer, Viewer, Texture Atlas, Variant, Dynamics, Cubism, external transport, or LLM/provider work | explicit non-goal | No matching in-scope production diff found; dependency guard passed. |
| Editor app type errors from previous review are fixed in Wave75 Domain A files | implemented | See Fix Loop 1 Re-review. Remaining app typecheck failures are outside changed Domain A files. |

## Fix Loop 1 Re-Review

Previous blocking issue: `apps/editor` typecheck failed in Domain A changed files.

Status: resolved for Wave75 Domain A.

Evidence:

- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:22` through `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:58` now keeps `materializeKeyform` on `RotationTranslationEditMode`, not `RotationAngleEditMode`.
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:520` through `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:530` consumes `materializeKeyform` as a translation mode, and `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:723` through `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:740` returns it after narrowing `bindingProjection`.
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:114` through `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:118` now narrows the keyform set before mapping `key.value`.
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:10` imports `ParameterId`, and the helper uses it at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:818` and `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:874`.
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:143` through `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:185` adds `keyformSetCount` / `keyformKeyCount` to read-model fixtures.

`pnpm.cmd --dir apps/editor run typecheck` still fails, but the remaining failures are in:

- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts`
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`
- `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`

`git diff --name-only --` those four files returned no output in this worktree, and they are not listed as Wave75 Domain A changed/expected files in the assignment. I classify these remaining app typecheck failures as outside this Spec Compliance lane's Wave75 Domain A scope.

## Findings

No blocking findings.

No needs-change findings.

## Verification Commands Run

| Command | Result |
|---|---|
| `pnpm.cmd --dir apps/editor run typecheck` | failed, but only in files outside the Wave75 Domain A changed/expected set; previous Domain A failures are gone. |
| `git diff --name-only -- apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts` | no output; remaining app typecheck error files have no current diff. |
| `pnpm.cmd typecheck` | passed. |
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/panels/parameter-bar.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts` | sandbox run failed with esbuild `spawn EPERM`; escalated rerun passed 5 files / 29 tests. |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts -g "authors Rotation angle"` | escalated run passed. Due package script argument handling, it ran all 10 `psd-import` tests, including the target Rotation authoring test. |
| `node scripts/check-source-organization.mjs` | passed. |
| `node scripts/check-dependencies.mjs` | passed. |

## Residual Risks

- `apps/editor` full package typecheck remains red from files outside this domain's changed/expected scope. This is a repo/app baseline or other-lane issue, not a Wave75 Domain A spec-compliance blocker after Fix Loop 1.
- The Playwright command intended to grep one test ran the full `psd-import` spec because of package script argument handling. This is non-blocking because all 10 tests passed and the target test at `apps/editor/e2e/psd-import.e2e.spec.ts:538` ran.
- I reviewed but did not rerun `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`; source assertions cover restored Rotation translation at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:236`, and the Gnome report records this path passed.
- The workspace remains dirty from Wave74 and Wave75 work. I did not revert or edit production files.

## User-Decision Points

None.

