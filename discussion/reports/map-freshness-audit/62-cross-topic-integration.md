# Cross-topic map freshness integration audit

基準点は監査契約どおり Git HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`、2026-08-08 (Asia/Tokyo)。このファイルだけを作成し、既存 map/source/test/config は変更していない。目的は domain report を再掲することではなく、root map が参照すべき「現在の正」「親 map の stale な入口」「実際の gate」「情報種別の境界」を照合することである。

## 1. 確認範囲

先に `audit-contract.md` と監査 `_map.md` を読み、次の durable report と mechanical report 01 を照合した。

- `01-mechanical-inventory.md`
- `10-product-baseline.md`, `11-design-and-conventions.md`
- `40-model-authoring.md`, `41-mesh-and-rendering.md`, `42-render-performance-and-dynamics.md`, `43-editor-electron-migration.md`
- `50-ai-cohost.md`, `51-expo-and-research-archives.md`

参照した root entry は `discussion/_map.md`（特に `:31-46,63-73,75-91`）。この報告では root `discussion/_map.md` の最終 adjudication は行わない。

### 担当 domain の map verdict 集計

| top-level scope | Current | Partially stale | Stale | Intentionally historical | Unverifiable | 判定根拠 |
|---|---:|---:|---:|---:|---:|---|
| product / concept・AC・scenarios・demo・proposal | 2 | 5 | 0 | 0 | 0 | `10-product-baseline.md:20-29` |
| design / development convention | 1 | 6 | 4 | 0 | 0 | `11-design-and-conventions.md:8-21` |
| model-authoring | 0 | 3 | 0 | 0 | 0 | `40-model-authoring.md:14-23` |
| mesh-generation / mesh-rendering | 0 | 4 | 0 | 0 | 0 | `41-mesh-and-rendering.md:13-22` |
| render-performance / dynamics | 0 | 1 | 0 | 1 | 0 | `42-render-performance-and-dynamics.md:20-27` |
| editor-electron-migration | 1 | 4 | 0 | 0 | 0 | `43-editor-electron-migration.md:14-22` |
| ai-cohost / apps/soul | 3 | 2 | 4 | 0 | 0 | `50-ai-cohost.md:17-27` |
| expo / reports archives | 2 | 7 | 0 | 2 | 0 | `51-expo-and-research-archives.md:17-30` |
| **合計 (52 maps)** | **9** | **32** | **8** | **3** | **0** | domain report の map 判定を加算 |

Mechanical baseline は 281 map、3480 links、22 broken relative links、1 missing child-map registration、45 root-graph orphan candidates。これは path/graph の triage であり、semantic stale の確定ではない（`01-mechanical-inventory.md:22-42,296-310`）。明示的な cross-topic integration の対象は下表の 12 件である。

## 2. Cross-conflict ledger (12 items)

以下で「conflict」は同じ current claim を使うと読み手が誤る、または親 map の status が child evidence と反転している項目を指す。単なる後続 wave の存在は conflict と数えず、historical evidence と current state を併記する必要がある場合だけ記載した。

| ID | 見かけ上の衝突 | replacement truth / authoritative owner | 情報種別の解決 |
|---|---|---|---|
| C01 | AC/scenario の one-output・`scalarDampedFollowV1` と design/runtime の multi-output world-frame chain が併存（`scenarios/_map.md:33`; `acceptance-criteria/02_DomainAcceptanceCriteria/209_...md:17-25`; `design/dynamics-world-frame-chain.md:21-31`; `runtime-core/dynamics-evaluation.ts:211-260`） | Root/MVP AC は要求・合否の oracle。schema/solver/cardinality の正は `dynamics-world-frame-chain.md` と Wave106 (`discussion/implementation/waves/wave106/_map.md:22-33`)。旧 scalar 文言は superseded 注記が必要。 | 要求（AC）と実装意味論（accepted design/repo fact）の衝突であり、MVP scope 変更ではない。 |
| C02 | design root/module-contracts/MVP authoring に old dynamics contract が残る一方、Wave106 は profile-v2 / `dynamics-file-v3` を pass | `design/_map.md:51,70`、`design/module-contracts/_map.md:38,52`、`design/mvp-authoring-runtime/_map.md:41` は refresh 対象。旧文書は historical evidence、現行 contract は Wave106/source/tests。 | accepted design decision と実装完了 report が時系列で分裂している。 |
| C03 | mesh-generation maps は Wave1.2/1.3、UV clamp、目視待ちを未完了とする一方、round-2 は v6/v7 一長一短・hold、Wave108/109 は render contract を完了 | `mesh-generation/_map.md:16,22,35`、`mesh-generation/implementation/_map.md:9,20-21,39-40` を child-first 修正。現行 method は v6d default + v7 toggle（`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:69-97`）。 | 実装 pass、ユーザー品質裁定、render contract は別 gate。v6削除/Wave2 は未決のまま。 |
| C04 | mesh-rendering は WebGL2/V4 を「次 wave」とする一方、Wave67 で実装済み、Option E/LINEAR/transparent gutter は Wave108/109 で現行化 | `design/mesh-rendering/_map.md:31-33` を implemented foundation + pixel/real-device residual に置換。Wave108 report の未コミット/未 gate 記述は closeout 時点の historical snapshot。 | design plan と implementation evidence の時点差。品質優劣や GPU pixel proof を自動 pass へ昇格しない。 |
| C05 | render-performance は Player hold/deep profiling/60fps pending と案内するが、Player Waves 13–19 は fast path・diagnostics・cadence を完了。OBS gap は環境、C7 二体負荷は未計測 | `render-performance/_map.md:40-44,54,61` は最新 parent map (`runtime-player/implementation/_map.md:332-338`) と wave evidence を参照。deep profiling は product transport に戻さない。 | current implementation fact、manual observation、optional experiment request を分離。Dynamics v3 は性能改善を主張しない。 |
| C06 | root Electron entry は「WS1 未着手」「次フェーズ packaging」だが、WS1–WS4 と packaging build は完了 | root `discussion/_map.md:43,71,86` は child maps/reports 後に更新。authoritative status は `editor-electron-migration/_map.md`（Current）＋残る E2E/typecheck/unit debt。 | migration feature completion と quality debt（`task_2d91b388`, `task_c8fc5155`）を別 status にする。 |
| C07 | ai-cohost root/soul は S1/access path 未決とするが、S1–S8 器は実装済み、Max 20x + Agent SDK は裁定済み | `ai-cohost/_map.md:21,52,68`、`soul/_map.md:15,35`。S8 kill、brain-swap、stream-memory の human gates だけを current open とする。 | design decision と implementation/gate status の混在。 |
| C08 | AI boundary の短縮文「repo 内 LLM/知覚は禁止」と apps/soul の実装・改定二号が食い違う | `concept/_map.md:9` は「特区外禁止」に限定。`mvp-boundary-amendment.md:46-52`、`apps/soul/README.md:1-28` が boundary oracle。 | policy revision の適用範囲の違いで、禁止の撤回ではない。 |
| C09 | Expo root は「版面未着手」だが、子 map/commit に6 HTML + 6 A2 PDF が存在 | `expo/_map.md:15` は child status に合わせる。採択待ちは repo に記録された user state であり、公式サイトから個別採択を再検証できない（`51-expo-and-research-archives.md:46-63`）。 | repository artifact fact と外部状態（採択）を分離。 |
| C10 | reports root/archive は runtime semantics/perf を未決・現行調査として案内するが、accepted runtime contract と `render-performance/` が current owner | `reports/_map.md:31-32`、archive maps は historical index のまま、current owner への導線だけ更新。Cubism research は current implementation oracle ではない。 | historical research / accepted design / current implementation の情報種別差。 |
| C11 | model-authoring parent は「次は closed problem 02」とするが、closed problems 01–19 と craft second-cycle が pass | `model-authoring/_map.md:46-48`、`closed-problems/_map.md:44-58` を child-first 修正。次の scope は user decision。Wave107 real-device vowel gate は別 runtime-player gate。 | historical sequence と current next action の混同。 |
| C12 | root implementation baseline/current work は Wave102/93 で止まるが、post-Editor Wave103–109 と runtime-player evidence は存在 | root `discussion/_map.md:63-64` と implementation parent/index を、historical baseline と current capability/backlog に分ける。Wave107 の orchestration/review index gap も併記。 | user-declared Editor stop、後続 feature tracks、index coverage は別軸。 |

### 衝突ではないが、親 map で境界を明示すべき事項

- Demo map は **Current** だが、Product Preflight 実装済みと rights-clean fixture、最終 disclaimer、UI文言検査の human/legal gate 未完を同一 status にしない（`10-product-baseline.md:45-49,63-67`）。
- Wave106 は dynamics semantics replacement であり render-performance wave ではない。solver complexity から Player/Editor frame-time 改善を推論しない（`42-render-performance-and-dynamics.md:113-123`）。
- model-authoring の 2026-07-03 PNG approval は repository/user decision、commit `45d2734` 後のバイト承認は別 gate（`40-model-authoring.md:56-65`）。
- historical Wave reports の “manual gate pending” と後続 parent map の “closed” は、当時の evidence と後日観測の差である。Wave19 OBS 比較、Wave108/109 export→player、Wave107→22/23 vowel semantics を特に注記する。

## 3. Root-map input table

これは最終 root map の文案ではなく、子 map の correction 後に root が採用すべき短い入力である。`authoritative` はその topic の current owner、`root status` は現 root entry を無条件に信頼できるかを示す。

| Top-level topic | authoritative current status | root/top-level entry status | real unresolved gates | root-map input |
|---|---|---|---|---|
| Product / AC / scenarios | 4-track/private MVP、Demo/Proposal boundary は current。要求 oracle は modified concept + Root/MVP AC。Dynamics semantics は design/Wave106 が owner。 | **Partially stale**: `discussion/_map.md:31-34` は broad policy は有効だが、AC/scenario child maps の implementation-next と旧 Dynamics detail を反映しない。 | v3 semantics を Domain-09/AC/scenario にいつ反映するか、rights-clean demo fixture/disclaimer/UI wording、最初の proposal feature/submit target。 | 「Product scope/current AC」と「implementation semantics」を二層でリンクし、旧 one-output/scalar を current summary に残さない。 |
| Design / conventions | Dynamics v3, WebGL2 primary + Canvas2D fallback, v6d/v7 mesh, Skyline atlas, Option E, CanvasEvaluatedScene は implemented/accepted。full pixel/UX surface は未完。 | **Stale/partially stale**: `design/_map.md` と screen/texture/module maps は old next/old contract を含む。 | real GPU/pixel proof、Canvas2D sunset、full Diagnostics/Evidence/Codex UI、v7 toggle policy、design-doc rewrite ownership。 | Root design は accepted current contracts と open visual/product decisions のみを要約し、Wave-era plans を historical child に委譲。 |
| Model-authoring | authoring-host hand/retina/eye/tape/health-check は implemented; closed problems/second cycle pass。 | **Partially stale**: parent next action/PNG identity wording が古い。 | post-45d PNG re-certification、Wave107→22/23 real-device vowel gate、97 strict-ref errors/sidecar portability、次 closed-problem scope。 | 「equipment complete、human/device gates pending」とし、closed problem 02 を次 action としない。 |
| Mesh / rendering | v6d adaptive is default, v7 is comparison toggle; round-2 quality verdict is hold; Wave67/108/109 rendering contracts implemented. | **Partially stale**: root `:41,69` broad hold は有効だが implementation/design child status/UV/WebGL next wording は stale。 | v6 deletion/Wave2 quality decision、formal Wave108 gate policy、GPU pixel parity/Canvas2D sunset、original inset recheck。 | mesh quality hold と rendering contract completion を別 row/links で表す。 |
| Render-performance / dynamics | Editor Perf Wave2 accepted close; Player Waves13–19 diagnostics/fast path/cadence complete; dynamics v3 is semantic replacement only. | **Partially stale**: root `:42,70,84` / render-performance map still says Player hold/deep profiling. | C7 two-instance hardware capture optional, real-model-003 only on regression/request, no product deep-profile re-exposure. | latest OBS/Chrome observation + optional reopen condition; do not advertise 60fps or dynamics performance claim. |
| Electron migration | WS1–WS4 and electron-builder build implemented; migration feature complete. | **Partially stale at root, Current topic parent**: root `:43,71,86` retains pre-WS1/packaging next. | stale PSD E2E workspace precondition, 21 typecheck / 4 unit failures, portable dead UI branch, metadata warning. | “migration complete; E2E/typecheck/unit debt remains” and packaging as completed capability, not next phase. |
| AI cohost / apps/soul | C1–C7 closed; S1–S8 code present; D4/D6 decisions current, D7 out; apps/soul exception permits LLM/perception. | **Stale at root and ai-cohost parent**: root `:44,73,87` says S-series premises/access unresolved. | S8 kill human gate, brain-swap final gate, stream-memory four-point gate, persona/S9 voice, provider/price monitoring. | child maps must first index S8/brain/reading/memory; root says “器 complete; remaining human gates” and “特区外禁止.” |
| Expo / reports archives | Expo 6 HTML + 6 A2 PDF complete; acceptance external/unverified. Reports/Cubism maps are historical archives; current perf/runtime owners are separate. | **Partially stale**: root `:45-46` says layout unstarted and reports entry lacks current-owner separation. | acceptance notification and post-acceptance proof print; legal/scope review before any Cubism inspector restart. | keep archive links and explicit historical label; do not use archive next actions as current implementation plan. |

## 4. Prioritized child-before-parent correction batches

監査契約の統合順序（子 map → 親 map）に従う。各 batch の parent は、列挙した child correction が合意された後にのみ更新対象とする。

### P0 — Dynamics contract and source-of-truth boundary

1. Child: `acceptance-criteria/02_DomainAcceptanceCriteria/209_...`, `scenarios/02_DomainAcceptanceCriteria/209_...`, `design/module-contracts/*`, `design/mvp-authoring-runtime/*`, and the dynamics v3 design index. Add explicit supersession and link Wave106/current runtime evidence.
2. Parent: `acceptance-criteria/_map.md`, `scenarios/_map.md`, `design/_map.md`, then root `discussion/_map.md:32-34`.
3. Do not rewrite the product requirement until the user decides the v3 traceability wording/cardinality. This batch is documentation/source ownership, not a new solver implementation.

### P1 — Mesh/rendering implementation status

1. Child: `mesh-generation/implementation/_map.md`, `mesh-generation/_map.md`, `design/mesh-generation/_map.md`, `design/mesh-rendering/_map.md`, `design/texture-atlas/_map.md`, and `design/screen-design/screens/_map.md`.
2. Parent: `design/_map.md`, root `mesh-generation`/`render-performance` entries. Preserve v6/v7 hold separately from Option E/WebGL/Skyline completion.
3. Keep unresolved visual/pixel gates explicit; do not infer a v7 quality win from automated tests.

### P1 — Current implementation/index coverage

1. Child: add/index Wave107 research/review coverage, repair missing Wave107 orchestration/review parent links, and reconcile implementation maps that stop at Wave93/102 with post-Editor Wave103–109 evidence. `01-mechanical-inventory.md:296-310` identifies the structural queue; `40-model-authoring.md:80-94` identifies Wave107 gaps.
2. Parent: `implementation/_map.md`, `implementation/orchestration/_map.md`, then root implementation baseline/current-work rows. Keep the user-declared Wave102 stop as a historical/product decision if still intended; do not let it hide later bounded tracks.

### P2 — Runtime-performance boundary

1. Child: `render-performance/_map.md`, Runtime Player implementation parent and Wave19 wording, and C7 closure record cross-link.
2. Parent: root `render-performance` row and root next action. Mark OBS/Chrome comparison as manual observation, C7 two-instance strain as optional unmeasured experiment, and deep profiling as developer/test-only.

### P2 — Electron migration residuals

1. Child: `editor-electron-migration/shell/_map.md`, `persistence/_map.md`, `cleanup/_map.md`, `packaging/_map.md`; distinguish pass from stale E2E/typecheck/unit and metadata warnings.
2. Parent: `editor-electron-migration/_map.md` (already broadly Current), then root `:43,71,86`.

### P2 — AI cohost / apps/soul progression

1. Child: `ai-cohost/implementation/orchestration/_map.md`, `implementation/screens/_map.md`, `soul/_map.md`, `concept/_map.md`; index S8, brain-swap, reading/interjection, stream-memory, and apps/soul exception.
2. Parent: `ai-cohost/implementation/_map.md`, `ai-cohost/_map.md`, then root `:44,73,87`.
3. Keep S8 kill, brain-swap, and stream-memory as independent human gates; implementation presence is not gate completion.

### P3 — Model-authoring and Expo/archive hygiene

1. Child: model-authoring `closed-problems/_map.md` and `craft/_map.md`; Expo child/poster design; reports archive maps with current-owner links.
2. Parent: `model-authoring/_map.md`, `expo/_map.md`, `reports/_map.md`, then root rows `:40,45-46`.
3. External acceptance, PNG re-certification, and legal/scope decisions remain user-owned; no map update can infer them.

## 5. Real unresolved gates and user decisions

The following are genuine open gates; stale “next” prose must not be used to create additional work in their place.

- **Dynamics:** user decision on how/when v3 semantics and cardinality are reflected in Domain-09 AC/scenario; implementation pass itself is not open.
- **Mesh/render:** v6 deletion/Wave2 quality criterion, toggle lifetime, formal Wave108 gate policy, real GPU/pixel proof, Canvas2D sunset, and any current `original` inset residual.
- **Performance:** optional C7 two-instance hardware measurement; real-model-003 only if behavior regresses or numeric gate is explicitly requested. No current authorization for product deep-profiler transport.
- **Electron:** workspace precondition in PSD E2E, independent typecheck/unit debt, portable dead-branch cleanup, packaging metadata warning.
- **AI:** S8 kill/restore gate, brain-swap rollout/long-run gate, stream-memory four-point gate, persona/S9 voice decision, ongoing provider/price review.
- **Model-authoring:** post-`45d2734` PNG byte approval, Wave107→22/23 real-device vowel gate, strict-ref/sidecar portability, next closed-problem scope.
- **Expo/research:** individual acceptance notification, post-acceptance proof print, and permission/legal review before any archived Cubism experiment is resumed.
- **Product/demo/proposal:** rights-clean fixture, final disclaimer/UI wording checks, first proposal feature/submission target.

## 6. Verification limits

- This is an integration of existing reports, not a fresh full-suite or human-gate run. Focused pass counts and manual observations retain the evidence basis recorded by each domain report.
- Official Expo pages were checked only for event-level facts; individual acceptance status is not public. Anthropic/OpenAI/YouTube terms and pricing were not re-verified here.
- Mechanical orphan/broken-link findings are queues, not semantic verdicts. Archive maps remain intentionally historical even when they contain old next actions.
- Final updates to `discussion/_map.md` and all existing maps require user agreement and must follow the child-before-parent batches above.
