# Wave41 Domain D Review: Editor Product Preflight Comparison Workflow

## Verdict

`pass`

## Scope Reviewed

- `apps/editor/src/editor-state/product-preflight-comparison-state.ts`
- `apps/editor/src/editor-state/product-preflight-comparison-state.test.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/product-preflight-comparison-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts`
- `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts`
- `apps/editor/src/ui/product-preflight/product-preflight-panel.ts`
- `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `discussion/implementation/waves/wave41/domain-d-editor-product-preflight-comparison-workflow-report.md`

Clean-context review used the basis documents, prior Wave41 reports/reviews, changed source files, scoped diffs, and local verification commands. The Domain D implementation report was read but not treated as the only source of truth.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave41-plan.md`
- `discussion/implementation/waves/wave41/domain-a-product-preflight-diff-contract-foundation-report.md`
- `discussion/implementation/waves/wave41/domain-b-validator-report-diff-evidence-navigation-engine-report.md`
- `discussion/implementation/waves/wave41/domain-c-ai-editor-session-preflight-read-diff-bridge-report.md`
- `discussion/implementation/reviews/wave41/domain-a-product-preflight-diff-contract-foundation-review.md`
- `discussion/implementation/reviews/wave41/domain-b-validator-report-diff-evidence-navigation-engine-review.md`
- `discussion/implementation/reviews/wave41/domain-c-ai-editor-session-preflight-read-diff-bridge-review.md`
- `discussion/implementation/reviews/wave41/domain-e-product-preflight-diff-fixtures-focused-coverage-review.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Findings By Severity

No blocking or needs-fix findings.

## Design / Development Compliance Review

Pass.

- Domain boundary is respected. The new editor workflow adapter calls Domain C `createEditorProductPreflightReadDiffBridge` and injects Domain B `buildProductPreflightReportDiff` as the provider (`apps/editor/src/editor-workflow/product-preflight-comparison-workflow.ts:25`, `apps/editor/src/editor-workflow/product-preflight-comparison-workflow.ts:30`). It does not redesign the contract, validator diff engine, or AI command bridge.
- The editor state projection consumes existing Product Preflight report/diff/rerun DTOs and maps them into display rows for current, previous, proposal-preview, summary, category transitions, evidence refs, diagnostic refs, and rerun affordances (`apps/editor/src/editor-state/product-preflight-comparison-state.ts:77`, `apps/editor/src/editor-state/product-preflight-comparison-state.ts:122`, `apps/editor/src/editor-state/product-preflight-comparison-state.ts:167`).
- Session-only scope and approval safety are explicit in UI state wording. The top-level safety label requires session-generated reports plus disabled automatic rerun, auto-fix, and automatic commit flags before showing safe wording (`apps/editor/src/editor-state/product-preflight-comparison-state.ts:141`). Rerun rows display manual request availability and disabled automatic rerun/commit wording without positive auto-fix claims (`apps/editor/src/editor-state/product-preflight-comparison-state.ts:234`, `apps/editor/src/editor-state/product-preflight-comparison-state.ts:242`).
- The UI wording is deterministic report comparison wording. The comparison section title, summary, category transition, evidence/diagnostic ref, and rerun affordance sections are structural DOM rendering only (`apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts:12`, `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts:50`, `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts:73`, `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts:95`, `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts:120`).
- Workflow wiring records current/previous Product Preflight reports in controller memory and updates comparison state after manual Product Preflight runs and reviewed Codex proposal previews (`apps/editor/src/editor-workflow/workflow-controller.ts:553`, `apps/editor/src/editor-workflow/workflow-controller.ts:1230`, `apps/editor/src/editor-workflow/workflow-controller.ts:1260`).
- Report history is cleared on package load, persistent-byte load, reset, and tutorial package creation paths, keeping the comparison session-local rather than persisted/exported (`apps/editor/src/editor-workflow/workflow-controller.ts:546`, `apps/editor/src/editor-workflow/workflow-controller.ts:1342`, `apps/editor/src/editor-workflow/workflow-controller.ts:1390`, `apps/editor/src/editor-workflow/workflow-controller.ts:1420`, `apps/editor/src/editor-workflow/workflow-controller.ts:1472`, `apps/editor/src/editor-workflow/workflow-controller.ts:1507`, `apps/editor/src/editor-workflow/workflow-controller.ts:1524`).
- Source organization is acceptable. New production source is split by responsibility: state projection, UI section rendering, and narrow workflow adapter. `apps/editor/src/editor-state/index.ts` and `apps/editor/src/editor-workflow/index.ts` are barrel-only re-exports (`apps/editor/src/editor-state/index.ts:33`, `apps/editor/src/editor-workflow/index.ts:12`).
- Dependency scope is clean. Manifest/lockfile diff check over root/editor/contracts/validator-core/ai-interface manifests and `pnpm-lock.yaml` produced no output.
- Forbidden-claim scan over Domain D source/tests/report found no positive claim or implementation for persisted/exported Product Preflight artifacts, release/demo gates, repo-side AI repair/candidate generation, LLM/provider work, natural-language repair, auto-fix, automatic commit, parser/image/archive/filesystem/renderer/Cubism work, or dependency changes. Hits were typed artifact refs, negative automatic commit wording, existing portable export/persistence code in `workflow-controller.ts`/`app-shell.ts`, tests asserting `auto-fix` is absent, and report non-goal wording.

Residual source-organization note: `workflow-controller.ts` is already a large central controller. Domain D added narrow controller wiring and kept comparison projection/rendering in separate named files, and `pnpm.cmd run check:source` passed, so this is not a fix-loop issue.

## Test Adequacy Review

Pass.

- State projection coverage verifies previous/current and current/proposal-preview diff display rows, category transitions, evidence refs, diagnostic refs, manual rerun labels, and absence of `auto-fix` text (`apps/editor/src/editor-state/product-preflight-comparison-state.test.ts:14`, `apps/editor/src/editor-state/product-preflight-comparison-state.test.ts:76`, `apps/editor/src/editor-state/product-preflight-comparison-state.test.ts:84`, `apps/editor/src/editor-state/product-preflight-comparison-state.test.ts:87`, `apps/editor/src/editor-state/product-preflight-comparison-state.test.ts:90`, `apps/editor/src/editor-state/product-preflight-comparison-state.test.ts:92`).
- Product Preflight panel tests verify deterministic comparison sections render into DOM, including summary, transitions, evidence/diagnostic refs, rerun affordance, and no `auto-fix` text (`apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:79`, `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:88`, `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:91`, `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:94`, `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:97`, `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:100`, `apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts:103`).
- Workflow coverage verifies manual Product Preflight rerun creates previous/current comparison state and Codex proposal review creates current/proposal-preview comparison state without committing the preview (`apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:10`, `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:40`, `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:96`).
- App shell coverage was included in the focused run to catch broad panel wiring regressions.

Residual test note: Domain D does not add browser/e2e visual coverage for desktop/mobile. That is acceptable here because Wave41 Domain F owns the e2e smoke. Domain D has focused state, DOM, workflow, app-shell, typecheck, and source-guard coverage for its scoped risk.

## Verification Performed

Commands required approved escalation because sandboxed PowerShell and Node REPL startup failed with `windows sandbox: spawn setup refresh`.

- `git status --short -uall`: reviewed. The worktree contains Domain D files plus concurrent Wave41 Domain A/B/C/E files and unrelated map/backlog/test-registration changes. Parallel Domain E fixture/traceability work was not modified.
- `git diff -- apps/editor/src/editor-state apps/editor/src/ui apps/editor/src/editor-workflow apps/editor/src/app discussion/implementation/waves/wave41/domain-d-editor-product-preflight-comparison-workflow-report.md`: reviewed. Note that untracked new files were read directly because normal `git diff` does not show them.
- `pnpm.cmd exec vitest run apps/editor/src/editor-state/product-preflight-comparison-state.test.ts apps/editor/src/ui/product-preflight/product-preflight-panel.test.ts apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`: pass, 5 files / 34 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui apps/editor/src/editor-workflow apps/editor/src/app discussion/implementation/waves/wave41/domain-d-editor-product-preflight-comparison-workflow-report.md`: pass with only Git LF/CRLF working-copy warnings.
- Direct `index.ts` inspection: `apps/editor/src/editor-state/index.ts` and `apps/editor/src/editor-workflow/index.ts` are barrel-only re-exports.
- Scoped dependency manifest/lockfile diff check: no output.
- Scoped forbidden-claim scan over changed Domain D files: no positive forbidden claims; hits were classified as safe context as described above.

## Remaining Issues / User Decision Points

- Fix loop required: no.
- User decision required: no.
- Remaining issue for later Wave41 work: desktop/mobile e2e smoke remains Domain F scope.
