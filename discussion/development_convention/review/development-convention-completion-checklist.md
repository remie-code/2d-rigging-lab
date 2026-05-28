# Development Convention Completion Checklist

## Status

Accepted

## Policy Existence

- [x] `source-of-truth-policy.md`
- [x] `repository-structure-policy.md`
- [x] `module-boundary-policy.md`
- [x] `schema-and-id-conventions.md`
- [x] `runtime-and-dynamics-implementation-policy.md`
- [x] `operation-policy.md`
- [x] `testing-and-acceptance-policy.md`
- [x] `diagnostic-policy.md`
- [x] `gui-implementation-policy.md`
- [x] `ai-assistant-implementation-policy.md`
- [x] `demo-rights-ip-policy.md`
- [x] `dependency-policy.md`
- [x] `review-and-pr-policy.md`
- [x] `subagent-workflow-policy.md`
- [x] `e2e-test-policy.md`

## Common Template Gate

- [x] Every policy has `## Status`.
- [x] Every policy has `## Purpose`.
- [x] Every policy has `## Scope`.
- [x] Every policy has `## Source Documents`.
- [x] Every policy has `## Required Decisions`.
- [x] Every policy has `## Required Diagrams`.
- [x] Every policy has `## Required Tables`.
- [x] Every policy has `## Rules`.
- [x] Every policy has `## Forbidden`.
- [x] Every policy has `## Required Evidence`.
- [x] Every policy has `## Review Checklist`.
- [x] Every policy has `## Conflict Handling`.
- [x] Every policy has `## Change Process`.
- [x] Every policy has `## Completion Gate`.

## Diagram Coverage Gate

- [x] Source of Truth Policy has a source relationship diagram.
- [x] Source of Truth Policy has a conflict resolution flow.
- [x] Repository Structure Policy has a monorepo layout diagram.
- [x] Repository Structure Policy has generated artifact placement and agent visibility diagrams.
- [x] Module Boundary Policy has a dependency DAG.
- [x] Module Boundary Policy has forbidden dependency and mutation boundary diagrams.
- [x] Schema and ID Conventions has schema ownership and artifact reference diagrams.
- [x] Runtime Policy has runtime pipeline, RuntimeState sequence, and dynamics dataflow diagrams.
- [x] Operation Policy has mutation flow and AI dry-run flow diagrams.
- [x] Testing Policy has acceptance runner pipeline, evidence graph, review gate, and E2E journey diagrams.
- [x] Diagnostic Policy has diagnostic lifecycle and diagnostic use in acceptance diagrams.
- [x] GUI Policy has GUI mutation, GUI evidence, and demo-safe capture diagrams.
- [x] AI Policy has AI dry-run, approval boundary, and forbidden flow diagrams.
- [x] Demo Policy has demo-safe preflight, asset provenance, and proposal boundary diagrams.
- [x] Dependency Policy has dependency approval and forbidden dependency boundary diagrams.
- [x] Review Policy has PR review pipeline and clean context review diagrams.
- [x] Subagent Policy has handoff, conflict escalation, and clean context boundary diagrams.
- [x] E2E Policy has authoring-to-viewer, AI repair, demo-safe, and deterministic replay diagrams.

## Table Coverage Gate

- [x] Source document responsibility table exists.
- [x] Conflict severity table exists.
- [x] Non-oracle sources table exists.
- [x] Repository top-level directory responsibility table exists.
- [x] Package responsibility table exists.
- [x] Generated artifact table exists.
- [x] Module responsibility table exists.
- [x] Allowed dependency table exists.
- [x] Forbidden dependency table exists.
- [x] Mutation boundary table exists.
- [x] ID naming table exists.
- [x] Artifact ref table exists.
- [x] Deprecated schema table exists.
- [x] Runtime API table exists.
- [x] Parameter layer table exists.
- [x] Dynamics scope table exists.
- [x] Replay evidence table exists.
- [x] Operation type table exists.
- [x] Actor permission table exists.
- [x] Operation result artifact table exists.
- [x] Test profile matrix exists.
- [x] Evidence requirement table exists.
- [x] Review requirement table exists.
- [x] E2E test table exists.
- [x] Diagnostic registry table exists.
- [x] Candidate promotion table exists.
- [x] Profile severity matrix exists.
- [x] GUI panel responsibility table exists.
- [x] GUI evidence table exists.
- [x] Demo-safe visibility table exists.
- [x] GUI test ID table exists.
- [x] AI command permission table exists.
- [x] AI context access table exists.
- [x] AI repair candidate table exists.
- [x] AI escalation table exists.
- [x] Demo-safe field table exists.
- [x] Forbidden term table exists.
- [x] Rights metadata table exists.
- [x] Proposal boundary table exists.
- [x] Dependency registry table exists.
- [x] License policy table exists.
- [x] Binary dependency table exists.
- [x] PR required field table exists.
- [x] Review type table exists.
- [x] Merge gate table exists.
- [x] Review finding table exists.
- [x] Agent assignment table exists.
- [x] Handoff artifact table exists.
- [x] Conflict escalation table exists.
- [x] Concurrent edit rule table exists.
- [x] E2E journey table exists.
- [x] E2E evidence matrix exists.
- [x] E2E oracle table exists.
- [x] E2E review table exists.

## Guardrail Gate

- [x] Monorepo is fixed.
- [x] Baseline is Private 2D Rigging Lab / Prototype.
- [x] Minimum Open Dynamics v1 is in MVP.
- [x] Cubism formats are not implementation, test, or acceptance oracles.
- [x] Cubism SDK/Core is not an implementation, test, or acceptance oracle.
- [x] Cubism Viewer consistency is not an implementation, test, or acceptance oracle.
- [x] Cubism Physics compatibility is not an implementation, test, or acceptance oracle.
- [x] Existing Cubism models and official samples are not implementation, test, acceptance, fixture, or demo oracles.
- [x] Machine-readable IDs must contain no spaces.
- [x] Conflicts are recorded through Conflict Handling / Conflict Resolution Log instead of silent invention.

## Review Findings

- [x] Blocking findings: none.
- [x] Warnings are recorded in `development-convention-review.md`.
- [x] Suggestions are recorded in `development-convention-review.md`.

## Completion Decision

- [x] P0 policies contain the information required before implementation starts.
- [x] P1 policies contain the information required before corresponding module implementation starts.
- [x] Review artifacts exist.
- [x] The requested development convention document set is complete for `discussion/development_convention/`.
