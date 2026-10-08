# Wave99 Domain A Report: Variant Model / Package Format / Operations

## Verdict

Domain id: `wave99-variant-model-package-format-operations`

Verdict: `done` from Gnome perspective.

Domain A source implementation is complete in the allowed package-format, authoring-core, and operation-core scope. No app/runtime-player/runtime-core/render-core/texture-atlas packing/dependency manifest/lockfile changes were made.

## Changed Files

Package format / persistence:

- `packages/package-format/src/model-variants.ts`
- `packages/package-format/src/package-document.ts`
- `packages/package-format/src/package-manifest.ts`
- `packages/package-format/src/package-file-paths.ts`
- `packages/package-format/src/package-file-set.ts`
- `packages/package-format/src/index.ts`
- `packages/package-format/src/model-variants.test.ts`

Authoring graph / save-open / mutations:

- `packages/authoring-core/src/authoring-graph.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/authoring-core/src/package-document-manifest.ts`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/variant-selectors.ts`
- `packages/authoring-core/src/variant-mutations.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/variant-mutations.test.ts`
- `packages/authoring-core/src/variant-persistence.test.ts`

Operation core:

- `packages/operation-core/src/payloads/variants.ts`
- `packages/operation-core/src/operations/variants.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operations/variants.test.ts`

Report:

- `discussion/implementation/waves/wave99/wave99-domain-a-variant-model-package-format-operations-report.md`

## Implementation Summary

- Added `variants-file-v1` DTO/schema with Variant Group id/name/mode, Variant id/name, target drawable ids, membership rows, and default active selection.
- Added optional manifest/file-set handling for `model/variants.json`.
- PackageDocument parse normalizes missing variants to `{ schemaVersion: "variants-file-v1", variantGroups: [] }`.
- PackageDocument validates variant target drawables against `model.drawables`.
- Authoring graph now carries `variantGroups` and serializes them back through PackageDocument, workspace save, and portable JSON.
- Added authoring mutations for group, variant, target drawable, membership, and default active selection changes.
- Added operation payloads/types/registry entries/handlers for the same mutation set.
- Operation diffs use `kind: "package"` with `/model/variants/...` paths because `TargetRefSchema` has no Variant-specific target kind and `packages/contracts` was outside Domain A write scope.

## Tests Run

Passed:

- `pnpm.cmd typecheck`
- `pnpm.cmd exec vitest run packages/package-format/src/model-variants.test.ts packages/authoring-core/src/variant-mutations.test.ts packages/authoring-core/src/variant-persistence.test.ts packages/operation-core/src/operations/variants.test.ts`
  - 4 files, 26 tests passed after Fix Loop 1 TA-001 coverage additions.
- `pnpm.cmd exec vitest run packages/package-format/src/package-file-set.test.ts packages/package-format/src/workspace-file-set.test.ts packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/package-document-adapter.test.ts packages/authoring-core/src/workspace-save.test.ts packages/authoring-core/src/workspace-open.test.ts packages/authoring-core/src/portable-project-bundle.test.ts`
  - 7 files, 29 tests passed.
- `pnpm.cmd exec vitest run packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/dependency-boundary.test.ts packages/package-format/src/package-document.test.ts`
  - These selected files passed when excluding the known authoring dependency-boundary offender noted below.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check -- packages/package-format/src packages/authoring-core/src packages/operation-core/src`
  - No whitespace errors; Git emitted existing CRLF conversion warnings only.

Known unrelated verification failure:

- The combined command including `packages/authoring-core/src/dependency-boundary.test.ts` failed because that existing test flags unmodified `packages/authoring-core/src/portable-project-bundle.test.ts` as a runtime-core import offender. I did not change that file or the boundary policy.

## Fix Loop 1 / TA-001 Closure

- Fix scope was tests-only plus this report; no production source files were changed.
- Added package-format rejection coverage for unknown package target drawables, membership rows referencing unknown Variants, membership drawables omitted from `targetDrawableIds`, and duplicate target drawable ownership across Variant Groups.
- Added authoring-core mutation rejection coverage for missing drawable, missing group, missing Variant, missing membership rows, membership rows without target drawables, and invalid multi-toggle default active Variant references.
- Added operation-core rejection coverage for missing drawable on `addVariantTargetDrawable` and missing Variant on `setVariantMembership`.
- Focused verification passed with 4 files and 26 tests.

## Compatibility Evidence

Old packages:

- `model-variants.test.ts` verifies an existing PackageDocument without variants parses to an empty variants file and has no manifest variants path.

Package file set:

- `model-variants.test.ts` verifies a valid variants package serializes/parses through `serializePackageDocumentToFileSet` / `parsePackageDocumentFromFileSet` with `model/variants.json`.

Old workspaces:

- `model-variants.test.ts` verifies old workspace file sets do not require `model/variants.json` and parse to an empty variants collection.

Workspace save/open:

- `variant-persistence.test.ts` verifies authoring workspace save/open round-trips `variantGroups` through PackageDocument and workspace text file sets.

Portable JSON:

- `model-variants.test.ts` and `variant-persistence.test.ts` verify variants round-trip through package-format portable bundles and authoring portable bundle export/import.

Preview active selection:

- `model-variants.test.ts` verifies serialized package file text does not contain `previewActive` and rejects a variants group with `previewActive`.
- `variant-persistence.test.ts` verifies an extra session-local `previewActiveVariants` field is not emitted by `toPackageDocumentFromAuthoringSession`.

Runtime export and texture atlas:

- No runtime export or texture atlas source files were edited.
- `rg` confirmed no `variant` references were introduced into `runtime-export-materialization.ts`, `runtime-export-assembly.ts`, `runtime-export.ts`, `texture-atlas-targets.ts`, `texture-atlas-source-signature.ts`, or `texture-atlas-mutations.ts`.

## Operation Behavior Evidence

- `variants.test.ts` verifies dry-run create group does not mutate session package revision, authoring revision, dirty flag, or operation log.
- `variants.test.ts` verifies committed create/update/delete group operations increment package revision and authoring revision, set dirty, and append operation log entries.
- `variants.test.ts` verifies add/remove target drawable operations enforce single group ownership.
- `variants.test.ts` verifies add/rename/delete Variant operations and rejects last-variant delete in single-select groups.
- `variants.test.ts` verifies membership and default active selection operations commit normally and reject invalid default active references.
- `variants.test.ts` verifies representative invalid references routed through Operation Core are rejected without advancing package/authoring revisions.
- All variant operation results are `reversible: true` and include model diffs with before/after `/model/variants/variantGroups`.

## Basis Coverage Self-Report

- Variant DTO/schema: covered.
- Group id/name/mode and Variant id/name: covered.
- Target drawable membership: covered with `targetDrawableIds` and per-drawable `memberships`.
- Default active selection: covered for `singleSelect` and `multiToggle`.
- Optional `model/variants.json`: covered in manifest, paths, file-set parse/serialize.
- Existing package/workspace compatibility: covered by parse defaults and tests.
- AuthoringGraph `variantGroups`: covered.
- Save/open and Portable JSON carry variants through PackageDocument: covered.
- Mutations for create/update/delete group, create/update/delete variant, add/remove target drawable, set/unset membership, set default active: covered.
- Invariants for drawable existence, single group drawable ownership, unique group/variant IDs, membership references, and default active references: covered in schema and mutation tests.
- Operation-core payloads/types/registry/handlers: covered.
- Normal operation lifecycle revision/dirty/history behavior: covered.
- Preview active not persisted: covered.
- Texture Atlas membership-only stale behavior: preserved by not touching atlas selection/signature/mutation files.
- Runtime Export variant-free behavior: preserved by not touching runtime export materialization/schema behavior in Domain A.

## Deferred Basis Items

- Variant visibility predicate helper and default active resolver: Domain B.
- Runtime Export metadata/default materialization semantics: Domain B.
- Canvas preview active selection and AND composition: Domain C after Domain B.
- Variant Manager UI, Add Drawables picker, route/back/Parameter Bar behavior: Domain C.
- Runtime Player UI/hotkeys/Browser Source protocol: out of Wave99 Domain A and still not implemented.
- Variant-specific `TargetRefSchema` target kinds: deferred because `packages/contracts` is outside Domain A write scope; operation diffs currently use package targets with precise JSON paths.

## Source Organization / Dependency Notes

- `index.ts` changes are barrel-only exports.
- New production files are responsibility-specific: package variants schema, authoring variant selectors/mutations, operation variant payloads/handlers.
- No dependency or lockfile changes.
- No source organization exceptions.

## Residual Risks

- Operation diffs are path-addressed package targets rather than first-class `variantGroup`/`variant` target refs until contracts are extended.
- The pre-existing `authoring-core/src/dependency-boundary.test.ts` failure remains outside this Domain A change set.
