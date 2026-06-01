# Wave 26 Domain E Design / Development Compliance Review

> Wave: Wave 26 `rig-control-keyform-viewer-hardening`  
> Domain: E `wave26-viewer-evidence-e2e-persistence-smoke`  
> Lane: Design / Development Compliance Review  
> Date: 2026-06-01  
> Role: Review-Sylph, clean context  
> Verdict: `pass`

## Scope Reviewed

Reviewed the Domain E scoped diff and changed files:

- `apps/editor/e2e/rig-control-persistence-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`

Basis documents used:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave26-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/implementation/waves/wave26/domain-d-completion-report.md`
- `discussion/implementation/reviews/wave26/wave26-domain-d-design-development-review.md`
- `discussion/implementation/reviews/wave26/wave26-domain-d-test-adequacy-review.md`

The shared worktree contains earlier Wave 26 Domain A-D changes and another Domain E review artifact. This review treats only the two scoped Domain E files above as the Domain E implementation diff.

## Findings

No blocking, high, medium, or low findings.

## Compliance Notes

- Domain E stayed inside its permitted source scope. The scoped diff changes only `apps/editor/e2e/rig-control-persistence-smoke.mjs` and `apps/editor/e2e/test-ids.mjs`; no runtime, operation, validator, broad editor implementation, manifest, or lockfile files are changed by the reviewed Domain E diff.
- The e2e flow now covers create rig control, bind child rig control, bind drawable, add a `rigControl:angleDegrees` keyform, open Viewer / Runtime, set a viewer parameter override, save, load, and reinspect Viewer / Runtime (`apps/editor/e2e/rig-control-persistence-smoke.mjs:24`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:74`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:83`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:95`).
- Viewer evidence assertions remain semantic and runtime-visible rather than pixel-renderer based. They check evaluated rig-control counts, viewer override summary, parent/child local/world angle evidence, affected drawables, runtime diff, and diagnostics (`apps/editor/e2e/rig-control-persistence-smoke.mjs:227`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:231`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:242`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:249`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:252`).
- Persistence evidence is direct and package-level. The smoke reads `model/keyforms.json`, verifies the exact rig-control keyform set, checks `packageRevision: 5`, confirms operation log types include `addKeyform`, and requires generated runtime / validation artifacts (`apps/editor/e2e/rig-control-persistence-smoke.mjs:265`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:273`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:350`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:380`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:405`).
- Save/load reinspection is grounded in browser state, not only storage shape. After load, the smoke checks restored keyform list/evidence, reopens Viewer / Runtime, reapplies the viewer override, and reruns the semantic Viewer assertions (`apps/editor/e2e/rig-control-persistence-smoke.mjs:95`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:198`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:214`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:219`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:98`).
- Negative UX observation is truthful and deterministic within the safe e2e scope. The initial empty state checks no project rig controls, no rotation2d rig control for keyform authoring, no angle keyforms, no preview affected targets, an "open Viewer / Runtime" diagnostic, no committed operation, and disabled bind/keyform buttons (`apps/editor/e2e/rig-control-persistence-smoke.mjs:116`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:119`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:120`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:121`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:124`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:660`).
- The added e2e test IDs are narrow and mirror the editor-side IDs from Domain D. They use machine-readable `rigControl` identifiers with no spaces (`apps/editor/e2e/test-ids.mjs:63`, `apps/editor/e2e/test-ids.mjs:66`, `apps/editor/src/editor-state/editor-test-ids.ts:63`).
- The viewer parameter control test ID helper in e2e matches the editor source helper and existing Viewer smoke pattern (`apps/editor/e2e/test-ids.mjs:112`, `apps/editor/src/editor-state/editor-test-ids.ts:104`, `apps/editor/e2e/viewer-runtime-smoke.mjs:278`, `apps/editor/e2e/rig-control-persistence-smoke.mjs:675`).
- Desktop/mobile smoke is grounded in the existing runner. `pnpm.cmd test:e2e` invokes `scripts/editor-e2e-smoke.mjs`, which iterates `editorSmokeViewports`; those viewports define `desktop` and `mobile`, and `runEditorSmoke` calls `runRigControlPersistenceSmoke` for each viewport (`package.json:12`, `apps/editor/package.json:8`, `scripts/editor-e2e-smoke.mjs:29`, `apps/editor/e2e/smoke-checks.mjs:46`, `apps/editor/e2e/smoke-checks.mjs:54`, `apps/editor/e2e/smoke-checks.mjs:161`).
- Forbidden-scope scan found no references in the Domain E changed files to Cubism compatibility, pixel or full renderer oracle, WebGL/canvas rendering, file picker, archive, parser, image decode, warp lattice evaluator, or physics claims.
- Source organization policy is respected for this lane: no `index.ts` change, no new production source file, no catch-all source file, and `check:source` passed.
- Dependency policy is respected: no manifest or lockfile diff was present, and `check:deps` passed.

## Verification Performed

| Check | Result |
|---|---|
| `git diff -- apps/editor/e2e/rig-control-persistence-smoke.mjs apps/editor/e2e/test-ids.mjs` | reviewed |
| `git diff --name-status -- apps/editor/e2e/rig-control-persistence-smoke.mjs apps/editor/e2e/test-ids.mjs` | only the two scoped Domain E files changed |
| `git diff --name-only -- apps/editor/e2e apps/editor/src/ui/viewer-runtime apps/editor/src/editor-state/viewer-runtime-*` | only the two scoped e2e files changed |
| `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/authoring-core/package.json packages/operation-core/package.json packages/runtime-core/package.json packages/validator-core/package.json` | no output |
| `node --check apps/editor/e2e/rig-control-persistence-smoke.mjs` | pass |
| `node --check apps/editor/e2e/test-ids.mjs` | pass |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass; source organization guard passed |
| `pnpm.cmd run check:deps` | pass; dependency guard passed |
| `git diff --check -- apps/editor/e2e` | pass; LF/CRLF working-copy warnings only |
| `pnpm.cmd test:e2e` | pass; desktop smoke passed and mobile smoke passed |
| `rg` forbidden-scope scan over the two changed files | no matches |

## Remaining Issues

No Domain E design/development compliance issues remain.

## Escalation Triggers

None. The reviewed diff does not require runtime/operation/validator broad fixes, external dependency approval, manifest or lockfile changes, a full renderer / pixel oracle, Cubism compatibility, asset I/O, parser, image decode, archive work, or a user design decision.

## User Decision Points

None.
