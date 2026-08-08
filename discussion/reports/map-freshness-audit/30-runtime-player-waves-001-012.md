# Runtime Player Wave 1–12 map freshness audit

## 基準点と監査範囲

- 基準 Git: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`（2026-08-08, Asia/Tokyo）。
- 対象は Runtime Player の foundation/Electron shell、Runtime Export load、iFacialMocap、mapping/body follow、persistence、Broadcast Stage/Browser Source、Variant switching と、それらを記録する Wave 1–12 の plan/report/review map。
- `audit-contract.md` に従い、完了 wave の map は後続実装があるだけでは stale と判定せず、当時の証拠索引として正しいかを判定した。
- 既存 worktree change は変更していない。読み取り専用調査と本ファイルの作成だけを行った。

## 確認した map の全一覧と判定

判定の意味は契約書どおり。`living-current-state` は現在状態を記す入口、`living-index` は現行の子成果物索引、`historical-evidence-index` は当時の完了 wave/review の証拠索引である。

| Map | 種類 | 判定 |
|---|---|---|
| `discussion/runtime-player/_map.md` | living-current-state | Partially stale |
| `discussion/runtime-player/architecture/_map.md` | living-current-state | Partially stale |
| `discussion/runtime-player/research/_map.md` | living-current-state | Partially stale |
| `discussion/runtime-player/screens/_map.md` | living-current-state | Partially stale |
| `discussion/runtime-player/backlog/_map.md` | living-index | Current |
| `discussion/runtime-player/implementation/_map.md` | living-current-state | Partially stale |
| `discussion/runtime-player/implementation/orchestration/_map.md` | living-index | Partially stale |
| `discussion/runtime-player/implementation/waves/wave1/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave2/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave3/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave4/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave5/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave6/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave7/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave8/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave9/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave10/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave11/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/waves/wave12/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave1/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave2/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave3/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave4/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave5/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave6/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave7/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave8/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave9/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave10/_map.md` | historical-evidence-index | Intentionally historical |
| `discussion/runtime-player/implementation/reviews/wave11/_map.md` | historical-evidence-index | Partially stale |
| `discussion/runtime-player/implementation/reviews/wave12/_map.md` | historical-evidence-index | Intentionally historical |

Roll-up: **Current 1**, **Partially stale 7**, **Stale 0**, **Intentionally historical 23**, **Unverifiable 0** (31 maps total). The seven partial maps are the root, architecture, research, screens, implementation, orchestration, and Wave11 review maps; each still has useful current links but contains an obsolete status/open-question/child-document claim.

## 現行リポジトリ事実（根拠）

These are repository facts unless marked otherwise.

- Electron shell and two-window boundary: `apps/runtime-player/src/main/runtime-player-main.ts:219-247` creates Control/transparent Stage windows, configures the loopback Browser Source server, and installs the Variant bridge (server start is at `:346`). `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:51-84` owns the separate BrowserWindows and `:222-279` persists Stage always-on-top/bounds lifecycle.
- Current lifecycle is Wave20 semantics, not Wave8 close-hide semantics: `apps/runtime-player/src/main/window-management/control-window-recovery.ts:80-94` calls `requestQuit()` on normal Control close and closes Stage; direct Stage close remains recoverable through the window lifecycle/tray path. The implementation map records this at `discussion/runtime-player/implementation/_map.md:339-343`.
- Runtime Export loading is real, validated code: `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:40-101` reads manifest/model/atlas/one raw RGBA texture page; `:233-315` checks required capabilities, artifact consistency, byte length, and SHA-256. Startup/open/retry persistence is wired by `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:35-67`, `:92-107`, and `:112-146`, plus `runtime-player-main.ts:542-608` (clear/reset previous profile, body/vowel/dynamics/Variant/live frame state, then publish the new payload).
- iFacialMocap adapter is main-owned UDP code (`apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts:41-107`, optional start request at `:126-177`). Parser tests cover head rotation/position, eyes, v1/v2 blendshape delimiters and diagnostics (`ifacialmocap-frame-parser.ts:33-67`, `:142-242`); normalizer emits a sanitized `TrackingFrame`, scales blendshape 0–100 to 0–1 and clamps (`ifacialmocap-normalizer.ts:19-51`, `:71-85`). This is implementation/test evidence, not evidence that an actual iPhone/network session has passed.
- Mapping/body follow are implemented at the main boundary: semantic slots include head/eyes/mouth plus `body-x`/`body-z` (`apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:193-219`), body smoothing is main-owned (`body-follow-state.ts:7-35`), and `runtime-parameter-frame.ts:111-133`, `:151-218`, `:410-435` emits `runtime-player-live-parameter-frame-v1` with sanitized parameter values and calibrated head position/body transforms.
- Persistence is app-userData-owned. `runtime-player-main.ts:433-443` constructs Model Mapping, Dynamics, Startup, and Window State stores; the Wave7 map records the profile/window paths and the user’s manual restore checks (`discussion/runtime-player/_map.md:47-57`). Current code still distinguishes saved base Stage transform/settings from transient live offsets (`apps/runtime-player/src/main/window-state/window-state-controller.ts:89-147`; Wave11 report `:150-155`).
- Browser Source is a tokenized loopback path. `runtime-player-main.ts:231-247`, `:399-430` starts/publishes it; `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:205-249` publishes Runtime Export, sanitized live frames, Stage display state, active Variant, and effective dynamics, and clears all of them on unload. The preload contract lists only sanitized `activeVariantSelection`, effective dynamics, live frame and stage display fields (`apps/runtime-player/src/preload/browser-source-transport-contract.ts:19-129`). Wave10’s boundary is native local-preview rendering suspension only; input/mapping/body/dynamics/export/Stage transform/Browser Source remain active (`discussion/runtime-player/research/broadcast-capture-paths.md:64-87`).
- Variant switching is session-only and parity-preserving: Wave12 final evidence says session default/reset/clear/reload and `baseVisible`/visibility predicate behavior (`discussion/runtime-player/implementation/waves/wave12/wave12-final-integration-report.md:77-92`, `:118-135`); the current Browser Source contract transports only sanitized active Variant selection (`browser-source-transport-contract.ts:37-50`, `:70-99`).
- Verification commands: `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` exited 0; elevated `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit` passed **140 files / 925 tests** in the current worktree. The first unit-test attempt failed with sandbox `spawn EPERM`; the elevated rerun is the passing result. No Electron GUI, OBS, iPhone, or packaged-exe manual run was performed during this audit.

Information-kind separation:

- **Repository facts:** source, contracts, tests, package scripts, and Git history above.
- **Design/policy decisions:** Electron/main-owned input, adapter/mapping boundary, transparent Stage, model-only Browser Source, and sanitized transport in `architecture/_map.md:20-34` and `research/broadcast-capture-paths.md:76-87`.
- **Experiments/review results:** Wave1–12 final reports/reviews and the user-confirmed Wave7 restore checks in `runtime-player/_map.md:47-57`; these establish source/domain confidence, not external product confidence.
- **Official facts/hypotheses:** iFacialMocap protocol and Warudo/browser-host observations remain cited research in `research/ifacialmocap-input-adapter-research.md`; “desktop host is likely required” is a hypothesis, not a verified product requirement.
- **Unresolved/manual facts:** real iFacialMocap network behavior, OBS/Browser Source visual parity and performance, and packaged Electron lifecycle smoke remain open (`runtime-player/_map.md:106`, `:114-116`; Wave11 report `:150-160`; Wave12 report `:118-135`).

## stale / 疑わしい記述と含意

| Claim (`file:line`) | 種類 | 現行事実 / 根拠 | 含意 |
|---|---|---|---|
| `discussion/runtime-player/backlog/runtime-player-backlog.md:158-167` says item 3.5 is `Deferred` and Wave2-era iFacialMocap/normalization/mapping/calibration are unimplemented. | repository status claim | Wave4/5 reports, adapter source/tests, and the 140/925 unit run show this is implemented at source/domain level; real-device verification is the remaining gate. | High-confidence stale active backlog entry. It can route planning back to a completed feature. |
| `discussion/runtime-player/screens/initial-runtime-player-screen.md:231` lists `Hide Control Window` as a frequent live operation. | UX/current-state claim | Normal Control close now requests quit (`control-window-recovery.ts:80-94`); current tray actions expose Show Control/Focus Stage/Quit, not a normal hide-on-close lifecycle. | Remove or label as historical; otherwise operators may expect a non-existent hide path. |
| `initial-runtime-player-screen.md:252` says current Wave5 nav is only `Overview / Input / Mapping`. | UX/current-state claim | Current screens map lists `Overview / Live Controller / Input / Mapping / Dynamics Tune / Stage / Performance Diagnostics` (`screens/_map.md:10`, `:25`). | Stale route description; link readers to `control-window-screen-structure.md`. |
| `initial-runtime-player-screen.md:263-267` keeps Runtime Export restore, Model Mapping profile storage, Stage window controls, Stage Motion/near-far, and Broadcast/OBS UX as open questions. | unresolved/current-state claim | Waves7–12 implemented these source/domain paths; current summaries are in `runtime-player/_map.md:47-74` and `screens/_map.md:10-16`. | Mark the section explicitly “Wave6 historical open questions”; otherwise it contradicts current maps. |
| `discussion/runtime-player/architecture/_map.md:47-50` still asks where Stage position/size/always-on-top/click-through and Runtime Export contract validation should land, and asks Wave4 brow scope. | unresolved/current-state claim | Stage controls/persistence were delivered in Waves7/8; loader validation is current source; Wave4 face/eyes/mouth scope is historical. | Keep as historical design questions or replace with current manual gates. |
| `discussion/runtime-player/research/_map.md:9-10`, `:17-26` reports research only through Wave10 and next checks only the post-Wave10 checklist. | living research status | Wave11 Stage Motion/near-far and Wave12 Variant transport are current source/report facts (`runtime-player/_map.md:67-74`; Wave11/Wave12 reports). | Mark status as through Wave12 or add links; retain manual OBS/iFacial checks as unresolved. |
| `discussion/runtime-player/implementation/_map.md:343` and `:359` explicitly carry stale Wave8 close-hide wording as follow-up work. | repository documentation-debt claim | The claim accurately records known debt, but is no longer a current lifecycle description; Wave20 source changed semantics. | Keep the debt note, but route current readers to Wave20 and avoid presenting close-hide as behavior. |
| `discussion/runtime-player/implementation/orchestration/_map.md:19` says Wave11 is “pending clean review”. | review status claim | `discussion/runtime-player/implementation/reviews/wave11/runtime-player-wave11-final-integration-review.md:1-10` is Review-Sylph `verdict: pass`. | Update index status; no source defect implied. |
| `discussion/runtime-player/implementation/reviews/wave11/_map.md:12`, `:16-18` also says final review is pending. | historical review index claim | The final review exists and passes (`.../runtime-player-wave11-final-integration-review.md:1-10`). | Mark this map partial stale; preserve the historical review evidence. |
| Wave11 final report `.../runtime-player-wave11-final-integration-report.md:154` and final review `.../runtime-player-wave11-final-integration-review.md:101-104` list Native Stage `close-hide/reopen` checks. | residual manual checklist wording | Wave20 changed normal Control close to quit and direct Stage close to recoverable; current source is `control-window-recovery.ts:80-94`. | Replace close-hide with “Control close exits; direct Stage close + Focus Stage reopens” in a later docs pass. |
| `runtime-player-backlog.md:285-286` and `:333-335` use present-tense “current/session state is lost on restart” and “Stage state does not carry to next launch” inside Done Wave7 items. | historical problem statement | The same items’ implemented outcomes at `:296-304` and Wave7 final report show auto-save/restore paths. | Label these as pre-Wave7 problem history; do not treat them as active defects. |

The Wave8 close-hide wording in Wave8’s own plan/report/review maps is **not** stale under this audit: those are historical-evidence maps describing the behavior at that wave. The stale risk arises only when that wording is linked from a living current-state screen/backlog map without an explicit historical label.

## Wave 1–12 evidence interpretation

- Waves1–3: foundation/Electron shell, Runtime Export directory/static Stage load, runtime-core default pose and Stage pan/zoom. Each wave map/report/review is a complete historical pass; manual real-export/alpha/Electron checks were recorded as non-blocking gates.
- Wave4: main-owned iFacialMocap UDP receive/parse/normalize and diagnostics, without model motion. Real iOS/firewall/axis/unit behavior remained an experiment/manual gate.
- Wave5: Input Profile persistence, Look Forward, calibration, auto mapping, and Stage live mapping. Source/tests and user live-motion observation support completion; stale-pose and real-device body visual checks remain manual.
- Wave6: head-position left/right calibration and Body Angle X/Z follow in sanitized frames. The “body remains static” Wave5 observation is historical trigger evidence, not current behavior.
- Wave7: Model Mapping Profile auto-save/restore and separate Window State (bounds, pan/zoom). User confirmed restart/reopen and Stage restore behavior; current child backlog problem text is historical.
- Wave8: Runtime Export startup restore, Control recovery, Stage Arrange/click-through/always-on-top/Capture Target. Its close-hide wording is historical and superseded by Wave20.
- Wave9–10: tokenized loopback Browser Source model-only Stage, sanitized transport, resync, and native local-preview suspension while Browser Source remains active. OBS visual/performance checks are still manual.
- Wave11: near/far calibration and main-owned Stage Motion composed transform with Browser Source parity; final review is pass despite the stale pending marker in its map.
- Wave12: session-only active Variant selection, Live Controller, Look Forward/Center/Stage Motion toggles, and Stage/Browser Source parity. Persistence of last active Variant is intentionally future work.

## 親 map へ反映すべき結論

1. Keep all Wave1–12 implementation/review maps as historical evidence; do not rewrite their old acceptance context. The only historical-index exception needing a status correction is `reviews/wave11/_map.md`’s obsolete “pending review” marker.
2. Current navigation should treat Electron Control + transparent model-only Stage, validated Runtime Export load, main-owned iFacialMocap adapter, sanitized mapping/body follow, userData persistence, tokenized Browser Source, Stage Motion, and session Variant parity as implemented source/domain facts.
3. Add a documentation pass for the living root/architecture/research/screens/backlog maps: route current lifecycle to Wave20, route Wave11 review to its pass, and mark `initial-runtime-player-screen.md` Wave5/6 sections as historical. Do not claim manual OBS/iPhone/Electron product confidence until those checks run.

## 未解決事項 / ユーザー判断点

- Real iFacialMocap: handshake/passive mode, iOS permissions/firewall/multi-NIC, UDP/TCP stability, axis signs, head-position units/ranges, Look Forward behavior, and long-run packet behavior.
- Manual Electron/Stage: packaged or dev lifecycle smoke (Control close exits, direct Stage close recovery, Focus Stage reopen), startup valid/invalid Runtime Export restore, Arrange drag, click-through tray recovery, always-on-top persistence, fallback controls.
- Manual OBS Browser Source: URL/token load, alpha, WebGL2/model rendering, heartbeat/diagnostics, local-preview suspension/resume, reconnect/resync, Stage Motion and Variant parity, dynamics/body follow, performance, and unintended audio.
- Product choices: TCP/multiple input sources, advanced mapping curves/deadzone, Body Angle Y, Spout2/OBS automation, last-active Variant persistence, dedicated Model/Diagnostics UX, and legacy exports without `baseVisible`.

## 未確認範囲

- Wave13–23 implementation/review maps were not audited individually; only current Runtime Player summaries and links needed to establish Wave1–12 implications were read.
- Not every body paragraph of every Wave1–12 review/report was re-read line-by-line; the final reports, review maps, source/test seams, and known residual checklists were inspected.
- No external official URL was revalidated on the web in this repository audit; existing research links were treated as cited official/third-party facts or explicitly labeled hypotheses.
- No Electron GUI, OBS, iPhone, or packaged-executable manual test was performed.
