# Wave68 Domain E Test Adequacy Review

- Verdict: `pass`
- Review lane: Test Adequacy Review
- Target: `wave68-editor-temporary-v6-backend-selector-preview-provenance`
- Date: 2026-06-14
- Reviewer: Review-Sylph
- Re-review: Fix Loop 1 delta, final verdict

## Scope Reviewed

In-scope Domain E files from the initial review:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Additional Fix Loop 1 files reviewed:

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

Supporting evidence reviewed:

- Wave68 Domain E acceptance in `discussion/implementation/orchestration/wave68-plan.md:468`.
- Temporary selector and fallback visibility requirements in the v6b/v6c backend docs, especially `discussion/design/mesh-generation/auto-outline-v6b-constrainautor.md:38` and `discussion/design/mesh-generation/auto-outline-v6c-poly2tri.md:33`.
- Domain A-D reports under `discussion/implementation/waves/wave68/` for backend readiness, output metadata, fallback metadata, and verification results.
- Backend and operation tests in `packages/authoring-core/src/mesh-generation.test.ts` and `packages/operation-core/src/operations/generate-mesh.test.ts` where they cover all v6 candidates.

## Fix Loop 1 Delta Verdict

`pass`.

Fix Loop 1 resolves the durable preview provenance gap. The Editor now carries preview source/fallback/quality metrics from `createGeneratedMeshForDrawable` through `MeshToolDraft`, passes them as `previewProvenance` during apply, and the operation handler writes `previewMeshSource:*`, fallback steps, and v6 quality metrics into committed transform history. New focused tests cover both backend-output and fallback-output preview commits.

## Requirement-To-Test Coverage

| Requirement / risk area | Coverage status | Evidence |
|---|---|---|
| User can explicitly preview v6a/v6b/v6c for a selected Drawable. | Adequate with low residual UI-click gap. | Selector options include default + v6a/v6b/v6c methods in `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:79`; the focused state test asserts the v6 method list in `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:23`; UI maps every option to a preview button and passes the selected backend id to preview in `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:142` and `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:284`; session preview resolves the backend method and calls `createGeneratedMeshForDrawable` in `apps/editor/src/features/editor-session/editor-session-context.tsx:653`. E2E currently clicks v6A only at `apps/editor/e2e/psd-import.e2e.spec.ts:262`; v6B/v6C rely on the same mapped path plus backend/operation coverage. |
| User can see successful backend output vs fallback output. | Adequate with residual Editor UI fallback display gap. | Mesh Tool renders `v6Metrics.outputKind` as `Backend output`, `Fallback output`, or `Blocked` in `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:204` and `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:655`; backend tests cover v6 backend output and fallback/blocked metadata across candidates, including `packages/authoring-core/src/mesh-generation.test.ts:1143`, `packages/authoring-core/src/mesh-generation.test.ts:1260`, `packages/authoring-core/src/mesh-generation.test.ts:1725`, `packages/authoring-core/src/mesh-generation.test.ts:1940`, and `packages/authoring-core/src/mesh-generation.test.ts:2119`; Fix Loop 1 operation tests now assert committed preview provenance for `backend-output` at `packages/operation-core/src/operations/generate-mesh.test.ts:638` and `fallback-output` at `packages/operation-core/src/operations/generate-mesh.test.ts:685`. The Editor E2E only asserts the v6A backend label, not the output-kind suffix. |
| Apply commits previewed mesh and provenance correctly. | Covered after Fix Loop 1. | `MeshToolDraft` carries preview source/fallback/quality fields at `apps/editor/src/features/editor-session/editor-session-context.tsx:127`; apply passes preview mesh, method, source, fallback steps, and quality metrics to `commitGenerateMesh` at `apps/editor/src/features/editor-session/editor-session-context.tsx:698`; `commitGenerateMesh` forwards `previewProvenance` into the operation payload at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:274`; the operation payload schema accepts shaped preview provenance and requires it to be paired with `previewMesh` at `packages/operation-core/src/payloads/model-edit.ts:264`; the handler records `previewMeshSource:*`, fallback steps, and v6 metrics at `packages/operation-core/src/operations/generate-mesh.ts:105` and `packages/operation-core/src/operations/generate-mesh.ts:326`; focused editor and operation tests assert backend-output provenance at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:686` and `packages/operation-core/src/operations/generate-mesh.test.ts:638`, and fallback-output provenance at `packages/operation-core/src/operations/generate-mesh.test.ts:685`. |
| V2.6 default remains unchanged when experimental selector is unused. | Covered. | Default method and option stay on `auto-outline-v2.6-soft-apron` in `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:74`; focused state test asserts the default in `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:12`; `previewMeshDraft` defaults to the v2.6 backend option in `apps/editor/src/features/editor-session/editor-session-context.tsx:653`; E2E reselects Default v2.6 and checks the source text at `apps/editor/e2e/psd-import.e2e.spec.ts:266`. |
| Existing PSD import / mesh generation / deformer creation semantic flow remains stable. | Partially verified; residual risk accepted for Domain E. | The changed E2E is the existing PSD semantic file and adds selector assertions inside the mesh preview/apply flow at `apps/editor/e2e/psd-import.e2e.spec.ts:230`; the same file still contains deformer semantic coverage around `apps/editor/e2e/psd-import.e2e.spec.ts:321`. Parent/Gnome reported the focused Playwright semantic flow failed before Domain E mesh assertions while waiting for the shared initial `Import PSD` button, so this lane does not have a successful browser semantic run. Focused editor unit tests, typecheck, production build, and source-organization checks passed. |
| Selector is temporary/isolated. | Covered. | Wave plan requires isolated temporary selector at `discussion/implementation/orchestration/wave68-plan.md:485`; UI labels the section `Experimental backend` and `Temporary` at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:274`; backend selection remains local Mesh Tool state in `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:47`; product presets remain separate in `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:136`. |

## Findings

No blocking test adequacy findings.

## Verification Considered / Performed

Performed in this review:

- Inspected the Domain E Fix Loop 1 diff directly with `git diff -- ...`.
- Inspected focused source/test coverage using `rg` over the in-scope files and supporting backend/operation tests.
- Ran `git diff --check -- apps/editor/src/workspace/panels/mesh-tool-inspector.tsx apps/editor/src/features/editor-session/model/mesh-tool-state.ts apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/e2e/psd-import.e2e.spec.ts`.
  - Result: no whitespace diagnostics; LF/CRLF warnings only.
- Re-review ran `git diff --check -- apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/features/editor-session/model/editor-session-commands.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts packages/operation-core/src/payloads/model-edit.ts packages/operation-core/src/operations/generate-mesh.ts packages/operation-core/src/operations/generate-mesh.test.ts`.
  - Result: no whitespace diagnostics; LF/CRLF warnings only.

Parent/Gnome verification considered:

- Focused Vitest for `mesh-tool-state.test.ts` and `editor-session-commands.test.ts`: sandbox `spawn EPERM`, escalated rerun passed, 2 files / 16 tests.
- Fix Loop 1 focused Vitest for `mesh-tool-state.test.ts`, `editor-session-commands.test.ts`, and `generate-mesh.test.ts`: sandbox `spawn EPERM`, escalated rerun passed, 3 files / 43 tests.
- `pnpm.cmd typecheck`: passed.
- Editor Vite build: sandbox `spawn EPERM`, escalated rerun passed, 2182 modules transformed; temporary output removed.
- `node scripts/check-source-organization.mjs`: passed.
- Domain E tracked-file `git diff --check`: no whitespace diagnostics, CRLF warnings only.
- New test file no-index whitespace check: no whitespace diagnostics, expected no-index exit.
- Focused Playwright semantic flow: failed before modified mesh assertions while waiting for the shared initial `Import PSD` button after `page.goto("/")`; generated Playwright output was cleaned.

I did not rerun `pnpm install`. I did not rerun expensive Vitest/Playwright commands because the parent run already hit known Windows sandbox `spawn EPERM` for build/test tooling and supplied escalated pass/fail results.

## Playwright Gap Decision

The Playwright gap is not blocking for Domain E acceptance in this lane.

Reasoning:

- The failure occurred before the Domain E selector assertions and before any modified mesh preview/apply assertions.
- Wave68 explicitly scopes Domain E Playwright as a focused semantic test "if stable" in `discussion/implementation/orchestration/wave68-plan.md:480` and final validation similarly says "if stable" at `discussion/implementation/orchestration/wave68-plan.md:530`.
- Focused unit tests cover the new default/selector state and preview commit provenance, while typecheck and production build cover integration and dependency import viability.
- Backend success/fallback semantics for v6a/v6b/v6c are covered in Domain A-D backend/operation tests, and Fix Loop 1 now also covers the committed preview provenance path for backend-output and fallback-output.

The failed Playwright run remains a residual risk for final integration because it means this review did not observe a successful browser-level PSD import -> mesh preview/apply -> deformer flow after the Domain E UI changes.

## Remaining Gaps / Residual Risk

- Browser semantic coverage gap: medium residual risk. The shared PSD E2E did not reach Domain E assertions, so final integration should rerun or repair the initial `Import PSD` reachability before claiming end-to-end browser stability.
- v6B/v6C UI-click gap: low residual risk. The UI uses a single mapped selector path for all backend options, and backend/operation tests cover all v6 candidates, but the current E2E only clicks v6A.
- Editor fallback display gap: low residual risk. Backend and operation tests prove `outputKind` and fallback metadata, and the Mesh Tool has straightforward rendering for it, but no focused Editor UI test currently forces a v6 fallback/blocked preview and asserts the displayed `Fallback output` or `Blocked` label.
- Operation payload hardening gap: low residual risk, not blocking for Domain E. `previewProvenance` schema validates shape and requires `previewMesh` when present, but the handler does not cross-check that `previewProvenance.qualityMetrics.v6Metrics.methodId` matches the operation method. The Editor path constructs preview provenance directly from the generated draft and the new tests cover that durable provenance path; stricter rejection of mismatched direct operation payloads can be handled as future API hardening.

## User-Decision Points

None for Domain E test adequacy.

Recommended follow-up for final integration: rerun the PSD import semantic Playwright flow after resolving the initial `Import PSD` reachability issue, and consider extending the semantic test to click v6B/v6C or to assert one fallback/blocked display if a stable fixture can trigger it cheaply.
