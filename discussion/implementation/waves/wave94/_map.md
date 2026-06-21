# Wave94 Implementation Reports Map

> Lightweight map for Wave94 nested Warp rest/bind membership semantics implementation reports.

## Status

Domain A complete / pass. Domain B complete / pass. Domain C final integration complete / pass. Wave94 final gate passed.

## Reports

| Report | Status | Contents |
|---|---|---|
| [wave94-domain-a-runtime-core-nested-warp-rest-bind-semantics-report.md](wave94-domain-a-runtime-core-nested-warp-rest-bind-semantics-report.md) | done / pass-reviewed | Runtime core dual-stream rig evaluation, rest/reference Warp membership and sampling, child-deformed current displacement application, mismatch fallback, tests, and review result. |
| [wave94-domain-b-editor-canvas-nested-warp-rest-bind-parity-gnome-report.md](wave94-domain-b-editor-canvas-nested-warp-rest-bind-parity-gnome-report.md) | done / implementation-evidence | Gnome implementation evidence for Canvas dual-stream evaluation, Runtime/Canvas numeric parity tests, helper reuse deferral, and focused verification. |
| [wave94-domain-b-editor-canvas-nested-warp-rest-bind-parity-report.md](wave94-domain-b-editor-canvas-nested-warp-rest-bind-parity-report.md) | done / pass-reviewed | Editor Canvas rest/reference Warp membership and sampling parity, contract comment alignment, tests, review results, deferrals, and Domain C readiness. |
| [wave94-final-integration-report.md](wave94-final-integration-report.md) | done / pass-reviewed | Final Runtime + Canvas integration verification, required checks, forbidden-scope drift review, final clean review path, deferred items, and Wave94 completion status. |

## Verification Summary

- Focused runtime-core suite passed: 3 files / 22 tests.
- Focused Canvas evaluation suite passed: 1 file / 16 tests.
- Focused Runtime/Canvas parity suite passed: 2 files / 20 tests.
- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- `node scripts/check-dependencies.mjs` passed in review.
- `git diff --check` passed; LF-to-CRLF working-copy warnings only.
- Final clean integration review passed with no blocking findings.

## Deferred / Non-blocking

- `rigControl.warpBindingOutsideDomain` validator diagnostic remains deferred follow-up scope.
- No Runtime helper was exported for Canvas reuse in Domain A.
- Domain B mirrored the small Canvas-local bilinear Warp logic instead of adding an Editor -> runtime-core dependency.
