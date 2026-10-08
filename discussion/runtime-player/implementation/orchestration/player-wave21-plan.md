# Runtime Player Wave 21 Plan: Runtime Dynamics Tune Profile

> Objective: let the user tune exported dynamics against real face-tracking motion in Runtime Player without changing the Runtime Export itself.

## 1. Status

- Status: Ready to launch.
- Planning gate result: inventory first, then plan.
- Inventory verdict: `ready_to_plan`.
- User decision:
  - Player may provide runtime tuning for dynamics because real head-motion acceleration differs from Editor slider preview.
  - Player must not become a dynamics structure editor.
  - Runtime Export is the authored model artifact and must not be rewritten by Player tuning.
  - Player tuning should be stored as a per-runtime-export profile, similar in lifecycle to Mapping Profile but separate in schema and storage.
- Source of truth before implementation:
  - this plan.
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)
  - Runtime Player implementation inventory from planning gate.

## 2. Product Goal

Runtime Player should allow the user to adjust how exported dynamics feel under real tracking input.

Editor dynamics preview is useful for authoring, but it uses controlled slider input. Real iFacialMocap motion has different velocity, acceleration, range, and rhythm. The user should be able to watch the actual Stage / Browser Source motion and tune dynamics response without returning to Editor for every small operational adjustment.

After this wave:

- Runtime Player exposes a `Dynamics Tune` page.
- Dynamics groups exported from Editor can be enabled/disabled and quick-tuned in Player.
- Slider changes affect live motion immediately.
- Tuning is persisted per Runtime Export.
- Runtime Export files remain unchanged.
- Native Stage and Browser Source use the same effective tuning.

## 3. Accepted Responsibility Boundary

### 3.1 Editor Responsibility

Editor remains responsible for authored dynamics structure:

- creating / deleting Dynamics Groups;
- choosing driver input parameters;
- choosing output parameters;
- choosing output kinds;
- defining pendulum count and structural bindings;
- setting keyforms / rig behavior that output parameters drive;
- exporting the base Runtime Export artifact.

### 3.2 Player Responsibility

Player may tune runtime behavior for an already-authored model:

- group enabled override;
- output strength;
- output limit;
- pendulum length;
- pendulum sway;
- pendulum reaction speed;
- pendulum convergence speed;
- reset to exported defaults;
- persist tuning as a Player profile for the current Runtime Export identity.

### 3.3 Explicit Non-Responsibilities

Player must not:

- add or remove Dynamics Groups;
- add or remove pendulums;
- change driver input parameter identity;
- change output parameter identity;
- change output kind;
- edit keyforms, meshes, variants, or rigs;
- write modified dynamics back into the Runtime Export;
- change package-format schema in this wave.

## 4. UX Semantics

### 4.1 Control Window Page

Add a dedicated `Dynamics Tune` page in the Control Window navigation.

Recommended order:

```text
Overview
Live Controller
Input
Mapping
Dynamics Tune
Stage
Performance Diagnostics
```

`Dynamics Tune` belongs next to `Mapping` because both are model/runtime-behavior tuning pages. It should not be part of `Stage`, which owns display/window/capture behavior.

### 4.2 Page Behavior

The page should show exported Dynamics Groups from the currently loaded Runtime Export.

For each group:

- group name;
- enabled state;
- compact input/output summary as read-only context;
- quick tune controls:
  - `Strength`;
  - `Limit`;
  - `Length`;
  - `Sway`;
  - `Reaction`;
  - `Convergence`;
- reset group to exported defaults.

If no Runtime Export is loaded:

- show an empty state explaining that dynamics tuning requires a Runtime Export.

If the Runtime Export has no dynamics groups:

- show an empty state explaining that this model has no exported dynamics to tune.

### 4.3 Live Preview

Slider changes should affect live Stage motion immediately.

Persistence should be debounced. The user should not need an explicit Save button for normal operation.

Expected behavior:

- on slider drag: apply draft tuning immediately to the runtime evaluator;
- after a short debounce: persist profile to disk;
- on reset: restore exported defaults for that group and persist the reset state;
- on Runtime Export switch: load the profile for that Runtime Export identity only.

### 4.4 Browser Source Parity

Browser Source must use the same effective tuning as Native Stage.

The tuning profile must be synchronized without mutating the Runtime Export artifact. Prefer a separate profile/status message or a distinct field in the Browser Source runtime payload, not an in-place rewrite of exported model artifacts.

## 5. Persistence Model

Add a Runtime Player-owned Dynamics Tuning Profile.

Recommended storage:

```text
<electron userData>/dynamics-tuning-profiles/<safePackageId>/<fingerprint>.json
```

This should be separate from Model Mapping Profile because mapping and dynamics tuning have different lifecycle, UI, migration, and validation concerns.

Recommended document shape:

```ts
{
  schemaVersion: "runtime-player-dynamics-tuning-profile-v1",
  createdAtIso: string,
  updatedAtIso: string,
  exportIdentity: {
    packageId: string,
    packageRevision: number,
    packageHash?: string,
    parameterSignatureHash?: string
  },
  dynamicsSignatureHash: string,
  groups: {
    [dynamicsGroupId: string]: {
      enabled?: boolean,
      strength?: number,
      limit?: number,
      length?: number,
      sway?: number,
      reactionSpeed?: number,
      convergenceSpeed?: number
    }
  }
}
```

Exact identity fields should follow existing Runtime Player profile conventions where possible.

`dynamicsSignatureHash` should be included to avoid applying stale group overrides to a changed dynamics structure that happens to share the same package identity.

## 6. Runtime Evaluation Design

Runtime Export schema should remain unchanged.

The effective dynamics graph should be produced by layering Player tuning over exported base dynamics before runtime-core compilation.

Recommended implementation boundary:

- load Runtime Export model normally;
- load matching Dynamics Tuning Profile for the export identity;
- generate effective `dynamicsGroups` by applying safe numeric overrides to the exported base groups;
- do not mutate `RuntimeExportModelDto` or loaded artifacts in place;
- pass effective groups into the Runtime Player graph adapter / compiled evaluator path;
- include tuning profile revision/fingerprint/signature in the Runtime Evaluation Cache key;
- invalidate/reset target-local runtime instances when effective dynamics tuning changes.

runtime-core changes should be avoided unless the current API cannot express this cleanly.

## 7. Wave Strategy

Run as two implementation domains plus final integration.

The profile / runtime graph work and Control UI / bridge work are related but can be split if ownership is clean. However, Browser Source parity cuts across both, so final integration must verify both Stage paths together.

### Dependency Summary

| Domain | Work | Parallel? | Reason |
|---|---|---|---|
| Domain A | Dynamics tuning profile persistence, effective graph composition, evaluation cache invalidation, Browser Source profile sync | Can start first | This establishes the model/runtime layer that UI consumes. |
| Domain B | Control Window `Dynamics Tune` page and bridge wiring | Can run after A contract is clear; limited parallel OK if bridge contract is fixed | UI depends on profile contract and available group DTOs. |
| Domain C | Final integration / docs / clean review | No, after A/B | Must verify Native Stage and Browser Source parity plus docs/maps. |

If the orchestrator judges A/B file ownership too intertwined, run them sequentially under one implementation domain rather than forcing parallelism.

## 8. Domain A: Runtime Dynamics Tuning Profile / Effective Runtime Graph

Suggested subagent name:

```text
runtime-player-wave21-dynamics-tuning-profile-runtime-layer
```

### Scope

Implement Player-owned runtime dynamics tuning profile storage and effective dynamics graph application.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/dynamics-tuning-profiles/**`
- `apps/runtime-player/src/main/**` profile load/save orchestration
- `apps/runtime-player/src/stage/runtime-evaluation/**`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache*`
- `apps/runtime-player/src/main/broadcast-source/**`
- `apps/runtime-player/src/stage/browser-source/**`
- related tests

### Required Behavior

- Load a dynamics tuning profile for the current Runtime Export identity.
- Persist tuning under Electron `userData`.
- Apply overrides only to matching exported dynamics groups.
- Ignore stale/missing group ids safely.
- Include dynamics structure identity/signature in profile validation.
- Generate effective dynamics groups without mutating Runtime Export artifacts.
- Invalidate compiled/evaluation cache when tuning changes.
- Preserve target-local runtime state ownership between Native Stage and Browser Source.
- Synchronize effective tuning to Browser Source so Browser Source output matches Native Stage.

### Tests

At minimum:

- profile store parse/load/save/default tests;
- stale signature / missing group id behavior;
- effective dynamics group composition does not mutate base Runtime Export model;
- evaluation cache invalidates when tuning revision changes;
- Browser Source receives/apply tuning metadata or effective profile, depending on chosen transport;
- no Runtime Export/package-format schema change.

Escalate if:

- effective tuning cannot be applied without mutating Runtime Export artifacts;
- Browser Source parity requires a broad protocol rewrite beyond this wave;
- runtime-core API makes safe pre-compile layering impossible.

## 9. Domain B: Control Window Dynamics Tune UX

Suggested subagent name:

```text
runtime-player-wave21-dynamics-tune-control-page
```

### Scope

Add `Dynamics Tune` to the Control Window and wire it to the runtime tuning profile.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/dynamics-tune-page.tsx`
- preload / bridge files for dynamics tune commands and state
- `apps/runtime-player/src/main/dynamics-tune-bridge-handlers.ts`
- related tests

### Required Behavior

- Add `Dynamics Tune` page after `Mapping` and before `Stage`.
- Show exported dynamics groups for the loaded Runtime Export.
- Show clear empty states for:
  - no Runtime Export loaded;
  - Runtime Export has no dynamics groups.
- Expose quick tune controls:
  - enabled;
  - strength;
  - limit;
  - length;
  - sway;
  - reaction;
  - convergence.
- Show input/output summary as read-only context.
- Slider changes apply immediately to live preview.
- Save is automatic/debounced.
- Provide reset-to-export-default behavior per group.
- Do not expose structural editing controls.

### Tests

At minimum:

- navigation contains `Dynamics Tune` in the accepted order;
- empty states render;
- group controls render from bridge state;
- changing sliders calls bridge update with expected payload;
- reset calls expected bridge command;
- no raw tracking data or private Runtime Export path is exposed to renderer state.

Escalate if:

- current Control shell cannot accept another page without a broader navigation redesign;
- live preview update requires UI to own runtime-core state directly.

## 10. Domain C: Final Integration / Docs Alignment / Clean Review

Suggested subagent name:

```text
runtime-player-wave21-final-integration-dynamics-tune
```

### Scope

Run after Domain A and Domain B.

### Required Behavior

- Confirm tuning affects Native Stage.
- Confirm tuning affects Browser Source.
- Confirm profile restores after app restart / Runtime Export reopen.
- Confirm switching to a different Runtime Export does not apply stale tuning.
- Confirm Runtime Export artifacts are not modified.
- Confirm package-format schema is unchanged.
- Confirm Editor files are unchanged.
- Confirm no `pnpm install` was run.
- Confirm related docs/maps are updated.

Docs/maps to update as implementation facts require:

- Runtime Player implementation maps.
- Runtime Player screen docs, especially Control Window page structure.
- Runtime Player architecture/backlog docs if they mention dynamics as Editor-only or unverified in Player.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

### Manual Check Notes

The final report should ask the user to check:

- open a Runtime Export with visible dynamics;
- connect iFacialMocap;
- open `Dynamics Tune`;
- adjust `Strength`, `Reaction`, `Convergence`, and `Sway` while moving naturally;
- confirm the live motion changes immediately;
- restart Runtime Player and confirm tuning restores;
- open OBS Browser Source and confirm Browser Source uses the same tuning;
- reset a group to exported defaults and confirm behavior returns.

## 11. Acceptance Criteria

- `Dynamics Tune` page exists in Control Window after `Mapping` and before `Stage`.
- Runtime Export dynamics groups are listed when available.
- Runtime Export without dynamics shows a useful empty state.
- Player allows runtime tuning for:
  - enabled;
  - strength;
  - limit;
  - length;
  - sway;
  - reaction;
  - convergence.
- Slider/control changes apply to live Native Stage immediately.
- Browser Source receives the same effective tuning.
- Tuning persists per Runtime Export identity.
- Opening a different Runtime Export does not apply stale tuning.
- Reset to exported defaults works.
- Runtime Export files are not modified.
- package-format schema is not changed.
- Editor source is not changed.
- No new dependency is added.
- No `pnpm install` is run by agents.
- Focused tests and typecheck/build pass, or failures are classified with concrete evidence.

## 12. Out of Scope

- Dynamics Group creation/deletion in Player.
- input/output parameter reassignment in Player.
- output invert editing.
- pendulum count editing.
- Editor Dynamics Tool changes.
- Runtime Export schema changes.
- package-format schema changes.
- Runtime Export writing from Player.
- OBS integration changes.
- performance optimization work unrelated to tuning.
- new dependencies.
- `pnpm install`.

## 13. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep Wave21 centered on Runtime Player runtime dynamics tuning.
- Preserve Runtime Export immutability.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Live Controller Variant switching.
- Preserve Wave17 render-frame fast path.
- Preserve Wave18 lightweight diagnostics posture.
- Preserve Wave19 Browser Source cadence diagnostics.
- Preserve Wave20 Control close / Stage reopen lifecycle.
- Do not change Editor source.
- Do not change Runtime Export or package-format schema.
- Do not add dependencies or edit lockfile.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched outside the domain's expected scope, report it before broadening.

## 14. Review Policy

Each implementation domain needs review lanes:

- spec compliance;
- design/development compliance;
- test adequacy.

Review lanes must be separate Review-Sylph subagents. Do not collapse review lanes into one reviewer.

Reviewers must specifically check:

- Player tuning is runtime-only and does not edit Runtime Export artifacts.
- effective dynamics are applied before runtime-core compile/evaluation in a cache-safe way.
- Native Stage and Browser Source use the same tuning.
- tuning profile is per Runtime Export identity and does not leak across models.
- UI does not expose structural dynamics editing.
- Control renderer does not receive raw tracking data or private file paths.
- existing Mapping, Stage Motion, Variant switching, Browser Source, Performance Diagnostics, and Window lifecycle behavior are not regressed.
- no Runtime Export / Editor / package-format schema changes are introduced.

## 15. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave21 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.
- Must launch separate Review-Sylph subagents for spec compliance, design/development compliance, and test adequacy.

Required assignment sentence:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

No parent may pass the wave gate while a child is incomplete, running, or unresolved.
