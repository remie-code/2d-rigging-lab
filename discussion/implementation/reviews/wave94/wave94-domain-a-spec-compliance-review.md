# Wave94 Domain A Spec Compliance Review

## Verdict: pass

Domain A satisfies the runtime-core nested Warp rest/bind membership semantics required by the Wave94 plan. No blocking spec-compliance issues were found.

## Evidence Reviewed

- Source of truth: `discussion/implementation/orchestration/wave94-plan.md`
- Basis docs:
  - `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
  - `discussion/design/module-contracts/runtime-core-contract.md`
  - `discussion/design/module-contracts/fixtures-and-contract-tests.md`
  - `discussion/design/module-contracts/validator-contract.md`
  - `discussion/design/module-contracts/traceability-matrix.md`
- Implementation report: `discussion/implementation/waves/wave94/wave94-domain-a-runtime-core-nested-warp-rest-bind-semantics-report.md`
- Reviewed source/tests:
  - `packages/runtime-core/src/snapshot.ts`
  - `packages/runtime-core/src/rig-control-evaluation.ts`
  - `packages/runtime-core/src/rig-control-warp-lattice.ts`
  - `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
  - `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
- Scoped status/diff checks for runtime-core Domain A files and forbidden package/export/dependency areas.

## Spec Compliance Findings

- Pass: `snapshot.ts` derives `referenceVerticesByDrawableId` from `NormalizedRuntimeGraph.drawables` before mesh keyform deformation, while rig evaluation receives keyform-mutated drawable vertices as current vertices.
- Pass: `rig-control-evaluation.ts` carries both `currentVertices` and `referenceVertices` through the rig effect chain.
- Pass: `rig-control-warp-lattice.ts` uses `referenceVertices[index]` for parent Warp inside/domain membership.
- Pass: `rig-control-warp-lattice.ts` uses `referenceVertex` to compute normalized lattice coordinates and bilinear sampling weights.
- Pass: Warp displacement is added to `currentVertex`, so parent Warp displacement applies on top of child-deformed current vertices.
- Pass: Child-first effect order is preserved: the effect chain starts at the direct child rig control and walks upward to ancestors before reducing effects over the current vertex stream.
- Pass: Rest/reference outside parent domain remains outside even when child Warp moves the current vertex inside; covered by `keeps a rest-outside vertex outside the parent warp even when child warp moves current inside`.
- Pass: Current outside parent visual domain is not warning/needs_review by itself; the positive nested test asserts no `rigControl_evaluation` diagnostics when child Warp moves current outside and parent still applies.
- Pass: No persisted per-vertex binding was introduced. Binding is derived from base/rest drawable vertices during snapshot evaluation.
- Pass: No package-format schema, contracts source, apps/editor, renderer, package manifest, or lockfile changes were observed in scoped status for Domain A review.
- Pass: Runtime/Canvas parity was not evaluated in Domain A. This remains Domain B scope and Domain A did not make parity impossible.

## Blocking Issues

None.

## Non-blocking Risks / Deferred Items

- `rigControl.warpBindingOutsideDomain` validator warning is not implemented in Domain A. This is consistent with the plan's allowance to prioritize runtime semantics and defer diagnostics when narrow implementation is not practical.
- Canvas preview parity is deferred to Domain B. Domain A did not export a new Canvas reuse helper.
- `evaluateRigControlHierarchy` now requires `referenceVerticesByDrawableId` and is re-exported by `packages/runtime-core/src/index.ts`; no in-repo call sites outside `snapshot.ts` were found. I do not classify this as Runtime Export format drift for this spec lane, but the design/development review may decide whether this helper should remain public.

## Tests Considered

- Gnome-reported focused runtime command: `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts` passed, 3 files / 22 tests.
- Gnome-reported `pnpm.cmd typecheck` passed.
- Gnome-reported `node scripts/check-source-organization.mjs` passed.
- Gnome-reported scoped `git diff --check` passed.
- Reviewed test source covers:
  - rest-inside/current-outside positive nested Warp case;
  - rest-outside/current-inside negative case;
  - nonuniform parent Warp sampling from rest/reference coordinates;
  - reference/current vertex count mismatch fallback;
  - updated hierarchy evidence for ancestor Warp plus descendant Rotation.

Reviewer did not rerun tests in this read-only review lane.
