# Review: Wave21 Domain A Spec Compliance

- Verdict: pass
- Reviewer: Review-Sylph
- Mode: read-only

## Scope Reviewed

Domain A Runtime Player changes under `apps/runtime-player`, including tuning profile persistence, main/preload bridges, runtime evaluation/evaluation cache, Native Stage renderer, Browser Source transport/session/client, and focused tests.

## Findings

None.

## Spec Compliance Notes

- Profile storage is Runtime Player-owned under `userData/dynamics-tuning-profiles/<safePackageId>/<fingerprint>.json`.
- Profile/effective profile include schema version, timestamps, export identity, dynamics signature, and group-keyed overrides.
- v1 override fields are present: `enabled`, `strength`, `limit`, `length`, `sway`, `reactionSpeed`, `convergenceSpeed`.
- Stale signatures are ignored and missing group ids are filtered safely.
- Effective groups are cloned/layered without mutating Runtime Export artifacts.
- Effective tuning is applied before runtime graph compile/evaluation.
- Cache keys include tuning revision/fingerprint/signature.
- Native Stage and Browser Source receive the same effective profile path.
- Browser Source sync uses `effectiveDynamicsTuning` and `dynamics-tuning-changed` without rewriting Runtime Export artifacts.
- No Control Window `Dynamics Tune` page implementation was found beyond backend/bridge scaffolding.

## Remaining Manual Checks

- Tune a real export and verify Native Stage and OBS Browser Source motion match.
- Restart/reopen and confirm profile restore.
- Confirm Runtime Export files remain unchanged.
