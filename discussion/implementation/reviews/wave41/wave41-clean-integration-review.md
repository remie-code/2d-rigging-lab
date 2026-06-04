# Wave41 Clean Integration Review: Product Preflight Read / Diff / Report Ergonomics v0

## Verdict

`pass`

## Scope Reviewed

Clean-context integration review for Wave41 Domain G, covering current changed and untracked files under:

- `apps/editor/**`
- `packages/**`
- `fixtures/contracts/**`
- `discussion/implementation/**`
- `discussion/tests/**`

I read the Wave41 plan, A-F domain reports, A-F domain review artifacts, implementation maps/backlog, fixture/traceability docs, development conventions, scoped status/diffs, and the changed source/test/fixture/e2e files directly. I did not rely on the final report as the only source of truth.

## Findings By Severity

### Blocking

None.

### Needs Changes

None.

### Non-Blocking Notes

- `apps/editor/e2e/product-preflight-diff-smoke.mjs` is standalone and is not registered in aggregate `pnpm test:e2e`. This is acceptable for Wave41 because the final verification explicitly runs `node apps/editor/e2e/product-preflight-diff-smoke.mjs`, and `pnpm test:e2e` remains the existing broad editor smoke path through `scripts/editor-e2e-smoke.mjs` and `apps/editor/e2e/smoke-checks.mjs`.
- `workflow-controller.ts` is already a large central controller. Wave41 adds narrow comparison history wiring there and keeps projection/rendering/bridge logic in named files, so this does not violate the source organization policy.
- The Product Preflight comparison state has focused tests for the primary run/rerun and proposal-preview paths. Clearing the Codex proposal review resets comparison UI state while leaving the latest report history available for the next Product Preflight run; this is acceptable residual UX risk, not a Wave41 blocker.

## Lane Review

### Contract / API Consistency

Pass.

- `packages/contracts/src/product-preflight-report-diff.ts:598` defines `ProductPreflightReportDiffDtoSchema`, with session-report scope guarded by `sessionGeneratedReportsOnly: true` and `persistedArtifactCreated: false` at `packages/contracts/src/product-preflight-report-diff.ts:76`.
- The contract derives before/after report status and highest severity from category transitions at `packages/contracts/src/product-preflight-report-diff.ts:627` and `packages/contracts/src/product-preflight-report-diff.ts:852`, addressing the prior Domain A contradiction finding.
- `packages/validator-core/src/product-preflight-report-diff.ts:43` builds schema-validated diffs and emits the same session scope at `packages/validator-core/src/product-preflight-report-diff.ts:97`.
- `packages/ai-interface/src/ai-product-preflight-command.ts` exposes dedicated read/diff/rerun affordance helpers without adding external transport or legacy executable command union behavior.
- `apps/editor/src/editor-workflow/product-preflight-comparison-workflow.ts:25` connects Domain C bridge behavior to Domain B `buildProductPreflightReportDiff` rather than duplicating the diff engine.

### Validator Report Diff Truthfulness / Deterministic Ordering

Pass.

- Category transitions are produced in `PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS` order in `packages/validator-core/src/product-preflight-report-diff.ts:53`.
- Item changes are keyed and sorted through `diffIndexedItems` at `packages/validator-core/src/product-preflight-report-diff-changes.ts:409` and canonical comparison at `packages/validator-core/src/product-preflight-report-diff-changes.ts:491`.
- Unsupported and not-evaluated cases remain structural changes; they are not converted into generated repair or automatic improvement claims. Fixture cases cover no-change, improvement, regression, unsupported/not-evaluated transition, and evidence/diagnostic ref change.

### AI / Editor-Session Command Bridge Scoping

Pass.

- `apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.ts:70` parses current, previous, and proposal-preview session reports and produces comparisons only through the injected diff provider.
- Bridge safety explicitly carries `sessionGeneratedReportsOnly: true`, `persistedArtifactCreated: false`, `automaticRerunAllowed: false`, `autoFixAllowed: false`, and `automaticCommitAllowed: false` at `apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.ts:162`.
- AI rerun affordance output keeps `persistedArtifactCreated: false`, `automaticCommitAllowed: false`, and `autoFixAllowed: false` in `packages/ai-interface/src/ai-product-preflight-command.ts:237`.

### Editor Workflow / UI Truthfulness And Accessibility

Pass.

- `apps/editor/src/editor-workflow/workflow-controller.ts:553` records previous/current Product Preflight reports in memory and updates comparison state after manual runs and proposal previews at `apps/editor/src/editor-workflow/workflow-controller.ts:1241` and `apps/editor/src/editor-workflow/workflow-controller.ts:1269`.
- The UI section title is truthful: `Deterministic report comparison` at `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts:13`.
- The comparison projection labels the scope as session-generated, manual rerun only, and automatic commit disabled at `apps/editor/src/editor-state/product-preflight-comparison-state.ts:141`.
- The e2e smoke scrolls comparison reference/rerun sections into view and checks positive dimensions, giving desktop/mobile reachability coverage.

### Fixtures / E2E Adequacy

Pass.

- Fixture manifest declares rights-clean synthetic data only and false flags for parser/image/renderer/pixel/archive/Cubism claims in `fixtures/contracts/wave41-product-preflight-diff-fixtures/fixture-manifest.json`.
- Fixture request and expected summary JSON cover the required representative cases.
- Focused contract, validator-core, and AI-interface fixture tests assert summaries and selectors rather than relying on broad snapshots.
- `apps/editor/e2e/product-preflight-diff-smoke.mjs:69` covers tutorial setup, Product Preflight run, Codex proposal preview, manual rerun, deterministic diff UI, evidence/diagnostic refs, rerun affordance, and approval-safe pre-commit behavior across desktop/mobile.
- The e2e negative claim oracle at `apps/editor/e2e/product-preflight-diff-smoke.mjs:46` rejects positive forbidden UI claims.

### Non-Goal Containment

Pass.

No positive implementation or product claim was found for persisted/exported Product Preflight artifacts, release/demo gates, repo-side repair generation/ranking, LLM/provider/prompt integration, natural-language repair, auto-fix, automatic commit, external transport, parser/image decode, archive/filesystem implementation, renderer/pixel oracle, Cubism compatibility, dependency additions, or manifest/lockfile changes.

Scans did find expected safe contexts: negative e2e oracles, safety text such as automatic commit disabled, fixture false flags, and explicit non-goal documentation.

### Source Organization / Barrel-Only Indexes

Pass.

- `packages/contracts/src/index.ts`, `packages/validator-core/src/index.ts`, `packages/ai-interface/src/index.ts`, `apps/editor/src/editor-state/index.ts`, and `apps/editor/src/editor-workflow/index.ts` remain barrel-only re-export surfaces.
- New authored logic is in named responsibility files:
  - contract schema family: `packages/contracts/src/product-preflight-report-diff.ts`
  - validator builder/helpers: `packages/validator-core/src/product-preflight-report-diff.ts`, `packages/validator-core/src/product-preflight-report-diff-changes.ts`
  - AI command surface: `packages/ai-interface/src/ai-product-preflight-command.ts`
  - Editor bridge/workflow/projection/rendering: `apps/editor/src/editor-workflow/product-preflight-read-diff-bridge.ts`, `apps/editor/src/editor-workflow/product-preflight-comparison-workflow.ts`, `apps/editor/src/editor-state/product-preflight-comparison-state.ts`, `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts`

### Orchestration Compliance

Pass.

- A-F domain reports and independent Review-Sylph artifacts are present under `discussion/implementation/waves/wave41/` and `discussion/implementation/reviews/wave41/`.
- Domain G did not implement source code. The only Domain G review write is this clean integration review artifact.
- The Domain F standalone e2e registration decision did not require a source fix or Gnome delegation because the focused smoke is directly required by final verification.

## Verification Considered

Reported final verification from Orch-Sylph:

- `pnpm typecheck`: pass.
- `pnpm test:unit`: pass, 225 test files / 1130 tests.
- `pnpm test:e2e`: pass, existing aggregate desktop/mobile editor smoke.
- `node apps/editor/e2e/product-preflight-diff-smoke.mjs`: pass, focused desktop/mobile Wave41 smoke.
- `pnpm run check:source`: pass.
- `pnpm run check:deps`: pass.
- `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests`: pass, LF/CRLF warnings only.
- Dependency manifest diff/status check: pass, no package manifest or lockfile diff.
- Changed-file forbidden-scope scan: pass after classification.

Additional review checks performed:

- Read required skills and basis documents.
- Reviewed `git status --short -uall` and scoped changed-file inventory.
- Read key changed source, tests, fixtures, e2e, maps, final report, and domain review artifacts directly.
- Checked dependency manifest diff over root/editor/contracts/validator-core/ai-interface manifests and `pnpm-lock.yaml`; output was empty.
- Inspected aggregate e2e runner scripts and confirmed the Wave41 focused smoke is intentionally standalone.

I did not rerun the full test suite during this clean review; the review relies on the already-passed final verification plus direct source/doc inspection.

## Residual Risks

- Product Preflight diff remains deterministic structural comparison only. It does not provide natural-language analysis or repair advice.
- Product Preflight remains session-generated/read-only. There is no durable/exported report artifact or release/demo gate.
- Evidence navigation is textual/ref-based through existing evidence and diagnostic refs; it does not open files or validate rendered pixels.
- Focused e2e coverage is direct, not part of the aggregate `pnpm test:e2e` runner. Future CI policy may choose to register it, but Wave41 closure does not require that change.

## User Decision Points

None required to close Wave41.

Future product decisions remain separate: Product Preflight durability/export, acceptance/demo gates, archive/filesystem work, real parser/decode work, renderer/pixel oracle, public/demo asset policy, and Cubism compatibility policy.
