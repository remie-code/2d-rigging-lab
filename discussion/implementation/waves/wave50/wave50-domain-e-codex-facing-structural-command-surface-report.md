# Wave50 Domain E Report: Codex-Facing Structural Command Surface

> Target: `explicit-psd-subtree-hierarchy-scaffold-v0`
> Role: Undine root recovery after interrupted Domain E review handoff
> Domain: E - Codex-facing in-process structural command surface
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Domain E extends the existing AI PSD import-plan command/result surface so Codex-facing in-process reads can see Wave50 structural scaffold state and latest structural operation refs. The original Domain E agent completed implementation and verification but was interrupted before report/review handoff, so Undine reran verification and recorded this report.

## Implementation Summary

- Extended `AiPsdImportPlanCommandResult` with optional `structuralScaffold` and `latestStructuralScaffold` sections.
- Added structural group part refs and leaf drawable refs with source refs, generated refs, status, and `initialRuntimeVisibility`.
- Added structural operation evidence refs for operation evidence, plan, approval, approval selection digest, generated group parts, generated drawables/textures/meshes, and source group/layer refs.
- Extended the AI PSD import-plan executor to include structural evidence refs for dry-run/commit responses.
- Extended the Editor AI PSD import-plan projector to project current structural plan state and latest structural operation results from Editor state/session evidence.
- Preserved existing leaf-only PSD import-plan commands, approval policy behavior, and fixture regression coverage.

## Scope Note: Structural Stale Rejection

Domain E did not add a new structural-specific command or stale rejection hook. The existing leaf-only `expectedPlan` stale guard remains unchanged. Adding structural-specific execute/stale commands would require Editor workflow/controller command hooks outside Domain E's allowed write scope, so this remains a later-domain or later-wave extension rather than an E implementation defect.

## Files Changed By Domain E

- `packages/ai-interface/src/ai-psd-import-plan-command.ts`
- `packages/ai-interface/src/ai-psd-import-plan-command-executor.ts`
- `packages/ai-interface/src/ai-psd-import-plan-command.test.ts`
- `packages/ai-interface/src/ai-command-schema.test.ts`
- `apps/editor/src/ai-command-host/editor-ai-psd-import-plan-projector.ts`
- `apps/editor/src/ai-command-host/editor-ai-psd-import-plan-projector.test.ts`

## Verification Performed

| Check | Result |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd exec vitest run packages/ai-interface/src/ai-psd-import-plan-command.test.ts packages/ai-interface/src/ai-command-schema.test.ts apps/editor/src/ai-command-host/editor-ai-psd-import-plan-projector.test.ts apps/editor/src/ai-command-host/editor-ai-command-host.test.ts apps/editor/src/ai-command-host/ai-command-fixture-regression.test.ts` | sandbox run failed with esbuild `spawn EPERM`; approved rerun passed 5 files / 31 tests |
| `node scripts/check-psd-parser-import-boundary.mjs` | pass; 5 approved direct import/resolve sites |
| `pnpm.cmd run check:source` | pass |
| `git diff --check -- packages/ai-interface apps/editor/src/ai-command-host discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50` | pass; Git emitted LF/CRLF working-copy warnings only |

## Scope / Boundary Check

- Did not add external transport.
- Did not add repo-side proposal generation, semantic recognition, suggestion UI, auto-rigging, Photoshop compositing, renderer pixel oracle, Cubism compatibility, source PSD byte persistence, or raw parser object persistence.
- Stayed within `packages/ai-interface/src/**` and `apps/editor/src/ai-command-host/**`.

## Residual Risks

- Domain E exposes structural state and latest refs, but it does not provide structural execution commands. The UI/workflow execution path remains Domain D's in-process Editor surface.
- Focused e2e proof that Codex-facing structural refs appear after real PSD structural commit remains for Domain G.

## User-Decision Points

None required for Domain E.
