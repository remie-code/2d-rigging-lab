# Wave 98 Plan: Viewer Dynamics Performance Instrumentation + Duplicate Runtime Evaluation Removal

> Wave98は、Viewer / Runtime View でDynamicsが動いている最中のCPU負荷について、品質を変えずに測れる足場を作り、明確に重複しているruntime評価を1回に減らす。目的は「物理演算の見た目を変えずに、まず無駄な評価を消し、次の性能判断に使える計測値を得る」ことである。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave98
- Wave name: `viewer-dynamics-performance-instrumentation-duplicate-eval-removal`
- Primary objective:
  - active Viewer physics frameで同じruntime playback evaluationを二重に走らせない。
  - rAF tickで得た `parameterValues` をClean Stage projectionへ再利用する。
  - Viewer active physics frame / runtime-core / canvas / render周辺の性能計測counter/timingを追加する。
  - Dynamicsの物理式、見た目、揺れの収束、Atlas Runtime / Original描画挙動を維持する。
  - Wave97のidle throttleは維持し、active時だけを対象にする。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Wave97でViewer idle時の常時rAF loopは止まり、CPU使用率は初期/操作時に上がってから落ち着く期待通りの挙動になった。
- 次の懸念はidleではなく、active dynamics frame中の処理負荷である。
- Sylph調査により、pendulum solverそのものよりも、active frameごとのruntime snapshot / canvas projection / render再評価が重い可能性が高いと整理された。
- 特に `viewer-runtime-screen.tsx` のrAF tickで `evaluateViewerRuntimePlaybackFrame(...)` を実行した後、Clean Stage projection側で `resolveViewerRuntimeParameterValues(...)` が `deltaTimeMs: 0` の `evaluateViewerRuntimePlaybackFrame(...)` を再実行する構造が疑わしい。
- このwaveでは物理式・rate・thresholdを変えず、明確な二重評価除去と計測に限定する。

Uncertainty:

- factual: medium. 重複評価の存在は調査で強く示されているが、実際の支配的コストがruntime snapshot / canvas / WebGL mesh uploadのどこかは計測で詰める必要がある。
- decision: low. 品質維持を優先し、physics semanticsを変更しないことは合意済み。
- cost of wrong plan: low to medium. 計測名や再利用条件が不足すると次wave判断が弱くなるが、物理挙動を変えない範囲に限定するためUX破壊リスクは低い。

## 3. Accepted Decisions / Oracles

### 3.1 Semantics-Preserving Performance Scope

Required:

- Dynamics solverの物理式を変更しない。
- substep数、physics update rate、settle threshold、output delta threshold、render throttlingを変更しない。
- Runtime Controls、Reset simulation、Atlas Runtime / Original切り替えの挙動を変更しない。
- Wave97のidle stop / restart条件を維持する。

Forbidden:

- 「軽くするため」に揺れの見た目、時間発展、収束速度を変える。
- Viewer active physicsを間引く。
- Dynamics output値を丸める。
- Runtime Playerに手を出す。

### 3.2 Runtime Evaluation Reuse

Required:

- rAF tickで得た active playback result の `parameterValues` を保持し、同じframeのClean Stage projectionへ渡す。
- fresh playback resultが利用可能な場合、projectionのためだけに `deltaTimeMs: 0` でruntime evaluationを再実行しない。
- runtime model/session/base parameter compatibilityが崩れた場合は既存の安全なfallback pathへ戻す。
- no dynamics / playback state missing / stale stateの経路は既存挙動を維持する。

Accepted:

- 再利用可否は保守的に判定してよい。怪しい場合はfallbackでよい。
- fallbackが走ったことを性能counterで観測できるようにする。

Forbidden:

- staleな `parameterValues` を使って表示を進める。
- Clean Stage projectionの入力責務を曖昧にして、ViewerとCanvasの描画差分を作る。

### 3.3 Performance Instrumentation

Required:

- 既存の `@private-2d-rigging-lab/render-core` performance instrumentation policyに従う。
- `globalThis.__LIVE2D_PERF__ === true` または `localStorage.live2dPerf === "1"` で有効化される既存方針に合わせる。
- console spamを増やさない。
- active Viewer dynamics frameで、少なくとも次の傾向を追えるようにする:
  - Viewer runtime frame evaluation count / timing
  - duplicate delta-0 reevaluation skip / fallback count
  - Viewer projection timing
  - runtime dynamics group/substep count, if low risk
  - canvas/render phaseとの対応を既存counterと併読できること

Suggested metric names:

- `viewer.runtimeFrame.evaluations`
- `viewer.runtimeFrame.ms`
- `viewer.runtimeFrame.deltaZeroReevaluationSkipped`
- `viewer.runtimeFrame.deltaZeroReevaluationFallback`
- `viewer.cleanStageProjection.ms`
- `runtime.dynamics.groups`
- `runtime.dynamics.substeps`

Metric names may be adjusted to fit existing naming style, but the report must list final names.

### 3.4 Measurement Before Further Optimization

Required:

- This wave may remove the clear duplicate evaluation.
- This wave must not introduce broader renderer/runtime fast paths unless they are strictly necessary for the duplicate-evaluation fix.
- WebGL mesh buffer caching, runtime snapshot schema relaxation, workerization, and canvas cache redesign are explicitly deferred.

Accepted:

- Reports should identify likely next bottleneck after instrumentation, but not implement it.

### 3.5 Behavior Preservation

Required:

- Viewer visuals must remain unchanged for Original and Atlas Runtime.
- Dynamics behavior must remain unchanged for positive/negative driver changes, Reset simulation, and session-local Runtime Controls overrides.
- Existing Viewer idle behavior from Wave97 must remain unchanged.

Blocking regressions:

- active dynamics no longer visibly sway when driver changes.
- dynamics stop earlier or later due to changed physics semantics.
- Atlas Runtime and Original diverge beyond existing source-mode responsibility.
- Reset simulation stops working.
- Viewer starts consuming idle CPU again after dynamics settle.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)

Wave baseline:

- [Wave84 Plan](wave84-plan.md)
- [Wave96 Plan](wave96-plan.md)
- [Wave96 Final Integration Report](../waves/wave96/wave96-final-integration-report.md)
- [Wave97 Plan](wave97-plan.md)
- [Wave97 Final Integration Report](../waves/wave97/wave97-final-integration-report.md)

Known source facts:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - Viewer rAF loop evaluates `evaluateViewerRuntimePlaybackFrame(...)` during active dynamics playback.
  - Clean Stage projection currently obtains runtime parameter values through helper flow that can perform another zero-delta runtime evaluation.
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
  - `evaluateViewerRuntimePlaybackFrame(...)` wraps runtime-core frame evaluation.
  - `resolveViewerRuntimeParameterValues(...)` is the likely zero-delta fallback/re-evaluation point.
- `packages/runtime-core/src/runtime-core.ts`
  - runtime frame evaluation creates resolved parameter values and runtime state.
- `packages/runtime-core/src/dynamics-evaluation.ts`
  - pendulum solver itself is small and should not be semantically changed.
- Existing performance instrumentation:
  - `packages/render-core/src/performance-instrumentation.ts`
  - existing timings/counters under canvas/render/WebGL/runtime controls.

Likely implementation areas:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `packages/render-core/src/performance-instrumentation.ts` only if existing helper surface is insufficient.
- narrowly scoped runtime-core files only for instrumentation, not semantics:
  - `packages/runtime-core/src/runtime-core.ts`
  - `packages/runtime-core/src/dynamics-evaluation.ts`
  - focused runtime-core tests if touched.

## 5. Wave Strategy

Wave98 should run in ordered batches.

```text
Batch 1:
  Domain A: Viewer Dynamics Performance Instrumentation + Duplicate Runtime Evaluation Removal

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- The core behavior is localized to Viewer playback/projection lifecycle and instrumentation.
- Splitting duplicate-evaluation removal and Viewer instrumentation would create overlapping edits in `viewer-runtime-screen.tsx` / `viewer-runtime-playback.ts`.
- A single implementation domain keeps compatibility/fallback logic coherent.
- Final integration must run only after Domain A has review evidence.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Viewer Dynamics Performance Instrumentation + Duplicate Runtime Evaluation Removal | Wave97 final pass / accepted semantics-preserving policy | First / single implementation domain | Reuse active rAF parameter values for projection, skip duplicate zero-delta eval, add gated performance counters/timings |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Final only | Validate behavior preservation, instrumentation, forbidden-scope compliance, and record final artifacts |

## 6. Domain A: Viewer Dynamics Performance Instrumentation + Duplicate Runtime Evaluation Removal

Domain id: `wave98-viewer-dynamics-performance-instrumentation-duplicate-eval-removal`

Purpose:

- Reduce active Viewer dynamics frame work by removing the obvious duplicate runtime evaluation while adding enough performance instrumentation to identify the next bottleneck.

Allowed write scope:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` only if a narrow existing assertion must be adjusted.
- narrowly scoped new helper files under `apps/editor/src/workspace/viewer/`.
- `packages/render-core/src/performance-instrumentation.ts` only if existing instrumentation helpers are insufficient.
- Domain A report/review files under `discussion/implementation/waves/wave98/` and `discussion/implementation/reviews/wave98/`.

Conditional write scope, requiring explicit report justification:

- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/**/*.test.ts`

Forbidden write scope:

- Dynamics solver formula changes.
- Dynamics preset/default parameter changes.
- Dynamics Tool preview UX changes.
- Viewer idle throttle semantic changes.
- Runtime Player app changes.
- Runtime Export format changes.
- Workspace Save format changes.
- Texture Atlas / Atlas Runtime source cache changes.
- package-format schema changes.
- Mesh generation changes.
- WebGL renderer architecture/cache redesign.
- dependencies / lockfile.

Required implementation:

- Carry fresh active playback `parameterValues` from `evaluateViewerRuntimePlaybackFrame(...)` result through Viewer state or a tightly scoped memo/ref.
- Use those `parameterValues` when building Clean Stage projection for the same runtime model/session/base input.
- Avoid `resolveViewerRuntimeParameterValues(...)` causing a second zero-delta runtime evaluation in the fresh-frame path.
- Preserve fallback behavior when no fresh compatible frame exists.
- Add gated performance counters/timings for Viewer active runtime frame and duplicate-eval skip/fallback.
- If low risk, add runtime-core dynamics group/substep counters without changing solver output.
- Keep all instrumentation disabled by default under existing perf flag policy.

Required tests:

- Active Viewer dynamics frame can reuse computed `parameterValues` for Clean Stage projection without calling runtime evaluation twice.
- Projection output parameter values are unchanged compared to the previous semantics.
- No-dynamics Viewer path remains unchanged.
- Missing/stale/incompatible runtime playback state falls back safely.
- Driver changes still produce dynamics motion.
- Reset simulation still restarts/initializes simulation.
- Wave97 idle stop remains intact.
- Added perf counters/timings are gated or incremented as expected where practical.

Required evidence:

- Explain before/after call path.
- List final metric names.
- Prove duplicate zero-delta evaluation is skipped in fresh active frame path.
- Prove behavior preservation through focused tests.
- Record residual risk and likely next bottleneck after instrumentation.

Escalate if:

- The current Viewer projection architecture cannot safely consume fresh `parameterValues` without broader refactor.
- Compatibility/staleness cannot be determined conservatively.
- Removing duplicate evaluation changes visible dynamics behavior.
- Meaningful performance instrumentation requires dependency or schema changes.

## 7. Domain B: Final Integration / Clean Review

Domain id: `wave98-final-integration-clean-review`

Dependencies:

- Domain A `pass`

Purpose:

- Validate duplicate runtime evaluation removal and instrumentation without physics/UX drift.
- Confirm no forbidden-scope changes.
- Record final reports/reviews/maps.

Allowed write scope:

- `discussion/implementation/waves/wave98/**`
- `discussion/implementation/reviews/wave98/**`
- orchestration/review/wave maps if status updates are required.

Required checks:

- Domain A report/review lanes are present.
- Focused Viewer runtime playback tests.
- Focused Viewer idle throttle regression tests.
- Focused Runtime Controls tests if touched.
- Focused runtime-core tests if touched.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check:
  - no Dynamics solver formula changes;
  - no Dynamics preset/default changes;
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

- active Viewer dynamics frame does not run duplicate runtime evaluation in the fresh-frame path.
- fresh `parameterValues` are reused for Clean Stage projection.
- fallback behavior is conservative and safe.
- Dynamics visual behavior is unchanged.
- Wave97 idle stop/restart behavior is unchanged.
- instrumentation is gated and does not spam console.

Design / Development Review must explicitly check:

- compatibility/staleness checks are explicit and defensible.
- no broad runtime/renderer architecture rewrite was introduced.
- no physics formula/rate/threshold drift.
- instrumentation names are coherent with existing performance counters.
- React state/ref usage does not create stale frame bugs or render loops.
- no source organization violation or catch-all file growth.

Test Adequacy Review must explicitly check:

- duplicate-evaluation skip test.
- fallback test.
- behavior preservation test for driver changes.
- reset simulation regression test.
- no-dynamics path test.
- perf counter/timing coverage where practical.

## 9. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md`
- `discussion/implementation/waves/wave98/wave98-final-integration-report.md`
- `discussion/implementation/waves/wave98/_map.md`

Review reports:

- `discussion/implementation/reviews/wave98/wave98-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave98/wave98-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave98/_map.md`

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
- Preserve Dynamics solver physical formula, rates, thresholds, presets, and UX.
- Preserve Viewer Original / Atlas Runtime visuals.
- Preserve Runtime Export / Workspace Save / package-format schema.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat changed physics behavior as blocking.
- Treat stale/flickering Viewer projection values as blocking.
- Treat solver/export/atlas/runtime-player/dependency drift as blocking.

## 11. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave98 source changes.
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

- Dynamics solver formula changes.
- Dynamics substep / update rate changes.
- Dynamics settle threshold changes.
- Output delta threshold / rounding changes.
- Runtime Player app changes.
- Runtime Export task/format changes.
- Texture Atlas / Atlas Runtime source cache changes.
- Workspace Save changes.
- package-format schema changes.
- Mesh generation changes.
- WebGL renderer architecture rewrite.
- Web Worker conversion.
- User-facing Viewer playback controls.
- Browser CPU profiler automation as a blocker.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
