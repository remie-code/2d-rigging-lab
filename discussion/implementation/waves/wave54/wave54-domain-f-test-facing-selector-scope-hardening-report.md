# Wave54 Domain F Report: Test-facing / Selector Scope Hardening

> Target: `test-facing-selector-scope-hardening`  
> Role: Domain F Orch-Sylph  
> Loop: 1 / 2  
> Verdict: `pass`

## Verdict

`pass`

Domain F completed the selector/test-facing hardening needed for Wave54 integration. The implementation was delegated to a separate Gnome context, and the review was delegated to an independent Review-Sylph context. No direct source implementation was performed by Orch-Sylph.

Domain G may consume these outputs.

## Basis

- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave54-plan.md`
- `discussion/implementation/waves/wave54/wave54-domain-a-boundary-current-surface-inventory-report.md`
- `discussion/implementation/reviews/wave54/wave54-domain-a-boundary-current-surface-inventory-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- Minimal refs: `discussion/tests/traceability/test-traceability-matrix.md`, `discussion/tests/fixtures/fixture-manifest.md`

## Scope Changed

Domain F changed only e2e test-facing selector code:

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

Other concurrent Wave54 source changes were visible in the worktree, but they are owned by Domains B/C/D/E and were not edited or reviewed as Domain F work.

## Implementation Summary

Gnome added an e2e-only selector scope helper in `apps/editor/e2e/selector-scopes.mjs`.

The helper defines explicit observation scopes for:

- Parts Tree surface: `data-shell-surface-id="authoringWorkspace"` plus `data-shell-surface-group="parts-tree"`.
- Legacy Drawable Authoring panel: `data-testid="drawableAuthoring.panel"`.
- PSD Import task window: `data-shell-surface-id="psdImportTask"`, `data-shell-surface-group="psd-import"`, and `data-task-window-scope="workspace"`.

The changed e2e files now scope duplicate-prone `drawable.list`, drawable row, layer visibility, and draw-order selectors to Parts Tree or legacy Drawable Authoring explicitly. The PSD focused smoke files now share `openExplicitPsdImportTask()` and wait for `explicitPsdImport.panel` inside the PSD Import task window scope.

No production behavior was coupled to `data-testid`; the selector helper lives under `apps/editor/e2e/`.

## Verification

Gnome verification:

- `node --check` on the touched e2e files: pass.
- `pnpm.cmd run check:testids`: pass.
- `pnpm.cmd run check:testids:fixtures`: sandbox child `node.exe` run failed with `EPERM`; escalated rerun passed.
- `node scripts/check-focused-e2e-registry.mjs`: pass.
- `git diff --check -- apps/editor/e2e scripts apps/editor/src discussion/tests`: pass, with CRLF working-copy warnings only.

Orch-Sylph targeted verification rerun:

- `node --check` on all 11 Domain F e2e target files: pass.
- `pnpm.cmd run check:testids`: pass.
- `pnpm.cmd run check:testids:fixtures`: sandbox child `node.exe` run failed with `EPERM`; escalated rerun passed 5 fixture cases.
- `node scripts/check-focused-e2e-registry.mjs`: pass, 24 entries.
- `git diff --check -- apps/editor/e2e scripts apps/editor/src discussion/tests`: pass, with CRLF working-copy warnings only.

Known non-Domain-F failure:

- `node scripts/run-focused-e2e.mjs --id psdImportFocused` fails after task open/parse at a PSD content assertion expecting `psd:root/layer[0]`. Gnome and Review-Sylph both assessed this as a PSD content/integration residual for C/G/H, not a selector-scope blocker introduced by Domain F.

## Review

Independent review artifact:

- `discussion/implementation/reviews/wave54/wave54-domain-f-test-facing-selector-scope-hardening-review.md`

Review-Sylph verdict: `pass`.

Blocking findings: none.

Review-Sylph confirmed:

- Domain F changes remain e2e/test-facing only.
- Duplicate `drawable.list` ambiguity is reduced by explicit Parts Tree vs legacy Drawable Authoring scopes.
- Production `data-testid` behavior dependency was not introduced.
- Domain G may consume Domain F outputs.

## Residual Risks

- If Domain G introduces another PSD Import launcher, G/H should scope the launcher click to the Toolbox surface. The shared helper currently uses a document-wide lookup only for the single existing `psdImport.task.open` opener, then scopes the opened PSD panel to the task window.
- The focused PSD full browser paths still require H/final verification after C/G integration because the known `psdImportFocused` failure is outside Domain F's selector hardening scope.

## User-Decision Points

None.
