# Wave99 Domain A Design / Development Compliance Review

Date: 2026-06-24
Reviewer: Review-Sylph
Domain: `wave99-variant-model-package-format-operations`
Verdict: `pass`

## Scope

This review checked Wave99 Domain A only: Variant model, package format, authoring graph persistence/mutations, and operation-core handlers. It did not review or start Domain B/C/D implementation work.

Source and tests were reviewed directly against:

- `discussion/implementation/orchestration/wave99-plan.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/runtime-export-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

## Findings

No blocking findings.

## Compliance Checks

| Check | Result | Evidence |
|---|---|---|
| `package-format` owns serializable Variant DTO/schema | Pass | `packages/package-format/src/model-variants.ts:6` defines `model/variants.json`; `model-variants.ts:63` defines `VariantGroupSchema`; `model-variants.ts:164` defines `VariantsFileSchema`; `package-document.ts:36` defaults missing variants to an empty variants file. |
| Optional package model file handling | Pass | `packages/package-format/src/package-manifest.ts:23` makes `modelFiles.variants` optional; `package-file-set.ts:49` serializes variants only when manifest lists the optional file; `package-file-set.ts:101` parses the file only when listed; `package-file-set.ts:176` rejects non-empty variants without a manifest path. |
| `authoring-core` owns graph state and mutations | Pass | `packages/authoring-core/src/authoring-graph.ts:32` adds `variantGroups`; `authoring-graph.ts:55` hydrates missing package variants to `[]`; `variant-mutations.ts:28`, `:182`, `:242`, and `:279` own group/target/membership/default-active mutations. |
| `operation-core` owns operations | Pass | `packages/operation-core/src/operation-type.ts:55` includes Variant operation types; `operation-payload.ts:144` and `:160` register Variant payload schemas; `operation-registry.ts:151` and `:158` register Variant handlers; `operations/variants.ts:67` creates dry-run/commit handlers. |
| Variant is not stored in `editorState` | Pass | Package model stores variants as a sibling of optional `editorState` in `packages/package-format/src/package-document.ts:36`; authoring persistence writes variants from `session.graph.variantGroups` in `packages/authoring-core/src/package-document-model-files.ts:56`. Tests assert preview fields are not persisted at `packages/authoring-core/src/variant-persistence.test.ts:89`. |
| Variant is not written into `runtimeVisibility` | Pass | `rg` found no `runtimeVisibility` references in the new Variant source files. Existing runtime visibility remains in `packages/authoring-core/src/runtime-visibility-mutations.ts:20`. |
| No Canvas predicate / Runtime Export materialization / Editor UI / Runtime Player UI / Texture Atlas algorithm or stale behavior | Pass | `git diff --name-only` for `apps/editor/src`, `apps/runtime-player/src`, runtime/render packages, Runtime Export files, and Texture Atlas target/signature/mutation/packing files was empty. `rg` found no Canvas/Runtime Export/Atlas implementation terms in new Variant source files. |
| Operation Policy lifecycle | Pass | `operations/variants.ts:71` dry-runs against `createDryRunAuthoringSession`; `operations/variants.ts:76` commits against the real session; `operations/variants.ts:248` builds `modelDiff`; `packages/operation-core/src/operations/variants.test.ts:35` asserts dry-run does not mutate the original session, and `variants.test.ts:60` verifies lifecycle operation log entries. |
| Source organization policy | Pass | New files are responsibility-specific. `index.ts` changes are barrel-only exports at `packages/package-format/src/index.ts:17`, `packages/authoring-core/src/index.ts:52`, and `packages/operation-core/src/index.ts:10`. `node scripts/check-source-organization.mjs` passed. |
| Dependency policy | Pass | No `package.json` or `pnpm-lock.yaml` changes were present in `git diff --name-only`. `node scripts/check-dependencies.mjs` passed. No Cubism assets/dependencies were introduced. |
| Existing workspace / Portable JSON compatibility | Pass | `packages/package-format/src/model-variants.test.ts:18` covers old PackageDocument parse without variants; `model-variants.test.ts:40` covers old workspace file sets without `model/variants.json`; `model-variants.test.ts:54` covers portable bundle round-trip; `packages/authoring-core/src/variant-persistence.test.ts:31` and `:58` cover workspace and authoring Portable JSON round-trips. |

## Commands Run

- `pnpm.cmd exec vitest run packages/package-format/src/model-variants.test.ts packages/authoring-core/src/variant-mutations.test.ts packages/authoring-core/src/variant-persistence.test.ts packages/operation-core/src/operations/variants.test.ts`
  - First sandboxed attempt failed with `spawn EPERM` while loading Vitest/esbuild.
  - Re-run with escalation passed: 4 files / 19 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git status --short -uall`
  - Confirmed no dependency manifest/lockfile or forbidden source scope changes.
- `git diff --name-only -- package.json pnpm-lock.yaml apps/editor/src apps/runtime-player/src packages/runtime-core/src packages/render-core/src packages/render-webgl2/src`
  - Empty.
- `git diff --name-only -- packages/authoring-core/src/runtime-export-materialization.ts packages/authoring-core/src/runtime-export-assembly.ts packages/authoring-core/src/runtime-export.ts packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts packages/authoring-core/src/texture-atlas-mutations.ts packages/authoring-core/src/texture-atlas-packing.ts`
  - Empty.
- `git diff --check -- packages/package-format/src packages/authoring-core/src packages/operation-core/src`
  - Exit 0; CRLF conversion warnings only.

Did not run:

- `pnpm install` per review instruction.
- Full repository test suite. This review ran focused Domain A tests, typecheck, and the required source/dependency guards.

## Residual Risks

- Variant operation diffs currently use `kind: "package"` targets with precise `/model/variants/...` JSON paths. This is acceptable for Domain A because `packages/contracts` was outside scope, but first-class Variant target refs remain deferred.
- The known unrelated `packages/authoring-core/src/dependency-boundary.test.ts` issue reported by Gnome was not re-run as part of this lane.
- Worktree status includes separate `discussion/design/**` and `wave99-plan.md` changes that are source-of-truth/planning artifacts, not Domain A production source changes reviewed here.
