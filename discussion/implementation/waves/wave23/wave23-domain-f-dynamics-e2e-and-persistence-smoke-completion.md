# Wave 23 Domain F Completion: Dynamics E2E and Persistence Smoke

> Target: `wave23-dynamics-e2e-and-persistence-smoke`  
> Domain: F  
> Date: 2026-05-31  
> Orch-Sylph: current context  
> Gnome implementation: `019e7e74-e6e9-7e03-8882-98ffe53d049f` / `Gnome the 27th`  
> Review-Sylph: `019e7e7f-0ed1-7310-8bdd-339b1e299728` / `Sylph the 28th`  
> Status: `pass`

## Orchestration Compliance

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

This domain followed that separation:

- Source/test implementation was delegated to Gnome `019e7e74-e6e9-7e03-8882-98ffe53d049f`.
- Independent review was delegated to Review-Sylph `019e7e7f-0ed1-7310-8bdd-339b1e299728`.
- Orch-Sylph did not edit source implementation or e2e files.
- Orch-Sylph only wrote this completion report after implementation and review completed.
- Review-Sylph reviewed basis documents, actual changed files/diff, focused verification, and upstream Domain A-E reports, not only the Gnome summary.

## Upstream Gate

Domain A, Domain B, Domain C, Domain D, and Domain E completion/review artifacts under `discussion/implementation/waves/wave23/` and `discussion/implementation/reviews/wave23/` are all `pass`.

Domain F proceeded after Domain D supplied the editor dynamics panel / preview run UX and Domain E supplied deterministic fixture / contract evidence.

## Result

Domain F is `pass`.

The editor e2e smoke now covers the Minimum Open Dynamics v1 browser workflow:

- create a dynamics group through the existing editor UI;
- run and reset dynamics preview;
- assert computed output, runtime evidence, validation report evidence, and clean validator diagnostics;
- save to browser persistence;
- reload and load the saved project;
- assert authored dynamics group, computed output parameter, operation log, package files, and generated evidence persisted;
- rerun preview after load to confirm preview-relevant evidence can be recomputed;
- run the same workflow through the existing desktop and mobile viewport smoke loop.

The smoke remains test/e2e scoped. It does not add runtime, validator, operation, authoring, parser, file-picker, asset I/O, dependency, or broad editor shell implementation.

## Changed Files

Domain F e2e files changed by Gnome:

- `apps/editor/e2e/dynamics-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`

Review/report artifacts:

- `discussion/implementation/reviews/wave23/wave23-domain-f-dynamics-e2e-and-persistence-smoke-review.md`
- `discussion/implementation/waves/wave23/wave23-domain-f-dynamics-e2e-and-persistence-smoke-completion.md`

No production UI or aria changes were required. `apps/editor/e2e/test-ids.mjs` was updated only to expose the existing Domain D dynamics test IDs to the e2e harness.

## Verification

Gnome and Review-Sylph reported or independently reran these checks:

| Command / check | Result |
|---|---|
| `node --check apps/editor/e2e/dynamics-persistence-smoke.mjs` | pass |
| `pnpm.cmd test:e2e` | pass; desktop and mobile smoke passed |
| `pnpm.cmd typecheck` | pass |
| `git diff --check -- apps/editor discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23` | pass; CRLF working-copy warnings only |
| `rg -n '[ \t]+$' apps/editor/e2e/dynamics-persistence-smoke.mjs apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/test-ids.mjs` | pass; no matches |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/*/package.json` | pass; no dependency manifest or lockfile changes |
| `pnpm.cmd run check:deps` | pass |
| `pnpm.cmd run check:source` | pass |
| Forbidden-scope diff scan for Cubism / `.physics3` / file picker / parser / decode / real PNG/PSD asset dependency / external dependency terms in Domain F target diff | pass; no added matching diff output |

## Independent Review

Review report:

- `discussion/implementation/reviews/wave23/wave23-domain-f-dynamics-e2e-and-persistence-smoke-review.md`

Review verdict: `pass`.

Findings: none.

Review lanes passed:

- Design / Development Compliance Review
- Test Adequacy Review

## Residual Risks

- The e2e smoke intentionally checks browser workflow and persisted evidence, not exact numeric solver values. Exact deterministic dynamics output remains covered by Domain B runtime tests and Domain E fixture/contract evidence.
- The e2e runner captures dynamics screenshot evidence in the returned smoke evidence but still prints only the pre-existing screenshot summaries. This is not a Domain F blocker because assertions cover the dynamics workflow.
- Wave 23 still requires Domain G integration review over the combined A-F diff before the wave can close.

## Escalation

None.
