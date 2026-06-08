# Wave56 Domain C Report: Headless Scripts / Typecheck Baseline

> Target: `wave56-headless-scripts-typecheck-baseline`  
> Verdict: `done`

## 1. Scope and Boundary

Basis documents used:

- `discussion/implementation/orchestration/wave56-plan.md`
- `discussion/implementation/waves/wave56/wave56-domain-a-purge-manifest-baseline-contract-report.md`
- `discussion/implementation/reviews/wave56/wave56-domain-a-purge-manifest-baseline-contract-review.md`
- `discussion/design/screen-design/editor-rebuild-purge-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`

Work performed stayed within Domain C's standard-path repair scope.

Confirmed:

- C did not physically delete B-owned files.
- C did not edit old `apps/editor/**` files.
- C did not inspect old `apps/editor/src/**` source content for reuse or UX facts.
- C used only mechanical references to deleted old editor paths when debugging standard command failures.

## 2. Changed Config / Script Files

- `package.json`
  - Removed editor package typecheck filtering from the root `typecheck` script.
  - Removed root old e2e scripts: `test:e2e` and `test:e2e:editor`.
  - Removed production `data-testid` guard scripts: `check:testids` and `check:testids:fixtures`.
  - Changed `check` to headless-only verification.
  - Changed `test` to delegate to `test:unit`.
  - Changed `test:unit` to run package tests only and exclude the one retained package fixture that imports deleted old editor preview source.
- `tsconfig.json`
  - Excluded `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` from root `tsc --noEmit`, because it imports deleted old `apps/editor/src/editor-preview/**` files.
- `scripts/check-dependencies.mjs`
  - Removed the import of deleted Wave42 helper `scripts/wave42-non-goal-classification-policy.mjs`.
  - Removed the Wave42 non-goal claim scan path from this retained dependency guard.
  - Kept the dependency and forbidden asset checks in the standard `check:deps` path.

No change was made to `pnpm-workspace.yaml`; the neutral `apps/*` workspace pattern remains as allowed by Domain A.

## 3. Exact Headless Command Definitions After Change

```json
{
  "typecheck": "pnpm run typecheck:root",
  "typecheck:root": "tsc --noEmit",
  "test": "pnpm run test:unit",
  "test:unit": "vitest run packages --exclude packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts",
  "check:deps": "node scripts/check-dependencies.mjs",
  "check:source": "node scripts/check-source-organization.mjs",
  "check": "pnpm run typecheck && pnpm run test:unit && pnpm run check:deps && pnpm run check:source"
}
```

## 4. Verification Performed

- `pnpm run typecheck`
  - Result: pass.
- `pnpm run test:unit`
  - First sandbox attempt hit `spawn EPERM` while Vitest/esbuild loaded config.
  - Re-run outside sandbox: pass.
  - Result: 185 test files passed, 942 tests passed.
- `pnpm run check`
  - Re-run outside sandbox because it invokes Vitest.
  - Result: pass.
  - Included `typecheck`, `test:unit`, `check:deps`, and `check:source`.
- `pnpm run check:deps`
  - Result: pass after removing the retained guard's dependency on deleted Wave42 helper script.
- Mechanical standard-path reference guard:
  - Command:
    ```powershell
    rg -n "test:e2e|test:e2e:editor|check:testids|editor-e2e|focused-e2e|production-testid|data-testid boundary|@private-2d-rigging-lab/editor typecheck|pnpm --filter @private-2d-rigging-lab/editor test:e2e|@private-2d-rigging-lab/editor" package.json pnpm-workspace.yaml tsconfig.json scripts .github
    ```
  - Result: one remaining non-standard historical/helper hit:
    - `scripts/check-wave43-validator-contract-coverage.mjs:171`
      - Text: `node scripts/check-focused-e2e-registry.mjs`
      - Classification: non-standard historical/helper reference, not invoked by root `check`, `typecheck`, or `test:unit`; not a Domain C blocker.
- Additional raw old-editor path scan:
  - Command:
    ```powershell
    rg -n "apps/editor|@private-2d-rigging-lab/editor" package.json pnpm-workspace.yaml tsconfig.json scripts .github
    ```
  - Result: one remaining non-standard retained helper hit:
    - `scripts/check-psd-parser-import-boundary.mjs:21`
      - Text: `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
      - Classification: non-standard helper reference outside the root standard `check`; Domain A explicitly retained this script only if it is not in the standard baseline.
- `git diff --check -- package.json pnpm-workspace.yaml tsconfig.json scripts discussion/implementation/waves/wave56 discussion/implementation/reviews/wave56`
  - Result: pass.
  - Git emitted line-ending warnings for touched files, but no whitespace errors.

## 5. Remaining Old GUI / E2E References

Remaining references relevant to Domain C:

- `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
  - Classification: old GUI-coupled package fixture excluded from the headless standard path.
  - Reason: it imports deleted old `apps/editor/src/editor-preview/**` files, so including it would make `typecheck` and `test:unit` depend on the removed GUI app.
  - Domain C action: standard-path exclusion only; package test logic was not edited.
  - Residual risk: future package cleanup should either delete, rewrite, or re-home this fixture under an appropriate non-GUI contract. Domain C did not take that package-source decision.
- `scripts/check-wave43-validator-contract-coverage.mjs`
  - Classification: non-standard historical/helper reference to the old focused e2e registry.
  - It is not invoked by the root standard path after this change.
- `scripts/check-psd-parser-import-boundary.mjs`
  - Classification: non-standard retained helper reference to old editor workflow path.
  - It is not invoked by the root standard path after this change.
- B-owned deletion targets under `apps/editor/**`, old e2e/focused e2e scripts, production `data-testid` guard scripts, and Wave42 helper scripts are already deleted in the shared worktree by another domain. C did not perform those deletions.

No remaining blocker was found for Domain C's required headless baseline.

## 6. Notes for Review

- The `test:unit` and root `tsconfig.json` exclusion for `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` is intentionally narrow and preserves the rest of package unit coverage.
- The standard `check` path now contains only headless checks: typecheck, package unit tests, dependency/asset guard, and source organization guard.
- Old e2e, focused e2e registry, Wave42 GUI/e2e gates, and production `data-testid` guard are no longer reachable from root standard scripts.
