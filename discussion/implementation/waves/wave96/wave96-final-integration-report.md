# Wave96 Final Integration Report: Viewer Atlas Runtime Performance Cache

## Verdict

Verdict: `pass`.

Wave96 is pass-ready. Domain A implemented the Viewer Atlas Runtime static source cache, all three independent Domain A review lanes passed, and the final clean integration Review-Sylph passed with no required fixes.

## Basis

- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/implementation/orchestration/wave95-plan.md`
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`
- `discussion/implementation/waves/wave95/wave95-final-integration-report.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

## Domain Verdicts

| Domain | Verdict | Evidence |
|---|---|---|
| Domain A: `wave96-viewer-atlas-runtime-static-source-cache` | `pass` | `wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md`; spec, design/development, and test adequacy reviews all passed. |
| Domain B: `wave96-final-integration-clean-review` | `pass` | `../../reviews/wave96/wave96-final-clean-integration-review.md` passed with no required fixes. |

## Files Changed

Source and tests:

- `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`

Wave96 reports and reviews:

- `discussion/implementation/waves/wave96/wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/implementation/waves/wave96/_map.md`
- `discussion/implementation/reviews/wave96/wave96-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave96/wave96-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave96/wave96-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave96/wave96-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave96/_map.md`

Pre-existing orchestration files observed in the working tree and not owned by Domain A implementation:

- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave96-plan.md`

## Integration Summary

- `ViewerRuntimeScreen` now creates one Viewer Atlas Runtime source cache for the screen lifetime and passes it into clean-stage projection creation.
- `createViewerRenderSourceProjection()` accepts an optional cache and uses it only for requested `Atlas Runtime`.
- Cache hit returns the resolved Atlas Runtime source result before target selection, source signature creation, source byte hashing, stale comparison, and placement validation are rerun.
- Cache miss keeps the existing validation path:
  - static atlas page/binary/source validation;
  - `selectTextureAtlasTargets()`;
  - `createTextureAtlasSourceSignature()`;
  - `sameTextureAtlasSourceSignature()`;
  - runtime-eligible missing/invalid placement validation.
- Original mode remains on the existing non-heavy path and does not call Atlas Runtime target/signature hooks.
- Dynamic projection remap remains per-frame and continues to consume the current Canvas projection so keyform, dynamics, visibility, masks, overlays, and current UVs are reflected.

## Verification

Fresh final-integration checks run by Orch-Sylph:

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` | Pass: 2 files / 27 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass: `Source organization guard passed.` |
| `node scripts/check-dependencies.mjs` | Pass: `Dependency guard passed.` |
| `git diff --check` | Pass. LF-to-CRLF working-copy warnings only; no whitespace errors. |

Independent review verification:

- Domain A test adequacy Review-Sylph reran focused Viewer tests, typecheck, source organization, dependency guard, and diff check: pass.
- Domain A design/development Review-Sylph reran focused Viewer tests, typecheck, source organization, dependency guard, and diff check: pass.
- Final clean Review-Sylph reran focused Viewer tests, typecheck, source organization, dependency guard, and diff check: pass.

## Forbidden-Scope Result

Forbidden-scope verdict: `pass`.

Scoped `git diff --name-only` checks were empty for:

- dependency manifests and `pnpm-lock.yaml`;
- `packages/package-format/**`;
- Runtime Export paths;
- Workspace Save paths;
- mesh generation and Wave95 mesh provenance/inspector paths;
- dynamics solver paths;
- `apps/runtime-player/**`;
- texture atlas algorithm, authoring-core atlas internals, canvas renderer, and `packages/render-webgl2/**`.

No Runtime Export format, Workspace Save format, package-format schema, mesh generation, dynamics solver, Runtime Player, texture atlas algorithm, dependency, or lockfile drift was found.

## Review Results

| Review | Verdict | Path |
|---|---|---|
| Domain A Spec Compliance Review | `pass` | `discussion/implementation/reviews/wave96/wave96-domain-a-spec-compliance-review.md` |
| Domain A Design / Development Compliance Review | `pass` | `discussion/implementation/reviews/wave96/wave96-domain-a-design-development-review.md` |
| Domain A Test Adequacy Review | `pass` | `discussion/implementation/reviews/wave96/wave96-domain-a-test-adequacy-review.md` |
| Final Clean Integration Review | `pass` | `discussion/implementation/reviews/wave96/wave96-final-clean-integration-review.md` |

## Residual Risks

- Cache-key creation still traverses lightweight graph/layout/source metadata and serializes a key each Atlas Runtime projection. The removed heavy work is target selection, structured target/source processing, source signature creation, and source byte hashing.
- In-place mutation of an existing source or atlas `Uint8Array` without revision, metadata, object identity, or length change would not invalidate this cache. Current authoring-core treats package-local binary bytes as immutable within a loaded session, so this is accepted for Wave96.
- Projection remap allocation remains similar to the pre-Wave96 path. If Atlas Runtime remains perceptibly heavier, a later wave should profile remap allocation and renderer/mask costs.
- Browser pixel proof and measured frame-time tracing were not run. Focused hook-count tests directly prove the Wave96 bottleneck removal, and browser pixel proof is not a blocker in the plan.

## User-Decision Points

None blocking.
