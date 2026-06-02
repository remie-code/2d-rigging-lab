# Wave32 Domain F Clean-Context Review

Verdict: `pass`

Target: `wave32-warp-lattice-fixtures-and-e2e-smoke`

Reviewer role: Review-Sylph clean-context reviewer. I used the Gnome implementation report as context only, then inspected the actual Domain F files, diffs, fixture JSON, e2e assertions, upstream pass artifacts, and verification output directly.

## Scope Reviewed

- `fixtures/contracts/wave32-warp-lattice2d-contract-fixtures/**`
- `packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts`
- `apps/editor/e2e/warp-lattice-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave32/domain-f-gnome-implementation-report.md`

Other Wave32 A-E worktree changes were treated as upstream context only.

## Basis Checked

- Wave32 plan Domain F requires fixture/e2e-only proof for create -> bind drawable -> `controlPointOffsets` keyform -> Preview / Viewer evidence -> save/load reinspection, with no renderer, pixel oracle, parser, Cubism compatibility, File System Access, archive, or dependency expansion.
- Upstream completion/review artifacts for Domains A-E report `pass`, with Domain E passed after the Undine-approved narrow app-shell corrective scope.
- Source organization, dependency, schema/ID, fixture manifest, and traceability policies were checked for the Domain F scope.

## Findings

No blocking, needs-fix, or escalation findings.

Low residual test-infra note, not a Domain F implementation finding: the first integrated `pnpm.cmd test:e2e` run failed before page creation with `TypeError: fetch failed` / `bad port` from Chrome debugging-port fetch. A rerun of the same command passed for desktop and mobile. The standalone Domain F e2e also passed before this, so I did not classify the transient launcher-port failure as a Domain F assertion or evidence gap.

## Fixture Determinism And Rights-Clean Boundary

Pass.

- The fixture manifest declares semantic JSON-only boundaries at `fixtures/contracts/wave32-warp-lattice2d-contract-fixtures/fixture-manifest.json:57`, including `rightsCleanJsonOnly: true`, `realImageBytes: false`, `parserOracle: false`, `rendererOracle: false`, `pixelOracle: false`, `cubismCompatibilityOracle: false`, and `externalDependency: false`.
- The baseline package is synthetic semantic JSON with rights/provenance records and no binary asset bytes; the fixture test verifies all rights records are cleared at `packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts:226`.
- Requests are deterministic semantic operation requests: create at `fixtures/contracts/wave32-warp-lattice2d-contract-fixtures/request/create-warp-lattice2d-commit.request.json:20`, bind at `fixtures/contracts/wave32-warp-lattice2d-contract-fixtures/request/bind-warp-lattice2d-drawable-commit.request.json:20`, and keyform at `fixtures/contracts/wave32-warp-lattice2d-contract-fixtures/request/add-control-point-offsets-keyform-commit.request.json:21`.
- The keyform request pins `targetProperty: "controlPointOffsets"` and a four-point Vec2 patch at `fixtures/contracts/wave32-warp-lattice2d-contract-fixtures/request/add-control-point-offsets-keyform-commit.request.json:27` and `fixtures/contracts/wave32-warp-lattice2d-contract-fixtures/request/add-control-point-offsets-keyform-commit.request.json:33`.

## Assertion Adequacy

Pass.

- The focused fixture test parses the fixture through DTO schemas and asserts the operation sequence at `packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts:77`.
- The second fixture test commits operations, materializes a package, reloads the package, builds runtime evidence, evaluates Viewer evidence, and validates with viewer-aligned runtime evidence at `packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts:99` through `packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts:125`.
- Expected summaries are not hand-compared against static fixture text only; they are derived from operation outcomes, package materialization/reload, runtime/viewer evaluation, and validator output.
- I did not find assertion weakening intended to hide evidence mismatch. The validation summary uses `runtimeSnapshotIds` for viewer-aligned evidence; the `viewerEvidenceSnapshotId: null` field is a local summary placeholder, while validator source records viewer evidence through runtime snapshot IDs and supplemental refs.

## E2E Evidence Adequacy

Pass.

- The standalone e2e creates the warp lattice, binds `draw_body`, adds `controlPointOffsets`, asserts Preview evidence, opens Viewer runtime, asserts Viewer evidence, saves, reloads, and reinspects Preview/Viewer evidence at `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:69` through `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:92`.
- Create, bind, and keyform operation log assertions are explicit at `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:120`, `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:133`, and `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:147`.
- Preview and Viewer assertions check semantic text, affected drawables, evaluated rig control status, parameter override, runtime diff, and no diagnostics at `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:170` and `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:178`.
- Save/load reinspection verifies operation log, rig control, binding, keyform, generated runtime artifacts, and generated validation artifacts from localStorage package JSON at `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:212`, `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:271`, and `apps/editor/e2e/warp-lattice-persistence-smoke.mjs:296`.
- Integrated smoke wiring adds the new smoke after the existing rig-control smoke and resets the project after it at `apps/editor/e2e/smoke-checks.mjs:179`.

## Scope And Non-Goals

Pass.

- Domain F tracked diffs are narrow: e2e smoke integration/test IDs plus fixture and traceability registration. New files are fixture JSON, a focused operation-core fixture regression, a standalone e2e smoke, and the implementation report.
- No dependency manifest or lockfile diffs were present.
- No new parser, renderer, pixel oracle, Cubism compatibility oracle, PSD/PNG/image/archive import, File System Access API, or external dependency expansion was found in Domain F changes.
- The new e2e file is long but cohesive: it owns one browser smoke workflow and helper assertions for this Domain F path. It does not add production implementation logic or a broad source catch-all.

## Verification Run

All commands required escalated local execution because sandboxed PowerShell failed to spawn with `windows sandbox: spawn setup refresh`.

- `pnpm.cmd exec vitest run packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts`
  - Result: pass, 1 file / 2 tests.
- `node apps/editor/e2e/warp-lattice-persistence-smoke.mjs`
  - Result: pass, desktop and mobile.
- `pnpm.cmd typecheck`
  - Result: pass.
- `pnpm.cmd test:e2e`
  - First run: failed before page creation with Chrome debugging-port `bad port`.
  - Rerun: pass, desktop and mobile.
- `git diff --check -- fixtures/contracts/wave32-warp-lattice2d-contract-fixtures packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts apps/editor/e2e/warp-lattice-persistence-smoke.mjs apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/test-ids.mjs discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md discussion/implementation/waves/wave32/domain-f-gnome-implementation-report.md`
  - Result: pass; Git reported LF-to-CRLF working-copy warnings only.
- `rg -n "[ \t]+$" fixtures/contracts/wave32-warp-lattice2d-contract-fixtures packages/operation-core/src/wave32-warp-lattice2d-contract-fixtures.test.ts apps/editor/e2e/warp-lattice-persistence-smoke.mjs discussion/implementation/waves/wave32/domain-f-gnome-implementation-report.md`
  - Result: pass; no matches.
- Dependency manifest diff check over `package.json`, `pnpm-lock.yaml`, and relevant workspace `package.json` files
  - Result: pass; no changed manifest names.

## Separation

Gnome / Review-Sylph separation was preserved from my perspective. I read the implementation report, but the verdict is based on direct inspection of the changed files, untracked fixture/test/e2e files, policy basis, upstream pass artifacts, and locally rerun verification.

## Remaining Issues / User Decisions

No Domain F user-decision points remain.

Residual note for future infrastructure hardening: the integrated e2e launcher can select a debugging port rejected by Node fetch as a blocked port. This is outside the Domain F implementation scope and did not reproduce on rerun.
