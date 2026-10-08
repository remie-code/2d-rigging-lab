# Model-authoring map update

> Audit basis: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / `40-model-authoring.md`, `62-cross-topic-integration.md`, `90-root-map-integration.md` (2026-08-08, Asia/Tokyo).

## 1. Owned maps inspected

- `discussion/model-authoring/closed-problems/_map.md`
- `discussion/model-authoring/craft/_map.md`
- `discussion/model-authoring/_map.md`

The update followed the child-before-parent order: closed-problems and craft first, then the model-authoring parent map.

## 2. Maps changed / created / intentionally unchanged

### Changed (3)

- `closed-problems/_map.md`: recorded 01–19 pass, craft second-cycle and craft/09–10 third-run completion as repository facts; removed the stale “prepare second cycle” action and the old automatic problem-02 sequence; separated technical follow-ups, human/device gates, and user decisions.
- `craft/_map.md`: changed the conductor calibration blurb from “工程2・3のテスト進行中” to completed; clarified that volumetric tuft work is closed by the layered-rotation-shells route, while any new target is user-selected; recorded the 2026-07-07 second-cycle closeout.
- `model-authoring/_map.md`: indexed the Wave107-related research files; corrected the premises index to five documents and the craft summary to four second-cycle items; recorded Wave103–105 equipment completion without promoting human gates; replaced the automatic closed-problem-02 next action with classified current facts/gates/decisions; qualified the 2026-07-03 PNG approval as historical to the then-current artifact and recorded post-`45d2734` re-certification; linked the Wave107 → Wave22/23 real-device vowel gate.

### Created

- None.

### Intentionally unchanged

- No non-map design, implementation, runtime-player, source, test, configuration, or generated artifacts were edited.
- Existing historical closed-problem rows and historical Wave105 notes were retained; only their current-state interpretation was qualified.

## 3. Claims replaced and evidence

| Replaced claim | Current map claim | Evidence |
|---|---|---|
| “Prepare second cycle” / “next closed problem 02” | 01–19, craft second cycle, and craft/09–10 third-run evidence are complete; a new closed-problem scope is user-owned. | `40-model-authoring.md:14-23,62-72`; `craft/_map.md` second-cycle section; `62-cross-topic-integration.md:C11`; `90-root-map-integration.md:R04/R14`. |
| Craft conductor stage 2/3 still in progress | Empty-run calibration for stages 0, 2, and 3 and associated user rulings are complete. | `discussion/model-authoring/craft/_conductor.md:111-112`; `40-model-authoring.md:14-23`. |
| Recipe 07 tuft work still future | Layer-coordinate/rotation-shell route closed tuft volumetric treatment; only a different future target would be a new user-selected run. | `craft/_map.md:25-32`; `40-model-authoring.md:17-23`. |
| Equipment and human approval are one “closed” state | Hand/retina/eye/tape/health-check are repository facts; visual approval is artifact-specific and current bytes require re-certification. | `40-model-authoring.md:37-41,56-65`; `62-cross-topic-integration.md:70-72`. |
| Wave107 vowel behavior is the current gate contract | Wave107 remains historical; the current real-device gate targets Wave22/23 mouth-open `w → s` and normalized five-vowel blend. | `40-model-authoring.md:74-79`; `discussion/implementation/waves/wave107/wave107-final-integration-report.md:1,5`; Wave22/23 final reports §6/§7. |

## 4. Decisions and gates intentionally preserved

- Accepted ai-interface/dry-run auto-approval, direct live-session perception, pure-TS software rasterizer, one-shot CLI, and `1 committed operation = 1 git commit` operating invariant remain decisions/facts. Whether a separate policy document is needed remains a user choice.
- The 2026-07-03 human PNG approval remains historical evidence; it is not silently extended to the post-`45d2734` bytes.
- Human/device gates remain open: post-45d PNG re-certification and Wave107 → Wave22/23 real-device vowel checks (speech transitions, closed-mouth zero, jitter/flicker, toggle, strength).
- Strict-ref error classification and sidecar absolute-path portability are recorded as technical/acceptance choices, not equipment failures.
- The next closed-problem scope is explicitly user-owned; no automatic problem-02 scheduling remains.

## 5. Link and diff verification

- `git diff --check -- discussion/model-authoring discussion/reports/map-freshness-audit/114-model-authoring-map-update.md` — pass (no whitespace errors).
- `rg -n "閉問題 02 の定義|2周目の準備|工程2・3のテスト進行中|房への適用は再走" discussion/model-authoring --glob "_map.md"` — no stale automatic-next/conductor/tuft wording remains in owned maps.
- Focused relative-link check over the three owned `_map.md` files — all referenced targets exist (including the Wave107, Wave22, Wave23 reports and four indexed research surveys).
- `git status --short -- discussion/model-authoring discussion/reports/map-freshness-audit/114-model-authoring-map-update.md` — only the three owned maps and this report are in scope.

## 6. Remaining issues outside ownership

- Runtime Player Wave22/23 map creation, Wave107 review-map coverage, and implementation/orchestration parent index repair belong to the runtime/implementation owners.
- Root `discussion/_map.md` integration is owned by the root-map updater; this report supplies the model-authoring facts and gate wording only.
- Physical PNG re-certification and real-device vowel checks were not performed by this documentation update and remain user/human gates.
