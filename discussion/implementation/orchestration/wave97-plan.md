# Wave 97 Plan: Viewer Dynamics Idle Playback Throttle

> Wave97は、Viewer / Runtime View を開くだけでCPU使用率が上がる問題を、Dynamics playback loopのidle停止・必要時再開で解消する。目的は、完成モデル確認時に揺れの時間発展を維持しながら、driver変化がない静止状態では継続rAF評価と再描画を止めることである。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave97
- Wave name: `viewer-dynamics-idle-playback-throttle`
- Primary objective:
  - Viewerにenabled Dynamics Groupがあるだけで `requestAnimationFrame` loopが常時回り続ける状態をやめる。
  - driver値変更、Reset simulation、session/runtime model変更など、simulationが必要な時だけloopを動かす。
  - Dynamics stateが十分収束したらloopを停止する。
  - Viewerの揺れ、keyform、Atlas Runtime / Original描画、Runtime Controls UXは維持する。
  - Dynamics solverの物理式は変更しない。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Runtime Export導線は左Toolboxの `Runtime Export` taskで確認済みであり、Wave97対象外とした。
- ユーザー観察として、Editor workspace idleではCPU使用率が低い一方、Viewerを開くだけでCPU使用率が大きく上がることが確認された。
- Root調査で、`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx` がenabled Dynamics Group存在時に `requestAnimationFrame` loopを開始し、スライダー操作がなくても毎frame `evaluateViewerRuntimePlaybackFrame(...)` と `setRuntimePlaybackState(...)` を実行する構造が確認された。
- 目的はUX仕様変更ではなく、Viewer idle時の不要な継続評価を止める性能改善である。

Uncertainty:

- factual: low. 常時rAF loopの所在は確認済み。
- decision: low. idle時にloop停止、driver変化時に再開する方針は合意済み。
- cost of wrong plan: medium. 停止閾値が強すぎると揺れが途中で止まったように見えるため、収束判定と再開条件をテストで固定する。

## 3. Accepted Decisions / Oracles

### 3.1 Viewer Idle Responsibility

Required:

- Viewerは「完成モデルのruntime-like確認画面」であり、何も変化していないidle状態でCPUを継続消費しない。
- Dynamicsが設定されていても、driver値が変わらずsimulationが収束しているならrAF loopを停止する。
- loop停止中でも表示状態は最後の安定したruntime stateを保持する。
- loop停止はユーザーに見える再生/停止UIを追加しない内部最適化である。

Forbidden:

- DynamicsをViewerで無効化する。
- Dynamics Tool previewの責務や挙動を変更する。
- Runtime Player設計を変更する。
- Runtime Export formatを変更する。

### 3.2 Playback Restart Conditions

Required:

Viewer dynamics loop must restart or run when any of these happens:

- Runtime Controlsのdriver parameter値が変わる。
- authoring parameter values that feed Viewer runtime change.
- Reset simulationが実行される。
- session / runtime playback model / package revision / package hash changes.
- enabled Dynamics Group count changes from zero to non-zero.
- current runtime state is missing or incompatible.

Accepted:

- render source mode change alone does not need to restart physics unless it also changes runtime graph/parameter values.
- Parts visibility or view pan/zoom should not restart physics by itself.
- Manual Reset simulation may create an initial state and run enough frames to settle if needed.

### 3.3 Convergence / Idle Stop Policy

Required:

- Dynamics playback should continue while there is visible/meaningful motion.
- Stop only after all active dynamics groups are sufficiently settled.
- Settlement must consider at least:
  - angular velocity magnitude;
  - source velocity magnitude;
  - output/angle delta or distance to target/source;
  - minimum number of frames after a driver change/reset to avoid immediate stop.
- Thresholds must be deterministic constants with names and comments/tests.
- Settled detection must be stable enough that tiny numeric noise does not keep loop alive forever.

Accepted initial guidance:

- Use conservative thresholds so visible sway is not cut short.
- Prefer a few extra frames over premature stop.
- If exact physical energy is not readily exposed, use existing `RuntimeStateDto.dynamicsGroups` fields such as `angle`, `angularVelocity`, `previousSource`, `previousSourceVelocity`, and `tick`.

Forbidden:

- Stop simply because driver value is unchanged for one frame.
- Stop before the pendulum has had a chance to react to a driver step.
- Add user-facing playback controls in Viewer for this optimization.

### 3.4 Runtime Core / Solver Boundaries

Required:

- Do not change the Dynamics solver physical formula for this wave.
- If a pure helper is needed to inspect settled state, it may live in Viewer playback code or runtime-core only if dependency direction remains valid.
- Existing Dynamics Tool preview behavior must remain unchanged.
- Viewer playback should continue using `evaluateViewerRuntimePlaybackFrame(...)` as the evaluation authority.

Forbidden:

- Changing pendulum parameters or preset defaults.
- Changing additive/mixer semantics.
- Changing runtime snapshot schema.

### 3.5 Performance Verification Intent

Required:

- Tests must prove that idle Viewer does not keep scheduling endless rAF frames after convergence.
- Tests must prove that a driver change restarts playback after idle stop.
- Tests must prove that Reset simulation restarts/initializes playback without mutating Runtime Controls overrides.

Accepted:

- Unit/component tests can use fake `requestAnimationFrame` rather than browser CPU measurements.
- Manual CPU observation remains user-side validation, not the only acceptance criterion.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)

Wave baseline:

- [Wave81 Plan](wave81-plan.md)
- [Wave83 Plan](wave83-plan.md)
- [Wave84 Plan](wave84-plan.md)
- [Wave96 Plan](wave96-plan.md)
- [Wave96 Final Integration Report](../waves/wave96/wave96-final-integration-report.md)

Known source facts:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `useEffect` starts a `requestAnimationFrame` loop whenever `runtimePlaybackModel.enabledDynamicsGroupCount > 0`.
  - The loop calls `setRuntimePlaybackState(...)` every frame.
  - The loop evaluates `evaluateViewerRuntimePlaybackFrame(...)` even when Runtime Controls values are unchanged.
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
  - `createViewerRuntimePlaybackModel(...)` exposes `enabledDynamicsGroupCount` and output parameter IDs.
  - `evaluateViewerRuntimePlaybackFrame(...)` wraps runtime-core evaluation for Viewer.
  - `resolveViewerRuntimeParameterValues(...)` performs a zero-delta evaluation when needed.
- `packages/runtime-core/src/dynamics-evaluation.ts`
  - Runtime state contains per-group angle / angularVelocity / previousSource / previousSourceVelocity / tick.
- Existing tests:
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - `packages/runtime-core/src/dynamics-evaluation.test.ts`

Likely implementation areas:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- narrowly scoped new Viewer playback helper files under `apps/editor/src/workspace/viewer/` if needed.

## 5. Wave Strategy

Wave97 should run in ordered batches.

```text
Batch 1:
  Domain A: Viewer Dynamics Idle Playback Throttle

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- The behavior is localized to Viewer playback lifecycle and tests.
- Splitting loop lifecycle and settled detection across parallel domains would create overlapping edits in `viewer-runtime-screen.tsx` / `viewer-runtime-playback.ts`.
- A single implementation domain keeps restart/stop semantics coherent and avoids review overhead.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Viewer Dynamics Idle Playback Throttle | Wave96 final pass / accepted idle policy | First / single implementation domain | Stop Viewer dynamics rAF after convergence, restart on driver/reset/model changes, preserve runtime semantics |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Final only | Validate behavior, tests, forbidden-scope compliance, and record final artifacts |

## 6. Domain A: Viewer Dynamics Idle Playback Throttle

Domain id: `wave97-viewer-dynamics-idle-playback-throttle`

Purpose:

- Make Viewer dynamics playback event-driven/settle-aware rather than permanently running while dynamics exist.

Allowed write scope:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` only if Runtime Controls interaction tests need a narrow update.
- narrowly scoped new helper files under `apps/editor/src/workspace/viewer/`.
- Domain A report/review files under `discussion/implementation/waves/wave97/` and `discussion/implementation/reviews/wave97/`

Conditional write scope, requiring explicit report justification:

- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/**/*.test.ts`

Forbidden write scope:

- Dynamics solver formula changes.
- Dynamics Tool preview UI/behavior changes.
- Runtime Export format changes.
- Workspace Save format changes.
- Texture Atlas / Atlas Runtime source cache changes.
- Runtime Player app changes.
- package-format schema changes.
- Mesh generation changes.
- dependencies / lockfile.

Required implementation:

- Introduce a deterministic Viewer playback loop lifecycle:
  - no loop when there are zero enabled Dynamics Groups;
  - loop starts when runtime state needs initialization/evaluation;
  - loop continues while dynamics are not settled;
  - loop stops after all dynamics groups are settled.
- Track driver/base parameter changes sufficiently to restart playback when Runtime Controls or authoring parameter values change.
- Keep `runtimePlaybackState` compatible with existing `resolveViewerRuntimeParameterValues(...)` usage.
- Ensure stop does not clear the final settled state.
- Ensure reset creates/restarts state without clearing Runtime Controls overrides.
- Avoid duplicate rAF scheduling.
- Clean up rAF on unmount/model change.
- Keep Atlas Runtime / Original render source behavior unchanged.

Required tests:

- Viewer with enabled Dynamics does not schedule unbounded rAF after settled state.
- Driver value change from idle restarts playback and advances frames.
- Reset simulation restarts/initializes playback while preserving Runtime Controls overrides.
- Incompatible runtime model/session change resets playback state safely.
- Zero Dynamics Group case still has no playback loop.
- Existing Viewer dynamics tests still pass:
  - motion after driver step;
  - output offsets injected into Clean Stage;
  - stale runtime state discarded.
- Existing Runtime Controls coalescing tests remain passing.

Required evidence:

- Explain restart conditions.
- Explain settled threshold constants and why they are conservative.
- Include test evidence proving no endless rAF loop after convergence.
- Include test evidence proving driver changes still produce visible dynamics motion.
- Include residual risks if CPU use remains due to canvas/render work outside dynamics loop.

Escalate if:

- Current `RuntimeStateDto` lacks enough data to determine convergence without changing runtime-core semantics.
- Stopping playback would make Viewer and Runtime Player semantics diverge in a way that needs product decision.
- React state lifecycle makes reliable rAF cancellation/restart impossible without broader Viewer refactor.

## 7. Domain B: Final Integration / Clean Review

Domain id: `wave97-final-integration-clean-review`

Dependencies:

- Domain A `pass`

Purpose:

- Validate Viewer idle playback throttle and behavior preservation.
- Confirm no solver/export/atlas/runtime-player drift.
- Record final reports/reviews/maps.

Allowed write scope:

- `discussion/implementation/waves/wave97/**`
- `discussion/implementation/reviews/wave97/**`
- orchestration/review/wave maps if status updates are required.

Required checks:

- Domain A report/review lanes are present.
- Focused Viewer idle rAF stop/restart tests.
- Focused Viewer dynamics behavior tests.
- Existing Runtime Controls tests if touched.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check:
  - no Dynamics solver formula changes;
  - no Runtime Export format changes;
  - no Workspace Save format changes;
  - no Texture Atlas / Atlas Runtime source cache changes;
  - no Runtime Player changes;
  - no package-format schema changes;
  - no mesh generation changes;
  - no dependency/lockfile changes.

## 8. Review Policy

Domain A requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- Viewer does not keep rAF playback alive forever when dynamics are settled.
- Driver changes restart playback.
- Reset simulation restarts/initializes playback and preserves Runtime Controls overrides.
- Dynamics visual/runtime behavior is preserved.
- Zero Dynamics Group case remains idle.
- No user-facing playback controls were added.

Design / Development Review must explicitly check:

- restart/stop conditions are explicit and deterministic.
- settled thresholds are named and conservative.
- rAF scheduling has no duplicate loop or leak.
- React effect dependencies are defensible.
- no Dynamics solver formula/schema/export/atlas/runtime-player/dependency drift.
- no source organization violation or catch-all file growth.

Test Adequacy Review must explicitly check:

- idle stop test.
- driver-change restart test.
- reset restart test.
- model/session change reset test.
- zero-dynamics no-loop test.
- existing Viewer dynamics regression coverage remains intact.

## 9. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave97/wave97-domain-a-viewer-dynamics-idle-playback-throttle-report.md`
- `discussion/implementation/waves/wave97/wave97-final-integration-report.md`
- `discussion/implementation/waves/wave97/_map.md`

Review reports:

- `discussion/implementation/reviews/wave97/wave97-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave97/wave97-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave97/wave97-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave97/wave97-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave97/_map.md`

## 10. Subagent Contract

Orch-Sylph instructions must include:

- Use this active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
- Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
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
- Preserve Dynamics solver physical formula.
- Preserve Viewer runtime visual behavior.
- Preserve Runtime Export / Workspace Save / package-format schema.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat endless Viewer rAF loop after settled dynamics as blocking.
- Treat premature visible motion cutoff as blocking.
- Treat solver/export/atlas/runtime-player/dependency drift as blocking.

## 11. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave97 source changes.
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

- Runtime Export task changes.
- Runtime Player app changes.
- Dynamics solver formula changes.
- Dynamics Tool preview UX changes.
- User-facing Viewer playback controls.
- Texture Atlas / Atlas Runtime source cache changes.
- Workspace Save changes.
- package-format schema changes.
- Mesh generation changes.
- Web Worker conversion.
- Renderer architecture rewrite.
- Browser CPU profiler automation as a blocker.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
