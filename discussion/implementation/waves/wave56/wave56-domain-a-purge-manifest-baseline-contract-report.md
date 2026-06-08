# Wave56 Domain A Report: Purge Manifest / Headless Baseline Contract

> Target: `wave56-purge-manifest-baseline-contract`  
> Verdict: `pass`

## 1. Basis and Investigation Boundary

Basis documents used:

- `discussion/implementation/orchestration/wave56-plan.md`
- `discussion/design/screen-design/editor-rebuild-purge-policy.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`

Allowed investigation performed:

- File-list checks for `apps/editor/**`, `apps/editor/e2e/**`, focused e2e scripts, production `data-testid` guard scripts, Wave51-Wave55 implementation docs, package scripts, workspace config, tsconfig, and check scripts.
- Mechanical `rg` reference checks against package/workspace/config/script/doc paths to identify old `apps/editor`, old e2e, focused e2e, and production `data-testid` standard-path pressure.

Forbidden investigation not performed:

- No old `apps/editor/src/**` source file was opened to evaluate UX, state, component design, or reuse potential.
- No old GUI behavior was assessed as a candidate source of truth.
- No old GUI source facts are recorded in this report beyond path/category existence.

Mechanical observations:

- `apps/editor/**` currently exists and contains 330 files by file-list count.
- `apps/editor/e2e/**` currently exists and contains 37 files by file-list count.
- Root `package.json` currently routes `typecheck` through `@private-2d-rigging-lab/editor`, defines `test:e2e` / `test:e2e:editor`, and includes `check:testids` in standard `check`.
- `scripts/` currently contains old editor e2e/focused e2e/testid pressure scripts, including `editor-e2e-smoke.mjs`, `run-focused-e2e.mjs`, `focused-e2e-registry.mjs`, `check-focused-e2e-registry.mjs`, `wave42-focused-e2e-boundary.mjs`, `check-wave42-quality-gate-boundary.mjs`, `check-production-testid-boundary.mjs`, and `check-production-testid-boundary-fixtures.mjs`.
- Retained non-GUI package directories are `packages/ai-interface`, `packages/authoring-core`, `packages/contracts`, `packages/operation-core`, `packages/package-format`, `packages/runtime-core`, and `packages/validator-core`.

## 2. Purge Manifest

Domain B must physically delete these categories and path patterns.

### 2.1 Old Editor GUI App

Delete the old GUI app as a whole:

- `apps/editor/**`

This includes, as old-app deletion scope:

- `apps/editor/package.json`
- `apps/editor/index.html`
- `apps/editor/tsconfig.json`
- `apps/editor/vite.config.ts`
- `apps/editor/src/**`
- `apps/editor/e2e/**`

After Domain B, `apps/editor` may be absent. Domain D may later recreate `apps/editor/**` as a fresh app scaffold, but only after B and C pass. Recreated files must be treated as new source, not migrated old source.

### 2.2 Old Editor E2E and Focused E2E Scripts

Delete old e2e/focused e2e standard-pressure scripts:

- `scripts/editor-e2e-smoke.mjs`
- `scripts/run-focused-e2e.mjs`
- `scripts/focused-e2e-registry.mjs`
- `scripts/check-focused-e2e-registry.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs`
- `scripts/check-wave42-quality-gate-boundary.mjs`

Delete old Wave42 GUI quality-gate helper scripts when they have no non-GUI package-level standard use after C removes standard references:

- `scripts/wave42-quality-gate-report-shape.mjs`
- `scripts/wave42-non-goal-classification-policy.mjs`
- `scripts/wave42-guard-categories.mjs`

Domain B owns physical deletion. Domain C owns removing package/script references so B and C can run in parallel without editing the same files.

### 2.3 Production `data-testid` Guard Pressure

Delete the old production `data-testid` guard and fixtures:

- `scripts/check-production-testid-boundary.mjs`
- `scripts/check-production-testid-boundary-fixtures.mjs`
- `scripts/production-testid-boundary-fixtures/**`

Rationale: Wave56 headless baseline must not preserve old GUI structure pressure through standard `check` or retained guard fixtures. Future fresh GUI testing must be designed from the new UX target and must not reuse this guard as the standard oracle.

### 2.4 Old GUI-Derived Discussion Artifacts

Delete old GUI improvement path artifacts:

- `discussion/implementation/orchestration/wave51-plan.md`
- `discussion/implementation/orchestration/wave52-plan.md`
- `discussion/implementation/orchestration/wave53-plan.md`
- `discussion/implementation/orchestration/wave54-plan.md`
- `discussion/implementation/orchestration/wave55-plan.md`
- `discussion/implementation/waves/wave51/**`
- `discussion/implementation/waves/wave52/**`
- `discussion/implementation/waves/wave53/**`
- `discussion/implementation/waves/wave54/**`
- `discussion/implementation/waves/wave55/**`
- `discussion/implementation/reviews/wave51/**`
- `discussion/implementation/reviews/wave52/**`
- `discussion/implementation/reviews/wave53/**`
- `discussion/implementation/reviews/wave54/**`
- `discussion/implementation/reviews/wave55/**`

Delete old/current GUI inventory artifacts under screen-design inventories:

- `discussion/design/screen-design/inventories/**`

Do not replace these with `superseded` quarantine. Wave56 policy requires physical deletion so later agents do not treat old GUI details as normal implementation basis.

## 3. Retention Manifest

The following categories and path patterns must not be deleted by B/C.

Product and acceptance basis:

- `discussion/concept/**`
- `discussion/acceptance-criteria/**`
- `discussion/scenarios/**`
- `discussion/design/codex-friendly-automation-policy.md`

Target UX design basis:

- `discussion/design/screen-design/editor-rebuild-purge-policy.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/**`
- `discussion/design/screen-design/components/**`
- `discussion/design/screen-design/_map.md` until Domain G updates normal links

Headless package/source basis:

- `packages/**`
- `test_data/**`
- `fixtures/**`, except e2e/testid fixtures explicitly listed in the purge manifest
- `vitest.config.ts`
- root `tsconfig.json`, except Domain C may edit it if needed for headless typecheck
- `scripts/check-dependencies.mjs`
- `scripts/check-source-organization.mjs`
- `scripts/check-source-organization-fixtures.mjs`
- `scripts/source-organization-fixtures/**`
- `scripts/wave44-psd-parser-smoke.mjs`
- `scripts/wave44-psd-layer-materialization.mjs`
- `scripts/wave44-psd-fixture-evidence-regression.mjs`
- `scripts/check-psd-parser-import-boundary.mjs`, unless C/F later prove it is old-editor-only and outside the headless baseline; it must not be in standard `check` unless it is made GUI-independent.

Orchestration and Wave56 records:

- `discussion/implementation/orchestration/wave56-plan.md`
- `discussion/implementation/waves/wave56/**`
- `discussion/implementation/reviews/wave56/**`
- `.github/skills/**`
- `.github/agents/**`

Workspace scaffolding:

- `pnpm-workspace.yaml` may retain the neutral `apps/*` workspace pattern for future Domain D fresh app recreation. The pattern is not itself an old GUI reference.

## 4. Headless Baseline Contract

Domain C must establish a standard path that is GUI-independent until fresh GUI work is introduced by D/E.

Required standard commands:

- `pnpm run typecheck`
- `pnpm run test:unit`
- `pnpm run check`

Minimum expected semantics:

- `typecheck` must run root/package TypeScript checks without `pnpm --filter @private-2d-rigging-lab/editor typecheck` while old `apps/editor` is absent.
- `test:unit` must run GUI-independent unit tests. It must not require browser e2e, old focused e2e, or old editor package tests.
- `check` must include headless health checks only, expected as `typecheck`, unit tests, `check:deps`, and `check:source` or their equivalent headless successors.

Must be removed from standard path:

- root `test:e2e`
- root `test:e2e:editor`
- root `check:testids`
- root `check:testids:fixtures`
- any standard `check` dependency on old `apps/editor`, old `apps/editor/e2e`, focused e2e registry, Wave42 GUI/e2e quality gate, or production `data-testid` guard
- editor package `test:e2e`, because the old editor package is deleted with `apps/editor/**`

Allowed non-standard future verification:

- Domain F may add a new narrow contamination guard if it is headless, path/string based, and checks absence of old GUI/e2e references. It must not restore old e2e or production `data-testid` guard semantics.
- Domain D/E may add fresh app build/typecheck/smoke checks after new app creation. These checks must not depend on old e2e, old focused registry, or old GUI text/testid oracles.

## 5. B-H Ownership Matrix

| Domain | Dependency | Write ownership | Must not write |
|---|---|---|---|
| B. Legacy app/e2e/GUI-doc physical purge | A | Delete `apps/editor/**`; delete A-approved old e2e/focused/testid scripts; delete A-approved old GUI docs; write B report/review paths | `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `packages/**`, retained target UX docs |
| C. Headless scripts/typecheck baseline | A | Edit `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, package-level check/test config if needed; write C report/review paths | Delete `apps/editor/**`; delete old GUI docs; edit packages logic to weaken package tests |
| D. Fresh editor app scaffold | B + C | Create fresh `apps/editor/**`; minimal root/workspace/package config required for fresh app; write D report/review paths | Reuse/copy old app source; old e2e; PSD import real workflow |
| E. Fresh Authoring Workspace placeholder | D | Fresh `apps/editor/**`; focused non-legacy smoke/unit only if approved by A/D; write E report/review paths | Old visible UI text, old debug/evidence-heavy panels, old e2e/testid oracle |
| F. Verification/contamination guard | B + C + E | Narrow verification scripts if needed; F report/review paths | Reintroduce old e2e, focused e2e registry, production `data-testid` guard, or old GUI text oracle |
| G. Docs/map cleanup | F | `discussion/_map.md`, `discussion/design/screen-design/**`, `discussion/implementation/_map.md`, `discussion/implementation/orchestration/_map.md`, `discussion/implementation/current-capability-map.md`, `discussion/implementation/remaining-work-backlog.md`, G report/review paths | Restore normal links to deleted old GUI docs; change concept/AC/scenario policy |
| H. Integration review/final report | G | Wave56 final report/review paths and narrow final map/backlog bookkeeping if needed | Source edits unless delegated to Gnome and re-reviewed |

Mandatory orchestration rule for every implementation domain:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

Mandatory wait rule for every delegated agent:

- Do not stop, cancel, close, or mark a child agent failed merely because it is waiting or a wait call times out.
- A `wait` timeout is only a polling timeout. It is not a failure verdict and must not be used as a reason to pass, fail, or abandon a domain.
- If a domain delegates implementation or review, the Orch-Sylph must wait until each required agent reaches a final state before declaring the domain complete.

Domain A required no source implementation. This report is a discussion artifact and the independent review must be produced by a separate Review-Sylph context.

## 6. B/C Parallel Recommendation

Recommendation: B and C can safely run in parallel after this Domain A report/review pass.

Required parallel split:

- B owns physical deletion only: `apps/editor/**`, old e2e/focused/testid scripts, old GUI docs, and B report/review paths.
- C owns standard path repair only: root/package/workspace/tsconfig/check config and C report/review paths.
- B must not edit root package/workspace/tsconfig files.
- C must not delete files in B-owned purge paths while running in parallel.
- If C discovers a script file must be edited rather than just dereferenced, C should report it and either defer that script edit until B completes or escalate for sequencing.

This split means B can remove obsolete files while C removes references to them. The expected temporary state during parallel work is acceptable as long as neither domain claims pass until its own verification is complete.

## 7. Verification Oracle for Later Domains

Later domains should use these oracle checks, adjusted only for fresh app recreation after D.

After B:

- `Test-Path apps/editor` is false.
- `rg --files apps/editor` returns no files.
- `rg --files apps/editor/e2e` returns no files.
- `rg --files scripts | Select-String -Pattern 'editor-e2e|focused-e2e|production-testid|wave42-focused-e2e|check-wave42-quality-gate'` returns no old script files.
- `rg --files discussion/implementation/orchestration discussion/implementation/waves discussion/implementation/reviews discussion/design/screen-design/inventories | Select-String -Pattern 'wave5[1-5]|gui-strip|ui-reset|current-ui|feature-inventory|codex-test-evidence'` returns no deleted old GUI artifact paths, except Wave56 reports/reviews if the command scope includes them.

After C:

- `pnpm run typecheck` passes without filtering `@private-2d-rigging-lab/editor`.
- `pnpm run test:unit` passes without old editor browser/e2e requirements.
- `pnpm run check` passes without `check:testids`, old e2e, focused e2e registry, or production `data-testid` guard.
- `rg -n "test:e2e|test:e2e:editor|check:testids|editor-e2e|focused-e2e|production-testid|data-testid boundary|@private-2d-rigging-lab/editor typecheck|pnpm --filter @private-2d-rigging-lab/editor test:e2e" package.json pnpm-workspace.yaml tsconfig*.json scripts .github` has no standard-path hits.

After D/E:

- Fresh `apps/editor/**` may exist, but `apps/editor/e2e/**` must not exist.
- New app build/typecheck/smoke may exist only as fresh-D/E artifacts.
- No recreated file may cite old `Task Summary`, raw refs, operation IDs, diagnostics IDs, evidence paths, command payloads, visible test ids, Codex/debug-heavy normal panels, old focused e2e IDs, or old Wave51-Wave55 implementation docs as UI or test oracle.
- Placeholder visible structure must include App Bar, Toolbox, Parts/Structure Tree placeholder, Canvas/Preview placeholder, Inspector placeholder, Parameter Bar placeholder, and Task/View entry points.

After F/G/H:

- `pnpm run typecheck`, `pnpm run test:unit`, and `pnpm run check` pass.
- Standard `check` has no old GUI/e2e/focused/testid guard dependency.
- Normal maps/backlog do not route future agents to deleted Wave51-Wave55 old GUI implementation artifacts or screen-design inventories as implementation basis.
- Review artifacts exist for each domain under `discussion/implementation/reviews/wave56/`.
- Final Wave56 report records any remaining historical references outside the normal implementation path as non-basis archive risk or removes them through G if within scope.

## 8. Expected Persistent Paths

Domain reports:

- A: `discussion/implementation/waves/wave56/wave56-domain-a-purge-manifest-baseline-contract-report.md`
- B: `discussion/implementation/waves/wave56/wave56-domain-b-legacy-app-e2e-gui-doc-physical-purge-report.md`
- C: `discussion/implementation/waves/wave56/wave56-domain-c-headless-scripts-typecheck-baseline-report.md`
- D: `discussion/implementation/waves/wave56/wave56-domain-d-fresh-editor-app-scaffold-report.md`
- E: `discussion/implementation/waves/wave56/wave56-domain-e-fresh-authoring-workspace-placeholder-report.md`
- F: `discussion/implementation/waves/wave56/wave56-domain-f-verification-contamination-guard-report.md`
- G: `discussion/implementation/waves/wave56/wave56-domain-g-docs-map-cleanup-report.md`
- H: `discussion/implementation/waves/wave56/wave56-domain-h-integration-review-and-final-report.md`

Review reports:

- A: `discussion/implementation/reviews/wave56/wave56-domain-a-purge-manifest-baseline-contract-review.md`
- B: `discussion/implementation/reviews/wave56/wave56-domain-b-legacy-app-e2e-gui-doc-physical-purge-review.md`
- C: `discussion/implementation/reviews/wave56/wave56-domain-c-headless-scripts-typecheck-baseline-review.md`
- D: `discussion/implementation/reviews/wave56/wave56-domain-d-fresh-editor-app-scaffold-review.md`
- E: `discussion/implementation/reviews/wave56/wave56-domain-e-fresh-authoring-workspace-placeholder-review.md`
- F: `discussion/implementation/reviews/wave56/wave56-domain-f-verification-contamination-guard-review.md`
- G: `discussion/implementation/reviews/wave56/wave56-domain-g-docs-map-cleanup-review.md`
- H: `discussion/implementation/reviews/wave56/wave56-domain-h-integration-review-and-final-review.md`

## 9. User-Decision Points

No user decision is required before starting B/C under this contract.

Escalate to Undine if any later domain finds that:

- deleting old `apps/editor/**` requires deleting `packages/**`;
- headless `typecheck` and GUI-independent unit tests cannot pass without old editor source;
- old e2e/focused e2e or production `data-testid` guard is required for standard `check`;
- target UX docs, concept, AC, or scenarios must be deleted to complete purge;
- fresh placeholder requires UI library, renderer, transport, Cubism, semantic recognition, proposal generation, auto-rigging, or auto-fix decisions before a simple placeholder can be built;
- deletion target must expand outside this manifest.

## 10. Risks and Gaps

- Existing maps/backlog still contain old Wave51-Wave55 references until Domain G updates them. This is acceptable after A/B/C only if they are not used as active implementation basis.
- The `apps/*` workspace pattern is retained for future fresh app work; reviewers must distinguish that neutral scaffold affordance from old `apps/editor` source retention.
- Some older historical implementation docs before Wave51 also mention editor/e2e paths. This contract does not authorize B/C to broadly delete all historical pre-Wave51 records. G/H should ensure normal current maps do not route future work to them as Editor rebuild basis, and should escalate if physical deletion beyond the manifest becomes necessary for contamination control.
- Physical deletion is intentionally irreversible in the working tree. Destructive commands in B must verify resolved paths are inside the workspace and match this manifest before deletion.
