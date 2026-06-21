# Wave 95 Plan: Mesh v6D Multi-Alpha-Island Generation

> Wave95は、1つのDrawable画像に複数の明確な不連続alpha領域がある場合に、最大島だけでなく各有効島を独立にmesh生成し、1つのdisconnected meshとして結合する。目的は、左右脚のような実用的な複数alpha islandパーツを、Drawable分割なしで自然に救うことである。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave95
- Wave name: `mesh-v6d-multi-alpha-island-generation`
- Primary objective:
  - `auto-outline-v6d-adaptive-contour-constrainautor` の単一島品質を維持する。
  - raw alpha threshold由来のconnected componentを常時検出する。
  - significant alpha islandが複数ある場合、islandごとに既存V6D系生成を独立実行して結合する。
  - 島同士を透明領域越しに三角形でつながない。
  - 微小alpha noise islandは除外し、成功時は通常UI warningを出さずdiagnostics / provenanceへ残す。
  - islandごとの失敗は可能なら局所fallbackに留め、全island失敗時のみ従来fallbackへ倒す。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then plan.

Why planning is now safe:

- ユーザー観察として、左右脚のように明確な2つのalpha領域を持つレイヤーで、現行mesh生成が片方の島だけを拾うことが確認された。
- Read-only Sylph調査で、現行V6 contour pipelineが `findOpaqueComponents(...)` 後に `selectMainComponent(...)` で最大島のみを選び、`multiIslandHandling: "main-island-only"` としていることが確認された。
- ユーザーは次の方針を採用済み:
  - 複数島検知は常時有効。通常UI toggleは置かない。
  - 複数島でもDrawableは分割しない。
  - 各islandを独立生成して、vertices / uvs / trianglesを1つのmeshへ結合する。
  - island間をまたぐtriangleは作らない。
  - ノイズ除去成功は通常UI warningにしない。
  - 有効islandが残らない場合、または一部island fallback / 除外が起きた場合はユーザーに見えるwarning相当でよい。

Uncertainty:

- factual: medium. 既存V6D generatorをisland単位に安全に再利用するための最小抽出位置とbudget配分はDomain Aで確認する必要がある。
- decision: low. product semanticsは合意済みで、tiny island thresholdも初期方針をこの計画で固定する。
- cost of wrong plan: high. 既存の単一島mesh品質を落とすと、ほぼ完成したrigging workflow全体に悪影響が出るため、single-island path保護を最優先にする。

## 3. Accepted Decisions / Oracles

### 3.1 Multi-Island Semantics

Required:

- Multi-island detection is always enabled.
- No normal user-facing toggle for detection.
- A multi-island Drawable remains one Drawable.
- Generated mesh may contain multiple disconnected triangle components.
- Draw order, visibility, deformer membership, atlas/runtime export identity remain per Drawable.
- Islands must never be connected by triangles across transparent gaps.
- Multi-island success should be treated as successful mesh generation, not a warning condition.

Forbidden:

- Auto-splitting the Drawable into multiple Drawables.
- Connecting islands into one artificial contour.
- Running triangulation over a combined multi-island contour that can create cross-gap triangles.
- Keeping the old maximum-island-only behavior as the normal generated result.

### 3.2 Detection Stage

Required:

- Connected component labeling uses a raw-alpha-threshold-ish mask.
- Detection happens before soft alpha blur, crack closing, contour support expansion, or support-ring expansion.
- Per-island generation may still use the existing soft boundary/support-ring V6D pipeline inside each island.
- Nearby islands must not be merged simply because later soft/support processing expands them.

### 3.3 Tiny Island / Noise Policy

Wave95 fixes the initial threshold policy to avoid leaving obvious alpha dust while preserving meaningful thin parts.

Required:

- Filter tiny/noise islands before density allocation.
- Filtering uses a compound rule, not area alone.
- An island is treated as noise if it is clearly non-authorial, for example:
  - very small pixel count;
  - very small bounding box;
  - very small area ratio compared with the largest component;
  - and no elongated/meaningful dimension that would justify preserving it.
- Initial implementation should use conservative constants and document them in code/tests.
- Meaningful narrow islands, such as a thin separated strand or slim part, must not be dropped merely because area is small.
- If at least one valid island remains and mesh generation succeeds, skipped noise islands are recorded in diagnostics/provenance but not shown as a normal UI warning.
- If noise filtering leaves no valid island, mesh generation must report failure/fallback clearly.

Accepted initial threshold guidance:

- Always drop 1-2 pixel specks and extremely tiny bounding boxes.
- Drop components that are both tiny in absolute pixels and tiny relative to the largest component.
- Preserve components with a non-trivial bounding box even when area ratio is small.
- Tests must include both removable speck noise and a small-but-valid separated island.

### 3.4 Per-Island Generation / Merge

Required:

- Significant islands are ordered deterministically.
- Each island runs the existing V6D adaptive contour mesh generation independently.
- Merged output:
  - concatenates `vertices`;
  - concatenates `uvs`;
  - offsets triangle indices;
  - avoids stable vertex/triangle ID collisions through island-scoped suffix/prefix if applicable;
  - keeps UVs in original drawable texture space;
  - keeps one mesh assigned to the original Drawable;
  - reports aggregate bounds as the union of kept/generated islands.
- Single-island path should remain behaviorally unchanged.

Budget policy:

- Multi-island generation must not give every island a full preset budget.
- Preset budgets are global per Drawable.
- Allocate per-island density/budget by component size/perimeter with a minimum viable budget per kept island.
- If total budget pressure is high, reduce smaller islands first.
- Tiny islands are filtered before allocation, not starved into broken geometry.

### 3.5 Failure / Fallback Policy

Required:

- If one island fails, attempt localized fallback for that island and merge with successful islands.
- If an island is dropped due to failure, record it as warning/fallback diagnostics.
- If all islands fail, use existing whole-drawable fallback behavior.
- All-island failure should remain user-visible.
- Partial island fallback/drop should be user-visible in details and copied diagnostics.
- Successful noise filtering with valid islands remaining should not be a visible warning.

### 3.6 Diagnostics / Provenance Policy

Required:

- Extend V6 metrics/provenance with multi-island information:
  - raw alpha component count;
  - kept island count;
  - skipped tiny/noise island count;
  - skipped tiny/noise pixel total;
  - per-island bounds/pixel count where practical;
  - per-island vertices/triangles where practical;
  - localized fallback count/reasons;
  - `multiIslandHandling: "supported"` for successful multi-island generation.
- Existing inspector copy / diagnostic details should include these fields.
- Normal visible UI does not need a warning for successful noise filtering.
- If no valid island remains, or partial fallback/drop occurs, visible details should explain the issue.

## 4. Primary Basis

Implementation baseline:

- [wave91-plan.md](wave91-plan.md)
- [wave92-plan.md](wave92-plan.md)
- [wave93-plan.md](wave93-plan.md)
- [wave94-plan.md](wave94-plan.md)
- [../waves/wave94/wave94-final-integration-report.md](../waves/wave94/wave94-final-integration-report.md)
- [../reviews/wave94/wave94-final-clean-integration-review.md](../reviews/wave94/wave94-final-clean-integration-review.md)

Design / algorithm basis:

- [../../design/mesh-generation/auto-outline-v6d-adaptive-contour-constrainautor.md](../../design/mesh-generation/auto-outline-v6d-adaptive-contour-constrainautor.md)
- [../../design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md](../../design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md)

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)

Known source facts:

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`: default method is `auto-outline-v6d-adaptive-contour-constrainautor`.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`: preview/apply flow through `createMeshToolDraft`, preview draft generation, and `applyMeshDraft`.
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`: `commitGenerateMesh`.
- `packages/authoring-core/src/mesh-generation.ts`: `createGeneratedMeshForDrawable` dispatch.
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`: default V6D implementation entry.
- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`: current `findOpaqueComponents(...)` -> `selectMainComponent(...)` path loses secondary islands.
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-density.ts`: adaptive density/preset logic.
- `packages/operation-core/src/operations/generate-mesh.ts`: generated mesh provenance / transform history formatting.
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`: mesh inspector details and diagnostic copy payload.

## 5. Wave Strategy

Wave95 should run in ordered batches.

```text
Batch 1:
  Domain A: Authoring Core Multi-Island Mesh Generation

Batch 2:
  Domain B: Diagnostics / Operation Provenance / Editor Inspector Integration

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A must establish the backend generated mesh shape and metrics before editor/provenance surfaces can be finalized.
- Domain B depends on Domain A metrics and result shape.
- Rendering/runtime/export behavior should not require feature code changes if disconnected meshes remain valid topology; final integration validates this explicitly.
- Splitting authoring-core and editor/provenance avoids overlapping implementation contexts while keeping the review burden reasonable.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Authoring Core Multi-Island Mesh Generation | Wave94 final pass / accepted mesh island policy | First / blocking | Detect raw-alpha components, filter tiny islands, generate V6D per island, merge disconnected mesh, preserve single-island behavior |
| 2 | B. Diagnostics / Operation Provenance / Editor Inspector Integration | Domain A pass or explicit escalation | After A; not parallel with A | Surface multi-island metrics through operation provenance, transform history, inspector copy/details, and focused integration tests |
| 3 | C. Final Integration / Clean Review / Map Closeout | Domain A+B pass or explicit escalation | Final only | Validate mesh topology/render/runtime/export compatibility, forbidden-scope compliance, and record final artifacts |

## 6. Domain A: Authoring Core Multi-Island Mesh Generation

Domain id: `wave95-authoring-core-multi-island-mesh-generation`

Purpose:

- Implement multi-alpha-island mesh generation in authoring-core while preserving existing single-island V6D quality.

Allowed write scope:

- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-density.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`
- `packages/authoring-core/src/mesh-generation*.test.ts`
- narrowly scoped new authoring-core helper files for V6 island generation if needed.
- Domain A report/review files under `discussion/implementation/waves/wave95/` and `discussion/implementation/reviews/wave95/`

Conditional write scope, requiring explicit report justification:

- `packages/validator-core/src/**` only if a topology helper is needed for disconnected mesh tests.
- `packages/contracts/src/**` only if a metrics type lives there and must be extended.

Forbidden write scope:

- `apps/editor/src/**`
- `packages/package-format/src/**` schema changes
- Runtime Export format changes
- Texture Atlas algorithm changes
- Runtime Player app
- Renderer architecture / WebGL buffer changes
- dependencies / lockfile

Required implementation:

- Preserve current single-island path behavior.
- Detect raw alpha connected components before soft/support processing.
- Build deterministic island descriptors with component order, pixel count, and bounds.
- Filter tiny/noise islands according to the compound threshold policy.
- For multiple kept islands, invoke existing V6D generation per island.
- Prevent per-island soft/support processing from seeing or merging other islands.
- Merge per-island mesh results into one disconnected mesh:
  - concatenate vertices/UVs;
  - offset triangle indices;
  - avoid stable id collisions;
  - preserve original texture-space UVs;
  - union bounds/alpha bounds.
- Apply global preset budget across islands.
- Localize island failure where possible.
- Use existing whole-drawable fallback if all islands fail.

Required tests:

- Single-island regression remains behaviorally unchanged for existing fixtures.
- Two separated leg-shaped alpha islands:
  - both islands produce geometry;
  - output has disconnected triangle components;
  - no triangle crosses the transparent gap;
  - `multiIslandHandling` becomes `"supported"`;
  - UVs remain in expected source texture space.
- Tiny alpha speck noise:
  - noise is skipped;
  - no geometry appears in noise bbox;
  - valid island still succeeds.
- Small-but-valid island:
  - a narrow or small separated meaningful region is not dropped solely by area.
- Partial island failure path if a practical seam exists.
- All-island failure still uses existing fallback.
- Generated mesh topology remains valid after merge.

Escalate if:

- Existing V6D generator cannot be safely reused per island without a broad rewrite.
- Correct multi-island merge requires package-format schema changes.
- Global budget allocation makes existing presets meaningfully worse for single-island meshes.
- UV preservation requires renderer/atlas changes.

## 7. Domain B: Diagnostics / Operation Provenance / Editor Inspector Integration

Domain id: `wave95-multi-island-diagnostics-provenance-editor-integration`

Dependencies:

- Domain A `pass` or explicit escalation with stable metrics/result shape.

Purpose:

- Carry multi-island results through operation provenance and editor diagnostic surfaces without adding noisy normal UI warnings.

Allowed write scope:

- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/**/*.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- focused editor tests:
  - `apps/editor/src/features/editor-session/**/*.test.ts`
  - `apps/editor/src/workspace/panels/mesh-tool-inspector.test.tsx` or existing equivalent.
- Domain B report/review files under `discussion/implementation/waves/wave95/` and `discussion/implementation/reviews/wave95/`

Conditional write scope, requiring explicit report justification:

- `packages/authoring-core/src/**` only for metrics field adjustments discovered during integration.
- `packages/validator-core/src/**` only for disconnected topology regression tests.
- focused render/runtime/atlas smoke tests if needed to prove compatibility.

Forbidden write scope:

- Mesh generation algorithm changes beyond metrics adjustments.
- package-format schema changes.
- Runtime Export format changes.
- Texture Atlas algorithm changes.
- Dynamics / Workspace Save / Runtime Player unrelated code.
- dependencies / lockfile.

Required implementation:

- Propagate multi-island metrics through mesh operation provenance.
- Ensure transform history / copied diagnostic details include:
  - raw component count;
  - kept/generated island count;
  - skipped tiny/noise count and pixel total;
  - localized fallback count/reasons where available;
  - `multiIslandHandling: "supported"` for successful multi-island generation.
- Keep successful noise filtering quiet in normal visible UI.
- Show user-visible detail only when:
  - no valid island remains;
  - all-island failure/fallback occurs;
  - partial island failure/drop occurs.
- Preserve existing Mesh Inspector density/layout.

Required tests:

- Operation preview/commit provenance includes multi-island metrics.
- Inspector diagnostic copy payload includes multi-island metrics.
- Successful skipped noise does not create visible warning state.
- No-valid-island or partial fallback exposes a visible diagnostic/detail state if supported by current UI.
- Existing mesh apply/auto-refit behavior remains passing.
- Disconnected mesh topology is accepted by validator/topology tests.
- Focused render/runtime/atlas smoke where practical:
  - disconnected triangles render structurally;
  - runtime export shape is unchanged;
  - atlas staleness/UV behavior remains valid.

Escalate if:

- Current inspector has no non-invasive way to show partial island fallback details.
- Provenance metrics require schema changes beyond existing flexible metric payloads.
- Disconnected topology is rejected by validator/runtime assumptions.

## 8. Domain C: Final Integration / Clean Review

Domain id: `wave95-final-integration-clean-review`

Dependencies:

- Domain A `pass`
- Domain B `pass`

Purpose:

- Verify combined multi-island mesh generation and diagnostics.
- Confirm existing single-island mesh quality is not regressed.
- Confirm no runtime/export/atlas/schema/dependency drift.
- Record final reports/reviews/maps.

Allowed write scope:

- `discussion/implementation/waves/wave95/**`
- `discussion/implementation/reviews/wave95/**`
- orchestration/review/wave maps if status updates are required.

Required checks:

- Domain A and B reports/review lanes are present.
- Focused authoring-core multi-island tests.
- Focused operation/editor inspector provenance tests.
- Existing V6D single-island regression tests.
- Focused topology/render/runtime/export compatibility tests where added.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check:
  - no package-format schema changes;
  - no runtime export shape changes;
  - no atlas algorithm changes;
  - no runtime-player changes;
  - no dependency/lockfile changes.

## 9. Review Policy

Each implemented domain requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- multi-island detection is always enabled.
- single-island path remains behaviorally unchanged.
- multiple valid islands generate disconnected mesh components.
- no cross-gap triangles exist.
- tiny noise is filtered and recorded, not surfaced as normal warning on success.
- meaningful small/narrow islands are not dropped solely by area.
- partial/all-island fallback semantics match the plan.

Design / Development Review must explicitly check:

- connected component detection occurs before soft/support expansion.
- budget allocation is global per Drawable.
- UVs stay in original texture space.
- stable ids do not collide after merge.
- authoring-core owns generation; operation/editor own provenance/surface.
- no package-format schema, runtime export, atlas algorithm, or dependency drift.
- no catch-all source file growth or source organization violation.

Test Adequacy Review must explicitly check:

- two-island positive case.
- no-cross-gap assertion.
- tiny noise skipped case.
- small-but-valid island retained case.
- single-island regression.
- operation/editor diagnostic propagation.
- topology/render/runtime/export compatibility where applicable.

## 10. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave95/wave95-domain-a-authoring-core-multi-island-mesh-generation-report.md`
- `discussion/implementation/waves/wave95/wave95-domain-b-multi-island-diagnostics-provenance-editor-integration-report.md`
- `discussion/implementation/waves/wave95/wave95-final-integration-report.md`
- `discussion/implementation/waves/wave95/_map.md`

Review reports:

- `discussion/implementation/reviews/wave95/wave95-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave95/wave95-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave95/wave95-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave95/wave95-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave95/wave95-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave95/wave95-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave95/wave95-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave95/_map.md`

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
- Preserve single-island V6D quality.
- Preserve package-format schema and runtime export shape.
- Preserve disconnected mesh compatibility with renderer/runtime/atlas.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat maximum-island-only behavior for multi-island input as blocking.
- Treat cross-gap triangles as blocking.
- Treat single-island quality regression as blocking.
- Treat schema/export/dependency changes as blocking unless explicitly escalated.

## 12. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave95 source changes.
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

- Drawable auto-splitting.
- User-facing toggle for island detection.
- Connecting islands with transparent-gap triangles.
- Replacing V6D with a new mesh algorithm.
- Mesh algorithm selection UI.
- Manual island editing UI.
- Texture Atlas algorithm changes.
- Runtime Export format changes.
- Package-format schema changes.
- Dynamics changes.
- Workspace Save format changes.
- Runtime Player app changes.
- Renderer architecture / WebGL buffer optimization.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
