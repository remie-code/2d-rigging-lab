# Wave 27 Final Report: Mask / Clipping / Opacity Authoring v1

> Wave: Wave 27 `mask-clipping-opacity-authoring-v1`  
> Domain G: `wave27-integration-review-and-final-report`  
> Date: 2026-06-01  
> Orch-Sylph final verification: provided by parent session  
> Clean Review-Sylph: `019e8257-7ff7-7213-93db-523f88fdeb8c` / `Sylph the 101st`  
> Clean review verdict: `pass` at [../../reviews/wave27/wave27-clean-integration-review.md](../../reviews/wave27/wave27-clean-integration-review.md)  
> Status: `pass / implementation-proven`

## Status

Wave 27 is `pass / implementation-proven` for the bounded semantic composition scope.

Domains A-F completed with pass review evidence. Orch-Sylph final verification passed across typecheck, unit, e2e, source guard, dependency guard, diff whitespace check, dependency manifest status, and forbidden-scope scan. Domain G did not require or perform any source fix; this report records only integration documentation and narrow fixture / traceability registration.

Clean integration review passed in [../../reviews/wave27/wave27-clean-integration-review.md](../../reviews/wave27/wave27-clean-integration-review.md). Review-Sylph `019e8257-7ff7-7213-93db-523f88fdeb8c` / `Sylph the 101st` recorded verdict `pass` with no required Gnome fix.

Wave 27 proves project-defined semantic mask relation / clipping intent / opacity evidence across operation, runtime evidence, validator diagnostics, contract fixtures, editor Preview / Viewer UX, and desktop/mobile e2e persistence smoke.

This wave does not implement pixel clipping output, a full renderer, texture masking, image decode, parser/file picker/archive flows, actual binary upload, Cubism compatibility, or external dependency additions.

## Domain Results

| Domain | Result | Implemented capability | Evidence |
|---|---|---|---|
| A. Mask relation authoring / operation foundation | `pass` | `setMaskRelation` dry-run / commit support, authoring session mutation, operation log target IDs, model diff paths, package `masks-file-v1` materialization, and deterministic operation diagnostics. | [wave27-domain-a-mask-relation-authoring-operation-foundation.md](wave27-domain-a-mask-relation-authoring-operation-foundation.md), [../../reviews/wave27/wave27-domain-a-mask-relation-authoring-operation-foundation-review.md](../../reviews/wave27/wave27-domain-a-mask-relation-authoring-operation-foundation-review.md) |
| B. Runtime composition evidence hardening | `pass` | Runtime snapshot / diff / Viewer evidence expose sorted semantic mask relation evidence, clipping intent, resolved state, drawable opacity evidence, and runtime state changes without pixel output. | [wave27-domain-b-runtime-composition-evidence-hardening.md](wave27-domain-b-runtime-composition-evidence-hardening.md), [../../reviews/wave27/wave27-domain-b-runtime-composition-evidence-hardening-review.md](../../reviews/wave27/wave27-domain-b-runtime-composition-evidence-hardening-review.md) |
| C. Validator composition diagnostics | `pass` | Validator reports missing source/target, self-reference, duplicate relation, stale/missing runtime evidence, runtime evidence mismatch, and opacity evidence gap diagnostics deterministically. | [wave27-validator-composition-diagnostics-report.md](wave27-validator-composition-diagnostics-report.md), [../../reviews/wave27/wave27-validator-composition-diagnostics-review.md](../../reviews/wave27/wave27-validator-composition-diagnostics-review.md) |
| D. Composition contract fixtures | `pass` | Rights-clean deterministic JSON fixture proves `setMaskRelation` operation -> package masks -> runtime snapshot/diff -> validator report -> Viewer-facing evidence, including invalid `mask.targetMissing`. | [wave27-domain-d-composition-contract-fixtures.md](wave27-domain-d-composition-contract-fixtures.md), [../../reviews/wave27/wave27-domain-d-composition-contract-fixtures-review.md](../../reviews/wave27/wave27-domain-d-composition-contract-fixtures-review.md) |
| E. Editor composition authoring UX | `pass` | Editor Composition / Mask / Opacity panel commits semantic mask relations, authors minimal drawable opacity keyforms, rejects invalid input, and projects Preview / Viewer evidence through save/load-capable workflow state. | [wave27-domain-e-editor-composition-authoring-ux.md](wave27-domain-e-editor-composition-authoring-ux.md), [../../reviews/wave27/wave27-domain-e-editor-composition-authoring-ux-review.md](../../reviews/wave27/wave27-domain-e-editor-composition-authoring-ux-review.md) |
| F. Composition e2e persistence smoke | `pass` | Desktop/mobile browser smoke creates a target drawable, commits mask relation, adds opacity evidence, checks Preview / Viewer evidence, saves, reloads, and reinspects persisted semantic composition evidence. | [wave27-domain-f-composition-e2e-persistence-smoke.md](wave27-domain-f-composition-e2e-persistence-smoke.md), [../../reviews/wave27/wave27-domain-f-composition-e2e-persistence-smoke-review.md](../../reviews/wave27/wave27-domain-f-composition-e2e-persistence-smoke-review.md) |

## Final Verification

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd typecheck` | pass | Root/editor typecheck passed. |
| `pnpm.cmd test:unit` | pass | 132 files / 686 tests. |
| `pnpm.cmd test:e2e` | pass | Editor e2e desktop smoke passed and mobile smoke passed. Screenshot base64 lengths were logged: desktop preview 75996, desktop drawable 70732, mobile preview 49892, mobile drawable 48172. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd run check:deps` | pass | Dependency guard passed. |
| `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design discussion/tests` | pass | LF/CRLF working-copy warnings only. |
| Dependency manifest diff/status check | pass | No root/workspace/editor/package manifests or lockfile changes. |
| Forbidden-scope scan | pass | Diff-based hits were non-goal/planning/report wording or existing guard text, not implementation of file picker, parser, image decode, archive, external dependency, Cubism compatibility, pixel oracle, or full renderer. |

No Domain G source fix was required. Orch-Sylph did not edit source during final verification; this Domain G Gnome pass edited only allowed documentation / registration files.

## Fixture And Traceability Registration

Narrow markdown registration was added for [../../../tests/fixtures/fixture-manifest.md](../../../tests/fixtures/fixture-manifest.md) and [../../../tests/traceability/test-traceability-matrix.md](../../../tests/traceability/test-traceability-matrix.md):

- `wave27-composition-contract-fixtures` is registered as a rights-clean semantic composition contract fixture with `warning` gate.
- `TC-WAVE27-COMPOSITION-CONTRACT-001` links the fixture to `AC-MVP-007`, `AC-MVP-012`, and `AC-MVP-013`.
- The registration claims semantic JSON operation/package/runtime/validator/viewer evidence only.

JSON mirrors under `discussion/tests/**` were intentionally not edited because they are outside this Domain G write scope.

## Pass Criteria Mapping

| Criterion | Result | Evidence |
|---|---|---|
| `setMaskRelation` can be dry-run and committed. | pass | Domain A operation / authoring tests and Domain D fixture. |
| Runtime records mask relation / opacity evidence. | pass | Domain B runtime tests, Domain D runtime fixture summaries, and Domain F Viewer assertions. |
| Validator reports deterministic mask / opacity diagnostics. | pass | Domain C focused validator suite, 11 focused tests, and Domain D invalid diagnostic fixture. |
| Editor can author mask relation and minimal opacity evidence. | pass | Domain E focused workflow/UI tests and Domain F browser smoke. |
| Save/load and Viewer / Runtime reinspection work after load. | pass | Domain E workflow tests and Domain F desktop/mobile e2e. |
| Existing keyform, drawable, mesh, source/PSD/binary, dynamics, viewer, and rig-control paths remain compatible. | pass | Full `test:unit` and `test:e2e` passed. |
| No forbidden scope or dependency drift entered the wave. | pass | `check:deps`, manifest diff/status check, and forbidden-scope scan passed. |
| `index.ts` remains barrel-only and no new catch-all source file was introduced. | pass | `check:source` and review artifacts passed. |
| Domain reports, domain reviews, final report, wave map, review map, and fixture/traceability registrations are recorded. | pass | A-F reports/reviews, this report, maps, and markdown test registration updates. |

## Explicit Non-Claims

Wave 27 does not implement or claim:

- pixel clipping oracle, pixel-perfect clipping, bitmap mask compositor, texture masking, canvas/WebGL/SVG renderer correctness, or full renderer;
- standalone viewer app or renderer adapter completion;
- real asset bytes, PSD/PNG parser, image decode, raster extraction, file picker, archive import/export, filesystem I/O, or actual binary upload;
- Cubism SDK/Core usage, Cubism format import/export/loading, Cubism clipping compatibility, or Cubism Viewer compatibility;
- general timeline editor, multi-key opacity curve editor, canvas mask painting, brush UI, or full layer tree editor;
- external dependency additions or package manifest / lockfile changes.

## Residual Risks / Future Scope

- Clipping remains semantic mask relation evidence. There is no pixel clipping oracle and no full renderer.
- Browser e2e and Viewer / Runtime evidence are semantic text/DTO evidence, not proof of visual clipping pixels.
- Real asset bytes, parser/file picker/image decode/archive flows, and actual binary upload remain out of scope.
- Cubism compatibility is not implemented and should not be inferred from mask/clipping terminology.
- The Wave27 contract fixture is markdown-registered globally, but JSON mirrors were not updated in this Domain G pass by instruction.
- Verification ran in a shared dirty worktree, not a fresh checkout replay.
- `discussion/implementation/remaining-work-backlog.md` may need a later Wave27 completion note, but that file is outside this Domain G allowed write scope.

## User Decision Points

None for the Wave27 semantic scope.
