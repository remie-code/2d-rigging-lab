# Runtime Player Wave 1 Plan: Electron Shell + Initial Screen Placeholder

> Runtime Player Wave1は、Editor外アプリとしてのRuntime Playerを初めて起動可能にし、Control Window / Stage Window の二窓構成と初期画面イメージをユーザーが確認できる状態にする。Runtime Export読み込み、iFacialMocap接続、実モデル描画、runtime loop本実装は対象外。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Runtime Player Wave1
- Wave name: `runtime-player-electron-shell-initial-screen`
- Primary objective:
  - `apps/runtime-player` をElectronアプリとしてdev起動できるようにする。
  - Control Windowを表示し、`Initial Runtime Player Screen` 相当の起動画面/placeholder UIを表示する。
  - Stage Windowを別windowとして作成し、transparent / capture-friendly前提のplaceholder stageを表示する。
  - `main` / `preload` / `control` / `stage` の責務境界を最初から守る。
  - ボタンや設定はplaceholderでよく、実際のRuntime Export読み込みやtracking接続は実装しない。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- ユーザーと次のUX方針が合意済み:
  - Wave1は機能完成ではなく、アプリ起動時に画面イメージが見えることを目標にする。
  - Runtime PlayerはEditorとは別アプリである。
  - Control Window / Stage Window の二窓構成を最初から置く。
  - Runtime Export読み込み、iFacialMocap接続、実モデル描画、runtime loop本実装は入れない。
  - placeholder button / placeholder state は許容する。
- 画面basis、技術stack、開発規約が文書化済み。
- `apps/runtime-player/package.json` scaffoldは存在する。

Uncertainty:

- factual: medium. Electron/electron-viteの実際のconfig shapeとdev commandは実装時確認が必要。
- decision: low. UX/scope方針は合意済み。
- cost of wrong plan: medium. 初回Electron構成とprocess boundaryを誤ると後続Runtime Player waveに影響する。

Precondition:

- User should run `pnpm install` at repository root before starting implementation if lockfile/dependencies are not yet updated.
- Implementation agents must not run `pnpm install` unless the user explicitly asks.

## 3. Accepted Decisions / Oracles

### 3.1 Runtime Player Is Separate From Editor

Required:

- Runtime Player code lives under `apps/runtime-player`.
- Runtime Player implementation must not modify Editor authoring UX.
- Runtime Player implementation must not depend on `apps/editor` source.

Forbidden:

- Reusing Editor workspace UI as Runtime Player UI.
- Adding Runtime Player screen inside Editor.
- Adding Runtime Player behavior to Editor Toolbox.

### 3.2 Two-Window Model From Wave1

Required:

- Control Window exists as the normal user operation window.
- Stage Window exists as a separate window.
- Stage Window is intended to be transparent/capture-friendly.
- Stage Window must not contain setup controls, parameter sliders, debug tables, or Editor overlays.

Accepted limitation:

- Stage Window may show a placeholder model silhouette/card/text in Wave1.
- Pixel-perfect transparency/OBS proof is not required in Wave1, but the window config and visual intent must be present.

### 3.3 Placeholder-Only Functionality

Required:

- `Open Runtime Export`, `Connect`, `Look Forward`, `Focus Stage`, `Reset Stage Position`, `Settings`, and Debug/Status affordances may exist as disabled or placeholder actions.
- Placeholder actions should provide deterministic no-op feedback where useful.
- UI should make clear that Runtime Export is not loaded and input is not connected.

Forbidden:

- Real directory Runtime Export loading.
- Runtime graph parsing.
- Raw RGBA upload.
- WebGL model rendering.
- iFacialMocap UDP/TCP receive.
- Parameter mapping.
- Dynamics/runtime loop simulation.

### 3.4 Process Boundary

Required:

- Main process owns app lifecycle and BrowserWindow creation.
- Preload exposes a narrow typed API, even if Wave1 API is minimal.
- Control renderer owns Control Window UI only.
- Stage renderer owns Stage Window placeholder display only.
- Renderer code must not import `node:*` or raw Electron APIs.

Forbidden:

- Exposing raw `ipcRenderer`, filesystem handles, socket handles, or Electron objects to React code.
- Main process importing React components.
- Stage runtime hot path being designed around React render. Wave1 may not implement the hot path, but should not establish a conflicting pattern.

### 3.5 Source Organization

Required:

- `index.ts` files are entrypoints/barrels only.
- Files are split by responsibility.
- Avoid catch-all `types.ts`, `utils.ts`, `helpers.ts`, `common.ts`, or `ipc.ts`.
- Follow Runtime Player Development Policy.

## 4. Primary Basis

Runtime Player basis:

- [Initial Runtime Player Screen](../../screens/initial-runtime-player-screen.md)
- [Runtime Player Technology Stack Decision](../../architecture/technology-stack-decision.md)
- [Runtime Player Development Policy](../../architecture/runtime-player-development-policy.md)
- [iFacialMocap Input Adapter Research](../../research/ifacialmocap-input-adapter-research.md)

General implementation basis:

- [Source File Organization Policy](../../../development_convention/source-file-organization-policy.md)

Current implementation facts:

- `apps/runtime-player/package.json` exists.
- `apps/runtime-player/src` was intentionally not created during install scaffold.
- `pnpm-workspace.yaml` already includes `apps/*`.
- Runtime Player package currently has no runnable scripts/source entrypoints.

Likely implementation areas:

- `apps/runtime-player/package.json`
- `apps/runtime-player/electron.vite.config.ts`
- `apps/runtime-player/tsconfig.json`
- `apps/runtime-player/index.html` or renderer entry HTML files as required by chosen electron-vite setup
- `apps/runtime-player/src/main/**`
- `apps/runtime-player/src/preload/**`
- `apps/runtime-player/src/control/**`
- `apps/runtime-player/src/stage/**`
- focused Runtime Player tests if practical

## 5. Wave Strategy

```text
Batch 1:
  Domain A: Runtime Player Electron Shell + Placeholder UI

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Parallelism summary:

| Domain | Can run in parallel? | Reason |
|---|---:|---|
| A. Electron Shell + Placeholder UI | No | First app shell touches shared app config, main/preload/control/stage entrypoints, and package scripts together. Splitting would create coordination overhead with little gain. |
| B. Final Integration / Clean Review | No | Depends on Domain A completion. |

Rationale:

- Wave1 is intentionally small but architectural.
- A single implementation domain minimizes cross-agent merge conflicts while still allowing independent review lanes.
- Later Runtime Player waves can split by `input adapter`, `runtime export loader`, `stage renderer`, and `parameter mapping` once the shell is stable.

## 6. Acceptance Criteria

### 6.1 App Can Launch In Development

Required:

- Add the minimal scripts/config needed to launch Runtime Player in dev mode.
- `pnpm --filter @private-2d-rigging-lab/runtime-player <dev-script>` or equivalent documented command starts Electron.
- The command opens a Control Window.
- The command opens or can open a Stage Window as part of the Wave1 app shell.
- The app can be stopped without orphaning obvious dev child processes in normal use.

### 6.2 Control Window Shows Initial Runtime Player Screen

Required:

- App title `Runtime Player` is visible.
- Primary action `Open Runtime Export` is visible.
- Short helper text communicates that the app opens a `.runtime-export` directory.
- Settings entry/affordance exists as placeholder.
- If no export is loaded, Control Window focuses on opening a Runtime Export, not input setup.
- Parameter lists are not shown.
- Editor concepts such as mesh, deformer tree, part tree, atlas placement details, and authoring controls are not shown.

### 6.3 Placeholder Loaded/Live Structure Exists Without Real Functionality

Required:

- Control Window layout has clear places for:
  - Runtime Export status.
  - Input Source section.
  - Connect / Disconnect placeholder.
  - Calibration / Look Forward placeholder.
  - Stage controls placeholder.
  - Debug drawer or debug affordance placeholder.
- These controls do not perform real runtime export load or network connection.
- Placeholder action feedback is deterministic if implemented.

### 6.4 Stage Window Placeholder

Required:

- Stage Window is a separate Electron window.
- Stage Window visual is clean and capture-oriented.
- Stage Window has no setup controls, debug panel, parameter list, or Editor overlays.
- Stage Window communicates that it is the transparent/capture stage placeholder.
- Stage Window creation uses transparent/frameless or clearly capture-friendly config unless blocked by platform/dev constraints.

### 6.5 Process / Source Boundary

Required:

- Main/preload/control/stage source areas exist with clear responsibilities.
- Renderer code does not import `node:*` or raw Electron APIs.
- Main process does not import React UI modules.
- Preload exposes only narrow placeholder API needed for Wave1.
- No broad catch-all source files.
- `index.ts` files are entrypoints or barrels only.

### 6.6 Tests / Verification

Minimum required verification:

- Runtime Player package typecheck or equivalent compile check.
- Focused unit/static tests for pure placeholder state/helpers if any are introduced.
- If practical, a thin launch/smoke check that verifies Control/Stage entrypoints are configured.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.

If Electron GUI smoke cannot be run reliably in the agent environment, the domain report must explain the limitation and provide a manual command for user verification.

## 7. Domain A: `runtime-player-wave1-electron-shell-placeholder-ui`

Purpose:

- Implement the initial Electron app shell and placeholder UI for Runtime Player Wave1.

Allowed write scope:

- `apps/runtime-player/**`
- root `package.json` only if a top-level convenience script is clearly needed and does not conflict with existing scripts
- focused tests under `apps/runtime-player/**` if added
- Runtime Player implementation report/review paths under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- existing `packages/**` source unless a compile-time workspace reference issue requires a tiny import-safe fix and is explicitly reported
- `pnpm-lock.yaml` unless user has already run install and the wave is explicitly allowed to keep lockfile changes
- `node_modules/**`
- Editor implementation docs under `discussion/implementation/**`, except no edits expected

Required implementation:

- Add Electron/electron-vite config.
- Add main process entry and window creation for Control and Stage.
- Add preload bridge with minimal typed API.
- Add Control renderer entry with placeholder initial screen.
- Add Stage renderer entry with placeholder capture stage.
- Add styling consistent with Runtime Player identity and existing dark UI quality, without copying Editor authoring layout.
- Add dev script(s) to `apps/runtime-player/package.json`.
- Add focused tests or smoke checks where feasible.

Forbidden implementation:

- Real Runtime Export directory picker/load.
- Reading runtime export files.
- Real input source/network sockets.
- Real Stage runtime loop/dynamics/render-webgl2 integration.
- Parameter slider UI.
- Editor-like toolbox/parts/deformer panels.
- New dependencies beyond those already added for scaffold unless explicitly escalated.

Expected report:

- Files changed.
- How to run the app.
- Which windows are created.
- Placeholder actions and non-goals.
- Boundary compliance evidence.
- Verification performed.
- Manual verification steps.
- Residual risks.

Early escape triggers:

- Electron/electron-vite setup requires dependency installation not present in the workspace.
- Transparent Stage Window cannot be configured without a platform/user decision.
- Achieving two windows requires broad restructuring beyond `apps/runtime-player`.
- Implementing a visible initial screen appears to require real runtime export loading.

## 8. Domain B: `runtime-player-wave1-final-integration-clean-review`

Purpose:

- Validate Runtime Player Wave1 as an app-shell/placeholder-screen wave and record the result.

Allowed write scope:

- `discussion/runtime-player/implementation/waves/wave1/**`
- `discussion/runtime-player/implementation/reviews/wave1/**`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- narrow source/test fixes only if clean review requires them

Required checks:

- Domain A report exists.
- Review lanes exist and pass or explicitly escalate.
- Control Window / Stage Window placeholder scope is preserved.
- Runtime Export load/input/model rendering/network features are not implemented.
- `main` / `preload` / `control` / `stage` boundaries are respected.
- User-facing run command is documented.
- Manual verification gaps are explicit.

Expected final artifacts:

- `discussion/runtime-player/implementation/waves/wave1/runtime-player-wave1-domain-a-electron-shell-placeholder-ui-report.md`
- `discussion/runtime-player/implementation/waves/wave1/runtime-player-wave1-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave1/_map.md`
- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave1/runtime-player-wave1-final-clean-integration-review.md`
- `discussion/runtime-player/implementation/reviews/wave1/_map.md`

## 9. Review Policy

Domain A requires three review lanes:

1. Spec Compliance Review
   - Check against this plan and `initial-runtime-player-screen.md`.
   - Verify placeholder-only scope.
   - Verify two-window model and no Editor authoring UI.
2. Design / Development Compliance Review
   - Check `runtime-player-development-policy.md`.
   - Check process boundaries, file splitting, IPC/preload safety, source organization, dependency scope.
3. Test Adequacy Review
   - Check compile/typecheck/smoke/test evidence.
   - Check that skipped Electron GUI verification is justified and has manual steps.

Reviewers must report `pass`, `needs_changes`, or `escalate`.

Blocking findings include:

- Control-only app without Stage Window placeholder.
- Stage Window containing setup controls/debug/parameter list by default.
- Renderer importing Node/Electron APIs directly.
- Raw Electron objects exposed through preload.
- Runtime Export loader or iFacialMocap implementation added in Wave1.
- Broad catch-all files or `index.ts` implementation bodies.
- No viable run command.

## 10. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Dev app launch command exists | package script + report command |
| Control Window initial screen exists | source/test/screenshot/manual check |
| Stage Window separate placeholder exists | source/test/screenshot/manual check |
| Placeholder-only scope preserved | source diff + review |
| Runtime Export not implemented | source diff + review |
| Input/network not implemented | source diff + review |
| Process boundary respected | source review |
| No broad source files | source organization check |
| Dependencies stable | dependency check |

## 11. Subagent Contract

Orch-Sylph instructions must include:

- Use this Runtime Player Wave1 plan as source of truth.
- Start with bounded current-state confirmation for `apps/runtime-player`.
- Delegate implementation to Gnome for Domain A.
- Delegate independent review to Review-Sylphs.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Do not add dependencies unless explicitly escalated.
- Keep Wave1 placeholder-only.
- Do not implement Runtime Export load, iFacialMocap, model rendering, or runtime loop.
- Follow Runtime Player Development Policy and Source File Organization Policy.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat forbidden scope as blocking.

## 12. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave1 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 13. Out of Scope

- Real Runtime Export directory load.
- Runtime Export file parsing.
- raw RGBA upload.
- render-webgl2 model rendering.
- Stage runtime loop/dynamics simulation.
- iFacialMocap UDP/TCP receiver.
- VMC/OSC adapter.
- parameter mapping / calibration implementation.
- OBS plugin / virtual camera.
- packaging/distribution.
- automatic previous Runtime Export restore.
- recent export list.
- runtime player settings persistence.
- Editor feature changes.
- New dependencies.
