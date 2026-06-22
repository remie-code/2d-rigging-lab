# Runtime Player Wave 5 Plan: Tracking Setup + Live Mapping v0

> Runtime Player Wave5は、iFacialMocapから受信したtracking frameをInput Profile / Look Forward / Auto Mappingを通してruntime parameter valuesへ変換し、Stage Window上のモデルが実際に動く状態を作る。Control Windowは縦積み設定画面から、Wave5で実体を持つ`Overview / Input / Mapping`中心の構成へ移行する。Stage Windowは引き続きmodel onlyで、debug UIやraw tracking情報を表示しない。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Runtime Player Wave5
- Wave name: `runtime-player-tracking-setup-live-mapping-v0`
- Primary objective:
  - Runtime Export未ロードでもInput接続とdiagnostics確認ができる現行UXを維持する。
  - Control Windowを`Header + Overview/Input/Mapping`中心へ再構成する。
  - iFacialMocap Input ProfileをElectron `userData`配下へ永続保存できる。
  - `Look Forward`でsession neutralを更新できる。
  - Guided calibration v0でrangeとlearned signsを記録し、Input Profileへ保存できる。
  - Runtime Exportロード後、標準parameterへAuto Mappingできる。
  - mapping slotごとに`enabled / invert / strength`を扱える。
  - tracking frameからruntime parameter valuesを生成し、Stage上のモデルがLiveに動く。
  - Stage Windowにはdebug overlay、parameter sliders、raw tracking textを出さない。

## 2. Planning Gate Result

Planning Gate result: `Inventory first -> ready_to_plan`.

Why planning is now safe:

- Runtime Player Wave4は完了し、iFacialMocap UDP receive / parse / normalize / Control diagnosticsが動作する。
- ユーザーは実機で、ConnectのみでUDP frameを受信できること、約59.5fpsで受信できること、parse/normalization warningsが0であることを確認済み。
- Runtime Export loadとInput Source connectionは独立している現行実装事実が確認済み。
- Sylph A調査で、Control Window / input bridge / Input Profile保存境界が確認済み。
- Sylph B調査で、Stage/evaluation/render pipelineとlive parameter application推奨経路が確認済み。
- `runtime-core`は任意parameter valuesによる評価に対応済みであり、Wave5の不足はRuntime Player側adapter/live pathである。

Uncertainty:

- factual: medium. 実機の軸符号、gaze source品質、head position単位は継続観測が必要。
- decision: low. Wave5 scopeと推奨判断はユーザー合意済み。
- cost of wrong plan: high. live反映経路を誤るとPlayerの中核UXが作り直しになる。

Precondition:

- Runtime Player Wave4 source exists and launches.
- User has run `pnpm install` if package dependencies changed before this wave. Agents must not run `pnpm install`.
- No new dependency should be added unless explicitly justified and escalated. Runtime Player currently uses hand-written IPC validation; schema dependency additionはWave5では避ける。

## 3. Accepted Decisions / Oracles

### 3.1 Wave5 Gate Is Live Model Motion

Required:

- iFacialMocap input can move the Stage model through runtime parameter evaluation.
- User can confirm motion visually on the clean Stage Window.
- Head rotation, blink, mouth open, mouth smile, and gaze have initial semantic slot mapping.
- Live path uses runtime-core evaluation rather than reimplementing deformer/keyform logic.

Forbidden:

- Stage debug overlay.
- Stage raw tracking display.
- Runtime parameter sliders in Control Window.
- Body Follow.
- head position driven Stage Motion.
- TCP transport.
- smoothing / curve / deadzone advanced editor.
- persistent Model Mapping Profile save.

### 3.2 Control Window Scope

Wave5 creates only pages that have real behavior.

Required pages:

- `Overview`
- `Input`
- `Mapping`

Allowed but not required:

- Existing collapsible diagnostics panel may remain available as a secondary surface.

Forbidden:

- Creating empty or misleading placeholder pages for `Model`, `Stage`, or `Diagnostics`.
- Adding half-built page shells that imply completed UX.

Runtime Export open/status may live in Header/Overview for Wave5.

### 3.3 Input Profile Persistence

Input Profile is Runtime Player local configuration, not Runtime Export data.

Required storage path:

```text
<electron userData>/
  input-profiles/
    ifacialmocap/
      profiles.json
```

Required:

- `Calibration range / learned signs` persist in Input Profile.
- `activeProfileId` persists.
- Connect should select the active profile when possible.
- Profile absence should make Calibration the primary next action.
- Profile read failure should fall back to temporary defaults and surface warning in diagnostics/status.

Forbidden:

- Storing Input Profile inside Runtime Export directory.
- Storing Input Profile inside Editor workspace.
- Saving session `Look Forward` neutral directly into the persistent profile.

### 3.4 Look Forward Is Session Neutral

Required:

- `Look Forward` uses the latest received `TrackingFrame`.
- It updates session neutral offset.
- It does not immediately overwrite persistent profile neutral/range.
- It is available from Header and Input page when input frame is available.

Accepted limitation:

- `Save current forward to profile default` is future work.

### 3.5 Guided Calibration Learns Signs

Required:

- Guided calibration v0 records range and learned signs.
- Direction sign is learned during prompt capture rather than hard-coded.
- Prompt completion is detected from input deltas crossing threshold and staying stable briefly.
- v0 may use simple deterministic thresholds and sample windows.

Required prompt groups:

- Look forward.
- Turn face left/right.
- Look up/down.
- Tilt left/right.
- Eyes left/right/up/down.
- Blink.
- Open mouth.
- Smile.

Accepted limitation:

- Profile quality scoring can be simple.
- Free recording mode is future work.
- head position prompts are future work.

### 3.6 Temporary Defaults Are Included

Required:

- `Use Temporary Defaults` exists as a non-persistent escape hatch.
- It allows live confirmation without a saved profile.
- It must be visibly marked as temporary.

Rationale:

- First-run and debug flows should not block completely on profile creation.
- Temporary defaults are not a substitute for saved profile calibration.

### 3.7 Auto Mapping v0

Required:

- Runtime Exportロード後にAuto Mappingを生成できる。
- Editor側の標準parameter名 / input manifest / project preset aliasesを使う。
- Mapping should target external-input/authored user input parameters only.
- Computed/dynamics-owned/hidden/internal parameters must not be direct output targets.

Required semantic slots:

| Slot | Initial input source | Default target |
|---|---|---|
| Head horizontal | head rotation + learned sign | `Face Angle X` |
| Head vertical | head rotation + learned sign | `Face Angle Y` |
| Head tilt | head rotation + learned sign | `Face Angle Z` |
| Eye blink left | `eyeBlink_L` | `Eye Left Open` |
| Eye blink right | `eyeBlink_R` | `Eye Right Open` |
| Gaze horizontal | eye Euler first | `Eyeball X` |
| Gaze vertical | eye Euler first | `Eyeball Y` |
| Mouth open | `jawOpen` | `Mouth Open` |
| Mouth smile | `mouthSmile_L/R` | `Mouth Smile` |

Accepted decision:

- v0 prioritizes eye Euler for Gaze X/Y.
- Future may switch or expose source selection for `eyeLook*` blendshapes.

### 3.8 Slot Controls

Required per slot:

- `enabled`
- `invert`
- `strength`

Allowed:

- Display target parameter name.
- Display unmapped/missing state.

Forbidden in Wave5:

- Advanced raw source selection UI.
- Smoothing.
- Deadzone.
- Response curve editor.
- Persistent Model Mapping Profile save.

### 3.9 Live Parameter Path

Required path:

```text
UDP frame
-> parse / normalize TrackingFrame
-> session neutral + Input Profile range/signs
-> semantic slot mapping
-> sanitized runtime parameter values
-> main sends parameter frame to Stage
-> Stage evaluates runtime-core frame
-> WebGL render updates
```

Required boundary:

- main owns input session, profile, calibration, mapping, and sanitized parameter frame production.
- Stage owns runtime-core evaluation and WebGL render update.
- Control owns UI for setup, mapping edit, and diagnostics display.

Forbidden:

- Control renderer computing live model state as the source of truth.
- Stage receiving raw tracking frame or debug diagnostics.
- Sending full geometry frames from main to Stage every input frame.

### 3.10 Live Update Frequency

Required:

- Diagnostics remain throttled for UI.
- Stage live motion must not be limited to diagnostics 10Hz.
- main may emit parameter frames at input rate, or coalesce latest mapped values.
- Stage should consume the latest sanitized parameter frame on its render/update path.

Recommended:

- Keep latest parameter frame and coalesce where practical.
- Avoid React state updates at input frame rate.

### 3.11 Documentation Alignment

Final integration must update related Runtime Player docs and maps to match implementation facts.

Required basis:

- [Runtime Player Wave Planning Conventions](runtime-player-wave-planning-conventions.md)

## 4. Primary Basis

Runtime Player UX/design basis:

- [Initial Runtime Player Screen](../../screens/initial-runtime-player-screen.md)
- [Control Window Screen Structure](../../screens/control-window-screen-structure.md)
- [Tracking Setup / Live Mapping UX](../../screens/tracking-setup-live-mapping.md)
- [Runtime Player Technology Stack Decision](../../architecture/technology-stack-decision.md)
- [Runtime Player Development Policy](../../architecture/runtime-player-development-policy.md)
- [Tracking Input Mapping Baseline](../../architecture/tracking-input-mapping-baseline.md)
- [iFacialMocap Input Adapter Research](../../research/ifacialmocap-input-adapter-research.md)
- [Runtime Player Wave Planning Conventions](runtime-player-wave-planning-conventions.md)

Implementation fact basis:

- [Runtime Player Wave3 Final Integration Report](../waves/wave3/runtime-player-wave3-final-integration-report.md)
- [Runtime Player Wave4 Final Integration Report](../waves/wave4/runtime-player-wave4-final-integration-report.md)

Relevant current source:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/input-diagnostics-panel.tsx`
- `apps/runtime-player/src/main/input-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/runtime-export-loader/**`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/preload/**`
- `apps/runtime-player/src/stage/**`
- `apps/runtime-player/src/stage/runtime-evaluation/**`
- `packages/runtime-core/**`

## 5. Wave Strategy

```text
Batch 1:
  Domain A: Control Shell + Input Profile / Calibration v0

Batch 2:
  Domain B: Auto Mapping + Stage Live Parameter Application

Batch 3:
  Domain C: Final Integration / Clean Review / Docs Alignment
```

Parallelism summary:

| Domain | Can run in parallel? | Reason |
|---|---:|---|
| A. Control Shell + Input Profile / Calibration v0 | No | Establishes Control page structure, profile store, session neutral, and calibration state needed by mapping. |
| B. Auto Mapping + Stage Live Parameter Application | No | Depends on Domain A profile/session neutral and must integrate with the resulting Control Mapping page. |
| C. Final Integration / Clean Review / Docs Alignment | No | Depends on A/B completion and must review integrated behavior plus docs. |

Rationale:

- A and B both touch Control/preload/main contracts, so parallel editing would create avoidable conflicts.
- Profile/calibration must be settled before mapping can reliably produce parameter values.
- Stage live path is the value gate and should consume a stable sanitized parameter frame contract.

## 6. Acceptance Criteria

### 6.1 Control Window Structure

Required:

- Control Window has a persistent Header.
- Control Window has navigation for real Wave5 pages only: `Overview`, `Input`, `Mapping`.
- `Model / Stage / Diagnostics` placeholder pages are not added in Wave5.
- Overview shows model load state, input state, input profile state, mapping/live readiness, and primary actions.
- Input page shows connection controls, local IP/port, profile state, Look Forward, Recalibrate/Start Calibration.
- Mapping page shows Auto Mapping result and semantic slot controls.
- Existing diagnostics remains accessible as a secondary/collapsible/debug area.

### 6.2 Input Profile Persistence

Required:

- Main process owns Input Profile store.
- Store reads/writes `<electron userData>/input-profiles/ifacialmocap/profiles.json`.
- Store creates directories as needed.
- Store validates schema enough to avoid crashing on corrupt files.
- `activeProfileId` is persisted.
- Profile read failure falls back to temporary defaults with warning.
- Renderer never reads/writes filesystem directly.

### 6.3 Look Forward

Required:

- Uses latest `TrackingFrame`.
- Stores session neutral offset in main-owned runtime session state.
- Reports unavailable state when no frame exists.
- Does not write to persistent profile.

### 6.4 Guided Calibration v0

Required:

- User can start/cancel/finish calibration.
- Calibration has prompt states and records samples.
- Prompt completion is detected automatically from input deltas.
- Range and learned signs are produced.
- Finished calibration can save an Input Profile.
- `Use Temporary Defaults` is available and non-persistent.

### 6.5 Auto Mapping v0

Required:

- Runtime Export parameter metadata is used to build mapping slots.
- Required semantic slots are created when target parameters exist.
- Missing targets are reported without crashing.
- Slot controls support enabled/invert/strength.
- Mapping output produces finite, clamped parameter values.
- Computed/dynamics-owned/hidden/internal parameters are not mapped as direct outputs.

### 6.6 Stage Live Motion

Required:

- Main sends sanitized parameter frames to Stage.
- Stage receives only parameter values and minimal metadata.
- Stage evaluates runtime-core with provided parameter values.
- Stage render updates as input changes.
- Stage remains debug-free and model-only.
- Runtime Export reload resets stale live state.
- Payload-not-loaded parameter frames are ignored or safely discarded.

### 6.7 Verification

Required:

- Focused unit tests for profile document/store.
- Focused tests for calibration range/sign learning.
- Focused tests for mapping helpers.
- Focused tests for Stage live evaluator parameter override.
- Bridge/main tests for sanitized parameter frame production where feasible.
- Typecheck.
- Runtime Player package tests.
- Source organization/dependency checks.
- Manual verification checklist for real iFacialMocap + Runtime Export.

## 7. Domain A: `runtime-player-wave5-control-input-profile-calibration`

Purpose:

- Rework Control Window into Wave5 page shell and implement Input Profile / Look Forward / Guided Calibration v0.

Allowed write scope:

- `apps/runtime-player/src/control/**`
- `apps/runtime-player/src/main/input-profiles/**`
- `apps/runtime-player/src/main/input-profile-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/preload/**`
- focused tests under `apps/runtime-player/**`
- focused reports/reviews under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- `apps/runtime-player/src/stage/**`
- broad `packages/**` changes
- `node_modules/**`

Required implementation:

- Split Control Window display into maintainable components or local page modules.
- Provide `Overview`, `Input`, and `Mapping` navigation shell.
- Keep Mapping page minimal until Domain B fills live mapping behavior.
- Implement Input Profile document types and store.
- Implement profile bridge APIs needed by Control.
- Implement `Look Forward` session neutral.
- Implement guided calibration session state.
- Implement range/learned sign recording.
- Implement `Use Temporary Defaults`.
- Add tests for store, profile parsing, session neutral, calibration logic, and bridge request validation.

Forbidden implementation:

- Stage live rendering.
- Auto Mapping to Runtime Export parameters beyond placeholder/minimal slot shell.
- Model Mapping Profile persistence.
- TCP transport.
- Body Follow or Stage Motion.

Expected report:

- Files changed.
- Control page structure summary.
- Profile store path and schema.
- Calibration prompts and sign learning behavior.
- Verification performed.
- Remaining integration points for Domain B.

Early escape triggers:

- Electron `userData` cannot be safely injected without broader main-process restructuring.
- Input profile schema requires a package-level contract outside Runtime Player.
- Control split creates ambiguous product behavior not covered by docs.

## 8. Domain B: `runtime-player-wave5-auto-mapping-stage-live`

Purpose:

- Implement Auto Mapping v0, mapped runtime parameter frame production, and Stage live parameter application.

Dependencies:

- Domain A profile/session neutral/calibration state and Control Mapping shell.

Allowed write scope:

- `apps/runtime-player/src/main/**`
- `apps/runtime-player/src/preload/**`
- `apps/runtime-player/src/control/**`
- `apps/runtime-player/src/stage/**`
- focused tests under `apps/runtime-player/**`
- focused reports/reviews under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- broad `packages/**` changes unless a tiny missing export/type is discovered and escalated
- `node_modules/**`

Required implementation:

- Add mapping service/helpers for semantic slots.
- Auto map standard parameters from Runtime Export metadata/input manifest.
- Implement enabled/invert/strength controls in Mapping page.
- Produce sanitized parameter frame from latest tracking frame + session neutral + profile range/signs + mapping slots.
- Add main→Stage live parameter channel.
- Generalize Stage runtime evaluation from default pose `{}` to arbitrary parameter values.
- Stage consumes latest parameter frame and updates render.
- Keep Stage model-only and free of debug UI.
- Add tests for mapping, parameter frame generation, Stage live evaluation, and boundary cleanliness.

Forbidden implementation:

- Persistent Model Mapping Profile save.
- Advanced raw source selection.
- smoothing/curve/deadzone.
- Body Follow.
- Stage Motion from head position.
- TCP.
- Runtime parameter sliders.

Expected report:

- Files changed.
- Mapping slot behavior.
- Stage live path summary.
- Sanitized parameter frame contract.
- Verification performed.
- Manual real-device verification notes.

Early escape triggers:

- Runtime Export parameter metadata is insufficient for safe Auto Mapping.
- runtime-core adapter cannot be generalized without broad package changes.
- Stage live loop requires a performance architecture decision beyond Wave5 scope.

## 9. Domain C: `runtime-player-wave5-final-integration-clean-review`

Purpose:

- Validate Wave5 as the first Runtime Player wave where tracking input moves the model, and update docs/maps to match implementation facts.

Allowed write scope:

- `discussion/runtime-player/implementation/waves/wave5/**`
- `discussion/runtime-player/implementation/reviews/wave5/**`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/screens/**`
- `discussion/runtime-player/_map.md`
- narrow source/test fixes only if clean review requires them

Required checks:

- Domain A and Domain B reports exist.
- Review lanes exist and pass or explicitly escalate.
- Control Window only exposes real Wave5 pages.
- Input Profile persists under `userData` and profile failure fallback is safe.
- `Look Forward` is session-local.
- Calibration learns range/signs.
- Auto Mapping uses standard parameters and avoids forbidden output targets.
- Stage live motion works through runtime-core evaluation.
- Stage remains model-only.
- Diagnostics are not used as live-rate UI state.
- Related docs/maps are updated to match implementation facts.

Expected final artifacts:

- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-domain-a-control-input-profile-calibration-report.md`
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-domain-b-auto-mapping-stage-live-report.md`
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave5/_map.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-b-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-final-clean-integration-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/_map.md`

## 10. Review Policy

Each implemented domain requires three review lanes:

1. Spec Compliance Review
   - Check against this plan and Runtime Player screen/design docs.
2. Design / Development Compliance Review
   - Check Runtime Player Development Policy.
   - Check main/preload/control/stage boundaries, IPC/preload safety, file splitting, source organization, dependency scope.
3. Test Adequacy Review
   - Check focused unit/integration tests, typecheck, package tests, dependency/source checks, and manual verification instructions.

Reviewers must report `pass`, `needs_changes`, or `escalate`.

Blocking findings include:

- Stage receives raw tracking/debug data.
- Stage displays debug UI, sliders, raw frame text, or overlays.
- Renderer reads/writes filesystem for Input Profile.
- `Look Forward` overwrites persistent profile neutral without explicit save action.
- Auto Mapping targets computed/dynamics-owned/hidden/internal parameters.
- Live model motion does not use runtime-core evaluation.
- Diagnostics 10Hz stream is used as the only live motion update path.
- Control Window exposes empty placeholder pages as if implemented.
- Agents run `pnpm install`.

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Control pages exist and no empty pages are exposed | source/manual |
| Input Profile store reads/writes userData path | store tests |
| corrupt profile fallback is safe | store tests |
| Look Forward session neutral does not persist | session tests |
| Guided calibration records range/signs | calibration tests |
| Auto Mapping creates semantic slots | mapping tests |
| enabled/invert/strength affect output | mapping tests |
| Stage live parameter override changes render/evaluation | Stage evaluator tests |
| Stage does not receive raw diagnostics | source/review |
| Stage stays clean | source/manual |
| real iFacialMocap moves model | manual checklist |

## 12. Subagent Contract

Orch-Sylph instructions must include:

- Use this Runtime Player Wave5 plan as source of truth.
- Start with bounded current-state confirmation for Runtime Player Wave4 code.
- Delegate Domain A before Domain B.
- Delegate independent review to Review-Sylphs for each implemented domain.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.
- Final integration must update related docs/maps to match implementation facts.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Keep Wave5 focused on Tracking Setup and Live Mapping v0.
- Do not implement Body Follow, Stage Motion, TCP, persistent Model Mapping Profile save, smoothing/curve/deadzone, or advanced raw source editor.
- Keep Stage Window model-only.
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
- Must not implement Runtime Player Wave5 source changes.
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

- TCP receiver.
- VMC/OSC adapter.
- Body Follow.
- head position driven Stage Motion.
- persistent Model Mapping Profile save.
- advanced raw source selection.
- smoothing.
- deadzone.
- response curve editor.
- free range recording mode.
- `Save current forward to profile default`.
- Stage settings page completion.
- Model page completion.
- Diagnostics dedicated page completion.
- Runtime Export generation or mutation.
- Editor feature changes.
- packaging/distribution.
