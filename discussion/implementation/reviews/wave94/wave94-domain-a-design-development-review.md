# Wave94 Domain A Design / Development Compliance Review

## Verdict

pass

## Evidence Reviewed

- Source of truth: `discussion/implementation/orchestration/wave94-plan.md`.
- Development conventions: source file organization, dependency, and operation policies.
- Design basis: runtime evaluation semantics and runtime-core contract.
- Implementation report: `discussion/implementation/waves/wave94/wave94-domain-a-runtime-core-nested-warp-rest-bind-semantics-report.md`.
- Source/tests read directly:
  - `packages/runtime-core/src/snapshot.ts`
  - `packages/runtime-core/src/rig-control-evaluation.ts`
  - `packages/runtime-core/src/rig-control-warp-lattice.ts`
  - `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
  - `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`

## Design / Development Findings

- Dual-stream naming and data flow are clear and minimal. `snapshot.ts` derives `referenceVerticesByDrawableId` from normalized drawable base vertices before mesh/keyform deformation and passes it into `evaluateRigControlHierarchy` (`snapshot.ts:190`, `snapshot.ts:196`, `snapshot.ts:361`). The runtime path uses explicit `currentVertices` / `referenceVertices` names rather than overloading the old single `vertices` stream (`rig-control-evaluation.ts:88`, `rig-control-evaluation.ts:405`, `rig-control-evaluation.ts:468`).
- Warp membership and sampling now use rest/reference coordinates, while displacement applies to current coordinates. The inside check and normalized lattice coordinate use `referenceVertex` (`rig-control-warp-lattice.ts:104`, `rig-control-warp-lattice.ts:110`, `rig-control-warp-lattice.ts:208`), and the sampled displacement is added to `currentVertex` (`rig-control-warp-lattice.ts:225`).
- Reference/current mismatch behavior is deterministic and reasonable for Domain A. Missing or length-mismatched reference streams emit runtime diagnostics and leave the current drawable vertices unchanged while preserving opacity application (`rig-control-evaluation.ts:381`, `rig-control-evaluation.ts:390`, `rig-control-evaluation.ts:546`, `rig-control-evaluation.ts:561`). The new mismatch test asserts the safe fallback and diagnostic evidence (`rig-control-nested-warp-rest-bind-semantics.test.ts:78`).
- Rotation/translation semantics were not accidentally changed. Rotation still applies affine transforms only to the current stream (`rig-control-evaluation.ts:491`), while the reference stream is carried unchanged for warp sampling. The updated hierarchy evidence covers parent warp over child rotation with revised numeric expectations (`rig-control-hierarchy-evidence.test.ts:216`).
- Child-first effect application remains clear. The chain still starts from the direct drawable rig control, walks to ancestors, and reduces in that order (`rig-control-evaluation.ts:441`, `rig-control-evaluation.ts:460`, `rig-control-evaluation.ts:474`).
- Package-format, runtime export format, render-core/render-webgl2, atlas, dynamics, workspace save, runtime player, and editor app boundaries are respected. The scoped diff for those forbidden areas was empty; the reviewed source changes are limited to `packages/runtime-core/src/**` plus the Domain A report.
- No dependency or lockfile change was found. `package.json` / `pnpm-lock.yaml` showed no diff, and `node scripts/check-dependencies.mjs` passed.
- No catch-all file growth or barrel misuse was introduced. `packages/runtime-core/src/index.ts` was unchanged, and `node scripts/check-source-organization.mjs` passed.
- Runtime helper export choice is acceptable for Domain A. No new Canvas reuse helper was exported. Note that `evaluateRigControlHierarchy` was already exposed through the existing runtime-core barrel, so its signature change is visible at the package entrypoint, but repository search found no in-repo callers beyond `snapshot.ts`, and the change is required by the Domain A dual-stream contract.

## Blocking Issues

None.

## Non-Blocking Risks / Deferred Items

- Domain B still needs to decide whether to mirror the runtime logic or extract a deliberate pure helper. Because `evaluateRigControlHierarchy` is already barrel-exported, Domain B should treat it as a changed internal-facing API unless a stable helper surface is intentionally accepted.
- `rigControl.warpBindingOutsideDomain` validator warning remains deferred as reported by Gnome; that is acceptable for Domain A because runtime semantics and deterministic mismatch handling are implemented first.
- The new nested warp test file is untracked at review time, so standard unstaged `git diff --check` does not cover it. I separately checked it for trailing whitespace with `rg -n '[ \t]+$'`.

## Tests / Guards Considered

- Gnome-reported focused Vitest suite: passed, 3 files / 22 tests.
- Gnome-reported `pnpm.cmd typecheck`: passed.
- Reviewer-ran `git diff --check` on the specified runtime-core files: passed.
- Reviewer-ran `node scripts/check-source-organization.mjs`: passed.
- Reviewer-ran `node scripts/check-dependencies.mjs`: passed.
- Reviewer-ran boundary diff checks for dependency manifests/lockfile and forbidden package/app areas: no diffs found.
