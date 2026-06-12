# Wave62 Domain C Review: Rig Tool Deformer Tree / Warp Deformer Editor v0

## Status

pass

## Scope Reviewed

Reviewed independently as Review-Sylph from basis docs, worktree status, app/editor diff, direct source/test reads, Domain B contract artifacts, and verification commands. I did not edit source files; this review artifact is the only authored output.

Primary scope:

- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- Domain C report: `discussion/implementation/waves/wave62/wave62-domain-c-rig-tool-deformer-tree-editor-v0-report.md`

Related Domain A/B changes are present in the worktree. I only reviewed package/mesh changes where needed to confirm Domain C contract usage and shared Canvas overlay interaction.

## Design / Development Compliance Findings

No blocking findings.

- Left pane `Parts` / `Deformers` toggle is placed in the Structure pane header actions, with the Parts view retaining the existing `parts-tree` rows and DnD/visibility handlers; Deformer view switches to `DeformerTreeView` (`apps/editor/src/workspace/panels/structure-tree-panel.tsx:66`, `:88`, `:93`, `:248`).
- Deformer Tree displays draft summary, committed Warp Deformer rows, selected state, child counts, and bound Drawable reference rows without changing Parts Tree membership or draw order (`apps/editor/src/workspace/panels/deformer-tree-view.tsx:17`, `:23`, `:49`, `:81`).
- Rig Tool state covers Project/none empty state, Part Container descendant target picker, Drawable single-target start, draft editor, and committed Warp Deformer read-only summary (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:38`, `:48`, `:214`, `:380`).
- Inspector includes required draft fields: name, parent deformer, bound children summary, domain bounds, Transform divisions explicitly worded as control point counts, Bezier divisions, readonly fixed Bezier edit type, fit/reset, Apply/Cancel (`apps/editor/src/workspace/panels/rig-tool-inspector.tsx:214`, `:239`, `:261`, `:287`, `:297`, `:331`, `:341`, `:349`).
- Canvas projection and renderer distinguish draft/committed deformer overlays, show domain bounds, transform grid/control points, and Bezier guide grid; state reflection data attributes are exposed for E2E without pixel assertions (`apps/editor/src/workspace/canvas/canvas-projection.ts:249`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:124`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:502`-`:522`).
- Apply uses the Domain B `createWarpDeformer` operation contract. The editor creates the DTO from draft state, commits through `operationType: "createWarpDeformer"`, clears draft only after commit, and selects the committed rig control (`apps/editor/src/features/editor-session/model/rig-tool-state.ts:197`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:287`, `apps/editor/src/features/editor-session/editor-session-context.tsx:379`-`:394`).
- Domain B storage/read boundary is respected: operation stores `warpLattice2d` with `warpDeformer` metadata and retains `bilinearGridV1` / `storedNotEvaluatedV0` evaluation boundaries (`packages/operation-core/src/operations/create-warp-deformer.ts:196`, `:204`-`:221`; `packages/package-format/src/warp-deformer-projection.ts:44`-`:69`).
- No package contract redesign, new dependencies, manifest/lockfile changes, full keyform authoring, Parameter Manager work, physics/dynamics work, subtree opacity implementation, Cubism compatibility claim, or pixel oracle was found in Domain C scope. `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json` returned no files.

## Test Adequacy Findings

No blocking findings.

- Unit tests cover create payload/package operation integration, draft creation, committed Deformer Tree projection, and draft/committed Canvas projection (`apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:64`, `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:29`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:258`).
- The changed E2E follows the accepted E2E oracle: it exercises the user path and state reflection only, using role/test hooks and canvas data attributes; it does not assert screenshots, pixel output, layout geometry, or visual parity (`apps/editor/e2e/psd-import.e2e.spec.ts:253`-`:301`).
- Test coverage is adequate for v0. Non-blocking gap: parent/child Deformer hierarchy and parent dropdown are implemented in source, but the E2E path covers a single created deformer only. Add a focused nested-deformer test when parent binding becomes a routine user path.

## Verification Performed / Observed

- `git status --short -uall`: observed expected Domain C app files plus concurrent Domain A/B package/mesh changes and Domain reports.
- `git diff -- apps/editor`: reviewed app/editor diff; untracked new Domain C files were read directly.
- `pnpm.cmd --dir apps/editor typecheck`: pass.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`: initial sandbox run failed with `esbuild` `spawn EPERM`; approved rerun passed, 3 files / 13 tests.
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`: initial sandbox run failed with `spawn EPERM`; approved rerun passed, 5 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `git diff --check`: pass; output contained CRLF normalization warnings only.
- Extra whitespace check for untracked new Domain C files with `rg -n '[ \t]+$' ...`: no matches.

## Required Fixes

None.

## Residual Risks

- Committed Warp Deformer settings are read-only because Domain B intentionally did not add an update-settings operation. This matches v0 scope.
- Bezier edit surface is displayed and persisted but not runtime-evaluated; runtime remains existing bilinear lattice behavior. This is documented and acceptable for Wave62.
- The editor locally mirrors the package-format read projection to avoid a new app dependency. This is acceptable for v0 but should be revisited if the Warp Deformer read model expands.
- Parent/child Deformer hierarchy has source support but limited user-path coverage in the current E2E, as noted above.

## User-Decision Points

None.
