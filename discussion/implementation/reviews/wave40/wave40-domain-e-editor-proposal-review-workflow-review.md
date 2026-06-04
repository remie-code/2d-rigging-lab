# Wave40 Domain E Review: Editor Proposal Review Workflow

## Verdict

`needs_changes`

## Review Mode

- Review-Sylph independent clean-context review.
- Source implementation was read-only. This reviewer wrote only this review artifact.
- The initial sandboxed shell process setup failed with `windows sandbox: spawn setup refresh`; subsequent read and verification commands were run with approved escalation.

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
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts`
- `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts`
- `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.test.ts`
- `apps/editor/src/ui/codex-proposal-review/index.ts`
- Relevant supporting source in `packages/ai-interface/src/**`, `packages/operation-core/src/**`, and `packages/validator-core/src/**`.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/orchestration/wave40-plan.md`
- Domain A/B/C/D/F reports and relevant Wave40 review artifacts
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`

## Findings

### High: Editor proposal review cannot reach the approval-safe commit path

`reviewCodexProposalText()` calls `createCodexProposalRerunValidationResult()` for a ready preview at `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:117`, but passes only `proposal`, `validationResult`, preview `stateBinding`, and `generatedAt` at `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:119`. It does not pass preview-scoped `rerunValidationReports` or a preview `productPreflightReport`.

The Domain C rerun helper defaults missing rerun reports to an empty array at `packages/validator-core/src/codex-proposal-rerun-validation.ts:77`, builds no Product Preflight report from an empty report list at `packages/validator-core/src/codex-proposal-rerun-validation.ts:78`, and returns `status: "not_evaluated"` when no Product Preflight report is available at `packages/validator-core/src/codex-proposal-rerun-validation.ts:106`. The Editor state requires `rerunValidationResult.status === "pass"` before enabling approval at `apps/editor/src/editor-state/codex-proposal-review-state.ts:412`, and the Domain D approval lifecycle also rejects non-pass rerun validation at `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:522`.

Impact: after a pasted proposal review, the Editor can show validation/diff information, but the implemented workflow has no source path to produce a pass rerun validation/Product Preflight result for the preview. Approval request and commit therefore remain blocked, so Domain E's required "approval-safe commit path" is not actually reachable from the Editor workflow.

Required fix: when diff preview is ready, produce or supply preview-scoped validation/Product Preflight evidence tied to `preview.previewSession`, then add a focused Editor workflow test for review -> request approval -> record approval -> commit approved proposal. The test should prove no package revision changes before commit, the revision advances only after explicit approved commit, and automatic commit remains disabled.

### Medium: Commit result projection can erase the proposal review state before displaying the committed response

`commitApprovedCodexProposalReview()` calls `applyEditorWorkflowCommitResult()` inside the commit host at `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:281`, then calls `updateReviewApprovalResponse()` after the lifecycle returns at `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:292`. The shared committed-operation projection now resets `codexProposalReview` to an empty state at `apps/editor/src/editor-state/editor-state-projections.ts:332`. If a commit succeeds, `updateReviewApprovalResponse()` sees the cleared review and returns without applying the commit response at `apps/editor/src/editor-workflow/codex-proposal-review-workflow.ts:325`.

Impact: once the high finding is fixed and a commit can succeed, the proposal review panel may clear instead of showing the committed approval/commit evidence. That weakens the Editor review surface for the final approval-safe behavior.

Required fix: preserve enough proposal review context through the proposal commit path to project the final committed response, or intentionally project a post-commit review state before clearing stale preview actions. Cover this with the same positive workflow test.

## Passing Checks

- The implementation stays within Domain E editor-state/UI/app/editor-workflow scope.
- No dependency manifest or lockfile changes were present for root or touched package manifests.
- `apps/editor/src/editor-state/index.ts`, `apps/editor/src/editor-workflow/index.ts`, and `apps/editor/src/ui/codex-proposal-review/index.ts` are barrel-only re-export files.
- New source files are split by responsibility: review state projection, workflow wiring, and panel rendering.
- UI text is generally truthful: it says pasted Codex proposal JSON, preview-only/not committed, user approval required, and automatic commit disabled. It does not claim repo-side proposal generation, LLM repair, auto-fix, parser, renderer, filesystem/archive, pixel oracle, or Cubism support.

## Test Adequacy Review

Focused tests pass, but they are not sufficient for Domain E completion. Current workflow coverage proves the blocked/not-evaluated path and JSON parse error path at `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:22` and `apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts:32`. It does not prove a ready preview with pass rerun validation, explicit approval request, recorded approval, or approved commit from the Editor workflow.

State and panel tests simulate pass/approval DTOs, but they do not exercise the real Editor workflow path that must produce those DTOs.

## Verification Performed

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/codex-proposal-review-state.test.ts apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.test.ts apps/editor/src/editor-workflow/codex-proposal-review-workflow.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`: pass, 4 files / 31 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass, `Source organization guard passed.`
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui apps/editor/src/app apps/editor/src/editor-workflow discussion/implementation/waves/wave40`: pass with LF-to-CRLF warnings only.
- Barrel-only check over touched `index.ts` files: pass.
- Manifest/lockfile status check for root and touched package manifests: no output.
- Forbidden-claim scan over Domain E files found only negative/safety wording or unrelated existing code/test uses.

## Remaining Issues / User-Decision Points

- Gnome fixes are required for the high and medium findings.
- No user-decision point identified unless the team wants Domain E to remain a blocked review-only surface. That would conflict with the current Wave40 Domain E pass evidence and should be escalated rather than treated as a pass.
