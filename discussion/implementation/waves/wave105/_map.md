# Wave105 Implementation Map

> Lightweight map for Wave105 `variant-visibility-gate-perception` implementation artifacts.

## Domain Reports

| Path | Domain | Status |
|---|---|---|
| [wave105-domain-a-variant-visibility-gate-report.md](wave105-domain-a-variant-visibility-gate-report.md) | A. Variant Visibility Gate | pass (3 review lanes; 1 fix loop on Test Adequacy P5, re-verified) |
| [wave105-domain-a-gnome-report.md](wave105-domain-a-gnome-report.md) | A. Gnome implementation report | complete |
| [wave105-domain-a-gnome-fix-report.md](wave105-domain-a-gnome-fix-report.md) | A. Gnome fix report (Test Adequacy P5 gap closure) | complete (test-only, production code unchanged) |
| [wave105-final-integration-report.md](wave105-final-integration-report.md) | B. Final Integration / Clean Review / Map Closeout | final complete / pass after final clean review |

## Notes

- Domain A delivered the perception Variant visibility gate: `applyVariantVisibilityGate` (`apps/authoring-host/src/perception/evaluation-adapter.ts`) composes `base visible && variantVisibilityPredicate(activeSelections)` at the snapshot level and returns a NEW snapshot (drawables re-mapped, drawList re-derived, runtime-core result non-destructive). Render (`render-view-command.ts`, incl. sweep cells), measurement (`measurement-command.ts`), and framing (`view-resolution.ts` via `modelEvaluatedBounds` / `evaluatedDrawableBounds`) all consume this single gated snapshot — the eye, the tape measure, and the framing share one visibility world.
- Consumes authoring-core pure functions `createVariantVisibilityPredicate` / `resolveDefaultVariantActiveSelections` (no re-implementation). runtime-core stays variant-unaware (design intent).
- `renderView` / `inspectEvaluatedGeometry` gained an optional `variantSelections` payload (shared zod shape, `packages/ai-interface/src/ai-variant-selection.ts`, dependency-clean: id patterns inlined, package-format not imported). Omitted = defaultActive; unknown group/variant and mode mismatch are deterministically rejected. Resolved selection recorded in render sidecar + measurement result; measurement carries per-drawable gated `visible` flag.
- The `modelEvaluatedBounds` visible-only union refinement (`evaluated-bounds.ts`) was flagged by Gnome, ruled valid/keep by Spec Compliance (framing shares the visibility world), and its test gap (P5) closed by a Gnome test-only fix adding `evaluated-bounds.test.ts` (direct unit test placing a hidden drawable outside the visible union bbox; union-all revert reddens it).
- ref visual gate PNGs (`discussion/model-authoring/experiments/ref-render-gate/`) regenerated in the Default outfit: `ref-rest-full.png` (framing tightened 392x1024 -> 389x1024), `ref-face-focus.png` (overlaid outfit layers removed from frame), `ref-eyes-viewport.png` (bytes unchanged; only sidecar variantSelections record added). Determinism (2x fresh-dir byte identity) maintained.
- Artifact-wait protocol experiment (§3.2): Orch-Sylph completed both Domain A and Domain B loops with **0 L0 relays**, 0 death presumptions, dual-channel (foreground wait-loop file detection + completion notification) confirmed. Observations recorded in Domain A report §5 and Final report §5.
- No forbidden-scope changes: runtime-core / authoring-core / render-software / render-webgl2 / operation-core / validator-core / package-format / apps/editor / apps/runtime-player / `ref/` all git-clean. Boundary unrelaxed, no new external dependencies, lockfile unchanged.
- Focused tests 241 passed (40 files); root + app (authoring-host) tsc exit 0; source-organization pass; check-dependencies cmo3 finding is the known prior false positive (classification 1, no wave105-origin finding).

## Final Gate

- Final clean integration review recorded `pass` (zero blocking findings). Wave105 is final complete / pass.
- **The user visual gate (approving the regenerated ref-render-gate PNGs in the Default outfit) is outside the wave and is the next action.**
