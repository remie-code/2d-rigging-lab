# Runtime Player Wave11 Domain A Report: Input Profile Near/Far Calibration

- verdict: pass
- domain: runtime-player-wave11-input-profile-near-far-calibration
- loop count: 1 implementation loop, 1 review loop, 0 fix loops
- implementation agent: Gnome
- review agent: Review-Sylph

## Scope

Implemented explicit near/far head-position depth calibration for Input Profile while preserving the existing left/right head-position calibration path.

Domain A stayed within Runtime Player Input/Profile calibration scope. It did not implement Stage Motion core, Stage Motion transport, Browser Source transport, Stage page settings, Runtime Export mutation, or Model Mapping Profile changes.

## Implementation Summary

- Split head-position readiness into:
  - `head-position-left-right`
  - `head-position-near-far`
- Added guided prompts:
  - `head-position-near` / `Move closer`
  - `head-position-far` / `Move farther`
- Extended `calibration.headPositionRaw.learnedSigns` with:
  - `bodyNear`
  - `bodyFar`
- Preserved backward compatibility:
  - profiles without `headPositionRaw` still load
  - lateral-only `headPositionRaw` profiles still load
  - lateral-only profiles show left/right ready and near/far missing
- Updated missing-only calibration:
  - old profiles with no head position guide left/right plus near/far
  - profiles with left/right ready guide only near/far
- Added a focused input-profile helper for deterministic normalized depth:
  - `normalizeInputProfileHeadPositionDepth`
  - returns positive values for learned near direction
  - returns `null` until near/far calibration is ready
- Updated Input/Profile UI and preload bridge contracts only for calibration section/prompt keys.

## Changed Files

- `apps/runtime-player/src/control/input-page.tsx`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.ts`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-head-position-normalization.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-head-position-normalization.test.ts`
- `apps/runtime-player/src/preload/input-profile-bridge-contract.ts`
- `discussion/runtime-player/implementation/reviews/wave11/runtime-player-wave11-domain-a-input-profile-near-far-calibration-review.md`
- `discussion/runtime-player/implementation/waves/wave11/runtime-player-wave11-domain-a-input-profile-near-far-calibration-report.md`

## Verification

Gnome reported:

- Focused Vitest: 6 files / 31 tests passed.
- Runtime Player typecheck: passed.
- Source organization guard: passed.
- Runtime Player unit suite: 65 files / 270 tests passed.
- Initial sandbox Vitest run failed with `spawn EPERM`; rerun with permissions passed.
- `pnpm install`: not run.

Review-Sylph independently ran:

- `pnpm.cmd exec vitest run src/main/input-profile-bridge-request-validation.test.ts src/main/input-profiles/input-profile-calibration-sections.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-profiles/input-profile-calibration-start.test.ts src/main/input-profiles/input-profile-document-parser.test.ts src/main/input-profiles/input-profile-head-position-normalization.test.ts` from `apps/runtime-player`: 6 files / 31 tests passed.
- `pnpm.cmd run typecheck` from `apps/runtime-player`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `pnpm.cmd run test:unit` from `apps/runtime-player`: first run had one unrelated transient Browser Source `fetch failed` / `bad port`; reran the affected Browser Source test file: 16 tests passed; reran full suite: 65 files / 270 tests passed.
- `git diff --check -- <target source files>`: exit 0; Git printed CRLF normalization warnings only.
- `pnpm install`: not run.

## Review Result

Review report:

- `discussion/runtime-player/implementation/reviews/wave11/runtime-player-wave11-domain-a-input-profile-near-far-calibration-review.md`

Review-Sylph verdict: pass.

Blocking or major findings: none.

Non-blocking note: there is no dedicated test for `head-position-left-right` section recalibration preserving an already-calibrated near/far section. Review-Sylph judged this non-blocking because the merge logic is localized and the inverse preservation case, near/far preserving left/right, is tested.

## Boundary / Compliance Notes

- Model Mapping Profile was not altered.
- Browser Source files were not changed.
- No raw tracking/debug data path was added to Browser Source.
- Source organization policy was respected.
- No `index.ts` implementation logic or catch-all source file was introduced.
- No source organization exception is recorded.

## Open Risks

- Real-device iFacialMocap near/far sign feel and threshold tuning still need manual validation in later Wave11 integration.
- Optional regression coverage could be added for left/right recalibration preserving an already-calibrated near/far section, but this is not required to pass Domain A.

## User Decision Points

None for Domain A.

## Domain B Gate

Domain B can start.

Rationale: Domain A now provides backward-compatible near/far profile data, distinct readiness, missing-only near/far calibration, bridge/UI exposure for calibration, and a deterministic depth normalization helper with passing focused tests, typecheck, source organization guard, and rerun full Runtime Player unit suite.
