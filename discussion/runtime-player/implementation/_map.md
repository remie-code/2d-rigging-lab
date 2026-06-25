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
| [orchestration/player-wave6-plan.md](orchestration/player-wave6-plan.md) | Completed / final pass | Runtime Player Wave6: Body Follow v0 from head rotation / head position |
| [orchestration/player-wave7-plan.md](orchestration/player-wave7-plan.md) | Completed / final pass | Runtime Player Wave7: persistent Mapping / Body Follow profile + Stage page and Stage state persistence |
| [orchestration/player-wave8-plan.md](orchestration/player-wave8-plan.md) | Completed / final pass | Runtime Player Wave8: Broadcast Stage Setup v0 |
| [orchestration/player-wave9-plan.md](orchestration/player-wave9-plan.md) | Completed / final pass | Runtime Player Wave9: OBS Browser Source Probe |
| [orchestration/player-wave10-plan.md](orchestration/player-wave10-plan.md) | Completed / final pass | Runtime Player Wave10: Broadcast Performance Foundation |
| [orchestration/player-wave11-plan.md](orchestration/player-wave11-plan.md) | Completed / final pass | Runtime Player Wave11: Stage Motion / Head Position Follow |
| [orchestration/player-wave12-plan.md](orchestration/player-wave12-plan.md) | Completed at source/domain level | Runtime Player Wave12: Live Controller Variant switching |
| [orchestration/player-wave13-plan.md](orchestration/player-wave13-plan.md) | Completed / final pass | Runtime Player Wave13: Stage Frame Pacing Diagnostics |
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
| [waves/wave6/_map.md](waves/wave6/_map.md) | Pass | Runtime Player Wave6 report map |
| [waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md](waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md) | Pass | Runtime Player Wave6 Domain A Input Profile head position calibration and missing-only recalibration |
| [waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md](waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md) | Pass | Runtime Player Wave6 Domain B Body X/Z auto mapping, controls, and sanitized live body follow |
| [waves/wave6/runtime-player-wave6-final-integration-report.md](waves/wave6/runtime-player-wave6-final-integration-report.md) | Pass | Runtime Player Wave6 final integration report and docs/maps alignment |
| [waves/wave7/_map.md](waves/wave7/_map.md) | Pass | Runtime Player Wave7 report map |
| [waves/wave7/runtime-player-wave7-domain-a-model-mapping-profile-auto-save-report.md](waves/wave7/runtime-player-wave7-domain-a-model-mapping-profile-auto-save-report.md) | Pass | Runtime Player Wave7 Domain A Model Mapping Profile auto-save / restore |
| [waves/wave7/runtime-player-wave7-domain-b-stage-window-state-auto-save-report.md](waves/wave7/runtime-player-wave7-domain-b-stage-window-state-auto-save-report.md) | Pass | Runtime Player Wave7 Domain B Stage page + Window/View State auto-save |
| [waves/wave7/runtime-player-wave7-final-integration-report.md](waves/wave7/runtime-player-wave7-final-integration-report.md) | Pass | Runtime Player Wave7 final integration report and docs/maps alignment |
| [waves/wave8/_map.md](waves/wave8/_map.md) | Pass | Runtime Player Wave8 report map |
| [waves/wave8/runtime-player-wave8-domain-a-control-recovery-tray-explicit-quit-report.md](waves/wave8/runtime-player-wave8-domain-a-control-recovery-tray-explicit-quit-report.md) | Pass | Runtime Player Wave8 Domain A Control recovery / tray-menu / explicit quit |
| [waves/wave8/runtime-player-wave8-domain-b-runtime-export-auto-restore-report.md](waves/wave8/runtime-player-wave8-domain-b-runtime-export-auto-restore-report.md) | Pass | Runtime Player Wave8 Domain B Runtime Export startup-state / auto restore |
| [waves/wave8/runtime-player-wave8-domain-c-stage-capture-controls-report.md](waves/wave8/runtime-player-wave8-domain-c-stage-capture-controls-report.md) | Pass | Runtime Player Wave8 Domain C Stage capture controls |
| [waves/wave8/runtime-player-wave8-final-integration-report.md](waves/wave8/runtime-player-wave8-final-integration-report.md) | Pass | Runtime Player Wave8 final integration report and docs/maps alignment |
| [waves/wave9/_map.md](waves/wave9/_map.md) | Pass | Runtime Player Wave9 report map |
| [waves/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-report.md](waves/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-report.md) | Pass | Runtime Player Wave9 Domain A Browser Source server / transport |
| [waves/wave9/runtime-player-wave9-domain-b-browser-source-stage-client-report.md](waves/wave9/runtime-player-wave9-domain-b-browser-source-stage-client-report.md) | Pass after fix loop 1 | Runtime Player Wave9 Domain B Browser Source Stage client / render pipeline |
| [waves/wave9/runtime-player-wave9-domain-c-browser-source-control-ux-report.md](waves/wave9/runtime-player-wave9-domain-c-browser-source-control-ux-report.md) | Pass | Runtime Player Wave9 Domain C Browser Source Control UX |
| [waves/wave9/runtime-player-wave9-final-integration-report.md](waves/wave9/runtime-player-wave9-final-integration-report.md) | Pass | Runtime Player Wave9 final integration report, docs/maps alignment, verification, and manual OBS checklist |
| [waves/wave10/_map.md](waves/wave10/_map.md) | Pass | Runtime Player Wave10 report map |
| [waves/wave10/runtime-player-wave10-domain-a-broadcast-performance-foundation-report.md](waves/wave10/runtime-player-wave10-domain-a-broadcast-performance-foundation-report.md) | Pass | Runtime Player Wave10 Domain A Broadcast Performance Foundation |
| [waves/wave10/runtime-player-wave10-final-integration-report.md](waves/wave10/runtime-player-wave10-final-integration-report.md) | Pass after closeout loop 3 | Runtime Player Wave10 final integration report, docs/maps alignment, preserved Domain A evidence, review-completion map closeout, manual OBS checklist, and residual risks |
| [waves/wave11/_map.md](waves/wave11/_map.md) | Pass | Runtime Player Wave11 report map |
| [waves/wave11/runtime-player-wave11-final-integration-report.md](waves/wave11/runtime-player-wave11-final-integration-report.md) | Pass | Runtime Player Wave11 final integration report and docs/maps alignment |
| [waves/wave12/_map.md](waves/wave12/_map.md) | Domain parent verdict passed | Runtime Player Wave12 report map |
| [waves/wave12/wave12-final-integration-report.md](waves/wave12/wave12-final-integration-report.md) | Domain parent verdict passed | Runtime Player Wave12 final integration report |
| [waves/wave13/_map.md](waves/wave13/_map.md) | Pass | Runtime Player Wave13 report map |
| [waves/wave13/domain-b-completion-report.md](waves/wave13/domain-b-completion-report.md) | Pass | Runtime Player Wave13 Performance Diagnostics Capture / Report UX completion report |
| [waves/wave13/wave13-final-integration-report.md](waves/wave13/wave13-final-integration-report.md) | Pass | Runtime Player Wave13 final integration report, docs/maps alignment, clean review, and residual manual checks |
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
| [reviews/wave6/_map.md](reviews/wave6/_map.md) | Pass | Runtime Player Wave6 review map |
| [reviews/wave6/runtime-player-wave6-domain-a-spec-compliance-review.md](reviews/wave6/runtime-player-wave6-domain-a-spec-compliance-review.md) | Pass | Runtime Player Wave6 Domain A spec compliance review |
| [reviews/wave6/runtime-player-wave6-domain-a-design-development-review.md](reviews/wave6/runtime-player-wave6-domain-a-design-development-review.md) | Pass | Runtime Player Wave6 Domain A design / development compliance review |
| [reviews/wave6/runtime-player-wave6-domain-a-test-adequacy-review.md](reviews/wave6/runtime-player-wave6-domain-a-test-adequacy-review.md) | Pass | Runtime Player Wave6 Domain A test adequacy re-review |
| [reviews/wave6/runtime-player-wave6-domain-b-spec-compliance-review.md](reviews/wave6/runtime-player-wave6-domain-b-spec-compliance-review.md) | Pass | Runtime Player Wave6 Domain B spec compliance review |
| [reviews/wave6/runtime-player-wave6-domain-b-design-development-review.md](reviews/wave6/runtime-player-wave6-domain-b-design-development-review.md) | Pass | Runtime Player Wave6 Domain B design / development compliance review |
| [reviews/wave6/runtime-player-wave6-domain-b-test-adequacy-review.md](reviews/wave6/runtime-player-wave6-domain-b-test-adequacy-review.md) | Pass | Runtime Player Wave6 Domain B test adequacy review |
| [reviews/wave6/runtime-player-wave6-final-clean-integration-review.md](reviews/wave6/runtime-player-wave6-final-clean-integration-review.md) | Pass | Runtime Player Wave6 final clean integration review |
| [reviews/wave7/_map.md](reviews/wave7/_map.md) | Pass | Runtime Player Wave7 review map |
| [reviews/wave7/runtime-player-wave7-domain-a-spec-compliance-review.md](reviews/wave7/runtime-player-wave7-domain-a-spec-compliance-review.md) | Pass | Runtime Player Wave7 Domain A spec compliance review |
| [reviews/wave7/runtime-player-wave7-domain-a-design-development-review.md](reviews/wave7/runtime-player-wave7-domain-a-design-development-review.md) | Pass | Runtime Player Wave7 Domain A design / development compliance review |
| [reviews/wave7/runtime-player-wave7-domain-a-test-adequacy-review.md](reviews/wave7/runtime-player-wave7-domain-a-test-adequacy-review.md) | Pass | Runtime Player Wave7 Domain A test adequacy review |
| [reviews/wave7/runtime-player-wave7-domain-b-spec-compliance-review.md](reviews/wave7/runtime-player-wave7-domain-b-spec-compliance-review.md) | Pass | Runtime Player Wave7 Domain B spec compliance review |
| [reviews/wave7/runtime-player-wave7-domain-b-design-development-review.md](reviews/wave7/runtime-player-wave7-domain-b-design-development-review.md) | Pass | Runtime Player Wave7 Domain B design / development compliance review |
| [reviews/wave7/runtime-player-wave7-domain-b-test-adequacy-review.md](reviews/wave7/runtime-player-wave7-domain-b-test-adequacy-review.md) | Pass | Runtime Player Wave7 Domain B test adequacy review |
| [reviews/wave8/_map.md](reviews/wave8/_map.md) | Pass | Runtime Player Wave8 review map |
| [reviews/wave8/runtime-player-wave8-domain-a-spec-compliance-review.md](reviews/wave8/runtime-player-wave8-domain-a-spec-compliance-review.md) | Pass | Runtime Player Wave8 Domain A spec compliance review |
| [reviews/wave8/runtime-player-wave8-domain-a-design-development-review.md](reviews/wave8/runtime-player-wave8-domain-a-design-development-review.md) | Pass | Runtime Player Wave8 Domain A design/development review |
| [reviews/wave8/runtime-player-wave8-domain-a-test-adequacy-review.md](reviews/wave8/runtime-player-wave8-domain-a-test-adequacy-review.md) | Pass | Runtime Player Wave8 Domain A test adequacy review |
| [reviews/wave8/runtime-player-wave8-domain-b-spec-compliance-review.md](reviews/wave8/runtime-player-wave8-domain-b-spec-compliance-review.md) | Pass | Runtime Player Wave8 Domain B spec compliance review |
| [reviews/wave8/runtime-player-wave8-domain-b-design-development-review.md](reviews/wave8/runtime-player-wave8-domain-b-design-development-review.md) | Pass | Runtime Player Wave8 Domain B design/development review |
| [reviews/wave8/runtime-player-wave8-domain-b-test-adequacy-review.md](reviews/wave8/runtime-player-wave8-domain-b-test-adequacy-review.md) | Pass | Runtime Player Wave8 Domain B test adequacy follow-up review |
| [reviews/wave8/runtime-player-wave8-domain-c-spec-compliance-review.md](reviews/wave8/runtime-player-wave8-domain-c-spec-compliance-review.md) | Pass | Runtime Player Wave8 Domain C spec compliance review |
| [reviews/wave8/runtime-player-wave8-domain-c-design-development-review.md](reviews/wave8/runtime-player-wave8-domain-c-design-development-review.md) | Pass | Runtime Player Wave8 Domain C design/development review |
| [reviews/wave8/runtime-player-wave8-domain-c-test-adequacy-review.md](reviews/wave8/runtime-player-wave8-domain-c-test-adequacy-review.md) | Pass | Runtime Player Wave8 Domain C test adequacy review |
| [reviews/wave9/_map.md](reviews/wave9/_map.md) | Pass | Runtime Player Wave9 review map |
| [reviews/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-review.md](reviews/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-review.md) | Pass after fix loop 1 | Runtime Player Wave9 Domain A Browser Source server / transport review |
| [reviews/wave9/runtime-player-wave9-domain-b-browser-source-stage-client-review.md](reviews/wave9/runtime-player-wave9-domain-b-browser-source-stage-client-review.md) | Pass after fix loop 1 | Runtime Player Wave9 Domain B Browser Source Stage client / render pipeline review |
| [reviews/wave9/runtime-player-wave9-domain-c-browser-source-control-ux-review.md](reviews/wave9/runtime-player-wave9-domain-c-browser-source-control-ux-review.md) | Pass | Runtime Player Wave9 Domain C Browser Source Control UX review |
| [reviews/wave9/runtime-player-wave9-final-clean-integration-review.md](reviews/wave9/runtime-player-wave9-final-clean-integration-review.md) | Pass | Runtime Player Wave9 final clean integration review |
| [reviews/wave10/_map.md](reviews/wave10/_map.md) | Pass | Runtime Player Wave10 review map |
| [reviews/wave10/runtime-player-wave10-domain-a-broadcast-performance-foundation-review.md](reviews/wave10/runtime-player-wave10-domain-a-broadcast-performance-foundation-review.md) | Pass | Runtime Player Wave10 Domain A Broadcast Performance Foundation review |
| [reviews/wave10/runtime-player-wave10-final-integration-review.md](reviews/wave10/runtime-player-wave10-final-integration-review.md) | Pass after docs-map fix loop 2 | Runtime Player Wave10 final integration review |
| [reviews/wave13/_map.md](reviews/wave13/_map.md) | Pass | Runtime Player Wave13 review map |
| [reviews/wave13/wave13-final-clean-integration-review.md](reviews/wave13/wave13-final-clean-integration-review.md) | Pass after docs-map fix loop | Runtime Player Wave13 final clean integration review |

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
- User manually confirmed Wave5 with real iFacialMocap and a real Runtime Export: calibration, Auto Mapping, and Stage live motion work, and face/eye/mouth motion is natural.
- Remaining live naturalness gap: the body stays still while the head/face move naturally.
- Runtime Player Wave6 Domain A/B implementation and reviews are complete, and Domain C docs/report integration is complete. Wave6 added Body Follow v0: head rotation / head position derived `Body Angle X/Z`, head position left/right calibration, missing-only/head-position-only recalibration, and body mapping controls.
- Existing profiles without head position calibration remain usable for face / eyes / mouth live mapping. Missing head position calibration skips only the Body Z position component; it does not block existing live mapping.
- Auto Mapping now creates 11 slots when body targets exist by preserving the existing nine Wave5 head/eyes/mouth slots and adding `body-x` / `body-z`.
- Body follow values are generated in main through sanitized live parameter frames. Stage remains model-only and receives no raw tracking frame, raw head position, or debug body data.
- Runtime Player Wave6 final clean integration review passed: [reviews/wave6/runtime-player-wave6-final-clean-integration-review.md](reviews/wave6/runtime-player-wave6-final-clean-integration-review.md).
- Runtime Player Wave7 Domain A/B implementation and reviews are complete, and Domain C docs/report alignment is complete with `pass`: [waves/wave7/runtime-player-wave7-final-integration-report.md](waves/wave7/runtime-player-wave7-final-integration-report.md).
- Wave7 added persistent Model Mapping / Body Follow profile auto-save/restore under `<electron userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json`.
- Wave7 added a real Stage page and Window State auto-save under `<electron userData>/window-state/runtime-player.json` for Stage/Control bounds plus Stage view pan/zoom.
- Stage remains model-only and receives Runtime Export payloads plus sanitized live parameter frames with `parameterValues`, not raw tracking frames.
- Wave7 manual Electron verification is complete by user confirmation: Mapping/Body Follow tune restart/reopen restore, Stage move/resize restore, Stage pan/zoom restore, Stage page Focus/Reset/Center, and real iFacialMocap tracking after profile restore behaved as expected.
- Runtime Player Wave8 Domain A/B/C implementation and reviews are complete, and Domain D final integration docs/report alignment is complete with `pass`: [waves/wave8/runtime-player-wave8-final-integration-report.md](waves/wave8/runtime-player-wave8-final-integration-report.md).
- Wave8 implemented Broadcast Stage Setup v0: Runtime Export startup restore, Control Window recovery, Stage Arrange mode, click-through, always-on-top, Capture Target checklist, and stable Stage title / Copy Window Title.
- Runtime Export startup restore is separate from Input Source; it does not auto-connect iFacialMocap.
- Startup State uses `<electron userData>/startup-state/runtime-player-startup.json`; Window State remains `<electron userData>/window-state/runtime-player.json`.
- click-through starts Off and is not persisted. always-on-top defaults Off and is persisted as `stageEnvironment.alwaysOnTop`.
- Stage remains model-only in normal mode. Capture Target checklist is local readiness only and does not claim OBS integration/readiness.
- Runtime Player Wave9 Domain A/B/C implementation and reviews are complete, and Domain D final integration docs/report alignment is complete with `pass`: [waves/wave9/runtime-player-wave9-final-integration-report.md](waves/wave9/runtime-player-wave9-final-integration-report.md).
- Wave9 implemented OBS Browser Source Probe: loopback `127.0.0.1` HTTP/WebSocket output, tokenized Browser Source URL, token-gated Runtime Export/live parameter transport, transparent model-only Browser Source Stage client, and Control Browser Source diagnostics.
- Browser Source Output is now the fixed primary broadcast path. Native Stage Window controls remain under `Local Preview / Fallback`.
- Browser Source receives Runtime Export payload plus sanitized live parameter frames only; raw tracking/debug/calibration data and private paths are not exposed.
- Runtime Player Wave10 Domain A implementation/review is complete with `pass`, and Domain B final integration docs/report alignment plus final review are complete with `pass`: [waves/wave10/runtime-player-wave10-final-integration-report.md](waves/wave10/runtime-player-wave10-final-integration-report.md), [reviews/wave10/runtime-player-wave10-final-integration-review.md](reviews/wave10/runtime-player-wave10-final-integration-review.md).
- Wave10 keeps Browser Source as the fixed primary broadcast path and suspends only native Stage local live rendering while Browser Source clients are connected.
- Browser Source rendering, live parameter frame production, input processing, mapping, body follow, dynamics, Runtime Export state, and Stage transform sync remain active while native local preview live rendering is suspended.
- Native Stage local live rendering resumes after the zero-client grace period, and reconnect during grace avoids preview bounce.
- Control reports local preview suspension and samples Browser Source live-frame/repeated renderer diagnostics without hiding important server/client/export/render transitions.
- Browser Source startup/resync de-duplicates identical Runtime Export payload application while preserving reload/reconnect and replacement payload behavior.
- Runtime Player Wave11 adds Stage Motion / Head Position Follow: Input Profile near/far calibration, Stage page controls, composed display transform, and Browser Source parity without exposing raw tracking/head-position/calibration data.
- Runtime Player Wave12 adds Live Controller Variant switching: session-only active Variant selection, `singleSelect` / `multiToggle`, `Reset to Model Default`, native Stage / Browser Source parity, and sanitized Browser Source Variant transport.
- Runtime Player Wave13 final integration and clean review passed. Shared Stage renderer frame pacing converges live frames and Stage view/display transform invalidation on scheduled rAF rendering where practical; duplicate unchanged Stage view/display transforms are skipped and counted.
- Wave13 metrics include render count, scheduled/immediate render count, live frame message count, Stage view/display transform counts, duplicate transform skip count, coalesced live frame count, rAF delta, render duration, canvas size, and devicePixelRatio.
- Wave13 Native Stage metrics report through Stage view IPC; Browser Source reports sanitized renderer diagnostics/metrics through the Browser Source diagnostics path.
- Wave13 Control Window includes low-priority `Performance Diagnostics` with target Native Stage / Browser Source / Both, duration 10s / 30s, Start/Stop Capture, Copy Report, Clear Report, report preview, target availability, and comparison guidance.
- Wave13 reports separate source/input FPS from render FPS and exclude raw tracking frames, calibration internals, Browser Source token, private file paths, and full Runtime Export payload.
- Wave10 local preview suspension, Wave11 Stage Motion, and Wave12 Variant switching remain intended preserved behavior under Wave13.
- Spout2 sender, OBS automation/source creation, Input Source auto-connect, WebGL cache redesign, Runtime Export format changes, and Editor changes remain out of scope.

## 5. Next Action

Use [waves/wave13/wave13-final-integration-report.md](waves/wave13/wave13-final-integration-report.md), [waves/wave13/_map.md](waves/wave13/_map.md), and [reviews/wave13/_map.md](reviews/wave13/_map.md) as the latest Runtime Player implementation baseline. Product-confidence next action is manual native Stage and OBS Browser Source verification with Performance Diagnostics captures: URL load, transparent alpha, WebGL2/model rendering, Control client/heartbeat/suspension diagnostics, real iFacialMocap live motion, body follow/dynamics, Variant switching parity, source/input FPS vs render FPS reports, reconnect/resync, native preview resume, perceived performance improvement, OBS custom FPS observations, and audio meter behavior.
