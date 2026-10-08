# Wave92 Implementation Reports Map

> Lightweight map for Wave92 Runtime Export v0 implementation reports.

## Status

Final complete / pass.

## Reports

| Report | Status | Contents |
|---|---|---|
| [wave92-domain-a-runtime-export-package-contract-report.md](wave92-domain-a-runtime-export-package-contract-report.md) | pass | `package-format` Runtime Export DTO/schema/file-set contract. |
| [wave92-domain-b-runtime-export-assembly-preflight-report.md](wave92-domain-b-runtime-export-assembly-preflight-report.md) | pass | `authoring-core` assembly, preflight, atlas validation, target filtering, and materialization. |
| [wave92-domain-c-runtime-export-editor-task-report.md](wave92-domain-c-runtime-export-editor-task-report.md) | pass | Editor Runtime Export task, directory write flow, toolbox route, and app tests. |
| [wave92-final-integration-report.md](wave92-final-integration-report.md) | pass | Final integration evidence, verification results, forbidden-scope checks, and final gate decision. |

## Verification Summary

- Focused Runtime Export tests passed: 4 files, 33 tests.
- Focused Workspace Save / Portable JSON non-regression tests passed: 3 files, 37 tests.
- `pnpm.cmd typecheck` passed.
- Source organization guard passed.
- Dependency guard passed.
- `git diff --check -- .` passed with LF/CRLF warnings only.

## Deferred / Non-blocking

- Real browser File System Access picker e2e is not covered in Wave92.
- Domain B has recommended test hardening follow-ups for branch-level blockers, deeper graph assertions, and file-set round-trip parsing.
- External runtime/player pixel parity remains out of scope.
