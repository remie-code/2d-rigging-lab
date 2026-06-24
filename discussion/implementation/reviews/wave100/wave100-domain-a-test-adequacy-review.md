# Wave100 Domain A Test Adequacy Review

## Verdict

Verdict: `pass`.

Domain A tests are adequate for the Wave100 viewer-variant-switching gate. The
blocking coverage items are present, and critical state changes are asserted via
projection visibility, callback payloads, visible Drawable counts, dirty state,
and unchanged Variant project state rather than static text alone.

## Basis Reviewed

- `discussion/implementation/orchestration/wave100-plan.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/implementation/waves/wave99/wave99-final-integration-report.md`
- `discussion/implementation/reviews/wave99/wave99-final-clean-integration-review.md`
- `discussion/implementation/waves/wave100/wave100-domain-a-viewer-variant-switching-integration-report.md`

## Scope Reviewed

Source and tests inspected directly:

- `apps/editor/src/workspace/viewer/viewer-variant-selection.ts`
- `apps/editor/src/workspace/viewer/viewer-variant-selection.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts`
- `packages/authoring-core/src/variant-evaluation.test.ts`

Implementation connection points checked:

- `ViewerRuntimeScreen` owns viewer-local Variant state, reconciles it on
  Variant Group signature changes, builds a `createVariantVisibilityPredicate`,
  and passes that predicate into Clean Stage projection before render source
  handling (`viewer-runtime-screen.tsx:125`, `viewer-runtime-screen.tsx:164`,
  `viewer-runtime-screen.tsx:171`, `viewer-runtime-screen.tsx:439`).
- `viewer-clean-stage.ts` passes `variantVisibilityPredicate` into
  `createCanvasRenderProjection` before `createViewerRenderSourceProjection`
  remaps Original / Atlas Runtime (`viewer-clean-stage.ts:61`).
- `RuntimeControls` renders Variants between Render Source and parameter search,
  starts collapsed, and exposes single-select, multi-toggle, and reset controls
  (`runtime-controls.tsx:128`, `runtime-controls.tsx:134`,
  `runtime-controls.tsx:401`, `runtime-controls.tsx:415`,
  `runtime-controls.tsx:486`).

## Findings

Blocking findings: none.

Non-blocking test adequacy observations are recorded under Residual Risks.

## Coverage Matrix

| Rubric item | Coverage verdict | Evidence |
|---|---|---|
| No-variant behavior and hidden Variants section | `pass` | Viewer route without Variant Groups asserts no `viewer-variants-section` while existing Runtime Controls remain present (`viewer-runtime-screen.test.ts:215`). RuntimeControls standalone no-provider/no-variant render also asserts no section (`runtime-controls-state.test.ts:356`). |
| Default active initial behavior | `pass` | Pure selection helper initializes from defaults (`viewer-variant-selection.test.ts:18`). Viewer Original projection uses default active selection and keeps assigned inactive drawables hidden (`viewer-runtime-screen.test.ts:367`). SSR Viewer summary shows default labels while collapsed (`viewer-runtime-screen.test.ts:255`). |
| Inactive assigned Drawable hidden in Viewer Original | `pass` | `DRAW_EXPRESSION_ALT` and `DRAW_ACCESSORY` are false under default Original projection (`viewer-runtime-screen.test.ts:381`). |
| Variant-neutral Drawable behavior | `pass` | Viewer projection keeps neutral face visible until existing Parts visibility hides it (`viewer-runtime-screen.test.ts:390`). Existing Canvas and authoring-core predicate tests also cover neutral drawables (`canvas-variant-visibility.test.ts:81`, `variant-evaluation.test.ts:28`). |
| Single-select switching | `pass` | Interactive Viewer clicks `Select Sad in Expression`, changes summary, and keeps visible count consistent (`viewer-runtime-screen.test.ts:917`). RuntimeControls emits the expected single-select payload (`runtime-controls-state.test.ts:550`). Helper test covers set behavior (`viewer-variant-selection.test.ts:18`). |
| Multi-toggle switching | `pass` | Interactive Viewer clicks `Toggle Glasses in Accessory` and visible Drawable count changes from 2 to 3 (`viewer-runtime-screen.test.ts:925`). RuntimeControls emits the expected multi-toggle payload (`runtime-controls-state.test.ts:557`). Helper test covers enabling without changing defaults (`viewer-variant-selection.test.ts:78`). |
| Reset variants | `pass` | Interactive Viewer reset restores default summary and visible count (`viewer-runtime-screen.test.ts:933`). RuntimeControls reset button emits the reset callback (`runtime-controls-state.test.ts:580`). |
| Non-persistence / non-dirty behavior | `pass` | Viewer switching/reset leaves `session.graph.variantGroups` equal to the pre-test clone, `session.dirty` false, and `saveProject` uncalled (`viewer-runtime-screen.test.ts:892`). Pure default-active projection keeps the session JSON unchanged (`viewer-runtime-screen.test.ts:367`). Canvas preview regression also asserts no dirty/undo/default mutation (`canvas-variant-visibility.test.ts:122`). |
| `Original` projection behavior | `pass` | Viewer Original projection applies default Variant predicate and checks visible/invisible Drawables directly (`viewer-runtime-screen.test.ts:367`). |
| `Atlas Runtime` projection behavior | `pass` | Render source test applies Variant visibility before Atlas Runtime remap and asserts the same visibility as Original after remap (`viewer-render-source.test.ts:151`). |
| Runtime Controls placement / collapsed summary | `pass` | Viewer integration and RuntimeControls standalone tests assert order: render source, Variants, parameter search; collapsed state; active summary; hidden expanded controls (`viewer-runtime-screen.test.ts:255`, `runtime-controls-state.test.ts:405`). |
| Expanded controls expose usable `singleSelect` and `multiToggle` controls | `pass` | RuntimeControls interactive test expands the section, finds usable controls, and validates emitted payloads for both control kinds (`runtime-controls-state.test.ts:507`). Viewer interactive test expands and drives both controls through screen state (`viewer-runtime-screen.test.ts:908`). |
| Reconciliation when Variant Groups / Variants change | `pass` | Helper test reconciles a removed single-select Variant back to default while retaining other Group selection (`viewer-variant-selection.test.ts:18`). Screen source wires reconciliation effect to Variant Group signature changes (`viewer-runtime-screen.tsx:164`). |
| Existing Canvas Variant predicate regression | `pass` | Canvas tests cover preview active selection, default active fallback, provider preview flow, dirty state, and unchanged default active state (`canvas-variant-visibility.test.ts:80`). Focused command passed. |
| Existing authoring-core predicate regression | `pass` | Predicate tests cover missing/empty variants, neutral drawables, singleSelect, multiToggle, false assigned drawables, and default active fallback (`variant-evaluation.test.ts:16`). Focused command passed. |

## Verification Performed

Source/test inspections:

- Read the Wave100 plan, Viewer Runtime View spec, Variant / Expression Manager
  spec, screen-design map, Wave99 final report/review, and Domain A report.
- Read the changed Viewer source and focused test files directly.
- Checked assertions for behavior-changing paths, especially visible Drawable
  counts, projection `.visible` fields, callback payloads, session immutability,
  and dirty/save state.

Commands:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer` | Initial sandboxed attempt failed with `spawn EPERM` while Vitest/esbuild loaded config; rerun with approved escalation passed: 5 files / 64 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts` | Passed: 1 file / 3 tests. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/variant-evaluation.test.ts` | Passed: 1 file / 6 tests. |

`pnpm install` was not run.

## Residual Risks

- Browser E2E / visual verification was not run; coverage is component, fake DOM,
  SSR, pure projection, and focused Vitest coverage.
- Atlas Runtime coverage proves the Variant predicate affects remapped projection,
  but does not separately drive an interactive Viewer switch while Atlas Runtime
  is selected.
- Multi-toggle direct OFF-by-click is not separately asserted; OFF/default state
  is covered through default active selection and reset.
- Reconciliation is covered at helper level for removed Variant fallback; there is
  no separate mounted Viewer test that mutates `session.graph.variantGroups`
  during the same render session.

## User-Decision Points

None.
