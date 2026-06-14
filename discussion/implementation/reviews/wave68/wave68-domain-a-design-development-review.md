# Wave68 Domain A Design / Development Compliance Review

Verdict: `pass` after Fix Loop 2 re-review. Initial verdict was `needs_changes`; Fix Loop 1 verdict was `escalate`.

Reviewer: Review-Sylph, Design / Development Compliance lane  
Scope: Wave68 Domain A, `wave68-v6-shared-contract-dependency-gate-method-surface`

## Fix Loop 2 Re-review

Final re-review verdict: `pass`

Scope of this re-review was limited to the dependency registry governance blocker escalated in Fix Loop 1. Undine did not accept the Domain A report alone as the final dependency registry path and instead authorized a narrow update to `generated/dependencies/dependency-registry.json`.

Dependency-policy registry evidence is now satisfied for this lane:

- The five direct Wave68 dependencies added in `packages/authoring-core/package.json:13` through `:17` are now represented in the dependency registry:
  - `@kninnug/constrainautor` at `generated/dependencies/dependency-registry.json:44`
  - `d3-contour` at `generated/dependencies/dependency-registry.json:52`
  - `delaunator` at `generated/dependencies/dependency-registry.json:60`
  - `poly2tri` at `generated/dependencies/dependency-registry.json:68`
  - `simplify-js` at `generated/dependencies/dependency-registry.json:76`
- The three observed transitive dependencies from `pnpm-lock.yaml` are also represented:
  - `robust-predicates` at `generated/dependencies/dependency-registry.json:84`
  - `d3-array` at `generated/dependencies/dependency-registry.json:92`
  - `internmap` at `generated/dependencies/dependency-registry.json:100`
- Registry versions, licenses, and scopes match the Domain A dependency decision record at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:96` through `:112` and the lockfile entries at `pnpm-lock.yaml:123` through `:144`, `:479`, `:1132`, `:1136`, `:1153`, `:1219`, `:1360`, `:1416`, and `:1434`.
- Scope/status values are machine-readable, Wave68 Domain A scoped, and contain no spaces in the registry fields that function as identifiers.
- `node -e "JSON.parse(require('fs').readFileSync('generated/dependencies/dependency-registry.json','utf8')); console.log('json-parse-ok')"` passed.
- `node scripts/check-dependencies.mjs` passed.
- `git diff --check -- generated/dependencies/dependency-registry.json` passed with LF/CRLF warning only.

This satisfies the dependency-policy requirements for dependency proposal/evidence refs before manifest/lockfile dependency changes (`discussion/development_convention/dependency-policy.md:96`), registry provenance (`:198`), registry update (`:333`), accepted registry path (`:407`), and the review checklist registry item (`:423`).

No remaining Design / Development Compliance findings block Domain A. The previous dirty-worktree scope concerns remain accepted as unrelated/pre-existing based on the Domain A report classification from Fix Loop 1.

## Fix Loop 1 Re-review

Final re-review verdict: `escalate`

The new Domain A report resolves two of the three initial blockers for this lane:

- The `apps/editor/**` and canvas/E2E/Mesh Tool diffs are now explicitly classified as unrelated / pre-existing dirty worktree state in `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:49` through `:58`. I accept this as a Domain A ownership separation rather than a remaining Domain A implementation blocker.
- The V2.6/V4 old algorithm rewrites are likewise classified as unrelated / pre-existing dirty worktree state at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:49` through `:58`. I accept this separation for Domain A. The inspected Domain A v6 contract/fallback path still does not implement backend geometry or use old algorithm internals as the v6 basis.

The dependency governance blocker is reduced but not fully cleared. The new report records a useful dependency decision table for the five direct packages at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:96` through `:104`, transitive license notes at `:108` through `:112`, install/lockfile/guard evidence at `:114` through `:119`, and a policy interpretation at `:121` through `:127`. This satisfies the Wave68 plan's Domain A report-evidence expectation at `discussion/implementation/orchestration/wave68-plan.md:347` through `:354`.

However, the dependency policy still requires registry synchronization as a separate approval-evidence artifact before manifest/lockfile dependency changes are considered compliant:

- `discussion/development_convention/dependency-policy.md:96` requires dependency proposal/license/scope/risk/approval/evidence refs before manifest or lockfile commit.
- `discussion/development_convention/dependency-policy.md:198` requires dependency provenance to be recorded as a dependency registry, license review, lockfile diff, dependency scan result, and forbidden dependency scan result.
- `discussion/development_convention/dependency-policy.md:333` says implementers must not add dependency manifest or lockfile changes without proposal, license review, forbidden scan, approval status, and registry update.
- `discussion/development_convention/dependency-policy.md:407` names `generated/dependencies/dependency-registry.json` or an accepted registry path as the dependency-registry artifact.
- `discussion/development_convention/dependency-policy.md:423` includes "Dependency registry is updated for dependency changes" in the review checklist.

The new report explicitly states that `generated/dependencies/dependency-registry.json` was not edited because the restart's allowed write scope did not include generated evidence (`discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:126`). That is a real orchestration constraint, but it does not by itself satisfy the dependency-policy registry-update requirement.

Answer on generated registry sync: under the current dependency policy, registry synchronization is still a blocker before Domain A can receive a clean Design / Development `pass`, unless Undine explicitly accepts the Domain A report as an "accepted registry path" for this wave or authorizes a scoped update to `generated/dependencies/dependency-registry.json` / another accepted machine-readable registry path. I would not treat registry sync merely as a non-blocking follow-up before C/D imports, because the manifest and lockfile changes are already in Domain A's changed files.

Escalation reason: Domain A source architecture and operation/schema design are passable, but dependency-policy compliance now depends on an Undine/orchestration decision outside this reviewer lane: either authorize the registry evidence update or formally accept the Wave68 Domain A report as the registry artifact for these five dependencies. No additional implementation-file changes are required by this lane.

## Findings

### Blocking: dependency governance evidence is incomplete for the five new direct runtime dependencies

`packages/authoring-core/package.json:13` through `:17` adds `@kninnug/constrainautor`, `d3-contour`, `delaunator`, `poly2tri`, and `simplify-js`. `pnpm-lock.yaml:123` through `:144` adds the importer entries, with package/transitive entries at `pnpm-lock.yaml:479`, `:1136`, `:1153`, `:1360`, `:1434`, `:1843`, `:2425`, `:2435`, `:2600`, and `:2688`.

The dependency registry is not synchronized. `generated/dependencies/dependency-registry.json:1` through `:44` currently records only `@types/node`, `typescript`, `vitest`, `@webtoon/psd`, and `zod`; none of the five new v6 packages are present. This conflicts with the dependency policy requirement that every new dependency have proposal/license/scope/risk/approval evidence before manifest or lockfile commit (`discussion/development_convention/dependency-policy.md:96`, `:198`, `:333`, `:407` through `:411`). The local dependency guard passing is useful but not sufficient because the same policy states the guard does not approve dependencies (`discussion/development_convention/dependency-policy.md:57`).

The design inventory gives a useful initial license/risk summary (`discussion/design/mesh-generation/auto-outline-v6-library-candidate-inventory.md:35` through `:40`) and due-diligence checklist (`:58` through `:63`), but it is not a dependency registry update or approval record. Domain A should either add the required dependency governance evidence or remove/defer the dependency additions and mark v6b/v6c gated.

### Blocking: the current diff contains Domain A-forbidden `apps/editor/**` changes

The worktree diff includes Editor files even though Domain A is a shared contract / dependency gate / method surface task. `discussion/implementation/orchestration/wave68-plan.md:331` through `:337` limits Domain A expected implementation areas to authoring-core, operation-core, optional package-format schema work, coordinated manifests/lockfile, and focused tests. The Domain A forbidden list allows only Editor UI work necessary for type/contract compilation (`discussion/implementation/orchestration/wave68-plan.md:356` through `:361`).

The observed Editor diff is behavior/assertion work, not type-only contract preservation. Examples:

- `apps/editor/e2e/psd-import.e2e.spec.ts:254` through `:256` now expects "Preview Standard mesh" to surface "Auto outline v4 contour band".
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:410` through `:411` adds a user-visible V4 label.
- Additional `apps/editor/src/workspace/canvas/**` diffs change render scene fallback behavior.

If these are from another domain, they need to be excluded from the Domain A review boundary. As the current source/diff stands, Domain A cannot pass the forbidden-scope check.

### Blocking: the current diff includes old algorithm rewrites outside the Domain A shared-contract boundary

Domain A's purpose is to establish the shared v6 method surface, metadata contract, dependency gate, and fixture expectations (`discussion/implementation/orchestration/wave68-plan.md:327` through `:329`). It also says to read only public routing/type boundaries from current mesh-generation code (`:341`) and forbids V1-V5 algorithm implementation copying (`:356` through `:359`). The review role must check the v6 firebreak (`discussion/implementation/orchestration/wave68-plan.md:580` through `:585`).

The full worktree diff includes substantive old-backend algorithm changes that are not in the Domain A implementation file list:

- `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:231`, `:244`, and `:258` double the V2.6 apron ratios/padding; `:273` through `:314` replaces the apron-ring construction with a new frontier-apex path; `:439` changes apron triangle emission.
- `packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts:151` through `:184` routes V4 through new `selectV5...`, `createV5...`, and `mergeV5...` paths; `:232` through `:323` changes V4 preset geometry, thresholds, and target edge logic; `:335` and onward adds V5-named recursive contour-band machinery.

I did not find v6 backend implementation in the inspected Domain A v6 files; `packages/authoring-core/src/mesh-generation.ts:930` through `:1008` honestly routes v6 methods to deferred fallback metadata. The issue is scope contamination: the same diff changes old mesh algorithms and default-visible behavior while Domain A is supposed to provide a shared surface only.

## Policy Checklist

- Source organization: pass for inspected Domain A files. `packages/authoring-core/src/index.ts:25` through `:27` is barrel-only, and the new contract/fixture files are responsibility-scoped. `node scripts/check-source-organization.mjs` passed.
- Operation/schema boundary: pass for inspected Domain A files. `MESH_GENERATION_METHOD_IDS` centralizes methods at `packages/authoring-core/src/mesh-generation-contract.ts:78` through `:88`; `GenerateMeshPayloadSchema` consumes it at `packages/operation-core/src/payloads/model-edit.ts:151` through `:155`; preview allowlist is centralized at `packages/authoring-core/src/mesh-generation-contract.ts:107` through `:116` and used by operation preflight at `packages/operation-core/src/operations/generate-mesh.ts:212`.
- Provenance and machine-readable IDs: pass for inspected Domain A files. v6 method/source/backend IDs are kebab-case and synchronized at `packages/authoring-core/src/mesh-generation-contract.ts:7` through `:17` and `:51` through `:76`; transform history emits machine-readable `meshQuality:v6...` keys at `packages/operation-core/src/operations/generate-mesh.ts:479` through `:512`.
- Dependency policy: needs changes. Manifest/lockfile additions are limited to the five planned packages, and `node scripts/check-dependencies.mjs` passed, but registry/license/scope approval evidence is missing.
- Design boundary: needs changes due old-algorithm and Editor diff contamination. The v6 Domain A code itself uses deferred fallback metadata rather than implementing backends prematurely.
- Firebreak: needs changes at worktree boundary. The inspected v6 contract/fallback code does not copy old backend code, but the same diff contains V2.6/V4 algorithm rewrites that must be isolated from Domain A.
- Forbidden scope: needs changes due `apps/editor/**` diffs and old-backend rewrites in the current Domain A review diff.
- Default remains V2.6: method default was not changed in the inspected package code, but `apps/editor/e2e/psd-import.e2e.spec.ts:254` through `:256` now expects V4 in the standard preview path, which creates default-behavior review risk.
- Determinism/contract ergonomics: pass for inspected Domain A files. Fixtures are deterministic loops/predicates in `packages/authoring-core/src/mesh-generation-v6-fixtures.ts:32` through `:140`; v6 fallback tests assert explicit fallback/blocker metadata at `packages/authoring-core/src/mesh-generation.test.ts:1152` through `:1249`.

## Residual Risk

- I did not treat the design inventory license table as final dependency approval. A dependency reviewer or Domain A fix should add/update the accepted registry path and any required license-review evidence.
- I did not review the large V2.6/V4 algorithm rewrites for correctness because they are outside the assigned Domain A implementation file list; they are flagged here only as design/scope contamination.
- The focused tests pass, but they do not resolve the dependency governance or forbidden-scope issues.

## Verification

Read-only / review commands performed:

- `git status --short -uall`
- `git diff --stat`
- `git diff -- packages/authoring-core/package.json pnpm-lock.yaml packages/authoring-core/src/mesh-generation-contract.ts packages/authoring-core/src/mesh-generation-v6-fixtures.ts packages/authoring-core/src/index.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-quality-metrics.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/payloads/model-edit.ts packages/operation-core/src/operations/generate-mesh.ts packages/operation-core/src/operations/generate-mesh.test.ts`
- `git diff -- apps/editor packages/render-core packages/render-webgl2`
- `git diff -- packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts`
- `rg` inspections over the basis documents, implementation files, dependency registry, lockfile, and forbidden-scope paths
- `git diff --check -- ...` for the inspected Domain A files: passed, CRLF warnings only
- `node scripts/check-dependencies.mjs`: passed
- `node scripts/check-source-organization.mjs`: passed
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`: initial sandbox run failed with `spawn EPERM`; approved rerun passed, 2 files / 53 tests

Did not run `pnpm install`.
