# Wave92 Domain B Runtime Export Assembly / Preflight Report

## Verdict Candidate

pass

## Files Changed

- `packages/authoring-core/src/runtime-export-assembly.ts`
  - Runtime Export preflight and assembly API.
  - committed atlas/source-signature freshness checks.
  - atlas page, texture entry, binary ref/bytes, dimensions, byte length, media type, digest, storage-status, placement, and target coverage blockers.
  - raw RGBA Runtime Export file-set construction through Domain A package-format helpers.
- `packages/authoring-core/src/runtime-export-materialization.ts`
  - materialized Runtime Export model/atlas/manifest assembly from `AuthoringSession`.
  - included packable target filtering, atlas texture page refs, atlas-applied mesh UVs, parameters, input manifest, draw order, masks, rig controls, keyforms, Dynamics, render assumptions, and atlas metadata.
- `packages/authoring-core/src/runtime-export-assembly.test.ts`
  - focused Runtime Export assembly/preflight coverage for valid export, hard blockers, target filtering, atlas UVs, masks, Validate warnings, and source/editor/workspace exclusion.
- `packages/authoring-core/src/index.ts`
  - barrel-only export for `runtime-export-assembly.js`.
- `discussion/implementation/reviews/wave92/wave92-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-b-test-adequacy-review.md`

## Verification Run

- `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-assembly.test.ts`
  - pass: 1 file, 12 tests.
  - note: sandboxed Vitest startup hit `spawn EPERM`; approved rerun passed.
- `pnpm.cmd typecheck`
  - pass.
- `node scripts/check-source-organization.mjs`
  - pass.
- `node scripts/check-dependencies.mjs`
  - pass.
- `git diff --check -- packages/authoring-core/src discussion/implementation/waves/wave92 discussion/implementation/reviews/wave92`
  - pass: no whitespace errors.
  - note: Git reported an LF/CRLF warning for `packages/authoring-core/src/index.ts`.
- Additional boundary check:
  - `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-assembly.test.ts packages/authoring-core/src/dependency-boundary.test.ts`
  - Domain B runtime export tests passed.
  - dependency-boundary still fails because of an existing `packages/authoring-core/src/portable-project-bundle.test.ts` runtime-core import. Domain B's initial direct runtime-core type import was removed and no Domain B Runtime Export file now imports runtime-core directly.

## Implementation Summary

- Added `preflightRuntimeExport` and `assembleRuntimeExport`.
- Reused existing atlas target selection and source-signature logic.
- Hard-blocks deterministic Runtime Export failures:
  - no committed atlas.
  - missing source signature.
  - stale atlas.
  - missing atlas page, texture entry, binary ref, or bytes.
  - atlas page dimensions, byte length, media type, digest, or binary storage mismatch.
  - invalid placement data.
  - current packable runtime targets not covered by committed placements.
  - runtime graph/materialization failure.
  - required binary unavailable.
  - included mask target depending on excluded mask source.
- Keeps Validate warning count as a non-blocking Runtime Export warning.
- Excludes Drawable Pool / unbound Drawables without warnings or blockers.
- Produces Runtime Export artifacts and file-set entries:
  - `runtime-export.json`
  - `runtime/model.json`
  - `runtime/atlas.json`
  - `assets/textures/atlas_page_0.raw-rgba`
- Materializes runtime graph output with atlas texture page refs and atlas-applied UVs for included drawables/meshes.
- Includes parameters, input manifest, keyforms, rig controls, Dynamics groups, masks, and draw order needed for included targets.
- Excludes source originals, workspace/editor state, draft/preview/diagnostics payloads, PNG, ZIP, runtime/player, camera/tracker, OBS, and bundle reload behavior.

## Review Results

- Spec Compliance Review: `pass`
  - no blocking or needs-change findings.
  - confirmed directory-only raw RGBA output, current atlas hard-blocks, atlas-applied UVs, target filtering, Validate warning non-blocking behavior, mask handling, and exclusion of source/editor/workspace data.
- Design / Development Compliance Review: `pass`
  - no blocking or needs-change findings.
  - confirmed authoring-core ownership, package-format contract boundary, no app/runtime-core/operation-core/dependency/lockfile edits, source organization pass, and contract-driven atlas UV materialization.
- Test Adequacy Review: `pass`
  - no blocking findings.
  - recorded non-blocking hardening gaps for branch-level hard-block tests, richer valid graph assertions, and a Domain B file-set parse round-trip.

## Findings / Fixes Applied

- Fixed a Domain B dependency-boundary issue found during orchestration:
  - removed a direct `@private-2d-rigging-lab/runtime-core` type import from `runtime-export-materialization.ts`.
  - replaced it with a local inferred type from `ReturnType<typeof toRuntimeGraph>`.
  - reran focused Runtime Export tests, typecheck, source guard, dependency guard, and diff check successfully.

## Basis Coverage Self-Report

- `discussion/implementation/orchestration/wave92-plan.md`
  - Covered Domain B required implementation, hard blockers, tests, write scope, forbidden scope, verification, review lanes, and non-goals.
- `discussion/design/module-contracts/runtime-export-v0-contract.md`
  - Covered authoring-core ownership, directory artifact shape, raw RGBA bytes, current committed atlas requirement, materialized graph with atlas UVs/texture refs, include/exclude rules, preflight hard blocks, and render assumptions.
- `discussion/design/screen-design/screens/runtime-export-task.md`
  - Covered readiness/preflight data that Domain C can use for blocked/ready/export states and Validate warning display.
- `discussion/design/screen-design/screens/texture-atlas-task.md`
  - Preserved Texture Atlas artifact separation and source authoring texture/UV retention.
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
  - Preserved Viewer Atlas Runtime behavior; no viewer edits.
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
  - Preserved Workspace Save and Portable JSON separation; no save/export reuse.
- `discussion/development_convention/source-file-organization-policy.md`
  - `index.ts` remains barrel-only; production logic split into responsibility files; guard passed.
- `discussion/development_convention/dependency-policy.md`
  - No dependency or lockfile changes; dependency guard passed.
- `discussion/development_convention/operation-policy.md`
  - Export assembly is non-mutating and does not use operation-core.
- Domain A reports/reviews
  - Consumed Domain A package-format DTO/file-set contract and kept Domain B limited to authoring-core assembly/preflight.

## Deferred Basis Items

- Domain C:
  - Toolbox entry, Runtime Export Task UI, readiness/blocked/ready states, directory picker/write flow, browser directory capability handling, and navigation.
- Domain D:
  - final integration, maps if required, combined package-format/authoring-core/editor verification after Domain C.
- Future / out of scope:
  - PNG, ZIP/archive, single-file/base64 export, runtime/player app, camera/tracker mapping, OBS integration, export bundle reload, external runtime pixel parity, and multi-page atlas implementation beyond schema allowance.

## Remaining Issues / Escalation Points

- No blocking Domain B issue remains.
- No user decision is required for Domain B.
- Non-blocking follow-ups from Test Adequacy Review:
  - add branch-level tests for missing source signature, missing page/texture entry/binary ref, dimensions mismatch, required binary unavailable, and generic materialization failure.
  - assert parameters/input manifest, keyforms, rig controls, Dynamics, and draw order more deeply in the valid export test.
  - add a Domain B file-set parse round-trip assertion.
- Repository note outside Domain B:
  - `packages/authoring-core/src/dependency-boundary.test.ts` still fails on existing `packages/authoring-core/src/portable-project-bundle.test.ts`; Domain B does not add a new runtime-core direct import.
