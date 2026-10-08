# Electron / distribution / repository health refresh

> 2026-08-08 (Asia/Tokyo) の一次調査。`workspace-activity-refresh/audit-contract.md` に従い、Electron 移行・配布・repo 健全性の現行事実と履歴・実験結果・未解決 gate を分離する。調査時 HEAD は `af5839452f0968a005cb6cd13c62b714aa4e6d4e` (`docs: refresh discussion maps`)。

## 1. Scope / inspected entry points

入口として `discussion/_conventions.md`、`discussion/_map.md`、`discussion/editor-electron-migration/**/_map.md`、`discussion/reports/workspace-activity-refresh/audit-contract.md` を確認した。照合範囲は次のとおり。

- Electron migration maps: `editor-electron-migration/_map.md`、`shell/_map.md`、`persistence/_map.md`、`cleanup/_map.md`、`packaging/_map.md`。
- Editor: `apps/editor/package.json:6-17,53-75`、`electron.vite.config.ts:11-51`、`src/main/editor-main.ts:9-37`、`src/main/window-management/editor-window-options.ts:17-32`、workspace fs IPC/store/preload、`playwright.config.ts:3-13`、`e2e/psd-import.e2e.spec.ts:20-35,753-765`。
- Runtime Player comparison: `apps/runtime-player/package.json:6-17,49-71`、`electron.vite.config.ts:15-68`。
- Repository scripts: root `package.json:7-21`、`scripts/check-dependencies.mjs`、`scripts/check-source-organization.mjs`。
- Git/worktree: current branch/HEAD, status, Electron commits, generated packaging artifact existence, and the tracked `apps/editor/test-results` paths touched by the E2E run.

## 2. Executive summary

1. Electron migration maps record WS1 shell, WS2 node:fs/IPC persistence, WS3 Web retirement, WS4 `_electron` E2E wiring, and electron-builder packaging as complete (`discussion/editor-electron-migration/_map.md:20-34`).
2. Editor’s current runtime is Electron-only: `vite.config.ts` and the old portable E2E spec are absent; `electron.vite.config.ts` defines main/preload/renderer entries (`apps/editor/electron.vite.config.ts:11-51`).
3. Editor Electron build passed outside the sandbox. The initial sandbox attempt failed at esbuild child-process spawn with `Error: spawn EPERM`; this is an environment restriction, not a TypeScript/build diagnostic. The escalated `electron:build` rerun on 2026-08-08 emitted main 9.53 kB, preload 1.24 kB, and renderer 2,316 transformed modules. These are electron-vite output units/rounding for this command, not a universal bundle-size oracle.
4. Editor package typecheck remains red with 21 `error TS` diagnostic records (manual count of the command output; branded IDs, `exactOptionalPropertyTypes`, undefined checks, and test fixture shape drift). This is a diagnostic-record count, not the 23 error-line aggregation reported by `02-editor-current-capabilities.md`; the two figures must not be compared as one normalized scale. Root `pnpm typecheck` is green, so these are package-local debt rather than a repository-wide compiler failure.
5. Editor unit tests run outside the sandbox: 62 files passed, one file failed with 4 stale expectations (493 passed, 4 skipped). The failure expects navigation entry `"import"`, while current behavior emits `"workspace"`.
6. PSD E2E was launched outside the sandbox but timed out at 244 seconds while stale tests attempted to import without first creating/opening a workspace. The source helper at `psd-import.e2e.spec.ts:753-765` still omits that precondition and native picker injection. The run’s seven tracked `test-results` paths were restored to HEAD; `apps/editor/test-results` is clean afterward.
7. Root dependency guard and soul-zone guard pass. Source-organization guard fails on the existing `apps/runtime-player/src/main/physiology/index.ts` barrel violation; this is not an Electron build failure.
8. Runtime Player remains a healthy Electron reference: package typecheck and unit tests pass (140 files / 925 tests), and its `build` (typecheck + electron-vite build) passes outside the sandbox. It uses a richer multi-entry Electron configuration than Editor (`apps/runtime-player/electron.vite.config.ts:15-68`).
9. Packaging metadata still omits `description` and `author`; electron-builder warns but the existing portable x64 artifact and current effective config are present (`apps/editor/package.json:53-75`, `apps/editor/dist/builder-effective-config.yaml`).
10. Worktree integrity is preserved: only the pre-existing Codex agent edits, `discussion/expo.zip`, and parallel workspace-refresh reports remain outside this report. No source, test, config, map, stage, or commit changes were made by this investigation.

## 3. What was built or investigated

### WS1 shell

The Editor main entry calls `startEditorMain()`, registers workspace-fs IPC handlers, creates one window, handles activate/reopen, and quits on non-macOS window closure (`apps/editor/src/main/main.ts:1-3`; `apps/editor/src/main/editor-main.ts:9-37`). BrowserWindow security options disable Node integration and enable context isolation (`apps/editor/src/main/window-management/editor-window-options.ts:17-32`). The preload exposes only the workspace-fs bridge (`apps/editor/src/preload/preload.ts:1-5`; `apps/editor/src/preload/workspace-fs-bridge.ts:10-40`).

### WS2 persistence

The main process exposes five typed IPC operations—picker, list, stat, read, and write (`apps/editor/src/main/workspace-fs/workspace-fs-bridge-handlers.ts:25-67`). The node:fs store validates workspace-relative paths and writes through same-directory temp-file plus rename (`apps/editor/src/main/workspace-fs/workspace-fs-store.ts:16-27,29-47,49-72,81-105`). The persistence map records the accepted non-blocking residuals: symlink `realpath` handling, file/directory kind collision normalization, and optional test strengthening (`discussion/editor-electron-migration/persistence/_map.md:18-26`).

### WS3/WS4 cleanup

The Web target and Vite config were retired; current PSD E2E launches the built Electron main directly and strips `ELECTRON_RENDERER_URL` (`apps/editor/e2e/psd-import.e2e.spec.ts:20-35`). Portable removal is scoped to the Editor feature layer; lower `authoring-core` and `package-format` bundles remain dormant test/contract foundations (`discussion/editor-electron-migration/cleanup/_map.md:17-25`). The Editor still has two portable dead branches: a user-facing “Portable JSON export remains available” message (`apps/editor/src/features/workspace-storage/model/workspace-storage-state.ts:38-52`) and the unused `import-portable-json` dirty-workspace reason/message (`apps/editor/src/features/editor-session/editor-session-context.tsx:557-564,939-953`).

### Packaging

Editor package metadata defines `electron-builder`, portable x64 Windows output, `build/icon.ico`, `dist:win`, and icon generation (`apps/editor/package.json:13-17,45-51,53-75`). The existing effective config confirms appId/productName, `portable` x64 target, icon, and Electron 42.4.1 (`apps/editor/dist/builder-effective-config.yaml`). The existing artifact `apps/editor/dist/Private 2D Rigging Lab 0.0.0.exe` is present at 94,560,207 bytes; this is a generated ignored artifact, not a new tracked change.

## 4. Current repository state

### Repository facts

- Branch: `feature/2d-rigging-eco-system`; HEAD `af58394` (map refresh commit), parent Electron implementation commits remain `d9f3f1d`, `4dde084`, `e9113ab`, `d1b2348`, and icon replacement `2ef467f`.
- Root package scripts run root typecheck/unit and dependency/source/soul guards (`package.json:7-21`). Editor’s `dist:win` deliberately runs `electron:build` without typecheck (`apps/editor/package.json:13-17`); Runtime Player’s `dist:win` runs `build`, which includes typecheck (`apps/runtime-player/package.json:9-16`).
- Current tracked/untracked worktree changes are the baseline `.codex/agents/gnome.toml`, `.codex/agents/sylph.toml`, `.codex/skills/context-check/**`, `discussion/expo.zip`, and parallel workspace-refresh reports. `apps/editor/test-results` was verified clean after restoration.

### Information boundary

- **Accepted decisions:** Electron single-window shell, node:fs/IPC persistence, Web retirement, Editor-feature-only portable removal, dormant lower bundle foundations, portable x64 packaging, and the separate treatment of Editor typecheck/unit debt.
- **Current repository facts:** source/config paths, present generated executable/icon/effective config, and current command results.
- **Historical evidence:** WS commits and map/review closeouts; their pass claims are as-of-wave evidence, not proof that every current gate is green.
- **Experiment results:** commands in §6, including the sandbox EPERM observations and escalated successful builds/tests.
- **Inference:** the E2E timeout is consistent with the known missing workspace precondition; the source helper and app aria state are direct evidence, but the timed-out run did not produce a final Playwright summary.
- **Unresolved gates:** PSD E2E repair/timing, Editor package typecheck/unit debt, source guard repair, dead-branch cleanup, metadata warning handling, and human GUI smoke/PSD review.

## 5. Accepted decisions and boundaries

- The four work-stream boundaries and Editor Web→Electron scope remain accepted; packaging is complete and is not a future WS1/WS2 handoff (`discussion/editor-electron-migration/_map.md:20-34`).
- Portable deprecation applies to Editor feature/UI paths only. Lower bundle modules remain dormant for contract/tests; deleting them would change scope (`cleanup/_map.md:17-25`).
- BrowserWindow uses `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: false` (`editor-window-options.ts:26-31`). The preload bridge exposes the five workspace operations rather than raw Node/Electron APIs (`workspace-fs-bridge.ts:18-40`).
- Packaging output is Windows portable x64 with icon; `description`/`author` warning is non-blocking and not silently marked resolved (`packaging/_map.md:17-30`).
- Build/test pass is not human acceptance. The map records WS1/WS2 user smoke as historical evidence, while PSD E2E, GUI smoke, and product/device checks remain separate gates.

## 6. Verification and experiment evidence

| Command / observation | Result | Evidence boundary |
|---|---|---|
| `pnpm.cmd --filter @private-2d-rigging-lab/editor electron:build` (sandbox) | Exit 1, esbuild `spawn EPERM` while loading config | Environment restriction; not a code diagnostic. |
| Same Editor build with sandbox escalation (`electron:build`, 2026-08-08) | Pass: electron-vite reported main 9.53 kB, preload 1.24 kB, renderer 2,316 transformed modules | Main/preload are decimal kB values rounded as printed by this command. Report `02` uses bare `10`/`3` figures for main/preload; that separate unit/rounding/scope is not normalized here. Both runs agree on build pass and renderer module count, not on directly comparable size units. |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck` (2026-08-08) | Exit 2, 21 `error TS` diagnostic records counted from output lines | Diagnostic-record count only. Report `02`’s 23 “error lines” is a different aggregation; do not compare the integers as the same measure. |
| Editor `test:unit` (sandbox then escalated) | Sandbox startup EPERM; escalated run: 62 files pass, 1 fails; 493 pass, 4 skipped; 4 failures in `diagnostics-jump-actions.test.ts` | Current unit evidence; failures expect `import` but receive `workspace`. |
| Editor `test:e2e:psd-import` (escalated) | Timed out at 244s while stale workspace-precondition cases ran; Electron children were stopped after timeout | No final Playwright summary; map/source evidence still identifies missing Create/Open Workspace and native picker hook. |
| Root `pnpm.cmd typecheck` | Pass | Repository-wide root compiler; does not include Editor app tsconfig. |
| Root `pnpm.cmd test:unit` (sandbox then escalated) | Sandbox startup EPERM; escalated run: 241 files / 1,499 tests passed | Package-only root suite, excludes apps. |
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` | Pass | Runtime Player package compiler. |
| Runtime Player `test:unit` (sandbox then escalated) | Sandbox startup EPERM; escalated run: 140 files / 925 tests passed | Runtime Player app unit evidence. |
| Runtime Player `build` (sandbox then escalated) | Sandbox esbuild EPERM; escalated run passed typecheck + main/preload/3 renderer entries | Electron build evidence; no human/device gate. |
| `pnpm.cmd check:deps` | Pass | Dependency policy guard. |
| `pnpm.cmd check:source` | Fail: `apps/runtime-player/src/main/physiology/index.ts:1-110` is not barrel-only | Existing source-organization debt; unrelated to Editor packaging. |
| `pnpm.cmd check:soul-zone` | Pass: 1,389 source files scanned | Boundary guard; independent of Electron build. |
| Packaging artifact inspection | `builder-effective-config.yaml` and 94,560,207-byte portable exe present; icon source/ICO present | Existing generated artifact and config; `description`/`author` warning remains. |
| Worktree restoration | Seven E2E-touched `apps/editor/test-results/**/error-context.md` paths restored to HEAD; status clean under that directory | Prevents generated test output from polluting concurrent work. |

## 7. Historical progression / turning points

| Commit | Turning point |
|---|---|
| `d9f3f1d` (2026-07-08) | WS1 Electron shell, main/preload entries, window security, and Editor shell boundary tests. |
| `4dde084` (2026-07-08) | WS2 node:fs-backed workspace adapter, IPC handlers, path-boundary checks, roundtrip/store tests. |
| `e9113ab` (2026-07-08) | WS3/WS4 Web retirement, `_electron` E2E wiring, Editor portable feature removal. |
| `d1b2348` (2026-07-08) | electron-builder portable x64 packaging, icon generation, and packaging report. |
| `2ef467f` (2026-07-10) | Editor icon source/ICO replacement. |
| `af58394` (2026-08-08) | Discussion map refresh; current source/package commits remain unchanged by this report. |

## 8. Open gates, debts, and uncertainties

- PSD import E2E helper needs the current Create/Open Workspace precondition and a native picker avoidance/temp-directory injection. The timeout does not prove all 11 tests’ final statuses in this run.
- Editor package typecheck has 21 current `error TS` diagnostic records by manual output-line count; report `02` separately records 23 error lines, which is not the same aggregation. Editor unit has four stale navigation expectations. Root package typecheck/unit and Runtime Player typecheck/unit are green, so these are not global repo failures.
- `check:source` needs a decision/repair for the Runtime Player physiology `index.ts` barrel violation.
- Portable dead branches remain in Editor user-facing state/reason strings; lower bundle dormancy is accepted and should not be conflated with this cleanup debt.
- `description`/`author` metadata warning is non-blocking; whether to supplement it is unresolved.
- Human Electron GUI smoke, PSD import review, and other Runtime Player device/OBS gates are not established by these automated commands.
- Sandbox `spawn EPERM` occurred for esbuild/Vitest/Electron process creation. Escalated runs demonstrate whether the underlying code/test path succeeds; the environment errors must not be counted as code failures.

## 9. Candidate next work

These are evidence-derived candidates, not new product decisions:

1. Update the PSD E2E fixture helper to create/open a workspace and inject a deterministic picker before rerunning the suite.
2. Triage the four `diagnostics-jump-actions` expectations and the 21 Editor `error TS` diagnostic records (not the separately aggregated 23 report-02 error lines) as a separate quality-debt work item.
3. Repair or explicitly reclassify the Runtime Player physiology barrel violation so `check:source` has an intentional current result.
4. Decide whether to delete Editor portable dead branches and whether to add package metadata fields.
5. Perform the outstanding human GUI smoke/PSD review after automated preconditions are repaired.

## 10. Evidence index

| Evidence | Location |
|---|---|
| Current Electron migration status and residuals | `discussion/editor-electron-migration/_map.md:20-42` and child maps. |
| Editor package scripts/build metadata | `apps/editor/package.json:6-17,45-75`. |
| Runtime Player package/build metadata | `apps/runtime-player/package.json:6-17,49-71`. |
| Electron entry graph | `apps/editor/electron.vite.config.ts:11-51`; `apps/runtime-player/electron.vite.config.ts:15-68`. |
| Main/preload/security boundary | `apps/editor/src/main/editor-main.ts:9-37`; `apps/editor/src/main/window-management/editor-window-options.ts:17-32`; `apps/editor/src/preload/workspace-fs-bridge.ts:10-40`. |
| Workspace fs IPC/store | `apps/editor/src/main/workspace-fs/workspace-fs-bridge-handlers.ts:25-67`; `workspace-fs-store.ts:16-27,49-72,81-105`. |
| E2E harness and stale helper | `apps/editor/e2e/psd-import.e2e.spec.ts:20-35,753-765`. |
| Portable dead branches | `workspace-storage-state.ts:38-52`; `editor-session-context.tsx:557-564,939-953`. |
| Guards | root `package.json:16-20`; `check-dependencies.mjs`; `check-source-organization.mjs`; `check-soul-zone-boundary.mjs`. |
| Packaging artifact | `apps/editor/dist/builder-effective-config.yaml`; `apps/editor/dist/Private 2D Rigging Lab 0.0.0.exe`; commits `d1b2348`, `2ef467f`. |
| Timeline | commits `d9f3f1d`, `4dde084`, `e9113ab`, `d1b2348`, `2ef467f`, `af58394`. |

## 11. Limitations

- The PSD E2E run timed out before Playwright printed a final summary; the report therefore keeps the current source/map stale-precondition evidence separate from any claim of an 11-test final count.
- No human GUI smoke, native picker interaction, PSD visual review, device/OBS test, or packaging installation check was performed in this refresh.
- Root package tests do not include app tests; Editor and Runtime Player app suites were run separately.
- Generated `out/`, `dist/`, and E2E artifacts are not treated as source changes. Only the owned report is added; all other pre-existing and parallel worktree changes remain untouched.
