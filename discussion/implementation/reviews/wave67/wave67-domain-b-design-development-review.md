# Wave67 Domain B Design / Development Compliance Review

> Review-Sylph lane: `wave67-parent-child-deformer-local-space-semantics`

## Verdict

pass for Design / Development Compliance.

No blocking architecture, source-organization, package-boundary, or forbidden-scope findings were found in the Domain B source changes.

Verification caveat: I could not independently reproduce the reported `pnpm.cmd typecheck` pass in the current mixed Wave67 worktree because `tsc` is not present in `node_modules`, and `pnpm.cmd install --frozen-lockfile` is blocked by an unrelated `packages/render-webgl2/package.json` vs `pnpm-lock.yaml` mismatch from Domain A. This should be treated as a final integration verification gap, not as a Domain B design/development source finding.

## Basis Read

- `discussion/implementation/orchestration/wave67-plan.md`
- `discussion/implementation/waves/wave67/wave67-preplan-parent-child-deformer-inventory.md`
- `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md`
- `discussion/design/mesh-rendering/mesh-image-rendering-architecture.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- Relevant source and tests listed in the review request.

## Findings

### Blocking Findings

None.

### Architecture / Module Boundary

Pass.

- Editor geometry evaluation remains in `canvas-evaluation`, not renderer code. Drawable meshes are evaluated before rendering via `createDrawableRigControlChain(...)` and `applyRigControlChainToVertices(...)` in `apps/editor/src/workspace/canvas/canvas-evaluation.ts:235` and `apps/editor/src/workspace/canvas/canvas-evaluation.ts:239`.
- The Domain B semantic change is localized to chain application: the hierarchy chain remains built parent-to-child at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:641`, while geometry application explicitly reverses it through `createLocalSpaceEvaluationChain(...)` at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:669` and `apps/editor/src/workspace/canvas/canvas-evaluation.ts:689`.
- Warp sampling still uses the rig control's own `domainBounds` in `apps/editor/src/workspace/canvas/canvas-evaluation.ts:743`, so the implementation does not enlarge the child domain to hide the bug.
- Overlay/control display uses the same evaluated point path: child warp rest control points are transformed by the evaluated chain in `apps/editor/src/workspace/canvas/canvas-evaluation.ts:493` through `apps/editor/src/workspace/canvas/canvas-evaluation.ts:511`.
- Renderer remains a consumer of evaluated/projection data. No Domain B change puts deformer logic into WebGL2 or Canvas renderer files.

### Runtime / Editor Parity

Pass.

- Runtime implementation was not changed in this Domain B diff, but the existing runtime path already applies drawable effects from the direct child rig control upward to ancestors: `createRigControlEffectChain(...)` pushes the direct rig control and then walks `parentId` in `packages/runtime-core/src/rig-control-evaluation.ts:414` through `packages/runtime-core/src/rig-control-evaluation.ts:438`.
- Runtime then reduces that child-to-parent effect list when transforming vertices in `packages/runtime-core/src/rig-control-evaluation.ts:441` through `packages/runtime-core/src/rig-control-evaluation.ts:467`.
- Runtime warp sampling remains rest-domain based inside the rig control's own `domainBounds` in `packages/runtime-core/src/rig-control-warp-lattice.ts:98` through `packages/runtime-core/src/rig-control-warp-lattice.ts:111`, matching the accepted local-space chain intent.
- New runtime evidence test locks parent-warp + child-warp local-space behavior and deterministic output in `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts:267` through `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts:316`.

### Source Organization

Pass.

- No new catch-all source file, broad `index.ts` implementation, or schema/operation god file was introduced for Domain B.
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts` is already an established evaluation-responsibility file; the actual production diff is small and cohesive.
- Added tests are focused regression coverage in existing responsibility test files: `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:158`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:469`, and `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts:267`.
- `node scripts/check-source-organization.mjs` passed.

### UX-Backed Package Logic

Pass.

- The runtime/editor parity work is justified by accepted Wave67 UX/AC and the preplan inventory: child-local warp offsets must keep local meaning while parent deformers move/warp the child result.
- No new product semantics, semantic recognition, auto-rig behavior, schema redesign, dependency, or public compatibility claim was introduced.
- Public hierarchy reporting remains top-down while evaluation is local-space child-to-parent. This is compatible with current tests and UI expectations but is called out below as a residual interpretation risk.

### Forbidden Scope

Pass.

- No WebGL2 renderer logic was added in Domain B files.
- No Mesh V4, mesh generation, texture, atlas, Rig UI redesign, Deformer Tree UI, child-domain enlargement, or broad schema redesign appears in the Domain B diff.

## Verification

Reproduced:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts` passed outside the sandbox after sandbox-local esbuild child-process spawn failed with `EPERM`.
  - 3 test files passed.
  - 34 tests passed.
- `node scripts/check-source-organization.mjs` passed.
- `git diff --check` exited 0 with CRLF warnings only.

Not reproduced:

- `pnpm.cmd typecheck` failed because `tsc` is not recognized.
- `node_modules/.bin/tsc` and `node_modules/typescript/bin/tsc` are absent in the current workspace.
- `pnpm.cmd install --frozen-lockfile` could not restore dependencies because `packages/render-webgl2/package.json` currently adds `@private-2d-rigging-lab/render-core@workspace:*` without a matching `pnpm-lock.yaml` update. This appears to be a mixed Wave67/Domain A integration state, not a Domain B code issue.

## Residual Risks / Questions For Orch-Sylph

- Public chain IDs remain top-down: `rigControlChainIds` still reports `[parent, child]` from `apps/editor/src/workspace/canvas/canvas-evaluation.ts:290` through `apps/editor/src/workspace/canvas/canvas-evaluation.ts:292`, while actual geometry application is now child-to-parent via `apps/editor/src/workspace/canvas/canvas-evaluation.ts:669` through `apps/editor/src/workspace/canvas/canvas-evaluation.ts:692`. I found no production consumer currently treating `rigControlChainIds` as evaluation order, but future RenderScene/evidence consumers should not infer evaluation order from this field without documentation or a separate field.
- Existing warp control-point editing converts pointer movement directly into canvas-space offset deltas in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:297` through `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:307` and `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:219` through `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:240`. Hit testing/display now use evaluated control points in `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:68` through `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:81`. This is acceptable for the current evaluated-display fix, but parent rotation or non-uniform parent warp may need inverse local-space edit conversion in a later edit-semantics wave.
- Final integration should rerun `pnpm.cmd typecheck` after the Domain A lockfile/dependency state is resolved. This review should not be cited as independently reproducing typecheck.
