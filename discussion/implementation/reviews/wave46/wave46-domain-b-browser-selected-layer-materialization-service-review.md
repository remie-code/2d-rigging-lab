# Wave46 Domain B Review: Browser Selected-Layer Materialization Service

## Final Re-review Verdict

`pass`

Clean re-review after the F1 fix confirms Domain B now satisfies the Wave46 Domain B browser selected-layer materialization contract. The previous `needs_fix` finding is preserved below as resolved history.

No source changes were made by this Review-Sylph. This artifact is the only file updated.

## Scope Reviewed

- Domain B report: `discussion/implementation/waves/wave46/wave46-domain-b-browser-selected-layer-materialization-service-report.md`
- Reported Domain B source/test files:
  - `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
  - `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts`
  - `apps/editor/src/editor-workflow/index.ts`
  - `apps/editor/src/editor-workflow/selected-psd-layer-materialization-result.ts`
  - `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.ts`
  - `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts`
  - `apps/editor/src/editor-state/explicit-psd-import-state.test.ts`
- Repository evidence: `git status --short -uall`, direct parser import scan, focused tests, Editor typecheck, source/dependency guards.

Note: the current worktree contains later Wave46 Domain C-G changes outside Domain B. This review does not attribute those changes to Domain B.

## Basis Documents

- `.codex/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave46-plan.md`
- `discussion/implementation/waves/wave46/wave46-domain-b-browser-selected-layer-materialization-service-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`

## Resolved Findings

### F1 - resolved: browser `File` success path now preserves `explicitFile`

Prior review verdict was `needs_fix` because successful `materializeSelectedPsdLayerFromBrowserFile` calls delegated to the ArrayBuffer entrypoint and recorded `intakeKind: "explicitArrayBuffer"` instead of the browser `File` intake evidence.

Re-review confirms the fix:

- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.ts:56` owns the browser `File` entrypoint and creates source evidence with `intakeKind: "explicitFile"` at `:61`.
- The browser `File` success path reads `file.arrayBuffer()` and passes the existing `source` evidence into the shared internal materialization path at `:86`, so successful materialization preserves `explicitFile`.
- The ArrayBuffer entrypoint still creates `intakeKind: "explicitArrayBuffer"` at `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.ts:97` and `:102`, preserving the separate explicit ArrayBuffer contract.
- Focused tests cover both successful intake kinds: ArrayBuffer success asserts `explicitArrayBuffer` at `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts:40`; browser `File` success starts at `:104` and asserts `explicitFile` at `:132`.

No remaining F1 blocker was found.

## Compliance Review

- Parser import boundary: `@webtoon/psd` direct runtime import remains in the approved Editor/browser adapter (`apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:1`). `node scripts/check-psd-parser-import-boundary.mjs` passed with 5 approved direct import/resolve sites.
- Source organization: `apps/editor/src/editor-workflow/index.ts` remains barrel-only re-export surface. `pnpm.cmd run check:source` passed.
- Dependency boundary: no dependency manifest, lockfile, parser-scope, Cubism, binary, or dependency-registry changes were required by Domain B. `pnpm.cmd run check:deps` passed.
- Scope creep: Domain B remains selected-layer-only browser materialization. Evidence stays private/local, `publicDemoAsset=false`, raw RGBA, and Editor-local candidate-only / not persisted by Domain B (`selected-psd-layer-materialization-result.ts:33`, `:35`, `:36`, `:72`; service evidence construction at `selected-psd-layer-materialization-service.ts:440` and `:463`).
- Report truthfulness at re-review time: the Domain B report still marked itself `needs_review` and explicitly said independent re-review was pending (`discussion/implementation/waves/wave46/wave46-domain-b-browser-selected-layer-materialization-service-report.md:6`, `:10`, `:16`, `:139`). It did not self-mark pass before this review artifact provided the pass verdict. Domain H later updated the Domain B report bookkeeping to Domain B `pass` while preserving the F1 fix-loop history.

## Verification Performed

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts`
  - passed: 1 file / 10 tests.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts apps/editor/src/editor-state/explicit-psd-import-state.test.ts`
  - passed: 2 files / 7 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - passed.
- `node scripts/check-psd-parser-import-boundary.mjs`
  - passed: 5 direct import/resolve sites limited to approved adapter and Wave44 scripts.
- `pnpm.cmd run check:source`
  - passed: source organization guard passed.
- `pnpm.cmd run check:deps`
  - passed: dependency guard passed.

## Historical Prior Review

The previous clean review verdict was `needs_fix`. Its single finding was F1: browser `File` successful materialization could record the wrong intake kind and lacked focused success-path test coverage. The fix loop addressed this by preserving `explicitFile` through the shared materialization path and adding successful browser `File` coverage while retaining ArrayBuffer success coverage.

## User-Decision Points

- None for Domain B.
