# Wave 21 Domain F Review: PSD Structured E2E and Compatibility Smoke

> Target: `wave21-psd-structured-e2e-and-compatibility-smoke`
> Review agent: Review-Sylph
> Date: 2026-05-31
> Status: `pass`

## Scope

Reviewed Domain F changes only:

- `apps/editor/e2e/source-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `discussion/implementation/waves/wave21/wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-completion.md`

Basis checked independently:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave21-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/implementation/waves/wave20/wave20-final-report.md`
- Wave 21 Domain A-E completion and Review-Sylph reports, with Domain D/E treated as the direct dependency gate.
- `scripts/editor-e2e-smoke.mjs` for e2e runner/logging behavior only.

## Findings

| Severity | Finding | File / line | Status |
|---|---|---|---|
| Blocking | None. The prior completion-artifact finding is fixed: the report now records `pass`, delegated Gnome/Review-Sylph context ids/names, the review result, and the Domain G gate. | `discussion/implementation/waves/wave21/wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-completion.md:3`, `:7`, `:72`, `:80` | pass |
| High | None. | n/a | pass |
| Medium | None. | n/a | pass |
| Low | None. | n/a | pass |

## Review Notes

Dependency gate is satisfied for review. Wave 20 final report is `pass`, Wave 21 Domain A/B/C completion and review reports are `pass`, and the direct Domain D/E gates are `pass`. Domain D says Domain F can proceed after E passes, and Domain E says Domain F can proceed after D also passes.

Artifact fix re-review is accepted. The completion report now uses an allowed final status at `discussion/implementation/waves/wave21/wave21-domain-f-psd-structured-e2e-and-compatibility-smoke-completion.md:5`, records Gnome the 12th and Sylph the 13th with context ids at `:9` and `:10`, records the review result at `:72`, and explicitly states that Domain G can proceed at `:80`.

Structured PSD persistence is adequately pinned by the e2e smoke. The saved-state assertion reads `assets/sources/source-manifest.json` from browser storage and asserts `sourceAsset.psdProfile` adapter, canvas, groups, layer, diagnostic, and compatibility fields at `apps/editor/e2e/source-intake-smoke.mjs:300`, `:521`, `:539`, `:567`, `:584`, and `:598`. This is not limited to flattened diagnostics.

Preview truthfulness remains metadata-scoped. The smoke keeps the deterministic texture preview relation and texture/part mapping assertions at `apps/editor/e2e/source-intake-smoke.mjs:118`, `:619`, `:623`, and `:627`, while the visible text asserts the editor did not parse PSD bytes at `apps/editor/e2e/source-intake-smoke.mjs:103` and `:705`.

Save/load is covered. `runEditorSmoke` saves, asserts persisted source intake state, reloads from storage, and then asserts the structured profile projection remains visible at `apps/editor/e2e/smoke-checks.mjs:99`, `:103`, `:106`, and `:111`. The post-load projection checks structured profile text, canvas, groups, diagnostics, compatibility fallback, and texture relation at `apps/editor/e2e/source-intake-smoke.mjs:693`.

Split PNG compatibility is covered without claiming real image bytes, file picker behavior, or decode support. The focused smoke resets the project, submits split PNG metadata through Source Intake, asserts `importSplitPngSourceAsset`, source row projection, texture preview reference, pending drawable source selection, and truthfulness scanning at `apps/editor/e2e/smoke-checks.mjs:122` and `apps/editor/e2e/source-intake-smoke.mjs:147`. The split PNG note explicitly says no image bytes are decoded at `apps/editor/e2e/source-intake-smoke.mjs:51`.

Accessibility and layout coverage remains adequate for Domain F. The existing source-intake reachability and accessible-name checks still run during the PSD path at `apps/editor/e2e/source-intake-smoke.mjs:76` and `:793`, and horizontal overflow is checked before/after source intake, load, reset, split PNG intake, and final reset at `apps/editor/e2e/smoke-checks.mjs:69`, `:83`, `:121`, `:124`, `:130`, and `:133`.

Scope compliance holds for source changes. Domain F changed e2e smoke files plus its completion note only. There are no dependency manifest or lockfile diffs, no `index.ts` implementation changes, and no parser/file-picker/decode/raster implementation added by Domain F. The scan matches in `apps/editor/e2e/smoke-checks.mjs:390` are pre-existing preview image decode checks, not new PSD/image pipeline implementation.

## Verification

| Check | Result | Notes |
|---|---|---|
| `pnpm.cmd test:e2e` | pass | Desktop and mobile smoke passed. Runner logged preview and drawable screenshots for both viewports. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed. |
| `git diff --check -- apps/editor fixtures/e2e discussion/implementation/waves/wave21 discussion/implementation/reviews/wave21` | pass | Exit 0; Git emitted LF/CRLF working-copy warnings only. |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json` | pass | No output; no dependency manifest or lockfile diffs. |
| Parser/file-picker/decode/raster scan over Domain F changed files | pass with reviewed matches | Added-line matches are explicit non-claims or the truthfulness assertion regex. Whole-file matches in `smoke-checks.mjs` are pre-existing preview image decode helpers. |
| Domain F artifact re-review | pass | Source/e2e changes passed the original review, and the completion artifact now has gate-ready status/context/review-result/Domain-G-gate fields. |

The shell sandbox could not spawn commands in this review context, so read and verification commands were rerun with approved escalated execution.

## Residual Risks

- The split PNG smoke proves metadata intake/projection compatibility only. It intentionally does not prove real PNG bytes, file picker behavior, or image decode.
- The e2e runner still logs only preview and drawable screenshots, not the returned split PNG screenshot. This is acceptable for Domain F because the split PNG assertions run in desktop/mobile smoke and `scripts/editor-e2e-smoke.mjs` was outside the Domain F write scope.
- The structured PSD e2e fixture remains a one-layer happy path. Unsupported feature and broader multilayer details are covered by contract fixtures and focused tests from earlier domains.

## Verdict

`pass`.

No remaining source or artifact fix is required. Domain G can proceed.
