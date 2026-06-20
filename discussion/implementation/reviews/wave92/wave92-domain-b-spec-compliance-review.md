# Wave92 Domain B Spec Compliance Review

- Role / lane: Review-Sylph / Spec Compliance Review
- Date: 2026-06-20
- Target: `wave92-runtime-export-assembly-preflight`
- Verdict: `pass`

## Scope Reviewed

- Reviewed the Wave92 plan, Runtime Export v0 contract, related screen specs, and Domain A handoff reports/reviews.
- Inspected Domain B source and tests directly:
  - `packages/authoring-core/src/runtime-export-assembly.ts`
  - `packages/authoring-core/src/runtime-export-materialization.ts`
  - `packages/authoring-core/src/runtime-export-assembly.test.ts`
  - `packages/authoring-core/src/index.ts`
- Inspected Domain A contract files as needed:
  - `packages/package-format/src/runtime-export.ts`
  - `packages/package-format/src/runtime-export-file-set.ts`
- Checked adjacent atlas selection/signature/binary helpers where needed:
  - `packages/authoring-core/src/texture-atlas-targets.ts`
  - `packages/authoring-core/src/texture-atlas-source-signature.ts`
  - `packages/authoring-core/src/texture-atlas-binary.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave92-plan.md`
- `discussion/design/module-contracts/runtime-export-v0-contract.md`
- `discussion/design/screen-design/screens/runtime-export-task.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/implementation/waves/wave92/wave92-domain-a-runtime-export-package-contract-report.md`
- `discussion/implementation/reviews/wave92/wave92-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-a-test-adequacy-review.md`

The expected Domain B implementation report was not present at `discussion/implementation/waves/wave92/wave92-domain-b-runtime-export-assembly-preflight-report.md`; this review therefore uses source/tests and the required basis documents rather than an implementer summary.

## Findings

### Blocking

None.

### Needs Changes

None.

### Evidence / Residual Notes

- Directory-only Runtime Export output is preserved. The package-format contract defines only `runtime-export.json`, `runtime/model.json`, `runtime/atlas.json`, and direct `assets/textures/*.raw-rgba` entries (`packages/package-format/src/runtime-export.ts:46`, `packages/package-format/src/runtime-export.ts:703`, `packages/package-format/src/runtime-export-file-set.ts:147`). Domain B serializes those artifacts and adds raw binary texture entries to a file set (`packages/authoring-core/src/runtime-export-assembly.ts:156`, `packages/authoring-core/src/runtime-export-assembly.ts:158`, `packages/authoring-core/src/runtime-export-assembly.ts:169`). The focused test asserts exactly the v0 paths (`packages/authoring-core/src/runtime-export-assembly.test.ts:59`).
- Current committed atlas preflight hard-blocks are implemented deterministically. No atlas, missing page, missing source signature, stale atlas, missing texture entry, missing binary ref, missing bytes, required binary unavailable, metadata mismatches, binary verification mismatches, invalid placements, uncovered packable targets, and materialization failure map to blocker codes (`packages/authoring-core/src/runtime-export-assembly.ts:181`, `packages/authoring-core/src/runtime-export-assembly.ts:201`, `packages/authoring-core/src/runtime-export-assembly.ts:211`, `packages/authoring-core/src/runtime-export-assembly.ts:225`, `packages/authoring-core/src/runtime-export-assembly.ts:326`, `packages/authoring-core/src/runtime-export-assembly.ts:360`, `packages/authoring-core/src/runtime-export-assembly.ts:386`, `packages/authoring-core/src/runtime-export-assembly.ts:402`, `packages/authoring-core/src/runtime-export-assembly.ts:445`, `packages/authoring-core/src/runtime-export-assembly.ts:510`, `packages/authoring-core/src/runtime-export-assembly.ts:573`, `packages/authoring-core/src/runtime-export-assembly.ts:277`).
- Output uses raw RGBA page bytes, not PNG, ZIP, base64, or a single-file export. Domain B creates `assets/textures/${pageId}.raw-rgba` entries with `RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE` and copies raw page bytes (`packages/authoring-core/src/runtime-export-assembly.ts:414`, `packages/authoring-core/src/runtime-export-assembly.ts:417`, `packages/authoring-core/src/runtime-export-assembly.ts:283`). Searches in Domain B source found no player/camera/OBS/PNG/ZIP/base64 implementation references.
- The materialized graph includes atlas-applied UVs and texture page references. Texture refs are built from committed placements (`packages/authoring-core/src/runtime-export-materialization.ts:86`), included drawables and meshes carry those refs (`packages/authoring-core/src/runtime-export-materialization.ts:121`, `packages/authoring-core/src/runtime-export-materialization.ts:142`), and meshes write `atlasUvs` using `mapSourceUvToAtlasUv` (`packages/authoring-core/src/runtime-export-materialization.ts:154`, `packages/authoring-core/src/runtime-export-materialization.ts:490`). The Domain A schema requires drawable texture refs, mesh texture refs, and `atlasUvs` (`packages/package-format/src/runtime-export.ts:312`, `packages/package-format/src/runtime-export.ts:321`, `packages/package-format/src/runtime-export.ts:337`).
- Target filtering includes only current packable runtime targets covered by the atlas. Atlas target selection excludes unbound Drawable Pool entries as `unboundDrawablePool` without turning them into warnings (`packages/authoring-core/src/texture-atlas-targets.ts:105`, `packages/authoring-core/src/texture-atlas-targets.ts:110`, `packages/authoring-core/src/texture-atlas-targets.ts:119`). Domain B filters packable targets to those with placements (`packages/authoring-core/src/runtime-export-materialization.ts:77`) and hard-blocks uncovered packable targets (`packages/authoring-core/src/runtime-export-assembly.ts:573`). The test verifies a pool drawable is excluded with no warning/blocker (`packages/authoring-core/src/runtime-export-assembly.test.ts:65`, `packages/authoring-core/src/runtime-export-assembly.test.ts:71`).
- Validate warnings do not block export. Domain B models them as preflight warnings only (`packages/authoring-core/src/runtime-export-assembly.ts:591`) and ready preflight can still return with warnings (`packages/authoring-core/src/runtime-export-assembly.ts:608`). The focused test verifies ready export with warning count (`packages/authoring-core/src/runtime-export-assembly.test.ts:241`).
- Masks either reference included drawables or fail deterministically if unsupported. Included-target masks are emitted only after filtering targets (`packages/authoring-core/src/runtime-export-materialization.ts:303`), excluded mask sources raise `runtimeExport.unsupportedMaskReference` (`packages/authoring-core/src/runtime-export-materialization.ts:319`, `packages/authoring-core/src/runtime-export-materialization.ts:323`), and the package schema rejects mask refs to missing drawables (`packages/package-format/src/runtime-export.ts:606`). Focused tests cover both included masks and excluded-source failure (`packages/authoring-core/src/runtime-export-assembly.test.ts:195`, `packages/authoring-core/src/runtime-export-assembly.test.ts:221`).
- Source PSD/original bytes, editor/workspace data, and diagnostics payloads are excluded from produced artifacts. The assembler builds Runtime Export artifacts from source package identity, canvas/bounds, runtime graph projections, included targets, atlas metadata, and raw atlas page bytes (`packages/authoring-core/src/runtime-export-materialization.ts:101`, `packages/authoring-core/src/runtime-export-materialization.ts:169`, `packages/authoring-core/src/runtime-export-materialization.ts:204`, `packages/authoring-core/src/runtime-export-materialization.ts:221`). The focused test attaches source-original bytes and asserts source/workspace/editor/diagnostics strings are absent from text artifacts (`packages/authoring-core/src/runtime-export-assembly.test.ts:264`).
- Runtime/player, camera/tracker, OBS integration, Workspace Save mutation, and Portable JSON reuse were not added in Domain B. The only authoring-core barrel addition is `runtime-export-assembly.js` (`packages/authoring-core/src/index.ts:64`), and scoped source search found no forbidden runtime/player/camera/OBS/Workspace Save/Portable JSON implementation in the new Domain B files.

## Verification Notes

- Ran `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-assembly.test.ts`.
  - First sandboxed run failed while loading Vitest/esbuild with `spawn EPERM`.
  - Reran outside the sandbox; result: 1 test file passed, 12 tests passed.
- Reviewed the provided Orch-Sylph verification context reporting pass for `pnpm.cmd typecheck`, source organization, dependency guard, and whitespace checks. I did not rerun those broader checks in this review lane.

## Remaining Issues / User-decision Points

- No source-level spec compliance blocker found.
- No user decision is required for this lane.
- Process note: Wave92 expected persistent artifacts include `discussion/implementation/waves/wave92/wave92-domain-b-runtime-export-assembly-preflight-report.md` (`discussion/implementation/orchestration/wave92-plan.md:587`), but that report was not present during this review. Orchestration should confirm whether it will be created before final Wave92 closeout.
