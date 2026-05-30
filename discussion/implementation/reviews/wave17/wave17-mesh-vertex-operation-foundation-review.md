# Wave 17 Domain A Final Review: mesh vertex operation foundation

- verdict: `pass`
- reviewer: final Review-Sylph, separate context
- target: `wave17-mesh-vertex-operation-foundation`
- loop: final review after Undine-approved additional fix

## Review Context Separation Evidence

本レビューは、初回 Gnome、初回 Review-Sylph、追加修正 Gnome とは別の最終 Review-Sylph context として実施した。source code / tests は編集せず、許可された本レビュー報告書のみ更新した。

Separation evidence:

- 初回 Gnome 実装 context: `019e7864-ab0b-7ba2-a52a-200f666a4856`
- 初回 Review-Sylph context: `019e786f-edb2-7432-bb3a-487ca81b0307`
- Undine-approved additional fix Gnome context: `019e7879-de3f-73d1-acd5-a464bb86a8f4`
- 本レビュー: 上記とは別の final Review-Sylph context

## Undine Decision Considered

Undine 判断として、Domain A 要件の「empty delta を deterministic diagnostic にする」が明示されたため、`vertexDeltas: []` は schema parse の `operation.request.invalid` ではなく、`moveMeshVertex` handler / precondition 側で `operation.moveMeshVertex.emptyDelta` にする方針として判定した。

この判断に基づき、`packages/operation-core/src/payloads/model-edit.ts` の `MoveMeshVertexPayloadSchema.vertexDeltas` から `.min(1)` が外れていること、public lifecycle 経由の test が追加されていることを確認した。

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave17-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave16/wave16-final-report.md`
- `discussion/implementation/waves/wave15/wave15-final-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave17/wave17-mesh-vertex-operation-foundation-review.md`

## Changed Files / Diff Reviewed

Tracked diff reviewed:

- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/mesh-mutations.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-lifecycle.test.ts`

Untracked/new files read directly:

- `packages/authoring-core/src/mesh-mutations.test.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.test.ts`

Reports reviewed:

- `discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave17/wave17-mesh-vertex-operation-foundation-review.md`

Unrelated pre-existing worktree changes under `discussion/implementation/_map.md`, `discussion/implementation/orchestration/_map.md`, `discussion/implementation/orchestration/wave16-plan.md`, and the untracked `discussion/implementation/orchestration/wave17-plan.md` status were not reviewed as Domain A implementation changes. `wave17-plan.md` was treated as basis.

## Verification Considered

Orch-Sylph 共有の final verification を考慮した。

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-mutations.test.ts packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/move-mesh-vertex.test.ts packages/operation-core/src/operation-lifecycle.test.ts`
  - sandbox: Vitest node_modules read が `EPERM`
  - escalated rerun: pass, 4 files / 27 tests
- `pnpm.cmd typecheck`
  - sandbox: TypeScript node_modules read が `EPERM`
  - escalated rerun: pass, root and editor typecheck
- `pnpm.cmd run check:source`: pass in sandbox
- `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md discussion/implementation/reviews/wave17/wave17-mesh-vertex-operation-foundation-review.md`: pass, LF/CRLF warnings only

## Findings

Blocking findings: none.

### Previously Finding 1: public empty `vertexDeltas` returned generic request invalid

Status: fixed.

Evidence:

- `MoveMeshVertexPayloadSchema.vertexDeltas` no longer has `.min(1)`, so `vertexDeltas: []` reaches the typed operation lifecycle: `packages/operation-core/src/payloads/model-edit.ts:44`.
- `evaluateMoveMeshVertexPreconditions` now returns `operation.moveMeshVertex.emptyDelta` when `vertexDeltas.length === 0`: `packages/operation-core/src/operations/move-mesh-vertex.ts:136`.
- Public lifecycle regression covers `createOperationCore.commitOperation(... vertexDeltas: [])` and expects `operation.moveMeshVertex.emptyDelta`: `packages/operation-core/src/operation-lifecycle.test.ts:313`.
- Handler-level public dry-run regression also checks empty delta diagnostic and no mutation/log side effect: `packages/operation-core/src/operations/move-mesh-vertex.test.ts:166`.

### Previously Finding 2: `modelDiff.changed` lacked stable per-vertex target entries

Status: fixed.

Evidence:

- `createMoveMeshVertexResult` keeps the mesh-level changed entry and adds one stable vertex target entry per changed vertex: `packages/operation-core/src/operations/move-mesh-vertex.ts:262`.
- The vertex entry target uses `kind: "vertex"`, stable `vertexId`, and the deterministic vertex path: `packages/operation-core/src/operations/move-mesh-vertex.ts:267`.
- Focused tests assert both dry-run and commit model diff vertex targets: `packages/operation-core/src/operations/move-mesh-vertex.test.ts:62`, `packages/operation-core/src/operations/move-mesh-vertex.test.ts:111`.

## Design / Development Compliance Assessment

`moveMeshVertex` handler is registered in `operation-registry.ts` and follows existing operation lifecycle structure. Dry-run applies to a cloned authoring session, while commit applies to the real session and the lifecycle appends the operation log entry after committed mutation. The implementation provides deterministic diagnostics for missing mesh, missing vertex, duplicate vertex delta, empty delta, no-op update, and unsupported `keyformScope`.

The authoring mutation resolves vertices by stable `vertexStableIds`, applies delta semantics to base mesh vertices, records before/after vertex changes, recomputes bounds, increments authoring revision, and marks the session dirty. The operation model diff includes mesh-level vertices/bounds fields plus stable per-vertex target entries.

Source organization complies with the policy: no `index.ts` implementation logic was added; operation logic is in `operations/move-mesh-vertex.ts`; mesh mutation logic remains in the existing mesh mutation responsibility file; payload schema changes remain in the model edit payload schema file. `check:source` passed.

The operation-contracts design sketch still shows `.min(1)` for `MoveMeshVertexPayloadSchema`, but the final review applies the explicit Undine decision for this domain. A later documentation sync may be useful if this empty-delta precondition behavior becomes permanent contract text.

## Test Adequacy Assessment

Focused tests are adequate for Domain A risk:

- Authoring mutation tests cover stable vertex ID resolution, multi-vertex delta application, bounds recomputation, runtime graph projection, missing mesh/vertex rejection, empty delta, duplicate delta, and no-op rejection.
- Operation handler tests cover registry registration, dry-run clone behavior, commit/log behavior, checked targets, stable per-vertex model diff, missing mesh, missing vertex, duplicate vertex delta, empty delta, no-op, and unsupported `keyformScope`.
- Lifecycle tests cover supported `moveMeshVertex` commit via registry, operation log append, public empty-delta diagnostic, and unchanged unsupported-operation regression using `setRightsMetadata`.
- Schema tests explicitly show `moveMeshVertex` payload parsing accepts empty `vertexDeltas` for handler/precondition diagnostics.

Existing `generateMesh` / `setDrawOrder` / `setRuntimeVisibility` lifecycle coverage is not removed by this domain, and the focused suite plus typecheck/source guard passed per Orch-Sylph verification.

## Remaining Risks / Open Verification Items

- Runtime snapshot vertex hash, dedicated runtime diff, validation evidence, and operation evidence materialization for mesh vertex edits remain Domain B responsibilities.
- Editor workflow/UI/persistence/e2e are intentionally out of Domain A and remain later Wave 17 domains.
- `keyformScope` is intentionally rejected in this wave; keyform-scoped mesh vertex editing remains future scope.
- No blocking user-decision point remains for Domain A.
