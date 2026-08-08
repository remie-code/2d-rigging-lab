# Wave104 Implementation Map

> Lightweight map for Wave104 `perception-measurement-command-surface` implementation artifacts.

## Domain Reports

| Path | Domain | Status |
|---|---|---|
| [wave104-domain-a-perception-command-core-report.md](wave104-domain-a-perception-command-core-report.md) | A. Perception Command Core | pass (3 review lanes; 1 fix loop on Test Adequacy, re-verified) |
| [wave104-domain-b-read-integration-validate-chores-report.md](wave104-domain-b-read-integration-validate-chores-report.md) | B. Read Integration / Validate / Chores | pass (3 review lanes; 2 environment-caused needs_fix resolved by L0-controlled install + re-verification) |
| [wave104-domain-c-measurement-ref-e2e-report.md](wave104-domain-c-measurement-ref-e2e-report.md) | C. Measurement + ref e2e | pass (3 review lanes; 1 escalate resolved by §3.4 revision, 1 narrow type-fix loop re-verified) |
| [wave104-final-integration-report.md](wave104-final-integration-report.md) | D. Final Integration / Clean Review / Map Closeout | final complete / pass after final clean review |

## Notes

- Domain A delivered the perception command core: session -> `evaluateViewerRuntimeSnapshot` (runtime-core) -> RenderScene -> PNG, the `renderView` command (whole-model / stageViewport / drawableFocus framing, sweep contact sheet, machine-readable sidecar with packageRevision and resolved view transform), evaluated-bbox helpers, and the new `render` capability as pure-zod schema only (no renderer/FS dependency in ai-interface).
- Domain B delivered the official executor integration of the previously isolated `ai-read-command.ts` mechanism, the `validatePackage` host implementation reachable from the CLI, the state-dir misuse guard (Wave103 A-3), and the render-software out-of-range triangle index test (Wave103 B-1, test-only). Approval lifecycle and dry-run enforcement unrelaxed.
- Domain C delivered `inspectEvaluatedGeometry` (evaluated bbox / vertices / warp lattice control points, reusing Domain A adapters), the §3.4-revised verified-derivation texture dimension ladder (ref's 126 per-layer textures all resolved derived-verified with strict byteLength equality), the read-only `ref/` e2e smoke (4 tests incl. byte-identical determinism), and the user visual gate artifacts under `discussion/model-authoring/experiments/ref-render-gate/`.
- Domain D ran the §9 Required checks (incl. the promoted mandatory `typecheck:authoring-host`), applied the Undine classifications 1-5, verified the A+B+C shared-file integration coherence, delegated the final clean integration review to an independent Review-Sylph (opus), and recorded closeout maps.
- No forbidden-scope behavioral changes (Editor / Runtime Player / render-webgl2 / operation-core / validator-core src / package-format src). `ref/` untouched (read-only fixture). No new external dependencies (`pnpm-lock.yaml` +12 lines are workspace importer links only). runtime-core change is a narrow additive optional export (`evaluatedControlPoints`).
- Final clean integration review is recorded as `pass` with zero blocking findings; Wave104 is final complete / pass. **At Wave104 closeout, the user visual gate (approving the then-generated ref-render-gate PNGs) was outside the wave's technical gate. Later model-authoring evidence records a 2026-07-03 approval, while the post-`45d2734` PNG bytes require separate re-confirmation; this historical map does not claim the current bytes are approved.**
