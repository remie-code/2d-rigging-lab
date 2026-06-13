# Wave66 Domain A Spec Compliance Review

- verdict: `pass`
- lane: Spec Compliance Review
- domain: `wave66-canvas-evaluation-foundation-v0`
- reviewer: Review-Sylph
- date: 2026-06-13

## Evidence Reviewed

- Basis:
  - `discussion/implementation/orchestration/wave66-plan.md`
  - `discussion/implementation/waves/wave66/wave66-preplan-canvas-evaluation-inventory.md`
  - `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md`
  - `discussion/design/screen-design/components/canvas-preview.md`
  - `discussion/design/screen-design/components/parameter-keyform.md`
  - `discussion/design/screen-design/components/rig-tool.md`
- Changed files:
  - `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
  - `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md`
- New-file diffs reproduced with:
  - `git diff --no-index -- NUL apps\editor\src\workspace\canvas\canvas-evaluation.ts`
  - `git diff --no-index -- NUL apps\editor\src\workspace\canvas\canvas-evaluation.test.ts`
  - `git diff --no-index -- NUL discussion\implementation\waves\wave66\wave66-domain-a-canvas-evaluation-foundation-report.md`
- Additional source checks:
  - `rg -n "AuthoringSession|createCanvasEvaluatedScene|CanvasEvaluatedScene|graph\.|keyform|parameterValues" apps/editor/src/workspace/canvas/canvas-renderer.ts` returned no matches.
  - `git diff --check -- apps/editor/src/workspace/canvas/canvas-evaluation.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md` passed.

## Requirement Classification

| Requirement | Classification | Evidence |
|---|---|---|
| Root / Undine / Orch separation; implementation by Gnome and independent review by Review-Sylph | `implemented` | Reviewed artifacts identify Gnome report and this independent review; no source edits were made by this review. |
| Domain A introduces `AuthoringSession + transient state -> evaluated scene` adapter | `implemented` | `createCanvasEvaluatedScene(session, options)` creates `CanvasEvaluatedScene` from session plus options in `canvas-evaluation.ts:142`. |
| Do not add raw `AuthoringSession` knowledge to `canvas-renderer.ts` | `implemented` | `canvas-renderer.ts` remains projection-only; search found no `AuthoringSession` or evaluation/session terms. |
| Output evaluated drawable vertices / triangles / bounds / opacity / visibility / draw order / texture refs | `implemented` | Output fields are declared in `canvas-evaluation.ts:32` and populated in `canvas-evaluation.ts:216`. |
| Meshless drawable rectangular fallback is allowed | `implemented` | `createBaseEvaluatedMesh` falls back through `createRectFallbackMesh` in `canvas-evaluation.ts:621` and `canvas-evaluation.ts:650`. |
| Reuse existing editor or runtime helper for keyform evaluation where appropriate | `implemented` | Uses `createEvaluatedParameterKeyformState` in `canvas-evaluation.ts:14` and `canvas-evaluation.ts:157`. |
| Linear keyform evaluation influences Canvas evaluation | `implemented` | Existing helper is sampled into drawable opacity, rig opacity, rotation angle, and warp offsets in `parameter-keyform-state.ts:433`; Domain A consumes those maps in `canvas-evaluation.ts:241`, `canvas-evaluation.ts:324`, `canvas-evaluation.ts:342`, and `canvas-evaluation.ts:378`. |
| Drawable opacity keyform | `implemented` | Effective opacity starts from evaluated drawable opacity in `canvas-evaluation.ts:241`; covered by `canvas-evaluation.test.ts:40`. |
| Warp control point offsets | `implemented` | Warp offsets are read and sampled in `canvas-evaluation.ts:324` and applied in `canvas-evaluation.ts:585`; covered by `canvas-evaluation.test.ts:40`. |
| Warp opacity multiplier | `implemented` | Warp opacity multiplier is read in `canvas-evaluation.ts:342` and multiplied in `canvas-evaluation.ts:681`; covered by `canvas-evaluation.test.ts:40`. |
| Rotation angle | `implemented` | Rotation angle is read in `canvas-evaluation.ts:378` and applied in `canvas-evaluation.ts:548`; covered by `canvas-evaluation.test.ts:122`. |
| Rotation opacity multiplier | `implemented` | Rotation opacity multiplier is read in `canvas-evaluation.ts:370` and multiplied in `canvas-evaluation.ts:681`; covered by `canvas-evaluation.test.ts:122`. |
| Evaluate deformer chain parent -> child -> drawable | `implemented` | Chain order is built from rig tree order and walked parent-first in `canvas-evaluation.ts:422`, `canvas-evaluation.ts:487`, and `canvas-evaluation.ts:509`; parent influence test is in `canvas-evaluation.test.ts:93`. |
| Parent deformer influence reaches child/drawable evaluation | `implemented` | Test asserts chain ids and moved vertex/bounds in `canvas-evaluation.test.ts:117`. |
| Input shape supports `meshDraft`, `rigDraft`, and control point drag preview | `implemented` | Options include all three at `canvas-evaluation.ts:72`, `canvas-evaluation.ts:76`, and `canvas-evaluation.ts:77`; draft and preview behavior is covered by `canvas-evaluation.test.ts:147` and `canvas-evaluation.test.ts:174`. |
| Control point preview support is required | `implemented` | `controlPointPreview` composes offsets in `canvas-evaluation.ts:328` and `canvas-evaluation.ts:694`; covered by `canvas-evaluation.test.ts:147`. |
| Parameter scrub does not mutate `AuthoringSession` | `implemented` | JSON snapshot assertion in `canvas-evaluation.test.ts:60` and `canvas-evaluation.test.ts:90`; implementation clones returned data instead of writing to session. |
| Draft / drag preview does not mutate `AuthoringSession` | `implemented` | Drag preview non-mutation is asserted in `canvas-evaluation.test.ts:153` and `canvas-evaluation.test.ts:171`; source creates draft evaluation objects without session writes in `canvas-evaluation.ts:386`. |
| Pure evaluation tests pass | `implemented` | Independent rerun passed: 1 file, 5 tests. |
| 7.4 pointermove no session mutation and pointerup one commit / undo entry | `deferred by plan` | Domain A only supplies evaluation input shape and purity; pointer interaction, commit, and undo boundaries remain existing interaction/Domain B integration work. |
| Evaluated artwork triangle rendering | `deferred by plan` | Domain B owns triangle texture drawing per wave plan; Domain A added no renderer drawing path. |
| Overlay / selection / hit test migration to evaluated coordinates | `deferred by plan` | Domain B owns overlay and hit test integration. Domain A accepts `selection` and `overlayToggles` in `canvas-evaluation.ts:79`, but does not emit evaluated overlays. |
| Save/load project expansion | `explicit non-goal` | No save/load or package-format files changed; Gnome report records no save/load expansion. |
| Viewer / Runtime Preview full integration | `explicit non-goal` | No viewer/runtime integration changed. |
| WebGL renderer rewrite as requirement | `explicit non-goal` | No renderer rewrite changed. |
| Mesh V2.6 implementation | `explicit non-goal` | Domain A changed only editor canvas evaluation and its report. |
| Domain A persistent report artifact | `implemented` | `wave66-domain-a-canvas-evaluation-foundation-report.md` exists and includes coverage/deferred/must-not sections. |

## Findings

No pass-blocking spec compliance findings.

| Severity | Finding | Evidence |
|---|---|---|
| low | `selection` and `overlayToggles` are accepted as adapter inputs but are not yet consumed into evaluated overlay output. This is consistent with Domain B ownership of overlay/hit test migration, but Domain B should not assume Domain A already emits evaluated overlay structures. | Input fields: `apps/editor/src/workspace/canvas/canvas-evaluation.ts:79`. No `overlays` field exists in `CanvasEvaluatedScene` at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:25`. Gnome also defers overlay/hit test at `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md:48`. |
| low | Parent-first chain evaluation is present, but exact local-space semantics for complex nested/non-linear parent warp cases remain a known v0 risk rather than a blocking Domain A miss. | Chain construction/application: `apps/editor/src/workspace/canvas/canvas-evaluation.ts:487`, `apps/editor/src/workspace/canvas/canvas-evaluation.ts:509`, and warp raw-domain sampling at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:585`. The design lists parent/local coordinate conversion as unresolved at `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md:284`; Gnome records the same residual risk at `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md:52`. |

## Open Questions / Uncertainties

- Whether Domain B wants to extend `CanvasEvaluatedScene` with evaluated overlay structures, or build a projection adapter from evaluated drawables plus existing selection/overlay state.
- Exact child-local coordinate inversion for nested warp under non-linear parent warp remains future alignment work. It is not required for Domain A acceptance, but should be tested when richer nested deformer cases are integrated visually.

## Verification Evidence Assessment

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - Review rerun inside sandbox failed before config load with Windows `spawn EPERM`, matching Gnome's reported sandbox failure.
  - Review rerun outside sandbox after escalation passed: 1 test file, 5 tests.
- `pnpm.cmd --dir apps/editor typecheck`
  - Review rerun passed.
- `git diff --check` for the three Domain A files passed.
- The reported Gnome evidence is consistent with independent review verification.

## Residual Risks

- Domain A is foundation-only. The actual user-visible Canvas deformation depends on Domain B consuming `CanvasEvaluatedScene` and adding triangle texture rendering, evaluated overlays, and evaluated hit test.
- Test coverage is focused and pure. It covers required Domain A acceptance but does not cover full visual rendering, pointer integration, or complex nested deformer local-space cases.
- `selection` / `overlayToggles` are currently shape-level inputs only; using them for evaluated overlays remains Domain B work.

## Domain B Readiness Recommendation

Domain B may proceed. It should consume `createCanvasEvaluatedScene`, keep `canvas-renderer.ts` session-free, and explicitly decide whether evaluated overlay structures belong in `CanvasEvaluatedScene` or in a separate projection step derived from the evaluated drawables.
