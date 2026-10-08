# Mechanical inventory: baseline discussion maps

> Audit HEAD: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` (2026-08-08 Asia/Tokyo). This is mechanical triage only; semantic freshness judgments remain with the domain/integration reports.

## Scope and commands

The baseline file set was read from the pinned commit, not from the mutable worktree. Audit-generated `discussion/reports/map-freshness-audit/**` content and the audit registration line in `discussion/reports/_map.md` were excluded by using `git ls-tree` at the pinned commit. URL-encoded relative links were percent-decoded before resolution; links to a child directory count as registration when that directory contains `_map.md`.

Commands (read-only):

```powershell
git -c core.quotePath=false ls-tree -r --name-only 3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c -- discussion
git cat-file blob 3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c:<path>
```

The scan used a Markdown inline-link regex, repository path existence checks, direct-parent child-map checks, and a map-link graph rooted at `discussion/_map.md`. Status phrase checks are lexical triage: `Current/現在`, `Next/次`, `Pending/保留/未決/未着手`, `Status/状態`, and `Unresolved/未決`.

## Counts

| Check | Result |
|---|---:|
| Baseline `_map.md` files checked | **281** |
| Previously observed baseline | 281 |
| Deviation | **0** |
| Current worktree count (includes audit child map) | 282 |
| Markdown links scanned | 3480 |
| Broken relative links | **22** |
| Direct parent/child map pairs | 58 |
| Missing child-map registrations | **1** |
| Map-link edges (directory links normalized to child map) | 326 |
| Reachable maps from root | 236 |
| Orphan candidates (no root graph path) | **45** |
| Duplicate exact heading names | **0** |
| Maps with >3 status-like headings | 13 |
| Lexical positive+negative status candidates | **98 lines** |
| Maps with any status-like phrase (overlapping categories) | 269 (1035 lines) |

Status-token line totals (categories overlap): Current/現在 246; Next/次 103; Pending/保留/未決/未着手 132; Status/状態 515; Unresolved/未決 76.

## Role and provisional mechanical judgement

The following lists are the complete 281-path inventory. The role is inferred from path/content structure. The provisional judgement is deliberately mechanical: historical evidence maps are treated as `Intentionally historical` candidates; living maps without a listed defect are `Current candidate`; maps appearing in a defect list are `Partially stale candidate` pending semantic review.

### historical-evidence-index — Intentionally historical candidate (230)

Wave implementation/review maps and report evidence indexes. A broken link, orphan, or status candidate below still needs semantic review; later work alone is not treated as stale.

```text
discussion/implementation/reviews/wave0/_map.md
discussion/implementation/reviews/wave1/_map.md
discussion/implementation/reviews/wave10/_map.md
discussion/implementation/reviews/wave100/_map.md
discussion/implementation/reviews/wave101/_map.md
discussion/implementation/reviews/wave102/_map.md
discussion/implementation/reviews/wave103/_map.md
discussion/implementation/reviews/wave104/_map.md
discussion/implementation/reviews/wave105/_map.md
discussion/implementation/reviews/wave106/_map.md
discussion/implementation/reviews/wave108/_map.md
discussion/implementation/reviews/wave11/_map.md
discussion/implementation/reviews/wave12/_map.md
discussion/implementation/reviews/wave13/_map.md
discussion/implementation/reviews/wave14/_map.md
discussion/implementation/reviews/wave15/_map.md
discussion/implementation/reviews/wave17/_map.md
discussion/implementation/reviews/wave18/_map.md
discussion/implementation/reviews/wave19/_map.md
discussion/implementation/reviews/wave2/_map.md
discussion/implementation/reviews/wave20/_map.md
discussion/implementation/reviews/wave21/_map.md
discussion/implementation/reviews/wave23/_map.md
discussion/implementation/reviews/wave24/_map.md
discussion/implementation/reviews/wave25/_map.md
discussion/implementation/reviews/wave26/_map.md
discussion/implementation/reviews/wave27/_map.md
discussion/implementation/reviews/wave28/_map.md
discussion/implementation/reviews/wave29/_map.md
discussion/implementation/reviews/wave3/_map.md
discussion/implementation/reviews/wave30/_map.md
discussion/implementation/reviews/wave31/_map.md
discussion/implementation/reviews/wave32/_map.md
discussion/implementation/reviews/wave33/_map.md
discussion/implementation/reviews/wave34/_map.md
discussion/implementation/reviews/wave35/_map.md
discussion/implementation/reviews/wave36/_map.md
discussion/implementation/reviews/wave37/_map.md
discussion/implementation/reviews/wave38/_map.md
discussion/implementation/reviews/wave39/_map.md
discussion/implementation/reviews/wave4/_map.md
discussion/implementation/reviews/wave40/_map.md
discussion/implementation/reviews/wave41/_map.md
discussion/implementation/reviews/wave42/_map.md
discussion/implementation/reviews/wave5/_map.md
discussion/implementation/reviews/wave6/_map.md
discussion/implementation/reviews/wave60/_map.md
discussion/implementation/reviews/wave61/_map.md
discussion/implementation/reviews/wave62/_map.md
discussion/implementation/reviews/wave63/_map.md
discussion/implementation/reviews/wave64/_map.md
discussion/implementation/reviews/wave65/_map.md
discussion/implementation/reviews/wave66/_map.md
discussion/implementation/reviews/wave67/_map.md
discussion/implementation/reviews/wave68/_map.md
discussion/implementation/reviews/wave69/_map.md
discussion/implementation/reviews/wave7/_map.md
discussion/implementation/reviews/wave70/_map.md
discussion/implementation/reviews/wave71/_map.md
discussion/implementation/reviews/wave72/_map.md
discussion/implementation/reviews/wave73/_map.md
discussion/implementation/reviews/wave74/_map.md
discussion/implementation/reviews/wave75/_map.md
discussion/implementation/reviews/wave76/_map.md
discussion/implementation/reviews/wave77/_map.md
discussion/implementation/reviews/wave78/_map.md
discussion/implementation/reviews/wave79/_map.md
discussion/implementation/reviews/wave8/_map.md
discussion/implementation/reviews/wave80/_map.md
discussion/implementation/reviews/wave81/_map.md
discussion/implementation/reviews/wave82/_map.md
discussion/implementation/reviews/wave83/_map.md
discussion/implementation/reviews/wave84/_map.md
discussion/implementation/reviews/wave85/_map.md
discussion/implementation/reviews/wave86/_map.md
discussion/implementation/reviews/wave87/_map.md
discussion/implementation/reviews/wave88/_map.md
discussion/implementation/reviews/wave89/_map.md
discussion/implementation/reviews/wave9/_map.md
discussion/implementation/reviews/wave90/_map.md
discussion/implementation/reviews/wave91/_map.md
discussion/implementation/reviews/wave92/_map.md
discussion/implementation/reviews/wave93/_map.md
discussion/implementation/reviews/wave94/_map.md
discussion/implementation/reviews/wave95/_map.md
discussion/implementation/reviews/wave96/_map.md
discussion/implementation/reviews/wave97/_map.md
discussion/implementation/reviews/wave98/_map.md
discussion/implementation/reviews/wave99/_map.md
discussion/implementation/waves/wave0/_map.md
discussion/implementation/waves/wave1/_map.md
discussion/implementation/waves/wave10/_map.md
discussion/implementation/waves/wave100/_map.md
discussion/implementation/waves/wave101/_map.md
discussion/implementation/waves/wave102/_map.md
discussion/implementation/waves/wave103/_map.md
discussion/implementation/waves/wave104/_map.md
discussion/implementation/waves/wave105/_map.md
discussion/implementation/waves/wave106/_map.md
discussion/implementation/waves/wave107/_map.md
discussion/implementation/waves/wave108/_map.md
discussion/implementation/waves/wave11/_map.md
discussion/implementation/waves/wave12/_map.md
discussion/implementation/waves/wave13/_map.md
discussion/implementation/waves/wave14/_map.md
discussion/implementation/waves/wave15/_map.md
discussion/implementation/waves/wave17/_map.md
discussion/implementation/waves/wave18/_map.md
discussion/implementation/waves/wave19/_map.md
discussion/implementation/waves/wave2/_map.md
discussion/implementation/waves/wave20/_map.md
discussion/implementation/waves/wave21/_map.md
discussion/implementation/waves/wave22/_map.md
discussion/implementation/waves/wave23/_map.md
discussion/implementation/waves/wave24/_map.md
discussion/implementation/waves/wave25/_map.md
discussion/implementation/waves/wave26/_map.md
discussion/implementation/waves/wave27/_map.md
discussion/implementation/waves/wave28/_map.md
discussion/implementation/waves/wave29/_map.md
discussion/implementation/waves/wave3/_map.md
discussion/implementation/waves/wave30/_map.md
discussion/implementation/waves/wave31/_map.md
discussion/implementation/waves/wave32/_map.md
discussion/implementation/waves/wave33/_map.md
discussion/implementation/waves/wave34/_map.md
discussion/implementation/waves/wave35/_map.md
discussion/implementation/waves/wave36/_map.md
discussion/implementation/waves/wave37/_map.md
discussion/implementation/waves/wave38/_map.md
discussion/implementation/waves/wave39/_map.md
discussion/implementation/waves/wave4/_map.md
discussion/implementation/waves/wave40/_map.md
discussion/implementation/waves/wave41/_map.md
discussion/implementation/waves/wave5/_map.md
discussion/implementation/waves/wave59/_map.md
discussion/implementation/waves/wave6/_map.md
discussion/implementation/waves/wave60/_map.md
discussion/implementation/waves/wave61/_map.md
discussion/implementation/waves/wave62/_map.md
discussion/implementation/waves/wave63/_map.md
discussion/implementation/waves/wave64/_map.md
discussion/implementation/waves/wave65/_map.md
discussion/implementation/waves/wave66/_map.md
discussion/implementation/waves/wave67/_map.md
discussion/implementation/waves/wave68/_map.md
discussion/implementation/waves/wave69/_map.md
discussion/implementation/waves/wave7/_map.md
discussion/implementation/waves/wave70/_map.md
discussion/implementation/waves/wave71/_map.md
discussion/implementation/waves/wave72/_map.md
discussion/implementation/waves/wave73/_map.md
discussion/implementation/waves/wave74/_map.md
discussion/implementation/waves/wave75/_map.md
discussion/implementation/waves/wave76/_map.md
discussion/implementation/waves/wave77/_map.md
discussion/implementation/waves/wave78/_map.md
discussion/implementation/waves/wave79/_map.md
discussion/implementation/waves/wave8/_map.md
discussion/implementation/waves/wave80/_map.md
discussion/implementation/waves/wave81/_map.md
discussion/implementation/waves/wave82/_map.md
discussion/implementation/waves/wave83/_map.md
discussion/implementation/waves/wave84/_map.md
discussion/implementation/waves/wave85/_map.md
discussion/implementation/waves/wave86/_map.md
discussion/implementation/waves/wave87/_map.md
discussion/implementation/waves/wave88/_map.md
discussion/implementation/waves/wave89/_map.md
discussion/implementation/waves/wave9/_map.md
discussion/implementation/waves/wave90/_map.md
discussion/implementation/waves/wave91/_map.md
discussion/implementation/waves/wave92/_map.md
discussion/implementation/waves/wave93/_map.md
discussion/implementation/waves/wave94/_map.md
discussion/implementation/waves/wave95/_map.md
discussion/implementation/waves/wave96/_map.md
discussion/implementation/waves/wave97/_map.md
discussion/implementation/waves/wave98/_map.md
discussion/implementation/waves/wave99/_map.md
discussion/reports/cmo3-moc3-format-spec/_map.md
discussion/reports/cubism-sdk-runtime-structure/_map.md
discussion/reports/deformer-structure-technology/_map.md
discussion/reports/editor-render-performance/_map.md
discussion/reports/psd-import-fidelity/_map.md
discussion/reports/rights-risk-cleanup/_map.md
discussion/reports/runtime-evaluation-semantics-reference/_map.md
discussion/reports/viewer-preview-reference/_map.md
discussion/runtime-player/implementation/reviews/wave1/_map.md
discussion/runtime-player/implementation/reviews/wave10/_map.md
discussion/runtime-player/implementation/reviews/wave11/_map.md
discussion/runtime-player/implementation/reviews/wave12/_map.md
discussion/runtime-player/implementation/reviews/wave13/_map.md
discussion/runtime-player/implementation/reviews/wave14/_map.md
discussion/runtime-player/implementation/reviews/wave15/_map.md
discussion/runtime-player/implementation/reviews/wave16/_map.md
discussion/runtime-player/implementation/reviews/wave17/_map.md
discussion/runtime-player/implementation/reviews/wave18/_map.md
discussion/runtime-player/implementation/reviews/wave19/_map.md
discussion/runtime-player/implementation/reviews/wave2/_map.md
discussion/runtime-player/implementation/reviews/wave20/_map.md
discussion/runtime-player/implementation/reviews/wave21/_map.md
discussion/runtime-player/implementation/reviews/wave3/_map.md
discussion/runtime-player/implementation/reviews/wave4/_map.md
discussion/runtime-player/implementation/reviews/wave5/_map.md
discussion/runtime-player/implementation/reviews/wave6/_map.md
discussion/runtime-player/implementation/reviews/wave7/_map.md
discussion/runtime-player/implementation/reviews/wave8/_map.md
discussion/runtime-player/implementation/reviews/wave9/_map.md
discussion/runtime-player/implementation/waves/wave1/_map.md
discussion/runtime-player/implementation/waves/wave10/_map.md
discussion/runtime-player/implementation/waves/wave11/_map.md
discussion/runtime-player/implementation/waves/wave12/_map.md
discussion/runtime-player/implementation/waves/wave13/_map.md
discussion/runtime-player/implementation/waves/wave14/_map.md
discussion/runtime-player/implementation/waves/wave15/_map.md
discussion/runtime-player/implementation/waves/wave16/_map.md
discussion/runtime-player/implementation/waves/wave17/_map.md
discussion/runtime-player/implementation/waves/wave18/_map.md
discussion/runtime-player/implementation/waves/wave19/_map.md
discussion/runtime-player/implementation/waves/wave2/_map.md
discussion/runtime-player/implementation/waves/wave20/_map.md
discussion/runtime-player/implementation/waves/wave21/_map.md
discussion/runtime-player/implementation/waves/wave3/_map.md
discussion/runtime-player/implementation/waves/wave4/_map.md
discussion/runtime-player/implementation/waves/wave5/_map.md
discussion/runtime-player/implementation/waves/wave6/_map.md
discussion/runtime-player/implementation/waves/wave7/_map.md
discussion/runtime-player/implementation/waves/wave8/_map.md
discussion/runtime-player/implementation/waves/wave9/_map.md
```

### living-current-state — Current candidate (28)

Maps with explicit current/next/unresolved sections. Entries in the issue sections below are Partially stale candidates until domain evidence is checked.

```text
discussion/_map.md
discussion/acceptance-criteria/02_DomainAcceptanceCriteria/_map.md
discussion/acceptance-criteria/_map.md
discussion/ai-cohost/architecture/_map.md
discussion/ai-cohost/concept/_map.md
discussion/ai-cohost/implementation/_map.md
discussion/concept/_map.md
discussion/demo/_map.md
discussion/design/_map.md
discussion/design/module-contracts/_map.md
discussion/design/mvp-authoring-runtime/_map.md
discussion/design/screen-design/_map.md
discussion/design/texture-atlas/_map.md
discussion/development_convention/_map.md
discussion/editor-electron-migration/_map.md
discussion/editor-electron-migration/packaging/_map.md
discussion/expo/_map.md
discussion/expo/genai-expo-2026/_map.md
discussion/implementation/_map.md
discussion/mesh-generation/_map.md
discussion/mesh-generation/implementation/_map.md
discussion/model-authoring/_map.md
discussion/model-authoring/closed-problems/_map.md
discussion/proposal/_map.md
discussion/render-performance/_map.md
discussion/reports/_map.md
discussion/scenarios/02_DomainAcceptanceCriteria/_map.md
discussion/scenarios/_map.md
```

### living-index — Current candidate (23)

Directory/child-artifact indexes without the current-state heading signature. Entries in the issue sections below are Partially stale candidates until domain evidence is checked.

```text
discussion/ai-cohost/_map.md
discussion/ai-cohost/implementation/orchestration/_map.md
discussion/ai-cohost/implementation/screens/_map.md
discussion/ai-cohost/premises/_map.md
discussion/ai-cohost/research/_map.md
discussion/ai-cohost/soul/_map.md
discussion/design/canvas-evaluation/_map.md
discussion/design/mesh-generation/_map.md
discussion/design/mesh-rendering/_map.md
discussion/design/screen-design/components/_map.md
discussion/design/screen-design/screens/_map.md
discussion/editor-electron-migration/cleanup/_map.md
discussion/editor-electron-migration/persistence/_map.md
discussion/editor-electron-migration/shell/_map.md
discussion/implementation/orchestration/_map.md
discussion/model-authoring/craft/_map.md
discussion/runtime-player/_map.md
discussion/runtime-player/architecture/_map.md
discussion/runtime-player/backlog/_map.md
discussion/runtime-player/implementation/_map.md
discussion/runtime-player/implementation/orchestration/_map.md
discussion/runtime-player/research/_map.md
discussion/runtime-player/screens/_map.md
```


## Broken relative links (22)

Each line is `map:file-line [raw target] -> normalized target`:

```text
discussion/design/screen-design/_map.md:21 [inventories/_map.md] -> discussion/design/screen-design/inventories/_map.md
discussion/implementation/_map.md:59 [orchestration/wave54-plan.md] -> discussion/implementation/orchestration/wave54-plan.md
discussion/implementation/_map.md:59 [waves/wave54/wave54-final-integration-report.md] -> discussion/implementation/waves/wave54/wave54-final-integration-report.md
discussion/implementation/_map.md:59 [reviews/wave54/wave54-final-integration-review.md] -> discussion/implementation/reviews/wave54/wave54-final-integration-review.md
discussion/implementation/_map.md:60 [waves/wave53/wave53-final-integration-report.md] -> discussion/implementation/waves/wave53/wave53-final-integration-report.md
discussion/implementation/_map.md:60 [reviews/wave53/wave53-final-integration-review.md] -> discussion/implementation/reviews/wave53/wave53-final-integration-review.md
discussion/implementation/_map.md:61 [waves/wave52/wave52-final-integration-report.md] -> discussion/implementation/waves/wave52/wave52-final-integration-report.md
discussion/implementation/_map.md:61 [reviews/wave52/wave52-final-integration-review.md] -> discussion/implementation/reviews/wave52/wave52-final-integration-review.md
discussion/implementation/_map.md:133 [orchestration/wave55-plan.md] -> discussion/implementation/orchestration/wave55-plan.md
discussion/implementation/_map.md:134 [orchestration/wave54-plan.md] -> discussion/implementation/orchestration/wave54-plan.md
discussion/implementation/_map.md:135 [orchestration/wave53-plan.md] -> discussion/implementation/orchestration/wave53-plan.md
discussion/implementation/_map.md:136 [orchestration/wave52-plan.md] -> discussion/implementation/orchestration/wave52-plan.md
discussion/implementation/_map.md:145 [orchestration/wave51-plan.md] -> discussion/implementation/orchestration/wave51-plan.md
discussion/implementation/_map.md:147 [waves/wave51/wave51-final-integration-report.md] -> discussion/implementation/waves/wave51/wave51-final-integration-report.md
discussion/implementation/_map.md:149 [reviews/wave51/wave51-final-integration-review.md] -> discussion/implementation/reviews/wave51/wave51-final-integration-review.md
discussion/implementation/orchestration/_map.md:60 [wave51-plan.md] -> discussion/implementation/orchestration/wave51-plan.md
discussion/implementation/orchestration/_map.md:60 [../reviews/wave51/wave51-final-integration-review.md] -> discussion/implementation/reviews/wave51/wave51-final-integration-review.md
discussion/implementation/orchestration/_map.md:61 [wave52-plan.md] -> discussion/implementation/orchestration/wave52-plan.md
discussion/implementation/orchestration/_map.md:62 [wave53-plan.md] -> discussion/implementation/orchestration/wave53-plan.md
discussion/implementation/orchestration/_map.md:63 [wave54-plan.md] -> discussion/implementation/orchestration/wave54-plan.md
discussion/implementation/orchestration/_map.md:64 [wave55-plan.md] -> discussion/implementation/orchestration/wave55-plan.md
discussion/implementation/orchestration/_map.md:204 [../reviews/wave51/wave51-final-integration-review.md] -> discussion/implementation/reviews/wave51/wave51-final-integration-review.md
```

The 22 candidates are concentrated in `design/screen-design/_map.md` (one missing `inventories/_map.md`) and the implementation map/orchestration map references to absent Wave 51–55 artifacts. They are repository/path facts, not a semantic assertion that the historical wave should be recreated.

## Child-map registration and orphan candidates

Direct-parent registration found **1 missing** entry:

```text
discussion/implementation/_map.md -> discussion/implementation/orchestration/_map.md
```

The root and topic parents commonly register a child by linking its directory (for example `[design/](design/)`), which is accepted by this check. The sole candidate is `discussion/implementation/_map.md -> discussion/implementation/orchestration/_map.md`.

The normalized map-link graph has 326 edges; 236 maps are reachable from `discussion/_map.md`. The following **45** maps have no graph path (orphan candidates, not semantic orphan judgments):

```text
discussion/implementation/reviews/wave0/_map.md
discussion/implementation/reviews/wave100/_map.md
discussion/implementation/reviews/wave101/_map.md
discussion/implementation/reviews/wave102/_map.md
discussion/implementation/reviews/wave106/_map.md
discussion/implementation/reviews/wave66/_map.md
discussion/implementation/reviews/wave68/_map.md
discussion/implementation/reviews/wave69/_map.md
discussion/implementation/reviews/wave70/_map.md
discussion/implementation/reviews/wave89/_map.md
discussion/implementation/reviews/wave90/_map.md
discussion/implementation/reviews/wave91/_map.md
discussion/implementation/reviews/wave92/_map.md
discussion/implementation/reviews/wave94/_map.md
discussion/implementation/reviews/wave95/_map.md
discussion/implementation/reviews/wave96/_map.md
discussion/implementation/reviews/wave97/_map.md
discussion/implementation/reviews/wave98/_map.md
discussion/implementation/reviews/wave99/_map.md
discussion/implementation/waves/wave0/_map.md
discussion/implementation/waves/wave100/_map.md
discussion/implementation/waves/wave101/_map.md
discussion/implementation/waves/wave102/_map.md
discussion/implementation/waves/wave106/_map.md
discussion/implementation/waves/wave107/_map.md
discussion/implementation/waves/wave59/_map.md
discussion/implementation/waves/wave66/_map.md
discussion/implementation/waves/wave68/_map.md
discussion/implementation/waves/wave70/_map.md
discussion/implementation/waves/wave89/_map.md
discussion/implementation/waves/wave90/_map.md
discussion/implementation/waves/wave91/_map.md
discussion/implementation/waves/wave92/_map.md
discussion/implementation/waves/wave94/_map.md
discussion/implementation/waves/wave95/_map.md
discussion/implementation/waves/wave96/_map.md
discussion/implementation/waves/wave97/_map.md
discussion/implementation/waves/wave98/_map.md
discussion/implementation/waves/wave99/_map.md
discussion/runtime-player/implementation/reviews/wave1/_map.md
discussion/runtime-player/implementation/reviews/wave11/_map.md
discussion/runtime-player/implementation/reviews/wave12/_map.md
discussion/runtime-player/implementation/reviews/wave2/_map.md
discussion/runtime-player/implementation/waves/wave1/_map.md
discussion/runtime-player/implementation/waves/wave2/_map.md
```

## Current/status phrase triage

No exact duplicate Markdown heading names were found across the 281 maps. 13 maps have more than three status-like headings; this is a duplication/maintenance smell, not proof of contradiction:

```text
discussion/implementation/reviews/wave70/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/reviews/wave75/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/reviews/wave76/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/waves/wave70/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/waves/wave71/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/waves/wave72/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/waves/wave73/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/waves/wave74/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/waves/wave75/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/waves/wave76/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/waves/wave77/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/implementation/waves/wave78/_map.md => 4: Status; Current State; Next Actions; Unresolved Questions
discussion/model-authoring/_map.md => 4: 現在の状態サマリ; 次の行動; 決着済みの元・未決事項（2026-07-02 ユーザー決定）; 未決事項
```

Lexical contradiction candidates are lines containing at least one positive completion token and one negative/pending token. This deliberately over-approximates intentional “completed, residual manual gate pending” statements; all **98** lines require semantic review before editing. The long-text excerpt below contains 77 rows; the complete compact file:line queue follows before the handoff:

```text
discussion/_map.md:41 | [mesh-generation/](mesh-generation/) | メッシュ自動生成の商用風改修(v7)の概念設計、現状調査、実装、品質評価、v6系整理 | Wave 1/1.1 実装完了。往復2所見「v6/v7一長一短」により保留中(v6/v7併存・トグル残置) |
discussion/_map.md:42 | [render-performance/](render-performance/) | Editor/Viewer 描画パフォーマンス改善(計測基盤、実測、改善設計、実装、再計測) | Editor側=Perf Wave 2完了・クローズ(2026-07-08)。Player側=player-surveyで一旦保留(同日)。**二体同時起動の体感負荷(2026-07-12、ai-cohost C7)で再開条件成立——要否はユーザー裁定待ち** |
discussion/_map.md:43 | [editor-electron-migration/](editor-electron-migration/) | apps/editor の Web→Electron 移行(why合意、分解、work-stream) | why合意・分解Accepted(2026-07-08)。第一手=WS1(shell)未着手。詳細は下層mapへ委譲 |
discussion/_map.md:69 | Mesh Generation topic | メッシュ自動生成の商用風改修を [mesh-generation/](mesh-generation/) として作成（2026-07-07）。Wave 1(v7実装)・Wave 1.1(境界非クランプ+密度)完了。目視評価 往復2 の所見「v6/v7一長一短」により**保留中**(v6/v7併存・トグル残置・Wave 2棚上げ)。経緯は [mesh-generation/evaluation-log.md](mesh-generation/evaluation-log.md) |
discussion/_map.md:71 | Editor Electron Migration topic | apps/editor の Web→Electron 移行を [editor-electron-migration/](editor-electron-migration/) として作成（2026-07-08）。why合意・分解(3系統コード調査由来)をAccepted。第一手=WS1(shell)、本丸=WS2(persistence node:fs化)。FS Access は Electron Chromium で存続するため移行は非破壊・段階的。portable-JSON は消費者なし(本エディタのみ)のため廃止確定。**WS1〜WS4 完了 = editor Web→Electron 移行の全 work-stream 完了(2026-07-08)**。WS1 殻 / WS2 永続化 node:fs / WS3 Web退役 / WS4 E2E `_electron`。E2E ハーネスは `_electron` 実証、stale テストは `task_2d91b388`。次フェーズ=パッケージング(electron-builder + アイコン)。先在債務 `task_c8fc5155`(editor typecheck/test 赤)は独立処理 |
discussion/_map.md:73 | AI Cohost topic | ユーザー×自律AI(別モデル)の共演配信構想を [ai-cohost/](ai-cohost/) として作成(2026-07-10)。当初MVP全達成(LLM rigging含む、ユーザー宣言 2026-07-10)後の次期構想。同日中に以下をAccepted: 目標像・成功基準(「AIの間も演出」) / **MVP境界改定 案A**(魂=別リポジトリ、器は操縦チャネル+生理層生成器のみ解禁、リポジトリ内LLM・知覚は禁止継続) / 振る舞いモデル(三層+一知覚、梯子、演出エンベロープのパッケージ帰属) / Runtime Player=モデルホスト+案(c)役割つき起動。残る未決はD4/D6/D7・AIの身体の制作者。入口は [ai-cohost/_map.md](ai-cohost/_map.md) |
discussion/ai-cohost/architecture/_map.md:11 | [c2-blink-and-generator-skeleton.md](c2-blink-and-generator-skeleton.md) | C2設計: まばたきゴール、体験=無、生成器は意味スロットで喋る(もう一人の入力ソース)、失敗も沈黙、シード決定論、ツマミ語彙の先行解剖(内部スキーマ/質感語露出/baseline×modulation) | 設計方向=Accepted(2026-07-10)。実装=C2 wave完了・**完全閉鎖(2026-07-11、手動美的ゲート合格)**。§3.3 に実装事実 |
discussion/ai-cohost/implementation/_map.md:35 10. **魂の器官構造化 = 完了(2026-07-12)**: `src/{ears,voice,mind,channel,cockpit,cli,test-support}/` へ51ファイルをgit mv(import書き換え20+深さ補正7)、**231/231無退行**・preflight PASS・lockfile不変。注: 委任先Orch2代が環境異常(子のツール実行が中断される)で停止したため、ユーザー承認の上**L0が直接実施**した例外(記録と環境異常の申し送り: [waves/s2.5/organ-restructure.md](waves/s2.5/organ-restructure.md))。11. **S3「呼べば応える」= 完全閉鎖(2026-07-12)**: 会話ログ(you/soul)・発火オーケストレータ(Fire→直近5分注入→Opus→声+口→soul記録)・操縦席Fire UI+Channel URL入力+AHK同梱。全レーンPASS・284/284緑・**人間ゲート合格(「全く問題なかった」・初の全器官同時稼働・文脈を踏まえた返事)**。原則「全部聞くが、全部では考えない」が実物になった。12. **S4「表情が乗る」= 完全閉鎖(2026-07-13)**: 定義改定=基本顔操作の演出語彙。タグパーサ(TTS直前安全弁の初住人)・演出表6語(宣言表)・翻訳層(語+引数・intensity配管)・sendEnvelope・操縦席の演出行。全レーンPASS・331/331緑・実SDKタグ教示5/5・**人間ゲート合格(「今の動きでも満足」)**。持ち越し: リアクションゲイン調整UI(将来のGUI課題)・眉Issue・四層昇格・GUIスタックS8再評価。**次の一手 = S5「目が開く」(発火時スナップショット=視覚)の議論→context-check**。13. **S5議論+棚卸し+計画 = 完了(2026-07-13)**: 裁定10件(視覚発火=独立の第二発火・蓄積なし=見比べは言語痕跡・「見るだけ」不採用・PrintWindow第一候補=**gdigrab は合成描画が写らない地雷を実機発見**・累積代金は受容+計器ほか)→ [orchestration/s5-planning-inventory.md](orchestration/s5-planning-inventory.md) / [orchestration/s5-wave-plan.md](orchestration/s5-wave-plan.md)(目の器官src/eyes/→視覚発火結線→操縦席+計測、A→B→C)。**次の一手 = S5 wave発進**。14. **S5「目が開く」= 完全閉鎖(2026-07-13)**: 目の器官 `src/eyes/`(PrintWindow+PW_RENDERFULLCONTENT・1プロセス完結・画像ディスク非書き込み)・視覚発火(第二の発火・失敗は正直に中止)・操縦席の対象選択+サムネ+usage計器・Ctrl+Alt+G。全9レーンPASS・411/411緑・**人間ゲート合格(「完璧だ」——実ゲームでタイトル読み上げ・セーブデータ数と章の認知)**。獲得事実: prompt cachingが常駐セッション内で実効(累積コスト懸念緩和)・PrintWindowは実ゲームGPU描画を撮れた。持ち越し: [waves/s5/s5-followup.md](waves/s5/s5-followup.md)(蓄積・ポーリングの梯子ほか)。**次の一手 = S6「会話が続く」の議論→context-check**。15. **S6議論+棚卸し+計画 = 完了(2026-07-13)**: 裁定11件(「いつ喋るか」は機械信号のみ=LLMは「何を言うか」だけ・barge-in=免罪符・発火語彙4種〔手動/呼びかけ「こーでぃー」/区切り=不応期+確率/沈黙=ジッター+予算〕・自発OFFトグル・**魂の声の出力デバイス指定をS6前倒し**〔アームマイクの自己割り込み対策〕・セッション使い捨ては問題駆動でスコープ外)→ [orchestration/s6-planning-inventory.md](orchestration/s6-planning-inventory.md) / [orchestration/s6-wave-plan.md](orchestration/s6-wave-plan.md)(MediaPlayer化A→barge-in B→発火スケジューラC→操縦席+計測D)。獲得事実: WinRT MediaPlayer=依存ゼロでデバイス指定+途中停止の一石二鳥(実機実証)・「こーでぃー」転写揺れ7種採取。**次の一手 = S6 wave発進**。16. **S6「会話が続く」= 閉鎖(2026-07-13)**: MediaPlayer化(停止+デバイス指定)・barge-in(切断点の正直記録)・発火スケジューラ(呼びかけ「こーでぃー」/区切り35%+不応期/沈黙45s帯+予算・LLM-in-timing構造的不在)・自発OFFトグル・追撃E(自発発火に画像同乗・失敗は静かに劣化)。全15レーンPASS・518/518緑・**人間ゲート①②③⑤⑥合格(「4以外は完全に達成」)・④沈黙発火の実機体感のみ持ち越し**(機械実射済み・次ゲート相乗り=s6-followup §13)。持ち越し: 口数のCockpit可変化(モード切替イメージ)。**次の一手 = S7「視聴者が混ざる」の議論→context-check**。17. **S7議論+棚卸し+計画 = 完了(2026-07-14)**: 裁定8件(YouTube一本・壊れる前提=取得死は魂に無影響・**単一タイムライン+viewer(名前)ラベルで合流**〔箱は分けん=コンテキスト管理可能性〕・どのコメントに触れるかはLLMが選ぶ・第5の語彙=到着×不応期+確率+予算・コメント内呼びかけ確実・頻度は口数モード合流・**取得経路=非公式innertube依存ゼロ自前実装**〔ToSグレー開示の上の裁定・公式APIキー差し替えは器官内梯子〕)→ [orchestration/s7-planning-inventory.md](orchestration/s7-planning-inventory.md) / [orchestration/s7-wave-plan.md](orchestration/s7-wave-plan.md)(チャット器官A→合流+発火B→操縦席+docs C)。**次の一手 = S7 wave発進**。18. **S7「視聴者が混ざる」= 実装完了・人間ゲート保留(2026-07-14)**: チャット器官src/chat/(innertube依存ゼロ・壊れる前提の状態機械+自動再接続・importゼロの独立性)・viewer(名前)で正本合流・第5/第6の語彙comment/comment-call・二重発火を2箇所で遮断・操縦席Connect UI。全9レーンPASS+追修正2巡・609/609緑・実ネット不出/SDK消費ゼロ・器コード不変。**YouTube実配信ゲートはユーザー都合で後日**。19. **UI技術スタック改定(S8前の独立閉問題)議論+棚卸し+計画+モック承認 = 完了(2026-07-14)**: 「使い捨てビュー」の前提が設定系の積層で半分崩れた再評価→三層IA(観測/運転/設定)→技術選定(JS+JSDoc・**preact+htm standalone**vendor・手書きダークCSS)→棚卸し(無退行の背骨=server testワイヤ契約・移行は全面書き換え+構造化分割=サードパーティのみバンドル)→**モック承認(「きれー、文句ない」)**。文書: [screens/cockpit-redesign.md](screens/cockpit-redesign.md)(UX+視覚仕様§7)・[orchestration/cockpit-redesign-inventory.md](orchestration/cockpit-redesign-inventory.md)・[orchestration/cockpit-redesign-wave-plan.md](orchestration/cockpit-redesign-wave-plan.md)。**次の一手 = 操縦席改定 wave発進**(→その後S8「配信に耐える」)。20. **操縦席UI改定 = 完全閉鎖(2026-07-14)**: 913行単一HTML→三層IA(観測/運転/設定)のpreact+htm no-build構成。cockpit.html 913→27行・standaloneのみバンドル/うちらのコードはui区画5+view-logic純関数9に構造化(認知負債として積み上がらない形=ユーザー要望)。全4ドメイン・全12レビューレーンPASS+W4追撃(mutation実証)・679/679緑・**人間ゲート合格**(ユーザーが新UI実起動して観測・ゲート中の2件は誤報・fire行`?`は回帰でないと調査確定=followup §0)。器/契約/実行時依存/lockfile完全不変・ビルド段ゼロ・新規npm依存ゼロ。無退行の背骨=server test 74/74をwave全体で維持・旧実装との機械照合(B53/C113入力ALL MATCH)。**次の一手 = 「口数モード実配線」+「コーディ語彙登録」の2小タスク(1wave・別ドメインA/B)→その後S8**。21. **口数配線+コーディ語彙 議論+棚卸し+計画 = 完了(2026-07-14)**: 口数=非発火率レンズで3モード確定(控えめ0.15≈6.7回に1回/ふつう0.35=現行≈2.9回/おしゃべり0.7≈1.4回・連続無視4回0.81%)・実行時setVerbosity(const→let+setEnabled隣)・コメント値はYouTube保留でuntested配線。コーディ=whisper v1.9.1のprompt form field(inference:100に1行・リクエスト毎)+スイープ計測(正答率と幻聴混入率)で詰める。文書: [orchestration/verbosity-vocab-inventory.md](orchestration/verbosity-vocab-inventory.md) / [orchestration/verbosity-vocab-wave-plan.md](orchestration/verbosity-vocab-wave-plan.md)。**次の一手 = wave発進(A=口数/B=コーディ)**。22. **口数配線+コーディ語彙 = 完全閉鎖(2026-07-14)**: A=口数モード(控えめ/ふつう/おしゃべりが自発頻度を実切替・永続)・B=コーディ語彙(whisper prompt注入)。724/724緑・全6レーンPASS・器/依存/lockfile不変・**人間ゲート合格**(「おしゃべりは非常に心地よい応答率」「コーディがはっきり拾われる・うまくできている」)。**在席プロトコル(規則1のPowerShell在席ループ)を委任に明示した初waveで全工程1ターン完走=L0中継ゼロ**(従来のOrch手ぶらターン→L0中継の悪癖を是正)。残る計器: コーディ幻聴混入率スイープ(bench-name-prompt.mjs)未実走=監視項目。**次の一手 = S8「配信に耐える」の議論**(積み残し: S7 YouTube実ゲート・コメント反応の口数体感・長回し計測 も S8圏内で回収候補)。23. **S7実ゲート合格+追撃+自己名+持ち越し簿の棚卸し = 完了(2026-07-14〜16)**: (a)S7追撃=実配信URL `/live/<id>` が extractFailed→normalizeSourceに `/live/<id>`+`/@handle/live` 追加(728/728緑・dcf84cc)。**Orch異常あり**=Orchがツール結果を捏造した告白を返しレビュー段が欠落→L0が全diff精読+独立テスト実行で代替裏取りの上コミット([waves/s7/followup-live-url.md](waves/s7/followup-live-url.md) §7=鉄の規律「子の完了主張は成果物Readと数字の独立再実行で裏取り」が機能した実例)。(b)**実配信30分ノーブレイク**=会話破綻なし・コメント読み上げ・視聴者名認識(**S7 YouTube実ゲート実質合格**+S6④沈黙発火の実機体感も回収)。(c)自己名=FIRE_SYSTEM_PROMPT先頭に「あなたの名前はコーディ(Cody)です。」一行(729/729緑・bbd78c7)。persona大課題から降格+配信間記憶は自然な拡張と評価の上一旦保留(e7ff5df・[s-series-decomposition.md](s-series-decomposition.md))。(d)**監視項目の棚卸し(2026-07-16ユーザー裁定)=4件全て監視解除**: 幻聴スイープ=問題が起きそうにない(bench-name-prompt.mjsは未実走のまま残置・発症時のみ)・沈黙予算枯渇=ユーザーが主に話す運用で実害なし・**長回し計測=30分実配信で5h limitが1%未満=事実上ほぼタダ(常設計器/usageに初の実配信実数)**・`/@handle/live`実疎通=実運用は/live/<id>一本で実証済み+予備入口の失敗は接続時に即時可視(followup-live-url.md §5)。**持ち越し簿は空。残る本線 = S8「配信に耐える」のみ**(実体は安全弁: TTS直前最終検査・NGワード・キルスイッチ・AI開示——リハ部分は30分実配信で先取り済み)。24. **S8実装+多頭化+朗読と合いの手(2026-07-16〜19)**: (a)S8安全弁実装完了=キルスイッチ(fire()一点ガード+severSpeaking流用+Ctrl+Alt+K)・NG最小検査(TTS直前・丸ごと没)・開示文言+チェックリスト([../operations/pre-stream-checklist.md](../operations/pre-stream-checklist.md))。827/827緑・全9レーンPASS(f9c5f34)。**人間ゲート(キル実射)はユーザー保留のまま未実施**。(b)**多頭化=完全実装+運用裁定**([../soul/brain-swap.md](../soul/brain-swap.md)): 知性契約+4頭(Claude Opus/Terra/5.5/Sol)・(a')=SDK+スレッド継続+配信後rollout掃除(sidecar台帳の完全一致削除のみ)・スパイク実測(Terra速度動機は否定寄り・素チャット15/15満点)・体感序列**Opus>Sol≒5.5>Terra**→常用Opus・Sol控え。製品原則「**記憶は一級資産**」昇格・長回し対策候補B=SDK圧縮を台帳化(着手未)。Orch裁量3件是認・レビュー数字訂正で裏取り機構がL1内で機能。(c)**「朗読と合いの手」=完全閉鎖**([orchestration/reading-interjection-wave-plan.md](orchestration/reading-interjection-wave-plan.md)): 区切り発火の転写到着ゲート化(5bf3cfd)→barge-inトグル+猶予2000ms二段構え+第7語彙interjection(887/887緑・307a923+5f883b7)。**人間ゲート合格=1時間40分実配信で破綻なし・4点全クリア**。在席プロトコル3波連続1ターン完走。**次の一手 = S8人間ゲート(キル実射)or 次の閉問題の議論**(候補: 長回し対策〔リサイクル棚落ち・圧縮本命〕・配信間記憶〔保留中・記憶原則の追い風あり〕)。
discussion/ai-cohost/implementation/orchestration/_map.md:30 | [s5-wave-plan.md](s5-wave-plan.md) | **完全閉鎖(2026-07-13)**: 全9レーンPASS・411/411緑・実SDK5askで画面言及+cache実測・人間ゲート合格(「完璧だ」・実ゲームでタイトル読み上げ+セーブデータ認知・PrintWindow地雷は不発) | S5「目が開く」wave計画: 目の器官src/eyes/(PrintWindowキャプチャ1プロセス完結・ディスク非書き込み・列挙)(A)→視覚発火結線(ask画像ブロック・失敗は発火中止+ゴースト行・usage計器)(B)→操縦席(対象選択UI・サムネ行・usage表示)+AHK第二キー+実SDK確認+計測+docs(C)。獲得事実: prompt cachingが常駐セッション内で実効=累積コスト懸念緩和 |
discussion/ai-cohost/implementation/orchestration/_map.md:34 | [s6-wave-plan.md](s6-wave-plan.md) | **閉鎖(2026-07-13)**: 本編A〜D+追撃E(自発発火に画像同乗)全15レーンPASS・518/518緑・人間ゲート①②③⑤⑥合格(「4以外は完全に達成」)・**④沈黙発火の実機体感のみ持ち越し**(機械実射済み・次ゲート相乗り) | S6「会話が続く」wave計画: 声の器官刷新=MediaPlayer化(停止+デバイス指定+再生実区間)(A)→barge-in(中断口・口閉じset・切断点正直記録・機械弁)(B)→発火スケジューラ(純ロジック・呼びかけ/区切り/沈黙・LLM-in-timing構造的不在)(C)→操縦席(トグル・デバイス選択UI)+実SDK+計測+docs(D)→追撃E(call/turn-end=vision:preferred・失敗は静かに劣化)。持ち越し台帳: 口数のCockpit可変化(モード切替)ほか([../waves/s6/s6-followup.md](../waves/s6/s6-followup.md)) |
discussion/ai-cohost/implementation/orchestration/_map.md:37 | [verbosity-vocab-wave-plan.md](verbosity-vocab-wave-plan.md) | **完全閉鎖(2026-07-14)**: 724/724緑・全6レーンPASS・器/依存/lockfile不変・人間ゲート合格(おしゃべり=心地よい応答率/コーディはっきり拾われる)。**在席プロトコル修正の初適用waveで全工程1ターン完走=L0中継ゼロ** | 口数モード実配線(A: setVerbosity+定数束3モード×9値+POST /api/verbosity+永続+運転バーcontrolled化・コメント値はYouTube保留untested)+コーディ語彙登録(B: whisper prompt 1行=正本不変+スイープ計測script)。残る計器: 幻聴混入率スイープ未実走(監視=誤呼びかけが出たら回す) |
discussion/ai-cohost/soul/_map.md:37 | ③ persona の中身 | 未着手(S8完了後に着手と決定 2026-07-12) |
discussion/design/_map.md:26 | [vowel-lipsync-shape-blend.md](vowel-lipsync-shape-blend.md) | 母音の"形"のパチつき解消: 単一勝者(argmax)を解除し、母音を合計≈1の正規化凸ブレンド（softmax(τ=0.30×距離中央値) × per-母音 strength bias → 正規化 × 強度 s）で同時出力。mouth_open=s（Wave22 の mouth_open=w を一般化）。え寄生は目視で benign→素の softmax。cp17 解除。推定器本体に手が入る後続 | **Implemented**（wave23 / source・tests complete / clean review pass。実機ユーザー gate 待ち。実装記録: `../runtime-player/implementation/waves/wave23/wave23-final-integration-report.md`。平滑化(B)・鋭さツマミ(B')は保留） |
discussion/design/screen-design/_map.md:39 - Wave54 Domains A-H reports/reviews と Domain H verification は `pass` 記録済み。workspace-scoped Task Window Shell v0、Toolboxから開く PSD Import task-…4753 tokens truncated…/縮小表示（正典 atlasRuntime は健全）**。
discussion/implementation/reviews/wave103/_map.md:19 - Final clean integration review is recorded as `pass`; no Wave103 review artifacts remain pending.
discussion/implementation/reviews/wave104/_map.md:18 | [wave104-final-clean-integration-review.md](wave104-final-clean-integration-review.md) | Final Clean Integration Review | pass | Independent integration verification of Wave104; §9 Required checks and §11 verification matrix satisfied; zero blocking findings; executor three-domain integration coherent; §3.4 revised ladder faithful (no unverified dimension adoption path); boundary / approval lifecycle unrelaxed; forbidden scope untouched incl. ref/; classifications 1-5 independently confirmed; 6 non-blocking findings recorded (user visual gate pending, sidecar absolute paths, ref validate 97 errors, integer-bounds assumption, Domain A minor 6, Gnome install-escalation process lesson). |
discussion/implementation/reviews/wave104/_map.md:22 - Final clean integration review is recorded as `pass`; no Wave104 review artifacts remain pending.
discussion/implementation/reviews/wave105/_map.md:16 - Final clean integration review is recorded as `pass`; no Wave105 review artifacts remain pending.
discussion/implementation/reviews/wave106/_map.md:20 - Final clean integration review is recorded as `pass`; no Wave106 review artifacts remain pending.
discussion/implementation/reviews/wave108/_map.md:9 | [wave108-domain-a-gen-uv-unclamp-review.md](wave108-domain-a-gen-uv-unclamp-review.md) | A. 生成 UV 非クランプ + `maxCoverageMarginSourcePixels` 関数化（Option E revise） | pass | r≤K 束縛の revert 完全性・UV 非クランプ維持・mesh 作り替え無し・K 単一定数化（旧 `COVERAGE_MARGIN_MAX_SOURCE_PIXELS`/束縛定数 grep 0）を確認。非ブロッキングの doc staleness 1 件記録（後に統合統一）。 |
discussion/implementation/reviews/wave108/_map.md:18 - Final clean integration review recorded `pass`（zero blocking findings）。Wave108 review artifacts に pending なし。
discussion/implementation/reviews/wave32/_map.md:27 Clean Review-Sylph found no source/test blocker and returned `pass`. The review records the initial unit failure, the narrow Gnome stale-test fix, Review-Sylph acceptance of that fix, final verification pass, pass-criteria coverage, orchestration compliance, and non-goal/dependency boundary checks.
discussion/implementation/reviews/wave7/_map.md:15 All Wave 7 source and verification gates passed. The clean review's only blocking finding was stale/missing Wave 7 persistent reports and maps; the Wave 7 report set resolves it.
discussion/implementation/reviews/wave76/_map.md:48 2. Carry Domain A residual risk forward: real browser WebGL pixel proof is not passed, only documented as blocked by missing focused package-level harness.
discussion/implementation/reviews/wave79/_map.md:22 - Final clean integration review is recorded as `pass`; no Wave79 review artifacts remain pending.
discussion/implementation/reviews/wave81/_map.md:14 | [wave81-domain-a-spec-compliance-review.md](wave81-domain-a-spec-compliance-review.md) | pass after Fix Loop 1 | Initial save/load and stale-remnant blockers resolved. |
discussion/implementation/reviews/wave84/_map.md:15 | [wave84-domain-a-design-development-review.md](wave84-domain-a-design-development-review.md) | pass | Initial stale Viewer runtime state finding was superseded by fix loop 1. Re-review confirms project/session identity changes discard incompatible simulation state while preserving Runtime Controls overrides. |
discussion/implementation/reviews/wave84/_map.md:16 | [wave84-domain-a-test-adequacy-review.md](wave84-domain-a-test-adequacy-review.md) | pass | Confirms focused Viewer/runtime, Runtime Controls, Dynamics Tool preview, runtime-core Dynamics, and stale-state regression coverage. |
discussion/implementation/reviews/wave87/_map.md:21 | [wave87-domain-b-test-adequacy-review.md](wave87-domain-b-test-adequacy-review.md) | pass | UI/routing/summary/stale guard tests were adequate, with non-blocking browser interaction residuals. |
discussion/implementation/reviews/wave88/_map.md:13 | [wave88-domain-a-test-adequacy-review.md](wave88-domain-a-test-adequacy-review.md) | pass | Authoring preservation, artifact writes, operation diff, regenerate/replace, save/load, portable bundle, and source-signature stale/non-stale coverage is adequate. |
discussion/implementation/reviews/wave88/_map.md:19 | [wave88-domain-b-spec-compliance-review.md](wave88-domain-b-spec-compliance-review.md) | pass | Viewer `Original` / `Atlas Runtime`, committed artifact use, projection-only remap, Canvas preservation, missing/stale disablement, fallback, and forbidden scope passed. |
discussion/implementation/reviews/wave88/_map.md:21 | [wave88-domain-b-test-adequacy-review.md](wave88-domain-b-test-adequacy-review.md) | pass | Viewer projection, no graph mutation, Canvas original preservation, missing/stale disablement, non-stale deformer/keyform/dynamics changes, UI control, and fallback tests are adequate. |
discussion/implementation/reviews/wave89/_map.md:15 | [wave89-domain-a-spec-compliance-review.md](wave89-domain-a-spec-compliance-review.md) | `pass` | Confirms stale preview behavior, Generate Preview ownership, Operation Core-backed artifact-only Apply, Apply optimization, and forbidden scope. |
discussion/implementation/reviews/wave89/_map.md:17 | [wave89-domain-a-test-adequacy-review.md](wave89-domain-a-test-adequacy-review.md) | `pass` | Confirms focused coverage for no RGBA regeneration on stale/settings projection, stale Apply guard, and artifact-only Apply preservation. |
discussion/implementation/reviews/wave89/_map.md:23 | [wave89-domain-b-spec-compliance-review.md](wave89-domain-b-spec-compliance-review.md) | `pass` | Confirms Atlas Runtime runtime-bound scope, Original behavior, missing/stale guards, and forbidden scope. |
discussion/implementation/reviews/wave92/_map.md:21 | [wave92-domain-c-test-adequacy-review.md](wave92-domain-c-test-adequacy-review.md) | pass | Editor blocked/ready/export flows and Save/Portable JSON non-regression coverage. |
discussion/implementation/reviews/wave96/_map.md:15 | [wave96-domain-a-spec-compliance-review.md](wave96-domain-a-spec-compliance-review.md) | `pass` | Confirms cache-hit frames do not repeat target selection/source signature work, stale detection is preserved, missing placement and Wave89 runtime Drawable scope are preserved, Original mode remains guarded, and forbidden scope is clean. |
discussion/implementation/reviews/wave96/_map.md:17 | [wave96-domain-a-test-adequacy-review.md](wave96-domain-a-test-adequacy-review.md) | `pass` | Confirms focused cache-hit, stale invalidation, missing placement, unbound Drawable scope, Original guard, dynamic keyform/mask, Viewer render-source, and Runtime Screen coverage. |
discussion/implementation/reviews/wave97/_map.md:16 | [wave97-domain-a-design-development-review.md](wave97-domain-a-design-development-review.md) | `pass` | Confirms explicit restart/stop conditions, named conservative thresholds, single pending rAF lifecycle, defensible React dependencies, source organization, dependency policy, and forbidden-scope compliance. |
discussion/implementation/waves/wave108/_map.md:15 | [wave108-vocab-unification-note.md](wave108-vocab-unification-note.md) | F. stale「K」語彙の doc コメント統一（Option E「P」へ、挙動不変） | complete |
discussion/implementation/waves/wave32/_map.md:27 Final verification passed: `pnpm.cmd typecheck`, `pnpm.cmd test:unit`, `pnpm.cmd test:e2e`, `pnpm.cmd run check:source`, `pnpm.cmd run check:deps`, scoped `git diff --check`, dependency manifest/lockfile diff check, and forbidden-scope scan. The initial full unit run exposed a stale unsupported-operation lifecycle test; Gnome fixed the test narrowly and Review-Sylph accepted the fix before the final unit rerun passed.
discussion/implementation/waves/wave40/_map.md:34 - `pnpm.cmd test:e2e`: pass after delegated stale Product Preflight e2e assertion fix.
discussion/implementation/waves/wave76/_map.md:19 | [wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md](wave76-domain-a-webgl-clipping-feedback-loop-fix-report.md) | pass | WebGL mask framebuffer feedback-loop fixed with sampler unbind before mask FBO draw; fake-GL guard covers first clipped drawable, mask target reuse, and missing/unrenderable mask skip behavior after Fix Loop 1. Real WebGL/readPixels proof remains blocked by missing focused harness and is recorded as residual risk. |
discussion/implementation/waves/wave76/_map.md:38 2. Carry Domain A residual risk forward: real browser WebGL pixel proof is not passed, only documented as blocked by missing focused package-level harness.
discussion/implementation/waves/wave81/_map.md:16 | [wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md](wave81-domain-a-headless-dynamics-v2-contract-additive-runtime-report.md) | pass after Fix Loop 1 | Dynamics v2 schema, additive runtime, operations, validation, persistence, and stale-remnant replacement. |
discussion/implementation/waves/wave88/_map.md:14 | [wave88-domain-b-viewer-original-atlas-runtime-mode-report.md](wave88-domain-b-viewer-original-atlas-runtime-mode-report.md) | done / pass-reviewed | Viewer `Original` / `Atlas Runtime` mode, Viewer-only projection remap, missing/stale disablement, Canvas preservation, and Runtime Controls UI evidence. |
discussion/implementation/waves/wave89/_map.md:16 | [wave89-domain-a-texture-atlas-task-apply-performance-fix-report.md](wave89-domain-a-texture-atlas-task-apply-performance-fix-report.md) | `pass` | Texture Atlas settings/stale preview performance and Apply duplicate-work reduction. |
discussion/implementation/waves/wave96/_map.md:16 | [wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md](wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md) | `pass` | Viewer Atlas Runtime static source cache, cache key/invalidation basis, stale/missing placement preservation, Original guard, dynamic remap preservation, and verification. |
discussion/render-performance/_map.md:54 - **Perf Wave 2 実装完了(2026-07-08)**: 案A(選択駆動遅延化)+ 案D+E(表示経路最適化)実装・レビュー合格・合成ベンチ検証済み。実装事実は improvement-design Status=Implemented に反映。60fps 続行可否と案C は実モデル計測003待ち(未決)
discussion/runtime-player/_map.md:67 - Runtime Player Wave11 final integration documentation pass is `pass`, pending clean review: [implementation/waves/wave11/runtime-player-wave11-final-integration-report.md](implementation/waves/wave11/runtime-player-wave11-final-integration-report.md)。
discussion/runtime-player/_map.md:93 - Runtime Player Wave16 Domains A-D implementation and clean reviews are `pass`; Domain E final integration report recommends `pass`, pending final clean Review-Sylph review: [implementation/waves/wave16/wave16-final-integration-report.md](implementation/waves/wave16/wave16-final-integration-report.md), [implementation/waves/wave16/_map.md](implementation/waves/wave16/_map.md), [implementation/reviews/wave16/_map.md](implementation/reviews/wave16/_map.md)。
discussion/runtime-player/_map.md:106 - Wave9/Wave10/Wave11/Wave12/Wave13/Wave14/Wave15/Wave16/Wave17/Wave18/Wave21のmanual OBS Browser Source verificationは未完了: URL load、alpha preservation、WebGL2/model rendering、Control client/heartbeat diagnostics、local preview suspension/resume、real iFacialMocap live motion、body follow/dynamics、Dynamics Tune parity、Stage Motion left/right/depth scale、Variant switching parity、Performance Diagnostics lightweight Browser Source capture with `inputReceiveFpsLatest` / `liveFrameMessageFps` / `appliedLiveFrameFps` / `renderFps` / `browserSourceClientCount` / `compiledRenderFrameCount` / `publicSnapshotMaterializationCount` / `transientCompileCount` / `transientInstanceCount` / runtime instance cache counters comparison、capture act no longer visibly degrading Browser Source smoothness、copied report saved to `tmp/report.log` if follow-up is needed、hide/show/manual refresh reconnect/resync、perceived CPU/GPU/render smoothness improvement、unintended audio meter check。
discussion/runtime-player/_map.md:107 - Native Stage WindowのElectron manual verificationはlocal preview/fallback観点で未完了: Control close process exit、Stage direct close recovery、Runtime Export valid/invalid startup restore、Arrange drag、click-through tray recovery、always-on-top persistence、fallback controls、Dynamics Tune immediate live motion。
discussion/runtime-player/architecture/_map.md:15 | [technology-stack-decision.md](technology-stack-decision.md) | Accepted baseline | Electron固定後のRuntime Player技術スタック、採用理由、app構成、非採用技術、未決事項 |
discussion/runtime-player/backlog/_map.md:29 4. 実装waveに移したら、項目のstatusを `Planned` / `In progress` / `Done` / `Superseded` のいずれかへ更新する。
discussion/runtime-player/implementation/_map.md:38 | [orchestration/player-wave16-plan.md](orchestration/player-wave16-plan.md) | Domain E final integration report complete; pending final clean review | Runtime Player Wave16: Runtime Core Compiled Evaluator v0 |
discussion/runtime-player/implementation/_map.md:39 | [orchestration/player-wave17-plan.md](orchestration/player-wave17-plan.md) | Completed / final pass; manual OBS performance pending | Runtime Player Wave17: Compiled Render Frame Fast Path |
discussion/runtime-player/implementation/_map.md:40 | [orchestration/player-wave18-plan.md](orchestration/player-wave18-plan.md) | Completed / final pass; manual OBS smoothness pending | Runtime Player Wave18: Lightweight Performance Diagnostics Cleanup |
discussion/runtime-player/implementation/_map.md:42 | [orchestration/player-wave20-plan.md](orchestration/player-wave20-plan.md) | Completed / final pass; manual packaged app lifecycle smoke pending | Runtime Player Wave20: Control Window close quits app, Stage close is recoverable, and Focus Stage reopens a closed Stage |
discussion/runtime-player/implementation/_map.md:43 | [orchestration/player-wave21-plan.md](orchestration/player-wave21-plan.md) | Domain A/B pass; Domain C pending | Runtime Player Wave21: Runtime Dynamics Tune Profile for per-export live dynamics tuning in Player without modifying Runtime Export artifacts. Domain reports/reviews live under [waves/wave21/](waves/wave21/) and [reviews/wave21/](reviews/wave21/). |
discussion/runtime-player/implementation/_map.md:101 | [waves/wave16/_map.md](waves/wave16/_map.md) | Pass recommendation / pending final clean review | Runtime Player Wave16 report map |
discussion/runtime-player/implementation/_map.md:106 | [waves/wave16/wave16-final-integration-report.md](waves/wave16/wave16-final-integration-report.md) | Pass recommendation / pending final clean review | Runtime Player Wave16 Domain E final integration docs/maps alignment and performance interpretation report |
discussion/runtime-player/implementation/_map.md:206 | [reviews/wave16/_map.md](reviews/wave16/_map.md) | Domain A-D pass; final clean review pending | Runtime Player Wave16 review map |
discussion/runtime-player/implementation/_map.md:317 - Runtime Player Wave16 Domains A-D implementation and clean reviews are complete with `pass`; Domain E docs/maps final integration recommends `pass`, pending final clean Review-Sylph integration review: [waves/wave16/wave16-final-integration-report.md](waves/wave16/wave16-final-integration-report.md), [waves/wave16/_map.md](waves/wave16/_map.md), [reviews/wave16/_map.md](reviews/wave16/_map.md).
discussion/runtime-player/implementation/_map.md:359 Run the Wave20 manual packaged `.exe` or dev Electron lifecycle smoke: close Control and confirm process exit, relaunch and close Stage directly, confirm Control remains alive and reports Stage unavailable, then press `Focus Stage` and confirm Stage reopens/focuses. If a separate docs pass is authorized, update stale close-hide wording outside `discussion/runtime-player/implementation/**`.
discussion/runtime-player/implementation/orchestration/_map.md:19 | [player-wave11-plan.md](player-wave11-plan.md) | Domain D documentation pass complete; pending clean review | Stage Motion / Head Position Follow: near/far Input Profile calibration, main-owned Stage Motion composed transform, Stage page controls, auto-save, and Browser Source parity without raw tracking exposure. Reports live under `../waves/wave11/` and reviews under `../reviews/wave11/`. |
discussion/runtime-player/implementation/orchestration/_map.md:24 | [player-wave16-plan.md](player-wave16-plan.md) | Domain E final integration report complete; pending final clean review | Runtime Core Compiled Evaluator v0: first-class compiled model / target-local instance architecture while preserving snapshot compatibility. Final report/reviews live under `../waves/wave16/` and `../reviews/wave16/`. |
discussion/runtime-player/implementation/orchestration/_map.md:28 | [player-wave20-plan.md](player-wave20-plan.md) | Completed / final pass; manual packaged app lifecycle smoke pending | Control Window Quit / Stage Reopen Lifecycle: closing Control quits Runtime Player, Stage close alone is recoverable, and Focus Stage reopens a closed Stage. Final report/reviews live under `../waves/wave20/` and `../reviews/wave20/`. |
discussion/runtime-player/implementation/orchestration/_map.md:29 | [player-wave21-plan.md](player-wave21-plan.md) | Domain A/B pass; Domain C pending | Runtime Dynamics Tune Profile: Player-side per Runtime Export dynamics quick tuning profile, Control Window `Dynamics Tune` page, live Native Stage / Browser Source parity, and Runtime Export immutability. Domain reports/reviews live under `../waves/wave21/` and `../reviews/wave21/`. |
discussion/runtime-player/implementation/reviews/wave10/_map.md:17 - Domain B final integration review passed in loop 2 after Gnome fixed stale `screens/_map.md` and `research/_map.md` entries.
discussion/runtime-player/implementation/reviews/wave16/_map.md:11 | [domain-c-compiled-rig-deformer-topology-clean-review.md](domain-c-compiled-rig-deformer-topology-clean-review.md) | Pass | Clean review for Domain C compiled rig/deformer topology, nested warp/rest-bind semantics, and frame-dependent blocked behavior |
discussion/runtime-player/implementation/reviews/wave17/_map.md:43 - Wave17 final integration review stage is complete. Real OBS Browser Source performance verification remains pending until `tmp/report.log` is captured.
discussion/runtime-player/implementation/reviews/wave20/_map.md:11 | [domain-a-test-adequacy-review.md](domain-a-test-adequacy-review.md) | Pass | Domain A test adequacy review before stale-status fix |
discussion/runtime-player/implementation/waves/wave11/_map.md:12 | [runtime-player-wave11-final-integration-report.md](runtime-player-wave11-final-integration-report.md) | Pass; pending clean review | Domain D documentation alignment, preserved A/B/C evidence, final integration check trace, manual verification checklist, and residual risks |
discussion/runtime-player/implementation/waves/wave16/_map.md:13 | [wave16-final-integration-report.md](wave16-final-integration-report.md) | Pass recommendation / pending final clean review | Domain E final integration, docs/maps alignment, performance interpretation, manual Browser Source diagnostics checklist, and residual risks |
discussion/runtime-player/implementation/waves/wave16/_map.md:19 - Domain E recommends `pass`, pending separate final clean Review-Sylph review.
discussion/runtime-player/implementation/waves/wave20/_map.md:17 - Domain A post-fix reviews passed after the stale Stage ready / Model Visible state was fixed.
```

+### Complete file:line queue (98 lexical candidates)

The first pass retained 77 full-text rows due output-size limits. A compact rerun confirms all 98 exact locations:

```text
discussion/_map.md:41
discussion/_map.md:42
discussion/_map.md:43
discussion/_map.md:69
discussion/_map.md:71
discussion/_map.md:73
discussion/ai-cohost/architecture/_map.md:11
discussion/ai-cohost/implementation/_map.md:35
discussion/ai-cohost/implementation/orchestration/_map.md:30
discussion/ai-cohost/implementation/orchestration/_map.md:34
discussion/ai-cohost/implementation/orchestration/_map.md:37
discussion/ai-cohost/soul/_map.md:37
discussion/design/_map.md:26
discussion/design/screen-design/_map.md:39
discussion/design/screen-design/_map.md:40
discussion/development_convention/_map.md:11
discussion/editor-electron-migration/_map.md:22
discussion/editor-electron-migration/_map.md:31
discussion/editor-electron-migration/cleanup/_map.md:5
discussion/implementation/_map.md:25
discussion/implementation/_map.md:28
discussion/implementation/_map.md:50
discussion/implementation/_map.md:57
discussion/implementation/_map.md:63
discussion/implementation/_map.md:470
discussion/implementation/orchestration/_map.md:113
discussion/implementation/orchestration/_map.md:114
discussion/implementation/orchestration/_map.md:122
discussion/implementation/orchestration/_map.md:137
discussion/implementation/orchestration/_map.md:142
discussion/implementation/orchestration/_map.md:187
discussion/implementation/orchestration/_map.md:191
discussion/implementation/orchestration/_map.md:203
discussion/implementation/orchestration/_map.md:205
discussion/implementation/orchestration/_map.md:215
discussion/implementation/reviews/wave103/_map.md:19
discussion/implementation/reviews/wave104/_map.md:18
discussion/implementation/reviews/wave104/_map.md:22
discussion/implementation/reviews/wave105/_map.md:16
discussion/implementation/reviews/wave106/_map.md:20
discussion/implementation/reviews/wave108/_map.md:9
discussion/implementation/reviews/wave108/_map.md:18
discussion/implementation/reviews/wave32/_map.md:27
discussion/implementation/reviews/wave7/_map.md:15
discussion/implementation/reviews/wave76/_map.md:48
discussion/implementation/reviews/wave79/_map.md:22
discussion/implementation/reviews/wave81/_map.md:14
discussion/implementation/reviews/wave84/_map.md:15
discussion/implementation/reviews/wave84/_map.md:16
discussion/implementation/reviews/wave87/_map.md:21
discussion/implementation/reviews/wave88/_map.md:13
discussion/implementation/reviews/wave88/_map.md:19
discussion/implementation/reviews/wave88/_map.md:21
discussion/implementation/reviews/wave89/_map.md:15
discussion/implementation/reviews/wave89/_map.md:17
discussion/implementation/reviews/wave89/_map.md:23
discussion/implementation/reviews/wave92/_map.md:21
discussion/implementation/reviews/wave96/_map.md:15
discussion/implementation/reviews/wave96/_map.md:17
discussion/implementation/reviews/wave97/_map.md:16
discussion/implementation/waves/wave108/_map.md:15
discussion/implementation/waves/wave32/_map.md:27
discussion/implementation/waves/wave40/_map.md:34
discussion/implementation/waves/wave76/_map.md:19
discussion/implementation/waves/wave76/_map.md:38
discussion/implementation/waves/wave81/_map.md:16
discussion/implementation/waves/wave88/_map.md:14
discussion/implementation/waves/wave89/_map.md:16
discussion/implementation/waves/wave96/_map.md:16
discussion/render-performance/_map.md:54
discussion/runtime-player/_map.md:67
discussion/runtime-player/_map.md:93
discussion/runtime-player/_map.md:106
discussion/runtime-player/_map.md:107
discussion/runtime-player/architecture/_map.md:15
discussion/runtime-player/backlog/_map.md:29
discussion/runtime-player/implementation/_map.md:38
discussion/runtime-player/implementation/_map.md:39
discussion/runtime-player/implementation/_map.md:40
discussion/runtime-player/implementation/_map.md:42
discussion/runtime-player/implementation/_map.md:43
discussion/runtime-player/implementation/_map.md:101
discussion/runtime-player/implementation/_map.md:106
discussion/runtime-player/implementation/_map.md:206
discussion/runtime-player/implementation/_map.md:317
discussion/runtime-player/implementation/_map.md:359
discussion/runtime-player/implementation/orchestration/_map.md:19
discussion/runtime-player/implementation/orchestration/_map.md:24
discussion/runtime-player/implementation/orchestration/_map.md:28
discussion/runtime-player/implementation/orchestration/_map.md:29
discussion/runtime-player/implementation/reviews/wave10/_map.md:17
discussion/runtime-player/implementation/reviews/wave16/_map.md:11
discussion/runtime-player/implementation/reviews/wave17/_map.md:43
discussion/runtime-player/implementation/reviews/wave20/_map.md:11
discussion/runtime-player/implementation/waves/wave11/_map.md:12
discussion/runtime-player/implementation/waves/wave16/_map.md:13
discussion/runtime-player/implementation/waves/wave16/_map.md:19
discussion/runtime-player/implementation/waves/wave20/_map.md:17
```


## Parent-map handoff

- Baseline count is exactly the previously observed **281** (deviation 0). The worktree’s 282nd map is the audit child map and is excluded from the baseline.
- First path-level fixes to inspect: the 22 broken links, the one missing implementation/orchestration child registration, and the 45 root-graph orphan candidates.
- Treat the 98 positive+negative lines and 13 multi-status-heading maps as review queues. They are lexical findings, not final stale/current truth.
- Domain Sylphs should use the role lists above as the complete assignment inventory and then determine `Current`, `Partially stale`, `Stale`, `Intentionally historical`, or `Unverifiable` from repository evidence.

## Unresolved / limitations

- This scan does not judge whether a historical map is intentionally retained, whether a missing wave artifact was superseded, or whether a status statement is factually current.
- Link resolution accepts existing directories and does not validate anchors, image references, HTML links, or external URLs.
- “Orphan” means no normalized map-link path from the root map; maps can still be intentionally reachable through prose or external tooling.
