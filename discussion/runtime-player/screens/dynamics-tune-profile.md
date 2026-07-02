# Dynamics Tune Profile Page

> Runtime Player Wave21 implementation facts for Player-owned dynamics tuning.

## 1. Status

- Status: Implemented in Runtime Player Wave21 source/tests; final real-device Electron / OBS manual checks remain.
- Implementation basis: [../implementation/orchestration/player-wave21-plan.md](../implementation/orchestration/player-wave21-plan.md)
- Domain reports:
  - [../implementation/waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md](../implementation/waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md)
  - [../implementation/waves/wave21/domain-b-dynamics-tune-control-page-report.md](../implementation/waves/wave21/domain-b-dynamics-tune-control-page-report.md)

## 2. Page Placement

`Dynamics Tune` is a Control Window page placed after `Mapping` and before `Stage`.

Current Control Window navigation:

```text
----------------------+
| Overview             |
| Live Controller      |
| Input                |
| Mapping              |
| Dynamics Tune        |
| Stage                |
| Performance Diag.    |
+----------------------+
```

`Mapping` maps external tracking input to authored runtime parameters. `Dynamics Tune` adjusts runtime behavior for already-authored Dynamics Groups. `Stage` remains display/window/broadcast setup and should not absorb dynamics tuning controls.

## 3. Responsibilities

`Dynamics Tune` may control:

- group enabled override;
- output strength;
- output limit;
- pendulum length;
- pendulum sway;
- pendulum reaction speed;
- pendulum convergence speed;
- reset a group to exported defaults;
- retry profile save only after a save failure.

`Dynamics Tune` must not control:

- creating or deleting Dynamics Groups;
- adding or removing pendulums;
- changing input/output parameter identity;
- changing output kind;
- editing keyforms, meshes, variants, or rigs;
- writing modified dynamics into the Runtime Export artifact;
- Runtime Export or package-format schema changes.

## 4. UI Behavior

The page lists exported Dynamics Groups when a Runtime Export with dynamics is loaded.

For each group, Control shows:

- display name;
- enabled state;
- compact input/output summary;
- read-only input and output context;
- sliders for `Strength`, `Limit`, `Length`, `Sway`, `Reaction`, and `Convergence`;
- per-group reset, disabled when there is no override.

Empty states:

- no Runtime Export loaded: dynamics tuning requires a Runtime Export;
- Runtime Export has no dynamics groups: this model has no exported dynamics to tune.

Normal operation has no manual Save button. Control changes call the dynamics tuning bridge immediately and persistence is debounced by the main-process profile save controller. Save failure exposes `Retry`.

## 5. Persistence

Runtime Dynamics Tune Profile is separate from Input Profile, Model Mapping Profile, Window State, and Startup State.

Storage:

```text
<electron userData>/
  dynamics-tuning-profiles/
    <safe-package-id>/
      <fingerprint>.json
```

Identity:

- `packageHash` is preferred when available;
- otherwise `packageId + packageRevision + parameterSignatureHash` contributes to the fingerprint;
- `dynamicsSignatureHash` guards against applying stale overrides to a changed dynamics structure.

Runtime Export artifacts are not modified by this profile.

## 6. Runtime Path

The runtime layer composes effective dynamics groups by layering the saved Player tuning profile over the exported base dynamics. It does this before runtime graph compile/evaluation and without mutating the loaded Runtime Export DTO or any artifact files.

Native Stage and Browser Source use the same effective tuning profile path:

- Native Stage receives effective profile changes through the Stage preload bridge.
- Browser Source receives the same effective tuning through Browser Source runtime payload/resync and `dynamics-tuning-changed` messages.
- Runtime Evaluation Cache keys include tuning fingerprint/revision/signature inputs so compiled/evaluation state is invalidated when effective tuning changes.

Browser Source still does not receive raw tracking frames, raw iFacialMocap diagnostics, calibration internals, private file paths, or Control-only debug state for this feature.

## 7. Manual Checks

Manual product checks still needed:

- open a Runtime Export with visible authored dynamics;
- connect iFacialMocap;
- open `Dynamics Tune`;
- adjust `Strength`, `Reaction`, `Convergence`, and `Sway` while moving naturally;
- confirm Native Stage motion changes immediately;
- restart Runtime Player and confirm tuning restores;
- open OBS Browser Source and confirm it uses the same tuning;
- switch to a different Runtime Export and confirm stale tuning does not apply;
- reset a group to exported defaults and confirm behavior returns;
- confirm Runtime Export artifacts remain unmodified on disk.
