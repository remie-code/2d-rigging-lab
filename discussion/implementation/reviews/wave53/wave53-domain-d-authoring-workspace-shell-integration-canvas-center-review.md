# Wave53 Domain D Review: Authoring Workspace Shell Integration / Canvas Center

## verdict

`pass`

Blocking findings: none.

Domain D integrates the B/C workspace surfaces into the App Shell as a v0 skeleton, keeps Preview in the central Canvas region, preserves the PSD Import Task Shell path, and keeps the old support panels reachable without making PSD Import a default always-visible workspace panel again. Domain E may start after this review is accepted.

## basis used

- Required orchestration / hygiene / source organization policy:
  - `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
  - `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
  - `discussion/development_convention/source-file-organization-policy.md`
- Planning and prior wave basis:
  - `discussion/implementation/orchestration/wave53-plan.md`
  - Wave53 Domain A/B/C reports and reviews
  - `discussion/implementation/waves/wave52/wave52-final-integration-report.md`
  - `discussion/implementation/reviews/wave52/wave52-final-integration-review.md`
- Design basis:
  - `discussion/design/screen-design/overview.md`
  - `discussion/design/screen-design/screens/authoring-workspace.md`
  - `discussion/design/screen-design/components/toolbox.md`
  - `discussion/design/screen-design/components/parts-tree.md`
  - `discussion/design/screen-design/components/drawable-inspector.md`
  - `discussion/design/screen-design/components/parameter-keyform.md`
  - `discussion/design/screen-design/screens/psd-import-task.md`
  - `discussion/design/codex-friendly-automation-policy.md`
- Direct source/test inspection:
  - `apps/editor/src/ui/app-shell/app-shell.ts`
  - `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`
  - `apps/editor/src/ui/app-shell/app-shell.test.ts`
  - `apps/editor/src/styles/editor.css`
  - `apps/editor/src/ui/app-shell/toolbox-surface.ts`
  - `apps/editor/src/ui/app-shell/parts-tree-surface.ts`
  - `apps/editor/src/ui/app-shell/workspace-context-surfaces.ts`
  - Focused B/C tests for Toolbox, Parts Tree, and workspace context surfaces

## findings blocking first

Blocking findings: none.

Non-blocking observations:

- Duplicate drawable-list `data-testid` hooks now exist because `createDrawableList` is mounted in the new Parts Tree surface and the legacy Drawable Authoring support panel. This is not blocking for Domain D because both route to the same runtime visibility / move callbacks, production behavior does not query `data-testid`, and the legacy panel still preserves manual drawable creation. It is a residual E/regression risk for broad DOM helpers that return the first matching hook.
- The new primary Inspector mapper still shows some stable project identifiers, such as selected drawable and part IDs. I did not treat this as a blocker because it does not expose operation IDs, evidence paths, parser payloads, test selector details, or Codex internals, and existing B/C reviews already classify inherited technical row labels as design-polish debt. Later UI polish should prefer display names and move raw refs to details/evidence surfaces.

## design / development compliance review

`pass`

- Layout boundary: pass. `authoring-workspace-v0-shell.ts` owns a cohesive v0 layout/composition layer, while `app-shell.ts` wires it into the live shell. CSS adds the top-level v0 grid and responsive collapse only; it does not introduce a final modal/window framework or broad visual redesign.
- B/C integration: pass. App Shell consumes the Toolbox, Parts Tree, Inspector, Parameter Bar, and Diagnostics Strip factories through `createAuthoringWorkspacePrimaryLayout`. Preview is wrapped in `createCanvasPreviewRegion` and remains the central `canvas-preview` region.
- PSD task preservation: pass. `psdImport.task.open` is assigned to the Toolbox Import PSD launcher; `activeTask === "psdImport"` still renders the PSD Import Task Shell; `explicitPsdImport.panel` remains absent by default and appears only inside the task shell.
- Required controls preservation: pass. Legacy support panels remain under `legacy-support`, and tests assert the manual drawable creation form and submit route remain reachable.
- Human UI boundary: pass. The primary v0 surfaces show launcher labels, structure summaries, project/selection/tool summaries, one active parameter, and product-preflight warning summaries. Raw operation log, generated evidence, package file set, reload summary, Codex proposal/approval/transcript panels, and full PSD task details are kept in support/task surfaces rather than primary v0 surfaces.
- Automation boundary: pass. No repo-side proposal generation, semantic recognition, auto-rigging, auto-fix, external transport, renderer/pixel oracle, Cubism, or new Mesh/Atlas/Parameter Manager/Variant capability is introduced.

## test adequacy review

`pass`

Reviewed verification summary:

- Focused Vitest passed after approved rerun: `app-shell.test.ts`, `toolbox-surface.test.ts`, `parts-tree-surface.test.ts`, and `workspace-context-surfaces.test.ts`, 4 files / 37 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-production-testid-boundary.mjs`: pass.
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`: sandbox `spawn EPERM`, approved rerun passed.
- Diff checks for tracked Domain D files and no-index check for the new shell file reported no whitespace errors, only LF/CRLF warnings.

Direct test inspection:

- `app-shell.test.ts` covers the v0 skeleton regions, Preview parenting under the Canvas region, Toolbox PSD launcher, default absence of `explicitPsdImport.panel`, active PSD Task Shell rendering, observation summary hooks, support-panel classification, and manual drawable authoring route preservation.
- B/C focused tests cover launcher callback behavior, Parts Tree wrapping/callback pass-through, workspace Inspector/Parameter/Diagnostics component behavior, and the previous Parameter Bar stale-value fix.
- Responsive/browser visual smoke is appropriately deferred to Domain E because D adds the live layout skeleton but does not own the dedicated responsive verification wave.

## source organization / data-testid boundary review

`pass`

- `authoring-workspace-v0-shell.ts` has a cohesive responsibility: mapping current App Shell options into the v0 Authoring Workspace composition and human-facing summary inputs.
- No `index.ts` implementation logic, catch-all `types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts`, package metadata churn, or dependency change was introduced.
- I ran `node scripts/check-source-organization.mjs`; it passed.
- I ran `node scripts/check-production-testid-boundary.mjs`; it passed.
- Static search found production `data-testid` usage as assignment hooks only. Production source does not query `[data-testid]` or read `data-testid` for behavior.
- Duplicate drawable list test IDs are a residual test-oracle ambiguity, not a production behavior boundary violation.

## verification reviewed / performed

Performed in this review context:

- Loaded the required skills and source organization policy.
- Read the Wave53 plan, Wave52 final baseline, Domain A/B/C reports and reviews, and the relevant screen-design/automation documents.
- Inspected Domain D source/test/CSS directly, including the untracked new source files.
- Inspected B/C source and focused tests at the mapper boundary consumed by D.
- Ran `node scripts/check-source-organization.mjs`: pass.
- Ran `node scripts/check-production-testid-boundary.mjs`: pass.
- Ran `git diff --check -- apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/styles/editor.css`: no whitespace errors, LF/CRLF warnings only.
- Ran static `rg` checks for production `data-testid` behavior coupling and forbidden automation/scope terms.

Reviewed from Orch-Sylph summary:

- Focused Vitest approved rerun passed: 4 files / 37 tests.
- `pnpm.cmd typecheck` passed.
- Focused PSD Import e2e approved rerun passed.
- New-file whitespace check for `authoring-workspace-v0-shell.ts` had only expected LF/CRLF warning behavior.

Not rerun here:

- I did not rerun Vitest, typecheck, or focused e2e in this clean review after reading the recorded sandbox `spawn EPERM` behavior and approved pass evidence.

## residual risks

- Duplicate drawable-list `data-testid` hooks can make broad `findByTestId` helpers select the Parts Tree copy instead of the legacy Drawable Authoring copy. Current callbacks are equivalent for list controls, but Domain E should watch e2e selectors that intend to target manual creation or legacy authoring specifically.
- Legacy support panels still expose older evidence/debug/Codex-heavy UI below the primary v0 skeleton. This is acceptable for Wave53 v0 because required workflows are preserved, but later Diagnostics / Evidence and Codex / Automation separation waves should move those details out of the normal workspace.
- CSS responsive behavior has unit/static coverage and reasonable media rules, but still needs Domain E browser smoke for desktop/mobile overlap and scroll behavior.
- The primary Inspector mapper should eventually replace raw project IDs with more human-facing labels where possible.
- The production `data-testid` guard is static and cannot prove every possible runtime selector construction, though no behavior-coupling hit was found here.

## user-decision points

None for Domain D.

Future decisions remain outside this gate: final modal/task-window/dedicated-view policy, final Diagnostics / Evidence view, final Codex / Automation view, final manual drawable creation home after legacy panel removal, broader DOM/text oracle migration, and any scope change toward Mesh / Atlas / Parameter Manager / Variant Manager or smart automation.

## whether Domain E may start

Yes. Domain E may start.

Domain E should include the planned responsive/browser smoke and focused regression checks, with special attention to duplicate drawable-list test hooks and the continued PSD Import task-opening path.
