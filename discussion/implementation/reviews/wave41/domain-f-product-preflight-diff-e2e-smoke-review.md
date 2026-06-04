# Wave41 Domain F Review: Product Preflight Diff E2E Smoke

## Verdict

`pass`

## Scope Reviewed

- `apps/editor/e2e/product-preflight-diff-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave41/domain-f-product-preflight-diff-e2e-smoke-report.md`

Clean-context review used basis documents, prior Wave41 A-E reports/reviews, Domain F changed files, relevant existing e2e helpers/smokes, relevant UI/workflow source for test-id and comparison behavior, scoped diffs, and local verification. The implementation summary was read for orientation only and was not treated as source of truth.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave41-plan.md`
- Wave41 A-E reports under `discussion/implementation/waves/wave41/`
- Wave41 A-E review artifacts under `discussion/implementation/reviews/wave41/`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- Existing e2e helpers/smokes under `apps/editor/e2e/**`, especially `product-preflight-smoke.mjs`, `codex-proposal-review-smoke.mjs`, `test-ids.mjs`, `page-session.mjs`, `vite-server.mjs`, and `smoke-checks.mjs`
- Relevant editor source for comparison test IDs and UI/workflow behavior:
  - `apps/editor/src/editor-state/editor-test-ids.ts`
  - `apps/editor/src/editor-state/product-preflight-comparison-state.ts`
  - `apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.ts`
  - `apps/editor/src/editor-workflow/product-preflight-comparison-workflow.ts`
  - `apps/editor/src/editor-workflow/workflow-controller.ts`
  - `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts`
  - `apps/editor/src/ui/product-preflight/product-preflight-panel.ts`
  - `apps/editor/src/ui/app-shell/app-shell.ts`

## Findings By Severity

No blocking or needs-change findings.

Residual note: `product-preflight-diff-smoke.mjs` is a direct standalone smoke, not imported by the aggregate `apps/editor/e2e/smoke-checks.mjs` runner. This is acceptable for Domain F because the assignment and report require focused verification with `node apps\editor\e2e\product-preflight-diff-smoke.mjs`, and that direct desktop/mobile smoke passed. Integrator may choose separately whether to add it to the aggregate e2e runner.

## Design / Development Compliance Review

Pass.

- Domain F scope is respected. Domain F status shows only `apps/editor/e2e/test-ids.mjs` modified and `apps/editor/e2e/product-preflight-diff-smoke.mjs` plus the Domain F report added. No Domain F `apps/editor/src/**`, package source, manifest, or lockfile edits were present.
- The tracked e2e diff only adds the five Product Preflight comparison test-id mirrors in `apps/editor/e2e/test-ids.mjs:73` through `apps/editor/e2e/test-ids.mjs:77`, matching source test IDs in `apps/editor/src/editor-state/editor-test-ids.ts:73` through `apps/editor/src/editor-state/editor-test-ids.ts:77`.
- The smoke follows existing local Node/CDP e2e style: it uses `startOrReuseEditorServer`, `launchHeadlessBrowser`, `createPageSession`, viewport loops, localStorage cleanup, direct DOM test-id interactions, and screenshot capture like the existing Product Preflight and Codex proposal smokes.
- Product Preflight remains session-generated/read-only. The Wave41 plan requires that boundary at `discussion/implementation/orchestration/wave41-plan.md:50`, and the comparison bridge/source keeps `sessionGeneratedReportsOnly: true`, `persistedArtifactCreated: false`, `automaticRerunAllowed: false`, `autoFixAllowed: false`, and `automaticCommitAllowed: false` at `apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.ts:162` through `apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.ts:166`.
- No persisted/exported Product Preflight artifact, release/demo gate, repair system, AI judgment surface, parser/image/archive/filesystem/renderer/Cubism claim, external dependency, or manifest/lockfile change was added. The scoped dependency manifest/lockfile diff was empty.
- Approval lifecycle is respected. The e2e submits a proposal but does not request approval, record approval, or commit. It asserts the committed package revision and operation log stay at r34/34 and the proposal-created part is absent (`apps/editor/e2e/product-preflight-diff-smoke.mjs:308` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:316`), while approval controls stay pre-commit with request enabled and record/commit disabled (`apps/editor/e2e/product-preflight-diff-smoke.mjs:333` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:340`).
- No e2e assertion weakening was found. Existing e2e files were not modified except for adding comparison test IDs to the e2e mirror; no existing assertions were removed or loosened.
- `index.ts` / source organization policy is not impacted by Domain F. No `index.ts` file is in Domain F scope, and no production source was edited by Domain F.

## Test Adequacy Review

Pass.

- The smoke covers the requested desktop/mobile flow. `runProductPreflightDiffE2eSmoke` sets up the tutorial package, runs Product Preflight, submits a Codex proposal preview, verifies proposal-preview comparison, manually reruns Product Preflight, re-verifies the diff view, and captures screenshots (`apps/editor/e2e/product-preflight-diff-smoke.mjs:69` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:132`).
- Initial Product Preflight comparison assertions are specific. They require the deterministic comparison heading, zero comparison count, session-generated safety text, no previous/proposal-preview empty state, one current rerun affordance, manual request availability, automatic rerun disabled, automatic commit disabled, and reachable rerun section (`apps/editor/e2e/product-preflight-diff-smoke.mjs:228` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:246`).
- Proposal preview assertions are specific enough to catch regressions. They require two comparison rows, both `Previous -> current` and `Current -> proposal preview`, the current report id, category transitions including `modelStructure`, at least one evidence/diagnostic ref row, both current and proposal-preview rerun affordances, disabled automatic behavior, section reachability, and absence of forbidden positive claims (`apps/editor/e2e/product-preflight-diff-smoke.mjs:253` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:304`).
- Evidence/ref observability is meaningful rather than generic text-only presence. The smoke reads the dedicated refs section, requires the proposal-preview comparison label, requires at least one row, and checks for specific artifact ref prefixes such as `operationLog:operations/log.jsonl`, `validationReport:validation/reports/`, `runtimeSnapshot:runtime/snapshots/`, `byteAvailability:generated/byte-availability/`, or `tutorialReadiness:generated/tutorial-readiness/` (`apps/editor/e2e/product-preflight-diff-smoke.mjs:267` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:275`). It also scrolls the refs section into view and checks positive dimensions/visibility (`apps/editor/e2e/product-preflight-diff-smoke.mjs:300`, `apps/editor/e2e/product-preflight-diff-smoke.mjs:464` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:490`).
- Rerun affordance is observable and manual/safe. The smoke checks `Current report rerun`, `Proposal-preview rerun`, `manual request available`, `Automatic rerun disabled`, and `automatic commit disabled` (`apps/editor/e2e/product-preflight-diff-smoke.mjs:280` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:284`).
- Approval-safe non-auto behavior is directly asserted. The Codex proposal review panel must show preview-only/not-committed diff, one added item, preview rerun pass, user approval required, automatic commit disabled, and pre-commit button states (`apps/editor/e2e/product-preflight-diff-smoke.mjs:327` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:340`).
- The smoke includes a forbidden-positive-claim oracle that fails if UI text claims repo-side candidate generation, LLM/provider/prompt readiness, natural-language repair, auto-fix, automatic commit availability, parser/image decode, archive/filesystem support, renderer/pixel oracle, Cubism support, persisted/exported Product Preflight artifact, or release acceptance gate (`apps/editor/e2e/product-preflight-diff-smoke.mjs:46` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:66`, `apps/editor/e2e/product-preflight-diff-smoke.mjs:521` through `apps/editor/e2e/product-preflight-diff-smoke.mjs:529`).

## Verification Performed

Commands required approved escalation because sandboxed command spawning repeatedly failed with `windows sandbox: spawn setup refresh`.

- `node apps\editor\e2e\product-preflight-diff-smoke.mjs`: pass.
  - desktop passed, screenshot captured, `base64Length=176508`.
  - mobile passed, screenshot captured, `base64Length=94168`.
- `node --check apps\editor\e2e\product-preflight-diff-smoke.mjs`: pass.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave41/domain-f-product-preflight-diff-e2e-smoke-report.md`: pass, with only the known Git LF/CRLF working-copy warning for `apps/editor/e2e/test-ids.mjs`.
- Trailing whitespace scan over `apps/editor/e2e/product-preflight-diff-smoke.mjs`, `apps/editor/e2e/test-ids.mjs`, and the Domain F report: no matches.
- Scoped dependency manifest/lockfile diff over root/editor/contracts/validator-core/ai-interface manifests and `pnpm-lock.yaml`: no output.
- Scoped forbidden-claim scan over Domain F files: hits were the negative `forbiddenPositiveClaims` oracle, explicit `automatic commit disabled` safety assertions, and Domain F report non-goal wording.

## Remaining Issues / User-Decision Points

- Fix loop required: no.
- User decision required: no.
- Residual integration choice: whether to add the standalone Domain F smoke to the aggregate `pnpm test:e2e` runner is left to Domain G / integration. This is not blocking for Domain F because the required focused desktop/mobile smoke passed.
