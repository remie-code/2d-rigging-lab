# Wave68 Domain B Spec Compliance Review

- Verdict: `pass`
- Lane: Spec Compliance Review
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-mesh-auto-outline-v6a-local-sidecar`
- Reviewer: Review-Sylph lane 1
- Date: 2026-06-14

## Scope Reviewed

Reviewed Wave68 Domain B against the Wave68 plan, Domain A contract baseline, v6a design basis, mesh-generation design map, preplan inventory, and development conventions. I inspected source and tests directly rather than relying on Gnome summary text.

Reviewed implementation-relevant files:

- `packages/authoring-core/src/mesh-generation-v6a-local.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- Read `packages/operation-core/src/operations/generate-mesh.ts` where v6 provenance formatting affects observed Domain B operation evidence.

Observed but not attributed to Domain B unless directly required by the v6a review: existing dirty `apps/editor/**`, old V2.6/V4 algorithm files, package manifests, lockfile, dependency registry, Domain A artifacts, and other Wave68 planning/design artifacts.

## Findings

### Blocking

None.

### Low: Domain B implementation report artifact was not present in the worktree

`discussion/implementation/waves/wave68/` currently contains the Domain A report and map only. I did not find `discussion/implementation/waves/wave68/wave68-domain-b-mesh-auto-outline-v6a-local-sidecar-report.md`.

This does not block this Spec Compliance lane's source-level verdict because the delegated task was to write only this review artifact, and the Domain B acceptance checks below were performed directly against source/tests. Final integration should still require the Domain B Gnome report/map bookkeeping separately before treating Wave68 artifacts as complete.

## Requirement Classification

| Requirement | Status | Evidence |
|---|---|---|
| `auto-outline-v6a-local` generates valid deterministic meshes on representative alpha fixtures | `implemented` | v6a generation pipeline is implemented in `mesh-generation-v6a-local.ts:88`, with soft mask, components, boundary loops, boundary samples, interior samples, triangulation, stable IDs, and v6 metrics at `:97`, `:102`, `:113`, `:125`, `:136`, `:144`, `:168`, `:186`. Tests run deterministic two-call equality over rectangle, curved blob, thin tapered, and hole-like fixtures at `mesh-generation.test.ts:1135`. |
| Empty alpha returns explicit fallback/blocker metadata | `implemented` | v6a returns blocked `alpha-empty` when no opaque pixels exist at `mesh-generation-v6a-local.ts:99`; routing converts blocked results to explicit `bounds-grid` fallback metadata at `mesh-generation.ts:979` and `:991`. Test coverage starts at `mesh-generation.test.ts:1307`. |
| Missing alpha bytes return explicit fallback/blocker metadata | `implemented` | `createV6ALocalMeshResult` emits `texture-bytes-unavailable` through `createV6BlockedFallbackMeshResult` at `mesh-generation.ts:941`, `:950`, and `:991`. Test coverage starts at `mesh-generation.test.ts:1342`. |
| Large Motion / Standard / Low Motion affect density in the expected direction | `implemented` | Density parameters increase/decrease boundary and interior sampling at `mesh-generation-v6a-local.ts:863`; tests assert high > medium > low for vertices/triangles and boundary counts at `mesh-generation.test.ts:1201`. |
| Quality metrics distinguish boundary/interior counts and fallback steps | `implemented` | `MeshGenerationV6Metrics` includes `fallbackSteps`, `boundaryVertexCount`, and `interiorVertexCount` at `mesh-quality-metrics.ts:141`; v6a populates those values at `mesh-generation-v6a-local.ts:186`. Operation provenance emits the same fields at `generate-mesh.ts:497`. |
| Existing V2.6 default remains stable | `implemented` | Current Editor default remains `auto-outline-v2.6-soft-apron` at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:279`, with preview/apply paths at `editor-session-context.tsx:653` and `:689`. Parent verification reports focused authoring/operation Vitest pass and `pnpm.cmd typecheck` pass. |
| Existing V4 sidecar tests remain stable | `implemented` | V4 sidecar test coverage remains in `mesh-generation.test.ts:1043`; focused parent verification passed 2 files / 55 tests. |
| v6a output preserves mesh DTO invariants: vertices/UVs/triangles/stable IDs/bounds/source/provenance | `implemented` | v6a constructs aligned vertices/UVs/triangles, stable vertex/triangle IDs, `topologyRevision: 0`, cloned bounds, and provenance at `mesh-generation-v6a-local.ts:160`. `expectValidMeshDto` checks cardinality, stable ID shape, valid triangle indices, and nonzero area at `mesh-generation.test.ts:1505`; tests assert source and metrics at `:1161`. |
| v6a approximate triangulation is reported honestly | `implemented` | Triangulation mode is `v6a-local-earclip-steiner-approximation` at `mesh-generation-v6a-local.ts:185`; provenance includes `limitation-not-full-constrained-delaunay` at `:892`. Tests assert the limitation at `mesh-generation.test.ts:1187` and operation provenance at `generate-mesh.test.ts:434`. |
| v6a becomes implemented while v6b/v6c remain deferred and visible | `implemented` | Candidate metadata marks v6a `implemented`, v6b/v6c `deferred` at `mesh-generation-contract.ts:51`, `:61`, and `:69`; tests assert this candidate table at `mesh-generation.test.ts:1080`. |
| v6b/v6c deferred backends remain explicit non-success fallbacks | `implemented` | Deferred routing remains separate from v6a at `mesh-generation.ts:117` and `:1057`; tests assert `v6-backend-not-implemented` fallback metadata for v6b/v6c at `mesh-generation.test.ts:1243`. |
| Do not switch default to v6 | `implemented` | No v6 default found in the inspected default paths; default evidence is listed above. |
| Do not add a permanent/final backend selector UX | `not relevant` | Domain B does not implement Editor selector UI. Domain E owns temporary selector work by plan. |
| Do not claim Cubism compatibility or pixel-perfect reproduction | `implemented` | Targeted search over Domain B source/test files found no Cubism/pixel-perfect claims; v6a provenance states an algorithm limitation instead. |
| Do not add dependencies by Domain B | `implemented` | `mesh-generation-v6a-local.ts` imports only workspace contracts/package-format and local authoring-core modules. Existing manifest/lockfile/dependency-registry diffs are Domain A dependency-gate work, not v6a local backend implementation. |
| Do not use V1-V5 / grid / envelope / apron / contour-band internals as v6a algorithm basis | `implemented` | `mesh-generation-v6a-local.ts` has no imports from old mesh algorithm modules and targeted fixed-string search found no old algorithm references. The v6a pipeline is local to the new file; blocked fallbacks route through shared fallback metadata outside the v6a algorithm. |
| Full constrained Delaunay support | `explicit non-goal` | v6a uses an ear-clip + deterministic interior split approximation and reports `limitation-not-full-constrained-delaunay`; it does not claim CDT. |
| Full hole/multi-island support in v0 | `explicit non-goal` | v6a reports `main-island-only` for multiple components and `unsupported-fallback` / limitation provenance for hole-like regions at `mesh-generation-v6a-local.ts:206` and `:892`; tests assert hole limitation metadata for the hole-like fixture at `mesh-generation.test.ts:1192`. |
| Forbidden write scope avoided | `implemented` | Domain B production logic is in `packages/authoring-core`. I did not find Domain B-dependent changes in `apps/editor/**`, render packages, package-format, or dependency files. `packages/operation-core/src/operations/generate-mesh.test.ts` only verifies operation-visible v6 provenance for the shared contract. |

## Verification Performed

Read basis documents:

- `discussion/implementation/orchestration/wave68-plan.md`
- `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md`
- `discussion/implementation/reviews/wave68/wave68-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-a-test-adequacy-review.md`
- `discussion/design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/implementation/waves/wave68-preplan-mesh-generation-replacement-inventory.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`

Commands/checks I ran:

| Command | Result |
|---|---|
| `git status --short -uall` | Confirmed Domain B files plus unrelated dirty areas listed in the delegation context. |
| Targeted source/diff reads with `Get-Content`, `git diff`, `rg`, and `Select-String` | Confirmed v6a implementation, contract metadata, tests, default evidence, and old-algorithm firebreak. |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- <tracked Domain B relevant files>` | pass; LF/CRLF warnings only. |
| `Select-String -Path packages/authoring-core/src/mesh-generation-v6a-local.ts -Pattern '[ \t]+$'` | no matches. |
| `Select-String -SimpleMatch` over `mesh-generation-v6a-local.ts` for old algorithm module names and old method names | no matches. |

Parent verification already performed and accepted as current evidence:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Initial sandbox hit expected Windows `esbuild spawn EPERM`; escalated rerun passed, 2 files / 55 tests. |
| `pnpm.cmd typecheck` | pass |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check` on tracked Domain B files | pass with LF/CRLF warnings only |
| no-index `git diff --check` on new/untracked v6 files | pass with LF/CRLF warnings only |

I did not run `pnpm install`.

## Residual Risks

- v6a is a local approximation, not true constrained Delaunay. This is acceptable for Domain B because the output reports `v6a-local-earclip-steiner-approximation` and `limitation-not-full-constrained-delaunay`.
- Hole-like and multi-island handling is explicitly limited. The current behavior reports limitations instead of claiming full support.
- Representative fixture coverage is adequate for the Domain B spec lane, but broad pathological-mask quality remains out of scope for v0.
- Domain B's Gnome implementation report artifact was not present in the worktree. Final integration should require that report and map bookkeeping separately.

## User-Decision Points

None for Domain B Spec Compliance.

No product decision is needed to accept this lane. The only follow-up is orchestration bookkeeping for the missing Domain B implementation report artifact before final Wave68 closeout.
