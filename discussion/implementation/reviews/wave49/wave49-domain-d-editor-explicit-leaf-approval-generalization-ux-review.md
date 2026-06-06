# Wave49 Domain D Review: Editor Explicit Leaf Approval Generalization UX

> Target: `wave49-editor-explicit-leaf-approval-generalization-ux`
> Reviewed report: `discussion/implementation/waves/wave49/wave49-domain-d-editor-explicit-leaf-approval-generalization-ux-report.md`
> Role: independent Review-Sylph
> Verdict: `pass`

## Verdict

`pass`.

I reviewed the Domain D report, Wave49 plan/policy basis, accepted Domain A/B/C reports and reviews, the relevant Editor source/test diff, scoped forbidden-word/parser scans, and focused verification results. I found no blocking issue in the reviewed Domain D scope.

## Findings

No findings.

## Scope Note

The current worktree also contains parallel Wave49 changes outside Domain D, including `packages/ai-interface/**`, `packages/operation-core/**`, `packages/package-format/**`, and `packages/validator-core/src/**`. I treated those as B/C/E-owned work according to their reports/reviews and did not attribute them to Domain D. The Domain D report lists only Editor workflow/UI test files plus its report, and my Domain D source review focused on that scope.

## Design / Development Compliance Review

Pass.

- The production Domain D workflow addition is a preflight helper and result/status projection extension, not a new discovery or smart-selection path. `preflightEditorSelectedPsdLayerBatchIntakeWorkflow` resolves explicit refs, validates the current source, materializes selected refs, then dry-runs the same batch operation on a preflight adapter (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:275`, `:278`, `:318`, `:342`).
- Current-source/stale-source checks remain before materialization or operation execution (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:360`, `:378`, `:385`, `:392`).
- The import-plan approval bridge collects approved candidates generically from plan state and sorts by approval order; it does not key behavior to Wave48 fixed3 refs (`apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.ts:49`, `:192`).
- The bridge continues to separate approved, not-approved, and blocked candidates and records boundary flags including `onlyApprovedLeafRefsPassedToBatch`, `rawParserObjectPersistence=notPersisted`, source bytes metadata-only, and no all-layer/recursive import (`apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.ts:113`, `:123`, `:179`).
- The workflow controller's Codex-facing host path validates expected plan context and exact approved refs before preflight/execute (`apps/editor/src/editor-workflow/workflow-controller.ts:619`, `:664`, `:735`, `:768`).

## Test Adequacy Review

Pass.

- Non-fixed eligible leaf approval is covered with `front hair` / `psd:root/group[2]/layer[0]` in preview, where hidden/unsupported input remains unapproved and the arbitrary eligible leaf is approved as a normal candidate (`apps/editor/src/editor-workflow/explicit-psd-import-plan-workflow.test.ts:31`, `:44`, `:63`, `:70`).
- Approval bridge coverage verifies both Wave48-compatible `headwear` and arbitrary `front hair` approved refs, plus not-approved and blocked candidate separation (`apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.test.ts:19`, `:53`, `:57`, `:60`, `:137`).
- Batch workflow coverage verifies dry-run preflight without project mutation or persistent byte writes (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts:116`, `:140`, `:168`) and arbitrary `front hair` commit with per-leaf result refs and no issues (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts:258`, `:288`, `:298`, `:316`).
- Existing and extended tests cover no partial mutation for materialization failure/collision and approved-leaf-only materialization input (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts:172`, `:203`, `:209`, `:243`, `:344`, `:365`, `:378`).
- UI tests cover eligible-only checkbox submission, arbitrary candidate approval, stale preview blocking before execution, and no broad import wording (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:155`, `:179`, `:188`, `:237`, `:263`, `:293`).

## Automation Policy / UI Wording Compliance Review

Pass.

- The visible UI remains simple: approved refs, eligible candidate checkboxes, update preview, and add approved leaf candidates (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:158`, `:191`, `:220`, `:236`, `:290`, `:308`).
- Disabled candidate checkboxes cannot be included in approved refs (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:241`, `:281`).
- Stale changed approvals disable/stop approved-leaf execution until preview regeneration (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:330`, `:686`, `:699`; test at `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:237`).
- Scoped forbidden-word scan over Domain D target files found only test negative assertions, media-type strings, parser metadata strings, boundary fixture values, and `autocomplete`; no new visible `Suggest`, `Auto`, `Recommended`, smart import, semantic classification, auto repair/rigging, all-layer, recursive group, archive/filesystem, Photoshop compositing, Cubism, or public demo asset UI was found.

## Approval Boundary And Execution Truthfulness

Pass.

- Execution remains limited to approved plan refs. The UI command sends only destination parent for approved import-plan intake, relying on current approved plan state instead of unchecked ad hoc refs (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:336`; controller execution at `apps/editor/src/editor-workflow/workflow-controller.ts:672`).
- The batch workflow test proves not-approved candidates are not materialized when bridge evidence contains one approved and one not-approved candidate (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts:209`, `:243`, `:248`, `:252`).
- Hidden/blocked/stale/error states are observable and non-silent through disabled UI choices, stale preview diagnostics, materialization failure summaries, operation rejection summaries, diagnostics, and issue summaries (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:167`, `:179`, `:263`; `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:904`, `:920`, `:937`, `:1091`).

## Result Refs / Per-Leaf Issue Observability

Pass.

- Committed batch summaries now expose batch evidence id, aggregate status, operation ids, batch issues, approval issues, approved/not-approved/blocked counts, and persistence boundary facts (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:772`, `:775`, `:779`, `:803`, `:809`, `:821`).
- Per-entry labels expose approval order, batch evidence id, materialization evidence id, materialization id, generated part/drawable/texture/mesh ids, child operation id, and issue summaries (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:828`, `:834`, `:841`, `:842`, `:847`, `:848`).
- Rejected operation summaries also expose evidence ids, aggregate status, operation id, issues, diagnostics, and per-entry refs where available (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:904`, `:907`, `:911`, `:920`, `:937`, `:940`).
- The Codex-facing projector mirrors import-plan counts/candidate statuses and latest batch generated refs/issues/evidence refs (`apps/editor/src/ai-command-host/editor-ai-psd-import-plan-projector.ts:18`, `:53`, `:80`, `:130`, `:144`, `:166`, `:171`, `:226`).

## Parser / Persistence Boundary Review

Pass.

- `node scripts/check-psd-parser-import-boundary.mjs` passed: 5 direct import/resolve sites remain limited to approved adapter and Wave44 scripts.
- Scoped parser scan over Domain D target files found only `@webtoon/psd` parser metadata strings in tests; no new direct parser import, parser scope expansion, SDK/Core, or wasm usage was found.
- Source PSD bytes and raw parser objects remain non-persisted/metadata-only in bridge boundary evidence (`apps/editor/src/editor-workflow/explicit-psd-import-plan-approval-bridge.ts:98`, `:179`) and batch summaries continue to label private/local provenance and browser-local materialized byte persistence (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:792`, `:821`).

## Source Organization Review

Pass.

- `apps/editor/src/ai-command-host/index.ts` and `apps/editor/src/editor-workflow/index.ts` remain barrel-only re-export files.
- New Editor production logic stays in existing responsibility files: batch intake workflow, workflow controller, and the Domain C projector file used by D tests.
- `pnpm.cmd run check:source` passed.

## Wave48 Compatibility

Pass.

- Existing headwear/eyewear batch behavior remains covered while the arbitrary front-hair test uses the same helper and bridge shape rather than a separate special-case path (`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts:53`, `:620`, `:648`, `:691`).
- Existing stale approval UI behavior remains covered and still blocks execution until preview regeneration (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:237`).

## Verification Performed

| Command / check | Result |
|---|---|
| `git status --short -uall -- apps/editor/src apps/editor/e2e discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | Confirmed Domain D-relevant Editor files plus parallel Wave49 reports/reviews; no `apps/editor/e2e` edit. |
| `git diff -- ...Domain D target files...` | Inspected implementation/test diff directly. |
| Focused Vitest command for 4 Domain D Editor workflow/UI tests | Initial sandbox run failed with esbuild `spawn EPERM`; approved escalated rerun passed: 4 files / 19 tests. |
| `pnpm.cmd typecheck` | Passed: root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`. |
| `node scripts/check-psd-parser-import-boundary.mjs` | Passed: 5 approved direct import/resolve sites. |
| `pnpm.cmd run check:source` | Passed. |
| `pnpm.cmd run check:deps` | Passed. |
| Scoped forbidden smart UI / parser scans over Domain D target files | No forbidden implementation found; hits classified above. |
| `git diff --check --` scoped to Domain D target files and report | Exit 0; Git emitted LF-to-CRLF working-copy warnings only. |

## Residual Risks / Assumptions

- I did not run focused e2e. Domain F owns focused e2e/regression coverage for the real sample PSD path after D/E settle.
- The worktree includes parallel B/C/E changes outside Domain D. Final integration should review the combined state, especially Domain E validator files and Domain C host/projector files.
- Domain D tests use focused synthetic fixtures for `front hair`; real sample PSD execution evidence remains downstream e2e/final integration scope.

## Files Changed By This Review

- `discussion/implementation/reviews/wave49/wave49-domain-d-editor-explicit-leaf-approval-generalization-ux-review.md`
