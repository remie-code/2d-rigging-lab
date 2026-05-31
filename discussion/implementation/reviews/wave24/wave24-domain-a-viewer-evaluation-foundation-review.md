# Wave 24 Domain A Review: Viewer Evaluation Foundation

> Target: `wave24-viewer-evaluation-foundation`
> Implementer: `019e7eb0-3bfd-7923-9170-f3e267e824cc` / `Gnome the 32nd`
> Role: independent Review-Sylph
> Verdict: `pass`

## Scope

Reviewed the Domain A implementation from the changed source/test files and the required basis documents. This review did not rely on the implementer's explanation and did not edit source implementation. The only write performed by this review is this artifact.

## Findings

No blocking, high, medium, or low findings.

## Design / Development Compliance

Result: `pass`.

- `packages/runtime-core/src/viewer-evaluation.ts` owns one cohesive concern: viewer-context runtime evaluation request parsing, snapshot/diff/evidence construction, and final runtime state ref creation.
- Viewer metadata is applied through `RuntimeEvaluationContextSchema` with `source.surface: "viewer"` and is propagated into snapshots and evidence (`packages/runtime-core/src/viewer-evaluation.ts:108`, `packages/runtime-core/src/viewer-evaluation.ts:238`).
- Parameter overrides are applied to runtime initial state creation and frame evaluation (`packages/runtime-core/src/viewer-evaluation.ts:117`, `packages/runtime-core/src/viewer-evaluation.ts:140`, `packages/runtime-core/src/viewer-evaluation.ts:197`).
- Runtime snapshot comparison and `runtimeDiff` are produced via the existing runtime snapshot comparison path (`packages/runtime-core/src/viewer-evaluation.ts:151`).
- `apps/editor/src/editor-session/viewer-session-adapter.ts` is a narrow adapter from active authoring session or saved package document into the runtime-core viewer evaluator (`apps/editor/src/editor-session/viewer-session-adapter.ts:18`, `apps/editor/src/editor-session/viewer-session-adapter.ts:29`).
- `packages/runtime-core/src/index.ts` and `apps/editor/src/editor-session/index.ts` changed only by adding barrel exports.
- No editor UI surface, validator broad implementation, file picker/parser/archive/image decode/binary upload, standalone viewer app, external dependency, or Cubism SDK/Core/Viewer/Physics compatibility claim was found in the changed files.

## Test Adequacy

Result: `pass`.

- Same package plus same override yields the same viewer snapshot/state/diff and viewer evidence metadata is asserted (`packages/runtime-core/src/viewer-evaluation.test.ts:15`).
- Override changes snapshot and runtime diff deterministically, including parameter diff, drawable diff, and evidence override entries (`packages/runtime-core/src/viewer-evaluation.test.ts:42`).
- Wave23-style Minimum Open Dynamics output is consumed through viewer context as project-defined dynamics without compatibility claims (`packages/runtime-core/src/viewer-evaluation.test.ts:92`).
- Active session and saved package document paths produce identical viewer snapshot/diff and preserve viewer override metadata (`apps/editor/src/editor-session/viewer-session-adapter.test.ts:14`).
- Existing runtime/editor compatibility was checked with targeted existing dynamics and browser sample package tests, plus typecheck.

## Verification Performed

Read basis documents:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave24-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave23/wave23-final-report.md`
- `discussion/implementation/reviews/wave23/wave23-clean-integration-review.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/218_Open_Viewer.md`
- `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`

Inspected changed files directly, including untracked files:

- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/viewer-evaluation.test.ts`
- `packages/runtime-core/src/index.ts`
- `apps/editor/src/editor-session/viewer-session-adapter.ts`
- `apps/editor/src/editor-session/viewer-session-adapter.test.ts`
- `apps/editor/src/editor-session/index.ts`

Commands/checks:

| Check | Result |
|---|---|
| `git status --short -uall -- packages/runtime-core apps/editor/src/editor-session discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24` | confirmed expected tracked barrel changes and untracked implementation/test files |
| `git diff -- packages/runtime-core/src/index.ts apps/editor/src/editor-session/index.ts` | pass; barrel-only exports |
| `git diff --check -- packages/runtime-core apps/editor/src/editor-session discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24` | pass; Git emitted LF/CRLF working-copy warnings only |
| trailing whitespace scan over untracked Domain A source/test files | pass; no matches |
| forbidden-scope scan over changed files | pass; only benign `runtime-core`/import-name matches |
| dependency manifest diff check | pass; no package manifest or lockfile output |
| `pnpm.cmd exec vitest run packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-session/viewer-session-adapter.test.ts` | pass; 2 files / 4 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src/dynamics-evaluation.test.ts` | pass; 1 file / 3 tests |
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/browser-sample-package.test.ts` | pass; 1 file / 3 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |

## Residual Risks

- The new viewer wrapper is a snapshot/diff foundation, not a UI or persistence smoke. Domain B/E should prove the visible viewer workflow and save/load browser path.
- Multi-frame viewer session progression is possible by passing `previousState` and explicit `resetReasons: []`, but the focused Domain A tests do not cover that progression path. Current pass evidence only requires deterministic snapshot/diff and Wave23 dynamics consumption.
- `git diff --check` does not cover untracked files; this review separately inspected the untracked files and ran a trailing whitespace scan over them.

## User Decision Points

None.

## Required Gnome Fix

None.
