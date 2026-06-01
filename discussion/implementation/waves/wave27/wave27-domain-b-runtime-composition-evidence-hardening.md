# Wave 27 Domain B Completion: Runtime Composition Evidence Hardening

> Target: `wave27-runtime-composition-evidence-hardening`
> Wave: Wave 27 `mask-clipping-opacity-authoring-v1`
> Orchestrator: Orch-Sylph
> Verdict: `pass`

## Summary

Domain B is complete and implementation-proven for runtime composition evidence.

Runtime-core now records mask relations as deterministic semantic clipping intent in runtime snapshots, runtime diffs, runtime evidence, and Viewer evidence. The implementation does not create pixel clipping output, renderer behavior, image decode, bitmap masking, SVG/canvas/WebGL oracle, or compatibility claims.

Opacity remains traceable through existing keyform/runtime drawable state behavior and is now surfaced as Viewer evidence basis alongside drawable runtime state changes.

## Subagents Used

- Gnome implementation: `Gnome the 86th` / `019e818c-ca35-7a91-b3ad-fe70ef569255`
- Review-Sylph independent review: `Sylph the 87th` / `019e819c-084e-7b23-919c-363e5b86cfa1`

Separation evidence:

- Orch-Sylph did not implement source directly.
- Source implementation was delegated to Gnome with write scope limited to `packages/runtime-core/src/**`, runtime focused tests, and Wave 27 report/review folders.
- Review was delegated to a separate Review-Sylph clean context with basis docs, changed files/diff, verification commands, and review lanes.
- Review-Sylph did not edit source; it wrote only the review artifact.

## Files Changed

Domain B source and tests:

- `packages/runtime-core/src/mask-relation-evidence.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/runtime-evidence.test.ts`
- `packages/runtime-core/src/snapshot-comparison.test.ts`
- `packages/runtime-core/src/viewer-evaluation.test.ts`

Domain B reports:

- `discussion/implementation/waves/wave27/wave27-domain-b-runtime-composition-evidence-hardening.md`
- `discussion/implementation/reviews/wave27/wave27-domain-b-runtime-composition-evidence-hardening-review.md`

## Evidence Implemented

- Runtime snapshots list enabled mask relations deterministically by `maskRelationId`.
- Mask relation snapshot entries include `sourceDrawableIds`, `targetDrawableIds`, `enabled: true`, `clippingIntent: "semanticClipping"`, and `resolved`.
- Runtime diffs expose mask relation additions, removals, source/target changes, and resolved-state changes through stable `/masks/{maskRelationId}` paths.
- Disabled authoring mask relations remain omitted from runtime evidence because the normalized runtime graph contains only enabled relations; runtime does not invent disabled evidence.
- Viewer evidence exposes sorted `maskRelationEvidence`, `drawableOpacityEvidence`, and `drawableRuntimeStateChanges`.
- Opacity keyform/runtime drawable state evidence remains compatible with existing keyform, rig-control, dynamics, and Viewer runtime tests.

## Verification

Gnome reported:

- `pnpm.cmd exec vitest run packages/runtime-core/src`: pass, 25 files / 79 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/runtime-core/src`: pass with CRLF warnings only.

Review-Sylph independently reported:

- `pnpm.cmd exec vitest run packages/runtime-core/src`: pass, 25 files / 79 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/runtime-core/src`: pass with CRLF warnings only.
- New `mask-relation-evidence.ts` trailing whitespace check: no matches.

Orch-Sylph additionally reran:

- `pnpm.cmd exec vitest run packages/runtime-core/src`: pass, 25 files / 79 tests.

## Review Result

Review-Sylph verdict: `pass`.

Findings:

- No blocking, high, medium, or low findings.
- Non-blocking note: the disabled-relation non-containment assertion in `runtime-evidence.test.ts` is somewhat indirect because the disabled relation is not included in the runtime graph fixture. This does not block Domain B because enabled filtering is an authoring-to-runtime adapter responsibility, and Domain B runtime evidence requirements are covered.

Review report:

- `discussion/implementation/reviews/wave27/wave27-domain-b-runtime-composition-evidence-hardening-review.md`

## Non-goals Containment

No changes were made for:

- Operation handler implementation.
- Validator broad implementation.
- Editor UI implementation.
- Pixel renderer, SVG clipping oracle, WebGL/canvas renderer, bitmap masking, or image decode.
- External dependency, package manifest, or lockfile changes.
- `index.ts` implementation logic.

## Remaining Issues

No Domain B source fix is required.

No user-decision points are open for Domain B. Any later request for actual visual clipping or pixel output would be new scope outside Wave 27 Domain B.
