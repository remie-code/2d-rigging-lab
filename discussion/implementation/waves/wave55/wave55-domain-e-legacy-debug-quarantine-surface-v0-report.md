# Wave55 Domain E Report: Legacy / Debug Quarantine Surface v0

> Target: `wave55-legacy-debug-quarantine-surface-v0`  
> Role: Domain E Orch-Sylph  
> Verdict: `pass`  
> Scope: Primary Human UI から外される legacy/debug/support panels の最小非 primary quarantine surface を source/test 実装し、clean-context review で確認する。

## 1. Verdict

`pass`

Domain E は、legacy/support panels を通常 Primary Authoring Workspace に残す実装ではなく、Domain G が後で接続できる non-primary / internal debug / quarantine surface を追加した。

Domain E 自身は live App Shell cutover、primary removal、final routing、full Diagnostics/Evidence、full Codex/Automation、PSD task redesign、Product Preflight redesign を行っていない。これは Domain A の ownership contract と整合している。

Domain G/F may consume: yes.

## 2. Basis

参照した主な基礎文書:

- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave55-plan.md`
- `discussion/implementation/waves/wave55/wave55-domain-a-reset-boundary-ownership-contract-report.md`
- `discussion/implementation/reviews/wave55/wave55-domain-a-reset-boundary-ownership-contract-review.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-primary-ui-quarantine.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-state-operation-contracts.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/screens/codex-automation-view.md`
- `discussion/development_convention/source-file-organization-policy.md`

## 3. Delegation

Gnome implementation:

- Agent: `019ea444-c9fa-7361-8b23-6041c42706a1`
- Result: `done`
- Fix loops: 0

Review-Sylph clean review:

- Agent: `019ea44b-1bd8-7743-8847-cdacdba20c61`
- Result: `pass`
- Review artifact: `discussion/implementation/reviews/wave55/wave55-domain-e-legacy-debug-quarantine-surface-v0-review.md`

Orchestration compliance:

- Orch-Sylph did not implement source directly.
- Source implementation was delegated to a separate Gnome context.
- Review was delegated to a separate clean Review-Sylph context.
- Review-Sylph received basis docs and changed file paths, not only Gnome's explanation.

## 4. Changed Files

Domain E source/test changes:

- `apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.ts`
- `apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.test.ts`

Domain E persistent artifacts:

- `discussion/implementation/waves/wave55/wave55-domain-e-legacy-debug-quarantine-surface-v0-report.md`
- `discussion/implementation/reviews/wave55/wave55-domain-e-legacy-debug-quarantine-surface-v0-review.md`

Observed concurrent worktree changes outside Domain E were not reverted or modified by this domain.

## 5. Implementation Summary

The new `createLegacyDebugQuarantineSurface()` factory creates a minimal quarantine wrapper for legacy/debug panel nodes.

Boundary metadata is explicit:

- `data-shell-surface-id="legacyDebugQuarantineSurface"`
- `data-shell-surface-kind="debug-quarantine"`
- `data-shell-surface-group="debug-quarantine"`
- `data-shell-surface-primary="false"`
- `data-primary-authoring-surface="false"`
- `data-authoring-workspace-flow="false"`
- `data-internal-debug-surface="true"`
- `data-quarantine-surface="true"`
- `data-primary-ui-absence="normal-authoring-workspace-does-not-mount-legacy-panels"`
- `data-quarantine-presence="legacy-panel-reachability-preserved-outside-primary-flow"`

The component appends passed panel nodes under a quarantine host, preserving reachability without cloning or reclassifying them as primary UI. Empty state copy makes it clear that primary absence is expected and that Domain G must attach any internal legacy/debug panels later.

## 6. Verification

Targeted verification performed:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.test.ts`: passed, 5 tests.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check -- apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.ts apps/editor/src/ui/app-shell/legacy-debug-quarantine-surface.test.ts`: passed.

Note: the first sandboxed Vitest run failed with `spawn EPERM` while starting esbuild. The same targeted command was rerun with approval outside the sandbox and passed.

Review verification:

- Review-Sylph checked source/test files directly against the Wave55 plan, Domain A ownership contract, UI reset inventories, Diagnostics/Evidence and Codex/Automation screen specs, and source file organization policy.
- Review verdict: `pass`.
- Blocking findings: none.

## 7. Residual Risks

- The quarantine surface is component-level only. It is not wired into live App Shell. Domain G owns consumption, cutover, and non-primary reachability.
- Primary first viewport absence and quarantine route/drawer reachability still require G/F/H integration or e2e verification.
- G should pass individual legacy panel nodes into the quarantine surface, not the old `authoring-workspace-support` wrapper.
- F should treat primary absence and quarantine presence as separate oracles.
- `data-testid` remains test-facing metadata only and must not become production behavior control.

## 8. Consumption Guidance

Domain G may consume `createLegacyDebugQuarantineSurface()` only as a non-primary internal/debug quarantine surface. It must not mount this as a replacement primary workspace region and must not use it to keep legacy panels in normal authoring flow.

Domain F may use the metadata to distinguish:

- primary UI absence: legacy panels are not in normal authoring workspace / first viewport.
- quarantine presence: required debug/evidence/test reachability remains available outside primary flow.

Domain H should verify the integrated behavior after G cutover.
