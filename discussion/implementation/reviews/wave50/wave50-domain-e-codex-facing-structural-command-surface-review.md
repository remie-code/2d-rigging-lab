# Wave50 Domain E Review: Codex-Facing Structural Command Surface

> Target: `explicit-psd-subtree-hierarchy-scaffold-v0`
> Role: Wave50 Domain E clean Review-Sylph recovery by Undine
> Verdict: `pass`
> Reviewed: 2026-06-07

## Verdict

`pass`

No blocking findings. Domain E exposes Wave50 structural scaffold state and latest structural operation refs through the existing AI PSD import-plan result surface, while preserving the old leaf-only PSD import-plan command path.

## Findings

None blocking.

## Compliance Review

- Structural state exposure: pass. `packages/ai-interface/src/ai-psd-import-plan-command.ts` adds `structuralScaffold` and `latestStructuralScaffold` result sections with group part refs, leaf drawable refs, source refs, generated refs, statuses, diagnostics, evidence refs, and `initialRuntimeVisibility`.
- Operation evidence refs: pass. `packages/ai-interface/src/ai-psd-import-plan-command-executor.ts` collects structural operation evidence refs, structural plan/approval refs, approval selection digest ref, generated group/leaf refs, and generated drawable/texture/mesh refs.
- Editor projection: pass. `apps/editor/src/ai-command-host/editor-ai-psd-import-plan-projector.ts` projects current structural plan state from `explicitPsdImport.structuralScaffoldPlan` and latest structural operation results from `psdStructuralScaffoldEvidence`.
- Backward compatibility: pass. Existing leaf-only command schemas and `expectedPlan` stale guard remain in place; focused command-host and fixture regression tests still pass.
- Non-goals: pass. Reviewed production files add no external transport, repo-side proposal generation, semantic recognition/suggestion flow, auto-rigging/deformer/keyform/physics, Photoshop compositing, renderer pixel oracle, Cubism compatibility, raw parser object persistence, or source PSD byte persistence.

## Scope Note

Domain E does not add structural-specific AI execute/stale commands. I do not treat that as a blocker for this domain because the implemented surface is a read/result projection on the existing PSD import-plan command path, and adding new structural execute hooks would require Editor workflow/controller writes outside Domain E's allowed scope. This should remain visible for later integration or a future AI command expansion.

## Test Adequacy Review

Adequate for Domain E.

The focused suite covers:

- schema parsing for structural scaffold command result sections;
- AI PSD import-plan command result exposure of structural plan refs;
- structural operation evidence refs in dry-run responses;
- Editor AI projector projection of current structural plan and latest structural operation result;
- existing AI command-host and fixture regression behavior.

Domain G still needs focused e2e proof that these refs appear after real structural PSD commit.

## Verification Considered

Root-provided verification:

- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd exec vitest run packages/ai-interface/src/ai-psd-import-plan-command.test.ts packages/ai-interface/src/ai-command-schema.test.ts apps/editor/src/ai-command-host/editor-ai-psd-import-plan-projector.test.ts apps/editor/src/ai-command-host/editor-ai-command-host.test.ts apps/editor/src/ai-command-host/ai-command-fixture-regression.test.ts`: sandbox run failed with esbuild `spawn EPERM`; approved rerun passed 5 files / 31 tests.
- `node scripts/check-psd-parser-import-boundary.mjs`: pass, 5 approved direct import/resolve sites.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/ai-interface apps/editor/src/ai-command-host discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50`: pass, LF/CRLF warnings only.

Review-local checks:

- Inspected `ai-psd-import-plan-command.ts`, `ai-psd-import-plan-command-executor.ts`, `editor-ai-psd-import-plan-projector.ts`, and focused tests.
- Ran targeted scans for structural refs, `initialRuntimeVisibility`, evidence refs, stale-guard scope, and forbidden non-goal terminology.

## Review Artifact

- `discussion/implementation/reviews/wave50/wave50-domain-e-codex-facing-structural-command-surface-review.md`

## Remaining Issues / User-Decision Points

No user decision is required for Domain E.
