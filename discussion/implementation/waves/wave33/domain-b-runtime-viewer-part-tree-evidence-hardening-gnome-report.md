# Wave33 Domain B Gnome Report: Runtime / Viewer Part Tree Evidence Hardening

Verdict: `done`

## Scope

- Target: `wave33-runtime-viewer-part-tree-evidence-hardening`
- Date: 2026-06-02
- Changed scope: `packages/runtime-core/src/**`, `discussion/implementation/waves/wave33/**`

## Changes

- Hardened focused runtime-core coverage for existing runtime/viewer semantic evidence.
- Added proof that `RuntimeSnapshotDto.parts` and viewer `partHierarchyEvidence` reflect part `displayName` rename.
- Added proof that `parentPartId`, `childPartIds`, and `hierarchyPath` reflect reparenting.
- Added proof that an empty leaf part absent from the candidate graph is absent from runtime and viewer hierarchy evidence, with a stable `/parts/<partId>` diff removal path.
- Added proof that drawable membership remains stable across rename, reparent, and empty-leaf deletion absence observations. The tests assert no `/drawables/...` layer diff churn and no drawable runtime-state or geometry diff churn for these structural-only observations.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/runtime-core/src/layer-tree-evidence.test.ts`
  - 1 file, 4 tests passed.
- `pnpm.cmd typecheck`
  - root and editor typecheck passed.
- `git diff --check -- packages/runtime-core/src/layer-tree-evidence.test.ts discussion/implementation/waves/wave33`
  - exit 0; Git reported only the existing LF-to-CRLF working-copy warning for `packages/runtime-core/src/layer-tree-evidence.test.ts`.

## Compliance Notes

- No operation handler implementation.
- No Editor UI implementation.
- No validator implementation.
- No full renderer, pixel oracle, texture sampling correctness claim, or Cubism compatibility claim.
- No external dependency, package manifest, or lockfile changes.
- No `index.ts` changes; barrel-only rule unaffected.
- Runtime behavior was preserved; this Domain B change hardens the semantic evidence tests around existing runtime/viewer fields and diff paths.

## Remaining Issues

- None for the bounded Domain B scope.
- The workspace already had unrelated dirty discussion files before this edit; they were not modified by this Domain B implementation.
