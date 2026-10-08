# Wave93 Domain A Report: Editor History Binary Asset De-dup + Memory Instrumentation

## Status

- Wave: Wave93 `editor-history-binary-asset-dedup-memory-pressure-v0`
- Domain: `wave93-editor-history-binary-asset-dedup-memory-instrumentation`
- Verdict: done
- Scope: Editor history clone boundary, graph-only Editor command clone boundary, default-off history/binary memory counters, focused tests.

## Basis Coverage Self-Report

Read and applied:

- `discussion/implementation/orchestration/wave93-plan.md`
- `discussion/implementation/orchestration/wave82-plan.md`
- `discussion/implementation/waves/wave82/wave82-final-integration-report.md`
- `discussion/implementation/orchestration/wave91-plan.md`
- `discussion/implementation/orchestration/wave92-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

Applied decisions:

- Kept generic `cloneAuthoringSession` and `createDryRunAuthoringSession` as full `structuredClone` paths.
- Added a narrow graph/history clone helper instead of replacing all `structuredClone` calls.
- Treated loaded package-local binary bytes as immutable for graph/history snapshots.
- Preserved full deep clone behavior for PSD import and Texture Atlas apply, where binary payloads can be added or replaced.
- Did not change package DTO schemas, runtime export, workspace save format, renderer architecture, mesh generation algorithms, or history depth.
- Did not add dependencies or lockfile changes.

Deferred basis items:

- No browser/manual heap benchmark was run in this domain. The implementation adds default-off counters and identity tests; quantitative long-session measurement remains follow-up.
- Renderer/WebGL/dirty-graph optimization remains outside Wave93 Domain A.
- Binary mutation safety is source-audited for touched Editor paths; broader package internals keep their existing full-clone/dry-run behavior.

## Binary Mutation Audit

Audit summary:

- `packages/authoring-core/src/binary-byte-registration.ts` registers binary bytes by creating a new `PackageBinaryFileEntry`, copying input bytes through package-format, and upserting cloned file/index/summary entries into `session.binaryAssets`.
- Existing package-local `fileEntries[*].bytes` are not mutated in place by that registration path.
- Editor graph-only commands in `editor-session-commands.ts` and `parameter-definition-commands.ts` mutate graph/session DTOs through Operation Core but do not add or replace binary entries.
- PSD import (`psd-import-commit.ts`) registers materialized layer bytes after structural import and remains on full deep clone.
- Texture Atlas apply (`texture-atlas-session-command.ts`) can register generated atlas bytes and remains on full deep clone.
- Workspace save/load clone behavior remains unchanged.

Result:

- Safe to share unchanged binary byte arrays for history snapshots and graph-only Editor command clones.
- No unsafe in-place binary mutation was found in the changed clone paths.

## Clone Behavior

Before:

- `editor-session-history.ts` stored `before` and `after` with `structuredClone(session)`.
- `undoEditorSessionHistory` and `redoEditorSessionHistory` returned `structuredClone(...)`.
- Graph-only command paths in `editor-session-commands.ts` and custom parameter commands in `parameter-definition-commands.ts` cloned the entire session, including binary byte arrays.
- `cloneAuthoringSession` and `createDryRunAuthoringSession` were full deep clones.

After:

- Added `cloneAuthoringSessionSharingBinaryAssets` and alias `cloneAuthoringSessionForGraphEdit` in `packages/authoring-core/src/authoring-session.ts`.
- The helper deep clones package identity/revision flags and `graph`, clones binary asset metadata/index/summary arrays, and shares `fileEntries[*].bytes` identity.
- History record, undo, and redo use the graph-edit helper.
- Editor graph-only command clones use the graph-edit helper for mask relation edits/removal, drawable reorder, `commitSingleOperation`, and custom parameter create/update/delete.
- `cloneAuthoringSession` and `createDryRunAuthoringSession` still full deep clone binary bytes.
- PSD import, Texture Atlas apply, workspace save/load, and generic dry-run/operation-core clone boundaries remain unchanged.

## Instrumentation

Implemented in `apps/editor/src/features/editor-session/model/editor-session-history.ts` using the existing render-core perf flag/hook:

- Disabled unless `globalThis.__LIVE2D_PERF__ === true` or `localStorage.live2dPerf === "1"`.
- No visible UI, no network telemetry, no persisted telemetry, and no console logging was added.
- When disabled, history memory estimation returns before walking history binary entries.

Recorded counters:

- `editorHistory.samples`
- `editorHistory.undoDepth`
- `editorHistory.redoDepth`
- `editorHistory.currentBinaryAssetCount`
- `editorHistory.currentBinaryBytes`
- `editorHistory.estimatedDeepClonedHistoryBinaryBytes`
- `editorHistory.estimatedRetainedSharedHistoryBinaryBytes`
- `editorHistory.estimatedAvoidedDuplicateHistoryBinaryBytes`
- `editorHistory.retainedSharingRatioBasisPoints`

Note: the existing perf API is additive-counter based. The depth/byte counters are sampled on history record/undo/redo, with `editorHistory.samples` present for interpretation.

## Files Changed

- `packages/authoring-core/src/authoring-session.ts`
- `packages/authoring-core/src/authoring-session.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-history.ts`
- `apps/editor/src/features/editor-session/model/editor-session-history.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/parameter-definition-commands.ts`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `discussion/implementation/waves/wave93/wave93-domain-a-editor-history-binary-asset-dedup-memory-instrumentation-report.md`

Adjacent focused scope:

- `parameter-definition-commands.ts` was updated because custom parameter create/update/delete is a graph-only command path called out by the assignment. It uses the same helper and preserves Operation Core mutation routing.

## Test Coverage

Added/updated focused coverage:

- Authoring-core clone helper shares binary byte payload identity while cloning graph and metadata.
- Generic `cloneAuthoringSession` remains a full binary deep clone.
- Recording a history entry with binary assets does not deep clone unchanged bytes.
- Undo and redo return the correct graph state and still expose binary assets.
- Mutating the current graph after recording does not mutate stored history graph snapshots.
- Multiple graph-only commits keep binary byte identity shared across history entries.
- Keyform add/update/delete remains undoable/redoable for a binary-backed session, including redo add, redo update, and redo delete.
- Deformer create/delete remains undoable/redoable for a binary-backed session.
- History binary pressure counters are disabled by default and enabled by the existing perf flag.
- EditorSessionProvider context path triggers the same default-off/enabled counters.
- Existing workspace save/load and portable project focused tests remain passing.
- Existing PSD import and Texture Atlas write-once context tests remain passing in the focused context-history batch; their clone paths were intentionally not changed.

## Verification Results

Passed:

- `pnpm.cmd exec vitest run packages/authoring-core/src/authoring-session.test.ts apps/editor/src/features/editor-session/model/editor-session-history.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts`
  - 5 files / 57 tests passed.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - 1 file / 17 tests passed.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check`
  - Passed with CRLF normalization warnings only.

## Fix Loop Updates

- Addressed Test Adequacy Review finding: the binary-backed keyform add/update/delete test now asserts the full redo chain.
- Added `redoUpdate` assertion from `redoAdd.history`: opacity returns to `0.25` and binary bytes remain shared.
- Added `redoDelete` assertion from `redoUpdate.history`: opacity keyform is absent and binary bytes remain shared.
- Re-ran `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-history.test.ts`
  - 1 file / 10 tests passed.
- Re-ran focused batch: `pnpm.cmd exec vitest run packages/authoring-core/src/authoring-session.test.ts apps/editor/src/features/editor-session/model/editor-session-history.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - 6 files / 74 tests passed.

## Residual Risks

- Binary byte immutability remains an explicit assumption. If a future operation mutates `fileEntries[*].bytes` in place, history sharing would require invalidation or copy-on-write.
- The retained byte estimate is identity-based. It estimates heap pressure for shared `Uint8Array` payload identity, not browser-engine internal allocation details.
- Counters are sampled additive counters because the existing performance API does not expose gauges.
- Initial Editor provider cloning of an externally supplied `initialSession` still uses the existing full clone path; Wave93 targets repeated history/graph command clones, not one-time provider initialization.

## Implementation Verdict

Done. The changed history and graph-only Editor clone paths now avoid duplicating unchanged binary byte arrays, undo/redo behavior is preserved for binary-backed keyform and deformer operations, binary-add/replace paths retain full clone behavior, and default-off memory pressure counters are available under the existing dev perf flag.
