# Wave68 Domain E Spec Compliance Review

- Verdict: `pass` after Fix Loop 1
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-editor-temporary-v6-backend-selector-preview-provenance`
- Review lane: Spec Compliance
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Summary

Domain E adds a temporary backend selector in the existing Mesh Tool, keeps the preset control separate, defaults to `auto-outline-v2.6-soft-apron`, and lets the user explicitly preview the v6a/v6b/v6c candidates. The inspector also shows compact source/fallback/v6 quality information, including whether v6 output is backend output, fallback output, or blocked.

Initial review returned `needs_changes` because preview Apply committed mesh geometry and method but dropped the preview's actual source, fallback steps/reason, and v6 quality/provenance metrics. Fix Loop 1 resolves that finding: Editor Apply now passes `previewProvenance`, operation-core records `previewMeshSource:<actual>`, fallback data, and v6 quality transform history, and tests cover both backend-output and fallback-output preview commits.

## Findings

No open Spec Compliance findings remain after Fix Loop 1.

### 1. Initial finding: Apply dropped preview source/fallback/v6 quality provenance

Initial severity: blocking for Spec Compliance.

Status after Fix Loop 1: resolved.

Domain E requires "Apply commits the previewed mesh and provenance correctly" at `discussion/implementation/orchestration/wave68-plan.md:495`, and its implementation guidance calls for method/source/fallback/quality summary plus preview/apply semantics at `discussion/implementation/orchestration/wave68-plan.md:487` through `:488`.

At initial review time, the editor draft had preview source/fallback/quality data, but Apply only forwarded the preview mesh geometry and method. Operation provenance therefore recorded only `meshSource:previewMesh` and did not retain the preview's actual source, fallback state, or v6 quality evidence. Fix Loop 1 supersedes that source state.

Resolution evidence from Fix Loop 1:

- `applyMeshDraft` now passes `source`, `fallbackReason`, `fallbackSteps`, and `qualityMetrics` with the preview mesh and method at `apps/editor/src/features/editor-session/editor-session-context.tsx:690` through `:710`.
- `commitGenerateMesh` now accepts and forwards `previewProvenance` at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:274` through `:290`.
- `GenerateMeshPayloadSchema` now includes `previewProvenance` with preview source, fallback, and quality metrics at `packages/operation-core/src/payloads/model-edit.ts:255` through `:268`, and rejects provenance without a preview mesh at `:270` through `:275`.
- The operation preview path now reads preview source/fallback/quality values at `packages/operation-core/src/operations/generate-mesh.ts:105` through `:114`, passes them into the provenance record at `:147` through `:156`, records `previewMeshSource:<actual>` at `:326` through `:335`, and formats v6 actual source/output/fallback/diagnostics at `:487` through `:560`.
- Editor command coverage now expects `previewMeshSource:outline-v6a-local-rgba`, `meshQuality:v6ActualSource=outline-v6a-local-rgba`, and `meshQuality:v6Output=backend-output` for a v6A preview commit at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:686` through `:740`.
- Operation-core coverage now verifies backend-output preview provenance for v6A at `packages/operation-core/src/operations/generate-mesh.test.ts:641` through `:683`, and fallback-output preview provenance for v6C at `:685` through `:730`.

## Acceptance Classification

| Domain E acceptance item | Classification | Evidence / notes |
|---|---|---|
| User can explicitly preview v6a/v6b/v6c for a selected Drawable. | `implemented` | The backend option model lists default v2.6 plus v6a/v6b/v6c at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:79` through `:104`; the Mesh Tool renders those options and calls `previewBackend(candidate.id)` at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:272` through `:300`; preview calls route the selected option into `createGeneratedMeshForDrawable` at `apps/editor/src/features/editor-session/editor-session-context.tsx:653` through `:667`. |
| User can see whether preview is successful backend output or fallback. | `implemented` | The inspector displays source and fallback summary at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:180` through `:187`; v6 output kind is shown as backend output / fallback output / blocked at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:200` through `:219` and formatted at `:655` through `:665`; v6b/v6c diagnostic summaries are shown at `:222` through `:245`. |
| Apply commits the previewed mesh and provenance correctly. | `implemented` after Fix Loop 1 | Geometry is committed from `meshDraft.mesh`, while `source`, fallback data, and `qualityMetrics` are passed as `previewProvenance` at `apps/editor/src/features/editor-session/editor-session-context.tsx:690` through `:710`; operation provenance records `meshSource:previewMesh`, `previewMeshSource:<actual>`, fallback entries, and v6 quality output at `packages/operation-core/src/operations/generate-mesh.ts:105` through `:156` and `:326` through `:560`; tests cover v6A backend-output and v6C fallback-output preview commits. |
| V2.6 default remains unchanged when the experimental selector is not used. | `implemented` | Defaults are `default-v2-6-soft-apron` and `auto-outline-v2.6-soft-apron` at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:73` through `:84`; the inspector initializes backend state with that default at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:46` through `:49`; the model test locks the default at `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:11` through `:20`. |
| Existing PSD import / mesh generation / deformer creation semantic flow remains stable. | `unclear` | Source changes are confined to Mesh Tool/editor session tests plus the focused E2E assertion additions; I found no Domain E source change to PSD import or deformer creation paths. Parent verification reports focused Vitest/typecheck/build passed, but the focused Playwright semantic flow failed before the modified Domain E assertions while waiting for the initial `Import PSD` button. I found no source evidence that failure is caused by Domain E, but the end-to-end semantic flow remains unverified. |
| Backend selector is isolated/temporary and easy to remove or hide later. | `implemented` | Backend state/options are centralized in `mesh-tool-state.ts:16` through `:20` and `:79` through `:104`; the UI is a single `mesh-tool-backend-selector` section labeled "Experimental backend" and "Temporary" at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:272` through `:300`; candidate summaries call v6 paths "comparison candidate" rather than final UX at `mesh-tool-state.ts:86` through `:103`. |

## Must-Not Classification

| Must-not item | Classification | Evidence / notes |
|---|---|---|
| Does not present backend selection as permanent end-user UX. | `implemented` | The UI labels the section "Experimental backend" and "Temporary" at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:272` through `:280`; the plan also treats permanent triangulation-library choice as out of scope at `discussion/implementation/orchestration/wave68-plan.md:625` through `:630`. |
| Does not auto-select backend from part name, drawable name, or semantic image recognition. | `implemented` | Backend selection flows only from local `backendOptionId` state and button clicks at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:47` through `:49` and `:142` through `:146`; the code search found no backend-selection logic using drawable/part display names or semantic recognition. This matches the Mesh Tool spec's no-semantic-recognition rule at `discussion/design/screen-design/components/mesh-tool.md:17` through `:20` and `:274` through `:278`. |
| Does not claim selected v6 candidate is final or default. | `implemented` | v6 labels/summaries use candidate language at `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:86` through `:103`; default remains the v2.6 option at `:73` through `:84`; the v6 design states variants are temporary comparison controls at `discussion/design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md:8` through `:20`. |
| Does not require side-by-side visual diff UI. | `implemented` | The UI adds a single selected-backend preview control, not a side-by-side comparison surface. The plan lists side-by-side visual diff UI as out of scope at `discussion/implementation/orchestration/wave68-plan.md:635`. |
| Does not add rendering/WebGL feature work. | `implemented` for Domain E scope; unrelated dirty render files present | The in-scope Domain E files do not touch canvas/render/WebGL. The pre-existing dirty `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`, `canvas-render-scene-adapter.test.ts`, and `canvas-renderer.test.ts` add bounds-quad rendering behavior for empty/degenerate committed meshes, including a WebGL2 test. I classify those as render/WebGL-adjacent and not attributable to Domain E based on the requested scope and file ownership. |

## Scope Reviewed

In-scope source and tests inspected:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- relevant operation preview-commit path in `packages/operation-core/src/payloads/model-edit.ts`, `packages/operation-core/src/operations/generate-mesh.ts`, and `packages/operation-core/src/operations/generate-mesh.test.ts`

Basis documents inspected:

- `discussion/implementation/orchestration/wave68-plan.md`
- Domain A/B/C/D Wave68 reports
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md`
- `discussion/design/mesh-generation/auto-outline-v6b-constrainautor.md`
- `discussion/design/mesh-generation/auto-outline-v6c-poly2tri.md`

Pre-existing/unrelated dirty editor files classified:

- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`: render-scene fallback from empty/degenerate committed meshes to a bounds quad; render/WebGL-adjacent; not attributed to Domain E.
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts`: tests the bounds-quad fallback; not attributed to Domain E.
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`: adds a WebGL2 render-call expectation for the bounds quad; not attributed to Domain E.

## Verification Considered / Performed

Performed in this review:

- Direct source and diff inspection of the in-scope Domain E files and relevant operation preview-commit path.
- Static search for backend auto-selection from part/drawable names or semantic recognition.
- `git diff --check --` on tracked Domain E files: no whitespace diagnostics; LF/CRLF warnings only.
- Static classification of the unrelated dirty canvas/render files.

Performed in Fix Loop 1 re-review:

- Direct source and diff inspection of the changed Fix Loop 1 files:
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - `packages/operation-core/src/payloads/model-edit.ts`
  - `packages/operation-core/src/operations/generate-mesh.ts`
  - `packages/operation-core/src/operations/generate-mesh.test.ts`
- Static check that default remains `auto-outline-v2.6-soft-apron` and the selector remains explicitly temporary.
- Static search for new semantic auto-selection from part/drawable names or image recognition in the Fix Loop 1 path.
- Scoped `git diff --check --` on Fix Loop 1 files: no whitespace diagnostics; LF/CRLF warnings only.

Parent verification considered, not rerun by this review:

- Focused Vitest for `mesh-tool-state.test.ts` and `editor-session-commands.test.ts`: parent reports approved rerun passed, 2 files / 16 tests.
- `pnpm.cmd typecheck`: parent reports passed.
- Editor Vite build with temporary output: parent reports approved rerun passed, 2182 modules transformed, temp output removed.
- `node scripts/check-source-organization.mjs`: parent reports passed.
- Focused Playwright semantic flow: parent reports failure before modified assertions while waiting for initial `Import PSD` button after `page.goto("/")`; treated as a residual E2E verification gap unless later evidence ties it to Domain E.

Parent Fix Loop 1 verification considered, not rerun by this review:

- Focused Vitest for `mesh-tool-state.test.ts`, `editor-session-commands.test.ts`, and `generate-mesh.test.ts`: parent reports sandbox `spawn EPERM`, approved rerun passed, 3 files / 43 tests.
- `pnpm.cmd typecheck`: parent reports passed.
- `node scripts/check-source-organization.mjs`: parent reports passed.
- Editor Vite build with temporary output: parent reports sandbox `spawn EPERM`, approved rerun passed, 2182 modules transformed, normal chunk warning only, temp output removed.
- Scoped `git diff --check` on fix files: parent reports no whitespace diagnostics, CRLF warnings only.

## Remaining Issues And User-Decision Points

Remaining required implementation change:

- None for this Spec Compliance lane after Fix Loop 1.

Residual verification gap:

- The PSD import -> mesh preview/apply semantic E2E flow has not completed in this review cycle. The observed failure occurs before the Domain E assertions and is not attributed to Domain E from current source evidence.

User-decision points:

- None.

## Fix Loop 1 Final Re-review

- Final re-review verdict: `pass`
- Scope: previous Spec Compliance finding and direct spec regressions introduced by Fix Loop 1.
- Date: 2026-06-14

The original blocking finding is resolved. The applied preview path now preserves the preview's actual source, fallback state, and v6 quality/provenance metrics in operation provenance while still recording that the geometry source was an accepted preview mesh.

No direct spec regressions found:

- V2.6 remains the default when the experimental selector is not used.
- Backend selection remains explicit and button-driven; I found no new part-name, drawable-name, semantic image recognition, or automatic backend selection path.
- The temporary selector framing remains in the Mesh Tool and was not changed by Fix Loop 1.
- Fix Loop 1 did not add rendering/WebGL feature work in the changed files.
- The residual Playwright semantic-flow gap remains a verification gap only; current source inspection does not tie it to Domain E.
