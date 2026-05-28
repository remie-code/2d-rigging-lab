# Wave 2 Integration Review

> Wave: `package-runtime-validator-foundation`  
> 実施日: 2026-05-29  
> Reviewer: Undine integration review  
> Verdict: pass

## 1. Review Basis

- [../../orchestration/wave2-plan.md](../../orchestration/wave2-plan.md)
- [wave2-package-format-foundation-completion.md](wave2-package-format-foundation-completion.md)
- [wave2-runtime-core-foundation-completion.md](wave2-runtime-core-foundation-completion.md)
- [wave2-validator-core-foundation-completion.md](wave2-validator-core-foundation-completion.md)
- [wave2-minimal-contract-fixture-completion.md](wave2-minimal-contract-fixture-completion.md)
- [../../reviews/wave2/wave2-package-format-foundation-review.md](../../reviews/wave2/wave2-package-format-foundation-review.md)
- [../../reviews/wave2/wave2-runtime-core-foundation-review.md](../../reviews/wave2/wave2-runtime-core-foundation-review.md)
- [../../reviews/wave2/wave2-validator-core-foundation-review.md](../../reviews/wave2/wave2-validator-core-foundation-review.md)
- [../../reviews/wave2/wave2-minimal-contract-fixture-review.md](../../reviews/wave2/wave2-minimal-contract-fixture-review.md)

## 2. Domain Gate Summary

| Domain | Implementation | Review | Integration status |
|---|---|---|---|
| `wave2-package-format-foundation` | pass | pass | pass |
| `wave2-runtime-core-foundation` | pass | pass | pass |
| `wave2-validator-core-foundation` | pass | pass | pass |
| `wave2-minimal-contract-fixture` | pass | pass | pass |

## 3. Integration Fixes Applied

Review follow-ups that were safe to handle inside integration were applied.

- `pnpm-lock.yaml` was synchronized after package manifests added direct workspace dependencies.
- `generated/dependencies/dependency-registry.json` now expands `zod` scope to `contracts`, `package-format`, `runtime-core`, and `validator-core`.
- `packages/runtime-core/src/snapshot.ts` now uses stricter public ID schemas for package ID, dynamics group ID, and mask relation ID.
- `packages/runtime-core/src/dependency-boundary.test.ts` now blocks runtime-core imports of `package-format`, `validator-core`, and `operation-core`.
- `packages/package-format/src/source-manifest.ts` no longer introduces `generated-fixture-profile-v1`; generated fixture sources use the contract-listed `split-png-fallback-v1` import profile.
- `fixtures/contracts/minimal-valid-package/assets/sources/generated/minimal-body.json` was added so the generated fixture source path points to a text JSON artifact.

## 4. Boundary Review

| Boundary | Result |
|---|---|
| `package-format` does not import `runtime-core`, `validator-core`, or `operation-core` | pass |
| `runtime-core` does not import `package-format`, `validator-core`, or `operation-core` | pass |
| `validator-core` imports public package entrypoints only | pass |
| `index.ts` files remain barrel-only | pass |
| fixture uses text JSON only and no proprietary / Cubism assets | pass |
| dependency registry and lockfile reflect direct runtime dependency changes | pass |

## 5. Verification

| Command | Result |
|---|---|
| `pnpm install` | pass |
| `pnpm exec vitest run packages/package-format/src packages/runtime-core/src packages/validator-core/src` | pass. Sandbox EPERM 後、外部権限で 8 files / 18 tests pass |
| `pnpm typecheck` | pass |
| `pnpm check:deps` | pass |
| `pnpm check:source` | pass |
| `pnpm check` | pass. Sandbox EPERM 後、外部権限で 15 files / 96 tests pass |
| forbidden import searches for Wave 2 boundaries | pass. No matches |
| `git diff --check -- . ':!pnpm-lock.yaml'` | pass. CRLF warning only |

## 6. Remaining Non-blocking Risks

- `packages/package-format/src/model-files.ts` is acceptable for Wave 2, but should be split before keyform / dynamics / rig control DTOs grow substantially.
- `validator-core` summary aggregation is not yet profile-aware. This must be revisited before strict / viewer / acceptance profiles get broader semantic checks.
- `runtime-core` still implements only the foundation shape. Full mesh deformation, rig hierarchy evaluation, keyform sampling, and complete `scalarDampedFollowV1` solver remain future work.
- Runtime graph conversion from package DTOs is still test-local. A production package-to-runtime adapter is intentionally out of scope for Wave 2.

## 7. User Decision Points

- なし。

## 8. Verdict

`pass`。Wave 2 の dependency order、parallel domain isolation、review gates、fixture integration、dependency synchronization、source organization guard はすべて通過した。
