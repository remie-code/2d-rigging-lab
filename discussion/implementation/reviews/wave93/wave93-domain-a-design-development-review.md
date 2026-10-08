# Wave93 Domain A Design / Development Compliance Review

## Verdict

`pass`

## Findings

### Blocking

None.

### Design / Development Compliance Evidence

- Clone helper naming and placement are acceptable. `cloneAuthoringSessionSharingBinaryAssets` and the narrower alias `cloneAuthoringSessionForGraphEdit` live in the owning authoring-session module, not in a catch-all helper file: `packages/authoring-core/src/authoring-session.ts:36`, `packages/authoring-core/src/authoring-session.ts:58`.
- Binary immutability is documented at the byte-sharing boundary: `packages/authoring-core/src/authoring-session.ts:65`.
- Generic full deep clone behavior remains intact. `cloneAuthoringSession` still delegates to `structuredClone(session)`, and `createDryRunAuthoringSession` still aliases the full clone path: `packages/authoring-core/src/authoring-session.ts:33`, `packages/authoring-core/src/authoring-session.ts:60`.
- History uses the graph-edit/binary-sharing clone only at history-safe boundaries. Record/undo/redo clone through `cloneSession`, which delegates to `cloneAuthoringSessionForGraphEdit`: `apps/editor/src/features/editor-session/model/editor-session-history.ts:70`, `apps/editor/src/features/editor-session/model/editor-session-history.ts:71`, `apps/editor/src/features/editor-session/model/editor-session-history.ts:98`, `apps/editor/src/features/editor-session/model/editor-session-history.ts:121`, `apps/editor/src/features/editor-session/model/editor-session-history.ts:168`.
- Broad `structuredClone` replacement did not occur. PSD import and Texture Atlas apply remain full-clone binary add/replace paths: `apps/editor/src/features/psd-import/model/psd-import-commit.ts:33`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:46`.
- GUI package mutations still route through Operation Core. Graph-edit commands clone a working session and still call `operationCore.commitOperation(...)`: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:534`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:553`, `apps/editor/src/features/editor-session/model/parameter-definition-commands.ts:58`, `apps/editor/src/features/editor-session/model/parameter-definition-commands.ts:77`.
- Instrumentation is default-off and uses the existing performance hook. The implementation exits before estimating history bytes unless `isLive2dPerformanceEnabled()` is true, then records existing perf counters only: `apps/editor/src/features/editor-session/model/editor-session-history.ts:176`, `apps/editor/src/features/editor-session/model/editor-session-history.ts:193`.
- Focused tests cover binary byte sharing, undo/redo graph state, multiple graph-only commits, keyform/deformer undoability, and default-off/enabled counters: `apps/editor/src/features/editor-session/model/editor-session-history.test.ts:92`, `apps/editor/src/features/editor-session/model/editor-session-history.test.ts:115`, `apps/editor/src/features/editor-session/model/editor-session-history.test.ts:134`, `apps/editor/src/features/editor-session/model/editor-session-history.test.ts:160`, `apps/editor/src/features/editor-session/model/editor-session-history.test.ts:207`, `apps/editor/src/features/editor-session/model/editor-session-history.test.ts:266`, `apps/editor/src/features/editor-session/model/editor-session-history.test.ts:280`, `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:217`.

## Verification Performed

- Read basis documents:
  - `discussion/implementation/orchestration/wave93-plan.md`
  - `discussion/implementation/waves/wave93/wave93-domain-a-editor-history-binary-asset-dedup-memory-instrumentation-report.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/operation-policy.md`
- Reviewed the requested source/tests directly:
  - `packages/authoring-core/src/authoring-session.ts`
  - `packages/authoring-core/src/authoring-session.test.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-history.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-history.test.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/parameter-definition-commands.ts`
  - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- Ran `node scripts/check-source-organization.mjs`: passed.
- Ran `node scripts/check-dependencies.mjs`: passed.
- Ran `git diff --check`: exit 0; CRLF normalization warnings only.
- Ran `pnpm.cmd exec vitest run packages/authoring-core/src/authoring-session.test.ts apps/editor/src/features/editor-session/model/editor-session-history.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts`: sandboxed attempt failed with `spawn EPERM`; escalated rerun passed, 3 files / 40 tests.
- Ran `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`: passed, 1 file / 17 tests.
- Ran `pnpm.cmd typecheck`: passed.
- Checked dependency/package surfaces with `git diff --name-only -- package.json pnpm-lock.yaml apps/editor/package.json packages/authoring-core/package.json packages/render-core/package.json packages/operation-core/package.json packages/package-format/package.json`: no output.

## Residual Risks

- Binary byte immutability remains an explicit design assumption. The reviewed registration path copies bytes when adding/replacing assets, but future in-place mutation of `binaryAssets.fileEntries[*].bytes` would invalidate history byte sharing.
- The working tree contains modified files outside the Domain A source/test list (`apps/editor/src/workspace/canvas/*`, `apps/editor/src/workspace/panels/deformer-tree-view*`, and `discussion/implementation/orchestration/_map.md`). I did not attribute those changes to Wave93 Domain A; final integration should confirm ownership before closing the wave.
- History memory counters are additive sampled counters because the existing perf API is counter-based, not gauge-based.

## Review Artifact

`discussion/implementation/reviews/wave93/wave93-domain-a-design-development-review.md`
