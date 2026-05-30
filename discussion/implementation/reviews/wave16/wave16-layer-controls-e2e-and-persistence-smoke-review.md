# Wave 16 Domain E Review: Layer Controls E2E And Persistence Smoke

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Domain: `wave16-layer-controls-e2e-and-persistence-smoke`
> Date: 2026-05-30

## Verdict

`pass`

Independent Review-Sylph の初回 `escalate` 指摘を受け、hidden visibility の save/load persistence smoke を強化した。修正後の再レビューは `pass`、必須検証も通過した。

## Review Basis

- `discussion/implementation/orchestration/wave16-plan.md`
- `discussion/implementation/waves/wave16/wave16-editor-layer-controls-ui-completion.md`
- `discussion/implementation/reviews/wave16/wave16-editor-layer-controls-ui-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `apps/editor/e2e/layer-controls-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- Domain E verification results.

## Findings

### Fixed

1. Medium: 初期実装は visibility hide/show は操作していたが、保存時の最終 visibility が visible だったため、hidden state の persistence smoke として弱かった。
   - Fix: 最終状態を hidden にして保存し、package file set と再読込後 UI / preview で `runtimeVisibility: false` を検証。
   - Regression evidence: `pnpm.cmd test:e2e` pass。

### Open

None.

## Lane Review

| Lane | Result | Notes |
|---|---|---|
| Product Workflow | pass | E2E が create drawable -> hide -> show -> move up/down -> final hide -> save/load を通す。 |
| Runtime Truthfulness | pass | preview summary と preview visual presence/absence を使い、UI-only state ではなく runtime projection の変化を検証している。 |
| Persistence | pass | 保存済み `model/drawables.json` の `runtimeVisibility: false` と `model/draw-order.json` の `[created, draw_body]` order を確認し、再読込後も同じ状態を UI / preview で確認している。 |
| UI / Accessibility | pass | Domain D の test id と accessible name / disabled state を smoke-level で確認している。 |
| Development Compliance | pass | 変更は `apps/editor/e2e/**` と Domain E reports に限定。layer controls 専用 helper を分離し、既存 giant smoke file への過大追加を避けた。 |
| Test Adequacy | pass | desktop/mobile E2E、operation log count、DOM list order、saved package JSON、reload state を deterministic に検証している。 |
| Determinism | pass | 既存 sample drawable と generated smoke drawable の固定 ID を使い、row order と package order を明示的に比較している。 |

## Verification Reviewed

- `pnpm.cmd test:e2e` passed after sandbox escalation:
  - desktop smoke passed
  - mobile smoke passed
- `pnpm.cmd typecheck` passed after sandbox escalation.
- `pnpm.cmd run check:source` passed.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave16/wave16-layer-controls-e2e-and-persistence-smoke-completion.md discussion/implementation/reviews/wave16/wave16-layer-controls-e2e-and-persistence-smoke-review.md` passed with LF/CRLF warnings only.
- `Select-String -Path apps/editor/e2e/layer-controls-smoke.mjs -Pattern '[ \t]+$'` returned no matches.

## Remaining Risks

- The standard E2E runner still logs only preview/drawable screenshot metadata because `scripts/editor-e2e-smoke.mjs` was outside the user-specified write scope. The layer workflow still captures a screenshot internally and asserts deterministic DOM/package state.
- This is smoke-level a11y coverage, not a full accessibility audit.

## User-Decision Points

None.

