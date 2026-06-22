# Runtime Player Wave2 Domain A Post-Install Typecheck Follow-Up Review

Target: `runtime-player-wave2-runtime-export-loader-ipc`

## Verdict

`pass`

The post-install follow-up fix is narrow and resolves the Runtime Player typecheck failure without changing Runtime Export validation behavior.

## Review Basis

- `discussion/runtime-player/implementation/orchestration/player-wave2-plan.md`
- `discussion/runtime-player/implementation/waves/wave2/runtime-player-wave2-domain-a-runtime-export-loader-ipc-report.md`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts`
- `packages/package-format/src/parse-result.ts`
- `git status --short -uall apps/runtime-player discussion/runtime-player/implementation pnpm-lock.yaml`

## Findings

### Pass: Follow-Up Fix Is Narrow

`apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts` now defines `formatParseIssues` as:

```ts
function formatParseIssues(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[]
): readonly string[] {
  return issues.map((issue) => {
    const issuePath = issue.path.length === 0 ?
      "/" :
      `/${issue.path.map((segment) => String(segment)).join("/")}`;

    return `${issuePath}: ${issue.message}`;
  });
}
```

This matches `PackageParseFailure.issues` from `packages/package-format/src/parse-result.ts`, where issues are `z.ZodIssue[]`. The Runtime Player typecheck confirms the local structural type is now compatible with the package-format parse result.

### Pass: Validation Behavior Is Preserved

The change only affects formatting of Zod issue paths passed into `RuntimeExportLoaderError` details for invalid manifest/model/atlas parse failures. It does not change:

- which parser is called
- success/failure branching
- loaded payload construction
- artifact path resolution
- byte-length or digest checks
- capability checks

Using `String(segment)` is safe for `PropertyKey` path segments, including possible `symbol` values, because it produces a printable segment instead of throwing during error-detail formatting.

### Pass: Domain A Scope Is Preserved

The follow-up fix remains in the Runtime Export loader/error-reporting path. I found no evidence in the reviewed follow-up fix of changes to:

- `packages/editor`
- Runtime Player input/dynamics implementation
- previous export restore behavior
- Stage WebGL/static rendering

`apps/runtime-player/src/stage/stage-window-app.tsx` still only receives the loaded payload and records receipt state/data attributes. It does not add WebGL/canvas rendering or static model rendering in this follow-up.

Workspace note: a separate scoped status check showed pre-existing dirty files under `apps/editor/**` and `packages/render-core/**`. They are outside this follow-up review target and were not needed to validate the `formatParseIssues` fix.

## Commands Run

```powershell
git status --short -uall apps/runtime-player discussion/runtime-player/implementation pnpm-lock.yaml
```

Result: Domain A Runtime Player, Runtime Player discussion, and `pnpm-lock.yaml` changes are present as expected.

```powershell
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck
```

Result: pass.

```powershell
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit
```

Result in sandbox: blocked by Vitest config startup error from esbuild `spawn EPERM`.

```powershell
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit
```

Result with escalation after the sandbox EPERM: pass, 5 test files / 27 tests.

```powershell
git diff --check -- apps/runtime-player discussion/runtime-player/implementation pnpm-lock.yaml
```

Result: pass. Git reported CRLF normalization warnings only.

## Remaining Issues

None for this follow-up fix.
