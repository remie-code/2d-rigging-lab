# Runtime Player Wave3 Domain A Test Adequacy Review

## Verdict

pass

## Scope Reviewed

Target: `runtime-player-wave3-default-pose-evaluation-adapter`

Reviewed target files:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-a-default-pose-evaluation-adapter-report.md`

Basis documents used:

- `discussion/runtime-player/implementation/orchestration/player-wave3-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`

Additional evidence inspected:

- `packages/package-format/src/runtime-export.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/snapshot.ts`

## Findings

No blocking or non-blocking findings requiring source or test changes.

The Loop 2 test changes resolve the prior Loop 1 blocking finding. The adapter test now fully asserts the mapped rotation rig control fields, including `parentId`, child drawable/rig-control ids, `opacityMultiplier`, pivot, rest angle/translation/scale, and `enabled` in `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:144`. It also fully asserts the mapped warp lattice fields, including parent/child ids, `opacityMultiplier`, bind space, domain bounds, lattice size, rest control points, interpolation method, and `enabled` in `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:166`.

The new runtime-core evaluation test proves the adapter path is not just structurally mapped. It starts from Runtime Export rig controls and rig-control keyforms, then asserts sampled keyforms, evaluated snapshot rig controls, opacity multiplier effects, rotation-transformed vertices, and warp-deformed vertices in `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:289`. That closes the previous risk where regressions dropping rig-control fields or preventing rig controls from reaching runtime-core could pass.

## Coverage Assessment

Adapter field coverage is adequate for Domain A:

- Parameters are covered for ids, display metadata, semantic role, preset alias, value source, range, and default at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:80`.
- Dynamics groups are covered for id, display name, input normalization, and output mapping at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:89`.
- Drawables, mesh vertices, atlas UVs, triangles, texture resolution, masks, draw order, texture pages, input manifest, and render resources are covered across `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:114`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:133`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:140`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:192`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:202`, and `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:207`.
- Keyforms are covered by observable evaluation behavior for mesh vertices, opacity, draw order, and rig-control targets in `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:216` and `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:289`.
- The adapter source maps the Runtime Export model fields into `NormalizedRuntimeGraph` in `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:67`, with parameter, dynamics, drawable, rig-control, and keyform mapping split at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:110`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:132`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:157`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:197`, and `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:346`.

Default pose evaluation coverage is adequate. The evaluator uses empty authored parameter values for initial state and evaluation input in `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts:32` and `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts:42`, requests a full snapshot at `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts:48`, and the tests assert default-source parameter resolution, keyform samples, deformed vertices, opacity, draw order, and rest-vs-evaluated vertex differences at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:216`.

Evaluated snapshot to render input mapping is covered for Domain A. The render-input test checks texture bytes, evaluated vertices, opacity, draw order, masks/clipping, atlas UVs, triangles, model bounds, and a clean diagnostic snapshot at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:430`. The mapping source consumes evaluated snapshot vertices/opacities/draw order and render resources in `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:67`, creates clipping from evaluated masks at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:155`, preserves texture bytes at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:117`, and keeps initial model bounds from exported bounds at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:183`.

Forbidden/out-of-scope behavior is acceptable by source inspection. The reviewed files do not import `authoring-core`, do not add iFacialMocap/network input, do not add manual parameter controls, and do not add dynamics time progression.

## Command / Verification Assessment

Gnome-reported verification covers the expected Wave3 Domain A command surface:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`: reported pass.
- Focused Vitest for `runtime-export-default-pose-evaluation.test.ts`: reported pass after fixture expectation fix, 1 file / 4 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test`: reported pass, 7 files / 34 tests.
- `node scripts/check-source-organization.mjs`: reported pass.
- `node scripts/check-dependencies.mjs`: reported pass.
- `git diff --check -- apps/runtime-player/src/stage discussion/runtime-player/implementation/waves/wave3`: reported pass; reviewer reran this whitespace check and it produced no errors.

I did not rerun typecheck or Vitest in this review. The command set itself is adequate for Domain A because it includes package typecheck, focused adapter/evaluation tests, the full Runtime Player unit suite, source organization guard, dependency guard, and whitespace guard. Domain B still needs its own Stage integration/view transform verification.

## Remaining Risks / Gaps

- The `parameter-grid-2d-v1` keyform adapter branch is implemented but not directly exercised by the Domain A test fixture. This is a useful future regression test, but the Wave3 default-pose path is adequately covered for the linear keyform and rig-control behavior required by this domain.
- Multi-texture-page render input remains unexercised because the current Runtime Player payload under review carries one loaded raw texture page. This is not a Domain A blocker, but should remain visible for later integration work.
- Real Runtime Export visual verification remains a later/manual item for default-pose appearance, clipping appearance, and practical texture payload behavior.

## User-Decision Points

None.
