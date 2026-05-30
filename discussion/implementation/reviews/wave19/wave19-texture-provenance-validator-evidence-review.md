# Wave19 Domain E Review: Texture Provenance Validator Evidence

- Verdict: pass
- Review-Sylph context id: `019e7947-3b90-7b41-b2b9-3300c76ca5e2` (`Sylph the 45th`)
- Target: `wave19-texture-provenance-validator-evidence`
- Implementation agent: `019e793b-4a58-78d0-b25d-bd49d515c425` (`Gnome the 44th`)
- Review date: 2026-05-30

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave19-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave18/wave18-final-report.md`
- `discussion/implementation/waves/wave19/wave19-texture-asset-package-authoring-foundation-completion.md`
- `discussion/implementation/waves/wave19/wave19-runtime-editor-preview-texture-projection-completion.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- Actual repository diff and file reads for Domain E changed files.

## Scope Reviewed

Reviewed diff and source state for:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/source-asset-rights-provenance.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/validators/texture-assets.ts`
- `fixtures/contracts/source-asset-rights-provenance-validator/source-package.cleared.json`
- `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json`
- `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts`

Workspace contains concurrent Wave19 changes outside Domain E, including operation handler/payload files and editor/runtime/package changes. Per assignment, these were ignored except where the focused evidence regression intersected Domain E diagnostics.

## Findings

No blocking findings remain.

Initial review found one high issue: the existing imported-source evidence test still expected `finalValidationReport.checks` to be empty for a metadata-only texture fixture. After the fix loop, the test now expects one structured `ref.texturePreviewMissing` diagnostic, which resolves the finding inside the allowed `packages/operation-core/src/*evidence*.test.ts` scope.

## Pass Evidence

- `packages/validator-core/src/validators/texture-assets.ts` adds a focused texture asset reference validator for texture atlas entries, preview assets, visible drawable preview payloads, source-layer consistency, and texture rights/provenance consistency.
- `packages/validator-core/src/validators/package-runtime.ts` wires texture asset validation into package runtime validation without changing runtime renderer or operation semantics.
- `packages/validator-core/src/check-catalog.ts` registers AI-readable check IDs for missing preview payload, source-layer mismatch, texture provenance missing, and texture provenance mismatch.
- `packages/validator-core/src/source-asset-rights-provenance.test.ts` covers valid cleared texture-backed source, missing preview payload, missing atlas through existing drawable texture diagnostic, source-layer mismatch, and texture rights/provenance mismatch.
- `fixtures/contracts/source-asset-rights-provenance-validator/source-package.cleared.json` now contains compact texture atlas / preview asset / texture rights / texture provenance metadata for a split PNG source layer.
- `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts` now treats old metadata-only texture evidence as a structured `ref.texturePreviewMissing` failure instead of a pass, preserving Wave18 diagnostic truthfulness.
- `packages/validator-core/src/index.ts` is export-only.

## Verification Considered

Review-Sylph considered and/or reran:

- `pnpm.cmd exec vitest run packages/validator-core/src`: pass after sandbox EPERM rerun, 5 files / 28 tests.
- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/package-format/src/package-file-set.test.ts packages/package-format/src/source-asset-rights-fixture.test.ts`: pass, 3 files / 16 tests.
- Before the fix loop, `pnpm.cmd exec vitest run packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts`: failed because `ref.texturePreviewMissing` replaced the old empty-check expectation.
- After the fix loop, `pnpm.cmd exec vitest run packages/validator-core/src/source-asset-rights-provenance.test.ts packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts`: pass, 2 files / 15 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/validator-core/src fixtures/contracts/source-asset-rights-provenance-validator packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts`: pass with CRLF warnings only.

## Test Adequacy

Focused coverage is adequate for Domain E.

It covers the required compact fixture cases:

- valid texture-backed source package pass,
- missing texture preview payload,
- missing atlas / missing drawable texture reference,
- source-layer mismatch,
- rights/provenance mismatch,
- Wave18 metadata-only operation evidence remains observable as a missing-preview diagnostic.

The implemented `rights.textureProvenanceMissing` branch is not directly fixture-tested. This is a non-blocking follow-up because the required Domain E evidence explicitly called for rights/provenance mismatch, and the check is catalog-registered for future hardening.

## Source Organization

Pass.

- New validator logic lives in a named, cohesive `texture-assets.ts`.
- `index.ts` change is barrel-only.
- The operation-core change is limited to the allowed focused evidence regression test.
- No Domain E changes were made to editor UI implementation, runtime renderer implementation, operation handlers, or broad package schema redesign.

## Remaining Risks / Open Items

- Later Domain D/F/G integration may decide to materialize preview assets for the imported-source workflow so that the operation evidence fixture returns to validation pass. Domain E correctly records the current metadata-only state as missing preview payload.
- Concurrent out-of-scope operation-core changes remain in the shared worktree and require their own domain review.

## User-Decision Points

None.
