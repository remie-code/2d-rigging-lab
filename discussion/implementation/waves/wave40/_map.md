# Wave40 Map

> Lightweight map for Wave40 completion artifacts.

## Status

- Wave: `codex-facing-rigging-edit-proposal-api-diff-validation-surface-v0`
- Verdict: `pass`
- Evidence level: `implementation-proven`
- Clean integration review: `pass`

## Domain Reports

| Domain | Report |
|---|---|
| A. Codex proposal API contract foundation | [domain-a-codex-proposal-api-contract-foundation-report.md](domain-a-codex-proposal-api-contract-foundation-report.md) |
| B. Operation catalog and proposal intake validation | [wave40-domain-b-operation-catalog-proposal-validation-report.md](wave40-domain-b-operation-catalog-proposal-validation-report.md) |
| C. Dry-run diff and rerun validation bridge | [domain-c-dry-run-diff-rerun-validation-bridge-report.md](domain-c-dry-run-diff-rerun-validation-bridge-report.md) |
| D. Approval transcript evidence bridge | [wave40-domain-d-approval-transcript-evidence-bridge-report.md](wave40-domain-d-approval-transcript-evidence-bridge-report.md) |
| E. Editor proposal review workflow | [wave40-domain-e-editor-proposal-review-workflow-report.md](wave40-domain-e-editor-proposal-review-workflow-report.md) |
| F. Proposal fixtures focused coverage | [wave40-domain-f-proposal-fixtures-focused-coverage-report.md](wave40-domain-f-proposal-fixtures-focused-coverage-report.md) |
| G. Proposal API diff validation e2e smoke | [wave40-domain-g-proposal-api-diff-validation-e2e-smoke-report.md](wave40-domain-g-proposal-api-diff-validation-e2e-smoke-report.md) |
| H. Final report | [wave40-final-report.md](wave40-final-report.md) |

## Review Artifacts

- Clean integration review: [../../reviews/wave40/wave40-clean-integration-review.md](../../reviews/wave40/wave40-clean-integration-review.md)
- Review map: [../../reviews/wave40/_map.md](../../reviews/wave40/_map.md)

## Final Verification

- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:unit`: pass, 217 files / 1094 tests after delegated catalog wording fix.
- `pnpm.cmd test:e2e`: pass after delegated stale Product Preflight e2e assertion fix.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`: pass with LF-to-CRLF warnings only.
- Dependency manifest/lockfile status: no changes.

## Boundary

Wave40 proves deterministic Codex proposal intake, validation, diff preview, rerun validation / Product Preflight, approval-gated commit, transcript/evidence recording, Editor review workflow, fixtures, and desktop/mobile e2e smoke.

It does not implement repo-side proposal generation/ranking, LLM/provider/prompt, natural-language repair, auto-fix/auto-commit, external transport, parser/image decode, archive/filesystem implementation, full renderer, pixel oracle, Cubism compatibility, external dependency, or manifest/lockfile changes.
