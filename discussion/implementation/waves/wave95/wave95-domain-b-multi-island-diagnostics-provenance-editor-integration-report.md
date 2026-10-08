# Wave95 Domain B: Multi-Island Diagnostics / Provenance / Editor Integration Report

## Summary

Implemented `wave95-multi-island-diagnostics-provenance-editor-integration`.

Operation Core now preserves Domain A `multiIslandDiagnostics` in mesh operation transform history for both generated commits and previewMesh commits. The Mesh Inspector now copies a targeted multi-island summary and shows compact visible details only for no-valid-island and localized/partial fallback style cases. Successful tiny/noise island filtering remains quiet in the normal visible UI.

## Orchestration Result

- Verdict: pass.
- Loop count: 1.
- Gnome implementation completed with no conditional source scope.
- Independent Review-Sylph lanes all passed:
  - `discussion/implementation/reviews/wave95/wave95-domain-b-spec-compliance-review.md`
  - `discussion/implementation/reviews/wave95/wave95-domain-b-design-development-review.md`
  - `discussion/implementation/reviews/wave95/wave95-domain-b-test-adequacy-review.md`

## Changed Files

- `packages/operation-core/src/operations/generate-mesh.ts`
  - Added structural extraction of runtime `v6Metrics.multiIslandDiagnostics`.
  - Added transform history entries for raw alpha component count, kept/generated/backend-generated island counts, skipped tiny/noise island count and pixel total, raw/largest pixel counts, localized fallback count, and localized fallback reasons when present.
- `packages/operation-core/src/operations/generate-mesh.test.ts`
  - Added generated-commit and previewMesh-commit provenance coverage for V6D adaptive contour multi-island diagnostics.
  - Generated-commit test also verifies runtime graph conversion accepts the disconnected result shape.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - Added preview debug-log inclusion for multi-island diagnostics while keeping the existing info/warn decision unchanged.
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - Covered multi-island preview debug logging and confirmed successful skipped-noise diagnostics do not go through `console.warn`.
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
  - Added compact multi-island detail rows and a targeted copy-payload `multiIsland` summary.
  - Added visible diagnostic gating for no valid kept island, localized fallback, or kept-not-generated island handling.
  - Successful skipped-noise-only diagnostics remain non-visible.
- `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts`
  - Covered quiet successful skipped noise, no-valid-island fallback copy payload, and localized fallback visible detail/copy payload.

## Tests Run

- Initial sandboxed Vitest attempts failed with `spawn EPERM` during Vite/esbuild config loading; reran with escalation.
- Orch-Sylph reran the focused verification in one command: `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts`: passed, 5 files / 92 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts`: passed, 34 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts`: passed, 11 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/editor-session-context-history.test.ts`: passed, 25 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`: passed, 17 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts`: passed, 5 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- <Domain B changed files>`: passed; Git reported LF-to-CRLF working-copy warnings only.

## Basis Coverage Self-Report

- Propagate multi-island metrics through mesh operation provenance: covered by transform history entries and generated/preview commit tests.
- Transform history includes required counts: raw component, kept/generated/backend-generated island counts, skipped tiny/noise count and pixel total, localized fallback count/reasons, and existing `v6MultiIslandHandling=supported`.
- Preview provenance accepts Domain A runtime metrics: covered by `OperationRequestSchema.parse` through previewMesh commit tests using actual Domain A-generated preview metrics.
- Inspector copy payload includes multi-island metrics: covered by no-valid and localized fallback inspector tests.
- Successful skipped noise stays quiet: covered by inspector no-card test and preview debug `console.info`/not-`console.warn` test.
- No-valid island visible detail: covered by inspector no-valid fallback test.
- Partial/localized island fallback visible detail: covered by inspector localized fallback test.
- Existing mesh apply / auto-refit behavior remains passing: covered by existing focused tests.
- Disconnected topology compatibility: covered pragmatically by Operation Core generated multi-island commit plus `toRuntimeGraph(...)` conversion. No validator-core source changes were needed.
- Mesh Inspector density/layout: preserved the existing diagnostic card and added only short rows (`Islands`, `Noise`, `Local fail`) when a diagnostic card is already warranted.

## Deferred Basis Items

- Formal `MeshGenerationV6Metrics` TypeScript interface extension for `multiIslandDiagnostics` remains deferred. Domain B used narrow structural downstream extraction to avoid conditional authoring-core changes.
- `packages/operation-core/src/payloads/model-edit.ts` was not changed. The existing preview provenance custom validation accepts additional runtime metric keys, and the previewMesh commit test proves Domain A metrics pass through request parsing.
- Direct validator-core disconnected topology regression was not added because no validator rejection was observed and runtime graph conversion accepted the generated disconnected mesh.
- Focused render/runtime/atlas smoke tests were not added because Domain B did not change renderer, runtime export, atlas, package-format schema, or texture atlas behavior.

## Conditional Scope Justification

No conditional source scope was used.

Not edited:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/validator-core/src/**`
- package-format schema, runtime export, atlas, dependencies, or lockfile

## Residual Risk

- The downstream type surface still treats `multiIslandDiagnostics` structurally until a later authoring-core metrics type pass formalizes it.
- Partial island backend failure remains difficult to force with a natural fixture; Editor visible behavior is covered with a diagnostics-shaped fixture, while Domain A source/review owns the generation-side partial fallback path.
- Localized fallback reasons in operation transform history are source-reviewed; the generated-operation tests cover the zero-localized-fallback case, while non-empty reasons are covered at the inspector diagnostic surface.
