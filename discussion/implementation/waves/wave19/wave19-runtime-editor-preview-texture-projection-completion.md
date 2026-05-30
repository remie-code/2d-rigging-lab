# Wave19 Domain B Completion: Runtime / Editor Preview Texture Projection

- Status: pass
- Target: `wave19-runtime-editor-preview-texture-projection`
- Wave: 19 / `texture-backed-preview-and-part-mapping-foundation`
- Date: 2026-05-30
- Orch-Sylph role: orchestration only; no source implementation edits
- Gnome implementation agent: `019e7922-fb7a-7b73-92b2-69ceb9e43930` (`Gnome the 38th`)
- Gnome context id: not separately exposed by the child; parent-recorded multi-agent id is `019e7922-fb7a-7b73-92b2-69ceb9e43930`
- Review-Sylph agent/context id: `019e792f-a4de-7d00-b807-383c2a7edb91` (`Sylph the 42nd`)
- Review artifact: [../../reviews/wave19/wave19-runtime-editor-preview-texture-projection-review.md](../../reviews/wave19/wave19-runtime-editor-preview-texture-projection-review.md)

## Verdict

`pass`.

Domain B now exposes texture projection metadata through runtime snapshots and editor-preview DTOs without claiming actual bitmap rendering. Missing and not-materialized texture states are explicit, and focused runtime/editor-preview verification plus independent review passed.

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`

## Files Changed

Source and tests:

- `packages/runtime-core/src/texture-projection.ts`
- `packages/runtime-core/src/texture-projection.test.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/index.ts`
- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `apps/editor/src/editor-preview/preview-projection.test.ts`

Reports:

- `discussion/implementation/reviews/wave19/wave19-runtime-editor-preview-texture-projection-review.md`
- `discussion/implementation/waves/wave19/wave19-runtime-editor-preview-texture-projection-completion.md`

## Implementation Summary

- Added a runtime texture projection boundary in `packages/runtime-core/src/texture-projection.ts`.
- Extended `NormalizedDrawable` and evaluated runtime drawable DTOs with optional texture projection metadata.
- Supported `textureId`, `sourceAssetId`, `sourceLayerId`, explicit status values, and `uv` or `bounds_fit` projection hints.
- Kept texture truthfulness conservative: a texture ID without explicit materialized status is `not_materialized`; missing texture IDs are `missing`; `resolved` is only retained when a texture ID is present.
- Preserved snapshot detail behavior: full snapshots may include vertices and UV coordinates; non-full snapshots omit vertices and UV coordinate arrays while retaining UV count.
- Reconciled mesh keyform vertex-count changes by falling back incompatible UV projections to `bounds_fit`.
- Extended editor-preview projection DTOs so every preview drawable exposes texture state, with legacy/no-texture runtime drawables projected as `not_materialized + bounds_fit`.
- `packages/runtime-core/src/index.ts` changed only by adding a barrel re-export.

## Pass Evidence

- Evaluated runtime drawables can carry texture references, source references, and projection hints.
- Editor preview drawables can carry the same texture state without depending on UI rendering.
- Existing generated/legacy drawables remain backward compatible because runtime texture metadata is optional and editor preview supplies an explicit `not_materialized` fallback.
- Missing and not-materialized texture states are explicit DTO states and are not represented as solid-fill texture success.
- Full-detail runtime snapshots can include mesh vertices and matching UV coordinates; stale UVs after vertex-count changes fall back to bounds-fit.
- Runtime-core does not read package texture atlas or package file sets directly.

## Verification

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/texture-projection.test.ts apps/editor/src/editor-preview/preview-projection.test.ts` | pass after sandbox escalation | Sandbox run failed with `node_modules` EPERM. Escalated rerun passed: 2 files / 9 tests. |
| `pnpm.cmd typecheck` | pass after sandbox escalation | Sandbox run failed with TypeScript `node_modules` EPERM. Escalated rerun passed root and editor typecheck. |
| `git diff --check -- packages/runtime-core/src apps/editor/src/editor-preview` | pass | CRLF warnings only; no whitespace errors. |

## Review

Independent Review-Sylph review passed.

- Review-Sylph agent/context id: `019e792f-a4de-7d00-b807-383c2a7edb91` (`Sylph the 42nd`)
- Review report: [../../reviews/wave19/wave19-runtime-editor-preview-texture-projection-review.md](../../reviews/wave19/wave19-runtime-editor-preview-texture-projection-review.md)
- Blocking findings: none
- Required fixes: none

Review-Sylph confirmed:

- Domain B source changes stayed within allowed scope.
- `index.ts` remains barrel-only.
- Runtime-core does not cross the package texture atlas/file-set boundary.
- DTOs distinguish `missing` and `not_materialized` texture state.
- Focused test coverage is adequate for the domain risk.

## Orchestration Compliance

- Source implementation was delegated to Gnome `019e7922-fb7a-7b73-92b2-69ceb9e43930`.
- Independent review was delegated to separate Review-Sylph `019e792f-a4de-7d00-b807-383c2a7edb91`.
- Orch-Sylph did not edit source implementation files.
- Orch-Sylph edited only `discussion/implementation/**` artifacts.
- Review-Sylph was grounded in basis docs, actual diff/source reads, and verification evidence, not only the implementation summary.

## Remaining Risks

- Domain B provides the runtime/editor DTO surface only. Package/authoring adapters still need a later domain to populate `NormalizedDrawable.texture` from package drawable texture IDs, source-layer relation, and mesh UVs.
- Actual bitmap decode, WebGL/canvas rendering, SVG texture rendering, and editor UI visual integration remain later-domain scope.
- Texture-level diagnostics are present in the runtime texture DTO shape, but editor preview summary aggregation currently relies on drawable/snapshot diagnostics plus explicit texture status. Domain F should decide whether unresolved texture states need additional UI summary diagnostics.

## User-Decision Points

None.

