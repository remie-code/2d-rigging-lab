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
| [orchestration/player-wave2-plan.md](orchestration/player-wave2-plan.md) | Planned / ready for orchestration | Runtime Player Wave2: Runtime Export directory load + static Stage render |
| [waves/wave1/runtime-player-wave1-domain-a-electron-shell-placeholder-ui-report.md](waves/wave1/runtime-player-wave1-domain-a-electron-shell-placeholder-ui-report.md) | Pass | Domain A Electron shell + placeholder UI completion report |
| [waves/wave1/runtime-player-wave1-final-integration-report.md](waves/wave1/runtime-player-wave1-final-integration-report.md) | Pass | Runtime Player Wave1 final integration report |
| [reviews/wave1/runtime-player-wave1-domain-a-spec-compliance-review.md](reviews/wave1/runtime-player-wave1-domain-a-spec-compliance-review.md) | Pass | Domain A spec compliance review |
| [reviews/wave1/runtime-player-wave1-domain-a-design-development-review.md](reviews/wave1/runtime-player-wave1-domain-a-design-development-review.md) | Pass | Domain A design / development compliance review |
| [reviews/wave1/runtime-player-wave1-domain-a-test-adequacy-review.md](reviews/wave1/runtime-player-wave1-domain-a-test-adequacy-review.md) | Pass | Domain A test adequacy review |
| [reviews/wave1/runtime-player-wave1-final-clean-integration-review.md](reviews/wave1/runtime-player-wave1-final-clean-integration-review.md) | Pass | Runtime Player Wave1 final clean integration review |

## 4. Current Implementation State

- `apps/runtime-player` now has the initial Electron/electron-vite shell, Control Window placeholder, Stage Window placeholder, preload bridge, and focused tests from Runtime Player Wave1 Domain A.
- Domain A reviews passed with no findings.
- Runtime Player Wave1 final integration / clean review passed with no findings.
- Wave1 is closed as a placeholder-only Electron app shell wave. User manually confirmed that Control Window and Stage Window appear as separate windows.
- Runtime Player Wave2 is planned around opening a user-chosen Runtime Export directory, validating `runtime-export.json`, and rendering the static default-pose model in Stage.

## 5. Next Action

Start Runtime Player Wave2 using [orchestration/player-wave2-plan.md](orchestration/player-wave2-plan.md). Do not proceed to input adapter, runtime parameter mapping, dynamics playback, or previous export restore until Runtime Export load + static Stage render is complete.
