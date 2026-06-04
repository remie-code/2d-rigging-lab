# Wave40 Domain E Final Re-review: Editor Proposal Review Workflow

## Verdict

`pass`

## Review Mode

- Review-Sylph independent clean-context re-review after Gnome fixes.
- Source files were reviewed read-only. This reviewer wrote only this final review artifact.
- The sandboxed shell setup repeatedly failed with `windows sandbox: spawn setup refresh`; read and verification commands were run with approved escalation.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/orchestration/wave40-plan.md`
- Wave40 Domain A/B/C/D/F reports
- `discussion/implementation/waves/wave40/wave40-domain-e-editor-proposal-review-workflow-report.md`
- `discussion/implementation/reviews/wave40/wave40-domain-e-editor-proposal-review-workflow-review.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`

## Scope Reviewed

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-state/codex-proposal-review-state.ts`
- `apps/editor/src/editor-state/codex-proposal-review-state.test.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/codex-proposal-preview-preflight.ts`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts`
- `apps/editor/src/editor-workflow/product-preflight-workflow.ts`
- `apps/editor/src/editor-workflow/product-preflight-workflow.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts`
- `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.test.ts`
- `apps/editor/src/ui/codex-proposal-review/index.ts`
- Supporting Domain B/C/D helpers where approval, validation, diff preview, and rerun validation contracts are enforced.

## Original Findings

### Fixed: Preview-scoped rerun validation / Product Preflight evidence

The Editor workflow now runs Product Preflight on the ready diff preview session before creating rerun validation:

- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:118` checks for a ready preview with `preview.previewSession`.
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:120` calls `runCodexProposalPreviewProductPreflightWorkflow()`.
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:129` creates rerun validation with `stateScope: "preview"`.
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:136` passes the preview validation report.
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:137` passes the preview Product Preflight report.

The preview preflight adapter is actually bound to the preview session:

- `apps/editor/src/editor-workflow/codex-proposal-preview-preflight.ts:50` builds the package document from `input.previewSession`.
- `apps/editor/src/editor-workflow/codex-proposal-preview-preflight.ts:56` exposes that preview document through the adapter.
- `apps/editor/src/editor-workflow/codex-proposal-preview-preflight.ts:57` exposes `authoringSession: input.previewSession`.
- `apps/editor/src/editor-workflow/codex-proposal-preview-preflight.ts:67` throws if the preview preflight adapter is asked to commit.

The positive workflow test proves review -> valid validation -> ready diff -> passing rerun validation -> request approval -> record approval -> explicit approved commit:

- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:46`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:54`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:57`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:59`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:64`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:73`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:82`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:88`

### Fixed: Commit response projection survives shared commit reset

The shared commit projection still resets stale proposal review state:

- `apps/editor/src/editor-state/editor-state-projections.ts:332`

The proposal commit path now preserves the pre-commit proposal review DTO snapshot and uses it after the commit projection:

- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:276` stores `reviewBeforeCommit`.
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:298` applies the shared commit projection after a committed operation.
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:305` calls `updateReviewApprovalResponse(nextState, commitResult.response, reviewBeforeCommit)`.
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:334` accepts an explicit review snapshot.
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:346` re-projects proposal, validation, diff, rerun, and final approval response.

The positive test checks that the review panel state remains present and shows the committed response after commit:

- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:90`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:91`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:92`

## Domain E Pass Criteria

Pass. The Editor now has a pasted Codex proposal review surface and workflow for proposal metadata, operation sequence, validation result, diff preview, rerun validation / Product Preflight, and approval-safe commit behavior.

Evidence:

- Proposal, validation, diff, rerun validation, and approval sections are rendered in `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts:38` through `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts:46`.
- Manual approval actions are separated into request, record approval, and commit approved proposal buttons at `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts:300` through `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts:323`.
- The panel is wired into the App Shell after Product Preflight and before AI Approval / Transcript at `apps/editor/src/ui/app-shell/app-shell.ts:365` through `apps/editor/src/ui/app-shell/app-shell.ts:383`, and appended at `apps/editor/src/ui/app-shell/app-shell.ts:421` through `apps/editor/src/ui/app-shell/app-shell.ts:425`.
- App callbacks call review, clear, request approval, record approval, and commit methods at `apps/editor/src/app/editor-app.ts:212` through `apps/editor/src/app/editor-app.ts:230`.
- Domain E has source/UI focused readability coverage. Actual desktop/mobile e2e smoke remains the planned Domain G responsibility.

## Safety / Boundary Review

Pass.

- No repo-side proposal generation, candidate ranking, LLM provider, natural-language repair, auto-fix, parser/image decode, archive/filesystem implementation, renderer/pixel oracle, Cubism support, or external transport was added in Domain E files reviewed.
- Forbidden-claim scan over touched Domain E files found only negative/safety wording:
  - `apps/editor/src/editor-state/codex-proposal-review-state.ts:250` says user approval is required and automatic commit is disabled.
  - `apps/editor/src/editor-state/codex-proposal-review-state.ts:451` says approval can be requested and automatic commit remains disabled.
  - tests assert absence of `auto-fix`.
- `git status --short -- package.json pnpm-lock.yaml apps/editor/package.json packages/contracts/package.json packages/ai-interface/package.json packages/operation-core/package.json packages/validator-core/package.json` produced no output.
- Production Domain E source non-ASCII scan produced no matches.

## Source Organization

Pass.

- `apps/editor/src/editor-state/index.ts`: barrel-only export file.
- `apps/editor/src/editor-workflow/index.ts`: barrel-only export file.
- `apps/editor/src/ui/codex-proposal-review/index.ts`: barrel-only export file.
- New implementation is split by responsibility: state projection, workflow wiring, preview preflight adapter, Product Preflight evidence helper, panel rendering, and focused tests.
- `pnpm.cmd run check:source`: pass, `Source organization guard passed.`

## Test Adequacy

Pass for Domain E.

- Full positive path is covered by `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:46` through `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:94`.
- Blocked approval request when rerun validation has not passed is covered by `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:32` through `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:44`.
- JSON input error state is covered by `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:96` through `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:104`.
- State projection covers empty, reviewed, requested, and approved-not-committed states in `apps/editor/src/editor-state/codex-proposal-review-state.test.ts:18` through `apps/editor/src/editor-state/codex-proposal-review-state.test.ts:70`.
- Panel rendering and disabled manual actions are covered in `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.test.ts:38` through `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.test.ts:96`.
- Product Preflight evidence completion for no binary assets and tutorial readiness is covered in `apps/editor/src/editor-workflow/product-preflight-workflow.test.ts:16` through `apps/editor/src/editor-workflow/product-preflight-workflow.test.ts:28`.

## Verification Performed

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/product-preflight-workflow.test.ts apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts apps/editor/src/editor-state/codex-proposal-review-state.test.ts apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`: pass, 5 files / 33 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui apps/editor/src/app apps/editor/src/editor-workflow discussion/implementation/waves/wave40 discussion/implementation/reviews/wave40`: pass with LF-to-CRLF working-copy warnings only.
- Barrel-only spot-check over touched `index.ts` files: pass.
- Dependency manifest / lockfile status check: no output.
- Forbidden-claim scan over touched Domain E files: no positive forbidden claims.

## Findings

None.

## Remaining Issues / User-decision Points

- No Domain E user-decision point.
- Remaining wave-level verification item: Domain G should still provide the planned desktop/mobile e2e smoke for proposal intake -> validation -> diff -> rerun validation / Product Preflight -> approval-safe behavior.
