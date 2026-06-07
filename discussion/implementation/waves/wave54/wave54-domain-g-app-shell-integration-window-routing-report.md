# Wave54 Domain G Report: App Shell Integration / Window Routing

> Target: `app-shell-integration-window-routing`  
> Role: Domain G Orch-Sylph  
> Verdict: `pass`

## Verdict

`pass`

Domain G is recovered and complete. The source implementation was handled by a separate Gnome context, and the independent review was handled by a separate Review-Sylph context. Orch-Sylph did not directly implement source changes.

The prior in-progress G diff was found in G-owned integration files. Gnome inspected only the G-owned candidate files, found the partial route/window integration coherent, kept it, and verified it rather than reverting or rewriting user/other-domain changes.

## Orchestration

- Implementation delegate: Gnome.
- Review delegate: independent Review-Sylph.
- Fix loops used: 0 / 2.
- Review artifact: `discussion/implementation/reviews/wave54/wave54-domain-g-app-shell-integration-window-routing-review.md`.
- Review verdict: `pass`.

## Basis

- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave54-plan.md`
- Domain A-F reports and reviews under `discussion/implementation/waves/wave54/` and `discussion/implementation/reviews/wave54/`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Changed Files

Domain G source and test integration:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/e2e/task-window-routing-focused-smoke.mjs`
- `scripts/focused-e2e-registry.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`

Persistent artifacts:

- `discussion/implementation/waves/wave54/wave54-domain-g-app-shell-integration-window-routing-report.md`
- `discussion/implementation/reviews/wave54/wave54-domain-g-app-shell-integration-window-routing-review.md`

## Implementation Summary

- App Shell active route state now covers `psdImport`, `diagnosticsEvidence`, `codexAutomation`, and `null`.
- Toolbox entries open PSD Import, Diagnostics / Evidence, and Codex / Automation through centralized App Shell callbacks.
- PSD Import is mounted only as the active workspace-scoped task window and remains absent by default from the Authoring Workspace.
- Diagnostics / Evidence and Codex / Automation skeletons are reachable as bounded read-only skeleton surfaces, not as completed full implementations.
- Close, Back, and Escape return to the Authoring Workspace through the same close route.
- App-level focus targets the active workspace task window after render, using task-window metadata rather than `data-testid`.
- Viewer / Runtime remains on its existing dedicated-view path and was not converted into a task window.
- Focused e2e registry entries were updated narrowly for `taskWindowRoutingFocused`. Review-Sylph accepted the `scripts/**` changes as narrow focused-e2e registration required for Domain G verification.

## Verification

Gnome verification:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/app-shell/task-shell.test.ts apps/editor/src/ui/app-shell/diagnostics-evidence-view-skeleton.test.ts apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts`: pass, 47 tests. Initial sandbox run hit esbuild `spawn EPERM`; approved rerun passed.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:testids`: pass.
- `node --check apps/editor/e2e/task-window-routing-focused-smoke.mjs`: pass.
- `node scripts/check-focused-e2e-registry.mjs`: pass, 25 entries.
- `node scripts/run-focused-e2e.mjs --id taskWindowRoutingFocused`: pass. Initial sandbox run hit Vite/esbuild `spawn EPERM`; approved rerun passed.
- `git diff --check -- <G integration paths>`: pass, CRLF working-copy warnings only.
- Untracked route e2e trailing-whitespace scan: no matches.

Review-Sylph verification:

- `node --check apps/editor/e2e/task-window-routing-focused-smoke.mjs`: pass.
- `node scripts/check-focused-e2e-registry.mjs`: pass, 25 entries.
- `node scripts/check-wave42-quality-gate-boundary.mjs`: pass.
- Targeted Vitest for App Shell, task shell, and skeleton tests: pass, 47 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:testids`: pass.
- `node scripts/run-focused-e2e.mjs --id taskWindowRoutingFocused`: pass.
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`: known failure reproduced after task open and parse at the content assertion below.

## Residual Risks

- `psdImportFocused` still fails after the PSD task opens and parses. Exact failure: `status missing "psd:root/layer[0]" in "Parse StateStatusPSD parsed in browser sessionSelected leaf layers1 selected PSD leaf layer"`.
- Gnome and Review-Sylph both assessed this as not caused by G routing or selector scope. The failure is a PSD content/test-oracle residual from the concise PSD Task UI shape, where raw selected PSD refs are no longer displayed in the human Parse State. H/final verification or a PSD-content owner should resolve the oracle without reintroducing raw selected PSD node refs into the primary human task window.
- Mobile/responsive task-window verification remains for Domain H.
- Focus after task-internal rerenders is a polish risk, not a blocking Domain G finding.

## User Decision Points

None.

## Domain H Handoff

Domain H may run full and focused verification. Domain H should include:

- `taskWindowRoutingFocused`
- the required Wave54 PSD focused IDs
- desktop/mobile editor smoke and responsive checks
- production `data-testid` guard and source/dependency guards
- explicit handling of the known `psdImportFocused` content-oracle residual
