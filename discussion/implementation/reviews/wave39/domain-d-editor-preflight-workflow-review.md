# Wave39 Domain D Review: Editor Product Preflight Workflow

## Verdict

pass

## Scope Reviewed

- Re-reviewed Domain D after fix loop 1 using actual source, tests, reports, and diff output. Gnome's fix summary was not used as the only source.
- Source review was read-only. Only this review artifact was updated.
- Tracked Domain D diff under `apps/editor/src/**`.
- Untracked Domain D files:
  - `apps/editor/src/editor-state/product-preflight-state.ts`
  - `apps/editor/src/editor-state/product-preflight-state.test.ts`
  - `apps/editor/src/editor-workflow/product-preflight-workflow.ts`
  - `apps/editor/src/editor-workflow/product-preflight-workflow.test.ts`
  - `apps/editor/src/ui/product-preflight/index.ts`
  - `apps/editor/src/ui/product-preflight/product-preflight-panel.ts`
  - `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts`
  - `discussion/implementation/waves/wave39/domain-d-editor-preflight-workflow.md`
- Relevant surrounding wave status showed other Wave39 changes outside Domain D; they were not reviewed as Domain D source.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave39-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave39/domain-a-preflight-report-contract-foundation.md`
- `discussion/implementation/waves/wave39/domain-b-validator-product-report-aggregation.md`
- `discussion/implementation/waves/wave39/domain-c-runtime-package-ai-evidence-bridge.md`
- `discussion/implementation/waves/wave39/domain-d-editor-preflight-workflow.md`
- Previous version of this review artifact.

## Prior Finding Closure

### Closed: warning / needs-review diagnostic refs in failed categories

`state.warnings` now scans every category via `report.categories.flatMap(projectWarningStates)` at `apps/editor/src/editor-state/product-preflight-state.ts:137`. `projectWarningStates` filters `category.diagnosticRefs` for warning semantics before falling back to category-level `warn` summaries at `apps/editor/src/editor-state/product-preflight-state.ts:175` through `apps/editor/src/editor-state/product-preflight-state.ts:210`. This means warning or `needs_review` diagnostic refs are no longer gated on `category.status === "warn"`.

The focused state projection test now creates a failed `modelStructure` category with a `needs_review` diagnostic at `apps/editor/src/editor-state/product-preflight-state.test.ts:17` through `apps/editor/src/editor-state/product-preflight-state.test.ts:40`, then asserts the overall report remains `fail` while both failed-category and warning-category diagnostics are present in `state.warnings` at `apps/editor/src/editor-state/product-preflight-state.test.ts:74` through `apps/editor/src/editor-state/product-preflight-state.test.ts:99`.

The panel test fixture keeps the warning section tied to `modelStructure` at `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:35` through `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:40` and `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:153` through `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:160`.

### Closed: app-shell Product Preflight wiring assertion

The app shell still creates the panel with `options.state.productPreflight`, package-loaded status, package revision, and optional callback at `apps/editor/src/ui/app-shell/app-shell.ts:348` through `apps/editor/src/ui/app-shell/app-shell.ts:355`, then appends it into the shell at `apps/editor/src/ui/app-shell/app-shell.ts:381` through `apps/editor/src/ui/app-shell/app-shell.ts:398`.

The focused shell test now asserts the panel is present, the run button is enabled, and clicking it reaches the shell callback at `apps/editor/src/ui/app-shell/app-shell.test.ts:627` through `apps/editor/src/ui/app-shell/app-shell.test.ts:643`.

## Findings

- None.

## Additional Review Notes

- Report truthfulness remains contained: the UI renders category summary, blocking issues, warnings, not-supported claims, and not-evaluated claims without mapping unsupported or not-evaluated states to pass.
- Non-goal scan found no new Product Preflight repair UI, executable AI command host wiring, LLM provider claims, parser/image decode/archive/filesystem implementation, renderer/pixel claims, or Cubism support claims. Search hits were the Domain D report's non-goal statements or pre-existing unrelated editor surfaces/tests.
- Development compliance passes for Domain D: changed `index.ts` files are barrel-only re-export surfaces, and no package manifest or lockfile changes were present in the Domain D scope.
- Domain D report is truthful about residual boundaries: e2e remains Domain F, AI observation remains helper/schema-only from Domain C, and the UI reruns from editor session state rather than persisting a preflight artifact into package files.

## Verification Performed

- `git status --short -uall`: confirmed Domain D files are present along with other Wave39 worktree changes outside this review scope.
- `git diff -- apps/editor/src/app/editor-app.ts apps/editor/src/editor-state/editor-semantic-state.ts apps/editor/src/editor-state/editor-state-projections.ts apps/editor/src/editor-state/editor-test-ids.ts apps/editor/src/editor-state/index.ts apps/editor/src/editor-workflow/index.ts apps/editor/src/editor-workflow/workflow-controller.ts apps/editor/src/styles/editor.css apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/app-shell/app-shell.ts discussion/implementation/waves/wave39/domain-d-editor-preflight-workflow.md`: inspected tracked Domain D diff; LF-to-CRLF warnings only.
- Read all untracked Domain D source, tests, and completion report files directly.
- `rg -n "warnings|needs_review|needs-review|diagnosticRefs|warning" apps/editor/src/editor-state/product-preflight-state.ts apps/editor/src/editor-state/product-preflight-state.test.ts apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts`: confirmed fix-loop coverage for failed-category warning projection.
- `rg -n "productPreflight|Product Preflight|onRunProductPreflight|run product preflight|createProductPreflightPanel" apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/app/editor-app.ts`: confirmed shell and app wiring.
- `rg -n "repair|auto-fix|autofix|LLM|provider|parser|decode|archive|filesystem|File System|renderer|pixel|Cubism|AI command|command host" apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/ui apps/editor/src/app discussion/implementation/waves/wave39/domain-d-editor-preflight-workflow.md`: no Domain D non-goal violation found.
- `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/*/package.json`: no manifest or lockfile changes.
- `pnpm.cmd exec vitest run apps/editor/src/editor-state/product-preflight-state.test.ts apps/editor/src/editor-workflow/product-preflight-workflow.test.ts apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts`: pass, 5 files / 29 tests.
- `pnpm.cmd typecheck`: pass for root and editor.
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave39/domain-d-editor-preflight-workflow.md discussion/implementation/reviews/wave39/domain-d-editor-preflight-workflow-review.md`: pass with LF-to-CRLF warnings only.

Note: local sandboxed command startup repeatedly failed with `windows sandbox: spawn setup refresh`, so read-only review commands and verification commands were run with approved `require_escalated` execution. No source edits were made.

## Review Artifact Updated

- `discussion/implementation/reviews/wave39/domain-d-editor-preflight-workflow-review.md`

## Remaining Issues

- None for Domain D after fix loop 1.
- E2E desktop/mobile coverage remains Domain F scope.

## User-Decision Points

- None.
