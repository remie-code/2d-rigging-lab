# Wave92 Domain B Design / Development Compliance Review

## Verdict

pass

No blocking or needs-change design/development compliance findings were found.

## Scope Reviewed

- Domain B source/tests:
  - `packages/authoring-core/src/runtime-export-assembly.ts`
  - `packages/authoring-core/src/runtime-export-materialization.ts`
  - `packages/authoring-core/src/runtime-export-assembly.test.ts`
  - `packages/authoring-core/src/index.ts`
- Domain A package-format boundary files, to verify contract-only ownership:
  - `packages/package-format/src/runtime-export.ts`
  - `packages/package-format/src/runtime-export-file-set.ts`
  - `packages/package-format/src/index.ts`
- Boundary checks for forbidden or unrelated scopes:
  - `apps/editor/**`
  - `packages/runtime-core/**`
  - `packages/operation-core/**`
  - package manifests and `pnpm-lock.yaml`

## Basis Documents Used

- `discussion/implementation/orchestration/wave92-plan.md`
- `discussion/design/module-contracts/runtime-export-v0-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/implementation/waves/wave92/wave92-domain-a-runtime-export-package-contract-report.md`
- `discussion/implementation/reviews/wave92/wave92-domain-a-design-development-review.md`

## Findings

No blocking findings.

Informational compliance evidence:

- `package-format` remains a pure contract/file-set layer. Domain A's report lists the package-format Runtime Export files as Domain A changes, not Domain B ownership (`discussion/implementation/waves/wave92/wave92-domain-a-runtime-export-package-contract-report.md:7`, `:19`), and the files themselves define DTO/schema/path/file-set helpers rather than assembly, browser IO, runtime-player, or authoring behavior (`packages/package-format/src/runtime-export.ts:46`, `:201`, `:506`, `:657`; `packages/package-format/src/runtime-export-file-set.ts:52`, `:112`, `:147`). Domain A's design review already recorded this as a pure package-format contract pass (`discussion/implementation/reviews/wave92/wave92-domain-a-design-development-review.md:87`).
- Domain B ownership is correctly in `authoring-core`. The public APIs are preflight/assembly (`packages/authoring-core/src/runtime-export-assembly.ts:130`, `:139`), committed-atlas/source-signature checks reuse existing atlas helpers (`packages/authoring-core/src/runtime-export-assembly.ts:178`, `:219`, `:225`), binary/page/placement checks are local to assembly (`packages/authoring-core/src/runtime-export-assembly.ts:326`, `:458`, `:576`), and materialized export graph creation is isolated in `runtime-export-materialization.ts` (`packages/authoring-core/src/runtime-export-materialization.ts:67`, `:169`, `:204`, `:222`).
- `apps/editor` still owns UX and browser directory IO. Domain B added no editor files in the scoped status/diff check, and no Browser File System Access/API symbols were found in the Runtime Export package/authoring files. This matches the contract boundary that editor owns task UI and directory write flow (`discussion/design/module-contracts/runtime-export-v0-contract.md:47`, `:51`).
- `runtime-core` was not made dependent on package/authoring/file IO, and Domain B does not require runtime-core source changes. Domain B reuses the existing authoring adapter (`packages/authoring-core/src/runtime-export-materialization.ts:39`, `:72`); the adapter's runtime-core relationship is a type-only `NormalizedRuntimeGraph` import (`packages/authoring-core/src/to-runtime-graph.ts:1`). Scoped diff/status checks showed no `packages/runtime-core/**` changes.
- `operation-core` is not used for this non-mutating export assembly. Runtime Export assembly returns artifacts/file sets from an `AuthoringSession` (`packages/authoring-core/src/runtime-export-assembly.ts:139`, `:169`) and does not import operation-core. This matches the operation policy boundary for mutation-only gateway usage (`discussion/development_convention/operation-policy.md:87`) and the Runtime Export contract statement that operation-core is not involved (`discussion/design/module-contracts/runtime-export-v0-contract.md:49`).
- No new dependencies or lockfile changes were found. Scoped manifest/lockfile status produced no changes, and `node scripts/check-dependencies.mjs` passed. This satisfies the dependency policy requirement that new dependencies need approval before manifest or lockfile changes (`discussion/development_convention/dependency-policy.md:96`, `:333`).
- Source organization is compliant. `packages/authoring-core/src/index.ts` remains barrel-only with a single Runtime Export re-export (`packages/authoring-core/src/index.ts:64`), matching the source organization policy for `index.ts` (`discussion/development_convention/source-file-organization-policy.md:51`, `:69`). Runtime Export responsibilities are split between assembly/preflight and materialization files, with no new catch-all source file; `node scripts/check-source-organization.mjs` passed.
- Mesh generation, Texture Atlas packing, Workspace Save, Portable JSON, and Viewer Atlas Runtime behavior are preserved by scope. No mesh generation, atlas packing, workspace save, portable export, or viewer source files were changed. The design basis requires Apply Atlas to preserve authoring texture/UV state (`discussion/design/screen-design/screens/texture-atlas-task.md:99`, `:240`, `:241`) and Viewer Atlas Runtime to remain a viewer projection-only remap (`discussion/design/screen-design/screens/viewer-runtime-view.md:198`, `:199`).
- Domain B's UV remap is local and contract-driven, not an unsafe editor/viewer dependency leak. The export graph writes `atlasUvs` and texture page refs in authoring-core (`packages/authoring-core/src/runtime-export-materialization.ts:154`, `:490`, `:507`), directly matching the Runtime Export contract that materialized graphs contain atlas-applied UVs and that `runtime/atlas.json` is not the main render path (`discussion/design/module-contracts/runtime-export-v0-contract.md:20`, `:101`, `:120`). The existing viewer-only remap remains in editor projection code (`apps/editor/src/workspace/viewer/viewer-render-source.ts:442`, `:468`, `:479`) and was not modified.

## Verification Notes

- `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-assembly.test.ts`
  - First sandboxed run failed with `spawn EPERM` while Vitest/esbuild loaded config.
  - Escalated rerun passed: 1 file, 12 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- packages/authoring-core/src discussion/implementation/waves/wave92 discussion/implementation/reviews/wave92`: no whitespace errors; reported only the known LF/CRLF warning for `packages/authoring-core/src/index.ts`.
- Scoped status/diff checks showed no changes under `apps/editor`, `packages/runtime-core`, `packages/operation-core`, package manifests, or `pnpm-lock.yaml`.
- Parent verification context says the combined dependency-boundary run still fails because of existing `packages/authoring-core/src/portable-project-bundle.test.ts`; this review confirmed the Domain B Runtime Export files do not directly import runtime-core.

## Remaining Issues / User-decision Points

- No Domain B design/development blocking issues.
- No user decision is required for Domain B.
- Non-blocking residual: if future waves require strict pixel parity between exported runtime bundles and Viewer Atlas Runtime, consider extracting a pure atlas UV mapping helper from the placement contract. Current Domain B behavior is acceptable because Runtime Export v0 explicitly owns a materialized graph with atlas-applied UVs.
