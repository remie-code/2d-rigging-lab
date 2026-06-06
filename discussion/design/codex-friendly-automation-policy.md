# Codex-Friendly Automation Policy

> Status: Accepted user decision / 2026-06-06.
> Purpose: Record the automation boundary for the Private 2D Rigging Lab / Prototype so future implementation waves do not accidentally move proposal, inference, or smart automation into the Editor/repo.

## 1. Decision Summary

This project is Codex-friendly by making human-equivalent operations available through deterministic repository surfaces. It is not Codex-friendly by embedding proposal generation, inference, or smart automatic rigging in the Editor.

Accepted decisions:

- The Editor and repository do not generate proposals.
- The Editor and repository do not infer semantic part meaning such as `eye`, `hair`, or `mouth`.
- The Editor and repository do not auto-classify PSD layers or auto-place rig/deformer structures.
- The Editor remains a simple human operation UI.
- External Codex/LLM agents own interpretation, planning, proposal composition, and repair reasoning.
- The repository owns deterministic state, operation APIs, dry-run, diff, validation, Product Preflight, approval-gated commit, transcript, evidence, stable refs, and machine-readable errors.
- The current integration surface is the existing `packages/ai-interface` / operation API / in-process command host. HTTP, WebSocket, MCP server, or other external transport work is out of scope and would be a separate project decision.

## 2. Automation Levels

| Level | Meaning | Policy |
|---|---|---|
| Level 0: Manual operation | A human directly uses Editor controls. | Supported. Editor UI should remain simple and explicit. |
| Level 1: Deterministic command operation | A human or Codex supplies exact targets and parameters to an existing operation or command. | Supported when deterministic, validated, and approval-aware. This is not a suggestion feature. |
| Level 2: External Codex/LLM proposal | Codex/LLM decides an operation sequence outside the repo, then submits it for validation, dry-run, diff, user approval, and commit. | Supported as repository intake/validation/approval surface. The repo does not generate the proposal. |
| Level 3: Repo/Editor autonomous proposal or execution | The repo or Editor infers intent, classifies art, proposes edits, or commits inferred edits automatically. | Not wanted. Do not implement without an explicit future policy reversal. |

Level 1 convenience must not become hidden suggestion logic. If a command fills defaults, those defaults must be deterministic, documented, and based on explicit user/Codex input rather than image interpretation or semantic guessing.

## 2.5 Structural Expansion Clarification

Structural expansion is not semantic recognition.

Allowed deterministic structural expansion:

- A user or external Codex/LLM explicitly selects or approves a PSD root, group, subtree, or leaf set.
- The Editor/repo maps the PSD tree structure to project-defined containers and editables without interpreting artistic meaning.
- PSD groups may become project part containers.
- PSD leaf layers may become project texture / drawable / mesh scaffold entries.
- Source names, parentage, source order, visibility, opacity, bounds, stable source refs, generated refs, and evidence may be preserved.
- Hidden PSD leaf layers may be imported as initially runtime-hidden drawables when explicitly included or covered by an explicit structural approval.

Still disallowed unless this policy is explicitly changed:

- Inferring that a PSD group or layer semantically means `eye`, `hair`, `mouth`, expression, clothing, or any other rigging role.
- Choosing deformer, parameter, keyform, warp lattice, physics, mask, or rig hierarchy behavior from names, pixels, or artistic intent.
- Presenting deterministic structural expansion as smart recognition, recommended rigging, or automatic rigging.

In short: explicit structural copying is allowed; hidden interpretation is not.

## 3. Editor UI Boundary

Allowed Editor UI:

- Simple explicit controls such as select, approve, unapprove, execute, rename, reparent, inspect, dry-run, approve commit, and show result.
- Deterministic status, validation, preflight, diff, operation log, and evidence displays.
- Human-readable error and blocked-state explanations backed by machine-readable issue IDs.

Disallowed Editor UI unless this policy is explicitly changed:

- `Suggest rig`, `Auto classify`, `Recommended deformers`, `Auto repair`, `Generate proposal`, or similar smart buttons.
- Automatic semantic part recognition from layer/group names or pixels.
- Automatic part hierarchy conversion from PSD group hierarchy.
- Automatic deformer, parameter, keyform, warp lattice, or physics creation.
- Automatic commit of inferred or generated edits.
- Embedded LLM/provider/prompt workflow.

If a future agent skill provides rigging advice, it should live outside the Editor/repo as an external Codex/LLM workflow that uses the deterministic command surface.

## 4. Repository API Boundary

The repository should make Codex effective by exposing the same kind of operations a human can perform:

- Read current project/editor state.
- Inspect targets and stable refs.
- List supported operations and command schemas.
- Validate submitted operation sequences or proposals.
- Dry-run without mutation.
- Return deterministic diffs and Product Preflight reports.
- Require explicit approval before commit.
- Commit approved operations.
- Record transcript/evidence.
- Return stable `part`, `drawable`, `texture`, `mesh`, source, candidate, approval, and operation refs where those concepts are in scope.
- Return machine-readable failures for missing refs, stale base revision, stale preview, blocked candidates, collisions, unsupported targets, and not-evaluated evidence.

The repository should not:

- Generate repair candidates.
- Rank proposal alternatives.
- Interpret natural language.
- Decide artistic intent.
- Infer semantic body/face part meaning.
- Hide uncertainty behind automatic behavior.

## 5. PSD Import Implications

For PSD intake work after Wave48:

- PSD import remains explicit and approval-gated.
- Root/group import-plan preview may enumerate eligible leaf candidates, but execution must operate on explicitly approved leaf refs.
- Generalizing from fixed sample leaves to arbitrary eligible leaves is acceptable when the user/Codex supplies explicit refs or approval state.
- Explicit root/group/subtree structural approval may deterministically expand approved PSD groups into project part containers and approved PSD leaf layers into project texture / drawable / mesh scaffold entries.
- This does not imply semantic all-layer one-click import, smart recursive group auto import, group-as-artmesh import, Photoshop-style group compositing, or rig/deformer inference.
- The import result should expose stable refs and evidence so Codex can perform later human-equivalent rigging operations through existing APIs.

## 6. Future Decision Triggers

Escalate for user decision before implementing any of the following:

- Editor/repo-side proposal generation.
- Smart classification or semantic recognition.
- Autonomous execution or automatic commit.
- External HTTP / WebSocket / MCP transport.
- Repo-side LLM/provider integration.
- Agent skill bundled into this repo as a product feature.
- Any UX that markets itself as automatic rigging, recommended rigging, auto repair, or semantic PSD understanding.

## 7. Relationship To Existing Evidence

Wave8-Wave10 established the in-process AI command foundation. Wave40 established Codex-submitted proposal intake, validation, dry-run diff, rerun validation, approval-gated commit, transcript, and Editor review workflow. Those surfaces are repository intake and safety mechanisms for external Codex work; they are not repo-side proposal generation.

Wave49 and later waves should cite this policy when they touch PSD import, Codex-facing APIs, Editor automation wording, proposal intake, operation catalogs, or approval flows.
