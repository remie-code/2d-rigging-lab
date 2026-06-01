# Wave 27 Domain B Review: Runtime Composition Evidence Hardening

> Target: `wave27-runtime-composition-evidence-hardening`
> Wave: Wave 27 `mask-clipping-opacity-authoring-v1`
> Role: Review-Sylph independent review
> Verdict: `pass`

## Scope Reviewed

Reviewed Domain B files:

- `packages/runtime-core/src/mask-relation-evidence.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/runtime-evidence.test.ts`
- `packages/runtime-core/src/snapshot-comparison.test.ts`
- `packages/runtime-core/src/viewer-evaluation.test.ts`

Reviewed basis:

- `discussion/implementation/orchestration/wave27-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`

This reviewer did not edit source, tests, fixtures, manifests, lockfiles, or implementation maps. The only content write is this review artifact; the parent directory `discussion/implementation/reviews/wave27/` was created because it did not exist.

## Findings

No blocking, high, medium, or low findings for Domain B.

## Review Lanes

| Lane | Result | Evidence |
|---|---|---|
| Runtime Evidence | `pass` | `createEvaluatedMaskRelations` emits sorted semantic mask relation snapshot entries with source drawables, target drawables, `enabled: true`, `clippingIntent: "semanticClipping"`, and `resolved` reference status (`packages/runtime-core/src/mask-relation-evidence.ts:25-43`). Snapshot creation now places this evidence into `RuntimeSnapshotDto.masks` and includes `mask_resolution` in trace phases (`packages/runtime-core/src/snapshot.ts:180-219`). Runtime diff adds deterministic `/masks/{id}` field paths via `createMaskRelationChanges` (`packages/runtime-core/src/snapshot-comparison.ts:178-217`). |
| Composition Semantics | `pass` | The implementation records semantic clipping intent only. I found no pixel clipping result, bitmap mask compositor, SVG/canvas/WebGL renderer, image decode path, or renderer oracle in the reviewed Domain B production changes. The relevant Wave 27 basis explicitly requires semantic clipping intent and forbids pixel/full renderer or image decode scope (`discussion/implementation/orchestration/wave27-plan.md:183-205`). |
| Viewer / Preview Evidence Basis | `pass` | Viewer evidence now carries sorted `maskRelationEvidence`, `drawableOpacityEvidence`, and `drawableRuntimeStateChanges` (`packages/runtime-core/src/viewer-evaluation.ts:69-118`, `packages/runtime-core/src/viewer-evaluation.ts:256-294`). Existing snapshot keyform sampling remains the source of opacity keyform traceability, and the new viewer test proves a drawable opacity keyform produces viewer-facing opacity evidence and runtime state change evidence (`packages/runtime-core/src/viewer-evaluation.test.ts:138-185`). |
| Development Compliance | `pass` | Domain B stays within `packages/runtime-core/src`. No package manifest or lockfile changes were present in `git diff --name-status -- packages/runtime-core/src package.json pnpm-lock.yaml packages/runtime-core/package.json`. `packages/runtime-core/src/index.ts` remains a re-export barrel (`packages/runtime-core/src/index.ts:1-23`). The new production file has one focused responsibility: mask relation evidence and diff path generation. |
| Test Adequacy | `pass` | Runtime evidence test covers deterministic mask snapshot ordering and diff paths (`packages/runtime-core/src/runtime-evidence.test.ts:94-143`). Snapshot comparison test covers mask relation addition, removal, source list change, target list change, and resolved-state change on stable `/masks/...` paths (`packages/runtime-core/src/snapshot-comparison.test.ts:192-285`). Viewer test covers semantic mask relation evidence plus drawable opacity and runtime state change evidence (`packages/runtime-core/src/viewer-evaluation.test.ts:138-185`). Full runtime-core compatibility suite passed. |
| Non-goals Containment | `pass` | Reviewed Domain B files do not implement editor UI, operation handlers, validator diagnostics, persistence/e2e, static opacity editor, general timeline editor, full renderer, pixel oracle, image parser/decode, asset I/O, Cubism compatibility, or dependency changes. A forbidden-term scan in the reviewed files only found existing `canvas-y-down-v1` coordinate-system strings and a pre-existing test drawable ID containing `runtime_oracle`; it did not indicate a renderer oracle implementation. |
| Orchestration Compliance | `pass` | Based on the assignment, this is a separate Review-Sylph context from the Gnome implementation. The assignment states Orch-Sylph delegated implementation/review and only read diffs; this review independently read basis docs, diffs, source files, and ran verification. |

## Verification Run

- `pnpm.cmd exec vitest run packages/runtime-core/src`: pass, 25 files / 79 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/runtime-core/src`: pass with LF/CRLF warnings only.
- `rg -n "[ \t]+$" packages/runtime-core/src/mask-relation-evidence.ts`: no matches. This was run because `git diff --check` does not cover untracked files.
- `git status --short -uall`: confirmed parallel A/C changes exist outside Domain B; they were not reviewed except for boundary/noise awareness.

## Remaining Issues

- No Domain B source fix is required.
- Non-blocking note: `runtime-evidence.test.ts` has a disabled-relation non-containment assertion, but the disabled relation is not actually included in that test fixture (`packages/runtime-core/src/runtime-evidence.test.ts:94-143`). This does not block Domain B because enabled filtering is an authoring-to-runtime adapter responsibility (`packages/authoring-core/src/to-runtime-graph.ts:44-50`), and Domain B's required runtime evidence lanes are covered by the focused runtime tests above. A later integration/domain test could make disabled-filter coverage less implicit.

## User-Decision Points

- No user decision is required for Domain B.
- If later waves require actual visual clipping, pixel output, SVG/canvas/WebGL behavior, or image decode, that would be a new scope decision because Wave 27 Domain B intentionally records semantic evidence only.
