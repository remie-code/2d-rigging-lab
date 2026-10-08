# Wave92 Domain B Test Adequacy Review

Verdict: `pass`

No blocking test adequacy issues were found. The Domain B tests cover the required representative runtime export assembly/preflight cases. The remaining items below are non-blocking hardening gaps for branch-level coverage and richer runtime graph assertions.

## Scope Reviewed

- `packages/authoring-core/src/runtime-export-assembly.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/authoring-core/src/runtime-export-assembly.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/package-format/src/runtime-export.ts`
- `packages/package-format/src/runtime-export-file-set.ts`
- `packages/package-format/src/runtime-export.test.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/dependency-boundary.test.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave92-plan.md`
- `discussion/design/module-contracts/runtime-export-v0-contract.md`
- `discussion/design/screen-design/screens/runtime-export-task.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`

## Findings

### Low: Several hard-block branches are not individually tested

The focused test file covers the required blocker categories, but not every distinct blocker branch exposed by `RuntimeExportBlockerCode`.

- Covered blocker assertions include no committed atlas, stale atlas, missing bytes, digest/byte length/media type mismatch, uncovered runtime target, invalid placement data, and unsupported mask source references in `packages/authoring-core/src/runtime-export-assembly.test.ts:99`, `packages/authoring-core/src/runtime-export-assembly.test.ts:113`, `packages/authoring-core/src/runtime-export-assembly.test.ts:128`, `packages/authoring-core/src/runtime-export-assembly.test.ts:143`, `packages/authoring-core/src/runtime-export-assembly.test.ts:161`, and `packages/authoring-core/src/runtime-export-assembly.test.ts:221`.
- Untested branch-specific blockers remain for missing source signature, missing atlas page, missing atlas texture entry, missing atlas binary ref, atlas dimensions mismatch, required binary unavailable/storage status, and generic runtime graph materialization failure. These branches are implemented in `packages/authoring-core/src/runtime-export-assembly.ts:201`, `packages/authoring-core/src/runtime-export-assembly.ts:211`, `packages/authoring-core/src/runtime-export-assembly.ts:337`, `packages/authoring-core/src/runtime-export-assembly.ts:348`, `packages/authoring-core/src/runtime-export-assembly.ts:402`, `packages/authoring-core/src/runtime-export-assembly.ts:451`, and `packages/authoring-core/src/runtime-export-assembly.ts:302`.

Why non-blocking: the explicit Domain B case list asks for representative missing/stale/bytes/mismatch/placement blockers, which are present. Adding branch-level tests would improve regression precision.

### Low: Valid export assertions do not deeply check non-drawable runtime graph payloads

The valid export test verifies manifest/model/atlas/texture entries, included/excluded drawable IDs, texture paths, atlas placements, and raw bytes in `packages/authoring-core/src/runtime-export-assembly.test.ts:50`. The fixture contains parameters, keyforms, rig controls, and dynamics data in `packages/authoring-core/src/runtime-export-assembly.test.ts:387`, `packages/authoring-core/src/runtime-export-assembly.test.ts:408`, `packages/authoring-core/src/runtime-export-assembly.test.ts:423`, and `packages/authoring-core/src/runtime-export-assembly.test.ts:437`, but the test does not assert those exported model sections.

The materializer does populate those sections in `packages/authoring-core/src/runtime-export-materialization.ts:119`, `packages/authoring-core/src/runtime-export-materialization.ts:186`, `packages/authoring-core/src/runtime-export-materialization.ts:193`, and `packages/authoring-core/src/runtime-export-materialization.ts:200`. A future regression that drops keyforms, rig controls, or dynamics to empty arrays could pass the current Domain B valid export assertions if schema shape remains valid.

Why non-blocking: the requested coverage checklist emphasizes atlas/preflight/file-set behavior, and the schema validation path still exercises serializability. This is a good follow-up test addition before external runtime consumption depends on these fields.

### Low: Domain B does not round-trip parse its own assembled file-set

The assembly path serializes artifacts and builds a guarded file-set in `packages/authoring-core/src/runtime-export-assembly.ts:156`. The Domain B valid test checks exact file paths in `packages/authoring-core/src/runtime-export-assembly.test.ts:59`, while Domain A contract tests parse serialized runtime export artifacts from a file-set in `packages/package-format/src/runtime-export.test.ts:146`.

Why non-blocking: Domain B validates DTOs through `assertRuntimeExportV0SinglePageArtifacts` before serialization in `packages/authoring-core/src/runtime-export-assembly.ts:289`, and package-format owns the serializer/parser contract. A single `parseRuntimeExportArtifactsFromFileSet(result.fileSet)` assertion in Domain B would make cross-package integration regressions more obvious.

## Coverage Assessment

| Required Domain B case | Assessment |
|---|---|
| Valid current committed atlas produces manifest/model/atlas/textures entries | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:50`; exact file paths, manifest paths, model drawables, atlas placements, and raw bytes are asserted. |
| Missing atlas hard-blocks | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:99`; `runtimeExport.noCommittedAtlas` is asserted. |
| Stale atlas hard-blocks | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:113`; `runtimeExport.staleAtlas` is asserted. |
| Missing atlas bytes hard-block | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:128`; `runtimeExport.missingAtlasBytes` is asserted. |
| Digest/byte length/media type mismatch hard-block | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:143`; all three blocker codes are asserted. |
| Invalid/missing placement hard-block | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:161`; uncovered runtime target and invalid placement data are asserted. |
| Drawable Pool / unbound Drawables excluded without warning/blocking | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:65` and `packages/authoring-core/src/runtime-export-assembly.test.ts:84`; target selection exclusion logic is in `packages/authoring-core/src/texture-atlas-targets.ts:105`. |
| Materialized exported mesh UVs point at atlas page coordinates | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:177`; source-to-atlas UV mapping is in `packages/authoring-core/src/runtime-export-materialization.ts:490`. |
| Included masks reference only included drawables or fail deterministically if unsupported | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:195` and `packages/authoring-core/src/runtime-export-assembly.test.ts:221`; package schema also rejects missing mask drawable references in `packages/package-format/src/runtime-export.ts:606`. |
| Validate warnings do not block assembly/preflight | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:241`; warning generation is in `packages/authoring-core/src/runtime-export-assembly.ts:591`. |
| Source PSD/original bytes and workspace/editor data are not included | Covered by `packages/authoring-core/src/runtime-export-assembly.test.ts:264`; the test registers source-original bytes and verifies file paths/text payloads exclude source/workspace/editor/diagnostics markers. |
| Hard blockers and exported JSON/file-set catch schema/path regressions | Adequate for this domain. Domain B checks exact output paths and uses package-format file-set/schema helpers; Domain A contract tests cover path guards and serialized parse round-trip in `packages/package-format/src/runtime-export.test.ts:146`. |

## Verification Notes

- I did not rerun the checks in this read-only test adequacy review; I used the Orch-Sylph verification context after direct source/test inspection.
- Provided verification context says `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-assembly.test.ts` passed with 12 tests.
- Provided verification context says `pnpm.cmd typecheck`, `node scripts/check-source-organization.mjs`, `node scripts/check-dependencies.mjs`, and scoped `git diff --check` passed.
- Provided verification context says the combined runtime-export plus dependency-boundary vitest command still has an existing failure from `packages/authoring-core/src/portable-project-bundle.test.ts`, not from Domain B runtime export import boundaries.

## Remaining Issues / User-decision Points

- No user decision is required for Domain B test adequacy.
- Recommended non-blocking follow-up: add focused tests for missing source signature, missing atlas page/texture entry/binary ref, atlas dimensions mismatch, required binary unavailable, generic materialization failure, and a Domain B file-set parse round-trip.
- Recommended non-blocking follow-up: strengthen the valid export test to assert parameter/input manifest, keyform, rig control, dynamics, and draw order content for the existing fixture.
