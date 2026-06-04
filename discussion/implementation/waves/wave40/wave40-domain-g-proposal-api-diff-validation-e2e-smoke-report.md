# Wave40 Domain G: Proposal API / Diff Validation E2E Smoke Report

## Verdict

- Implementation verdict: `implemented`
- Date: 2026-06-04
- Domain: `wave40-proposal-api-diff-validation-e2e-smoke`

## Scope Implemented

- Added a focused browser e2e smoke spec for the Editor Codex proposal review surface:
  - desktop and mobile viewports,
  - tutorial mini model setup,
  - deterministic pasted Codex proposal JSON intake,
  - proposal validation, operation list, diff preview, rerun validation / Product Preflight,
  - manual approval request, manual approval record, and explicit commit.
- Synced e2e test-id mirror with the Codex proposal review IDs already present in `apps/editor/src/editor-state/editor-test-ids.ts`.
- Kept source implementation unchanged; no app source, package source, manifests, or lockfiles were edited.

## Files Changed

- `apps/editor/e2e/codex-proposal-review-smoke.mjs`
  - New focused e2e smoke spec.
- `apps/editor/e2e/test-ids.mjs`
  - Added Codex proposal review test IDs for e2e readability.
- `discussion/implementation/waves/wave40/wave40-domain-g-proposal-api-diff-validation-e2e-smoke-report.md`
  - This completion report.

## Verification

- `node apps/editor/e2e/codex-proposal-review-smoke.mjs`: pass.
  - Desktop: `proposal_wave40E2eCodexReview r34->r35`.
  - Mobile: `proposal_wave40E2eCodexReview r34->r35`.
- `git diff --check -- apps/editor/e2e/test-ids.mjs apps/editor/e2e/codex-proposal-review-smoke.mjs discussion/implementation/waves/wave40/wave40-domain-g-proposal-api-diff-validation-e2e-smoke-report.md`: pass after report write; Git emitted LF-to-CRLF working-copy warnings only.
- Explicit trailing-whitespace scan for untracked Domain G files: pass.
- Forbidden scope / claim scan over changed Domain G e2e/report files: pass for positive support claims. Hits are limited to negative assertion strings and report prose that says the scope was not implemented.

Not run:

- `pnpm.cmd typecheck`: app source was not touched.
- `pnpm.cmd run check:source`: app source was not touched and no source organization risk was introduced.

## E2E Assertions Covered

- Proposal intake uses deterministic repo/tool-side JSON in the e2e spec, not repo-generated AI candidate output.
- Sections are visible/readable after review:
  - proposal metadata,
  - proposal operations,
  - validation and validation issues,
  - diff preview,
  - rerun validation / Product Preflight,
  - approval and commit path.
- Approval safety is asserted:
  - request approval button is manually clicked,
  - record approval button is manually clicked,
  - commit button remains disabled until the recorded approval,
  - package revision remains `r34` through review, approval request, and approval record,
  - proposed part is absent before explicit commit,
  - package revision advances to `r35` only after clicking `Commit approved proposal`.
- Positive forbidden support claims are asserted absent from the rendered Codex proposal review panel:
  - repo-side candidate generation/ranking,
  - LLM/provider/prompt,
  - natural-language repair,
  - auto-fix / automatic commit support,
  - parser/image decode,
  - archive/filesystem,
  - renderer/pixel oracle,
  - Cubism compatibility/support.

## Boundary Notes

- No proposal validation engine, diff engine, approval lifecycle, Product Preflight engine, parser, image decode, archive/filesystem, renderer, pixel oracle, Cubism, external transport, dependency, manifest, or lockfile work was added.
- `index.ts` files were not edited.
- The e2e smoke intentionally allows negative safety text such as `Automatic commit disabled`; this is not treated as a positive automatic-commit support claim.

## Review-Fix Readiness

- Ready for independent Review-Sylph review.
- Suggested review focus:
  - whether the e2e oracle is strong enough for approval safety,
  - whether the forbidden-support-claim assertions distinguish positive claims from negative safety text,
  - whether leaving the root e2e aggregator unchanged is acceptable under Domain G's allowed write scope.

## Remaining Issues / User-Decision Points

- No Domain G user-decision point identified.
- The root `scripts/editor-e2e-smoke.mjs` aggregator was not edited because it is outside the allowed write scope for Domain G.
