# Wave19 Domain B Review: Runtime / Editor Preview Texture Projection

- Verdict: pass
- Review-Sylph context id: `019e792f-a4de-7d00-b807-383c2a7edb91` (`CODEX_THREAD_ID`)
- Target: `wave19-runtime-editor-preview-texture-projection`
- Implementation agent: `019e7922-fb7a-7b73-92b2-69ceb9e43930` (`Gnome the 38th`)
- Review date: 2026-05-30

## Basis Used

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
- Actual repository diff and file reads for the Domain B changed files.

## Scope Reviewed

Reviewed diff and source state for:

- `packages/runtime-core/src/texture-projection.ts`
- `packages/runtime-core/src/texture-projection.test.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/index.ts`
- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `apps/editor/src/editor-preview/preview-projection.test.ts`

The workspace also contains concurrent Wave19 changes in Domain A/C paths such as `packages/package-format/**`, `packages/authoring-core/**`, `apps/editor/src/editor-state/**`, `apps/editor/src/ui/source-assets/**`, and discussion maps. Per assignment, I did not treat those as Domain B findings.

## Findings

No blocking findings.

## Pass Evidence

- Runtime-core introduces a cohesive texture projection boundary in `texture-projection.ts`, with explicit statuses `resolved`, `missing`, and `not_materialized`, optional `textureId` / `sourceAssetId` / `sourceLayerId`, and either `bounds_fit` or `uv` projection metadata (`packages/runtime-core/src/texture-projection.ts:14-54`).
- The status logic does not claim materialized texture rendering merely because a texture ID exists. A `textureId` without explicit resolved status becomes `not_materialized`, missing texture IDs become `missing`, and explicit `resolved` is only retained when a texture ID is present (`packages/runtime-core/src/texture-projection.ts:102-115`).
- UV projection is only emitted when UV count matches the runtime vertex count. Full snapshots can carry UV coordinates, while non-full snapshots keep the `uvCount` hint and omit coordinates (`packages/runtime-core/src/texture-projection.ts:118-132`, `packages/runtime-core/src/snapshot.ts:277-386`).
- Runtime drawables now accept optional texture projection metadata on the normalized graph and evaluated snapshot DTOs without requiring package-format reads inside runtime-core (`packages/runtime-core/src/normalized-runtime-graph.ts:77-80`, `packages/runtime-core/src/snapshot.ts:58-72`, `packages/runtime-core/src/snapshot.ts:286-297`).
- Mesh keyform vertex-count changes reconcile stale UV projection to `bounds_fit`, avoiding a full-detail snapshot that pairs a changed vertex count with an incompatible UV coordinate list (`packages/runtime-core/src/keyform-target-application.ts:300-321`).
- Editor preview DTOs now always expose a `texture` state for each preview drawable, and legacy/evaluated drawables without runtime texture metadata are projected as `not_materialized` with `bounds_fit` rather than being confused with actual texture rendering (`apps/editor/src/editor-preview/preview-dto.ts:37-76`, `apps/editor/src/editor-preview/preview-projection.ts:83-108`).
- Focused runtime tests cover texture refs, missing state, `not_materialized` state, full vs non-full UV coordinate behavior, and vertex-count mismatch fallback (`packages/runtime-core/src/texture-projection.test.ts:18-217`).
- Focused editor-preview tests cover texture reference projection, explicit missing state, and legacy runtime drawables without texture metadata (`apps/editor/src/editor-preview/preview-projection.test.ts:86-118`).
- `index.ts` remains barrel-only: the change is a single re-export of `texture-projection.js` (`packages/runtime-core/src/index.ts:1-17`).

## Verification Considered

- Inspected `git diff -- packages/runtime-core/src apps/editor/src/editor-preview` directly.
- Inspected new untracked Domain B files with line references.
- Ran `git diff --check -- packages/runtime-core/src apps/editor/src/editor-preview`: pass, CRLF warnings only.
- Considered Orch-Sylph verification evidence:
  - `pnpm.cmd exec vitest run packages/runtime-core/src/texture-projection.test.ts apps/editor/src/editor-preview/preview-projection.test.ts`: pass after sandbox EPERM rerun, 2 files / 9 tests.
  - `pnpm.cmd typecheck`: pass after sandbox EPERM rerun.

## Test Adequacy

Focused test coverage is adequate for Domain B. It covers:

- texture references and source references through runtime snapshot and editor preview DTOs,
- missing vs not-materialized states,
- UV and bounds-fit projection hints,
- full vs non-full snapshot detail,
- UV fallback after mesh keyform vertex-count mismatch,
- legacy drawables with no texture metadata.

Non-blocking gaps:

- There is no direct test for an upstream `status: "resolved"` texture reference without `textureId`; implementation currently downgrades that to `missing` (`packages/runtime-core/src/texture-projection.ts:107-113`), which matches the intended truthfulness rule.
- `EvaluatedDrawableTextureDto` has a `diagnostics` field, but editor preview diagnostics currently aggregate snapshot/dynamics/drawable diagnostics, not texture-level diagnostics (`apps/editor/src/editor-preview/preview-projection.ts:31-35`). This is not blocking because the explicit `drawable.texture.status` is the Domain B truthfulness channel, but Domain F should decide whether unresolved texture diagnostics need to appear in UI summary counts.
- The package/authoring `toRuntimeGraph` adapter is outside Domain B scope and still needs a later domain to map package drawable `textureId`, source layer relation, and mesh `uvs` into `NormalizedDrawable.texture`. Domain B provides the runtime/editor DTO surface but does not by itself prove end-to-end package-to-preview texture propagation.

## Source Organization

Pass.

- New runtime logic lives in a named, cohesive `texture-projection.ts`.
- Tests mirror the new runtime texture projection responsibility.
- `apps/editor/src/editor-preview/**` changes are scoped to DTO/projection and focused tests.
- No Domain B implementation source changes were made under forbidden `apps/editor/src/ui/**`, `packages/package-format/**`, or `packages/operation-core/**`.
- `packages/runtime-core/src/index.ts` remains a barrel file only.

## Remaining Risks

- Actual bitmap rendering is intentionally not implemented in Domain B. The DTO is truthful about unresolved/not-materialized textures, but visual texture rendering remains a later Domain F responsibility.
- The current Domain B surface depends on upstream producers supplying `NormalizedDrawable.texture`. Until a later integration domain connects package/source-layer data into that normalized graph field, existing editor preview paths will continue to see legacy drawables as `not_materialized`.

## User-Decision Points

None.
