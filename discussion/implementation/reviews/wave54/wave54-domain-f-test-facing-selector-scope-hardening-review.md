# Wave54 Domain F Review: Test-facing / Selector Scope Hardening

> Target: `test-facing-selector-scope-hardening`  
> Role: independent Review-Sylph  
> Loop: 1 / 2  
> Verdict: `pass`

## Scope Reviewed

Reviewed only the Domain F target files:

- `apps/editor/e2e/selector-scopes.mjs`
- `apps/editor/e2e/layer-controls-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/composition-persistence-smoke.mjs`
- `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs`
- `apps/editor/e2e/topology-uv-persistence-smoke.mjs`
- `apps/editor/e2e/psd-import-focused-smoke.mjs`
- `apps/editor/e2e/psd-import-plan-focused-smoke.mjs`
- `apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs`
- `apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs`
- `apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs`

Other concurrent `apps/editor/src/**` changes were visible in the worktree but are owned by Domains B/C/D/E and were not reviewed here.

## Basis

- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave54-plan.md`
- `discussion/implementation/waves/wave54/wave54-domain-a-boundary-current-surface-inventory-report.md`
- `discussion/implementation/reviews/wave54/wave54-domain-a-boundary-current-surface-inventory-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- Minimal refs: `discussion/tests/traceability/test-traceability-matrix.md`, `discussion/tests/fixtures/fixture-manifest.md`
- Domain F target diff and current file contents.

## Findings

Blocking findings: none.

Non-blocking residuals:

- `openExplicitPsdImportTask()` still uses document-wide lookup for the opener (`apps/editor/e2e/selector-scopes.mjs:29-30`) before asserting the opened panel inside the scoped task window (`apps/editor/e2e/selector-scopes.mjs:33-37`). This is acceptable for Domain F because the current opener is the single Toolbox task item (`apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts:214-225`) and the task-window result is scoped by `data-shell-surface-id`, `data-shell-surface-group`, and `data-task-window-scope`. If Domain G adds another PSD opener, G/H should scope the launcher click to the Toolbox surface.
- The provided known failure for `node scripts/run-focused-e2e.mjs --id psdImportFocused` occurs after task open/parse at a PSD content assertion expecting `psd:root/layer[0]`. Domain F only centralized the open helper and selector scoping; it did not change the PSD content oracle. Treat this as a C/G/H integration residual, not a Domain F selector-scope blocker. H/final verification still must rerun the focused PSD IDs.

## Compliance Review

`pass`

Domain F changes stay test-facing. The new helper module is under `apps/editor/e2e/` and uses `data-testid` plus shell metadata only from e2e browser assertions. No production behavior is added that queries `data-testid`, and `pnpm.cmd run check:testids` passed.

The duplicate `drawable.list` ambiguity is reduced:

- Parts Tree interactions now use `selectorScopes.partsTree`, including layer visibility, move controls, layer order reads, and reset assertions (`apps/editor/e2e/layer-controls-smoke.mjs:40`, `apps/editor/e2e/layer-controls-smoke.mjs:72`, `apps/editor/e2e/layer-controls-smoke.mjs:318`, `apps/editor/e2e/smoke-checks.mjs:1093`).
- Legacy Drawable Authoring assertions now use `selectorScopes.legacyDrawableAuthoring`, including create/restore paths in smoke, composition, canvas mesh, and topology UV checks (`apps/editor/e2e/smoke-checks.mjs:365`, `apps/editor/e2e/composition-persistence-smoke.mjs:130`, `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:170`, `apps/editor/e2e/topology-uv-persistence-smoke.mjs:200`).
- `assertScopedTestIdUnique()` ensures each scoped surface contains exactly one target test id before order/control assertions, while still allowing the document to contain duplicate `drawable.list` hooks in different surfaces (`apps/editor/e2e/selector-scopes.mjs:102`).

No product feature implementation, B/C/D/E/G ownership, dependency churn, lockfile churn, or broad e2e rewrite was found in the Domain F target diff.

## Test Adequacy

`pass`

The checks are appropriate for Domain F's narrow selector/test-facing goal. They cover syntax, production `data-testid` guard behavior, fixture guard behavior, focused e2e registry integrity, and whitespace safety. Full browser focused PSD execution remains an integration gate for H/final verification because the known failure is not introduced by the selector-scope helper.

## Verification Performed

- `node --check` on all 11 Domain F e2e target files: pass.
- `pnpm.cmd run check:testids`: pass.
- `pnpm.cmd run check:testids:fixtures`: sandbox run failed with `spawnSync node EPERM`; escalated rerun passed 5 fixture cases.
- `node scripts/check-focused-e2e-registry.mjs`: pass, 24 entries.
- `git diff --check -- <Domain F target files>`: pass; only CRLF working-copy warnings were emitted.

## Verdict

`pass`

Domain G may consume Domain F outputs. G/H should keep the residual PSD focused e2e failure and possible future multi-launcher opener scoping in their integration/verification pass, but neither blocks Domain F.
