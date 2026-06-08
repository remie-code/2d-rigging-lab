# Wave55 Domain B Review: Primary Human Shell v0

> Role: independent Review-Sylph / clean review  
> Target: `wave55-primary-human-shell-v0`  
> Verdict: `pass`

## Verdict

`pass`

Domain B の変更は、Primary Human Shell v0 を live App Shell へ cutover せずに、UX-essential な primary authoring regions だけを合成する component と focused tests に閉じている。`authoring-workspace-support` / `legacy-support` を新 shell の通常構成へ持ち込まず、Toolbox の support-panel 誘導文言と compact Diagnostics Strip の details pass-through を Domain B の許可範囲で更新している。

## Scope Reviewed

Basis documents:

- `discussion/implementation/orchestration/wave55-plan.md`
- `discussion/implementation/waves/wave55/wave55-domain-a-reset-boundary-ownership-contract-report.md`
- `discussion/implementation/reviews/wave55/wave55-domain-a-reset-boundary-ownership-contract-review.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-primary-ui-quarantine.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-state-operation-contracts.md`
- `discussion/design/screen-design/inventories/ui-reset-inventory-ux-ac-test-gaps.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/development_convention/source-file-organization-policy.md`

Domain B files reviewed:

- `apps/editor/src/ui/app-shell/primary-human-shell.ts`
- `apps/editor/src/ui/app-shell/primary-human-shell.test.ts`
- `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`

Out of Domain B scope and not reviewed as B: current parallel changes under `task-shell`, `legacy-debug-quarantine`, `explicit-psd-import`, CSS, and planning/docs beyond this review artifact.

## Blocking Findings

None.

## Non-Blocking Observations / Residual Risks

- `createWorkspaceSupportRegion()` still exists in `authoring-workspace-v0-shell.ts` and still labels itself as "Workspace support panels". This is acceptable for Domain B because the new `createPrimaryHumanShell()` does not call it; Domain G must ensure the live primary cutover does not mount this legacy support region in normal primary flow.
- `createPrimaryHumanShell()` is not live-mounted by this domain, matching the forbidden final App Shell cutover boundary. Startup first-viewport absence, real browser geometry, and live App Shell behavior remain G/F/H responsibilities.
- Component tests stub most region content. They adequately prove B's slot composition and support-panel absence at the new shell boundary, but they do not prove every real downstream surface is free of all debug/internal wording under all state. That integrated visible-text gate belongs to F/G/H.
- Orch-Sylph reported an earlier `pnpm typecheck` failure in `explicit-psd-import-panel.ts`, outside Domain B. In this review run, `pnpm.cmd typecheck` passed on the current worktree, so no current typecheck blocker is attributed to Domain B.

## Design / Development Compliance Lane

`pass`

- `primary-human-shell.ts` creates a bounded `main.primary-human-shell` with optional `appBarSlot`, a primary workspace section, and `createAuthoringWorkspacePrimaryLayout(...)` for exactly these regions: Toolbox, Structure / Parts, Canvas / Preview, Inspector, Parameter Bar, and Diagnostics Strip.
- The new shell does not render `authoring-workspace-support`, `legacy-support`, support stack panels, debug/evidence/Codex-heavy panels, or PSD/task content.
- The implementation preserves state/callback ownership by slot pass-through. It does not rebuild Parts Tree, Canvas/Preview, Inspector, Parameter Bar, Diagnostics Strip, Toolbox, or workflow logic.
- `authoring-workspace-v0-shell.ts` changes are narrowly scoped: Toolbox disabled reasons no longer point users to support panels, Product Preflight wording is softened to Validation in primary launcher/status contexts, and Diagnostics Strip details can call `onOpenDiagnosticsEvidenceView`.
- Domain B did not modify `app-shell.ts`, `editor-app.ts`, broad `app-shell.test.ts`, `task-shell.ts`, PSD Import content, route wiring, or final live mount.
- No `index.ts` changes were made; source organization guard passed.

## Test Adequacy Lane

`pass`

Focused tests in `primary-human-shell.test.ts` cover the required Domain B surface:

- essential region composition and order;
- absence of `authoring-workspace-support`, `legacy-support`, and a representative forbidden legacy/debug/evidence/Codex text set;
- slot identity and callback pass-through without rebuilding region logic;
- Toolbox copy no longer directs users to support panels or Product Preflight as the primary route;
- compact Diagnostics Strip details action routes through `onOpenDiagnosticsEvidenceView`.

The tests are not weakened to hide legacy text in `app-shell.test.ts`; instead, they add a new component-level test boundary. Broader visual/geometry/e2e proof is intentionally not claimed for Domain B.

## Verification Summary

- `git diff --check -- apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts apps/editor/src/ui/app-shell/primary-human-shell.ts apps/editor/src/ui/app-shell/primary-human-shell.test.ts`: pass. Git emitted only the existing LF/CRLF warning for `authoring-workspace-v0-shell.ts`.
- `node scripts/check-source-organization.mjs`: pass.
- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/primary-human-shell.test.ts apps/editor/src/ui/app-shell/toolbox-surface.test.ts`: initial sandbox run failed with esbuild `spawn EPERM`; approved rerun passed, 2 files / 6 tests.
- `pnpm.cmd typecheck`: pass on the current worktree.

## User-Decision Points

Blocking before Domain B acceptance: none.

Deferred to later Wave55 domains:

- Final live App Shell cutover and removal of legacy support from normal startup: Domain G.
- Browser first-viewport forbidden-text scan and desktop/mobile geometry proof: Domains F/G/H.
- Final task window modality / non-modal overlay policy: Domains C/G/H or later design decision.
