# Wave62 Domain A Review: Mesh Auto Outline v1

- Status: pass
- Domain id: `wave62-mesh-auto-outline-v1`
- Reviewer: Review-Sylph
- Date: 2026-06-12

## Scope Reviewed

Reviewed independently from source, diff, tests, and report, not only from the Gnome summary.

Primary implementation files reviewed:

- `packages/authoring-core/src/mesh-outline-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `discussion/implementation/waves/wave62/wave62-domain-a-mesh-auto-outline-v1-report.md`

Basis documents consulted:

- `discussion/implementation/orchestration/wave62-plan.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`

## Findings

No blocking or needs-fix findings for Domain A.

## Design / Development Compliance Review

- `Large Motion` / `Standard` / `Low Motion` presets remain present in `apps/editor/src/features/editor-session/model/mesh-tool-state.ts` and still map to `high` / `medium` / `low` density hints.
- `auto-outline-v1` is implemented as package logic, not a GUI-only workaround. `packages/authoring-core/src/mesh-outline-generation.ts` builds an alpha mask from RGBA bytes, extracts directed boundary edges, simplifies contour loops by density, samples interior points, triangulates deterministically, filters triangles against alpha samples, and maps pixel points to stage vertices and UVs.
- The new `auto-outline-v1` method is routed through Operation Core. `packages/operation-core/src/operations/generate-mesh.ts` no longer rejects the method, validates preview mesh commit payloads for generated drafts, and keeps mutation through `replaceDrawableMesh`.
- Editor preview/apply integration is coherent with the Mesh Tool design. `apps/editor/src/features/editor-session/editor-session-context.tsx` creates `auto-outline-v1` drafts, applies the draft through `generateMesh`, and clears/cancels draft state without committing until Apply.
- Mesh Inspector surfaces source and fallback reason for preview drafts. This satisfies the accepted fallback-or-blocked requirement for bytes unavailable, empty alpha, contour extraction failure, and triangulation failure at the user-facing preview point.
- Canvas preview still distinguishes draft and committed mesh overlays via existing projection/rendering state.
- Source organization is acceptable: the new outline file is large but cohesive around one algorithmic responsibility, `index.ts` remains a barrel export, and the repository source organization guard passes.
- No dependency manifest or lockfile changes were detected; the implementation uses in-repo deterministic geometry logic rather than adding an unreviewed triangulation dependency.

## Test Adequacy Review

Focused tests cover the critical package behavior:

- alpha-derived outline vertices and avoidance of transparent centroid triangles;
- Large Motion producing more vertices/triangles than Standard, and Standard more than Low Motion;
- deterministic output for identical input;
- explicit fallback when alpha is empty;
- operation commit of `auto-outline-v1` from RGBA bytes and operation provenance source;
- preview mesh apply path and invalid preview mesh rejection.

Focused E2E covers the preserved user path:

- hidden Drawable selection;
- Mesh Tool preview;
- Apply to committed mesh;
- Regenerate to replacement draft;
- Cancel preserving committed mesh;
- overlay toggle behavior.

Non-blocking gaps:

- No direct editor command unit test asserts that `commitGenerateMesh` now defaults to `auto-outline-v1`; the E2E and operation tests cover the active user path.
- Complex holes, multiple islands, and thin shapes are not exhaustively tested. The plan allows best-effort initial handling, so this remains a quality-tuning residual risk rather than a Wave62 Domain A blocker.
- Fallback reason is visible on the preview draft. When applying a preview mesh, operation provenance records `meshSource:previewMesh`; fallback details are not preserved through the previewMesh payload. This is not blocking for the stated UX fallback requirement, but a future evidence enhancement could carry draft source/fallback metadata into operation history.

## Verification

- `git diff --check`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`: pass, 6 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts`: pass, 9 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`: pass, 3 tests.
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`: pass, 4 tests.
- `pnpm.cmd typecheck`: failed, but errors are attributable to concurrent non-Domain-A Warp Deformer files:
  - `packages/operation-core/src/operations/create-warp-deformer.ts(194,3)`
  - `packages/package-format/src/warp-deformer-contract.ts(196,67)`

Note: initial Vitest runs inside the sandbox failed with `spawn EPERM` while loading `vitest.config.ts` through esbuild. The same focused Vitest commands passed when rerun with approved sandbox escalation.

## Acceptance Trace

- Presets maintained: pass.
- RGBA alpha mask contour extraction: pass.
- Boundary vertices placed from alpha contour: pass, with focused test coverage.
- Avoids large transparent-rectangle coverage as primary result: pass for tested contour/notch path; complex holes remain residual quality risk.
- Large Motion denser than Standard / Low Motion: pass, with focused test coverage.
- Deterministic generation: pass, with focused test coverage.
- Preview -> Apply, Regenerate -> Apply, Cancel routes preserved: pass, with E2E coverage.
- Bytes unavailable / alpha empty / extraction failure fallback or blocked display: pass for explicit fallback path; alpha-empty covered by unit test, UI source/fallback display reviewed in source.

## Residual Risks / Open Verification Items

- Run full `pnpm.cmd typecheck` again after Domain B Warp Deformer files are fixed or isolated.
- Add future tests for holes, multiple islands, very thin alpha shapes, and fallback metadata preservation if operation evidence needs to retain preview draft fallback details after Apply.
