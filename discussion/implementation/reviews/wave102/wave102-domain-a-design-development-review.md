# Wave102 Domain A Design / Development Compliance Review

## Verdict

`pass`

## Reviewed Files / Scopes

Source and test targets reviewed directly:

- `packages/package-format/src/runtime-export.ts`
- `packages/package-format/src/runtime-export.test.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/authoring-core/src/runtime-export-assembly.test.ts`

Basis and convention inputs reviewed:

- `discussion/implementation/orchestration/wave102-plan.md`
- `discussion/runtime-player/screens/live-controller-page.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave102/wave102-domain-a-runtime-export-variant-visibility-foundation-report.md`

Scope checks:

- `git status --short -uall` showed source/test changes only in the four target source/test files, plus planning/basis map documents and the Domain A report.
- `git diff --name-only` for reviewed source changes was limited to the four target source/test files and two discussion map files.
- No diffs or untracked files were present under `apps/runtime-player/src/control`, `apps/runtime-player/src/stage`, `packages/runtime-core/src`, `packages/render-core/src`, `packages/render-webgl2/src`, package manifests, workspace manifest, or `pnpm-lock.yaml`.
- Observed planning/basis document changes (`wave102-plan.md`, `live-controller-page.md`, and related maps) are outside the reviewed source implementation lane and should be accounted for by orchestration/final integration, but they are not Runtime Player behavior changes or conditional runtime/render scope.

## Source / Convention Evidence

- `package-format` owns Runtime Export schema compatibility:
  - `packages/package-format/src/runtime-export.ts:335` adds optional `baseVisible`, preserving legacy parse for drawables without the field.
  - `packages/package-format/src/runtime-export.ts:731`-`747` validates Runtime Export Variant target and membership drawable references against exported drawables.
- `authoring-core` owns materialization/export-time consistency:
  - `packages/authoring-core/src/runtime-export-materialization.ts:94` filters Runtime Export Variant Groups to included drawable ids before materialization.
  - `packages/authoring-core/src/runtime-export-materialization.ts:146` sets `baseVisible` from `normalizedDrawable.visible`.
  - `packages/authoring-core/src/runtime-export-materialization.ts:154`-`155` emits `baseVisible` and keeps `visible = baseVisible && variantVisibilityPredicate(...)`.
  - `packages/authoring-core/src/runtime-export-materialization.ts:343`-`361` sanitizes target/membership drawable references to exported drawables.
- Tests cover the compatibility and materialization contract:
  - `packages/package-format/src/runtime-export.test.ts:128` covers new `baseVisible` and legacy missing-`baseVisible` parse.
  - `packages/package-format/src/runtime-export.test.ts:266` covers rejection of Variant metadata referencing non-exported drawables.
  - `packages/authoring-core/src/runtime-export-assembly.test.ts:93`-`104` covers emitted `baseVisible` / `visible` in no-variant export.
  - `packages/authoring-core/src/runtime-export-assembly.test.ts:145`-`154` covers default-active evaluated `visible` distinct from `baseVisible`.
  - `packages/authoring-core/src/runtime-export-assembly.test.ts:157` covers filtering Variant targets/memberships to exported drawables.
- `hiddenAtApply` is not used as Runtime Export base visibility:
  - Targeted diff search for `hiddenAtApply` in the four reviewed files returned no added `hiddenAtApply` lines.
  - The new base visibility source is `normalizedDrawable.visible`, not atlas placement metadata.
- Runtime Player boundary is respected:
  - No source diffs under `apps/runtime-player/src/control` or `apps/runtime-player/src/stage`.
  - No Runtime Player active Variant state, Live Controller UI, bridge/IPC Variant messages, Stage behavior, or Browser Source render behavior changes were found.
- Dependency/source organization conventions are respected:
  - No manifest or lockfile diffs.
  - No `index.ts` implementation growth or new broad catch-all source file.
  - Source organization and dependency guards passed.
- Operation policy is respected:
  - Changes are Runtime Export schema/materialization and tests only.
  - No Operation Core mutation path or package-state mutation behavior was introduced.
- Schema/ID conventions are respected:
  - No incompatible Runtime Export schema version change was introduced.
  - Existing Variant IDs such as `vgrp_*` and `var_*` remain machine-readable and space-free.

## Command Evidence

- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- `node scripts/check-dependencies.mjs` passed.
- `git diff --check` passed; output contained only LF-to-CRLF working-copy warnings.
- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts packages/authoring-core/src/runtime-export-assembly.test.ts`
  - Sandboxed run failed before tests with Vite/esbuild `spawn EPERM`.
  - Escalated rerun passed: 2 files, 26 tests.
- Forbidden-scope status/diff checks over Runtime Player control/stage, runtime/render packages, manifests, and lockfile were empty.

## Design / Development Checklist

| Check | Result | Evidence |
|---|---|---|
| `package-format` owns schema/type compatibility for Runtime Export | pass | Optional `baseVisible` and Runtime Export Variant reference validation live in `packages/package-format/src/runtime-export.ts`. |
| `authoring-core` owns materialization and export-time consistency | pass | `runtime-export-materialization.ts` emits `baseVisible` and default-evaluated `visible`, and sanitizes Variant metadata at export time. |
| Runtime Player changes are compatibility-only; no UI/behavioral switching | pass | No Runtime Player source diffs. |
| `hiddenAtApply` is not abused as `baseVisible` | pass | Diff search found no added `hiddenAtApply`; `baseVisible` is derived from normalized runtime drawable visibility. |
| No broad runtime/render refactor | pass | No diffs under `packages/runtime-core`, `packages/render-core`, or `packages/render-webgl2`. |
| No new dependencies, manifest changes, or lockfile changes | pass | Manifest/lockfile diff checks empty; dependency guard passed. |
| Source organization policy respected | pass | No `index.ts` implementation growth or broad catch-all files; source organization guard passed. |
| Operation policy not violated | pass | Export/materialization remains non-mutating and does not introduce Operation Core package mutation. |
| Schema/ID conventions respected | pass | No schema version invention or machine-readable IDs with spaces found in reviewed changes. |
| Allowed write scope respected / conditional scope justified | pass | Reviewed source changes are within Domain A allowed scope. No conditional runtime/render scope was used. Planning/map doc changes are noted as orchestration/basis artifacts, not reviewed source implementation scope. |

## Findings

None.

## Residual Risks / Open Verification Items

- Full repository, e2e, and browser tests were not run in this review lane.
- Runtime Player compatibility tests were not rerun here because Runtime Player source was untouched; typecheck passed and forbidden-scope diff was empty.
- Planning/basis document and map changes are present in the working tree outside the four reviewed source/test files; final integration should account for ownership and persistence of those discussion artifacts.
