# Wave40 Domain D Review: Approval Transcript Evidence Bridge

## verdict

`pass`

Current final status is `pass`; earlier findings and fix-loop reviews are preserved below as review history.

## scope reviewed

- Mandatory basis documents listed in the Review-Sylph assignment, including Wave40 plan, Domains A/B/C reports and reviews, capability/backlog documents, and development policies.
- Target implementation and tests:
  - `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts`
  - `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts`
  - `packages/ai-interface/src/ai-command-transcript.ts`
  - `packages/ai-interface/src/index.ts`
  - `apps/editor/src/editor-session/codex-proposal-approval-lifecycle.test.ts`
  - `discussion/implementation/waves/wave40/wave40-domain-d-approval-transcript-evidence-bridge-report.md`
- Relevant existing approval/transcript/editor-session code in `packages/ai-interface/src/**` and `apps/editor/src/editor-session/**`.

## findings

### High: approved request IDs are not bound to the proposal being committed

`approveCodexProposal()` accepts any syntactically valid `approvalRequestId` and immediately approves that dry-run record (`packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:141` through `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:149`). `commitApprovedCodexProposal()` likewise parses the caller-supplied ID, creates proposal-specific approval/commit evidence from it, and then checks only the existing approval policy record (`packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:174` through `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:183`, `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:233` through `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:236`).

The current `InMemoryAiApprovalPolicy` validates only dry-run command ID, agent ID, and optional operation ID; it has no proposal ID binding (`packages/ai-interface/src/ai-approval-policy.ts:87` through `packages/ai-interface/src/ai-approval-policy.ts:121`). The lifecycle has a canonical ID helper for a proposal (`packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:729` through `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:734`), but the supplied ID is not compared to it during approve or commit.

Impact: an approval recorded for one proposal ID can be reused by the same agent as the `approvalRequestId` for another approval-ready proposal. That allows the second proposal to reach `host.commitOperation()` without a user approval that is specifically tied to that proposal, violating Domain D's "commit cannot happen without approval" gate.

Required fix: reject or block approval/commit when `approvalRequestId !== createApprovalRequestId(proposal)` or otherwise persist and validate proposal identity in the approval record. Add focused negative coverage proving a mismatched approved request ID does not call the commit host and records a rejected/blocked transcript entry.

### Medium: diff preview base revision is not bound to the proposal base revision

`evaluateApprovalReadiness()` verifies matching proposal IDs, ready/preview-only/valid diff status, and that `previewPackageRevision` equals proposal base revision plus operation count (`packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:434` through `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:451`). It does not verify `diffPreview.basePackageRevision` against `proposal.packageContext.basePackageRevision`, even though the diff preview contract carries that field (`packages/contracts/src/codex-proposal-results.ts:169` through `packages/contracts/src/codex-proposal-results.ts:177`).

Impact: an approval request can be made with diff evidence generated from a different base revision as long as the proposal ID and final preview revision line up. That weakens the transcript/evidence bridge because the user may approve stale or mismatched diff evidence for the proposal commit path.

Required fix: require `diffPreview.basePackageRevision === proposal.packageContext.basePackageRevision`, and add focused request/commit tests for mismatched base revision blocking with no host commit call.

## passing checks

- Commit before approval is covered by focused tests and does not call the host in the matching-ID happy path.
- Approved commit path records approval decision, commit result, and operation log evidence in focused tests.
- Proposal receipt, validation, diff preview, rerun validation, and Product Preflight evidence refs are recorded on the approval-request transcript entry in the ai-interface coverage.
- `packages/ai-interface/src/index.ts` remains barrel-only.
- No Editor broad UI, external transport, parser/image decode, archive/filesystem, renderer/pixel, Cubism, dependency, manifest, or lockfile change was found in Domain D scope.
- Forbidden-scope keyword scan hits were limited to report no-claim wording and the implementation guard that disallows automatic commit.

## verification performed

- `git status --short -uall`: reviewed tracked and untracked Domain D files plus concurrent Wave40 files.
- `git diff -- packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts packages/ai-interface/src/ai-command-transcript.ts packages/ai-interface/src/index.ts apps/editor/src/editor-session/codex-proposal-approval-lifecycle.test.ts discussion/implementation/waves/wave40/wave40-domain-d-approval-transcript-evidence-bridge-report.md`: tracked diff showed transcript/index changes; untracked lifecycle/test/report files were read directly.
- `pnpm.cmd exec vitest run packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts apps/editor/src/editor-session/codex-proposal-approval-lifecycle.test.ts packages/ai-interface/src/ai-command-transcript.test.ts`: pass, 3 files / 9 tests.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/ai-interface/src apps/editor/src/editor-session discussion/implementation/waves/wave40`: pass with LF-to-CRLF warnings for tracked ai-interface files only.
- `pnpm.cmd typecheck`: fails in out-of-scope concurrent Domain F file `packages/validator-core/src/wave40-codex-proposal-fixtures.test.ts:81` on exact optional `packageHash: string | undefined` vs `string`; no Domain D type error was observed before that failure.
- Manifest/lockfile status check for `package.json`, `pnpm-lock.yaml`, `packages/ai-interface/package.json`, and `apps/editor/package.json`: no changes.

## fix loop required

Yes. Gnome fixes are required for the approval/proposal binding issue. The diff base revision binding should be fixed in the same loop because it is a focused lifecycle readiness guard and test gap.

## remaining risks / user-decision points

- No user decision point identified.
- Multi-operation commit remains non-transactional; the implementation report documents this as a residual risk. I did not classify it as a Domain D blocker because the current domain did not add a rollback/transaction requirement.

## final rereview after fix loop

### verdict

`needs_changes`

This is report-only. The prior source/test findings are fixed, and I found no remaining source/test blocker in Domain D. The remaining issue is a stale line in the Domain D implementation report that contradicts the verified current typecheck result.

### prior finding verification

- Fixed High: approval request IDs are now bound to proposal-specific generated approval IDs in both approval and commit paths. `approveCodexProposal()` computes `expectedApprovalRequestId` and rejects mismatches before approving the policy record at `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:143` and `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:148`. `commitApprovedCodexProposal()` computes the expected ID at `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:193` and rejects mismatches before `checkCommitApproval()` or host commit access at `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:251`. Negative coverage is in `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts:247`.
- Fixed Medium: approval readiness now rejects diff previews whose `basePackageRevision` differs from `proposal.packageContext.basePackageRevision` at `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:497`. Negative coverage is in `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts:323`.

### new finding

#### Low report-only: Domain D report still contains stale global typecheck residual risk

`discussion/implementation/waves/wave40/wave40-domain-d-approval-transcript-evidence-bridge-report.md:42` says `pnpm.cmd typecheck`: pass, which matches my rerun. The same report still says `Global typecheck needs the parallel Domain F exact-optional fixture issue resolved before the whole repo is green` at `discussion/implementation/waves/wave40/wave40-domain-d-approval-transcript-evidence-bridge-report.md:58`.

Impact: persistent Domain D evidence is internally contradictory after the fix loop. This does not affect source behavior, but it should be corrected before Domain D is treated as a clean pass artifact.

Recommended fix: remove the stale residual-risk line or replace it with the current verified state.

### passing source/test checks

- Commit before approval remains gated and does not call the host in focused coverage.
- Reused approval request IDs are blocked before host commit access.
- Stale diff-preview base revisions are blocked before host commit access.
- Approved commit path records approval decision, commit result, and operation log evidence.
- Approval request transcript records proposal receipt, proposal validation, dry-run diff preview, rerun validation, and Product Preflight evidence refs.
- `packages/ai-interface/src/index.ts` remains barrel-only; current diff adds re-export lines only.
- No broad Editor UI, repo-side proposal generation, repair candidate generation/ranking, LLM/provider/prompt, natural-language repair, auto-fix, automatic commit, external transport, parser/image decode, archive/filesystem, renderer/pixel oracle, Cubism behavior, dependency manifest, or lockfile change was found in Domain D scope.

### verification performed

- `git status --short -uall`: reviewed current worktree and separated Domain D target files from concurrent Wave40 Domain F/doc/fixture changes.
- `git diff -- packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts packages/ai-interface/src/ai-command-transcript.ts packages/ai-interface/src/index.ts apps/editor/src/editor-session/codex-proposal-approval-lifecycle.test.ts discussion/implementation/waves/wave40/wave40-domain-d-approval-transcript-evidence-bridge-report.md discussion/implementation/reviews/wave40/wave40-domain-d-approval-transcript-evidence-bridge-review.md`: tracked diff shows transcript/index changes; untracked Domain D files were read directly.
- `pnpm.cmd exec vitest run packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts apps/editor/src/editor-session/codex-proposal-approval-lifecycle.test.ts packages/ai-interface/src/ai-command-transcript.test.ts`: pass, 3 files / 11 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/ai-interface/src apps/editor/src/editor-session discussion/implementation/waves/wave40 discussion/implementation/reviews/wave40/wave40-domain-d-approval-transcript-evidence-bridge-review.md`: pass with LF-to-CRLF warnings for tracked ai-interface files only.
- Forbidden-scope keyword scan over Domain D files: hits were report no-claim wording and the implementation guard that disallows automatic commit.
- Manifest/lockfile status check for `package.json`, `pnpm-lock.yaml`, `packages/ai-interface/package.json`, and `apps/editor/package.json`: no changes.

### remaining risks / user-decision points

- No user decision point identified.
- Multi-operation commit remains non-transactional; this is still a documented residual risk and not a Domain D blocker.

## final rereview after report-only fix

### verdict

`pass`

### prior finding verification

- Prior High remains fixed: proposal-specific `approvalRequestId` binding is enforced in approval and commit paths at `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:143`, `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:148`, `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:193`, and `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:251`; negative coverage remains at `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts:247`.
- Prior Medium remains fixed: diff-preview base revision is bound to proposal base revision at `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts:497`; negative coverage remains at `packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts:323`.
- Prior Low report-only finding is fixed: `discussion/implementation/waves/wave40/wave40-domain-d-approval-transcript-evidence-bridge-report.md` keeps `pnpm.cmd typecheck`: pass and no longer contains the stale Domain F / exact-optional / global typecheck residual-risk note.

### new findings

No new Domain D findings.

### verification performed

- `rg -n "Domain F|exact-optional|Global typecheck|typecheck needs|pnpm\.cmd typecheck|Residual Risks" discussion/implementation/waves/wave40/wave40-domain-d-approval-transcript-evidence-bridge-report.md`: only current `pnpm.cmd typecheck`: pass and `Residual Risks` heading remained; stale Domain F note was absent.
- `rg -n "expectedApprovalRequestId|approvalRequestId !== expectedApprovalRequestId|basePackageRevision !==|Diff preview base package revision|rejects approval request id reuse|rejects stale diff-preview" packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.ts packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts`: confirmed prior source/test fixes remain.
- `pnpm.cmd exec vitest run packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts apps/editor/src/editor-session/codex-proposal-approval-lifecycle.test.ts packages/ai-interface/src/ai-command-transcript.test.ts`: pass, 3 files / 11 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/ai-interface/src apps/editor/src/editor-session discussion/implementation/waves/wave40 discussion/implementation/reviews/wave40/wave40-domain-d-approval-transcript-evidence-bridge-review.md`: pass with LF-to-CRLF warnings for tracked ai-interface files only.
- Forbidden-scope keyword scan over Domain D files found only report no-claim wording and the implementation guard that disallows automatic commit.
- Manifest/lockfile status check for `package.json`, `pnpm-lock.yaml`, `packages/ai-interface/package.json`, and `apps/editor/package.json`: no changes.
- `packages/ai-interface/src/index.ts` remains barrel-only; current diff adds re-export lines only, with no Editor workflow/index changes.

### remaining risks / user-decision points

- No user decision point identified.
- Multi-operation commit remains non-transactional; this is documented in the Domain D report and is not a blocker for this domain.
