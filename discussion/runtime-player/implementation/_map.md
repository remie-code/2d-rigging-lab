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
| [waves/wave1/runtime-player-wave1-domain-a-electron-shell-placeholder-ui-report.md](waves/wave1/runtime-player-wave1-domain-a-electron-shell-placeholder-ui-report.md) | Pass | Domain A Electron shell + placeholder UI completion report |
| [waves/wave1/runtime-player-wave1-final-integration-report.md](waves/wave1/runtime-player-wave1-final-integration-report.md) | Pass | Runtime Player Wave1 final integration report |
| [waves/wave2/runtime-player-wave2-domain-a-runtime-export-loader-ipc-report.md](waves/wave2/runtime-player-wave2-domain-a-runtime-export-loader-ipc-report.md) | Pass | Runtime Player Wave2 Domain A Runtime Export loader + IPC contract |
| [waves/wave2/runtime-player-wave2-domain-b-static-stage-renderer-report.md](waves/wave2/runtime-player-wave2-domain-b-static-stage-renderer-report.md) | Pass | Runtime Player Wave2 Domain B static Stage renderer |
| [waves/wave2/runtime-player-wave2-final-integration-report.md](waves/wave2/runtime-player-wave2-final-integration-report.md) | Pass | Runtime Player Wave2 final integration report |
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
- GUI/screenshot verification and real Runtime Export visual inspection remain manual verification items, especially alpha/clipping appearance and practical IPC payload size.

## 5. Next Action

Manually verify Runtime Player Wave2 with the user's real Runtime Export using [waves/wave2/runtime-player-wave2-final-integration-report.md](waves/wave2/runtime-player-wave2-final-integration-report.md). Do not proceed to input adapter, runtime parameter mapping, dynamics playback, or previous export restore until the real-export visual check and remaining risks are accepted or scheduled.
