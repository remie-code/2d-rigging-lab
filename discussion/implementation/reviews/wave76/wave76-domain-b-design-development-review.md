# Wave76 Domain B Design / Development Compliance Review

## Verdict

pass

Target: Wave76 Domain B `wave76-rigcontrol-partid-legacy-optional-decoupling`

Lane: Design / Development Compliance

## Findings

No blocking or warning findings.

## Evidence-Based Assessment

### Module Boundaries / Source Organization

- Scope stays inside the assigned vertical boundary: `package-format`, `authoring-core`, `operation-core`, `validator-core`, `ai-interface`, and the editor Rig Tool read/create model.
- No new source files with broad catch-all names were introduced. The new package-format contract test is responsibility-scoped to RigControl schema compatibility.
- `node scripts/check-source-organization.mjs` passed.

Key evidence:

- `packages/package-format/src/model-files.ts:212` and `packages/package-format/src/model-files.ts:228` keep `rotation2d` / `warpLattice2d` schemas in their existing package-format schema owner.
- `packages/operation-core/src/payloads/rig-control.ts:24` / `:39` / `:54` update the existing RigControl payload schema owner.
- `packages/validator-core/src/validators/part-delete-blockers.ts:33` / `:60` keep delete blocker semantics in the validator blocker module.

### Schema / API Compatibility

- `RigControl.partId` is optional in both storage variants, preserving old documents with `partId` and accepting new documents without it.
- Operation payload schemas accept legacy `partId` without requiring it, which is compatible with old callers while allowing new no-`partId` payloads.
- No package format versioning or destructive migration was introduced.

Key evidence:

- `packages/package-format/src/model-files.ts:216` and `:232` use `PartIdSchema.optional()`.
- `packages/package-format/src/rig-control-contract.test.ts:6` and `:17` cover legacy/current schema parsing.
- `packages/package-format/src/portable-package-bundle.test.ts:66` through `:139` round-trip one legacy and one current no-`partId` RigControl.
- `packages/operation-core/src/payloads/rig-control.ts:25`, `:40`, and `:55` make create payload `partId` optional.

### Operation Policy / Target Evidence

- New create operations do not store `partId` on created RigControls.
- Create operation `targetIds` / `checkedTargetRefs` no longer include a Part solely because a RigControl is being created.
- Operation IDs remain display-name based for create rig operations.
- Part deletion still goes through Operation Core and still checks actual child parts and drawables; it no longer treats legacy `rigControl.partId` as ownership.

Key evidence:

- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:216` through `:227` construct a rotation RigControl without `partId`; `:551` through `:561` build target IDs without payload `partId`.
- `packages/operation-core/src/operations/create-warp-deformer.ts:222` through `:241` construct a Warp Deformer RigControl without `partId`; `:663` through `:673` build target IDs without payload `partId`.
- `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts:113` through `:133` construct warp lattice RigControls without `partId`; `:375` through `:383` build target IDs from RigControl and affected children only.
- `packages/operation-core/src/operation-ids.ts:210` through `:219` keep create rig operation IDs based on `displayName`.
- `packages/operation-core/src/operations/rig-control.test.ts:244` through `:290` proves legacy create payload `partId` is accepted but not stored or targeted.
- `packages/operation-core/src/operations/delete-part.ts:139` through `:159` checks child parts/drawables only for non-empty Part delete rejection.

### Validator / Delete Semantics

- Validator delete blockers now ignore legacy `rigControl.partId` alone.
- Existing real blockers remain: child parts, drawables, and masks derived from actual Part drawables.

Key evidence:

- `packages/validator-core/src/validators/part-delete-blockers.ts:33` through `:37` define blocker kinds without `rigControlIds`.
- `packages/validator-core/src/validators/part-delete-blockers.ts:60` through `:88` collect childPart/drawable/mask blockers only.
- `packages/validator-core/src/part-texture-layer-diagnostics.test.ts:712` through `:795` keeps root Part blocked by childPart/drawable/mask while accepting an empty leaf Part that only has legacy RigControl `partId`.
- `packages/authoring-core/src/part-mutations.ts:241` through `:255` mirrors the same authoring delete precondition.
- `packages/operation-core/src/operations/part-operations.test.ts:301` through `:334` confirms Operation Core commit accepts deleting an empty leaf with only legacy RigControl `partId`.

### Legacy Metadata Without Hidden Ownership

- `parentId`, `childDrawableIds`, and `childRigControlIds` remain the active hierarchy and affected-content model.
- Direct authoring APIs can preserve explicit legacy `partId` metadata, but create flows through operations/editor omit it and delete/validator semantics do not treat it as ownership.

Key evidence:

- `packages/authoring-core/src/rig-control-mutations.ts:153` through `:221` create rig controls without Part existence preconditions.
- `packages/authoring-core/src/rig-control-mutations.ts:470` through `:496` insert rig controls by RigControl parent/child relationships, not Part ownership.
- `packages/authoring-core/src/rig-control-mutations.test.ts:126` through `:143` documents explicit legacy metadata preservation.
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts:161` through `:225` creates Drawable-derived Rotation/Warp payloads without `partId`.
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts:371` through `:393` serializes Warp draft payloads without `partId`.

### Editor Scope / Forbidden Domain E Scope

- Editor changes are scoped to removing RigControl `partId` from draft/read models and operation payloads.
- The Rig Tool inspector still shows a Drawable target's Part label in the Drawable target picker, but the read models for committed RigControls no longer expose Part ownership.
- No Domain E batch create UI or multi-selected Drawable eligibility workflow is implemented in this domain.

Key evidence:

- `apps/editor/src/features/editor-session/model/rig-tool-state.ts:465` through `:489` projects read models from rig hierarchy.
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts:647` through `:719` omits `partId` from Warp/Rotation read models while preserving `parentRigControlId`.
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:123` through `:164` remains the existing single Drawable target create entrypoint.
- `rg -n "Batch|multi|selected Drawables|eligible|already-bound|unbound|Create Rotation Deformer|Create Warp Deformer" apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts` only found existing single-selected Drawable wording/tests.

### Dependency / Forbidden Scope

- No dependency manifest or lockfile changes were found for this domain.
- `node scripts/check-dependencies.mjs` passed.
- The only Cubism references found in touched files are existing AI catalog unsupported-boundary text, not dependency or compatibility implementation.

## Commands / Evidence Used

- `Get-Content -Encoding UTF8 C:\Users\remie\.codex\skills\implementation-orchestration\SKILL.md`
- `Get-Content -Encoding UTF8 discussion/implementation/orchestration/wave76-plan.md`
- `Get-Content -Encoding UTF8 discussion/implementation/waves/wave76/wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md`
- `Get-Content -Encoding UTF8 discussion/development_convention/source-file-organization-policy.md`
- `Get-Content -Encoding UTF8 discussion/development_convention/ux-backed-package-logic-authority.md`
- `Get-Content -Encoding UTF8 discussion/development_convention/dependency-policy.md`
- `Get-Content -Encoding UTF8 discussion/development_convention/operation-policy.md`
- `Get-Content -Encoding UTF8 discussion/development_convention/schema-and-id-conventions.md`
- `git status --short -uall`
- `git diff --stat -- <Domain B paths>`
- `git diff --unified=80 -- <Domain B path groups>`
- `rg -n "partId|missing_part|part_has_rig_controls|rigControlIds|targetIds|checkedTargetRefs|payload\.partId|targetKinds" <Domain B paths>`
- `rg -n 'rigControl\.partId|part_has_rig_controls|partHasRig|missing_part|missingPart|\.partId === part\.partId' packages apps`
- `rg -n 'payload\.partId|partTarget|targetKinds.*part.*rigControl|targetKinds.*rigControl.*part|kind: "part"' packages/operation-core packages/ai-interface apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `git diff --name-only -- package.json pnpm-lock.yaml apps/*/package.json packages/*/package.json`
- `rg -n "Cubism|live2dcubismcore|\.moc3|\.model3\.json|\.motion3\.json|\.physics3\.json|\.pose3\.json" <Domain B paths>`
- `node scripts/check-source-organization.mjs` -> passed
- `node scripts/check-dependencies.mjs` -> passed
- `git diff --check -- <Domain B paths>` -> passed, with existing LF-to-CRLF working-copy warnings only

## Residual Risks

- This review lane did not rerun the focused Vitest set or `pnpm typecheck` to avoid writing anything beyond the delegated review artifact. The implementation report records those as passed; this review independently checked source/diff evidence and read-only guards.
- `part_has_rig_controls` remains in the broader `AuthoringMutationError` union for compatibility. Current reviewed Part delete paths no longer emit it for legacy RigControl metadata.
- `partId` remains exposed as optional legacy metadata in package-format projection (`packages/package-format/src/warp-deformer-projection.ts:22`, `:64`). Future consumers must continue treating it as metadata only, not ownership.

## User-Decision Points

None.
