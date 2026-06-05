# Wave45 Domain B Report: Browser PSD Parser Bridge / Session Evidence

> Target: `wave45-browser-psd-parser-bridge-session-evidence`
> Role: Gnome implementation agent
> Date: 2026-06-05
> Verdict: `pass`

## Verdict

`pass`

Editor-local browser PSD parser bridge を実装した。`@webtoon/psd` の直接 import は Domain A が許可した adapter 境界だけに閉じ、外側の workflow service は explicit `File` / `ArrayBuffer` 入力、size cap、parser-free result/error evidence だけを扱う。

## Files Changed

- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge-result.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `discussion/implementation/waves/wave45/wave45-domain-b-browser-psd-parser-bridge-session-evidence-report.md`

No `packages/**`, `package.json`, `pnpm-lock.yaml`, dependency registry, UI workflow components, e2e files, drag-drop/archive/filesystem code, renderer/pixel code, Cubism code, or public asset workflow was changed by Domain B.

## Adapter Design / Import Boundary

- Allowed direct parser import path: `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`.
- Public workflow entrypoints:
  - `parseExplicitBrowserPsdFile({ file, ... })`
  - `parseExplicitBrowserPsdArrayBuffer({ fileName, bytes, ... })`
- `apps/editor/src/editor-workflow/index.ts` remains barrel-only and only re-exports the new bridge/result modules.
- The adapter converts parser output to `PsdAdapterResultDto` and validates it with `PsdAdapterResultSchema`.
- Parser-private `children`, parser node objects, errors, and stacks are not stored in result/session evidence.

Emitted parser-free evidence includes:

- `psd-parser-evidence-v1`
- `psd-layer-tree-evidence-v1`
- `psd-feature-support-evidence-v1`
- optional `psd-layer-materialization-evidence-v1` for a caller-selected layer
- Editor-local `browser-psd-source-evidence-v1`
- Editor-local `psd-parser-error-evidence-v1`
- Editor-local `psd-parser-threading-evidence-v1`

## PSD Size Cap

Default cap: `32 MiB` / `33,554,432` bytes.

Reason: the Wave44 private/local sample PSD is `22,406,225` bytes, so the cap permits the proven fixture while keeping the first browser bridge bounded. Oversize input is rejected before parser execution and returns structured error evidence. This is a conservative Wave45 default, not a final product policy.

## Failure Handling

- Oversize bytes return `status: "rejected"` with `failureKind: "sizeLimitExceeded"`.
- Parser failures return `status: "failed"` with `failureKind: "parserFailure"`.
- Selected-layer materialization failures keep parse result status `parsed` when layer tree parse succeeded, and attach `failureKind: "materializationFailure"`.
- Error evidence keeps message summaries only; no parser object or stack is emitted.
- Selected-layer materialization summary records raw RGBA byte length/digest only; raw raster bytes are not persisted.

## Worker / Main Thread Decision

Worker architecture was not implemented in Domain B. The bridge records:

- `execution: "main-thread"`
- `workerDecision: "not-implemented-wave45-domain-b-bounded-scope"`
- `risk: "large-psd-parse-may-block-ui-size-cap-required"`

This keeps Wave45 bounded. A later domain/wave can move the adapter behind a Worker without changing the parser-free result shape.

## Verification

| Command/check | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts` | Passed, 4 tests. Covers sample PSD parse/materialization, ArrayBuffer oversize rejection, explicit `File` oversize evidence, invalid bytes parse failure. |
| `pnpm.cmd typecheck` | Passed after fixing exact-optional and parser child type annotations. |
| `pnpm.cmd run check:source` | Passed. |
| `pnpm.cmd run check:deps` | Passed. |
| Direct parser import scan with `Select-String -SimpleMatch 'from "@webtoon/psd"'` over `apps`, `packages`, `scripts` | Matches only `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts` and existing Wave44 scripts `scripts/wave44-psd-layer-materialization.mjs`, `scripts/wave44-psd-parser-smoke.mjs`. |
| Dynamic import / require scans for `@webtoon/psd` | No matches. |
| `git diff --check -- apps/editor/src/editor-workflow/index.ts` | Passed; CRLF warning only. |
| `git diff --check --no-index -- NUL <new Domain B files>` | No whitespace findings; command exits `1` as expected for no-index comparison against `NUL`; CRLF warnings only. |

## Observed External Changes

The working tree already contains Domain A registry/report/review changes and an untracked Domain C report. Domain B did not edit or revert them.

## Remaining Issues

- Domain D still needs UI wiring for explicit file selection and layer tree display.
- Domain C owns package/session operation evidence integration; Domain B only emits parser-free adapter/session evidence.
- Domain F should later add focused e2e/import guard coverage for the full UX path.
- Main-thread parsing remains a recorded risk until a Worker path is implemented.

## User-Decision Points

None for Domain B.

Future user decisions remain required before widening to public demo assets, public sample PSD visual distribution, drag-drop/archive/filesystem/File System Access API, full renderer/pixel oracle, Cubism compatibility, or repair/LLM/autofix scope.
