# Wave 94 Plan: Nested Warp Rest/Bind Membership Semantics

> Wave94は、子Warp/Rotation等の変形で頂点のcurrent座標が親Warpのvisual domain外へ出た場合でも、親Warpがrest / bind座標に基づいて継続適用されるようにする。目的は、FaceX後にFaceYを動かしたときのような親子Warp合成で、領域外pass-throughによる局所的な歪みをなくすことである。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave94
- Wave name: `nested-warp-rest-bind-membership-semantics`
- Primary objective:
  - Runtime coreのWarp評価を、single current vertex streamからreference/rest + current dual streamへ変更する。
  - 親Warpのmembership / lattice samplingをcurrent座標ではなくrest / bind座標で行う。
  - 親Warpのdisplacementは、子変形済みcurrent座標へ重ねる。
  - Editor Canvas previewをRuntimeと同じsemanticsへ合わせる。
  - `current` が親Warp visual domain外へ出ること自体をwarning扱いしない。
  - `rest / bind` がexpected parent warp domain外の場合のみ、authoring/binding diagnostic候補として扱う。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then plan.

Why planning is now safe:

- ユーザー観察として、FaceXで横へ動いた頂点がFaceYのdomain外に出ると、FaceY変形が適用されず歪むことが確認された。
- Read-only Sylph調査で、Runtime / Editor previewの両方がWarp inside判定とsamplingをcurrent座標で行っていることが確認された。
- 評価順は既にchild-first -> parentであり、問題は順序ではなくmembership / sampling basisであると確認された。
- ユーザーは次の方針を採用済み:
  - 親Warpの所属判定はrest / bindで決める。
  - 親Warpの変形適用先は子変形後currentにする。
  - current座標が親visual domain外へ出ること自体は正常に扱う。
  - bounds/refitは補助であり、本質修正ではない。
- 設計判断は [03-runtime-evaluation-semantics.md](../../design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md) と module contract docsへ反映済み。

Uncertainty:

- factual: medium. Runtime / Canvasのdual stream導入範囲と既存snapshot testsへの影響はDomain A/Bで確認する必要がある。
- decision: low. semantics方針は合意済みで、schema変更しない最小方針もSylph調査で妥当。
- cost of wrong plan: high. RuntimeとEditor previewがズレると、Viewer / Runtime Export / Editor authoring全体の信頼性が落ちるため、runtime数値テストを先に固定する。

## 3. Accepted Decisions / Oracles

### 3.1 Nested Warp Membership Semantics

Required:

- `warpLattice2d` のmembership / inside判定 / lattice sampling weightは、stableなrest / bind座標から決める。
- 子Warp / 子Rotation / mesh keyformなどでcurrent頂点が親Warp visual domain外へ出ても、それだけを理由に親Warp対象外にしない。
- 親Warpが計算したdisplacementは、子の変形結果であるcurrent頂点へ重ねて適用する。
- rest / bind座標の時点で親Warp対象外だった頂点は、親Warp対象外として扱ってよい。
- Runtime core、Editor Canvas preview、Viewer / Runtime Export経由の評価で同じsemanticsを使う。

Forbidden:

- current座標だけで親Warp inside/outsideを判定し続ける。
- boundsを広げるだけでこの問題を解決扱いする。
- Runtimeだけ、またはEditor previewだけを修正する。
- 子変形が親Warpのstateやbindingを変更する。

### 3.2 Dual Vertex Stream Policy

Wave94の最小実装では、永続per-vertex bindingを導入しない。

Required:

- Runtime rig evaluationには `currentVertices` と `referenceVertices` を渡す。
- `referenceVertices` はbase/rest mesh vertex由来とする。
- mesh keyform / child deformer / current parameter resultは `currentVertices` に適用する。
- Warpは `referenceVertices[index]` でmembership/samplingを行い、`currentVertices[index]` にdisplacementを加える。
- Rotation / translation style effectsは従来どおりcurrent座標へ作用する。
- reference/current vertex count mismatchは黙ってindexせず、diagnosticまたは安全なfallbackを行う。

Accepted:

- Persisted binding fieldはWave94対象外。
- Schema / runtime export shapeは変更しない。
- Derived bindingはbase/rest mesh verticesからdeterministicに導出する。

### 3.3 Diagnostics Policy

Required:

- current頂点がchild deformation後にparent visual domain外へ出ること自体はwarningにしない。
- rest / bind座標がexpected parent warp domain外の場合は `rigControl.warpBindingOutsideDomain` のwarning候補とする。
- Diagnostics実装が既存構造上大きくなる場合は、runtime/editor semantic fixを優先し、diagnosticはsource-reviewed placeholderまたは validator follow-upとして明示報告してよい。

Forbidden:

- 旧 `rigControl.childOutsideWarpDomain` を復活させる。
- current outsideをneeds_review/failにする。

### 3.4 Contract / Fixture Policy

Already updated basis:

- `nested-warp-rest-binding`: child warp moves current vertices outside parent visual domain, while parent warp still applies from rest/bind membership.
- `warp-binding-outside-domain`: rest/bind coordinate is outside expected parent warp domain and can produce warning/needs_review.

Required:

- Tests must distinguish these two cases.
- Runtime and Canvas parity must use equivalent numeric fixtures.

## 4. Primary Basis

Implementation baseline:

- [wave91-plan.md](wave91-plan.md)
- [wave92-plan.md](wave92-plan.md)
- [wave93-plan.md](wave93-plan.md)
- [../waves/wave93/wave93-final-integration-report.md](../waves/wave93/wave93-final-integration-report.md)
- [../reviews/wave93/wave93-final-clean-integration-review.md](../reviews/wave93/wave93-final-clean-integration-review.md)

Design / contract basis:

- [../../design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md](../../design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md)
- [../../design/module-contracts/runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- [../../design/module-contracts/fixtures-and-contract-tests.md](../../design/module-contracts/fixtures-and-contract-tests.md)
- [../../design/module-contracts/validator-contract.md](../../design/module-contracts/validator-contract.md)
- [../../design/module-contracts/traceability-matrix.md](../../design/module-contracts/traceability-matrix.md)

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)

Known source facts:

- `packages/runtime-core/src/snapshot.ts`: Runtime snapshot creation currently has access to normalized base drawable vertices before/around keyform deformation.
- `packages/runtime-core/src/rig-control-evaluation.ts`: Rig control hierarchy evaluation currently receives one current vertex stream.
- `packages/runtime-core/src/rig-control-warp-lattice.ts`: Warp lattice inside check and sampling currently use the same current vertex.
- `packages/runtime-core/src/normalized-runtime-graph.ts`: normalized drawable has rest/base vertices; no persisted per-vertex warp binding exists.
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`: Canvas preview mirrors the same single-stream warp behavior.
- `packages/contracts/src/warp-lattice2d.ts`: contract/comment may still refer to outside-domain pass-through and needs wording alignment.

## 5. Wave Strategy

Wave94 should run in ordered batches.

```text
Batch 1:
  Domain A: Runtime Core Nested Warp Rest/Bind Semantics

Batch 2:
  Domain B: Editor Canvas Preview Parity + Diagnostics/Contract Touchpoints

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Runtime core must become the numeric oracle first.
- Editor Canvas preview should either reuse a Runtime helper or mirror Runtime behavior against the same numeric fixtures.
- Diagnostics/contract touchpoints depend on the exact runtime implementation surface.
- Splitting Runtime and Canvas in parallel would risk divergent semantics and duplicate test fixture interpretation.
- Final clean review must see both Runtime and Canvas parity together.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Runtime Core Nested Warp Rest/Bind Semantics | Wave93 final pass / accepted semantics docs | First / blocking | Add dual-stream runtime rig evaluation and rest/bind-based warp membership; lock runtime numeric behavior with focused tests |
| 2 | B. Editor Canvas Preview Parity + Diagnostics/Contract Touchpoints | Domain A pass or explicit escalation | After A; not parallel with A | Apply same semantics to Canvas preview, align contract comments and diagnostics/fixture touchpoints, add parity tests |
| 3 | C. Final Integration / Clean Review / Map Closeout | Domain A+B pass or explicit escalation | Final only | Validate combined runtime/editor semantics, ensure no schema/export/dependency drift, record reports/reviews/maps |

## 6. Domain A: Runtime Core Nested Warp Rest/Bind Semantics

Domain id: `wave94-runtime-core-nested-warp-rest-bind-semantics`

Purpose:

- Make runtime evaluation apply parent Warp displacement according to rest/bind membership rather than current-coordinate membership.
- Preserve child-first effect order.
- Preserve package/runtime graph schema.

Allowed write scope:

- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-warp-lattice.ts`
- `packages/runtime-core/src/**/*.test.ts`
- `packages/contracts/src/warp-lattice2d.ts` only for narrow contract/comment wording if Domain A owns it.
- Domain A report/review files under `discussion/implementation/waves/wave94/` and `discussion/implementation/reviews/wave94/`

Conditional write scope, requiring explicit report justification:

- `packages/runtime-core/src/normalized-runtime-graph.ts` only if a type helper is needed for reference vertex access.
- `packages/validator-core/src/**` only if existing runtime diagnostics are already generated there and the `warpBindingOutsideDomain` warning can be added narrowly.

Forbidden write scope:

- `apps/editor/src/**`
- `packages/package-format/src/**` schema changes
- `packages/render-core/src/**`
- `packages/render-webgl2/src/**`
- mesh generation algorithms
- Texture Atlas / Runtime Export format changes
- Runtime Player app
- new dependencies / lockfile

Required implementation:

- Extend runtime rig control evaluation data flow to carry both:
  - `currentVertices`: vertices after keyform / child effects.
  - `referenceVertices`: stable rest/base vertices for membership/sampling.
- In `createRuntimeSnapshot`, derive `referenceVerticesByDrawableId` from normalized drawable base vertices before current mesh/keyform deformation.
- Update `evaluateRigControlHierarchy` and internal effect application signatures to pass both streams.
- Update Warp lattice application so:
  - inside/domain check uses `referenceVertices[index]`;
  - normalized lattice coordinate / bilinear sampling uses `referenceVertices[index]`;
  - computed displacement is added to `currentVertices[index]`;
  - outside rest/bind coordinate produces pass-through or diagnostic according to accepted policy.
- Keep rotation/translation effects applying to current vertices only.
- Guard reference/current vertex count mismatch with deterministic diagnostic or safe fallback.
- Preserve existing public package schema and runtime export shape.

Required tests:

- Runtime nested case:
  - rest vertex inside parent domain.
  - child Warp moves current vertex outside parent visual domain.
  - parent Warp still applies displacement.
- Runtime negative case:
  - rest vertex outside parent domain.
  - child Warp moves current vertex inside parent visual domain.
  - parent Warp does not apply.
- Runtime nonuniform parent Warp case:
  - prove sampling coordinate comes from rest/reference, not current.
- Existing child-before-parent hierarchy tests still pass or are intentionally updated with explanation.
- Reference/current vertex count mismatch is handled deterministically.
- No package schema/runtime export shape change is required.

Required evidence:

- Before/after explanation of current-coordinate sampling removal.
- Test names and expected numeric values for nested rest-binding behavior.
- Explicit note about whether Runtime helper is exported for Canvas reuse.

Escalate if:

- Correct runtime fix requires persisted per-vertex binding.
- Fix requires package-format schema changes.
- Rotation/translation semantics must change to make Warp semantics work.
- Existing keyform mesh evaluator mutates/restores vertices in a way that makes stable reference vertices unavailable.

## 7. Domain B: Editor Canvas Preview Parity + Diagnostics/Contract Touchpoints

Domain id: `wave94-editor-canvas-nested-warp-rest-bind-parity`

Dependencies:

- Domain A `pass` or explicit escalation with a stable runtime numeric oracle.

Purpose:

- Make Editor Canvas preview match Runtime nested Warp semantics.
- Prevent authoring viewport from showing the old current-coordinate pass-through distortion.
- Align narrow contract/comment/fixture touchpoints that were not completed in Domain A.

Allowed write scope:

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/**/*.test.ts`
- `packages/contracts/src/warp-lattice2d.ts`
- `packages/validator-core/src/**` only for narrow `warpBindingOutsideDomain` diagnostic support if practical.
- focused test fixture files directly tied to `nested-warp-rest-binding` / `warp-binding-outside-domain`.
- Domain B report/review files under `discussion/implementation/waves/wave94/` and `discussion/implementation/reviews/wave94/`

Conditional write scope, requiring explicit report justification:

- `packages/runtime-core/src/rig-control-warp-lattice.ts` only for exporting a pure helper introduced by Domain A.
- `apps/editor/src/features/editor-session/**` only if Canvas evaluation needs reference/base mesh data plumbed from existing session/project state.

Forbidden write scope:

- package-format schema changes.
- Runtime Export format changes.
- Renderer architecture / WebGL buffer changes.
- Mesh generation algorithms.
- Texture Atlas / Dynamics / Workspace Save unrelated code.
- Runtime Player app.
- new dependencies / lockfile.

Required implementation:

- Update Canvas rig-control evaluation to carry reference/rest vertices alongside current vertices.
- Ensure Canvas Warp membership and lattice sampling use reference/rest coordinates.
- Ensure Canvas Warp displacement is applied to current vertices.
- Keep selection overlays / control point overlays consistent with evaluated geometry where practical.
- Prefer reusing a pure Runtime helper if Domain A exposes one cleanly.
- If mirroring logic instead, add paired numeric tests with the Runtime cases and report why helper reuse was deferred.
- Remove or update any contract/comment that still describes current-coordinate outside-domain pass-through as normal nested behavior.
- Add or route `rigControl.warpBindingOutsideDomain` diagnostic only if implementation remains narrow; otherwise document as follow-up without blocking semantic fix.

Required tests:

- Canvas nested case matching Runtime numeric fixture:
  - child Warp moves current outside parent visual domain.
  - parent Warp still affects the vertex.
- Canvas negative case:
  - current inside but rest/reference outside remains unaffected.
- Canvas nonuniform parent Warp proves rest/reference sampling.
- Existing Canvas hierarchy/keyform tests remain passing or are intentionally updated.
- Viewer/Canvas render source smoke remains unaffected where focused tests already exist.

Required evidence:

- Runtime/Canvas parity notes.
- Source explanation for helper reuse vs mirrored logic.
- Any deferred diagnostic work clearly listed.

Escalate if:

- Canvas cannot access stable base/rest vertices without broad Editor state rewiring.
- Runtime helper reuse would introduce an invalid dependency direction.
- Overlay/hit-test behavior requires a separate UX decision.

## 8. Domain C: Final Integration / Clean Review

Domain id: `wave94-final-integration-clean-review`

Dependencies:

- Domain A `pass`
- Domain B `pass`

Purpose:

- Validate combined Runtime + Canvas nested Warp behavior.
- Confirm no schema/export/render/dependency drift.
- Record final reports/reviews/maps.

Allowed write scope:

- `discussion/implementation/waves/wave94/**`
- `discussion/implementation/reviews/wave94/**`
- orchestration/review/wave maps if status updates are required.

Required checks:

- Domain A and B reports/review lanes are present.
- Focused runtime-core nested Warp tests.
- Focused Canvas nested Warp parity tests.
- Existing rig-control hierarchy/keyform evidence tests that were touched.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check:
  - no package-format schema changes;
  - no runtime export shape changes;
  - no mesh generation / atlas / dynamics / runtime-player changes;
  - no dependency/lockfile changes.

## 9. Review Policy

Each implemented domain requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- parent Warp membership uses rest / bind coordinates.
- parent Warp displacement applies to current child-deformed vertices.
- child deformation moving current outside parent visual domain does not cause pass-through.
- rest/reference outside parent domain remains outside.
- Runtime and Canvas semantics match.
- current-outside is not treated as warning/needs_review.
- no persisted per-vertex binding or schema change was introduced.

Design / Development Review must explicitly check:

- dual stream naming and data flow are clear.
- Runtime helper reuse, if present, has valid dependency direction.
- reference/current mismatch is handled deterministically.
- rotation/translation semantics are not accidentally changed.
- package-format, runtime export, renderer, atlas, dynamics, workspace save, and runtime-player boundaries are respected.
- no new dependencies / lockfile changes.
- no catch-all source file growth or source organization violation.

Test Adequacy Review must explicitly check:

- runtime positive nested rest-binding case.
- runtime negative rest-outside/current-inside case.
- runtime nonuniform sampling proof.
- canvas parity positive case.
- canvas parity negative case.
- existing hierarchy/keyform tests updated intentionally.
- diagnostics/fixture expectations align with `nested-warp-rest-binding` and `warp-binding-outside-domain`.

## 10. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave94/wave94-domain-a-runtime-core-nested-warp-rest-bind-semantics-report.md`
- `discussion/implementation/waves/wave94/wave94-domain-b-editor-canvas-nested-warp-rest-bind-parity-report.md`
- `discussion/implementation/waves/wave94/wave94-final-integration-report.md`
- `discussion/implementation/waves/wave94/_map.md`

Review reports:

- `discussion/implementation/reviews/wave94/wave94-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave94/wave94-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave94/_map.md`

## 11. Subagent Contract

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
- Preserve package/runtime graph schema unless explicit escalation is accepted.
- Preserve Runtime Export and Atlas Runtime behavior.
- Preserve child-first effect order.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat current-coordinate parent Warp membership as blocking.
- Treat Runtime/Canvas semantics divergence as blocking.
- Treat schema/export/dependency changes as blocking unless explicitly escalated.

## 12. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave94 source changes.
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

## 13. Out of Scope

- Bounds/refit-only fix for this nested Warp issue.
- Persisted per-vertex binding schema.
- Package-format schema changes.
- Runtime Export format changes.
- Texture Atlas changes.
- Mesh generation changes.
- Dynamics changes.
- Workspace Save format changes.
- Runtime Player app changes.
- Renderer architecture / WebGL buffer optimization.
- Overlay/hit-test UX redesign.
- Deformer creation/refit UX expansion.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
