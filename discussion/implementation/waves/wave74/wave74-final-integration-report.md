# Wave74 Final Integration Report: Authoring Save/Load Keyform Hardening + Deformer Foundation Fixes

- Final status: final complete / pass
- Wave gate status: final complete / pass
- Domain: `wave74-final-integration-clean-review-map-closeout`
- Date: 2026-06-15
- Integrator: Orch-Sylph
- Final clean review: `pass` at [../../reviews/wave74/wave74-final-clean-integration-review.md](../../reviews/wave74/wave74-final-clean-integration-review.md)

## Scope

Wave74 hardens the authoring foundation after Wave73 by combining two passed implementation domains:

- Domain A fixes Warp Deformer domain calculation so committed mesh vertices outside source layer bounds are included by create/fit/reset, and pins Rotation keyed `translation` Vec2 interpolation evidence.
- Domain B proves user-visible deformer keyform restoration after portable save/load and adds deterministic keyform discovery affordances without persisting editor-local pose.

Domain C performed the combined validation, obtained independent final clean integration review, and prepared this closeout report/maps. Production source implementation was not edited in Domain C.

## Dependency Gate

| Required artifact | Result | Evidence |
|---|---:|---|
| Domain A implementation report | `pass` | [wave74-domain-a-deformer-foundation-fixes-report.md](wave74-domain-a-deformer-foundation-fixes-report.md) |
| Domain A Spec Compliance Review | `pass` | [../../reviews/wave74/wave74-domain-a-spec-compliance-review.md](../../reviews/wave74/wave74-domain-a-spec-compliance-review.md) |
| Domain A Design / Development Compliance Review | `pass` | [../../reviews/wave74/wave74-domain-a-design-development-review.md](../../reviews/wave74/wave74-domain-a-design-development-review.md) |
| Domain A Test Adequacy Review | `pass` | [../../reviews/wave74/wave74-domain-a-test-adequacy-review.md](../../reviews/wave74/wave74-domain-a-test-adequacy-review.md) |
| Domain B implementation report | `pass` | [wave74-domain-b-save-load-keyform-visibility-hardening-report.md](wave74-domain-b-save-load-keyform-visibility-hardening-report.md) |
| Domain B Spec Compliance Review | `pass` | [../../reviews/wave74/wave74-domain-b-spec-compliance-review.md](../../reviews/wave74/wave74-domain-b-spec-compliance-review.md) |
| Domain B Design / Development Compliance Review | `pass` | [../../reviews/wave74/wave74-domain-b-design-development-review.md](../../reviews/wave74/wave74-domain-b-design-development-review.md) |
| Domain B Test Adequacy Review | `pass` | [../../reviews/wave74/wave74-domain-b-test-adequacy-review.md](../../reviews/wave74/wave74-domain-b-test-adequacy-review.md) |
| Final clean integration review | `pass` | [../../reviews/wave74/wave74-final-clean-integration-review.md](../../reviews/wave74/wave74-final-clean-integration-review.md) records no blocking or needs-change findings. |

## Delivered Integration Evidence

### Warp Mesh-Bounds Domain Behavior

- Warp Deformer draft/create/fit/reset domain resolution now uses committed mesh vertex bounds when committed mesh data exists.
- The mesh-vertex domain expands by deterministic fixed margin `WARP_DEFORMER_DOMAIN_MARGIN = 1`.
- No-mesh drawables keep the existing deterministic fallback bounds behavior.
- Existing committed custom domains are not silently overwritten except through create/fit/reset domain actions.
- Canvas evaluation coverage proves committed mesh vertices outside the source layer bounds deform when the Warp domain includes mesh vertex bounds.

### Rotation Translation Interpolation

- The existing `linear-1d-v1` sampling path is pinned for Vec2 values: exact keys remain exact and midpoint `translation.x` / `translation.y` interpolate linearly.
- `restTranslation` remains the fallback/setup value when no keyed `translation` applies.
- Canvas/runtime evidence uses sampled keyed translation values and preserves parent-child composition behavior.
- Portable bundle evidence preserves keyed Rotation translation and evaluates interpolated translation after load.
- No `restScale` or keyed scale exposure was added.

### Save/Load Deformer Keyform Proof

- The focused portable save/load Playwright path authors, saves, reloads, reselects, and verifies:
  - Warp control-point-offset keyforms;
  - Rotation angle keyforms;
  - Rotation translation keyforms;
  - Drawable opacity keyform restoration;
  - Canvas evaluated Warp offsets, Rotation angle, and Rotation translation after reload.
- The same path also verifies tree reorder/reparent persistence and Drawable runtime visibility restoration.
- Package/runtime/editor tests cover lower-level round-trip and interpolation behavior beyond the browser exact-key path.

### Keyform Discovery Affordance

- Deformer Tree rows now expose compact visible `Keyed N` badges for rows with keyforms.
- Rows also expose deterministic `data-keyform-set-count` and `data-keyform-key-count` attributes for stable assertions.
- The discovery affordance is available after load before restoring any prior selection/current parameter pose.
- Parameter Binding cards include per-property `Add` actions so Rotation translation keyforms can be authored through the existing UI path.

### Deliberately Non-Persisted Editor-Local State

Wave74 preserves the accepted non-persistence policy:

- selection is reset after load;
- current parameter numeric value resets to default;
- Parameter Bar reports no selected target after load;
- active tool, canvas view, undo history, drafts, operation feedback, selected control point, in-progress gestures, and manual collapsed state remain outside portable persistence.

The portable save/load e2e explicitly distinguishes "data lost" from "not visible until the user reselects target/parameter context."

## Must-Not Compliance Evidence

- Domain C edited only Wave74 documentation/maps and did not change production source.
- No mesh generation algorithm changes were made.
- No selection/current slider pose/current parameter values/active tool/canvas view persistence was added.
- No slider performance optimization was implemented.
- No browser-local save slot, archive/filesystem path, new package format, Viewer/Runtime View, Texture Atlas, Variant, Cubism compatibility, external transport, or LLM/provider integration was added.
- `node scripts/check-dependencies.mjs` passed and `git diff --name-status -- package.json pnpm-lock.yaml apps/editor/package.json packages/authoring-core/package.json packages/runtime-core/package.json packages/operation-core/package.json packages/package-format` produced no dependency/package-format changes.

## Validation Results

Validation was performed by Orch-Sylph in the current worktree on 2026-06-15.

| Command | Result |
|---|---|
| `pnpm.cmd typecheck` | passed. |
| `node scripts/check-source-organization.mjs` | passed. |
| `node scripts/check-dependencies.mjs` | passed. |
| `git diff --check` | passed with CRLF normalization warnings only, no whitespace errors. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/runtime-graph-keyforms.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts` | initial sandbox run failed at startup with esbuild `spawn EPERM`; escalated rerun passed, 12 test files / 77 tests. |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts` | initial sandbox run failed at startup with `spawn EPERM`; escalated rerun passed, 1 Playwright test. |
| Review-Sylph final clean review reruns: `node scripts/check-source-organization.mjs`; `node scripts/check-dependencies.mjs`; `git diff --check` | passed; `git diff --check` emitted CRLF normalization warnings only. |

Playwright-generated untracked portable-project JSON was removed after validation.

## Residual Risks

- The portable save/load Playwright path remains broad and can fail from unrelated PSD import, Canvas, tree, or storage regressions.
- Browser proof uses exact deformer keyforms at the default active parameter value; interpolation behavior is covered by focused runtime/editor/package tests.
- The fixed 1px Warp domain margin is intentionally deterministic and geometry-independent. Configurable padding would require a future accepted UX decision.
- Final clean integration review records `pass`; no blocking or needs-change findings remain.

## User Decision Points

None.

## Final Recommendation

Wave74 is final complete / pass. Use [../../reviews/wave74/wave74-final-clean-integration-review.md](../../reviews/wave74/wave74-final-clean-integration-review.md) as the final gate artifact; accepted residual risks above remain non-blocking.
