# Wave 24 Domain A Completion: Viewer Evaluation Foundation

> Target: `wave24-viewer-evaluation-foundation`
> Date: 2026-06-01
> Orch-Sylph: current context
> Gnome implementation: `019e7eb0-3bfd-7923-9170-f3e267e824cc` / `Gnome the 32nd`
> Review-Sylph: `019e7ebf-38d9-70c0-ac7c-5df2015740e9` / `Sylph the 33rd`
> Status: `pass`

## Summary

Domain A is `pass`.

Source implementation was delegated to Gnome and independent review was delegated to Review-Sylph. Orch-Sylph did not implement source code.

The implementation adds a runtime-core viewer evaluation foundation that can build deterministic viewer-context runtime snapshots and diffs from a normalized package graph, with viewer session parameter overrides applied as evaluation input rather than authoring operations. It also adds narrow editor-session adapter helpers for active authoring sessions and saved package documents. Viewer evidence metadata records `surface: "viewer"` through the runtime evaluation context and evidence object.

## Changed Files

Source and tests:

- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/viewer-evaluation.test.ts`
- `packages/runtime-core/src/index.ts`
- `apps/editor/src/editor-session/viewer-session-adapter.ts`
- `apps/editor/src/editor-session/viewer-session-adapter.test.ts`
- `apps/editor/src/editor-session/index.ts`

Review artifact:

- `discussion/implementation/reviews/wave24/wave24-domain-a-viewer-evaluation-foundation-review.md`

This completion report:

- `discussion/implementation/waves/wave24/wave24-domain-a-viewer-evaluation-foundation-completion.md`

## Pass Evidence

- Same package plus same viewer parameter override yields the same viewer snapshot/state/diff.
- Viewer parameter override changes the viewer snapshot and runtime diff deterministically.
- Active authoring session and saved package document adapter paths produce the same viewer snapshot/diff.
- Wave23-style project-defined dynamics output is consumed by viewer evaluation without Cubism Physics, Cubism Viewer, or Cubism SDK/Core compatibility claims.
- Public `index.ts` changes are barrel-only exports.

## Verification

Gnome verification:

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-session/viewer-session-adapter.test.ts` | pass; 4 tests |
| Existing focused runtime/editor-session tests | pass; 28 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd test:unit` | pass; 111 files / 575 tests |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/runtime-core apps/editor/src/editor-session discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24` | pass; LF/CRLF warnings only |
| Manifest/lockfile status check | pass; no changes |
| Forbidden-scope scan over changed files | pass |

Review-Sylph verification:

| Check | Result |
|---|---|
| Changed files and untracked files inspected directly | pass |
| `git diff -- packages/runtime-core/src/index.ts apps/editor/src/editor-session/index.ts` | pass; barrel-only exports |
| Trailing whitespace scan over untracked Domain A source/test files | pass |
| Forbidden-scope scan over changed files | pass |
| Dependency manifest diff check | pass |
| `pnpm.cmd exec vitest run packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-session/viewer-session-adapter.test.ts` | pass; 2 files / 4 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src/dynamics-evaluation.test.ts` | pass; 1 file / 3 tests |
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/browser-sample-package.test.ts` | pass; 1 file / 3 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/runtime-core apps/editor/src/editor-session discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24` | pass; LF/CRLF warnings only |

## Review Result

Independent Review-Sylph verdict: `pass`.

Findings: none.

Review report:

- `discussion/implementation/reviews/wave24/wave24-domain-a-viewer-evaluation-foundation-review.md`

The review confirmed design/development compliance, test adequacy, Domain A pass evidence, forbidden-scope compliance, dependency policy compliance, source organization compliance, and barrel-only public index changes.

## Residual Risks

- This is a foundation only. UI surface, validator/report integration, persistence smoke, and visible browser workflow remain for later Wave24 domains.
- Multi-frame viewer session progression can be represented by passing `previousState` and explicit reset reasons, but Domain A tests focus on deterministic snapshot/diff and Wave23 dynamics consumption rather than multi-frame progression.
- `git diff --check` does not include untracked files; Review-Sylph separately inspected and whitespace-scanned the untracked Domain A source/test files.

## User Decision Points

None.
