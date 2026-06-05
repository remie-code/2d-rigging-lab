# Wave46 Domain D Review: Editor Selected Layer Intake / Part Mapping UX

> Target: `wave46-editor-selected-layer-intake-part-mapping-ux`
> Date: 2026-06-05
> Reviewer: Review-Sylph independent reviewer
> Mode: clean-context review; source fixes were not implemented

## Verdict

`pass`

## Findings

No blocking findings.

Non-blocking residual risks / notes:

- The worktree is mixed: `packages/operation-core/**`, `packages/package-format/**`, and `packages/validator-core/**` are currently modified or untracked in addition to Domain D Editor files. I treated package/operation changes as Domain C prerequisite scope based on the Domain C report/review, and validator changes as outside this Domain D review. Domain D's reported implementation files are Editor-scoped plus its report.
- Domain D workflow tests cover existing-part success, Domain B unsupported materialization failure, and Domain C missing destination part rejection. New destination part is covered at the UI command level and by Domain C operation tests, but there is no Domain D workflow-level test that commits a new destination part end-to-end.
- Missing/stale current-source Editor validation exists in source, but Domain D's focused tests do not directly cover `missingCurrentSource` / `staleCurrentSource`. Domain B and Domain C have their own stale/missing identity tests; Domain D surfaces representative Domain B/C errors.

## Scope Reviewed

Reviewed directly from files, diffs, tests, and basis docs, not from Gnome's summary alone.

Domain D Editor files reviewed:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/psd-layer-materialization-command.ts`
- `apps/editor/src/editor-session/selected-psd-layer-binary-registration-command.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/explicit-psd-import-state.ts`
- `apps/editor/src/editor-state/explicit-psd-import-view-model.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-workflow.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`

Basis documents inspected:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave46-plan.md`
- `discussion/implementation/waves/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-review.md`
- `discussion/implementation/waves/wave46/wave46-domain-b-browser-selected-layer-materialization-service-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-c-package-operation-texture-intake-part-mapping-bridge-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-c-package-operation-texture-intake-part-mapping-bridge-review.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Design / Development Compliance Review

Pass: Domain D adds an explicit Editor UX/workflow for selected PSD layer intake. The panel renders a parsed layer tree and disables group radio choices, so tree-based selection is layer-only at `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:459` through `:465`. The Add action is explicit and parsed-state gated at `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:216` through `:221` and `:232` through `:255`.

Pass: Destination selection supports existing and new parts. The UI offers existing/new destination options at `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:171` through `:205`, builds existing-part commands at `:303` through `:320`, and builds new-part commands at `:277` through `:300`.

Pass: The workflow uses Wave45 PSD import state and the Domain B materialization service. It validates selected layer/current parsed source state at `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.ts:221` through `:258`, calls `materializeSelectedPsdLayerFromBrowserFile` or its injected equivalent at `:118` through `:125`, and surfaces Domain B failures into intake state at `:127` through `:138` and `:590` through `:615`.

Pass: The workflow invokes the Domain C operation bridge without implementing package logic in Editor UI. It constructs parser-free materialization evidence at `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.ts:413` through `:451`, builds the `importPsdLayerMaterialization` request at `:385` through `:398`, and commits it through the session adapter at `:403` through `:409`. Operation rejection diagnostics are mapped into visible Editor diagnostics at `:172` through `:187` and `:666` through `:675`.

Pass: Result summary includes the required evidence. The committed intake facts include materialized digest, byte length, media type, dimensions, texture evidence, drawable/part evidence, source layer, source PSD, provenance including `publicDemoAsset=false`, and persistence at `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.ts:538` through `:586`.

Pass: Storage/provenance boundary is consistent with Domain A. Source PSD bytes are retained only in the controller closure after browser parse at `apps/editor/src/editor-workflow/workflow-controller.ts:487` through `:488` and `:854` through `:857`, then cleared on load/reset/tutorial/portable import flows at `:572` through `:575`, `:1401`, `:1450`, `:1481`, `:1569`, and `:1587`. The saved editor-state file contains only selection/lock/hidden/tool state, not PSD bytes or parser objects, at `apps/editor/src/editor-state/editor-state-file.ts:5` through `:19` and `packages/package-format/src/model-files.ts:272` through `:282`.

Pass: Materialized bytes are stored through existing package-local/browser-local byte paths. The Editor registration creates a package-local texture binary asset ref under `assets/textures/psd/...` at `apps/editor/src/editor-session/selected-psd-layer-binary-registration-command.ts:43` through `:62` and `:84` through `:88`; the session adapter registers bytes only after a committed `importPsdLayerMaterialization` operation at `apps/editor/src/editor-session/session-adapter.ts:503` through `:524`.

Pass: Source organization policy is satisfied. `apps/editor/src/editor-session/index.ts` and `apps/editor/src/editor-workflow/index.ts` remain barrel-style exports; new implementation is split into named command/workflow files. `pnpm.cmd run check:source` passed.

Pass: Forbidden scope checks found no Domain D implementation of drag-drop, directory picker, File System Access, archive transport, all-layer import, Photoshop full compositing, renderer/pixel oracle, Cubism runtime/export, public demo ingestion, or repository-side AI repair. Parser direct import remains confined to the approved adapter/scripts boundary per the parser boundary guard.

## Test Adequacy Review

Pass with non-blocking gaps noted above.

- `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts` covers existing-part success and asserts no source PSD binary asset persistence at `:26` through `:89`.
- The same workflow test covers Domain B unsupported layer errors at `:91` through `:125`.
- The same workflow test covers Domain C missing destination part rejection at `:127` through `:149`.
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts` covers parsed layer tree radio selection into intake command at `:71` through `:95`.
- The panel test covers new destination part command construction at `:97` through `:121`.
- Focused app-shell changes compile and render with the required callback shape; no behavior-specific app-shell PSD intake test was added.

The coverage is adequate for Domain D's current risk because Domain C already tests new-part operation commit semantics and stale/missing materialized evidence, while Domain D tests representative operation rejection surfacing. A future hardening test should add workflow-level new-part commit and missing/stale current-source validation.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`
  - 3 files / 32 tests passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm.cmd typecheck`
- `pnpm.cmd run check:source`
- `pnpm.cmd run check:deps`
- `node scripts/check-psd-parser-import-boundary.mjs`
  - Passed with 5 direct import/resolve sites limited to the approved adapter and Wave44 scripts.
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave46 discussion/implementation/reviews/wave46`
  - Passed; only LF/CRLF normalization warnings were printed.
- No-index whitespace checks for new Domain D files:
  - `apps/editor/src/editor-session/psd-layer-materialization-command.ts`
  - `apps/editor/src/editor-session/selected-psd-layer-binary-registration-command.ts`
  - `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.ts`
  - `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts`
  - `discussion/implementation/waves/wave46/wave46-domain-d-editor-selected-layer-intake-part-mapping-ux-report.md`

Not performed:

- No manual browser run or e2e run was performed for this Domain D review. The requested independent verification list did not require a focused e2e for this domain, and Domain F owns focused e2e/persistence regression in the Wave46 plan.

## Remaining Issues

- Non-blocking test gap: add a Domain D workflow-level new-part commit test if the orchestrator wants stronger coverage before Domain F.
- Non-blocking test gap: add direct `missingCurrentSource` / `staleCurrentSource` workflow tests if the orchestrator wants stricter coverage of Editor-local stale-source validation.
- Mixed worktree attribution remains an orchestration concern: package/operation/validator changes are present but outside the reviewed Domain D source scope.

## User-Decision Points

None.

## Review Separation

Review-Sylph remained read-only for implementation source. This artifact is the only file written by this review.
