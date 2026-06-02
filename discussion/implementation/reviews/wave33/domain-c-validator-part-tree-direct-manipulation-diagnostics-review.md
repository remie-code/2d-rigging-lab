# Wave33 Domain C Review: Validator Part Tree Direct-Manipulation Diagnostics

Verdict: `pass`

Reviewer: clean Review-Sylph
Caller: Orch-Sylph
Target: `wave33-validator-part-tree-direct-manipulation-diagnostics`
Date: 2026-06-02

## Scope Reviewed

Reviewed only Domain C files:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/validators/part-layer-semantics.ts`
- `packages/validator-core/src/validators/part-delete-blockers.ts`
- `packages/validator-core/src/validators/part-runtime-evidence.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave33/domain-c-validator-part-tree-direct-manipulation-diagnostics-gnome-note.md`

Dirty Wave33 Domain A/B/editor/runtime files exist in the worktree and were treated as outside this Domain C review scope.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/_conventions.md`
- `discussion/implementation/orchestration/wave33-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave28/wave28-final-report.md`
- `discussion/implementation/waves/wave32/wave32-final-report.md`

## Initial Finding Resolved After Loop 1

### F1. Stale runtime part evidence is silently skipped

Severity: resolved in loop 1

Initial review observed that `validatePartRuntimeEvidence` returned no `part.runtimeEvidenceMismatch` when a supplied `runtimeSnapshot` had part evidence but a stale package identity or revision:

- The initial implementation returned early when `runtimeSnapshot.packageId !== packageDocument.manifest.packageId` or `runtimeSnapshot.packageRevision !== packageDocument.manifest.packageRevision`.
- `packages/validator-core/src/validators/runtime-load.ts` only parses snapshot shape and empty draw list; it does not report package identity staleness.
- The initial test named the new case as stale runtime/viewer evidence, but it mutated a part `displayName` while keeping package identity and revision current, so it did not cover the stale runtime identity path.

Expected behavior:

- Supplied runtime part hierarchy / drawable layer evidence whose `packageId` or `packageRevision` no longer matches the validated package must produce a deterministic validator diagnostic for the part-tree evidence path, either `part.runtimeEvidenceMismatch` as cataloged in this Domain C change or another formal part-tree stale runtime diagnostic if the contract is deliberately revised.
- Add a focused test where `runtimeSnapshot.parts` or `runtimeSnapshot.drawables[*].partId` is present but `runtimeSnapshot.packageRevision` or `packageId` is stale, and assert deterministic evidence including the snapshot id and identity mismatch.

Why this matters:

Wave33 Domain C pass evidence explicitly includes stale editor/runtime/viewer evidence. Editor stale references are covered by `editorState.staleReference`, and viewer stale identity is covered generically by `viewer.runtimeEvidenceStale`; before loop 1, the new part-tree runtime evidence path had a silent gap for runtime snapshot identity staleness.

Loop 1 result:

- `packages/validator-core/src/validators/part-runtime-evidence.ts:74` now checks runtime snapshot part evidence identity before field comparison.
- `packages/validator-core/src/validators/part-runtime-evidence.ts:96` emits deterministic `part.runtimeEvidenceMismatch` checks for stale `packageId` and `packageRevision` with `reason=stale-runtime-snapshot-identity`.
- `packages/validator-core/src/part-texture-layer-diagnostics.test.ts:560` adds focused coverage for stale runtime part evidence package identity and revision.
- The original needs-fix finding is resolved for the scoped case where `runtimeSnapshot.parts` evidence is present.

## Loop 1 Re-Review Findings

No blocking findings.

The stale runtime snapshot identity path now reports deterministic `part.runtimeEvidenceMismatch` diagnostics instead of silently skipping the supplied runtime part evidence. The check catalog and validator contract include the new diagnostic, and the public validator barrel remains export-only.

## Non-Blocking Notes

- `part.duplicateChild`, `part.deleteNonEmpty`, and `part.runtimeEvidenceMismatch` are registered in the validator contract and check catalog with machine-readable dot-separated lower-camel check IDs.
- `packages/validator-core/src/index.ts` remains barrel-only; the new validator logic is split into named responsibility files.
- `part-delete-blockers.ts` keeps delete validation candidate-driven and does not implement operation handlers, recursive delete, runtime algorithms, or Editor UI.
- No dependency manifest or lockfile changes were found.
- Forbidden-scope scan hits in the reviewed files are pre-existing or explicit non-goal / guardrail text in validator contract and catalog content, not new Domain C dependency, renderer, pixel, Cubism, parser, decode, archive, or File System Access expansion.

## Verification Performed

- `pnpm.cmd exec vitest run packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
  - Initial review: pass, 1 file / 11 tests.
  - Loop 1 re-review: pass, 1 file / 12 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src/part-texture-layer-diagnostics.test.ts packages/validator-core/src/viewer-evidence.test.ts packages/validator-core/src/mask-composition-diagnostics.test.ts packages/validator-core/src/rig-control-runtime-evidence.test.ts packages/validator-core/src/warp-lattice-diagnostics.test.ts`
  - Initial review: pass, 5 files / 42 tests.
  - Loop 1 re-review: pass, 5 files / 43 tests.
- `pnpm.cmd typecheck`
  - Initial review: pass, root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.
  - Loop 1 re-review: pass, root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave33`
  - Initial review: pass with LF-to-CRLF working-copy warnings only.
- `git diff --check -- packages/validator-core/src/check-catalog.ts packages/validator-core/src/index.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts packages/validator-core/src/validators/package-runtime.ts packages/validator-core/src/validators/part-layer-semantics.ts discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave33/domain-c-validator-part-tree-direct-manipulation-diagnostics-gnome-note.md discussion/implementation/reviews/wave33/domain-c-validator-part-tree-direct-manipulation-diagnostics-review.md`
  - Loop 1 re-review: pass with LF-to-CRLF working-copy warnings only.
- `git diff --check --no-index -- NUL <new Domain C file>` for:
  - `packages/validator-core/src/validators/part-delete-blockers.ts`
  - `packages/validator-core/src/validators/part-runtime-evidence.ts`
  - `discussion/implementation/waves/wave33/domain-c-validator-part-tree-direct-manipulation-diagnostics-gnome-note.md`
  - Initial review and loop 1 re-review: no whitespace errors observed; `--no-index` returned exit code 1 as expected for comparing `NUL` with file content, with LF-to-CRLF warnings only.
- Dependency manifest check:
  - Loop 1 re-review found no `package.json`, package manifest, or `pnpm-lock.yaml` changes in Domain C.

## Residual Risks

- Test coverage now exercises duplicate child, delete blockers, same-identity runtime/viewer part field mismatch, stale runtime snapshot package identity/revision, existing missing parent/child/cycle/editor stale cases, and adjacent viewer/mask/rig/warp evidence batches.
- Runtime part evidence comparison is intentionally skipped when the package part hierarchy itself is unstable; package hierarchy diagnostics fire first in those cases.
