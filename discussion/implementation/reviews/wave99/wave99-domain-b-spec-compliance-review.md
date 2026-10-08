# Wave99 Domain B Spec Compliance Review

Date: 2026-06-24
Reviewer: Review-Sylph
Domain: `wave99-variant-evaluation-runtime-export-compatibility`
Verdict: `pass`

## Scope

This review checked Wave99 Domain B only: pure Variant visibility evaluation, Runtime Export Variant metadata/default-active materialization, variant-free Runtime Export compatibility, and Texture Atlas compatibility boundaries.

I reviewed the source and tests directly against:

- `discussion/implementation/orchestration/wave99-plan.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/runtime-export-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- Domain A report and review baseline documents under `discussion/implementation/waves/wave99/` and `discussion/implementation/reviews/wave99/`
- Gnome Domain B report at `discussion/implementation/waves/wave99/wave99-domain-b-variant-evaluation-runtime-export-compatibility-report.md`

## Findings

No blocking findings.

## Spec Compliance Checks

| Requirement | Result | Evidence |
|---|---|---|
| Pure helper resolves Variant predicate from groups, active selection, and drawable id. | Pass | `packages/authoring-core/src/variant-evaluation.ts:24` creates predicates; `packages/authoring-core/src/variant-evaluation.ts:43` resolves per drawable. |
| Missing/empty variants resolve `true` for all drawables. | Pass | Empty groups return a constant true predicate at `packages/authoring-core/src/variant-evaluation.ts:32`; direct resolver returns true at `packages/authoring-core/src/variant-evaluation.ts:49`; test at `packages/authoring-core/src/variant-evaluation.test.ts:17`. |
| Variant-neutral drawables resolve `true`. | Pass | Missing drawable group returns true at `packages/authoring-core/src/variant-evaluation.ts:53`; test at `packages/authoring-core/src/variant-evaluation.test.ts:28`. |
| Assigned drawables resolve according to active selection. | Pass | Membership is intersected with active variant ids at `packages/authoring-core/src/variant-evaluation.ts:68`; blocking case test at `packages/authoring-core/src/variant-evaluation.test.ts:74`. |
| Supports `singleSelect` and `multiToggle`. | Pass | Active ids branch by selection kind at `packages/authoring-core/src/variant-evaluation.ts:91`; tests at `packages/authoring-core/src/variant-evaluation.test.ts:35` and `packages/authoring-core/src/variant-evaluation.test.ts:54`. |
| Default active selection resolver exists. | Pass | `resolveDefaultVariantActiveSelections` clones group defaults at `packages/authoring-core/src/variant-evaluation.ts:16`; test at `packages/authoring-core/src/variant-evaluation.test.ts:93`. |
| Runtime Export includes Variant metadata/default active selection when variants exist. | Pass | Materialization reads graph variants/default selections at `packages/authoring-core/src/runtime-export-materialization.ts:93`; emits `model.variants` only when groups exist at `packages/authoring-core/src/runtime-export-materialization.ts:216`; helper emits schema version, groups, and defaults at `packages/authoring-core/src/runtime-export-materialization.ts:325`; test at `packages/authoring-core/src/runtime-export-assembly.test.ts:103`. |
| Existing exports without variants still parse. | Pass | `RuntimeExportModelSchema` keeps `variants` optional at `packages/package-format/src/runtime-export.ts:624`; parse test confirms `undefined` at `packages/package-format/src/runtime-export.test.ts:99`. |
| Variant-free Runtime Export materialization behavior is preserved. | Pass | Materialization omits `model.variants` when no groups exist at `packages/authoring-core/src/runtime-export-materialization.ts:216`; assembly test asserts `undefined` at `packages/authoring-core/src/runtime-export-assembly.test.ts:95`. |
| Default active selection affects initial exported drawable visibility. | Pass | Exported visibility is existing runtime visibility AND default-active Variant predicate at `packages/authoring-core/src/runtime-export-materialization.ts:148`; test at `packages/authoring-core/src/runtime-export-assembly.test.ts:103`. |
| Texture Atlas target selection remains bound Drawable based. | Pass | `selectTextureAtlasTargets` still derives targets from rig-control child drawables in `packages/authoring-core/src/texture-atlas-targets.ts:84` and `packages/authoring-core/src/texture-atlas-targets.ts:131`; test at `packages/authoring-core/src/runtime-export-assembly.test.ts:135`. |
| Variant membership/default active change alone is not treated as atlas/runtime export stale. | Pass | Texture Atlas source signature only normalizes settings, bound ids, and packable target source inputs in `packages/authoring-core/src/texture-atlas-source-signature.ts:14`; test at `packages/authoring-core/src/runtime-export-assembly.test.ts:152`. |
| Forbidden scope was not implemented: Editor UI, Runtime Player UI/hotkeys/protocol, Canvas integration, Texture Atlas packing changes, dependencies/lockfile changes. | Pass | `git diff --name-only` for `apps/editor/src`, `apps/runtime-player/src`, runtime/render packages, package manifests, and lockfile was empty. Texture Atlas target/signature/packing/mutations diff check was empty. Dependency guard passed. |

## Runtime Export Schema Notes

`packages/package-format/src/runtime-export.ts:522` adds the optional `RuntimeExportVariantsSchema`. The schema requires:

- `schemaVersion: "runtime-export-variants-v0"` at `packages/package-format/src/runtime-export.ts:61`.
- structured Variant groups using the Domain A `VariantGroupSchema`.
- explicit `defaultActiveSelections` at `packages/package-format/src/runtime-export.ts:514`.
- consistency between each group `defaultActive` and the exported `defaultActiveSelections` at `packages/package-format/src/runtime-export.ts:576`.

This satisfies the Domain B requirement to retain future runtime-switching metadata while keeping old Runtime Export models valid.

## Commands Run

Passed:

```text
pnpm.cmd exec vitest run packages/authoring-core/src/variant-evaluation.test.ts packages/package-format/src/runtime-export.test.ts packages/authoring-core/src/runtime-export-assembly.test.ts
```

Result: 3 files / 28 tests passed.

```text
pnpm.cmd typecheck
```

Result: passed.

```text
node scripts/check-source-organization.mjs
```

Result: passed.

```text
node scripts/check-dependencies.mjs
```

Result: passed.

```text
git diff --check -- packages/authoring-core/src packages/package-format/src discussion/implementation/waves/wave99
```

Result: exit 0; Git emitted CRLF conversion warnings only.

```text
pnpm.cmd exec vitest run packages/authoring-core/src/texture-atlas-mutations.test.ts apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts
```

Result: 2 files / 22 tests passed.

Additional read-only checks:

- `git diff --name-only -- apps/editor/src apps/runtime-player/src packages/runtime-core/src packages/render-core/src packages/render-webgl2/src package.json pnpm-lock.yaml` returned no files.
- `git diff --name-only -- packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts packages/authoring-core/src/texture-atlas-packing.ts packages/authoring-core/src/texture-atlas-mutations.ts` returned no files.
- `git diff --stat` for tracked Domain B files matched Gnome's 361 insertions / 2 deletions across 5 tracked files, with `variant-evaluation.ts` and `variant-evaluation.test.ts` still untracked new files.

Not run:

- Full repository test suite.
- `pnpm install`, per dependency/no-install scope.

## Residual Risks

- Runtime Export metadata currently includes all graph Variant groups when any exist. Domain A operations can still create Variant targets for drawables that are not runtime-bound; Domain C picker is expected to prevent that user path. This is not a Domain B spec blocker because Texture Atlas and Runtime Export target selection intentionally remain bound-drawable based.
- Runtime Player can load the extended Runtime Export schema, and default active selection is baked into initial `drawables[].visible`, but Runtime Player-side Variant switching UI/protocol remains intentionally out of Wave99 Domain B.
- Canvas preview active selection and session-local preview state remain Domain C scope and were not implemented or reviewed as completed behavior here.

## Verdict

`pass`
