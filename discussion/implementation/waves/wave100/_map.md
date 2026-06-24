# Wave100 Implementation Waves Map

> Lightweight index for Wave100 implementation reports.

## Domain Reports

| Domain | Status | Report |
|---|---|---|
| Domain A: Viewer Variant Switching Integration | Pass | [wave100-domain-a-viewer-variant-switching-integration-report.md](wave100-domain-a-viewer-variant-switching-integration-report.md) |
| Domain B: Final Integration / Clean Review / Map Closeout | Pass | [wave100-final-integration-report.md](wave100-final-integration-report.md) |

## Notes

- Domain A added Viewer-local Variant active selection, default-active initialization, group-change reconciliation, reset-to-default behavior, and Runtime Controls Variant switching UI.
- Domain A applies the Variant visibility predicate before render source remap, so both `Original` and `Atlas Runtime` respect the same active selection.
- Domain A review lanes passed with no blocking findings and no fix loop.
- Domain B reran focused Viewer/Variant tests, typecheck, source organization guard, dependency guard, `git diff --check`, and forbidden-scope checks.
- Domain B final clean integration review passed with no blocking or non-blocking findings.
- Runtime Player, package format, Operation Core, Runtime Export, Workspace Save / Portable JSON, Texture Atlas policy, dependency manifests, and lockfile remain untouched.
