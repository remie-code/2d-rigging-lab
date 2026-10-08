# Runtime Player Wave11 Domain A Review: Input Profile Near/Far Calibration

- verdict: pass
- reviewer: Review-Sylph
- target/domain: runtime-player-wave11-input-profile-near-far-calibration

## Findings

- Blocking/Major: none.
- Low, non-blocking test gap: there is no dedicated test for `head-position-left-right` section recalibration preserving an already-calibrated near/far section. The implementation appears to preserve base learned signs and unedited axes through `...base?.learnedSigns` and axis merge logic in `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:506`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:630`, and `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:634`; existing tests cover the inverse direction, near/far preserving left/right, at `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:159`. This is not blocking for Domain A because the required preservation direction is covered and the merge code is localized, but adding this regression test would reduce Domain B risk.

## Spec Compliance

- Explicit near/far calibration is present. Calibration sections are split into `head-position-left-right` and `head-position-near-far` in `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:12`, with near/far readiness at `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:77` and `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:101`.
- Guided prompts for "Move closer" and "Move farther" are added in `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:112`.
- Existing left/right calibration is preserved and still has separate prompt routing at `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:146`.
- Existing profiles without near/far continue to load. Parser keeps `headPositionRaw` optional at `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts:146` and accepts lateral-only head position data by requiring left/right readiness only at `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts:255`; tests cover no head position, lateral-only, and near/far cases at `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.test.ts:7`, `:31`, and `:62`.
- Readiness distinguishes left/right from near/far via separate status rows in `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:68` and `:77`.
- Missing-only calibration guides only near/far when left/right is ready. The start flow filters missing head-position sections at `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.ts:111` and passes only missing sections to prompt generation at `:132`; the near/far-only case is tested at `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts:48`.
- Sign and normalization data needed for depth scale is stored. `bodyNear` / `bodyFar` are added to the profile document at `apps/runtime-player/src/main/input-profiles/input-profile-document.ts:36`, recorded in session at `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:577`, parsed at `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts:331`, and consumed by `normalizeInputProfileHeadPositionDepth` at `apps/runtime-player/src/main/input-profiles/input-profile-head-position-normalization.ts:6`.
- Domain A does not alter Model Mapping Profile or Browser Source source files. The changed source target is limited to Input Profile main/preload/control files. Browser Source raw/debug exposure is not expanded by these changes.

## Design / Development Compliance

- Boundary is limited to Domain A files: input profile document/parser/session/section/start logic, request validation, bridge contract, and Input page UI.
- UI/bridge changes are minimal: the bridge contract adds only new calibration prompt/section keys in `apps/runtime-player/src/preload/input-profile-bridge-contract.ts:40` and request validation accepts the two new section keys at `apps/runtime-player/src/main/input-profile-bridge-request-validation.ts:130`.
- Input UI exposes per-section head-position actions and gates near/far section calibration until left/right is ready at `apps/runtime-player/src/control/input-page.tsx:93`, `:224`, and `:353`.
- Source organization policy is respected: no new catch-all or `index.ts` implementation files were introduced; the new normalization file has a focused responsibility.
- Backward compatibility semantics are defensible for profile data. The old bridge section key `head-position` is not kept as an accepted request value, but section requests are not persisted and the Control/Main renderer pair ships together, so this is not a blocking compatibility issue.

## Test Adequacy

- Backward parse/load without near/far: covered by `input-profile-document-parser.test.ts:7` and lateral-only coverage at `:31`.
- Near/far prompt readiness: covered by `input-profile-calibration-sections.test.ts:50`, `:82`, and `:116`.
- Missing-only near/far absent case: covered by `input-profile-calibration-start.test.ts:48`.
- Existing left/right behavior: covered by `input-profile-calibration-sections.test.ts:44`, `input-profile-calibration-session.test.ts:110`, and `input-profile-calibration-start.test.ts:19`.
- Deterministic normalized depth/sign behavior: covered by `input-profile-head-position-normalization.test.ts:6`, `:35`, and `:61`.
- Non-blocking suggested addition: left/right-only recalibration preserving existing near/far signs/range.

## Commands Run

- `pnpm.cmd exec vitest run src/main/input-profile-bridge-request-validation.test.ts src/main/input-profiles/input-profile-calibration-sections.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-profiles/input-profile-calibration-start.test.ts src/main/input-profiles/input-profile-document-parser.test.ts src/main/input-profiles/input-profile-head-position-normalization.test.ts` from `apps/runtime-player`: 6 files / 31 tests passed.
- `pnpm.cmd run typecheck` from `apps/runtime-player`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `pnpm.cmd run test:unit` from `apps/runtime-player`: first run had one unrelated transient Browser Source static asset failure, `fetch failed` / `bad port`; reran `src/main/broadcast-source/browser-source-server.test.ts`: 16 tests passed; reran full suite: 65 files / 270 tests passed.
- `git diff --check -- <target source files>`: exit 0; Git printed CRLF normalization warnings only.
- `pnpm install`: not run.

## Open Risks / User Decision Points

- Real-device near/far sign feel still needs manual validation in later Wave11 integration. The calibration records learned signs, but it does not prove that a user recorded near and far as opposite physical movements; this follows existing v0 directional calibration style.
- Working tree contains additional discussion/map document changes outside the source target list. I treated the specified Wave11 plan and screen docs as basis documents and did not review unrelated doc edits as Domain A implementation changes.
- No user/product decision is required before Domain B.

## Domain B Gate

Domain B can start from this review perspective. The calibrated near/far profile data, readiness distinction, missing-only path, bridge/UI exposure, and depth normalization helper are present with passing focused tests, typecheck, source organization guard, and rerun full Runtime Player unit suite.
