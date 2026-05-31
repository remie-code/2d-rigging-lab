# Wave 24 Domain C Completion: Viewer Validator Report Integration

> Target: `wave24-viewer-validator-report-integration`
> Date: 2026-06-01
> Role: Gnome implementation agent
> Status: `pass`

## Summary

Domain C is implemented as a narrow validator/report integration on top of Domain A viewer runtime evidence.

The change adds viewer evidence validation for `ViewerRuntimeEvaluationEvidence`, wires it into `validatePackageRuntime` and the binary-aware package runtime validation path, records stable runtime snapshot/state refs in the existing validation report evidence shape, and adds deterministic diagnostics for missing or stale viewer evidence. It does not add runtime evaluator behavior, editor UI behavior, package schema redesign, external dependencies, file picker/parser/image decode/binary upload work, or Cubism compatibility claims.

## Changed Files

Source:

- `packages/validator-core/src/validators/viewer-evidence.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`

Tests:

- `packages/validator-core/src/viewer-evidence.test.ts`

Docs:

- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave24/wave24-domain-c-viewer-validator-report-integration-completion.md`

## Pass Evidence

- Valid viewer snapshot plus Domain A viewer evaluation evidence validates with `profile: "viewer"` and produces a pass report.
- Viewer report evidence records baseline/current `runtimeSnapshotIds`, deterministic runtime snapshot artifact paths, and the final runtime state ref for AI/read-command inspection.
- Missing viewer evidence in viewer profile emits deterministic `viewer.runtimeEvidenceMissing`.
- A supplied runtime snapshot with non-viewer context emits deterministic `viewer.runtimeEvidenceStale`.
- Existing source/PSD/binary/dynamics validators remain compatible through the validator-core focused suite.
- Public `index.ts` change is barrel-only.

## Verification

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/viewer-evidence.test.ts` | pass; 1 file / 4 tests |
| `pnpm.cmd exec vitest run packages/validator-core/src/validator-core.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/validator-core/src/binary-asset-validator.test.ts packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/source-asset-rights-provenance.test.ts packages/validator-core/src/runtime-evidence-report.test.ts packages/validator-core/src/validation-report-artifacts.test.ts` | pass; 7 files / 49 tests |
| `pnpm.cmd exec vitest run packages/validator-core/src` | pass; 11 files / 59 tests |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/validator-core discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24 discussion/design/module-contracts/validator-contract.md` | pass; Git emitted LF/CRLF working-copy warnings only |
| `pnpm.cmd typecheck` | fail outside Domain C; latest failure is in parallel editor viewer UI files `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts` for readonly array assignment and string `.path` access |

## Residual Risks

- Full repo typecheck cannot pass until parallel Domain B editor viewer UI type errors are fixed. Root package typecheck reached the editor package before failing there; no Domain C type errors were reported in the latest run.
- Stable viewer runtime artifact refs are stored in the existing report field `supplementalGuiEvidenceRefs` to stay schema-compatible. The field name is GUI-oriented, but the values are deterministic package-relative evidence refs.
- Viewer validation checks supplied evidence alignment and report refs. It intentionally does not re-run viewer runtime evaluation or implement any runtime semantics.

## User Decision Points

None.
