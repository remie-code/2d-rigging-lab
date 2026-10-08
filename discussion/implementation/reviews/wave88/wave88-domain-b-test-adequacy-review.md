# Wave88 Domain B Test Adequacy Review

## Verdict

`pass`

Domain B has adequate focused test coverage for `wave88-viewer-original-atlas-runtime-mode`. I found no blocking test adequacy gaps.

## Basis Read

- `discussion/implementation/orchestration/wave88-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave88/wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md`
- `discussion/implementation/reviews/wave88/wave88-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/reviews/wave87/wave87-final-clean-integration-review.md`
- `discussion/implementation/waves/wave88/wave88-domain-b-viewer-original-atlas-runtime-mode-report.md`
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
- `packages/package-format/src/package-document.test.ts`

## Findings

Blocking findings: none.

Non-blocking notes:

- The Texture Atlas Task screen spec still contains pre-Wave88 destructive Apply wording, while the Wave88 plan and Domain A artifacts supersede it with artifact-only Apply semantics. This is a documentation cleanup item for Domain C, not a Domain B test adequacy blocker.
- The Domain B suite is projection/UI-level. It does not include a browser pixel comparison for Original versus Atlas Runtime rendering. This matches the recorded residual risk and is acceptable for this Domain B gate because the required evidence is at render-source projection and control-state boundaries.

## Test Adequacy Matrix

| Required evidence | Adequacy | Source/test evidence |
|---|---|---|
| Viewer Original mode keeps existing projection behavior. | Adequate. | `createViewerCleanStageRenderSourceProjection()` builds the original Canvas projection through `createCanvasRenderProjection()` before render-source resolution (`viewer-clean-stage.ts:53`, `viewer-clean-stage.ts:57`, `viewer-clean-stage.ts:64`). The Original test asserts requested/effective Original mode, original texture id, original dimensions, original unit UVs, and default clean-stage behavior (`viewer-render-source.test.ts:49`, `viewer-render-source.test.ts:57`, `viewer-render-source.test.ts:60`, `viewer-render-source.test.ts:63`, `viewer-render-source.test.ts:64`). |
| Viewer Atlas Runtime mode remaps texture id, bytes/dimensions, and UVs using placement `uvRect`. | Adequate. | Runtime source resolution checks committed layout, binary ref/bytes, dimensions, source signature, placement validity, and placement membership (`viewer-render-source.ts:131`, `viewer-render-source.ts:203`, `viewer-render-source.ts:217`, `viewer-render-source.ts:224`, `viewer-render-source.ts:240`, `viewer-render-source.ts:266`). Projection remap sets atlas texture/binary/bytes/dimensions and maps each evaluated UV into the placement rect (`viewer-render-source.ts:294`, `viewer-render-source.ts:305`, `viewer-render-source.ts:326`, `viewer-render-source.ts:331`). Tests assert atlas texture id, binary id/path, byte object identity, page dimensions, and exact UVs from `uvRect` (`viewer-render-source.test.ts:67`, `viewer-render-source.test.ts:87`, `viewer-render-source.test.ts:90`, `viewer-render-source.test.ts:91`, `viewer-render-source.test.ts:93`). |
| Viewer Atlas Runtime mode does not mutate `session.graph`. | Adequate. | The remap returns a cloned projection shape rather than writing graph state (`viewer-render-source.ts:294`, `viewer-render-source.ts:305`). The test snapshots `session.graph` before Atlas Runtime projection and asserts equality after the call (`viewer-render-source.test.ts:69`, `viewer-render-source.test.ts:99`). |
| Canvas projection remains original after Apply Atlas or committed atlas artifact exists. | Adequate. | Canvas projection still reads drawable texture refs and cloned evaluated mesh UVs from authoring state (`canvas-projection.ts:162`, `canvas-projection.ts:228`, `canvas-projection.ts:357`, `canvas-projection.ts:362`). A focused post-Apply test asserts a committed layout exists while Canvas projection still uses original texture ids, original dimensions, and original unit UVs (`viewer-render-source.test.ts:102`, `viewer-render-source.test.ts:109`, `viewer-render-source.test.ts:110`, `viewer-render-source.test.ts:114`, `viewer-render-source.test.ts:115`). |
| Missing atlas disables Atlas Runtime. | Adequate. | Missing layout returns the deterministic unavailable reason (`viewer-render-source.ts:79`, `viewer-render-source.ts:137`). The test requests Atlas Runtime without a committed atlas and asserts effective Original fallback, unavailable status, `missingLayout`, disabled reason, and original texture id (`viewer-render-source.test.ts:118`, `viewer-render-source.test.ts:125`, `viewer-render-source.test.ts:126`, `viewer-render-source.test.ts:131`). |
| Stale atlas disables Atlas Runtime. | Adequate. | Runtime source resolution recomputes the Domain A source signature and returns `staleSourceSignature` when it differs (`viewer-render-source.ts:217`, `viewer-render-source.ts:218`). The test mutates mesh UVs after Apply and asserts effective Original fallback plus stale disabled reason (`viewer-render-source.test.ts:134`, `viewer-render-source.test.ts:140`, `viewer-render-source.test.ts:151`, `viewer-render-source.test.ts:152`). Domain A tests independently prove the source signature changes for UV/topology/source bytes/membership/settings changes (`texture-atlas-mutations.test.ts:181`, `texture-atlas-mutations.test.ts:189`, `texture-atlas-mutations.test.ts:218`). |
| Deformer/keyform/dynamics changes do not stale Atlas Runtime. | Adequate. | Domain B mutates a non-membership rig control field, adds a parameter/keyform set, and adds a dynamics group, then asserts Atlas Runtime remains effective and available (`viewer-render-source.test.ts:159`, `viewer-render-source.test.ts:168`, `viewer-render-source.test.ts:182`, `viewer-render-source.test.ts:199`, `viewer-render-source.test.ts:240`, `viewer-render-source.test.ts:241`). Domain A's source-signature tests also assert keyform/dynamics/non-source rig changes leave the digest unchanged (`texture-atlas-mutations.test.ts:220`, `texture-atlas-mutations.test.ts:226`, `texture-atlas-mutations.test.ts:245`). |
| Runtime Controls shows mode control and disabled reason. | Adequate. | `RuntimeControls` renders `RenderSourceModeControl` above parameter search (`runtime-controls.tsx:98`, `runtime-controls.tsx:104`) and disables the Atlas Runtime button with a title, aria label, and visible disabled reason when unavailable (`runtime-controls.tsx:223`, `runtime-controls.tsx:238`, `runtime-controls.tsx:240`, `runtime-controls.tsx:246`). Tests assert labels, ordering above search, visible reason, and unavailable aria label (`runtime-controls-state.test.ts:312`, `runtime-controls-state.test.ts:325`, `runtime-controls-state.test.ts:335`, `runtime-controls-state.test.ts:340`, `runtime-controls-state.test.ts:342`). |
| Selected invalid Atlas Runtime mode falls back to Original. | Adequate. | Runtime screen state is reconciled to the effective mode when availability changes (`viewer-runtime-screen.tsx:205`, `viewer-runtime-screen.tsx:206`, `viewer-runtime-screen.tsx:207`), and `createViewerRuntimeCleanStageProjection()` exposes requested versus effective modes (`viewer-runtime-screen.tsx:276`, `viewer-runtime-screen.tsx:287`, `viewer-runtime-screen.tsx:288`). The screen test requests Atlas Runtime on a missing-atlas session and asserts requested Atlas Runtime, effective Original, disabled reason, and original texture id (`viewer-runtime-screen.test.ts:288`, `viewer-runtime-screen.test.ts:297`, `viewer-runtime-screen.test.ts:298`, `viewer-runtime-screen.test.ts:299`, `viewer-runtime-screen.test.ts:304`). |
| Focused Atlas Task test expectations align with Domain A artifact-only Apply. | Adequate. | The Operation-backed Atlas Task test now expects a committed atlas layout and generated operation id while preserving original drawable texture ids and mesh UVs, and it asserts the input session remains unmutated (`texture-atlas-task-screen.test.ts:286`, `texture-atlas-task-screen.test.ts:312`, `texture-atlas-task-screen.test.ts:316`, `texture-atlas-task-screen.test.ts:319`, `texture-atlas-task-screen.test.ts:322`). This aligns with Domain A artifact-only Apply coverage in authoring/operation tests (`texture-atlas-mutations.test.ts:282`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:179`). |

## Verification Performed

- Inspected the required basis documents and changed source/test files directly.
- Inspected Domain A source-signature and artifact-only Apply test evidence because Domain B stale/non-stale behavior depends on those helpers.
- Reviewed orchestrator validation evidence:
  - focused Vitest sandbox attempt failed with known esbuild `spawn EPERM`;
  - escalated rerun passed: 5 files, 48 tests;
  - `pnpm.cmd typecheck`: passed;
  - `node scripts/check-source-organization.mjs`: passed;
  - `node scripts/check-dependencies.mjs`: passed;
  - `git diff --check`: exit 0 with CRLF working-copy warnings only.
- I did not rerun Vitest in this review lane because the supplied escalated evidence covers the focused suite and the sandbox `spawn EPERM` mode is already documented.

## Residual Risks

- There is no browser pixel screenshot or rendered-pixel equivalence test for Original versus Atlas Runtime. Current evidence proves the projection inputs consumed by rendering, not final pixels.
- Missing/stale UI rendering is covered through generic disabled-reason propagation and a missing-atlas screen case. Stale-specific UI text is covered at render-source availability, not separately at the markup layer.
- Old persisted atlas artifacts without `sourceSignature` are treated as unavailable; migration remains a later product decision.
- The current strict policy disables Atlas Runtime when any renderable drawable lacks placement. That behavior is tested, but whether partial fallback should ever be allowed is a later design decision.

## User-Decision Points

- No blocking user decision is required for Domain B test adequacy.
- Later decision remains: migrate old atlas artifacts without `sourceSignature`, or require regeneration.
- Later decision remains: keep strict missing-placement disablement, or design a partial-render fallback.
- Later decision remains: whether a future hardening wave should add browser pixel checks for Viewer Original versus Atlas Runtime parity.
