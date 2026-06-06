# Wave47 Domain D Report: Editor Multi-Layer Selection Batch Intake UX

> Target: `wave47-editor-multi-layer-selection-batch-intake-ux`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict Candidate

`pass`

Domain D implemented Editor UX/workflow support for explicit selected PSD leaf layer batch intake. The PSD Import panel now supports multi-select leaf layer refs, destination parent part selection for generated part scaffold v0, batch materialization via the Domain B browser service, and mutation through Domain C `importPsdLayerMaterializationBatch`.

The implementation does not add all-layer import, recursive group import, native drag-drop, directory/archive/filesystem access, Photoshop compositing preview, renderer/pixel oracle behavior, dependency changes, or public demo asset wording. Source PSD bytes remain current-session browser input only; raw parser objects and source PSD bytes are not persisted in project/editor state.

Review-Sylph returned `needs_fix` for a source-metadata partial mutation when a first-time batch was later rejected by Domain C. The fix now performs an isolated Editor session preflight before mutating the real adapter: source metadata is imported only into a temporary adapter, the generated part scaffold batch request is dry-run there with `dryRun=true`, and rejected source/batch preflight results are surfaced back to the UI while the real project/session remains unchanged.

## Fix Loop

- Blocking finding addressed: `selected-psd-layer-batch-intake-workflow.ts` no longer commits PSD source metadata before the generated ID, destination parent, and collision checks are accepted by Domain C preflight.
- Implementation detail: Domain D creates a temporary adapter from the current persistence snapshot and operation log, commits missing source metadata only in that temporary adapter, prepares the same deterministic batch operation request, then dry-runs it before any real source metadata commit.
- Rejection behavior: preflight rejection returns `latestSessionPersistenceResult: null` and updates only the transient Editor UI batch-intake state; source assets, operation log, package revision, generated artifacts, part/drawable/texture state, and persistent byte writes remain unchanged.
- Regression added: the generated scaffold collision test now asserts the full rejected-batch mutation snapshot is unchanged, not just texture IDs and browser-local byte writes.

## UX / Workflow Representation

- The PSD Import panel keeps the existing single selected-layer intake path and adds a separate selected leaf layer batch path.
- Multiple selection is represented by explicit leaf-layer checkbox controls plus a `Selected PSD leaf layer refs` textarea. Group rows are visible as tree context but their batch checkboxes are disabled.
- The batch action is labeled `Preflight and add selected leaf layers` and requires a destination parent part. It does not imply all-layer import, group import, or recursive import.
- The batch workflow invokes Domain B `materializeSelectedPsdLayersFromBrowserFile`.
- Domain D only calls Domain C `importPsdLayerMaterializationBatch` when Domain B returns aggregate `success`. Domain B `partialFailure`, `failure`, or `preflightBlocked` results are displayed without mutating generated parts/textures.
- Domain C operation rejections, including generated ID/name collisions and missing parent parts, are preflighted before real source metadata commit and surfaced as rejected batch intake results with batch evidence entries and diagnostics.

## Result Surfacing

The Editor state/view model and panel now surface:

- requested/success/failure counts from materialization and operation evidence
- duplicate/unsupported-group/stale/missing/materialization/cap counts from Domain B results
- per-layer materialized or failed entry labels
- generated part/drawable/texture/mesh ids from Domain C batch evidence
- destination parent part and destination kind `generatedPartScaffold`
- private/local provenance and `publicDemoAsset=false`
- package-local binary asset plus browser-local byte store status
- operation diagnostics for collision and batch preflight rejection states

## Files Changed

Editor source:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/psd-layer-materialization-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/explicit-psd-import-state.ts`
- `apps/editor/src/editor-state/explicit-psd-import-view-model.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`

Focused tests:

- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`

Report:

- `discussion/implementation/waves/wave47/wave47-domain-d-editor-multi-layer-selection-batch-intake-ux-report.md`

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts apps/editor/src/editor-state/explicit-psd-import-state.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts`
  - Passed: 5 files, 16 tests.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts`
  - Passed: 1 file, 3 tests. Includes the no-mutation rejected-batch regression.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - Passed.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd run check:source`
  - Passed.
- `pnpm.cmd run check:deps`
  - Passed.
- `node scripts/check-psd-parser-import-boundary.mjs`
  - Passed: 5 direct import/resolve sites remain limited to the approved adapter and Wave44 scripts.
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave47/wave47-domain-d-editor-multi-layer-selection-batch-intake-ux-report.md`
  - Passed with CRLF normalization warnings only; no whitespace findings.
- `git diff --no-index --check -- NUL <new Domain D file>` for:
  - `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts`
  - `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts`
  - `discussion/implementation/waves/wave47/wave47-domain-d-editor-multi-layer-selection-batch-intake-ux-report.md`
  - No whitespace findings. Exit `1` is expected for no-index differences; output was CRLF normalization warnings only.

## Remaining Issues

- Focused tests use mocked Domain B materialization outputs for Editor batch workflow. Domain B has separate browser-service tests with the real sample PSD targets and exact digests.
- Focused e2e/save-load regression remains Domain F scope.
- Validator/Product Preflight batch diagnostics remain Domain E scope.

## User-Decision Points

None for Domain D.

Future decisions outside this domain remain raising batch caps, supporting hidden leaf materialization, user-supplied generated scaffold ID overrides, or changing the product direction to all-layer/import-recursive workflows.

## Provisional Assumptions

- Domain B/C pass artifacts are accepted upstream and are available in the mixed worktree.
- Domain D should avoid mutation when Domain B reports a partial materialization failure or when Domain C generated scaffold preflight rejects.
- Rejected batch intake must not persist parser-free source metadata as a partial side effect. Domain D enforces this for the first-time source path by preflighting source metadata plus batch operation in a temporary adapter before mutating the real adapter.
