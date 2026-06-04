# Wave41 Domain F: Product Preflight Diff E2E Smoke

## Verdict

`done`

## Files Changed

- `apps/editor/e2e/product-preflight-diff-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave41/domain-f-product-preflight-diff-e2e-smoke-report.md`

No `apps/editor/src/**`, package source, manifests, or lockfiles were touched.

## Implementation Summary

- Added focused desktop/mobile e2e smoke coverage for:
  - tutorial project setup,
  - manual Product Preflight run,
  - Codex proposal preview Product Preflight rerun,
  - manual Product Preflight rerun after preview,
  - deterministic report comparison summary,
  - category transitions,
  - evidence/diagnostic ref rows,
  - current and proposal-preview rerun affordances,
  - approval-safe pre-commit behavior.
- Added the Domain D Product Preflight comparison test ids to the e2e `test-ids.mjs` mirror.
- The smoke deliberately does not request approval, record approval, or commit. It asserts:
  - package/authoring revision stays at `r34`,
  - operation log count stays at 34,
  - proposal-created part remains absent from the committed layer tree,
  - approval request is available but record/commit buttons remain disabled,
  - diff UI stays `Preview only / not committed`,
  - comparison/rerun UI shows automatic rerun/commit disabled safety text.

## Verification

- `node apps\editor\e2e\product-preflight-diff-smoke.mjs`: pass.
  - desktop passed, screenshot captured.
  - mobile passed, screenshot captured.
- `node --check apps\editor\e2e\product-preflight-diff-smoke.mjs`: pass.
- `git diff --check -- apps\editor\e2e discussion\implementation\waves\wave41`: pass; Git emitted only the LF/CRLF working-copy warning for `apps/editor/e2e/test-ids.mjs`.
- Trailing whitespace scan over new Domain F files: pass.

`pnpm.cmd typecheck` was not required for Domain F because no `apps/editor/src/**` source files were changed.

Commands required escalation because sandboxed PowerShell continued to fail with `windows sandbox: spawn setup refresh`.

## Forbidden Scope Checks

- Forbidden claim/scope scan over changed Domain F e2e files: pass after classification.
  - Hits in `forbiddenPositiveClaims` are negative test oracles that fail if those positive claims appear in UI.
  - Hits for `automatic commit disabled` are safety assertions.
- No auto-fix, automatic commit, repo-side repair/candidate generation, LLM/provider/prompt, natural-language repair, parser/image/archive/filesystem/renderer/Cubism work, persisted/exported Product Preflight artifact, release/demo gate, dependency, manifest, or lockfile change was added.

## Remaining Issues / User Decision Points

- None for Domain F.
- Product Preflight comparison remains session-only and preview-only. This e2e does not claim persisted/exported report artifacts or release/demo gate readiness.

## Notes For Review-Sylph

- Primary review target: `apps/editor/e2e/product-preflight-diff-smoke.mjs`.
- The smoke uses the existing Node/CDP direct e2e style from `product-preflight-smoke.mjs` and `codex-proposal-review-smoke.mjs`.
- UI/source wiring was already present from Domain D; Domain F only mirrored the comparison test ids into e2e constants.
