# Runtime Player Implementation Map

> Runtime Player / Capture Host app の実装wave、orchestration plan、実装報告、review記録の入口地図。

## 1. Scope

この階層は、Editor外アプリである Runtime Player の実装作業だけを扱う。

Editor本体の実装waveは `discussion/implementation/` に残し、Runtime Player のwaveはこの階層で別管理する。

## 2. Directories

| Path | Role | Status |
|---|---|---|
| [orchestration/](orchestration/) | Runtime Player実装waveの計画と起動basis | Created |
| [waves/](waves/) | Runtime Player実装waveごとのdomain report / final report | Created |
| [reviews/](reviews/) | Runtime Player実装waveごとのreview report | Created |

## 3. Key Files

| Path | Status | Content |
|---|---|---|
| [orchestration/player-wave1-plan.md](orchestration/player-wave1-plan.md) | Completed / final pass | Runtime Player Wave1: Electron app shell + Control/Stage placeholder screen |
| [orchestration/player-wave2-plan.md](orchestration/player-wave2-plan.md) | Completed / final pass | Runtime Player Wave2: Runtime Export directory load + static Stage render |
| [orchestration/player-wave3-plan.md](orchestration/player-wave3-plan.md) | Completed / final pass | Runtime Player Wave3: runtime-core evaluated default pose + Stage pan/zoom/reset view |
| [orchestration/player-wave4-plan.md](orchestration/player-wave4-plan.md) | Completed / final pass | Runtime Player Wave4: iFacialMocap UDP receive + tracking debug diagnostics |
| [orchestration/player-wave5-plan.md](orchestration/player-wave5-plan.md) | Completed / final pass | Runtime Player Wave5: Tracking Setup + Live Mapping v0 |
| [orchestration/runtime-player-wave-planning-conventions.md](orchestration/runtime-player-wave-planning-conventions.md) | Active convention | Runtime Player wave final integration documentation alignment convention |
| [waves/wave1/runtime-player-wave1-domain-a-electron-shell-placeholder-ui-report.md](waves/wave1/runtime-player-wave1-domain-a-electron-shell-placeholder-ui-report.md) | Pass | Domain A Electron shell + placeholder UI completion report |
| [waves/wave1/runtime-player-wave1-final-integration-report.md](waves/wave1/runtime-player-wave1-final-integration-report.md) | Pass | Runtime Player Wave1 final integration report |
| [waves/wave2/runtime-player-wave2-domain-a-runtime-export-loader-ipc-report.md](waves/wave2/runtime-player-wave2-domain-a-runtime-export-loader-ipc-report.md) | Pass | Runtime Player Wave2 Domain A Runtime Export loader + IPC contract |
| [waves/wave2/runtime-player-wave2-domain-b-static-stage-renderer-report.md](waves/wave2/runtime-player-wave2-domain-b-static-stage-renderer-report.md) | Pass | Runtime Player Wave2 Domain B static Stage renderer |
| [waves/wave2/runtime-player-wave2-final-integration-report.md](waves/wave2/runtime-player-wave2-final-integration-report.md) | Pass | Runtime Player Wave2 final integration report |
| [waves/wave3/_map.md](waves/wave3/_map.md) | Pass | Runtime Player Wave3 report map |
| [waves/wave3/runtime-player-wave3-domain-a-default-pose-evaluation-adapter-report.md](waves/wave3/runtime-player-wave3-domain-a-default-pose-evaluation-adapter-report.md) | Pass | Runtime Player Wave3 Domain A evaluated default pose adapter |
| [waves/wave3/runtime-player-wave3-domain-b-stage-evaluated-render-and-view-transform-report.md](waves/wave3/runtime-player-wave3-domain-b-stage-evaluated-render-and-view-transform-report.md) | Pass | Runtime Player Wave3 Domain B evaluated Stage render and view transform |
| [waves/wave3/runtime-player-wave3-final-integration-report.md](waves/wave3/runtime-player-wave3-final-integration-report.md) | Pass | Runtime Player Wave3 final integration report |
| [waves/wave4/_map.md](waves/wave4/_map.md) | Pass | Runtime Player Wave4 report map |
| [waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md](waves/wave4/runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md) | Pass | Runtime Player Wave4 Domain A input contract, parser, and normalizer |
| [waves/wave4/runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md](waves/wave4/runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md) | Pass | Runtime Player Wave4 Domain B UDP receiver and Control diagnostics |
| [waves/wave4/runtime-player-wave4-final-integration-report.md](waves/wave4/runtime-player-wave4-final-integration-report.md) | Pass | Runtime Player Wave4 final integration report |
| [waves/wave5/_map.md](waves/wave5/_map.md) | Pass | Runtime Player Wave5 report map |
| [waves/wave5/runtime-player-wave5-domain-a-control-input-profile-calibration-report.md](waves/wave5/runtime-player-wave5-domain-a-control-input-profile-calibration-report.md) | Pass | Runtime Player Wave5 Domain A Control shell, Input Profile, Look Forward, Guided Calibration v0 |
| [waves/wave5/runtime-player-wave5-domain-b-auto-mapping-stage-live-report.md](waves/wave5/runtime-player-wave5-domain-b-auto-mapping-stage-live-report.md) | Pass | Runtime Player Wave5 Domain B Auto Mapping, live parameter frames, Stage live runtime-core evaluation |
| [waves/wave5/runtime-player-wave5-final-integration-report.md](waves/wave5/runtime-player-wave5-final-integration-report.md) | Pass | Runtime Player Wave5 final integration report |
| [reviews/wave1/runtime-player-wave1-domain-a-spec-compliance-review.md](reviews/wave1/runtime-player-wave1-domain-a-spec-compliance-review.md) | Pass | Domain A spec compliance review |
| [reviews/wave1/runtime-player-wave1-domain-a-design-development-review.md](reviews/wave1/runtime-player-wave1-domain-a-design-development-review.md) | Pass | Domain A design / development compliance review |
| [reviews/wave1/runtime-player-wave1-domain-a-test-adequacy-review.md](reviews/wave1/runtime-player-wave1-domain-a-test-adequacy-review.md) | Pass | Domain A test adequacy review |
| [reviews/wave1/runtime-player-wave1-final-clean-integration-review.md](reviews/wave1/runtime-player-wave1-final-clean-integration-review.md) | Pass | Runtime Player Wave1 final clean integration review |
| [reviews/wave2/runtime-player-wave2-domain-a-spec-compliance-review.md](reviews/wave2/runtime-player-wave2-domain-a-spec-compliance-review.md) | Pass | Runtime Player Wave2 Domain A spec compliance review |
| [reviews/wave2/runtime-player-wave2-domain-a-design-development-review.md](reviews/wave2/runtime-player-wave2-domain-a-design-development-review.md) | Pass | Runtime Player Wave2 Domain A design / development compliance review |
| [reviews/wave2/runtime-player-wave2-domain-a-test-adequacy-review.md](reviews/wave2/runtime-player-wave2-domain-a-test-adequacy-review.md) | Pass | Runtime Player Wave2 Domain A test adequacy review |
| [reviews/wave2/runtime-player-wave2-domain-a-post-install-typecheck-follow-up-review.md](reviews/wave2/runtime-player-wave2-domain-a-post-install-typecheck-follow-up-review.md) | Pass | Runtime Player Wave2 Domain A post-install typecheck follow-up review |
| [reviews/wave2/runtime-player-wave2-domain-b-spec-compliance-review.md](reviews/wave2/runtime-player-wave2-domain-b-spec-compliance-review.md) | Pass | Runtime Player Wave2 Domain B spec compliance review |
| [reviews/wave2/runtime-player-wave2-domain-b-design-development-review.md](reviews/wave2/runtime-player-wave2-domain-b-design-development-review.md) | Pass | Runtime Player Wave2 Domain B design / development compliance review |
| [reviews/wave2/runtime-player-wave2-domain-b-test-adequacy-review.md](reviews/wave2/runtime-player-wave2-domain-b-test-adequacy-review.md) | Pass | Runtime Player Wave2 Domain B test adequacy review |
| [reviews/wave2/runtime-player-wave2-final-clean-integration-review.md](reviews/wave2/runtime-player-wave2-final-clean-integration-review.md) | Pass | Runtime Player Wave2 final clean integration review |
| [reviews/wave3/_map.md](reviews/wave3/_map.md) | Pass | Runtime Player Wave3 review map |
| [reviews/wave3/runtime-player-wave3-domain-a-spec-compliance-review.md](reviews/wave3/runtime-player-wave3-domain-a-spec-compliance-review.md) | Pass | Runtime Player Wave3 Domain A spec compliance review |
| [reviews/wave3/runtime-player-wave3-domain-a-design-development-review.md](reviews/wave3/runtime-player-wave3-domain-a-design-development-review.md) | Pass | Runtime Player Wave3 Domain A design / development compliance review |
| [reviews/wave3/runtime-player-wave3-domain-a-test-adequacy-review.md](reviews/wave3/runtime-player-wave3-domain-a-test-adequacy-review.md) | Pass | Runtime Player Wave3 Domain A test adequacy review |
| [reviews/wave3/runtime-player-wave3-domain-b-spec-compliance-review.md](reviews/wave3/runtime-player-wave3-domain-b-spec-compliance-review.md) | Pass | Runtime Player Wave3 Domain B spec compliance review |
| [reviews/wave3/runtime-player-wave3-domain-b-design-development-review.md](reviews/wave3/runtime-player-wave3-domain-b-design-development-review.md) | Pass | Runtime Player Wave3 Domain B design / development compliance review |
| [reviews/wave3/runtime-player-wave3-domain-b-test-adequacy-review.md](reviews/wave3/runtime-player-wave3-domain-b-test-adequacy-review.md) | Pass | Runtime Player Wave3 Domain B test adequacy review |
| [reviews/wave3/runtime-player-wave3-final-clean-integration-review.md](reviews/wave3/runtime-player-wave3-final-clean-integration-review.md) | Pass | Runtime Player Wave3 final clean integration review |
| [reviews/wave4/_map.md](reviews/wave4/_map.md) | Pass | Runtime Player Wave4 review map |
| [reviews/wave4/runtime-player-wave4-domain-a-spec-compliance-review.md](reviews/wave4/runtime-player-wave4-domain-a-spec-compliance-review.md) | Pass | Runtime Player Wave4 Domain A spec compliance review |
| [reviews/wave4/runtime-player-wave4-domain-a-design-development-review.md](reviews/wave4/runtime-player-wave4-domain-a-design-development-review.md) | Pass | Runtime Player Wave4 Domain A design / development compliance review |
| [reviews/wave4/runtime-player-wave4-domain-a-test-adequacy-review.md](reviews/wave4/runtime-player-wave4-domain-a-test-adequacy-review.md) | Pass | Runtime Player Wave4 Domain A test adequacy review |
| [reviews/wave4/runtime-player-wave4-domain-b-spec-compliance-review.md](reviews/wave4/runtime-player-wave4-domain-b-spec-compliance-review.md) | Pass | Runtime Player Wave4 Domain B spec compliance review |
| [reviews/wave4/runtime-player-wave4-domain-b-design-development-review.md](reviews/wave4/runtime-player-wave4-domain-b-design-development-review.md) | Pass | Runtime Player Wave4 Domain B design / development compliance review |
| [reviews/wave4/runtime-player-wave4-domain-b-test-adequacy-review.md](reviews/wave4/runtime-player-wave4-domain-b-test-adequacy-review.md) | Pass | Runtime Player Wave4 Domain B test adequacy review |
| [reviews/wave4/runtime-player-wave4-final-clean-integration-review.md](reviews/wave4/runtime-player-wave4-final-clean-integration-review.md) | Pass | Runtime Player Wave4 final clean integration review |
| [reviews/wave5/_map.md](reviews/wave5/_map.md) | Pass | Runtime Player Wave5 review map |
| [reviews/wave5/runtime-player-wave5-domain-a-spec-compliance-review.md](reviews/wave5/runtime-player-wave5-domain-a-spec-compliance-review.md) | Pass | Runtime Player Wave5 Domain A spec compliance review |
| [reviews/wave5/runtime-player-wave5-domain-a-design-development-review.md](reviews/wave5/runtime-player-wave5-domain-a-design-development-review.md) | Pass | Runtime Player Wave5 Domain A design / development compliance review |
| [reviews/wave5/runtime-player-wave5-domain-a-test-adequacy-review.md](reviews/wave5/runtime-player-wave5-domain-a-test-adequacy-review.md) | Pass | Runtime Player Wave5 Domain A test adequacy review |
| [reviews/wave5/runtime-player-wave5-domain-b-spec-compliance-review.md](reviews/wave5/runtime-player-wave5-domain-b-spec-compliance-review.md) | Pass | Runtime Player Wave5 Domain B spec compliance review |
| [reviews/wave5/runtime-player-wave5-domain-b-design-development-review.md](reviews/wave5/runtime-player-wave5-domain-b-design-development-review.md) | Pass | Runtime Player Wave5 Domain B design / development compliance review |
| [reviews/wave5/runtime-player-wave5-domain-b-test-adequacy-review.md](reviews/wave5/runtime-player-wave5-domain-b-test-adequacy-review.md) | Pass | Runtime Player Wave5 Domain B test adequacy review |
| [reviews/wave5/runtime-player-wave5-final-clean-integration-review.md](reviews/wave5/runtime-player-wave5-final-clean-integration-review.md) | Pass | Runtime Player Wave5 final clean integration review |

## 4. Current Implementation State

- `apps/runtime-player` now has the initial Electron/electron-vite shell, Control Window placeholder, Stage Window placeholder, preload bridge, and focused tests from Runtime Player Wave1 Domain A.
- Domain A reviews passed with no findings.
- Runtime Player Wave1 final integration / clean review passed with no findings.
- Wave1 is closed as a placeholder-only Electron app shell wave. User manually confirmed that Control Window and Stage Window appear as separate windows.
- Runtime Player Wave2 Domain A is complete: Runtime Export directory selection, validation, main-process file loading, typed preload API, Control loaded/error UI, and Stage payload delivery are implemented.
- Runtime Player Wave2 Domain A post-install follow-up fixed the surfaced loader TypeScript issue, and Runtime Player package typecheck now passes.
- Runtime Player Wave2 Domain B is complete: Stage renders the loaded Runtime Export static/default pose through render-core/render-webgl2 on a transparent canvas, with placeholder UI removed after load.
- Runtime Player Wave2 Domain B review lanes pass for spec compliance, design/development compliance, and test adequacy.
- Runtime Player Wave2 final integration / clean review passed. Final verification passed Runtime Player typecheck, elevated unit tests (6 files / 30 tests; sandbox first hit Vitest/esbuild `spawn EPERM`), source organization guard, dependency guard, and diff whitespace check.
- User manually confirmed Runtime Player can open a real Runtime Export and display the model, but Wave2 Stage is still a raw static mesh render that does not apply parameter defaults/keyforms/deformers/opacity keyforms.
- Runtime Player Wave3 is complete: Stage now renders runtime-core evaluated default pose output instead of the raw rest mesh final state, and Stage supports session-local wheel zoom, left-drag pan, and reset view.
- Runtime Player Wave3 review lanes and final clean integration review passed. No source/test fix is required for Wave3 pass.
- User manually confirmed Wave3 behavior with a real Runtime Export: default-parameter model display, mouse pan, and wheel zoom work as expected.
- Runtime Player Wave4 is complete: iFacialMocap UDP receive, parser/normalizer, main-owned input diagnostics state, 10Hz Control diagnostics throttling, Control Window connect/disconnect, Debug / Diagnostics panel, and Copy diagnostics are implemented.
- Runtime Player Wave4 review lanes and final clean integration review passed. No source/test fix is required for Wave4 pass.
- Runtime Player Wave4 remains a receive/parse/debug wave only. Runtime parameter mapping, model motion, body follow, head-position Stage motion, dynamics playback, TCP transport, and Stage debug UI remain out of scope.
- User real-device diagnostics confirmed that Connect alone can receive iFacialMocap UDP frames in the current environment; handshake was not attempted, packets arrived at about 59.5fps, and parser/normalization warnings were zero in the captured sample.
- Runtime Export load is not required for input connection or diagnostics. Runtime Export is required for Stage model display and future model parameter mapping.
- Runtime Player Wave5 is complete at source/test/final integration level: Control Window now exposes `Overview` / `Input` / `Mapping`, Input Profile persists under Electron `userData`, `Look Forward` is session-local, Guided Calibration v0 records range and learned signs, Auto Mapping targets standard external-input parameters, and Stage live motion uses sanitized parameter frames plus runtime-core evaluation.
- Diagnostics remain Control-side throttled UI/debug state; Stage live motion is not driven by the diagnostics 10Hz stream.
- Stage Window remains model-only with a Stage-specific preload surface and does not receive raw tracking frames or broad Control APIs.
- Manual real-device verification remains for final confidence: real iFacialMocap input moving a loaded Runtime Export model on clean Stage, guided calibration through UI, Runtime restart profile reload, and reload/clear stale live state behavior.

## 5. Next Action

Use [waves/wave5/runtime-player-wave5-final-integration-report.md](waves/wave5/runtime-player-wave5-final-integration-report.md), [reviews/wave5/runtime-player-wave5-final-clean-integration-review.md](reviews/wave5/runtime-player-wave5-final-clean-integration-review.md), and [../screens/tracking-setup-live-mapping.md](../screens/tracking-setup-live-mapping.md) as the current Wave5 basis. Next planning should start from the remaining future items: manual real-device verification, persistent Model Mapping Profile, dedicated Model/Stage/Diagnostics pages, advanced mapping controls, Body Follow/head-position Stage Motion, and Stage/window display operations.
