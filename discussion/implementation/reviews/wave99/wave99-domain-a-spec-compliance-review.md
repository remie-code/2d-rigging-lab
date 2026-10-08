# Wave99 Domain A Spec Compliance Review

## Verdict

`pass`

Blocking spec compliance findings: none.

Domain A implementation satisfies the Variant model / package-format / authoring-core / operation-core requirements in the Wave99 plan. I reviewed the source and tests directly rather than relying on the Gnome report.

## Findings

No blocking findings.

## Spec Compliance Checklist

| Requirement | Result | Evidence |
|---|---|---|
| Variant DTO/schema includes group id/name/mode, variants id/name, target drawable membership, and default active selection. | pass | `packages/package-format/src/model-variants.ts:63` defines `VariantGroupSchema`; `packages/package-format/src/model-variants.ts:164` defines `VariantsFileSchema`. |
| Optional `model/variants.json` model file contract and manifest/file-set handling exists. | pass | `packages/package-format/src/package-manifest.ts:23`; `packages/package-format/src/package-file-set.ts:49`; `packages/package-format/src/package-file-set.ts:101`; `packages/package-format/src/package-file-set.ts:176`. |
| Missing variants default to an empty collection for existing PackageDocument/file-set/workspace. | pass | `packages/package-format/src/package-document.ts:36`; focused old package/workspace tests passed. |
| AuthoringGraph carries variants and save/open/PackageDocument/Portable JSON round-trip preserves them. | pass | `packages/authoring-core/src/authoring-graph.ts:32`; `packages/authoring-core/src/authoring-graph.ts:55`; `packages/authoring-core/src/package-document-model-files.ts:56`; `packages/authoring-core/src/package-document-from-authoring-session.ts:113`. |
| Authoring-core mutations cover group/variant/target/membership/default active operations. | pass | `packages/authoring-core/src/variant-mutations.ts:28`; `packages/authoring-core/src/variant-mutations.ts:46`; `packages/authoring-core/src/variant-mutations.ts:89`; `packages/authoring-core/src/variant-mutations.ts:106`; `packages/authoring-core/src/variant-mutations.ts:153`; `packages/authoring-core/src/variant-mutations.ts:182`; `packages/authoring-core/src/variant-mutations.ts:242`; `packages/authoring-core/src/variant-mutations.ts:279`. |
| Invariants: target drawable exists, drawable belongs to at most one group, group/variant IDs unique, membership refs valid, default active refs valid. | pass | Package schema checks cross-group ownership in `packages/package-format/src/model-variants.ts:164`; PackageDocument validates target drawable existence in `packages/package-format/src/package-document.ts:69`; authoring mutation invariant checks are in `packages/authoring-core/src/variant-mutations.ts:416` and `packages/authoring-core/src/variant-mutations.ts:495`. |
| Operation-core payloads/types/registry entries/handlers exist for supported mutations. | pass | `packages/operation-core/src/operation-type.ts:46`; `packages/operation-core/src/operation-type.ts:55`; `packages/operation-core/src/operation-payload.ts:144`; `packages/operation-core/src/operation-payload.ts:160`; `packages/operation-core/src/operation-registry.ts:148`; `packages/operation-core/src/operations/variants.ts:52`. |
| Operations produce normal authoring revision/dirty/history behavior. | pass | Variant mutations mark dirty and increment authoring revision in `packages/authoring-core/src/variant-mutations.ts:303`; operation lifecycle tests passed and verify package revision/history behavior. |
| Preview active selection is not represented in PackageDocument. | pass | Package schema uses strict variant group objects; focused tests reject `previewActive` and confirm `previewActiveVariants` is not serialized. |
| Domain A did not implement forbidden Runtime Player UI/hotkeys, Editor UI, Texture Atlas algorithm changes, dependency/lockfile changes. | pass | `git diff --name-only` for forbidden scopes and `package.json`/`pnpm-lock.yaml` had no Domain A changes; grep only found pre-existing `variants` toolbox ID and unrelated preview fields. |

## Verification Commands

Passed:

- `pnpm.cmd typecheck`
- `pnpm.cmd exec vitest run packages/package-format/src/model-variants.test.ts packages/authoring-core/src/variant-mutations.test.ts packages/authoring-core/src/variant-persistence.test.ts packages/operation-core/src/operations/variants.test.ts`
  - Initial sandboxed attempt failed with `spawn EPERM`; elevated rerun passed: 4 files / 19 tests.
- `pnpm.cmd exec vitest run packages/package-format/src/package-file-set.test.ts packages/package-format/src/workspace-file-set.test.ts packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/package-document-adapter.test.ts packages/authoring-core/src/workspace-save.test.ts packages/authoring-core/src/workspace-open.test.ts packages/authoring-core/src/portable-project-bundle.test.ts`
  - 7 files / 29 tests passed.
- `pnpm.cmd exec vitest run packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/dependency-boundary.test.ts packages/package-format/src/package-document.test.ts`
  - 3 files / 18 tests passed.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check -- packages/package-format/src packages/authoring-core/src packages/operation-core/src`
  - No whitespace errors; Git emitted CRLF conversion warnings only.

Not run:

- Full repository test suite.
- `packages/authoring-core/src/dependency-boundary.test.ts`, because the prompt identifies a known unrelated failure in an unmodified test file.

## Residual Risks / Notes

- Authoring save/package-document generation currently emits `model/variants.json` in the manifest even when `variantGroups` is empty. This is not a spec blocker because old packages/workspaces without the file still parse to an empty variants collection, but it means saving an old variant-free workspace may add an empty optional variants file.
- Operation diffs use package path targets such as `/model/variants/variantGroups/...` rather than first-class Variant target kinds. This matches the Gnome report rationale and does not block Domain A because `packages/contracts` was outside the domain write scope.
- Runtime Export metadata/default materialization, variant visibility predicate helpers, and Canvas/session-local preview behavior remain Domain B/C scope and were not reviewed as implemented behavior here.
