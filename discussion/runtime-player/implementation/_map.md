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
| [orchestration/player-wave1-plan.md](orchestration/player-wave1-plan.md) | Planned / ready for orchestration | Runtime Player Wave1: Electron app shell + Control/Stage placeholder screen |
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
- Wave1 is closed as a placeholder-only Electron app shell wave. Manual Electron GUI / transparent Stage / OBS-style verification remains a documented desktop follow-up.

## 5. Next Action

Use `pnpm --filter @private-2d-rigging-lab/runtime-player dev` for manual desktop smoke verification, then plan the next Runtime Player wave for real Runtime Export loading, input adapter, runtime loop, or rendering only after explicit scope selection.
