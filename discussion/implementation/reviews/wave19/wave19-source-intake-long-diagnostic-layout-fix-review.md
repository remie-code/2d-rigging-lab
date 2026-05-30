# Wave19 Needs-Fix Review: Source Intake Long Diagnostic Layout Fix

- Target: `wave19-source-intake-long-diagnostic-layout-fix`
- Verdict: `pass`
- Date: 2026-05-31
- Review-Sylph agent/context id: not visible in this subagent runtime; this review is by the Review-Sylph role and the final response will be associated externally.
- Gnome implementation agent/context id from parent: `019e7b18-59ba-78d2-b055-a8deee3e4f5c` (`Gnome the 55th`)

## Verdict

`pass`.

The CSS-only fix addresses the long imported-source diagnostic / data URL overflow without relaxing the horizontal overflow oracle. The change is scoped to `apps/editor/src/styles/editor.css`, does not alter markup or accessible names, and the full editor e2e smoke now passes on both desktop and mobile with the strict `expected 0` horizontal overflow assertion still in place.

## Basis Evidence

- `.agents/skills/implementation-orchestration/SKILL.md` requires Review-Sylph to use basis docs, changed files/diff, and verification evidence rather than relying only on Gnome's summary.
- `discussion/implementation/orchestration/wave19-plan.md` lists UI / Accessibility, text overflow, development compliance, and test adequacy as review lanes, and requires source implementation domains to include the source organization policy.
- `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-completion.md` records the prior accepted blocker: a valid deterministic PNG data URL diagnostic caused Source Intake horizontal overflow, and the appropriate follow-up was a narrow CSS or Source Intake diagnostic markup fix.
- `discussion/implementation/reviews/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-review.md` accepted escalation because the e2e oracle had become truthful, while the remaining blocker was production UI/CSS layout scope.
- `discussion/development_convention/source-file-organization-policy.md` keeps `index.ts` files barrel-only and forbids broad catch-all source growth. This target adds no new source files and no `index.ts` logic.

## Source And Diff Evidence

- Current `apps/editor/src/editor-state/source-intake-view-model.ts:147-148` still builds imported-source diagnostics as a single comma-joined label. This is the long-token source that exposed the data URL overflow.
- Current `apps/editor/src/ui/source-assets/source-intake-panel.ts:117-119` still renders that diagnostics label as text content inside `p.source-intake-imported-source__diagnostics`; no markup, role, label, or accessible-name path was changed by this fix.
- Current `apps/editor/src/styles/editor.css:415-430` gives the imported-source container/list/card `min-width: 0`, and gives imported-source meta, empty text, heading, path, diagnostics, layer list, and layer list items both `min-width: 0` and `overflow-wrap: anywhere`.
- Current `apps/editor/e2e/smoke-checks.mjs:76-82` still records post-source-intake overflow and later calls `assertNoHorizontalOverflowEvidence`; `apps/editor/e2e/smoke-checks.mjs:959-1003` still throws when overflow count is not `0`. The acceptance was not relaxed.
- The current dirty Wave19 worktree has many unrelated files. The relevant production source change for this target is within the allowed `apps/editor/src/styles/editor.css` scope. The same file also contains wider Wave19 Source Intake style changes already present in the dirty state; I did not attribute those to this needs-fix target.

## Findings

No blocking findings.

No accessible-name regression risk was found: this target is CSS-only, and it does not change DOM text, labels, roles, test IDs, or source-intake markup. The visual change is a narrow wrapping/min-width layout fix for imported source content, not a broad redesign.

No source-organization issue was found: no `index.ts` implementation logic, no new catch-all file, and no new broad source module were introduced.

## Verification Reviewed / Performed

| Command / Check | Result | Notes |
|---|---|---|
| `git diff -- apps/editor/src/styles/editor.css` | reviewed | Confirmed the imported-source wrapping block is present in the allowed CSS file. |
| `git diff --check -- apps/editor/src/styles/editor.css` | pass | CRLF warning only. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd typecheck` | pass after escalation | Sandbox run failed with `EPERM` reading local TypeScript executable; escalated rerun passed. |
| `pnpm.cmd test:e2e` | pass after escalation | Desktop smoke passed, mobile smoke passed, final `editor-e2e: smoke passed`. This confirms the strict horizontal overflow oracle passes after the CSS fix. |

Gnome-reported verification was also reviewed: `typecheck`, `check:source`, `test:e2e`, and `git diff --check -- apps/editor/src/styles/editor.css` were all reported pass, with only CRLF warning on diff check. The independent reruns above are consistent with that summary.

## Remaining Risks / User-Decision Points

No user decision is required for this target.

Residual risk is limited to the intentional readability tradeoff of `overflow-wrap: anywhere`: very long imported-source diagnostics, paths, headings, or layer labels may wrap at arbitrary token boundaries. That is appropriate for the current desktop/mobile no-horizontal-overflow acceptance and avoids weakening the e2e layout oracle.
