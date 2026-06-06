# Wave48 Domain B Report: Browser PSD Import Plan Candidate Service

> Target: `wave48-browser-psd-import-plan-candidate-service`
> Role: Orch-Sylph domain completion report
> Verdict: `pass`

## Verdict

`pass`

Wave48 Domain B is complete within the approved Editor/browser PSD parser adapter boundary. Source implementation was delegated to Gnome, and independent Review-Sylph review was run in a separate context. The first review found one scope-validation issue; Gnome fixed it with a bounded source/test patch, and Review-Sylph re-review returned `pass`.

This domain adds a parser-free browser PSD import plan candidate service and compact workflow-state projection helper. It does not implement broad UI workflow, package/operation import-plan persistence, validator/Product Preflight diagnostics, all-layer one-click import, recursive group auto import, drag-drop, archive/filesystem behavior, full compositing, renderer/pixel oracle, Cubism compatibility claims, public demo asset claims, or repo-side AI/LLM/auto-fix behavior.

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave48-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-review.md`
- `discussion/implementation/waves/wave47/wave47-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave47/wave47-domain-h-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Files Changed

Domain B source/test files:

- `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-result.ts`
- `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.ts`
- `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.test.ts`
- `apps/editor/src/editor-state/explicit-psd-import-plan-state.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-state/index.ts`

Domain B reports/reviews:

- `discussion/implementation/waves/wave48/wave48-domain-b-browser-psd-import-plan-candidate-service-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-b-browser-psd-import-plan-candidate-service-review.md`

Current worktree note: parallel Wave48 Domain C `packages/**` changes and Domain C report/review artifacts are present in the same worktree. They were treated as out-of-scope for this Domain B verdict.

## Implementation Summary

- Added `createBrowserPsdImportPlanCandidatePlan` for parser-free candidate-plan generation from existing browser PSD parser session evidence.
- Supports explicit scopes `psd:root` and validated group refs of the form `psd:root/group[index](/group[index])*`.
- Rejects leaf refs, malformed group-like refs, and unknown group refs deterministically instead of returning empty ready plans.
- Walks the selected root/group scope recursively into leaf candidates and keeps groups as parent context only.
- Preserves layer refs, full paths, display names, bounds, visibility, opacity, source order, parent group context, role, unsupported feature IDs, generated scaffold preview IDs, and raw RGBA byte estimates.
- Represents statuses including `candidate`, `hidden`, `unsupported`, `emptyZeroSize`, `duplicateRef`, `duplicateName`, `generatedIdCollision`, `generatedNameCollision`, `byteCapBlocked`, and `notApproved`.
- Keeps default execution explicit: candidates default to `notApproved`; approval is by explicit leaf refs only.
- Applies Domain A caps: source parse `32 MiB`, candidate enumeration `200`, per-leaf raw RGBA `64 MiB`, approved count `4`, and approved total raw RGBA `32 MiB`.
- Produces a stable SHA-256 candidate plan digest over canonical parser-free candidate-plan JSON before mutable approval selection is applied.
- Adds `projectExplicitPsdImportPlanState` as a compact state projection helper for later Domain D UI work.
- Keeps `index.ts` changes barrel-only.

## Review Summary

Review report: `discussion/implementation/reviews/wave48/wave48-domain-b-browser-psd-import-plan-candidate-service-review.md`

Initial Review-Sylph verdict: `needs_fix`.

- B-F1: `resolveScope` accepted leaf or malformed `psd:root/group[...]...` strings as group scopes and could produce ready empty plans.
- B-T1: focused tests lacked invalid-scope regression coverage.

Bounded Gnome fix:

- Added exact group segment/ref pattern validation.
- Checked well-formed group refs against parser-session evidence-derived known group refs.
- Added regression coverage for leaf refs, malformed group-like refs, and unknown group refs.

Final Review-Sylph re-review verdict: `pass`.

- B-F1 resolved.
- B-T1 resolved.
- No new findings.

## Verification Performed

Run by Orch-Sylph after implementation / fix:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.test.ts`
  - Pass after escalation because sandbox Vitest startup hit esbuild `spawn EPERM`.
  - Final result: 6 tests passed.
- `pnpm.cmd test:unit`
  - Pass after escalation because sandbox Vitest startup hit esbuild `spawn EPERM`.
  - Final result: 239 files / 1225 tests passed.
- `pnpm.cmd typecheck`
  - Pass.
- `node scripts/check-psd-parser-import-boundary.mjs`
  - Pass; 5 direct import/resolve sites remain limited to the approved adapter and Wave44 scripts.
- `pnpm.cmd run check:source`
  - Pass.
- `pnpm.cmd run check:deps`
  - Pass.
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave48 discussion/implementation/reviews/wave48`
  - Pass with LF-to-CRLF working-copy warnings only.

Run by Review-Sylph:

- Direct source/test inspection of Domain B files.
- Parser import boundary guard: pass.
- Diff whitespace check over Domain B source/review scope: pass with LF-to-CRLF warnings only.
- Re-review forbidden-scope search over Domain B files: no direct parser import, validator/Product Preflight implementation, persistence storage, materialization execution, or package operation bridge found.

## Remaining Issues

None blocking for Domain B.

Notes for later domains:

- Candidate plan diagnostics are local session candidate-plan notes, not validator/Product Preflight formal diagnostics.
- This domain accepts optional `sourceDigest` when supplied, but existing browser parse session evidence does not compute source PSD digest without bytes. Digest/evidence bridging remains for later package/operation domains.
- Domain D still owns UI workflow and explicit approval UX.
- Domain C owns parser-free package/operation import-plan approval evidence; its parallel changes are outside this Domain B verdict.

## User-Decision Points

None required for Domain B pass.

Future decisions remain outside this domain:

- Raising candidate enumeration, approved count, or approved byte caps.
- Allowing explicit hidden layer materialization.
- Moving from root/group candidate preview plus explicit leaf approval to all-layer import or recursive group import.
- Public/demo use of sample-derived visual assets.

## Provisional Assumptions

- Wave47 final pass is the implementation-proven baseline.
- Wave48 Domain A `psd:root` target, status vocabulary, evidence requirements, and conservative caps are authoritative for this domain.
- Candidate plan digest covers candidate-plan identity and not mutable approval selection.
- Parallel Domain C `packages/**` work is independent and not required for this Domain B pass.
