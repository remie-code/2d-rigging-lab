# Wave94 Final Clean Integration Review

verdict: pass

## Scope Reviewed

- Source of truth: `discussion/implementation/orchestration/wave94-plan.md`.
- Dependency reports and reviews for Domain A and Domain B.
- Runtime source/tests:
  - `packages/runtime-core/src/snapshot.ts`
  - `packages/runtime-core/src/rig-control-evaluation.ts`
  - `packages/runtime-core/src/rig-control-warp-lattice.ts`
  - `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
  - `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
  - `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
- Editor Canvas source/tests:
  - `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
  - `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- Contract touchpoint:
  - `packages/contracts/src/warp-lattice2d.ts`
- Diff scope for forbidden areas, dependency manifests, and lockfile.

## Basis Documents Used

- `discussion/implementation/waves/wave94/wave94-domain-a-runtime-core-nested-warp-rest-bind-semantics-report.md`
- `discussion/implementation/waves/wave94/wave94-domain-b-editor-canvas-nested-warp-rest-bind-parity-report.md`
- `discussion/implementation/waves/wave94/wave94-domain-b-editor-canvas-nested-warp-rest-bind-parity-gnome-report.md`
- `discussion/implementation/reviews/wave94/wave94-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave94/wave94-domain-b-test-adequacy-review.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/traceability-matrix.md`

## Findings

none

No blocking integration findings were found.

Reviewed implementation evidence:

- Runtime snapshot creation derives reference vertices from normalized drawable base/rest vertices before mesh keyform deformation, then passes those reference vertices beside current vertices into rig-control evaluation.
- Runtime rig evaluation carries `currentVertices` and `referenceVertices` through the effect chain. Rotation/translation affine effects continue to act only on current vertices.
- Runtime Warp membership and bilinear sampling use the reference vertex. The sampled displacement is added to the child-deformed current vertex.
- Runtime mismatch handling is deterministic: missing or length-mismatched reference streams emit `rigControl.referenceVertexStreamMissing` or `rigControl.vertexStreamLengthMismatch` and safely leave drawable geometry unchanged.
- Canvas evaluation now mirrors the dual-stream behavior at the current call site. Warp membership/sampling use `referencePoint`; displacement applies to `currentPoint`.
- Runtime and Canvas tests share matching numeric oracles for rest-inside/current-outside, rest-outside/current-inside, and nonuniform parent Warp sampling.
- Current-outside is not treated as warning/needs_review. Search found no revived `rigControl.childOutsideWarpDomain` implementation; design docs now distinguish current-outside from rest/bind outside-domain diagnostics.
- No persisted per-vertex binding was introduced.

## Verification Performed

Ran:

```text
pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts
```

Result: passed, 4 files / 38 tests.

Ran:

```text
pnpm.cmd typecheck
```

Result: passed.

Ran:

```text
node scripts/check-source-organization.mjs
```

Result: passed.

Ran:

```text
node scripts/check-dependencies.mjs
```

Result: passed.

Ran:

```text
git diff --check
```

Result: passed. Git emitted LF-to-CRLF working-copy warnings only.

Ran:

```text
rg -n "[ \t]+$" discussion/implementation/orchestration/wave94-plan.md discussion/implementation/reviews/wave94 discussion/implementation/waves/wave94 packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts
```

Result: no trailing-whitespace matches.

## Forbidden-Scope Diff Review

No forbidden source drift found.

- No `package.json`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml` diff.
- No dependency or lockfile drift; dependency guard passed.
- No `packages/package-format/**` diff and no package-format schema change.
- No Runtime Export/package document shape change was found. Runtime snapshot/schema files were not reshaped; `snapshot.ts` only derives and passes evaluation-time reference vertices.
- No renderer architecture changes under `packages/render-core/**` or `packages/render-webgl2/**`.
- No texture atlas, runtime-player, dynamics, workspace save, mesh generation, or validator-core source changes were found.
- `packages/contracts/src/warp-lattice2d.ts` changed only a policy comment from current-coordinate pass-through wording to rest-space domain wording; exported literals and schemas are unchanged.
- `evaluateRigControlHierarchy` has an added `referenceVerticesByDrawableId` input and remains exported through the existing runtime-core barrel. Repository search found no in-repo callers beyond `snapshot.ts`; this is an implementation API signature change, not a Runtime Export/package shape change.

Working-tree notes:

- Wave94 design and discussion docs include rest/bind semantic wording updates and map entries. These align with the Wave94 plan and are not in the forbidden implementation areas.
- `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts` is untracked at review time and is required Wave94 test evidence.

## Deferred / Non-blocking Items

- `rigControl.warpBindingOutsideDomain` validator routing remains deferred. This is acceptable for Wave94 because Runtime and Canvas semantic parity is complete, and current-outside is explicitly not a warning/needs_review condition.
- Canvas reference/current mismatch fallback is deterministic pass-through but has no separate focused Canvas test. Current Canvas call sites pass both streams from the same base mesh.
- Canvas mirrors the small Runtime bilinear Warp logic instead of importing a Runtime helper. This is accepted because Domain A did not expose a Canvas-facing helper and direct runtime-core coupling from Editor Canvas would be a separate dependency-boundary decision.
- Overlay/hit-test UX redesign remains out of scope.

## User-Decision Points

none
