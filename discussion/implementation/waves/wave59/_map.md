# Wave59 Map

> Lightweight map for Wave59 `canvas-renderer-psd-drawable-display-v0`.

## Status

- Final status: complete / pass.
- Final gate: Domain B closeout and clean integration review.
- Bounded implementation-proven scope: imported PSD drawable display on Canvas / Preview, runtime derived render-byte availability, PSD opacity preservation, Canvas 2D rendering, zoom / pan / fit / 1:1 controls, toolbar overlays, Parts Tree to Canvas selection, Canvas click selection, runtime visibility reflection, Isolate Selected, and renderer-side existing mask relation support.
- Explicit limitation: PSD clipping extraction is blocked by the public `@webtoon/psd@0.4.0` API/private-shape boundary and is not claimed as implemented.

## Key Files

| Path | Content |
|---|---|
| [../../orchestration/wave59-plan.md](../../orchestration/wave59-plan.md) | Wave59 plan and pass criteria. |
| [domain-a-gnome-report.md](domain-a-gnome-report.md) | Domain A implementation report; verdict `done`; validation evidence recorded. |
| [../../reviews/wave59/domain-a-ux-source-structure-review.md](../../reviews/wave59/domain-a-ux-source-structure-review.md) | UX / source-structure review; verdict `pass`. |
| [../../reviews/wave59/domain-a-package-data-contract-review.md](../../reviews/wave59/domain-a-package-data-contract-review.md) | Package / data-contract review; verdict `pass`; clipping limitation assessed. |
| [../../reviews/wave59/domain-a-test-e2e-review.md](../../reviews/wave59/domain-a-test-e2e-review.md) | Test / E2E review; verdict `pass`. |
| [wave59-domain-b-final-integration-closeout-report.md](wave59-domain-b-final-integration-closeout-report.md) | Domain B final integration closeout; verdict `pass`. |
| [../../reviews/wave59/wave59-final-clean-integration-review.md](../../reviews/wave59/wave59-final-clean-integration-review.md) | Final clean integration review; verdict `pass`. |

## Validation Evidence

- Domain A recorded app typecheck/build, root typecheck, focused Vitest, full unit suite, root check, PSD parser smoke, focused Playwright E2E, scoped `git diff --check`, and dev-server/process cleanup evidence as pass.
- Review lanes independently corroborated focused tests, scoped whitespace checks, E2E oracle compliance, source-structure guard, package/data-contract boundaries, and process evidence.
- Domain B did not rerun the full source validation suite; it verified report existence/coherence, map status, git status/diff summaries, and recorded evidence.

## Residual Risks / Next Action Candidates

- Decide future PSD clipping extraction strategy: public parser API, approved dependency/product boundary, or explicit private-shape policy change.
- Keep future Canvas work from claiming Photoshop pixel parity, blend-mode parity, alpha-aware hit testing, mesh editing, atlas packing, or Cubism compatibility unless a later plan adds them.
- Consider cache digest/versioning and byte registration verification if future workflows support same-id binary replacement or broader binary intake.
- Align model draw order, Parts Tree visual order, and runtime draw-order terminology in later row reorder/UI work.
