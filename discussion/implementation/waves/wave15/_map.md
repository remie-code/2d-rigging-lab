# Wave 15 Map

> Wave: `editor-drawable-mesh-authoring-vertical-slice`
> Current status: `Completed / implementation-proven`

## Files

| Path | Role | Status |
|---|---|---|
| [wave15-drawable-mesh-operation-foundation-completion.md](wave15-drawable-mesh-operation-foundation-completion.md) | Domain A completion report | `pass` |
| [wave15-created-drawable-runtime-evidence-regression-completion.md](wave15-created-drawable-runtime-evidence-regression-completion.md) | Domain B completion report | `pass` |
| [wave15-editor-drawable-authoring-workflow-state-completion.md](wave15-editor-drawable-authoring-workflow-state-completion.md) | Domain C completion report | `pass` |
| [wave15-editor-drawable-authoring-ui-completion.md](wave15-editor-drawable-authoring-ui-completion.md) | Domain D completion report | `pass` |
| [wave15-drawable-authoring-e2e-and-persistence-smoke-completion.md](wave15-drawable-authoring-e2e-and-persistence-smoke-completion.md) | Domain E completion report | `pass` |
| [wave15-operation-lifecycle-supported-generate-mesh-fix-completion.md](wave15-operation-lifecycle-supported-generate-mesh-fix-completion.md) | Needs-fix completion report for operation lifecycle regression | `pass` |
| [integration-review.md](integration-review.md) | Domain F clean integration review after needs-fix rerun | `pass` |
| [wave15-final-report.md](wave15-final-report.md) | Wave 15 final report | `pass` |

## Needs-Fix Loop

- Initial Domain F verdict was `needs_fix` because root `pnpm.cmd test` failed in `packages/operation-core/src/operation-lifecycle.test.ts`.
- The regression still treated now-registered `generateMesh` as an unsupported operation.
- The fix split registered `generateMesh` missing-drawable coverage from unsupported-operation coverage and uses schema-valid, unregistered `moveMeshVertex` for the unsupported lifecycle oracle.

## Final Verification

| Command | Result |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd test` | pass after sandbox escalation, 73 files / 358 tests |
| `pnpm.cmd test:e2e` | pass after sandbox escalation, desktop and mobile smoke |
| `pnpm.cmd run check:source` | pass |
| `git diff --check -- .` | pass with LF/CRLF warnings only |
| Untracked file trailing-whitespace check | pass |

## Capability Proven

Wave 15 proves GUI creation of rights-clean generated drawable / deterministic mesh, operation log persistence, package file set persistence, save/load restore, runtime/validation evidence, and embedded preview observation.
