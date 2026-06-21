# Wave 93 Plan: Editor History Binary Asset De-dup + Memory Pressure Reduction

> Wave93は、長時間Editorセッションでparameter sliderやkeyform commitが徐々に重くなり、reloadで軽くなる問題に対し、undo/redo historyとEditor command cloneがbinary asset bytesを過剰に複製しないようにする。描画architecture最適化ではなく、まずsession history由来のheap pressureを潰す。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave93
- Wave name: `editor-history-binary-asset-dedup-memory-pressure-v0`
- Primary objective:
  - `AuthoringSession.binaryAssets` の巨大byte payloadをundo/redo history snapshotごとにdeep cloneしない。
  - graph / rig / keyform / meshなどのauthoring構造は従来どおりundo/redoできるように保つ。
  - graph-only Editor commandsがtransient cloneでbinary bytesを複製しないよう、clone helperを整理する。
  - history depth / binary reference sharing / estimated retained binary bytesを確認できる軽量instrumentationを追加する。
  - parameter scrub / keyform commit / deformer editの長時間セッションでのmemory pressureを下げる。
  - renderer architecture、dirty graph、persistent WebGL buffers、React context splitは対象外にする。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- ユーザー観察として、重くなったEditorがreload後に同じモデルで滑らかに戻った。
- Read-only Sylph調査で、`editor-session-history.ts` がhistory entryごとに `before` / `after` の `AuthoringSession` 全体を `structuredClone` し、`AuthoringSession.binaryAssets.fileEntries` のbyte配列まで複製し得ることが確認された。
- Root確認でも [editor-session-history.ts](../../../apps/editor/src/features/editor-session/model/editor-session-history.ts) の `cloneSession(session): structuredClone(session)` と [authoring-session.ts](../../../packages/authoring-core/src/authoring-session.ts) の `cloneAuthoringSession` が同じ挙動であることを確認した。
- ユーザーは「historyが画像byteを複製しないこと」を根本方針として同意済み。
- Wave82で入力coalescing / no-op guard / texture signature memoizationは実装済みであり、今回の主眼は入力event削減ではない。

Uncertainty:

- factual: medium. binaryAssetsが現在どの操作でin-place mutationされているかはDomain Aで確認する必要がある。
- decision: low. binary bytesをhistoryごとに複製しない方針は合意済み。
- cost of wrong plan: medium. undo/redo、workspace save/load、asset参照を壊すと影響が大きいため、scopeをhistory/clone helper中心に限定し、focused testsを厚めにする。

## 3. Accepted Decisions / Oracles

### 3.1 Root Cause Hypothesis

Adopted hypothesis:

- Long-session heaviness is primarily caused by memory pressure from repeated `AuthoringSession` deep clones that include immutable binary asset bytes.
- Rendering/evaluation cost still exists, but reloadで軽くなる現象の主犯としてはhistory heap pressureがより強い。

Required:

- History snapshots must not duplicate unchanged binary bytes.
- Undo/redo must preserve graph state and binary asset availability.
- Keyform/deformer commands must remain undoable/redoable.
- Save/load and runtime export must still see valid binary assets after undo/redo.

Forbidden:

- Solving the issue only by lowering history depth.
- Dropping undo/redo for binary-backed projects.
- Treating binary assets as optional after PSD import.
- Mutating shared binary asset bytes in place.

### 3.2 Binary Asset Immutability Policy

Wave93 assumes binary byte payloads are immutable within a loaded session.

Required:

- Existing binary asset entries may be shared by reference across history snapshots.
- When an operation adds/replaces binary assets, it must produce a new binary asset container or entry for the changed content.
- Unchanged binary entries should retain identity where practical.
- Tests must prove graph mutations after a commit do not mutate previous history graph snapshots.
- Tests must prove unchanged binary bytes are shared rather than cloned.

Escalate if:

- A required operation mutates `binaryAssets.fileEntries[*]` or byte arrays in place.
- A package-format or storage invariant requires byte arrays to be unique per session object.
- Browser structured clone / worker boundary assumptions require deep-cloned bytes in history.

### 3.3 Clone Boundary Policy

Required:

- Add an explicit clone helper for history/graph-edit use cases, rather than ad hoc `structuredClone(session)` in history code.
- The helper should deep clone mutable authoring structure while sharing immutable binary asset payloads.
- `cloneAuthoringSession` can remain deep clone for generic safety if needed, but history and graph-only Editor command paths must not use it blindly for binary-heavy sessions.
- Dry-run / operation-core behavior is not changed unless Domain A proves the same helper is safe and necessary there.

Must not:

- Replace all `structuredClone` calls in the repository indiscriminately.
- Change package DTO schemas.
- Introduce external dependencies.

### 3.4 Instrumentation Policy

Required:

- Add default-off memory/history counters under existing perf instrumentation or an adjacent dev-only path.
- Counters should include:
  - undo depth;
  - redo depth;
  - current binary asset count;
  - current binary byte total;
  - estimated history binary bytes if deep-cloned;
  - estimated retained history binary bytes after sharing;
  - binary sharing ratio or duplicate-avoidance count.
- Instrumentation must not create visible product UI.
- Instrumentation must not persist telemetry.

### 3.5 Non-goals

Wave93 does not optimize the renderer hot path directly.

Out of scope:

- dirty graph evaluation.
- persistent WebGL buffers / `bufferSubData`.
- mask render cache.
- runtime/editor renderer unification.
- worker/offscreen rendering.
- React context split.
- reducing mesh/deformer/keyform feature semantics.

## 4. Primary Basis

Implementation baseline:

- [wave82-plan.md](wave82-plan.md)
- [../waves/wave82/wave82-final-integration-report.md](../waves/wave82/wave82-final-integration-report.md)
- [wave91-plan.md](wave91-plan.md)
- [wave92-plan.md](wave92-plan.md)

Relevant source files:

- `apps/editor/src/features/editor-session/model/editor-session-history.ts`
- `apps/editor/src/features/editor-session/model/editor-session-history.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `packages/authoring-core/src/authoring-session.ts`
- `packages/package-format/src/**` only for binary entry shape reference.

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)

Known source facts:

- `EDITOR_SESSION_HISTORY_DEFAULT_MAX_DEPTH` is 50.
- `recordEditorSessionCommit` stores `before` and `after` sessions.
- `undoEditorSessionHistory` / `redoEditorSessionHistory` clone the stored session before returning it.
- `AuthoringSession.binaryAssets` may contain `PackageBinaryFileEntry[]` and package-local raster/atlas bytes.
- Some Editor commands create `nextSession = structuredClone(session)` before graph mutation; those paths can impose transient binary clone cost even before history records the result.

## 5. Wave Strategy

Wave93 should run in ordered batches.

```text
Batch 1:
  Domain A: Editor History Binary Asset De-dup + Memory Instrumentation

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- The implementation is conceptually single-slice: history clone helper, command clone adoption, tests, and instrumentation all touch the same Editor session/history area.
- Splitting instrumentation from history de-dup would increase review cost without meaningful parallelism.
- Deeper render optimizations depend on evidence after history pressure is reduced and are intentionally deferred.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Editor History Binary Asset De-dup + Memory Instrumentation | Wave92 final pass / current Editor history baseline | First / blocking | Stop history and graph-only command clones from duplicating unchanged binary bytes; add tests and dev-only memory counters |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Final only | Verify undo/redo, save/load safety, instrumentation, and forbidden-scope compliance |

## 6. Domain A: Editor History Binary Asset De-dup + Memory Instrumentation

Domain id: `wave93-editor-history-binary-asset-dedup-memory-instrumentation`

Purpose:

- Make undo/redo history memory-safe for binary-heavy projects.
- Reduce long-session heap pressure caused by repeated graph/keyform/deformer commits.
- Preserve authoring behavior.

Allowed write scope:

- `packages/authoring-core/src/authoring-session.ts`
- focused authoring-core tests if a clone helper is added there.
- `apps/editor/src/features/editor-session/model/editor-session-history.ts`
- `apps/editor/src/features/editor-session/model/editor-session-history.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- focused Editor session/history tests.
- existing performance instrumentation files under `apps/editor/src/**` if needed.
- `discussion/implementation/waves/wave93/**`
- `discussion/implementation/reviews/wave93/**`

Conditional write scope, requiring explicit report justification:

- `packages/package-format/src/**` only if binary size estimation needs a shared helper for package binary entries.
- `packages/authoring-core/src/**` beyond `authoring-session.ts` only if binary mutation audit reveals an unsafe in-place mutation that must be fixed.

Forbidden write scope:

- Renderer architecture.
- WebGL buffer/cache implementation.
- Canvas evaluation semantics.
- Mesh generation algorithms.
- Texture Atlas algorithms.
- Runtime Export format / Runtime Player app.
- Workspace Save format.
- Package DTO schema changes.
- New dependencies / lockfile.

Required implementation:

- Add or expose a clone helper that:
  - deep clones mutable session metadata and `graph`;
  - preserves `binaryAssets` by reference or shares immutable binary entries without duplicating byte arrays;
  - documents why binary assets are treated as immutable.
- Use the helper in editor history snapshot creation.
- Use the helper in undo/redo returned sessions where safe.
- Audit graph-only Editor command clone paths and replace `structuredClone(session)` with the binary-sharing helper where appropriate.
- Preserve full deep clone behavior where binary mutation is expected or safety is uncertain.
- Add dev-only history/binary memory counters to existing perf stats or a small adjacent helper.

Required tests:

- Recording a history entry with binary assets does not deep clone unchanged byte arrays.
- Undo returns the previous graph state and still exposes valid binary assets.
- Redo returns the next graph state and still exposes valid binary assets.
- Mutating current graph after recording history does not mutate stored history graph snapshots.
- Multiple graph-only commits keep binary asset byte identity shared across history entries.
- Binary-adding or binary-replacing command behavior remains correct, or is explicitly not changed if outside current command path.
- Keyform add/update/delete remains undoable/redoable for a binary-backed session.
- Deformer create/delete remains undoable/redoable for a binary-backed session.
- Workspace save/load or portable project focused test remains passing where practical.
- Perf/history counters are disabled by default and enabled by the existing dev flag.

Required evidence:

- Before/after explanation of clone behavior.
- Test or source evidence that binary byte arrays are no longer copied per history entry.
- History depth and estimated binary byte counters visible in dev instrumentation.
- No operation history behavior regression.

Early escape triggers:

- Binary assets are found to be mutated in place by common commands.
- Sharing `binaryAssets` across history snapshots breaks save/load, export, or image rendering.
- Undo/redo requires deep-cloned binary bytes for correctness.
- Fix requires broad package-format schema changes.
- Fix requires rewriting operation-core or workspace-storage architecture.

## 7. Domain B: Final Integration / Clean Review

Domain id: `wave93-final-integration-clean-review`

Dependencies:

- Domain A `pass` or explicit escalation.

Purpose:

- Validate the combined history/memory fix.
- Confirm no accidental renderer/runtime/export changes.
- Record reports/reviews/maps.

Allowed write scope:

- `discussion/implementation/waves/wave93/**`
- `discussion/implementation/reviews/wave93/**`
- orchestration/review/wave maps if status updates are required.

Required checks:

- Domain A report and review lanes are present.
- Focused editor history tests.
- Focused editor session context history tests.
- Focused authoring-core clone helper tests if added.
- Workspace save/load focused test where practical.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check for renderer/runtime/export/schema/dependency changes.

## 8. Review Policy

Each implemented domain requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- history snapshots do not duplicate unchanged binary bytes.
- undo/redo behavior is preserved.
- keyform and deformer commits remain undoable.
- binary-backed sessions remain saveable/renderable.
- performance instrumentation is default-off.
- renderer/dirty-graph/WebGL architecture work was not added.

Design / Development Review must explicitly check:

- clone helper naming and placement are clear.
- binary immutability assumption is documented.
- broad `structuredClone` replacement did not occur.
- package DTO/schema boundaries are respected.
- no new dependencies / lockfile changes.
- no catch-all helper file or source organization violation.

Test Adequacy Review must explicitly check:

- binary sharing identity tests.
- graph isolation tests.
- undo/redo regression tests.
- binary-backed command tests.
- instrumentation counter tests or source-reviewed fallback.
- known typecheck failures, if any, are unrelated and documented.

## 9. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave93/wave93-domain-a-editor-history-binary-asset-dedup-memory-instrumentation-report.md`
- `discussion/implementation/waves/wave93/wave93-final-integration-report.md`
- `discussion/implementation/waves/wave93/_map.md`

Review reports:

- `discussion/implementation/reviews/wave93/wave93-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave93/wave93-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave93/wave93-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave93/wave93-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave93/_map.md`

## 10. Subagent Contract

Orch-Sylph instructions must include:

- Use this active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
- Audit binary mutation safety before implementing clone sharing.
- Delegate implementation to Gnome.
- Delegate independent reviews to Review-Sylphs.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Do not add dependencies.
- Preserve undo/redo semantics.
- Preserve save/load and runtime export behavior.
- Do not implement renderer optimization or context split.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat duplicated binary bytes in history as blocking.
- Treat undo/redo regression as blocking.
- Treat renderer/runtime/export/schema/dependency changes as blocking unless explicitly escalated.

## 11. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave93 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 12. Out of Scope

- Renderer architecture work.
- Dirty graph evaluation.
- Persistent WebGL buffers / `bufferSubData`.
- Mask render caching.
- Runtime/editor render unification.
- React context split.
- Worker/offscreen rendering.
- Texture Atlas changes.
- Mesh generation changes.
- Deformer or keyform semantics changes.
- Runtime Export format changes.
- Runtime Player app changes.
- Workspace Save format changes.
- Package schema changes.
- Reducing history depth as the main fix.
- New dependencies.
