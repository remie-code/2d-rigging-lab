# Wave99 Domain B Design / Development Compliance Review

Date: 2026-06-24
Reviewer: Review-Sylph
Domain: `wave99-variant-evaluation-runtime-export-compatibility`
Verdict: `pass`

## Scope

Wave99 Domain B の Design / Development compliance を、Gnome report だけではなく source/tests を直接読んで確認した。

主な確認対象:

- `packages/authoring-core/src/variant-evaluation.ts`
- `packages/authoring-core/src/variant-evaluation.test.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/authoring-core/src/runtime-export-assembly.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/package-format/src/runtime-export.ts`
- `packages/package-format/src/runtime-export.test.ts`
- Domain A baseline reports/reviews
- Wave99 plan、Variant Manager / Texture Atlas / Runtime Export / Viewer design docs
- Source organization / dependency / operation policies

## Findings

No blocking findings.

## Compliance Checks

| Check | Result | Evidence |
|---|---|---|
| `package-format` owns serializable Runtime Export Variant DTO/schema | Pass | `packages/package-format/src/runtime-export.ts:514` defines runtime default-active entries; `packages/package-format/src/runtime-export.ts:522` defines `RuntimeExportVariantsSchema`; `packages/package-format/src/runtime-export.ts:624` keeps `model.variants` optional. The schema reuses Domain A `VariantGroupSchema` from `packages/package-format/src/model-variants.ts:63`. |
| Runtime Export Variant schema is backward-compatible | Pass | `RuntimeExportModelSchema` adds `variants` as optional at `packages/package-format/src/runtime-export.ts:624`; old-style parse is asserted in `packages/package-format/src/runtime-export.test.ts:99`. |
| Runtime Export metadata/default selection is internally consistent | Pass | `packages/package-format/src/runtime-export.ts:564` requires one default active entry per group; `packages/package-format/src/runtime-export.ts:576` checks group `defaultActive` matches exported `defaultActiveSelections`; `packages/package-format/src/runtime-export.ts:927` validates mode and Variant references. |
| `authoring-core` owns pure Variant predicate/default-active evaluation | Pass | `packages/authoring-core/src/variant-evaluation.ts:16` resolves default active selections; `packages/authoring-core/src/variant-evaluation.ts:24` creates a predicate; `packages/authoring-core/src/variant-evaluation.ts:43` resolves per-drawable visibility; `packages/authoring-core/src/variant-evaluation.ts:91` derives active Variant ids by mode. |
| Predicate semantics match design | Pass | Empty groups return true at `packages/authoring-core/src/variant-evaluation.ts:32`; unassigned drawables return true at `packages/authoring-core/src/variant-evaluation.ts:53`; assigned drawables intersect membership with active ids at `packages/authoring-core/src/variant-evaluation.ts:65` through `:70`. Tests cover empty, neutral, `singleSelect`, `multiToggle`, blocked assigned drawables, and default active fallback at `packages/authoring-core/src/variant-evaluation.test.ts:17`, `:28`, `:35`, `:54`, `:74`, and `:93`. |
| Runtime Export uses shared predicate logic instead of divergent logic | Pass | `runtime-export-materialization.ts` imports `createVariantVisibilityPredicate` and `resolveDefaultVariantActiveSelections` at `packages/authoring-core/src/runtime-export-materialization.ts:43`; it creates the default predicate at `:93` through `:98`; exported `drawables[].visible` is `normalizedDrawable.visible && variantVisibilityPredicate(...)` at `:148` through `:149`. |
| Runtime Export includes metadata only when groups exist | Pass | `packages/authoring-core/src/runtime-export-materialization.ts:216` omits `model.variants` for empty groups and emits metadata at `:219`; the emitted schema version/groups/default selections are built at `packages/authoring-core/src/runtime-export-materialization.ts:325`. |
| Variant is not stored in `editorState`; preview active is not persisted/exported | Pass | Domain B did not edit `apps/editor/src/**` or package editor-state persistence. Domain B exported only graph `variantGroups` and default selections from `packages/authoring-core/src/runtime-export-materialization.ts:93`; no preview-active field is present in the changed Runtime Export schema or materialization. |
| Variant is not written into `runtimeVisibility` or Domain A project state outside explicit Variant model metadata | Pass | Domain B materialization reads `normalizedDrawable.visible` and applies an export-time predicate at `packages/authoring-core/src/runtime-export-materialization.ts:148`; it does not mutate `session.graph`, `runtimeVisibility`, or operation state. `rg` found no `runtimeVisibility` references in the Domain B Variant evaluation/materialization changes. |
| Texture Atlas target selection remains bound Drawable based | Pass | `packages/authoring-core/src/texture-atlas-targets.ts:93` selects atlas targets from existing source; unbound drawables are excluded at `:105` through `:113`; bound drawables come from rig control `childDrawableIds` at `:145` through `:153`. Domain B did not modify this file. |
| Texture Atlas source signature remains independent of Variant membership/default-active | Pass | `packages/authoring-core/src/texture-atlas-source-signature.ts:15` builds signatures from settings, bound drawable ids, and packable target source inputs; the normalized payload at `:26` through `:31` has no Variant fields. Runtime Export stale check uses that signature at `packages/authoring-core/src/runtime-export-assembly.ts:219` through `:225`. |
| Membership/default-active changes alone do not stale export preflight | Pass | Test mutates only `variantGroups`, `defaultActive`, and `memberships` while preflight remains ready at `packages/authoring-core/src/runtime-export-assembly.test.ts:152` through `:167`. |
| `index.ts` change is barrel-only | Pass | `packages/authoring-core/src/index.ts:52` through `:54` add only re-exports. No implementation logic was added to `index.ts`. |
| Source files have clear responsibility | Pass | New `variant-evaluation.ts` owns pure predicate/default-active evaluation. Runtime Export schema additions stay in existing `runtime-export.ts`, which already owns Runtime Export DTO/schema. Runtime Export materialization additions stay in existing `runtime-export-materialization.ts`, which already owns Runtime Export artifact construction. Source organization guard passed. |
| Dependency policy | Pass | No package manifest or lockfile changes were present in diff checks; `node scripts/check-dependencies.mjs` passed. |
| Operation policy | Pass | No `operation-core` changes were part of Domain B. New helpers are pure evaluation/read-only materialization and do not introduce direct package mutation pathways. |
| Forbidden scopes untouched | Pass | `git diff --name-only` for `apps/editor/src`, `apps/runtime-player/src`, `packages/runtime-core/src`, `packages/render-core/src`, `packages/render-webgl2/src`, and Texture Atlas target/signature/packing/mutation files returned no files. Runtime Player loader compatibility was verified by test without source edits. |

## Commands Run

Passed:

```text
pnpm.cmd exec vitest run packages/authoring-core/src/variant-evaluation.test.ts packages/package-format/src/runtime-export.test.ts packages/authoring-core/src/runtime-export-assembly.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts
```

- First sandboxed attempt failed before tests with `spawn EPERM` while Vitest/Vite loaded esbuild.
- Re-ran with elevated process spawn.
- Result: 4 files / 36 tests passed.

```text
pnpm.cmd exec vitest run apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts
```

- Result: 1 file / 14 tests passed.

```text
pnpm.cmd typecheck
```

- Result: passed.

```text
node scripts/check-source-organization.mjs
```

- Result: passed.

```text
node scripts/check-dependencies.mjs
```

- Result: passed.

```text
git diff --check -- packages/authoring-core/src packages/package-format/src discussion/implementation/waves/wave99
```

- Result: exit 0; Git emitted CRLF conversion warnings only.

Additional read-only checks:

- `git status --short -uall`
- `git diff --name-only -- packages/authoring-core/src packages/package-format/src apps/editor/src apps/runtime-player/src packages/runtime-core/src packages/render-core/src packages/render-webgl2/src package.json pnpm-lock.yaml`
- `git diff --name-only -- package.json pnpm-lock.yaml "**/package.json"`
- `git diff --name-only -- apps/editor/src apps/runtime-player/src packages/runtime-core/src packages/render-core/src packages/render-webgl2/src packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts packages/authoring-core/src/texture-atlas-packing.ts packages/authoring-core/src/texture-atlas-mutations.ts`
- `rg` checks for Variant references in Texture Atlas implementation files and forbidden app/runtime/render scopes.

Not run:

- Full repository test suite.
- `pnpm install`, per dependency/no-install scope.

## Residual Risks

- Runtime Export metadata currently includes all graph Variant groups when any groups exist. Domain A operations can still create Variant targets for drawables that are not runtime-bound; Domain C picker is expected to prevent that user path. Domain B correctly keeps Atlas and export target selection bound-drawable based rather than broadening targets from Variant membership.
- Runtime Player can load the extended schema and default-active visibility is baked into initial `drawables[].visible`, but Runtime Player-side Variant switching UI/protocol remains intentionally out of scope.
- Runtime Export metadata duplicates default active selection inside each group and in `defaultActiveSelections`; schema consistency checks mitigate ambiguity, but future runtime switching should choose one canonical read path.

## Verdict

`pass`
