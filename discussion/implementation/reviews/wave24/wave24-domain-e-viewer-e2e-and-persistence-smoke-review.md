# Wave 24 Domain E Review: Viewer E2E and Persistence Smoke

> Target: `wave24-viewer-e2e-and-persistence-smoke`
> Implementer: `019e7eec-c237-78e1-b316-10c1566628bd` / `Gnome the 41st`
> Role: independent Review-Sylph
> Verdict: `pass`

## Scope Reviewed

Reviewed Domain E from the required basis documents, upstream Domain A-D completion/review reports, the Domain E completion report, the actual changed E2E files, relevant viewer UI/test-id source files, and local verification commands.

This review did not edit source or test files. The only write performed by this review is this artifact.

Domain E changed files reviewed:

- `apps/editor/e2e/viewer-runtime-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave24/wave24-domain-e-viewer-e2e-and-persistence-smoke-completion.md`

Relevant existing/context files inspected:

- `apps/editor/e2e/dynamics-persistence-smoke.mjs`
- `apps/editor/e2e/source-intake-smoke.mjs`
- `apps/editor/e2e/asset-io-boundary-smoke.mjs`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-panel.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-parameter-controls.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave24-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave23/wave23-final-report.md`
- `discussion/implementation/reviews/wave23/wave23-clean-integration-review.md`
- `discussion/implementation/waves/wave24/wave24-domain-a-viewer-evaluation-foundation-completion.md`
- `discussion/implementation/reviews/wave24/wave24-domain-a-viewer-evaluation-foundation-review.md`
- `discussion/implementation/waves/wave24/wave24-domain-b-editor-viewer-runtime-surface-completion.md`
- `discussion/implementation/reviews/wave24/wave24-domain-b-editor-viewer-runtime-surface-review.md`
- `discussion/implementation/waves/wave24/wave24-domain-c-viewer-validator-report-integration-completion.md`
- `discussion/implementation/reviews/wave24/wave24-domain-c-viewer-validator-report-integration-review.md`
- `discussion/implementation/waves/wave24/wave24-preview-viewer-equivalence-fixtures-completion.md`
- `discussion/implementation/reviews/wave24/wave24-preview-viewer-equivalence-fixtures-review.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/218_Open_Viewer.md`

## Findings

No blocking, high, medium, or low findings.

## Design / Development Compliance

Result: `pass`.

- Domain E stays within the allowed E2E/report scope. The implementation adds a focused `viewer-runtime-smoke.mjs`, wires it into the existing smoke loop, mirrors viewer test IDs in the E2E test-id module, and writes the completion report.
- No broad editor implementation, runtime/operation/validator implementation, package/fixture implementation, public `index.ts` implementation logic, dependency manifest, or lockfile change was introduced by Domain E.
- The Viewer / Runtime workflow remains an in-editor runtime inspection surface, not a standalone viewer app, renderer, file picker, parser, image decode path, archive path, actual binary upload path, or Cubism compatibility oracle.
- E2E test IDs are narrow and match the source-side IDs from Domain B. The source UI test IDs are defined in `apps/editor/src/editor-state/editor-test-ids.ts`, and the browser-side mirror only adds the corresponding selectors and `createViewerParameterControlTestId`.
- Gnome reported no UI source tweaks for Domain E. The workspace contains upstream Domain A-D UI/source changes, but Domain E's reviewed changes are limited to E2E files and its completion report.
- A targeted forbidden-scope scan over the Domain E E2E files found no new file picker, parser, archive, Cubism, manifest, lockfile, or dependency changes. The only forbidden-term hits were pre-existing `imageDecode` helper text in `smoke-checks.mjs` for deterministic texture-preview smoke, not Domain E-added scope.

## Test Adequacy

Result: `pass`.

- Save/load is covered before opening the viewer: `viewer-runtime-smoke.mjs` saves to browser storage, asserts the persisted project shape, reloads the page, loads from browser storage, and asserts the saved package again.
- Viewer opening and runtime surface reachability are covered: the smoke clicks `viewerRuntime.open`, waits for `viewerRuntime.panel`, verifies the panel and slider are visible, and captures a viewer runtime screenshot.
- Runtime snapshot evidence is covered through visible UI assertions for package state, `Runtime Snapshot`, `surface: viewer`, snapshot ID prefix, package ID/revision, override count, runtime state refs, and the target parameter value.
- Parameter operation and diff evidence are covered by setting `param_preview_body_yaw` through the viewer slider and asserting `viewerOverride`, `1 override`, and `draw_body` in the runtime diff.
- Diagnostics are covered by asserting the visible `Validation Diagnostics` section, validation report ID, check count text, and `No diagnostics` happy-path state.
- Preview/viewer equivalence is covered at browser-smoke level by proving viewer override does not mutate preview state, then applying the same parameter value to Preview and observing the preview drawable change while Viewer diff reports `draw_body`. Exact semantic equivalence remains properly covered by Domain D's focused fixture.
- Desktop/mobile coverage is integrated through the existing `editorSmokeViewports` loop. The viewer smoke runs for both `desktop` and `mobile`.
- Accessibility basics are covered for the viewer open button `aria-expanded`, panel `aria-labelledby` name, close/reset button names, and viewer slider `aria-label`.
- Layout basics are covered by the existing horizontal overflow checks after the viewer runtime smoke and after the post-viewer reset.
- Existing source/PSD, split PNG, binary asset boundary, and dynamics E2E paths remain in the same full smoke run before the viewer smoke, and `pnpm.cmd test:e2e` passed for desktop and mobile.

## Verification Performed

Initial non-escalated PowerShell commands failed with `windows sandbox: spawn setup refresh`. Following tool policy, required reads and verification commands were rerun with escalation.

| Check | Result |
|---|---|
| `git status --short -uall` | Confirmed Domain E files are present in a shared Wave24 worktree that also contains upstream Domain A-D files. |
| `git diff -- apps/editor/e2e/viewer-runtime-smoke.mjs apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/test-ids.mjs discussion/implementation/waves/wave24/wave24-domain-e-viewer-e2e-and-persistence-smoke-completion.md` | Inspected tracked Domain E diff; untracked `viewer-runtime-smoke.mjs` inspected directly. |
| Direct source reads of `viewer-runtime-smoke.mjs`, `smoke-checks.mjs`, and `test-ids.mjs` | pass |
| Source-side selector/a11y spot check under `apps/editor/src/editor-state/editor-test-ids.ts` and `apps/editor/src/ui/viewer-runtime/**` | pass |
| Existing E2E integration spot checks for source/PSD, split PNG, binary boundary, and dynamics smoke files | pass |
| `pnpm.cmd test:e2e` | pass; desktop smoke passed, mobile smoke passed, smoke passed. |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- apps/editor discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24` | pass; Git emitted LF/CRLF working-copy warnings only. |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml package-lock.json npm-shrinkwrap.json yarn.lock apps/editor/package.json packages/*/package.json` | pass; no output. |
| Targeted forbidden-scope scan over Domain E E2E files | pass; no Domain E-added blocking matches. |

## Residual Risks

- The browser smoke checks semantic UI evidence and happy-path diagnostics, not exact runtime numeric values. Domain A runtime tests and Domain D equivalence fixtures remain the numeric/semantic oracle.
- The browser equivalence smoke intentionally avoids pixel or renderer comparison. It proves shared parameter behavior, affected drawable evidence, and viewer-session isolation.
- Domain C missing/stale viewer evidence diagnostics are not forced through the happy-path UI smoke; Domain C focused tests cover those validator cases.
- Verification ran in a shared uncommitted Wave24 workspace rather than a fresh checkout replay.

## User Decision Points

None.

## Required Gnome Fix

None.
