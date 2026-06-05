# Wave45 Domain B Review: Browser PSD Parser Bridge / Session Evidence

> Target: `wave45-browser-psd-parser-bridge-session-evidence`
> Role: Review-Sylph independent clean reviewer
> Date: 2026-06-05
> Artifact: `discussion/implementation/reviews/wave45/wave45-domain-b-browser-psd-parser-bridge-session-evidence-review.md`

## Verdict

`pass`

Blocking findings were not found. Domain B keeps the direct `@webtoon/psd` import inside the Editor-local browser PSD parser adapter boundary, accepts only explicit `File` / `ArrayBuffer` byte inputs, rejects oversize bytes before parser execution, and converts parse/materialization outcomes into parser-free evidence.

This is not approval for drag-drop, archive/filesystem, remote URL, broad Editor runtime parser use, direct package/runtime/validator parser imports, full compositing, renderer/pixel oracle, Cubism compatibility, public demo assets, or repair/LLM/autofix scope.

## Scope Reviewed

Changed Domain B files reviewed:

- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge-result.ts`
- `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `discussion/implementation/waves/wave45/wave45-domain-b-browser-psd-parser-bridge-session-evidence-report.md`

Basis used:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave45-plan.md`
- `discussion/implementation/waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md`
- `discussion/implementation/reviews/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-review.md`
- `discussion/implementation/waves/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-report.md`
- `discussion/implementation/waves/wave44/wave44-domain-c-psd-layer-tree-contract-profile-boundary-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- relevant Editor source and local parser type evidence discovered during review

I did not rely on Gnome's report as the only basis. I read the target source/test/report files, required policy and Wave44/Wave45 basis, direct import scans, local parser type metadata, and reran key verification commands.

## Findings

### Blocking

None.

### Low / Residual

- `parseExplicitBrowserPsdFile` reads `file.arrayBuffer()` before applying the size cap at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts:30` and `:68`. The cap still prevents parser execution for oversize bytes and the covered Domain B requirement passes, but a later UX/Worker domain should preflight `File.size` before loading very large browser files into memory.
- `sizeCapBytes` is caller-configurable at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts:16` and `:57`. Current tests cover smaller configured caps, but there is no validation for non-finite or intentionally huge override values. This is acceptable for the bounded internal bridge now; later product-facing wiring should clamp or own the cap policy.

## Criteria Review

1. Parser import boundary: pass.
   - Direct parser import is only in `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:1` through `:5`.
   - Existing Wave44 script imports remain in `scripts/wave44-psd-parser-smoke.mjs:6` and `scripts/wave44-psd-layer-materialization.mjs:6`.
   - Package/app hits outside the adapter are parser-name evidence strings, not imports.
   - Fixed-string dynamic import / direct `require("@webtoon/psd")` scans returned no matches.

2. Explicit input only: pass.
   - Public entrypoints are `parseExplicitBrowserPsdFile` and `parseExplicitBrowserPsdArrayBuffer` at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts:27` and `:43`.
   - Input types are explicit `File` and `ArrayBuffer | Uint8Array` at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts:11` through `:24`.
   - Scope-creep scan over Domain B files found no drag-drop, directory picker, File System Access API, archive/zip, remote URL, or fetch path.

3. PSD size cap: pass.
   - Default cap is `32 * 1024 * 1024` at `apps/editor/src/editor-workflow/browser-psd-parser-bridge-result.ts:9`.
   - Oversize bytes are rejected before adapter/parser execution at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.ts:68` through `:93`.
   - Tests cover ArrayBuffer oversize and File oversize evidence at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts:80` through `:115`.

4. Structured parser-free failure evidence: pass.
   - Parser failures are caught and returned as `status: "failed"` with `failureKind: "parserFailure"` at `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:150` through `:177`.
   - Materialization failures are caught and returned as warning error evidence with `failureKind: "materializationFailure"` at `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:454` through `:477`.
   - Tests assert invalid bytes return structured parser-free evidence and no stack string at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts:117` through `:137`.

5. Parser-free Wave44/Domain C evidence compatibility: pass.
   - Adapter output is validated through `PsdAdapterResultSchema.parse` at `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:104`.
   - Layer tree evidence records `psd-layer-tree-evidence-v1` and parser-private shape exclusion at `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:125` through `:134`.
   - Selected-layer materialization evidence uses `PsdAdapterLayerMaterializationEvidenceSchema.parse` and records digest/byte length without persisting raw raster bytes at `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:401` through `:436`.
   - The success test asserts `JSON.stringify(result.adapterResult)` does not contain `"children"` at `apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts:77`.

6. Worker/main-thread decision: pass.
   - Threading evidence is explicit `execution: "main-thread"`, `workerDecision: "not-implemented-wave45-domain-b-bounded-scope"`, and `risk: "large-psd-parse-may-block-ui-size-cap-required"` at `apps/editor/src/editor-workflow/browser-psd-parser-bridge-result.ts:44` through `:49` and `:115` through `:120`.
   - Adapter diagnostics record main-thread risk at `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:92` through `:101`.

7. Source organization: pass.
   - `apps/editor/src/editor-workflow/index.ts:1` through `:19` remains barrel-only.
   - New files have focused responsibilities: adapter, bridge entrypoints, result/evidence types, and focused tests.
   - `pnpm.cmd run check:source` passed.

8. Test adequacy: pass for Domain B.
   - Focused tests cover sample parse/materialization, ArrayBuffer oversize rejection, File oversize evidence, and invalid byte parser failure.
   - Remaining UI/e2e coverage belongs to later Wave45 Domain D/F.

9. Forbidden write scope: pass for reviewed Domain B target.
   - Reviewed Domain B target files are under `apps/editor/src/editor-workflow/**` and the Wave45 report path.
   - The working tree also contains concurrent `packages/**`, `generated/dependencies/**`, and Domain C report/review changes. I did not attribute or revert them; they are outside this Domain B review scope.

## Verification Performed

Commands/checks rerun:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts`: passed, 4 tests.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd run check:source`: passed, `Source organization guard passed.`
- `pnpm.cmd run check:deps`: passed, `Dependency guard passed.`
- `Select-String -SimpleMatch 'from "@webtoon/psd"'` over adapter and Wave44 scripts: matched only Domain B adapter and existing Wave44 scripts.
- `rg -n -F '@webtoon/psd' apps packages scripts`: package/app non-adapter matches were parser evidence strings; direct parser import was only the adapter plus existing Wave44 scripts.
- Fixed-string scans for `import("@webtoon/psd")`, `import('@webtoon/psd')`, `require("@webtoon/psd")`, and `require('@webtoon/psd')`: no matches.
- Scope-creep scan over Domain B files for drag/drop, directory picker, File System Access API, archive/zip, remote URL, and `fetch(`: no matches.
- `git diff --check -- apps/editor/src/editor-workflow/index.ts`: passed; CRLF warning only.
- `git diff --check --no-index -- NUL <new Domain B source/test/report files>`: no whitespace findings; expected no-index exit `1` with CRLF warnings only.

## Remaining Issues / User-Decision Points

No user decision is required for Domain B to pass.

Remaining implementation obligations for later domains:

- Domain D must wire explicit UI file selection and layer tree display without widening input scope.
- Domain C must consume parser-free evidence only and must not import `@webtoon/psd`.
- Domain F should add focused e2e/import-guard coverage for the complete UX path.
- A later wave/domain should decide whether to move parser work behind a Worker and should preflight `File.size` before reading very large browser files.

Future user decisions remain required before widening scope to public demo assets, public sample PSD visual distribution, drag-drop/archive/filesystem/File System Access API, full renderer/pixel oracle, Cubism compatibility, or repair/LLM/autofix behavior.

## Separation Confirmation

I acted only as the independent review gate. I did not edit implementation files, did not revert concurrent changes, and wrote only this review artifact under the allowed review path.
