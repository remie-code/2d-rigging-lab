# Wave39 Domain F Review: Preflight E2E Smoke

## Verdict

pass

## Scope Reviewed

- Reviewed Domain F independently from actual files, diff/status, source selectors, runner wiring, and relevant basis documents. Gnome's completion report was not used as the only source.
- Source/test review was read-only. This review wrote only this artifact.
- Changed Domain F files reviewed:
  - `apps/editor/e2e/test-ids.mjs`
  - `apps/editor/e2e/product-preflight-smoke.mjs`
  - `apps/editor/e2e/smoke-checks.mjs`
  - `discussion/implementation/waves/wave39/domain-f-preflight-e2e-smoke.md`
- Relevant surrounding files read for selector and runner verification:
  - `apps/editor/src/editor-state/editor-test-ids.ts`
  - `apps/editor/src/ui/product-preflight/product-preflight-panel.ts`
  - `scripts/editor-e2e-smoke.mjs`
  - `apps/editor/package.json`
  - `package.json`
- Other Wave39 workspace changes are present but were outside this Domain F review scope.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave39-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave39/domain-d-editor-preflight-workflow.md`
- `discussion/implementation/waves/wave39/domain-e-preflight-fixtures-focused-coverage.md`
- `discussion/implementation/reviews/wave39/domain-d-editor-preflight-workflow-review.md`
- `discussion/implementation/reviews/wave39/domain-e-preflight-fixtures-focused-coverage-review.md`

## Findings

- None.

## Review Notes

- Report truthfulness passes. The focused smoke runs Product Preflight, waits for expected report/package identity, parses category rows, derives overall status/severity from visible rows, and rejects mismatches instead of trusting a single summary string (`apps/editor/e2e/product-preflight-smoke.mjs:64`, `apps/editor/e2e/product-preflight-smoke.mjs:275`).
- Category and section coverage passes. The smoke expects all ten product categories (`apps/editor/e2e/product-preflight-smoke.mjs:31`), verifies `runtimeViewerEvidence` is evaluated and exposes evidence refs (`apps/editor/e2e/product-preflight-smoke.mjs:336`), checks summary counts against parsed row counts (`apps/editor/e2e/product-preflight-smoke.mjs:279`, `apps/editor/e2e/product-preflight-smoke.mjs:353`), and validates blocking, warnings, not-supported, and not-evaluated sections with count and empty-state assertions (`apps/editor/e2e/product-preflight-smoke.mjs:380`, `apps/editor/e2e/product-preflight-smoke.mjs:394`, `apps/editor/e2e/product-preflight-smoke.mjs:401`, `apps/editor/e2e/product-preflight-smoke.mjs:565`).
- Unsupported and not-evaluated outcomes remain truthful. The smoke requires at least one visible `not_evaluated` claim and verifies `not_supported` / `not_evaluated` section counts match category-row totals (`apps/editor/e2e/product-preflight-smoke.mjs:343`, `apps/editor/e2e/product-preflight-smoke.mjs:409`, `apps/editor/e2e/product-preflight-smoke.mjs:414`). This aligns with the validator contract requirement that these outcomes are explicit and not mapped to pass (`discussion/design/module-contracts/validator-contract.md:356`, `discussion/design/module-contracts/validator-contract.md:376`).
- Save/load rerun coverage passes. The smoke saves browser-local project state, verifies package files are present in `localStorage`, reloads, loads the saved project, asserts Product Preflight resets to `Not run`, reruns, and compares a stable report shape (`apps/editor/e2e/product-preflight-smoke.mjs:71`, `apps/editor/e2e/product-preflight-smoke.mjs:76`, `apps/editor/e2e/product-preflight-smoke.mjs:587`, `apps/editor/e2e/product-preflight-smoke.mjs:620`, `apps/editor/e2e/product-preflight-smoke.mjs:659`).
- Non-goal containment passes for Domain F. The smoke explicitly rejects forbidden support wording for AI repair, LLM provider, parser/image decode, archive/filesystem, renderer/pixel, and Cubism support (`apps/editor/e2e/product-preflight-smoke.mjs:50`, `apps/editor/e2e/product-preflight-smoke.mjs:420`). The reviewed Domain F diff/status did not include manifest, lockfile, package implementation, parser, renderer, archive/filesystem, or Cubism implementation changes.
- Development compliance passes for Domain F. The e2e test-id mirror matches source test IDs for Product Preflight (`apps/editor/e2e/test-ids.mjs:64`, `apps/editor/e2e/test-ids.mjs:222`, `apps/editor/src/editor-state/editor-test-ids.ts:64`, `apps/editor/src/editor-state/editor-test-ids.ts:220`), and the UI actually renders those selectors (`apps/editor/src/ui/product-preflight/product-preflight-panel.ts:19`, `apps/editor/src/ui/product-preflight/product-preflight-panel.ts:150`). No Domain F `index.ts`, package manifest, or lockfile change was present in the reviewed file set.
- Test adequacy passes. The focused smoke is direct-runnable and covers desktop/mobile. It is also wired into the existing editor e2e path through `smoke-checks.mjs` (`apps/editor/e2e/smoke-checks.mjs:38`, `apps/editor/e2e/smoke-checks.mjs:80`, `apps/editor/e2e/smoke-checks.mjs:234`) and the root/editor `test:e2e` scripts reach `scripts/editor-e2e-smoke.mjs`, which iterates `editorSmokeViewports` and calls `runEditorSmoke` (`scripts/editor-e2e-smoke.mjs:8`, `scripts/editor-e2e-smoke.mjs:29`).
- Orchestration compliance passes. Domain F was implemented by Gnome, this is a separate clean-context Review-Sylph artifact, and the wave plan scopes Domain F to desktop/mobile e2e preflight, category observation, truthfulness, and browser-local save/load rerun (`discussion/implementation/orchestration/wave39-plan.md:278`, `discussion/implementation/orchestration/wave39-plan.md:282`, `discussion/implementation/orchestration/wave39-plan.md:301`).

## Verification Performed

- `git status --short -uall`: confirmed the reviewed Domain F files are modified/untracked as expected and that other Wave39 changes exist outside this review scope.
- `git diff -- apps/editor/e2e/test-ids.mjs apps/editor/e2e/product-preflight-smoke.mjs apps/editor/e2e/smoke-checks.mjs discussion/implementation/waves/wave39/domain-f-preflight-e2e-smoke.md`: inspected tracked Domain F diff. `product-preflight-smoke.mjs` and the Domain F completion note are untracked, so they were read directly.
- Read `apps/editor/e2e/product-preflight-smoke.mjs`, `apps/editor/e2e/smoke-checks.mjs`, `apps/editor/e2e/test-ids.mjs`, and `discussion/implementation/waves/wave39/domain-f-preflight-e2e-smoke.md`.
- Read Product Preflight UI/test-id source files to verify e2e selectors are live and not orphaned.
- `node --check apps/editor/e2e/product-preflight-smoke.mjs`: pass.
- `node --check apps/editor/e2e/smoke-checks.mjs`: pass.
- `node apps/editor/e2e/product-preflight-smoke.mjs`: pass. Desktop and mobile both passed with `report=preflight_editor_browser_sample` and `status=not_evaluated`.
- `pnpm.cmd test:e2e`: pass. Existing editor smoke passed desktop and mobile after Product Preflight wiring.

Note: sandboxed command startup failed with `windows sandbox: spawn setup refresh`, so read-only review commands and verification commands were run with approved `require_escalated` execution. No source/test files were edited.

## Review Artifact Updated

- `discussion/implementation/reviews/wave39/domain-f-preflight-e2e-smoke-review.md`

## Remaining Issues

- None for Domain F.

## User-Decision Points

- None.
