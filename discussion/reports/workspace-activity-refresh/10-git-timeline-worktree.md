# Git timeline and worktree activity refresh

## 1. Scope / inspected entry points

This report reconstructs repository activity from Git history and the current worktree. It is intentionally a timeline/ownership report; semantic claims about product behavior, implementation quality, or acceptance belong to the topic reports.

Inspected entry points:

- `discussion/reports/workspace-activity-refresh/audit-contract.md` (full contract), `discussion/_conventions.md`, and `discussion/_map.md`.
- Branch, remote-ref, status, reflog, path-scoped log, diff, staging, and conflict state using the commands listed in the evidence index.
- Path histories for `discussion/**`, `apps/editor`, `apps/runtime-player`, and `packages`.

The audit contract requires current repository fact, historical evidence, accepted decisions, experiments, inferences, and unresolved gates to remain separate. No source, test, map, or existing report was edited by this review; only this report is owned here.

## 2. Executive summary

1. The worktree is on `feature/2d-rigging-eco-system` at `af5839452f0968a005cb6cd13c62b714aa4e6d4e` (`af58394`, 2026-08-08 22:18:30 JST), whose subject is `docs: refresh discussion maps`.
2. The local branch is four commits ahead of the local `origin/feature/2d-rigging-eco-system` ref and zero behind (`git rev-list --left-right --count HEAD...origin/feature/2d-rigging-eco-system` = `4 0`). No upstream marker is shown by `git branch -vv`; this is a local-ref comparison, not a network fetch.
3. The latest commit is documentation/map work: 162 files, 6,138 insertions, and 437 deletions, including root/topic map refreshes, newly registered child maps, and the map-freshness audit reports. No product/source commit follows it in the local history.
4. The preceding activity cluster is 2026-07-12–26: runtime-player and mesh/render fixes, model-authoring writebacks, AI-cohost/runtime work, Electron migration closure, and Expo production/wording decisions. The latest non-map product/path commits are `899cb2e` (2026-07-14 packages) and `3c3669e` (2026-07-26 Expo cleanup).
5. The root map records Editor mainline planning as stopped at Wave102 and W103–109 as bounded specialized evidence (`discussion/_map.md:63-65`). It identifies model-authoring and runtime-player as the main topic families while preserving device/product/legal gates (`discussion/_map.md:64-72`). This is a current map statement; the “main activity” characterization below is an inference from that statement and the Git sequence.
6. The stable, known user/config worktree entries are `.codex/agents/gnome.toml` and `.codex/agents/sylph.toml` (tracked modifications), `.codex/skills/context-check/{DESIGN.md,SKILL.md}`, and `discussion/expo.zip` (untracked). The assignment directory contains concurrent audit scaffolding; these are not product commits.
7. During parallel E2E/audit activity, `apps/editor/test-results/**` briefly appeared as changing/deleted paths. Those paths were not part of the agreed baseline and were excluded from the final ownership interpretation pending Electron-owner restoration; they must not be read as intentional product work from this report. A final status capture is required after that concurrent activity settles.
8. No staged changes, merge-conflict entries, or whitespace errors were present in the completed checks (`git diff --cached --name-status` empty; `git diff --check -- .` exit 0 at capture). No tests were run by this read-only review.

## 3. What was built or investigated (Git evidence only)

### Documentation and map refresh

`af58394` refreshed `discussion/_map.md`, topic maps, implementation/runtime wave indexes, and map-freshness audit reports in one large documentation commit. The commit is the current HEAD and is the latest activity in every inspected `discussion/**` path.

### Mainline Editor and specialized evidence

The implementation path history shows Wave103 (`2f80ca0`, 2026-07-02), Wave104 (`6645c2f`), Wave105 (`1f07270`), dynamics (`356959c`, 2026-07-05), lipsync (`19006ac`, 2026-07-06), transparent-margin work (`70485f4`, 2026-07-10), and the Wave109 `uvRect`/`contentInset` contract correction (`899cb2e`, 2026-07-14). The root map explicitly keeps Wave102 as the Editor planning stop and separates W103–109 as specialized evidence.

### Runtime player and Electron migration

`apps/runtime-player` history records the C4–C6 AI-cohost integrations (`140fb63`, `bc8e04e`, `ed49b5d`, `183788c`), followed by the known-baseline expectation correction `d9801d0` (2026-07-12). The Electron topic records phase 1, filesystem correction, WS2, WS3/WS4, and packaging closure (`d9f3f1d`, `4dde084`, `4349168`, `e9113ab`, `d1b2348`, all 2026-07-08).

### AI cohost and model-authoring streams

The AI-cohost path progressed through reading/interjection (`307a923`, `5f883b7`, `a1f468f`), stream-memory design and implementation (`d39b0e7`, `84ff569`, `a5e2d07`, 2026-07-19), with human gates recorded in the map. Model-authoring writebacks on 2026-07-12–14 (`b678bec`, `063dd45`, `9147115`, `26e3c00`, `b0cd920`, `1be1673`) were followed by `45d2734` on 2026-07-26.

### Mesh/render and Expo production

Mesh v7 was created/selectable at `04e24cd` (2026-07-07) and the PSD `contentInset`/UV remap fix landed at `8640d12` (2026-07-12). Render-performance history records the C7 closure context at `8bcc1aa`. Expo history records the product-based framing decision (`0a89c45`), six HTML/A2 PDF surfaces and production ledger (`1ed12b2`), wording review (`cd693ea`), and removal of obsolete drafts with proof-print hold (`3c3669e`, 2026-07-26).

## 4. Current repository state (repository facts)

| Item | Observed state | Evidence |
|---|---|---|
| Worktree root | `C:\workspace\remie\code\ai-native-live2d-editor` | `git rev-parse --show-toplevel` / all commands in §10 |
| Branch | `feature/2d-rigging-eco-system` | `git status --short --branch`; `git branch -vv` |
| HEAD | `af5839452f0968a005cb6cd13c62b714aa4e6d4e`, Remie Margatroid, 2026-08-08 22:18:30 +09:00 | `git log -1 --date=iso-strict ...` |
| Remote comparison | `HEAD...origin/feature/2d-rigging-eco-system = 4 0` | `git rev-list --left-right --count ...` |
| Staging | Empty at capture | `git diff --cached --name-status` |
| Conflicts | No unmerged entries at capture | `git status --short` conflict-prefix scan |
| Latest commit scope | 162 files, +6,138/−437; maps/reports and map-freshness artifacts | `git show --stat --summary HEAD` |
| Product/source edits after HEAD | None in Git history; current status review excludes transient E2E output churn | path-scoped `git log`, `git status` |

The non-audit tracked modifications and untracked files observed around the review are `.codex/agents/gnome.toml`, `.codex/agents/sylph.toml`, `.codex/skills/context-check/DESIGN.md`, `.codex/skills/context-check/SKILL.md`, and `discussion/expo.zip`. Concurrent audit reports (`discussion/reports/workspace-activity-refresh/01-product-policy.md`, `09-expo-public-surfaces-archives.md` when present), `_map.md`, and `audit-contract.md` belong to the workspace-activity-refresh assignment, not product implementation. The report itself is the only file owned by this task.

## 5. Accepted decisions and boundaries (as recorded, not re-adjudicated)

- The four-track separation (Private Prototype, Streaming Demo Surface, Live2D Feature Proposal, Future Public Clean Subset) is recorded at `discussion/_map.md:13-18`.
- The Editor mainline planning stop at Wave102 and bounded W103–109 evidence are recorded as a user decision/current map boundary at `discussion/_map.md:63-65`.
- Runtime-player, model-authoring, mesh-generation, render-performance, Electron, AI-cohost, Expo, and archive statuses are delegated to their topic maps (`discussion/_map.md:38-46`).
- The root map records legal/device/product gates as unresolved rather than treating implementation/test passes as human acceptance (`discussion/_map.md:66-72`, `91-103`).

These are repository/map records. This report does not assert that any gate is accepted, nor does it change scope or UX decisions.

## 6. Verification and experiment evidence

- `git diff --check -- .` returned exit code 0 at the completed capture. During parallel E2E churn, Git emitted only LF→CRLF normalization warnings for generated `error-context.md`; no trailing-whitespace error was reported.
- `git diff --cached --name-status` returned no entries; no staging or commit was performed by this review.
- `git status --short --branch --untracked-files=all` and `git diff --name-status` were sampled repeatedly. Generated `apps/editor/test-results/**` paths changed while another agent was running; those observations are explicitly treated as transient, not baseline ownership.
- No test, build, browser, device, OBS, or external-service command was run by this read-only timeline review. Historical test/experiment claims (for example `1500 green` at `899cb2e` or `925/925` at `d9801d0`) are commit-message evidence only, not rerun results.

## 7. Historical progression / turning points

| Phase | Approx. dates | Git anchors | Timeline interpretation |
|---|---|---|---|
| Concept/research baseline | 2026-05-25–27 | `8e6fb4f`, `f3af512`, `755e751`, `129e292` | Use-case, technical/runtime research, then the concept change were recorded. |
| Editor/wave foundation | Through 2026-07-07 | `77b5a91`, `2f80ca0`, `6645c2f`, `1f07270`, `356959c`, `04e24cd` | Wave delivery, dynamics, and mesh-v7 work accumulated; Wave102 later became the planning stop recorded by the map. |
| Electron/runtime and AI-cohost vessel | 2026-07-08–12 | `d9f3f1d`→`d1b2348`; `140fb63`→`8bcc1aa` | Electron WS1–WS4/packaging and C3–C7 runtime vessel work were closed in the history. |
| Model-authoring and specialized render/export | 2026-07-12–14 | `b678bec`→`1be1673`; `8640d12`; `899cb2e` | Craft writebacks, PSD inset correction, and Wave109 export preflight correction were recorded. |
| AI-cohost human-gate stream | 2026-07-18–19 | `307a923`, `a1f468f`, `d39b0e7`, `a5e2d07` | Reading/interjection and stream-memory implementation evidence landed; human/product gates remained in map records. |
| Expo production/cleanup | 2026-07-25–26 | `0a89c45`, `1ed12b2`, `cd693ea`, `3c3669e`, `45d2734` | Product-based exhibit framing, six surfaces, wording pass, obsolete-draft removal, and a proof-print hold were recorded. |
| Documentation/map refresh | 2026-08-08 | `af58394` | Root/topic indexes and the map-freshness audit were refreshed in the current HEAD. |

**Inference (explicit):** Given the 2026-07-26→2026-08-08 gap and the fact that `af58394` is the latest commit in every inspected topic path, repository activity moved from implementation bursts to documentation/index refresh and gate tracking. This does not prove that no external or uncommitted work occurred.

## 8. Open gates, debts, and uncertainties

The root map’s unresolved table remains the authoritative index for these items (`discussion/_map.md:87-103`): Demo safety/preflight; proposal target; Dynamics v3 traceability; runtime-player real-device/OBS/lifecycle/vowel gates; model-authoring PNG/strict-ref/sidecar/next-scope gates; mesh/render quality and GPU/pixel/Canvas gates; optional C7 two-instance measurement; Electron residuals; AI-cohost S8/brain-swap/stream-memory/persona decisions; Expo acceptance/proof print/rights; Cubism archive restart permission/legal/scope; implementation index/history hygiene; and Future Public Clean Subset scope.

The worktree introduces one ownership uncertainty during this refresh: generated `apps/editor/test-results/**` files were concurrently deleted/rewritten while E2E work was active. They are not included as a durable baseline finding; the Electron owner must provide the settled status and restoration decision before any cleanup is attributed to this activity.

## 9. Candidate next work (facts-derived, not recommendations)

The root map lists the following candidate entry points (`discussion/_map.md:74-85`): use implementation/orchestration maps with Wave102 as the Editor stop; resolve the runtime-player real-device/product gates; choose model-authoring PNG/strict-ref/next scope; resolve mesh/render quality and atlas/GPU/pixel/Canvas gates; handle Electron residuals; resolve AI-cohost human/product gates; validate Demo/Expo/Proposal rights and acceptance/proof print; and scope a Future Public Clean Subset only after rights/dependency review. These are map-recorded candidates, not decisions made by this report.

## 10. Evidence index

| Evidence | Command or path | Result used |
|---|---|---|
| Worktree/branch | `git status --short --branch --untracked-files=all` | Branch name and current modification inventory; transient test-output paths excluded pending owner settlement. |
| HEAD identity | `git log -1 --date=iso-strict --format='%H %ad %an <%ae> %s'` | `af5839452f...`, 2026-08-08 22:18:30 +09:00, map refresh. |
| Branch topology | `git branch -vv`; `git rev-list --left-right --count HEAD...origin/feature/2d-rigging-eco-system` | No upstream marker; local ref comparison `4 0`. |
| HEAD scope | `git show --stat --oneline --summary HEAD` | 162 files, +6,138/−437, map/report-heavy commit. |
| Recent activity | `git log -8 --date=short --format='%h %ad %s'` and `git reflog -8 --date=iso-strict` | 2026-08-08 map refresh followed 2026-07-26 Expo/model-authoring activity. |
| Path anchors | `git log -8 --date=short -- <path>` for root map, topic maps, apps, packages | Topic-specific turning points in §3 and §7. |
| Worktree safety | `git diff --cached --name-status`; conflict-prefix scan | Nothing staged; no unmerged entries at completed capture. |
| Whitespace | `git diff --check -- .` | Exit 0; only generated-file line-ending warnings during concurrent E2E churn. |
| Current map | `discussion/_map.md:13-18,38-46,63-72,74-103` | Four-track boundary, topic ownership/status, Wave102 stop, candidate actions, unresolved gates. |

## 11. Limitations

- This is a local Git inspection. No fetch was performed, so the remote comparison is against the existing local `origin/feature/2d-rigging-eco-system` ref.
- Commit subjects are historical evidence, not independent proof that the described implementation or human gate is currently valid. No tests, builds, device runs, or external acceptance checks were rerun.
- Parallel agents shared this worktree. Generated E2E artifacts changed during the review; the final durable interpretation intentionally excludes those transient snapshots until the Electron owner settles them.
- Semantic status, source/test correctness, map link validity, and product/legal acceptance are delegated to the corresponding reports and are not re-adjudicated here.

## 12. Final re-review after concurrent E2E restoration (2026-08-08)

The Electron owner stopped the E2E child processes and restored all changed `apps/editor/test-results/**` paths to HEAD. A fresh status capture then produced:

- `git status --short -- apps/editor/test-results`: empty (no residual generated-file edits).
- `git diff --name-status -- .`: only `M .codex/agents/gnome.toml` and `M .codex/agents/sylph.toml`.
- `git ls-files --others --exclude-standard`: the two context-check skill files, `discussion/expo.zip`, this assignment's `_map.md`/`audit-contract.md`, and the concurrently authored workspace-activity reports (including this report).
- `git diff --cached --name-status`: empty; conflict-prefix scan: empty.
- `git diff --check -- .`: exit code 0.
- HEAD and branch topology unchanged: `af5839452f0968a005cb6cd13c62b714aa4e6d4e` on `feature/2d-rigging-eco-system`, local remote comparison `4 0`.

The E2E generated-file churn is therefore closed as transient concurrent activity, not a durable source/test change attributable to this refresh. No blocking timeline/worktree finding remains. **Final verdict: PASS (0 blocking, 0 nonblocking).**
