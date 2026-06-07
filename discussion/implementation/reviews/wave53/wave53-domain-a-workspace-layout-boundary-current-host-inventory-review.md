# Wave53 Domain A Review: Workspace Layout Boundary / Current Host Inventory

## verdict

`pass`

No blocking findings. The Domain A boundary report is consistent with the Wave53 plan, Wave52 final baseline, screen-design basis, and the bounded current source/test facts reviewed here. Domains B and C may start in parallel after this review is accepted, under the ownership constraints in the report.

## basis used

- Required skills and policies:
  - `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
  - `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
  - `.agents/skills/implementation-orchestration/SKILL.md`
  - `discussion/development_convention/source-file-organization-policy.md`
- Planning and baseline:
  - `discussion/implementation/orchestration/wave53-plan.md`
  - `discussion/implementation/orchestration/wave52-plan.md`
  - `discussion/implementation/waves/wave52/wave52-final-integration-report.md`
  - `discussion/implementation/reviews/wave52/wave52-final-integration-review.md`
  - `discussion/implementation/current-capability-map.md`
  - `discussion/implementation/remaining-work-backlog.md`
- Design and test basis:
  - `discussion/design/codex-friendly-automation-policy.md`
  - `discussion/design/screen-design/_map.md`
  - `discussion/design/screen-design/scope-and-principles.md`
  - `discussion/design/screen-design/overview.md`
  - `discussion/design/screen-design/screens/authoring-workspace.md`
  - `discussion/design/screen-design/components/toolbox.md`
  - `discussion/design/screen-design/components/parts-tree.md`
  - `discussion/design/screen-design/components/drawable-inspector.md`
  - `discussion/design/screen-design/components/parameter-keyform.md`
  - `discussion/design/screen-design/screens/psd-import-task.md`
  - `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
  - `discussion/design/screen-design/screens/codex-automation-view.md`
  - `discussion/tests/traceability/test-traceability-matrix.md`
  - `discussion/tests/fixtures/fixture-manifest.md`
- Bounded source/test/tooling inspection:
  - `apps/editor/src/main.ts`
  - `apps/editor/src/app/editor-app.ts`
  - `apps/editor/src/ui/app-shell/app-shell.ts`
  - `apps/editor/src/ui/app-shell/shell-surfaces.ts`
  - `apps/editor/src/ui/app-shell/task-shell.ts`
  - `apps/editor/src/ui/app-shell/app-shell.test.ts`
  - `apps/editor/src/ui/app-shell/task-shell.test.ts`
  - `apps/editor/src/editor-state/editor-test-ids.ts`
  - `apps/editor/e2e/test-ids.mjs`
  - `apps/editor/e2e/smoke-checks.mjs`
  - the five PSD focused smoke files for task-open/test-id preservation
  - `scripts/focused-e2e-registry.mjs`
  - `scripts/wave42-focused-e2e-boundary.mjs`
  - `scripts/check-production-testid-boundary.mjs`
  - `package.json`
  - `apps/editor/src/styles/editor.css` only to verify the report's current workspace CSS claim

## findings, blocking first

Blocking findings: none.

Non-blocking observations:

- The target report cites `apps/editor/src/styles/editor.css` for the current two-column workspace grid but does not list that file in "Bounded Source Files Inspected." The CSS fact is accurate, so this is documentation hygiene rather than a required fix.
- The working tree already contains uncommitted discussion/orchestration changes outside this review artifact (`discussion/implementation/_map.md`, `discussion/implementation/orchestration/_map.md`, `wave53-plan.md`, and the target Domain A report). I did not attribute those to this review and did not edit them.

## contract consistency check

- Domain A source boundary: pass. The reviewed work is a boundary/report artifact. `git status --short -uall` showed no source, test, script, package, lockfile, fixture, or generated asset changes from this review scope.
- Current host facts: pass. `main.ts` mounts through `mountEditorApp(root)`. `editor-app.ts` owns `activeTask: "psdImport" | null`; `onOpenPsdImportTask` sets `"psdImport"` and `onCloseActiveTask` resets `null`. `app-shell.ts` builds `main.editor-shell`, one `section.editor-workspace`, shell-surface metadata, the legacy host append sequence, the PSD task launcher, and the optional PSD task shell. `editor.css` still uses `minmax(0, 1fr) minmax(320px, 440px)` with a single-column fallback under `860px`.
- PSD Import preservation: pass. `app-shell.test.ts` asserts the PSD panel is absent by default, `psdImport.task.open` is present, active PSD import renders in a Task Shell, and `explicitPsdImport.panel` remains inside that shell. The five PSD focused smokes open the task by `psdImport.task.open` when `explicitPsdImport.panel` is absent.
- Visible-surface classification: pass. The report's normal human UI, debug/evidence, Codex/automation, and reachable-but-not-primary classifications match the screen-design docs and current shell-surface metadata.
- B/C/D ownership matrix: pass. The matrix keeps B and C out of final `app-shell.ts` integration, `editor-app.ts`, broad CSS, e2e, scripts, and package metadata, while assigning final layout wiring and PSD entry preservation to D. This matches Wave53 dependency design and the source-file organization policy.
- DOM/text oracle and `data-testid` boundary: pass. The report accurately calls out existing e2e `querySelector([data-testid=...])` plus text oracles, the mirrored `editor-test-ids.ts` / `test-ids.mjs` risk, and the production guard that forbids production `[data-testid]` selectors/readbacks while preserving assignment-only test hooks.
- Domain E regression targets: pass. The listed editor smoke/layout paths, five Wave52 PSD focused IDs, production `data-testid` guard, focused registry, parser boundary, Wave42 quality gate, source/dependency checks, type/unit/e2e baseline, and diff hygiene are consistent with Wave53 verification planning and Wave52 final evidence.

## B/C parallel-start recommendation

Domains B and C may start in parallel after this review is accepted.

Required constraints:

- B and C should create or factor disjoint component files and focused tests only.
- Neither B nor C should perform final `createEditorAppShell` wiring, shared responsive CSS, e2e updates, package/script changes, or PSD workflow/content changes.
- Any need to edit `app-shell.ts`, `editor-app.ts`, `editor.css`, shared test IDs, or focused e2e should be escalated to D or the parent orchestration context rather than handled inside B/C.

## residual risks

- `app-shell.ts` remains the main shared collision point and is intentionally reserved for D.
- B and C both may use `apps/editor/src/ui/app-shell/**`; they should avoid creating a shared barrel or central integration file that would collide.
- Existing e2e text oracles remain brittle. Wave53 should preserve stable wrappers or add narrow structured hooks instead of weakening assertions.
- The production `data-testid` guard is static text/regex based and does not prove runtime behavior or every dynamic selector construction.
- The PSD task observation summary still exposes interim text mentioning `diagnosticsEvidenceView`; that is acceptable for Wave53 but should not be mistaken for final Diagnostics / Evidence navigation design.

## user-decision points

No user decision is required before Domains B and C start.

Future decisions remain outside this gate: final Toolbox placement beyond the accepted v0 skeleton, final modal/task-window/dedicated-view policy, final Diagnostics / Evidence View, final Codex / Automation View, broader DOM/text oracle migration, and any scope change toward Mesh / Atlas / Parameter Manager / Variant Manager or smart automation.

## verification performed

- Loaded the required orchestration/context-hygiene skills and source organization policy.
- Read the target Domain A report directly.
- Read Wave53/Wave52 planning and Wave52 final baseline documents.
- Read the relevant screen-design and automation policy documents.
- Inspected bounded current source/test/tooling paths for app mount, shell/task metadata, Task Shell, current host append order, stable IDs, focused PSD opening preconditions, production `data-testid` guard behavior, focused e2e registry, and package script names.
- Checked traceability and fixture notes for the Wave52 PSD task migration and focused PSD regression IDs.
- Ran `git status --short -uall` to verify no source/test/script/package/lockfile changes were part of this review work.
- Ran `git diff --check -- discussion`; it returned no whitespace errors, with existing LF/CRLF working-copy warnings only.
- Checked this review artifact for trailing whitespace.
- Did not run unit/e2e/guard commands; this is an independent boundary report review, not an implementation verification run.
