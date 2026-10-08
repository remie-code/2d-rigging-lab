# Runtime Player Wave 2 Plan: Runtime Export Load + Static Stage Render

> Runtime Player Wave2は、Editorが生成した実物のRuntime ExportディレクトリをRuntime Playerで開き、Stage Window上のplaceholderを静的なデフォルト姿勢モデル描画へ置き換える。iFacialMocap入力、parameter駆動、dynamics再生、自動復元は対象外。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Runtime Player Wave2
- Wave name: `runtime-player-runtime-export-load-static-stage-render`
- Primary objective:
  - Control Windowの `Open Runtime Export` からnative directory pickerを開く。
  - 選択ディレクトリをRuntime Exportとして検証し、load状態をControl Windowに表示する。
  - Stage WindowにRuntime Exportのstatic default-pose modelを描画する。
  - Stage WindowからWave1 placeholderを消し、transparent/capture stageとしてモデルだけを表示する。
  - Runtime Exportのdirectory nameには依存せず、`runtime-export.json` の存在と内容で判定する。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Runtime Player Wave1は完了し、Control Window / Stage Window が別windowとして起動することをユーザーが確認済み。
- ユーザーはEditorで2Dモデル作成を完了し、実物のRuntime Exportを作成済み。
- Runtime Exportの実装事実はSylph調査で確認済み。
- 次のUXは合意済み:
  - Runtime Exportを選ぶ。
  - Control Windowがloaded状態になる。
  - Stage Windowに静的モデルが表示される。
  - tracking / parameter / dynamics はまだ扱わない。

Uncertainty:

- factual: medium. Runtime Export DTOから既存render-webgl2へ接続する最短経路は実装時確認が必要。
- decision: low. UX/scope方針は合意済み。
- cost of wrong plan: high. loader境界、file IO境界、Stage描画境界を誤ると後続のinput/dynamics/player wave全体に影響する。

Precondition:

- Runtime Player Wave1 source exists and launches.
- User has a real Runtime Export directory created by Editor.
- Implementation agents must not run `pnpm install` unless the user explicitly asks.
- If package dependencies are changed, report them clearly so the user can run install when needed.

## 3. Accepted Decisions / Oracles

### 3.1 Runtime Export Directory Name Is Not Authoritative

Required:

- User may choose any directory name.
- Runtime Player must not require the selected directory name to end with `.runtime-export`.
- Runtime Player must identify a valid Runtime Export by reading and validating `runtime-export.json` in the selected directory.

Accepted UI copy:

- UI may still describe the artifact as a Runtime Export directory.
- Error copy should say the selected directory does not contain a valid `runtime-export.json`, not that its name is wrong.

### 3.2 Runtime Export Is Separate From Workspace Save

Required:

- Runtime Player opens Runtime Export artifacts only.
- Runtime Player must not open Editor Workspace Save directories as authoring workspaces.
- Runtime Player must not require `workspace.json`, PSD/source assets, Editor state, or Portable JSON.

Runtime Export directory shape:

```text
<user-chosen-directory>/
  runtime-export.json
  runtime/
    model.json
    atlas.json
  assets/
    textures/
      atlas_page_0.raw-rgba
```

### 3.3 Authoritative Runtime Data

Required read order:

1. `runtime-export.json`
   - entrypoint / manifest.
   - validate schema/version/paths/capabilities/render assumptions.
2. `runtime/model.json`
   - primary runtime graph for drawing.
   - contains drawables, meshes, atlas UVs, draw order, masks, parameters, keyforms, dynamics data.
3. `assets/textures/atlas_page_0.raw-rgba`
   - final runtime texture page.
   - validate dimensions / byte length / digest when available from manifest/model.
4. `runtime/atlas.json`
   - required artifact and consistency reference.
   - not the primary source for UV remapping.

Required:

- Use materialized `model.meshes[].atlasUvs` as atlas-normalized UVs.
- Do not recompute mesh UVs from atlas placements in Wave2.
- Treat raw RGBA8 texture as final runtime texture source.

### 3.4 Stage Scope In Wave2

Required:

- Stage Window renders static default-pose model.
- Stage Window remains UI-free.
- Stage Window does not show setup controls, debug text, placeholder labels, buttons, or parameter sliders after successful load.
- Stage transparent background must remain transparent/capture-friendly.

Required render behavior:

- honor draw order.
- honor drawable opacity.
- honor `visible=false`.
- honor atlas UVs.
- upload raw RGBA texture page to WebGL.
- support clipping/masks if required by Runtime Export capabilities.

If clipping cannot be supported in Wave2:

- Fail fast on exports that require clipping and explain the unsupported capability.
- Do not silently render a visually wrong model as if successful.

### 3.5 Process Boundary

Required:

- Main process owns native directory picker and filesystem reads.
- Preload exposes a narrow typed API.
- Control renderer requests open/load and displays status/errors.
- Stage renderer receives loaded runtime payload and draws.
- Renderer code must not import `node:*` or raw Electron APIs.

Forbidden:

- Passing raw filesystem handles or raw Electron objects into React code.
- Letting Control renderer read files directly.
- Letting Stage renderer call native dialog APIs.
- Importing Editor app source from Runtime Player.

### 3.6 Wave2 Is Not Runtime Animation

Forbidden in Wave2:

- iFacialMocap UDP/TCP receive.
- input source connection.
- calibration behavior.
- parameter mapping UI.
- parameter sliders.
- dynamics/time progression.
- automatic previous export restore.
- recent export list.
- runtime export generation/modification.

Allowed:

- Control Window may still show disabled/placeholder input/calibration sections from Wave1.
- Loaded Runtime Export status may include model name/path/counts if readily available.

## 4. Primary Basis

Runtime Player basis:

- [Initial Runtime Player Screen](../../screens/initial-runtime-player-screen.md)
- [Runtime Player Technology Stack Decision](../../architecture/technology-stack-decision.md)
- [Runtime Player Development Policy](../../architecture/runtime-player-development-policy.md)
- [iFacialMocap Input Adapter Research](../../research/ifacialmocap-input-adapter-research.md)

Runtime Export / rendering basis:

- `packages/package-format/src/runtime-export.ts`
- `packages/package-format/src/runtime-export-file-set.ts`
- `packages/authoring-core/src/runtime-export-assembly.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/render-core/**`
- `packages/render-webgl2/**`
- `apps/editor/src/features/runtime-export/model/runtime-export-directory.ts`

General implementation basis:

- [Source File Organization Policy](../../../development_convention/source-file-organization-policy.md)

Current implementation facts:

- `apps/runtime-player` has Wave1 Electron shell.
- Control Window and Stage Window can launch separately.
- `apps/runtime-player` does not yet load Runtime Export files.
- `apps/runtime-player` does not yet depend on `@private-2d-rigging-lab/package-format`.
- Electron binary install is handled by root script `runtime-player:install-electron`.

Likely implementation areas:

- `apps/runtime-player/package.json`
- `apps/runtime-player/src/main/**`
- `apps/runtime-player/src/preload/**`
- `apps/runtime-player/src/control/**`
- `apps/runtime-player/src/stage/**`
- `apps/runtime-player/src/shared/**` only if a bounded shared DTO/adapter area already matches project policy
- focused tests under `apps/runtime-player/**`

## 5. Wave Strategy

```text
Batch 1:
  Domain A: Runtime Export Loader + IPC Contract

Batch 2:
  Domain B: Stage Static Renderer + Loaded Stage UX

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Parallelism summary:

| Domain | Can run in parallel? | Reason |
|---|---:|---|
| A. Runtime Export Loader + IPC Contract | No | Establishes the loaded artifact DTO and main/preload/control/stage transfer contract. Other implementation should not guess this shape. |
| B. Stage Static Renderer + Loaded Stage UX | No | Depends on Domain A's validated payload shape and stage delivery mechanism. |
| C. Final Integration / Clean Review | No | Depends on A and B completion and must review the integrated behavior. |

Rationale:

- Loader/IPC and Stage rendering are conceptually distinct, but the renderer should consume a stable loader contract rather than inventing its own file access path.
- Splitting B after A keeps process-boundary mistakes easier to review.
- Clipping support may require careful render integration; keeping it in the Stage renderer domain avoids spreading mask semantics across agents.

## 6. Acceptance Criteria

### 6.1 Open Runtime Export Uses Native Directory Picker

Required:

- `Open Runtime Export` opens a native directory picker.
- User can select any directory name.
- Selection is accepted only if the directory contains a valid `runtime-export.json` and required referenced files.
- Canceling the picker leaves the previous state unchanged.

### 6.2 Runtime Export Validation

Required validation:

- `runtime-export.json` exists.
- referenced `runtime/model.json` exists.
- referenced `runtime/atlas.json` exists.
- referenced raw RGBA texture page exists.
- schema/version/capabilities are supported for Wave2.
- v0 single texture page is enforced.
- path traversal outside selected directory is rejected.
- raw texture byte length matches expected width * height * 4.
- digest/checksum is validated if the manifest/schema provides it.

Failure UX:

- Control Window shows a human-readable error.
- Stage remains placeholder or empty safe state.
- Error message should name the missing/invalid artifact.
- Do not crash the app.

### 6.3 Control Window Loaded State

Required:

- Loaded status switches from `No` to loaded/success state.
- Selected directory path is shown.
- Basic export/model summary is shown if readily available:
  - model name or export id.
  - texture page dimensions.
  - drawable/mesh count.
  - required capabilities status.
- Input Source / Calibration remain not connected / placeholder.

### 6.4 Stage Static Rendering

Required:

- Stage placeholder disappears after successful load.
- Stage shows the exported model in default/rest pose.
- Background remains transparent/capture-friendly.
- Stage contains no setup UI, debug labels, or controls.
- The model is reasonably centered/fitted in the Stage Window.
- Draw order, opacity, visibility, atlas UVs, and raw RGBA texture are honored.
- Clipping/masks are honored when required by the export.

### 6.5 Runtime Player Boundary

Required:

- Runtime Player must not import `apps/editor/**`.
- Main process owns file IO.
- Renderer code has no direct `node:*` imports.
- Preload API remains typed and narrow.
- Stage renderer does not own directory picker/file traversal logic.
- Runtime Player treats Runtime Export as immutable input.

### 6.6 Tests / Verification

Minimum required verification:

- Runtime Player package typecheck.
- Unit tests for Runtime Export directory validation.
- Unit tests for invalid/missing artifact cases.
- Unit or adapter tests for RuntimeExport DTO to Stage/render-scene input.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.

Preferred verification:

- A small fixture Runtime Export under test fixtures, if repository policy allows it.
- Stage screenshot/pixel smoke for nonblank render if Electron/Playwright environment allows it.

If GUI/screenshot verification cannot be run reliably in the agent environment:

- Domain report must say so.
- Domain report must provide manual verification steps using the user's real Runtime Export.

## 7. Domain A: `runtime-player-wave2-runtime-export-loader-ipc`

Purpose:

- Implement Runtime Export selection, validation, file loading, and cross-window delivery contract.

Allowed write scope:

- `apps/runtime-player/**`
- `apps/runtime-player/package.json`
- `pnpm-lock.yaml` only if dependency addition is required and the user has run install or explicitly allows keeping lockfile changes
- focused Runtime Player reports/reviews under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- existing `packages/**` source unless a tiny import/export fix is required and explicitly reported
- `node_modules/**`
- Editor implementation docs under `discussion/implementation/**`

Required implementation:

- Add Runtime Export schema/parser dependency if needed, likely `@private-2d-rigging-lab/package-format`.
- Add main-process directory picker.
- Add main-process runtime export loader.
- Add path validation to keep all reads inside selected directory.
- Add preload API for opening/loading Runtime Export.
- Add typed loaded/error state delivery to Control Window.
- Add typed loaded payload delivery to Stage Window.
- Add Control loaded/error UI.
- Add tests for validation and error handling.

Forbidden implementation:

- Stage WebGL rendering, except for tiny payload plumbing needed by Domain B.
- iFacialMocap/network/input.
- parameter/dynamics runtime.
- previous export restore.
- writing/modifying Runtime Export directory.

Expected report:

- Files changed.
- Dependency changes.
- Loader contract shape.
- Validation checks implemented.
- User-visible error behavior.
- Verification performed.
- Manual test command.
- Residual risks.

Early escape triggers:

- Runtime Export schema cannot be imported without broad package changes.
- Existing package-format contract is insufficient to safely validate file paths.
- Runtime Export fixture is needed but cannot be created without user-supplied artifact path or repository policy decision.

## 8. Domain B: `runtime-player-wave2-static-stage-renderer`

Purpose:

- Render the loaded Runtime Export as a static default-pose model in Stage Window.

Dependencies:

- Domain A loaded payload and Stage delivery contract.

Allowed write scope:

- `apps/runtime-player/**`
- focused tests under `apps/runtime-player/**`
- focused Runtime Player reports/reviews under `discussion/runtime-player/implementation/**`
- existing render package source only if a narrow bug fix is required and explicitly escalated before edit

Forbidden write scope:

- `apps/editor/**`
- broad changes to `packages/render-core/**` or `packages/render-webgl2/**` unless explicitly escalated
- runtime input/network/dynamics implementation
- authoring Runtime Export generation changes

Required implementation:

- Convert loaded Runtime Export model + raw RGBA page into Stage renderer input.
- Upload raw RGBA8 page to WebGL.
- Use materialized `atlasUvs`.
- Render rest/default pose.
- Fit/center model in Stage Window.
- Keep transparent canvas clear.
- Honor draw order, opacity, visibility.
- Honor clipping/masks when required by loaded export.
- Remove Stage placeholder after successful load.
- Add render/adapter tests where practical.

Forbidden implementation:

- Parameter sliders or interactive authoring controls.
- Runtime input connection.
- Dynamics simulation.
- Runtime export reload persistence.
- Debug UI on Stage by default.

Expected report:

- Files changed.
- Render path summary.
- What export fields are consumed.
- Clipping support status.
- Verification performed.
- Manual visual verification steps.
- Known rendering limitations.

Early escape triggers:

- Existing render-webgl2 cannot consume Runtime Export shape without broad package work.
- Clipping support requires an architectural decision beyond Wave2.
- Raw RGBA upload is blocked by renderer process file/IPC limits not solved by Domain A.

## 9. Domain C: `runtime-player-wave2-final-integration-clean-review`

Purpose:

- Validate Runtime Player Wave2 as an end-to-end Runtime Export load + static Stage render wave.

Allowed write scope:

- `discussion/runtime-player/implementation/waves/wave2/**`
- `discussion/runtime-player/implementation/reviews/wave2/**`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- narrow source/test fixes only if clean review requires them

Required checks:

- Domain A and Domain B reports exist.
- Review lanes exist and pass or explicitly escalate.
- Directory name is not used as validity oracle.
- Main/preload/control/stage boundaries are respected.
- Runtime Export is loaded as immutable external artifact.
- Stage renders a loaded model and has no setup/debug UI by default.
- Input/dynamics/parameter runtime features remain out of scope.
- Manual verification instructions are clear.

Expected final artifacts:

- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-domain-a-runtime-export-loader-ipc-report.md`
- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-domain-b-static-stage-renderer-report.md`
- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave2/_map.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-b-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/runtime-player-wave2-final-clean-integration-review.md`
- `discussion/runtime-player/implementation/reviews/wave2/_map.md`

## 10. Review Policy

Each implemented domain requires three review lanes:

1. Spec Compliance Review
   - Check against this plan and Runtime Export facts.
   - Verify correct scope and user-visible behavior.
2. Design / Development Compliance Review
   - Check Runtime Player Development Policy.
   - Check main/preload/control/stage boundaries, file splitting, IPC/preload safety, source organization, dependency scope.
3. Test Adequacy Review
   - Check loader/validation tests, adapter/render tests, typecheck, dependency/source checks, and manual verification instructions.

Reviewers must report `pass`, `needs_changes`, or `escalate`.

Blocking findings include:

- Runtime Export validity depends on directory name/suffix.
- Renderer reads filesystem directly.
- Raw Electron or Node APIs are exposed to renderer.
- Stage silently ignores required clipping and renders incorrect output as success.
- Stage shows setup controls/debug UI after successful load.
- Runtime input/network/dynamics implementation is added in Wave2.
- Runtime Player imports `apps/editor/**`.
- App crashes on invalid export instead of showing error.
- No credible manual visual verification path.

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Native directory picker opens | source + manual command/report |
| Directory name is not authoritative | validation tests/review |
| `runtime-export.json` entrypoint is validated | loader tests |
| required runtime files are validated | loader tests |
| raw RGBA byte length/digest checked | loader tests or explicit schema-limited explanation |
| Control loaded/error state works | source/test/manual check |
| Stage receives loaded payload | source/test/manual check |
| Static model renders | source/manual visual check, screenshot if possible |
| Stage remains UI-free | source/review/manual check |
| clipping handled or fail-fast | render tests/review |
| process boundary respected | source review |
| no Editor imports | dependency/source check |

## 12. Subagent Contract

Orch-Sylph instructions must include:

- Use this Runtime Player Wave2 plan as source of truth.
- Start with bounded current-state confirmation for `apps/runtime-player` and Runtime Export contracts.
- Delegate Domain A before Domain B.
- Delegate independent review to Review-Sylphs for each implemented domain.
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
- Do not add dependencies beyond the package-format dependency unless explicitly escalated.
- Keep Wave2 focused on Runtime Export load and static Stage rendering.
- Do not implement iFacialMocap, parameter runtime, dynamics, or previous export restore.
- Follow Runtime Player Development Policy and Source File Organization Policy.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat forbidden scope as blocking.

## 13. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave2 source changes.
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

## 14. Out of Scope

- iFacialMocap UDP/TCP receiver.
- VMC/OSC adapter.
- input source connect/disconnect behavior.
- calibration behavior.
- parameter mapping UI.
- parameter sliders.
- dynamics/time progression.
- previous Runtime Export auto restore.
- recent export list.
- runtime player settings persistence.
- Runtime Export generation or mutation.
- Editor feature changes.
- packaging/distribution.
