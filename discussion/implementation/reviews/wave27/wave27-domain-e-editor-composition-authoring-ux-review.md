# Wave 27 Domain E Review: Editor Composition Authoring UX

## Verdict

pass

Clean Review-Sylph inspected the basis docs, upstream Domain A-D reports/reviews, Domain E changed files, focused tests, and current verification output. I did not edit source files. This review report is the only file written by this review pass.

## Scope Reviewed

- Target: `wave27-editor-composition-authoring-ux`
- Required workflow: minimum Composition / Mask / Opacity authoring in Editor.
- Key acceptance basis:
  - `discussion/implementation/orchestration/wave27-plan.md:284`-`318`
  - `discussion/implementation/remaining-work-backlog.md:51`, `:97`-`:98`
  - `discussion/development_convention/source-file-organization-policy.md:83`-`:88`
  - `discussion/development_convention/dependency-policy.md:313`, `:377`-`:381`
- Upstream dependencies reviewed as passing: Domain A operation foundation, Domain B runtime evidence, Domain C validator diagnostics second pass, Domain D contract fixtures.

## Findings By Lane

No blocking or non-blocking findings requiring source fixes.

| Lane | Verdict | Evidence |
|---|---|---|
| Composition Semantics | pass | Editor exposes a focused `Composition / Mask / Opacity` panel with mask relation form, enable checkbox, drawable multi-selects, opacity keyform form, authored relation list, opacity keyform list, and evidence section in `apps/editor/src/ui/composition-panel/composition-panel.ts:24`-`:49`, `:54`-`:178`, `:271`-`:320`. |
| Operation Integrity | pass | UI commands are converted to `setMaskRelation` and drawable-targeted `addKeyform` opacity requests with GUI actor/surface and revision-bound requests in `apps/editor/src/editor-session/composition-command.ts:28`-`:94`; workflow commits project through `commitWorkflowSetMaskRelation` and `commitWorkflowAddDrawableOpacityKeyform` in `apps/editor/src/editor-workflow/composition-workflow.ts:23`-`:65`. |
| Runtime Evidence / Viewer / Preview Evidence | pass | Editor evidence provider adds `setMaskRelation` runtime evidence targets in `apps/editor/src/editor-session/evidence-provider.ts:661`-`:684`; Viewer recomputes runtime snapshots, validates package runtime, projects mask relations and drawable opacity evidence in `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts:122`-`:145`, `:190`-`:225`; Viewer UI displays mask and opacity evidence in `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts:56`, `:190`-`:235`. |
| UI / Accessibility | pass | Forms have section labels, form `aria-label`s, role=status diagnostics, native select/checkbox/number controls, and deterministic validation messages in `apps/editor/src/ui/composition-panel/composition-panel.ts:30`, `:60`, `:96`-`:104`, `:124`, `:159`-`:167`, `:480`-`:610`. No broad app shell redesign was introduced; shell only mounts the focused panel at `apps/editor/src/ui/app-shell/app-shell.ts:185`-`:192`, `:248`-`:254`. |
| Persistence Readiness | pass | State projection includes masks and keyform sets on initial load, commit projection, and browser-local load in `apps/editor/src/editor-workflow/workflow-state-projection.ts:20`-`:40`, `:72`-`:77`, `:98`-`:143`. Workflow test covers mask relation and opacity authoring -> Preview/Viewer -> save/load -> Viewer reinspection in `apps/editor/src/editor-workflow/composition-workflow.test.ts:7`-`:107`. |
| Development Compliance | pass | `apps/editor/src/app/editor-app.ts` is narrow callback wiring only at `:69`-`:75`. New logic is split into focused command/state/view-model/workflow/UI files. `index.ts` files remain barrel-only. `pnpm.cmd run check:source` passed. `pnpm.cmd run check:deps` passed. No Domain E target files touch `editor-preview/**`, `styles/editor.css`, package manifests, lockfile, fixtures, parser/file picker/asset I/O, renderer, or pixel oracle. |
| Test Adequacy | pass | Focused tests cover workflow persistence/evidence, invalid mask relation rejection, panel command submission/validation/rendering, app shell integration, session adapter compatibility, and viewer runtime projection. Re-run verification passed: 5 files / 41 tests. |
| Non-goals Containment | pass | I found no full canvas mask editor, brush/paint UI, full layer tree redesign, general timeline editor, renderer/pixel oracle, parser, file picker, asset I/O expansion, dependency change, Cubism compatibility claim, or broad app-shell rewrite in Domain E files. |
| Orchestration Compliance | pass | The assignment identifies Gnome implementation and separate Review-Sylph review. This review inspected docs/source/tests directly and did not rely on the implementer explanation alone. I found no evidence in the inspected artifacts that Orch-Sylph implemented source directly. |

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/composition-workflow.test.ts apps/editor/src/ui/composition-panel/composition-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`
  - pass: 5 files / 41 tests
- `pnpm.cmd typecheck`
  - pass
- `pnpm.cmd run check:source`
  - pass: Source organization guard passed.
- `pnpm.cmd run check:deps`
  - pass: Dependency guard passed.
- `git diff --check -- <Domain E target files>`
  - pass; Git printed LF-to-CRLF working-copy warnings only.

Note: `pnpm.cmd test:repo` is not a valid script in this checkout; it failed with "Command `test:repo` not found". This is not a Domain E source finding because `check:source`, `check:deps`, typecheck, and focused tests passed.

## Residual Risks

- Domain E proves save/load through focused workflow tests, not browser desktop/mobile e2e. That is expected because Wave 27 Domain F owns composition e2e persistence smoke.
- The shared worktree contains upstream Wave 27 package/runtime/validator/fixture changes outside Domain E. They were reviewed as upstream inputs, not attributed to Domain E.

## Fixes Required

None.

## User-Decision Points

None for Domain E.
