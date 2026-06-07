# Wave51 Domain D Test / Evidence Surface Preparation Review

- verdict: `pass`
- role: clean Review-Sylph
- scope: source review only, except this review artifact

## Files Reviewed

- `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts`
- `apps/editor/src/editor-state/explicit-psd-import-task-observation.test.ts`
- `apps/editor/src/editor-state/index.ts`

Authoritative checks used:

- `git status --short -uall`
- `git diff -- apps/editor/src/editor-state/index.ts`
- Direct reads of the two untracked new files, because plain `git diff` does not show untracked files.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave51-plan.md`
- `discussion/implementation/waves/wave51/wave51-domain-a-boundary-coupling-target-inventory-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-a-boundary-coupling-target-inventory-review.md`
- `discussion/implementation/waves/wave51/wave51-domain-b-psd-import-production-coupling-removal-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-b-psd-import-production-coupling-removal-review.md`
- `discussion/implementation/waves/wave51/wave51-domain-c-task-view-shell-foundation-report.md`
- `discussion/implementation/reviews/wave51/wave51-domain-c-task-view-shell-foundation-review.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Findings Ordered By Severity

None.

## Review Checks / Evidence

1. Domain D scope is respected.
   - The implementation adds a local editor-state projector in `explicit-psd-import-task-observation.ts:80-116` plus a barrel export in `index.ts:20`.
   - There are no UI, e2e, `ai-interface`, command host, transport, Product Preflight, or Diagnostics / Evidence View implementation changes in the Domain D target files.

2. The structured surface contains the required minimal status fields.
   - Source loaded, parse status, selected scope, import-plan observation, structural scaffold observation, concise human summary, and evidence boundary are modeled in `explicit-psd-import-task-observation.ts:69-78`.
   - Import-plan status, approval, candidate counts, readiness, and warning count are projected at `explicit-psd-import-task-observation.ts:119-144`.
   - Structural scaffold status, approval, approved group/leaf counts, runtime-hidden count, readiness, and warning count are projected at `explicit-psd-import-task-observation.ts:146-174`.
   - Evidence availability and detail counts route to `diagnosticsEvidenceView` at `explicit-psd-import-task-observation.ts:176-217`.

3. Human summary boundary is preserved.
   - `humanSummary.text` is built only from parse/source status, import-plan counts, structural scaffold counts, warning count, and the Diagnostics / Evidence route at `explicit-psd-import-task-observation.ts:246-305`.
   - The source file does not project operation IDs, approval IDs, plan/source digests, generated refs, evidence paths, raw parser payloads, command payloads, or parser-private shapes into `humanSummary.text` or `evidenceBoundary.summary`.
   - The test explicitly seeds those machine-only values and checks they are excluded from the concise summaries at `explicit-psd-import-task-observation.test.ts:119-135`.

4. Compatibility is not weakened.
   - `index.ts` remains barrel-only; the only change is `export * from "./explicit-psd-import-task-observation.js";` at `index.ts:20`.
   - Static search found the new projector is referenced only by its test and the editor-state barrel. No existing UI text, `data-testid`, e2e DOM oracle, Codex command schema, or ai-interface schema is removed or changed by the target files.

5. Forbidden scope was not introduced.
   - The Domain D target files do not add Product Preflight redesign, external transport, repo-side proposal/repair generation, Mesh / Atlas / Parameter / Variant capability, ai-interface churn, or a full UI move.
   - References to generated mesh IDs in the test are fixture data used to prove machine-only refs stay out of concise summaries, not a new mesh feature.

6. Source organization is acceptable.
   - `explicit-psd-import-task-observation.ts` has a single responsibility: projecting existing explicit PSD import state into a bounded task observation surface.
   - `index.ts` remains a re-export surface only.
   - `node scripts/check-source-organization.mjs` passed in this clean review.

7. Tests are focused and meaningful.
   - Idle state and disabled readiness are covered at `explicit-psd-import-task-observation.test.ts:12-53`.
   - Parsed/ready import-plan and structural scaffold status, warning counts, evidence counts, and selected scope are covered at `explicit-psd-import-task-observation.test.ts:55-99`.
   - Blocked structural status without commit readiness is covered at `explicit-psd-import-task-observation.test.ts:101-117`.
   - Machine-only ref exclusion is covered at `explicit-psd-import-task-observation.test.ts:119-136`.
   - Barrel export exposure is covered at `explicit-psd-import-task-observation.test.ts:138-143`.

8. Orchestration compliance is satisfied for this review.
   - The assignment states source implementation was delegated to Gnome.
   - This review was performed as a separate clean Review-Sylph review.
   - I did not edit source files; only this review artifact was written.

## Verification Checked / Performed

Checked Orch-Sylph evidence:

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/explicit-psd-import-task-observation.test.ts`
  - sandbox run failed earlier with `spawn EPERM`
  - approved rerun passed: 1 file, 5 tests
- `pnpm.cmd typecheck`: passed
- `node scripts/check-source-organization.mjs`: passed
- `git diff --check -- apps/editor/src/editor-state discussion/implementation/waves/wave51 discussion/implementation/reviews/wave51`: passed with only LF/CRLF warning on `apps/editor/src/editor-state/index.ts`

Performed in this clean review:

- Reviewed `git status --short -uall`.
- Reviewed `git diff -- apps/editor/src/editor-state/index.ts`.
- Read the untracked `explicit-psd-import-task-observation.ts` and `explicit-psd-import-task-observation.test.ts` directly.
- Checked existing plan status types for import-plan and structural scaffold readiness compatibility.
- Ran `git diff --check -- apps/editor/src/editor-state discussion/implementation/waves/wave51 discussion/implementation/reviews/wave51`; passed with only the existing LF/CRLF warning.
- Ran `node scripts/check-source-organization.mjs`; passed.
- Performed focused static searches for new projector usage, forbidden-scope terms, UI/test-id/command-surface churn, and machine-only refs in the source projection.

I did not independently rerun Vitest or typecheck in this clean review; I checked the passing Orch-Sylph verification evidence and performed focused static/source checks.

## Residual Risks / Deferred Debt

- The new observation surface is prepared but not yet consumed by UI, e2e, or Codex-facing surfaces. Later domains must wire consumers deliberately rather than rendering `selectedScope` refs as human-primary text.
- Tests cover one blocked structural approval status (`preflightBlocked`) but do not exhaustively parameterize every known structural approval status (`structuralPlanStale`, `approvalSelectionMismatch`, `structuralExpansionCapExceeded`). This is acceptable for Domain D, but future schema evolution should add coverage if new statuses become user-facing.
- Broad DOM/text oracle migration and the production `data-testid` dependency guard remain Domain E or later work.
- Product Preflight, Diagnostics / Evidence final presentation, Codex / Automation placement, and structural-specific Codex execute/stale parity remain deferred decisions outside Domain D.

## User-Decision Points

None for Domain D.
