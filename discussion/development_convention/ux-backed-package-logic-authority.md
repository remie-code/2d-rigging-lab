# UX-Backed Package Logic Authority

## Status

Accepted.

## Purpose

This policy gives implementation agents explicit authority to modify package-level logic when an accepted UX, screen design, acceptance criterion, or scenario cannot be implemented correctly from the GUI layer alone.

It exists to prevent UI-only workarounds when the real blocker is a stale package contract, conservative cap, validator rule, schema assumption, or operation behavior. The Editor UX is a product source of truth. If package logic contradicts an accepted UX, agents should fix the vertical behavior coherently instead of hiding the mismatch in `apps/editor`.

## Scope

Applies to authored source and tests under:

- `packages/**`
- `apps/**`
- `tests/**`
- implementation-owned scripts under `scripts/**` when they validate the affected behavior

This policy is especially relevant to:

- `packages/operation-core`
- `packages/validator-core`
- `packages/package-format`
- `packages/contracts`
- `packages/ai-interface`
- focused test fixtures and evidence contract tests

## Decision

### DEC-UX-PKG-001: Accepted UX may require package logic changes

When an accepted UX or screen design is blocked by a package-level constraint, a Gnome may modify the relevant package logic, schemas, validators, commands, fixtures, and tests.

Examples include:

- a hard-coded cap that prevents a normal user workflow;
- an operation preflight rule that rejects a valid UX path;
- a schema or evidence contract that encodes an obsolete bounded prototype assumption;
- a validator diagnostic that treats an accepted model state as invalid;
- a command/API projection that cannot represent the accepted user workflow.

### DEC-UX-PKG-002: Prefer vertical fixes over GUI workarounds

If a package-level constraint is wrong for the accepted UX, do not patch around it only in the GUI.

The preferred fix is a coherent vertical change:

- update the package contract or operation behavior;
- update validator / package-format / AI interface projections if they depend on that contract;
- update focused tests and fixtures;
- update the GUI only after the model/API behavior is correct.

### DEC-UX-PKG-003: No invented product semantics

This authority does not allow Gnomes to invent new product semantics.

If the required package behavior depends on an unclear product decision, UX meaning, API meaning, persistence boundary, migration strategy, public compatibility rule, or evidence interpretation, the Gnome must escalate to Orch-Sylph / Undine instead of deciding it alone.

### DEC-UX-PKG-004: Package changes must remain Codex-friendly and deterministic

Package logic changes must preserve deterministic operation behavior, structured evidence, stable command surfaces, validator traceability, and the separation between human UI, Codex-facing APIs, test-facing surfaces, and evidence/debug surfaces.

## Allowed

Implementation agents may:

- modify `packages/*` logic needed to realize accepted UX/AC;
- modify package schemas and DTOs when the old shape blocks accepted behavior;
- update validator rules and diagnostics to match the accepted model behavior;
- update package-format evidence schemas and tests when operation evidence policy changes coherently;
- update AI/interface projections when Codex-facing structured access must reflect the accepted behavior;
- add or update focused tests that prove the vertical behavior;
- add dependencies when allowed by `dependency-policy.md` and justified by the task.

## Forbidden

Implementation agents must not:

- use this policy to bypass user decisions;
- introduce semantic recognition, auto-proposal, auto-rigging, or LLM-driven behavior unless a plan explicitly adds that scope;
- weaken privacy, persistence, rights, or demo boundaries without an accepted policy change;
- make broad package rewrites unrelated to the accepted UX blocker;
- hide package mismatches behind GUI-only state, DOM text, or test-only behavior;
- silently break existing public package contracts without documenting migration / compatibility risk.

## Escalation Required

Escalate to Orch-Sylph / Undine when:

- the package change would define a new durable product concept;
- package-format compatibility or migration is unclear;
- validator behavior can reasonably be interpreted in multiple ways;
- the UX source of truth is missing or contradictory;
- the change crosses legal / dependency / public demo / rights boundaries;
- a dependency addition is needed but its license, runtime footprint, or boundary is unclear;
- the safest implementation would require deleting or replacing large existing package subsystems.

## Required Evidence

Domain completion reports should include:

- the accepted UX / AC / screen-design source that justified the package change;
- the package constraint that blocked that UX;
- the vertical files changed, grouped by responsibility;
- tests or checks run;
- any compatibility, migration, or persistence risk;
- any user decision that was required or explicitly not required.

Review-Sylph should treat the following as blocking:

- GUI workaround where package behavior remains wrong for the accepted UX;
- package behavior invented without UX/AC/design basis;
- package contract change without focused tests or fixture updates;
- evidence / validator / AI-interface projections left inconsistent with the package behavior;
- broad package changes without a clear UX-backed reason.

## Relationship To Other Policies

- Source organization still follows [source-file-organization-policy.md](source-file-organization-policy.md).
- Dependencies still follow [dependency-policy.md](dependency-policy.md).
- Operation behavior still follows [operation-policy.md](operation-policy.md).
- Schema and ID changes still follow [schema-and-id-conventions.md](schema-and-id-conventions.md).
- GUI work still follows [gui-implementation-policy.md](gui-implementation-policy.md).
- This policy expands implementation authority; it does not relax review quality, source organization, deterministic operation, privacy, or evidence requirements.

