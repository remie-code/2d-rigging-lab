# Wave48 Domain B Review: Browser PSD Import Plan Candidate Service

> Role: Review-Sylph independent clean review
> Target: `wave48-browser-psd-import-plan-candidate-service`
> Verdict: `pass`

## Verdict

`pass`

Domain B is inside the approved Editor/browser candidate-planning boundary: it adds an Editor-side candidate plan service, result DTOs, a compact workflow-state projection helper, focused tests, and barrel exports only. It does not add direct parser imports, package/operation persistence, UI workflow execution, dependency changes, or validator/Product Preflight implementation.

Re-review after the bounded Gnome fix finds the prior B-F1 / B-T1 scope-validation issue resolved. I found no new blocking findings.

## Scope Reviewed

- Basis documents: implementation orchestration skill, subagent context hygiene skill, Wave48 plan, current capability map, remaining backlog, Domain A report/review, Wave47 final report/review, and the source organization, dependency, diagnostic, and schema/id policies.
- Domain B changed files:
  - `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-result.ts`
  - `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.ts`
  - `apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.test.ts`
  - `apps/editor/src/editor-state/explicit-psd-import-plan-state.ts`
  - `apps/editor/src/editor-workflow/index.ts`
  - `apps/editor/src/editor-state/index.ts`
- Parallel `packages/**` changes were observed in worktree status but not reviewed as Domain B implementation.

## Design / Development Compliance Review Findings

### B-F1: Medium - Group scope validation accepts leaf or malformed refs

`apps/editor/src/editor-workflow/browser-psd-import-plan-candidate-service.ts:173` only checks `scopeRef.startsWith("psd:root/group[")`, then returns `scopeKind: "group"` at `:177-182`. Because `layerIsInScope` later filters by `${scopeRef}/` at `:218-221`, inputs such as `psd:root/group[6]/layer[0]` or malformed group-like refs are accepted as group scopes and can return a `ready` plan with zero candidates.

Required fix: validate scope refs as exactly `psd:root` or a PSD group-ref path made only of `group[index]` segments, or resolve them against known tree-derived group refs. Leaf refs and malformed group-like refs should fail deterministically instead of being treated as empty group plans.

Re-review status: resolved. The service now uses exact `group[index]` segment/ref patterns (`browser-psd-import-plan-candidate-service.ts:76-77`), rejects non-root/non-group and malformed group-like refs (`:175-180`), rejects well-formed but unknown group refs against parser-session evidence-derived known group refs (`:183-184`), and derives ancestor group refs with the exact segment pattern (`:285-297`).

Other reviewed boundaries:

- Candidate generation preserves parser-session layer refs, full path, display name, bounds, visibility, opacity, source order, parent group context, and byte estimates in `browser-psd-import-plan-candidate-service.ts:223-239` and `:551-587`.
- Status handling covers `candidate`, `hidden`, `unsupported`, `emptyZeroSize`, `duplicateRef`, `duplicateName`, `generatedIdCollision`, `generatedNameCollision`, `byteCapBlocked`, and `notApproved` in `:294-469`.
- Conservative defaults match Domain A caps in `browser-psd-import-plan-candidate-result.ts:6-11`, and summary cap evidence is built in `browser-psd-import-plan-candidate-service.ts:589-638`.
- Approval remains explicit leaf-ref selection only; not-approved candidates are not executed by this service (`:409-469`, `:579-585`).
- Candidate plan digest is computed before mutable approval status is applied (`:101-111`) over canonical candidate-plan JSON (`:737-825`).
- Persistence boundary flags state no raw parser object, source PSD bytes, or materialized layer bytes are persisted by the plan (`browser-psd-import-plan-candidate-result.ts:160-166`; service `:136-142`).
- `index.ts` changes are barrel-only re-exports.

## Test Adequacy Review Findings

### B-T1: Medium - Missing regression for invalid scope refs

The focused test file covers root candidate generation, group recursive traversal, hidden/unsupported/empty/duplicate/collision/per-leaf byte-cap/default not-approved statuses, approval caps, digest stability, and workflow-state projection. It does not cover the invalid-scope boundary described in B-F1.

Required fix: add a focused test that proves leaf refs and malformed group-like scope refs are rejected or blocked according to the chosen service contract.

Re-review status: resolved. The added regression covers leaf refs, nested leaf-like group refs, malformed group-like refs, a root layer ref, and an unknown well-formed group ref (`browser-psd-import-plan-candidate-service.test.ts:123-140`).

## Re-review Addendum

Final verdict: `pass`.

- B-F1: resolved.
- B-T1: resolved.
- New findings: none.
- Boundary check: no direct PSD parser import, package/operation persistence, validator/Product Preflight implementation, dependency manifest, or lockfile change was found in the Domain B source scope.

## Verification Performed

- Read the Domain B changed source and tests directly.
- Read/searched the listed basis documents for Wave48 Domain B scope, Domain A status/cap semantics, parser/dependency boundaries, diagnostic policy, schema/id policy, and source-file organization rules.
- `git status --short -uall`: confirmed Domain B files plus parallel out-of-scope `packages/**` changes.
- `node scripts/check-psd-parser-import-boundary.mjs`: pass; 5 direct import/resolve sites remain limited to approved adapter and Wave44 scripts.
- `git diff --check -- apps/editor/src/editor-workflow apps/editor/src/editor-state discussion/implementation/reviews/wave48`: pass with LF-to-CRLF working-copy warnings only.
- `git diff --name-status -- apps/editor/src/editor-workflow apps/editor/src/editor-state package.json pnpm-lock.yaml`: tracked Domain B barrel edits only; no dependency manifest/lockfile diff.
- Considered Orch-Sylph supplied post-implementation checks: focused vitest pass, `test:unit` pass, `typecheck` pass, parser-boundary guard pass, source guard pass, dependency guard pass.
- Re-review source inspection: verified exact group scope patterns, parser-session evidence-derived known group ref check, exact ancestor group segment handling, and invalid-scope regression coverage.
- Re-review `node scripts/check-psd-parser-import-boundary.mjs`: pass; 5 direct import/resolve sites remain limited to approved adapter and Wave44 scripts.
- Re-review `git diff --check -- apps/editor/src discussion/implementation/waves/wave48 discussion/implementation/reviews/wave48`: pass with LF-to-CRLF working-copy warnings only.
- Re-review forbidden-scope search over Domain B files: no direct parser import, validator/Product Preflight implementation, persistence storage, materialization execution, or package operation bridge in Domain B files.

## Files Changed By This Review

- `discussion/implementation/reviews/wave48/wave48-domain-b-browser-psd-import-plan-candidate-service-review.md`

## Remaining Issues

None for Domain B.

## User-Decision Points

None. The fix is an implementation-boundary correction inside the existing Domain B contract.

## Provisional Assumptions

- `BrowserPsdImportPlanDiagnostic` is treated as local session candidate-plan notes, not as validator/Product Preflight diagnostics or MVP-blocking formal diagnostics.
- Domain C `packages/**` changes are parallel work and are not required for the Domain B candidate service review verdict.
