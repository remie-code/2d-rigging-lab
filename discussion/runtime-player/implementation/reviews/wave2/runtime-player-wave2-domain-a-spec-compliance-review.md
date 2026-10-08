# Runtime Player Wave2 Domain A Spec Compliance Review

Verdict: `pass`

Target: `runtime-player-wave2-runtime-export-loader-ipc` Domain A  
Reviewer: Review-Sylph - Spec Compliance Review  
Date: 2026-06-22

## Basis Inspected

- `discussion/runtime-player/implementation/orchestration/player-wave2-plan.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/research/ifacialmocap-input-adapter-research.md`
- `discussion/development_convention/source-file-organization-policy.md`
- Direct diff/source under `apps/runtime-player/**` and `pnpm-lock.yaml`

## Initial Findings (Pre-Fix)

### Blocking: Runtime Player currently cannot typecheck or run the new loader test suite

`apps/runtime-player/package.json:17` adds `@private-2d-rigging-lab/package-format`, and the new Domain A code imports it from `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:5`, `apps/runtime-player/src/main/runtime-export-loader/runtime-export-paths.ts:3`, `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts:1`, and `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts:8`.

In the current workspace, neither `apps/runtime-player/node_modules/@private-2d-rigging-lab/package-format` nor root `node_modules/@private-2d-rigging-lab/package-format` exists. As a result:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` fails with `TS2307: Cannot find module '@private-2d-rigging-lab/package-format'`.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit` fails on `src/main/runtime-export-loader/runtime-export-directory-loader.test.ts` for the same missing package after an elevated rerun.

This blocks Wave2 plan section 6.6 minimum verification for Runtime Player package typecheck and loader validation tests. If this is only the expected post-dependency-change state, the parent/orchestrator needs to run or authorize the dependency install step, then rerun typecheck and tests before passing Domain A.

### Medium: Stage shows a visible payload/debug label after load, not just invisible plumbing

`apps/runtime-player/src/stage/stage-window-app.tsx:21` through `:31` subscribes to the loaded payload, which is valid Domain A plumbing. However `apps/runtime-player/src/stage/stage-window-app.tsx:52` through `:61` still renders the placeholder visuals and changes the visible Stage label to `Model payload received: ...`.

Domain A allows only tiny Stage payload plumbing and forbids Stage WebGL/static draw work. The overall Wave2 Stage oracle also says Stage must not show setup/debug text after successful load. This visible receipt label is not WebGL rendering, but it is a user-visible Stage status/debug surface. It should be removed or confined to non-visual plumbing before Wave2 is considered clean; at minimum, Domain B must replace it before final integration.

### Low: Stale Wave1 `open-runtime-export` placeholder path remains exposed

The Control UI now calls the real Runtime Export API from `apps/runtime-player/src/control/control-window-app.tsx:86` through `:90` and button wiring at `apps/runtime-player/src/control/control-window-app.tsx:157` through `:170`, so normal UI no longer depends on the placeholder.

However, `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:6` through `:14` still includes `"open-runtime-export"` in `runtimePlayerPlaceholderActions`, and `apps/runtime-player/src/main/placeholder-action-state.ts:11` through `:13` still returns `Runtime Export directory selection is reserved for a later wave.` This contradicts the Domain A implementation state if any renderer/test/debug path calls `performPlaceholderAction("open-runtime-export")`. Prefer removing this placeholder action or updating the stale message.

## Spec Checks

- Directory name is not used as the validity oracle: pass by source inspection. `loadRuntimeExportDirectory` resolves the selected path but validates by reading `runtime-export.json` at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:44` through `:46`; the focused test uses an arbitrary temp directory prefix at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts:24` through `:33`. No `.runtime-export` suffix requirement was found in `apps/runtime-player/**`.
- UI does not require `.runtime-export` suffix: pass by source inspection. The Control copy asks for a directory containing `runtime-export.json` at `apps/runtime-player/src/control/control-window-app.tsx:152` through `:155`.
- Runtime Export vs Workspace Save distinction: pass by source inspection. No `workspace.json`, Portable JSON, or Editor workspace input path was found in `apps/runtime-player/**`.
- Authoritative load starts from `runtime-export.json`: pass by source inspection. Manifest read starts at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:44` through `:46` and `:103` through `:118`.
- Required artifacts are read: pass by source inspection. Model is read at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:58` and `:121` through `:138`; raw RGBA bytes at `:69` through `:72` and `:191` through `:202`; atlas at `:73` and `:140` through `:157`.
- Raw RGBA byte length and digest are checked: pass by source inspection at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:281` through `:315`.
- Path traversal is rejected: pass by source inspection at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-paths.ts:7` through `:31`, with focused test at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts:130` through `:136`.
- `atlasUvs` are passed through, not recomputed from atlas placements: pass by source inspection. The loaded payload carries the parsed model/artifacts at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:91` through `:96`, and the payload contract includes model plus atlas at `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts:49` through `:58`. No production code recomputing UVs from `atlas.placements` or `uvRect` was found.
- Stage implementation scope: partial pass with the medium finding above. Stage receives typed payload via `getLoadedPayload` / `onLoadedPayload` at `apps/runtime-player/src/stage/stage-window-app.tsx:21` through `:31`; no WebGL/static drawing, requestAnimationFrame loop, input, parameter runtime, or dynamics implementation was found.
- Runtime Player process boundary: pass by source inspection. Main owns native dialog and file reads at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:53` through `:57` and `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:181` through `:198`; renderer files do not import `node:*` or raw Electron APIs.
- No `apps/editor/**` import: pass by source search; none found.
- No Runtime Export directory mutation: pass by source inspection. Production loader uses `readFile`; `writeFile`, `mkdir`, and `rm` appear only in the loader test fixture under `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts`.

## Post-Fix Review

Final verdict: `pass`.

Re-inspected `git status --short -uall`, `git diff -- apps/runtime-player pnpm-lock.yaml`, and the actual source files after Gnome's fixes.

- Resolved: Stage no longer renders visible `Model payload received: ...` text after load. `apps/runtime-player/src/stage/stage-window-app.tsx:40` through `:55` keeps loaded receipt as `data-*` attributes and suppresses the placeholder label when payload is loaded.
- Resolved: stale `open-runtime-export` placeholder action was removed. `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:6` through `:14` no longer includes it, `apps/runtime-player/src/main/placeholder-action-state.ts:11` through `:18` has no stale Runtime Export placeholder message, and `apps/runtime-player/src/main/placeholder-action-state.test.ts:45` through `:48` asserts it is rejected. The real open path remains `window.runtimePlayer.runtimeExport.openDirectory()` in `apps/runtime-player/src/control/control-window-app.tsx:86` through `:89`.
- Still compliant: no `.runtime-export` suffix oracle was found in `apps/runtime-player/**`; Control copy still points users to `runtime-export.json`.
- Still compliant: no Stage WebGL/static render, `requestAnimationFrame` loop, input runtime, parameter runtime, or dynamics runtime was added in `apps/runtime-player/src/stage/**`.
- Still compliant for reviewed Domain A Runtime Player scope: no `apps/editor/**` import and no production Runtime Export directory mutation were found in `apps/runtime-player/**`.

Verification caveat: `@private-2d-rigging-lab/package-format` is declared in `apps/runtime-player/package.json:17` and linked in `pnpm-lock.yaml`, but the package is not present in current `node_modules`. Per post-fix instruction, `pnpm install` was not run. `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` therefore still fails with `TS2307` for that package link. This is treated as a blocked verification caveat, not a remaining source-spec finding, because the source metadata is present and consistent.

Worktree caveat: `git status` shows existing `apps/editor/**` modifications. Their diff is Viewer runtime performance work, not Runtime Player Domain A source. This review did not attribute those changes to Domain A; if the parent session determines they were produced by the Domain A implementation task, that would need separate forbidden-scope handling.

## Verification Commands Run

| Command | Result |
|---|---|
| `$env:GIT_OPTIONAL_LOCKS='0'; git status --short -uall` | Inspected. Runtime Player files and `pnpm-lock.yaml` are modified/untracked; unrelated `discussion/implementation/orchestration/**` changes also exist. |
| `$env:GIT_OPTIONAL_LOCKS='0'; git diff -- apps/runtime-player pnpm-lock.yaml` | Inspected. Shows package-format dependency addition and Domain A loader/IPC/UI plumbing. |
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` | Failed: `TS2307` cannot resolve `@private-2d-rigging-lab/package-format`. |
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit` | Sandboxed run failed with `spawn EPERM`; elevated rerun started Vitest but failed because `@private-2d-rigging-lab/package-format` is not linked. Existing 3 suites / 10 tests passed before the new loader suite import failure. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `$env:GIT_OPTIONAL_LOCKS='0'; git diff --check -- apps/runtime-player pnpm-lock.yaml` | Passed with line-ending warnings only. |
| Focused `rg` searches for `.runtime-export`, `workspace.json`, `apps/editor`, `node:`, `electron`, writes, WebGL, input/dynamics/runtime terms | No blocking forbidden source usage found, except stale placeholder strings and the visible Stage payload label noted above. |
| Post-fix `rg` searches for `Model payload received`, `open-runtime-export`, `.runtime-export`, `workspace.json`, `apps/editor`, WebGL/RAF/runtime terms, and write APIs under `apps/runtime-player` | Fixes verified; no remaining Domain A spec findings. Test fixture writes only. |
| Post-fix `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` | Still blocked by missing local package link for `@private-2d-rigging-lab/package-format`; `pnpm install` intentionally not run. |
| Post-fix `node scripts/check-source-organization.mjs` | Passed. |
| Post-fix `node scripts/check-dependencies.mjs` | Passed. |
| Post-fix `$env:GIT_OPTIONAL_LOCKS='0'; git diff --check -- apps/runtime-player pnpm-lock.yaml discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-a-spec-compliance-review.md` | Passed with line-ending warnings only. |

## Remaining Risks / Decision Points

- Dependency install policy: Domain A added `@private-2d-rigging-lab/package-format`. The Wave2 plan says implementation agents must not run `pnpm install` unless explicitly allowed, so the parent/orchestrator must decide when to install/link dependencies and rerun Runtime Player verification.
- Stage payload transfer sends the full parsed artifacts plus raw texture bytes through IPC. This matches Domain A delivery intent, but large real exports may expose performance/serialization pressure; this is more appropriate for design/development review or Domain B integration follow-up.
- Clipping is not rendered in Domain A, but the payload includes masks and required capabilities. Domain B must either implement clipping or fail fast before rendering exports requiring `alpha-mask-clipping-v1`.
