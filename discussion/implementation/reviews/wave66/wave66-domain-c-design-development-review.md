# Wave66 Domain C Design / Development Compliance Review

- Verdict: `pass`
- Target: `wave66-mesh-auto-outline-v2-6-soft-apron-sidecar`
- Review lane: Design / Development Compliance Review
- Mode: independent source review; no implementation fixes made

## Scope Reviewed

Basis documents reviewed:

- `discussion/implementation/orchestration/wave66-plan.md` sections 3, 4, 5, 7.5, 8, 11, 13, 14, 15.
- `discussion/implementation/waves/wave66/wave66-preplan-mesh-v2-6-sidecar-inventory.md`.
- `discussion/design/mesh-generation/auto-outline-v2-6-soft-apron.md`.
- `discussion/design/mesh-generation/auto-outline-v2-5-soft-boundary.md`.
- `discussion/design/screen-design/components/mesh-tool.md`.
- Requested development conventions for UX-backed package logic, source organization, dependencies, operations, and schema/ID rules.

Source evidence reviewed:

- `git diff -- packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-quality-metrics.ts packages/operation-core/src/payloads/model-edit.ts packages/operation-core/src/operations/generate-mesh.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`.
- Direct read of new untracked `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts`.
- `packages/authoring-core/src/index.ts`.
- Repo search for Editor default references and duplicate implementation-side method allowlists.

## Findings

No blocking or warning findings for this review lane.

## Compliance Checks

### Architecture / Module Boundary: pass

- Wave66 requires V2.6 as explicit `auto-outline-v2.6-soft-apron`, without replacing V2.5 default (`discussion/implementation/orchestration/wave66-plan.md:56`, `discussion/implementation/orchestration/wave66-plan.md:57`).
- Domain C allows `packages/authoring-core/**` and `packages/operation-core/**`, while forbidding Canvas Evaluation / Renderer changes and Editor default switch (`discussion/implementation/orchestration/wave66-plan.md:368`, `discussion/implementation/orchestration/wave66-plan.md:374`, `discussion/implementation/orchestration/wave66-plan.md:398`).
- The new generator is headless in authoring-core and reuses V2.5 as its base (`packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:92`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:95`).
- Routing is limited to authoring-core explicit method/source additions (`packages/authoring-core/src/mesh-generation.ts:28`, `packages/authoring-core/src/mesh-generation.ts:39`, `packages/authoring-core/src/mesh-generation.ts:135`).
- No `apps/editor/**` source was changed for Domain C. Search confirmed Editor code still defaults to `auto-outline-v2.5-soft-boundary` at `apps/editor/src/features/editor-session/editor-session-context.tsx:653` and `apps/editor/src/features/editor-session/model/editor-session-commands.ts:279`.

### Source Organization: pass

- `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts` has a clear single responsibility: V2.6 soft-apron generation. It contains config, ring construction, strip triangulation, and metrics for that generator only.
- `packages/authoring-core/src/index.ts` remains barrel-only; the Domain C change is a single re-export (`packages/authoring-core/src/index.ts:29`).
- The shared metrics addition is narrow and typed as `MeshGenerationSoftApronMetrics` (`packages/authoring-core/src/mesh-quality-metrics.ts:64`).
- `mesh-generation.ts` grew routing for a new explicit method, but it was already the routing owner for mesh generation methods; this is not a new catch-all responsibility (`packages/authoring-core/src/mesh-generation.ts:28`, `packages/authoring-core/src/mesh-generation.ts:135`).

### Operation Policy: pass

- The method is accepted by the operation payload schema (`packages/operation-core/src/payloads/model-edit.ts:150`, `packages/operation-core/src/payloads/model-edit.ts:158`).
- Preview mesh preconditions explicitly allow V2.6 generated drafts (`packages/operation-core/src/operations/generate-mesh.ts:211`, `packages/operation-core/src/operations/generate-mesh.ts:216`).
- Dry-run still operates on a cloned session, preserving the existing dry-run/commit boundary (`packages/operation-core/src/operations/generate-mesh.ts:33`, `packages/operation-core/src/operations/generate-mesh.ts:36`, `packages/authoring-core/src/authoring-session.ts:33`).
- Commit path still replaces mesh through authoring-core mutation and attaches provenance (`packages/operation-core/src/operations/generate-mesh.ts:141`, `packages/operation-core/src/operations/generate-mesh.ts:152`, `packages/authoring-core/src/mesh-mutations.ts:57`, `packages/authoring-core/src/mesh-mutations.ts:61`).
- V2.6 provenance is logged through transform history and soft-apron metrics (`packages/operation-core/src/operations/generate-mesh.ts:326`, `packages/operation-core/src/operations/generate-mesh.ts:416`, `packages/operation-core/src/operations/generate-mesh.ts:425`).

### Schema / ID: pass

- Method/source/provenance identifiers are machine-readable and stable: `auto-outline-v2.6-soft-apron`, `outline-v2-6-soft-apron-rgba`, `interim-delaunay-soft-apron-strip`.
- Stable vertex/triangle IDs use underscored machine IDs without spaces (`packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:330`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:337`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:445`).
- Implementation-side search did not find another authored generateMesh method enum that needed a parallel update; `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:365` references the operation payload schema instead of duplicating method values.

### Dependency Policy: pass

- No package manifest or lockfile diffs were present in the reviewed Domain C scope.
- New imports are internal workspace/package imports only.
- No Cubism SDK/Core/parser/runtime dependency, proprietary oracle, or new geometry dependency was introduced.
- Orch-Sylph verification evidence reports `node scripts/check-dependencies.mjs` passed.

### Design Compliance: pass

- V2.6 preserves V2.5 as the base/interior sampling source and records that in metrics (`packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:95`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:153`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:165`).
- Apron padding is ratio-based and bounded per preset (`packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:227`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:232`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:245`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:259`).
- Apron area is capped and self-intersecting outer rings are rejected/retried, reducing V3-style envelope risk (`packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:281`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:292`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:296`).
- The strip triangulation uses inner boundary and apron ring vertices only, not long links to arbitrary interior vertices (`packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:386`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:396`, `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:401`).
- Fallback chain is explicit as `v2.6 -> v2.5 -> v2 -> v1 -> bounds-grid` (`packages/authoring-core/src/mesh-generation.ts:164`, `packages/authoring-core/src/mesh-generation.ts:194`, `packages/authoring-core/src/mesh-generation.ts:225`, `packages/authoring-core/src/mesh-generation.ts:253`).

## Verification Evidence Considered

Review-Sylph did not rerun the package checks. I used Orch-Sylph's rerun evidence:

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`: sandbox first failed with Windows `spawn EPERM`; escalated rerun passed, 1 file / 24 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts`: sandbox first failed with Windows `spawn EPERM`; escalated rerun passed, 1 file / 19 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- packages/authoring-core packages/operation-core discussion/implementation/waves/wave66/wave66-domain-c-mesh-auto-outline-v2-6-soft-apron-sidecar-report.md`: exit 0, LF-to-CRLF warnings only.

## Residual Risks

- V2.6 uses the ordered V2.5 soft-boundary boundary as the apron inner boundary rather than re-extracting a separate raw alpha contour. This keeps the implementation small and preserves V2.5 behavior, but visual review should confirm it is not too conservative or too offset on real concave artwork.
- Local boundary gap refill is intentionally deferred and recorded in provenance (`packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts:184`). Future refill work should stay local and not become a V3-style envelope.
- The new generator is currently 694 lines but still single-responsibility. If future gap refill or contour-normal logic is added, split helper ownership should be reconsidered before the file becomes a broad geometry module.

## Needs User Input / Design Decision

None for this review lane.
