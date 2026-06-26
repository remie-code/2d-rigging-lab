# Wave17 Domain A Design / Development Compliance Review

Verdict: pass

## Reviewed Basis And Files

- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `git diff -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/index.ts`
- `packages/runtime-core/src/dependency-boundary.test.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-static-templates.ts`

## Findings

No blocking design/development findings.

The implementation adds an instance-level renderer-facing API shell without changing the existing public snapshot APIs. The current Domain A implementation intentionally derives render-frame output by forcing a full-detail snapshot internally in `RuntimeModelInstance#evaluateRenderFrame(...)`; this is acceptable for the Domain A API shell under the Wave17 plan, but must remain a Domain B target rather than being treated as the completed fast path.

## Design / Development Checklist

- Pass: API is additive and follows the Wave16 compiled evaluator shape. `RuntimeModelInstance#evaluateRenderFrame(...)` is added in `packages/runtime-core/src/runtime-model.ts:43`, with renderer-facing result types at `packages/runtime-core/src/runtime-model.ts:69`.
- Pass: `evaluateFrame(...)` public behavior remains unchanged. The diff only adds the new instance method and helper conversion around the existing `evaluateFrame(...)` path.
- Pass: `evaluateRuntimeFrame(...)` public behavior and result shape remain unchanged. `packages/runtime-core/src/runtime-core.ts` adds type imports/exports only around the public runtime-core surface.
- Pass: render-frame result is renderer-facing dynamic data, not a Runtime Export/package-format DTO. The shape is `frame.drawables[]`, `nextState`, and optional `profile`, with drawable `drawableId`, `index`, `vertices`, `opacity`, `drawOrder`, and `visible`.
- Pass: runtime-core boundary remains intact for this diff. No changed file imports `@private-2d-rigging-lab/package-format` or other forbidden downstream packages; `packages/runtime-core/src/dependency-boundary.test.ts:12` still covers the package import boundary.
- Pass: new output does not expose a shared mutable output object across calls. `createRuntimeRenderFrame(...)` maps into a new frame object at `packages/runtime-core/src/runtime-model.ts:239`, and `cloneRuntimeRenderVertices(...)` clones vertex arrays at `packages/runtime-core/src/runtime-model.ts:267`.
- Pass: previous public snapshots are not put at risk by the shell. The added test asserts the previous snapshot remains equal after render-frame evaluation and that render-frame vertices are not the same reference as public snapshot vertices at `packages/runtime-core/src/runtime-core.test.ts:575` and `packages/runtime-core/src/runtime-core.test.ts:634`.
- Pass: forcing full-detail snapshot internally is scoped to the render-frame shell. `evaluateRenderFrame(...)` overrides `snapshotDetail: "full"` at `packages/runtime-core/src/runtime-model.ts:173`, while the added test confirms a direct public `evaluateRuntimeFrame(...)` call still defaults to summary output at `packages/runtime-core/src/runtime-core.test.ts:544`.
- Pass: no source scope creep was found in the Domain A diff. `git diff --name-only` for the reviewed scope reports only the three expected runtime-core files.
- Pass: type-only exports are available through the runtime-core surface. `packages/runtime-core/src/runtime-core.ts:48` exports the new render-frame types, and `packages/runtime-core/src/index.ts:16` re-exports `runtime-core.js`.

## Verification Considered / Run

- Considered Gnome evidence:
  - `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts` passed after escalated rerun: 2 files / 12 tests.
  - `pnpm.cmd typecheck` passed.
  - `git diff --check -- packages/runtime-core/src/runtime-model.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts` passed with CRLF warning only.
- Independently inspected the exact source diff for the three changed files.
- Independently ran `git diff --name-only`, `git diff --stat`, and `git diff --check` for the reviewed files.
- Independently searched the changed files for forbidden package-format/downstream imports; no matches were found.
- Independently inspected export and boundary files listed in the assignment.

## Residual Risks / Domain B Notes

- Domain A is an API shell, not the completed fast path. The current implementation still materializes a full public snapshot internally before converting it to render-frame data.
- Domain B must replace or bypass public snapshot DTO materialization for the render-frame path while preserving parity for dynamics, keyforms, deformers, clipping, variants, opacity, draw order, and visibility.
- Domain B should keep the render-frame output target-local and frame-owned, and should not introduce shared mutable output buffers between Native Stage and Browser Source.
- Domain B should add proof that render-frame evaluation does not increment any future public snapshot materialization counter and does not rely on package-format DTOs.
