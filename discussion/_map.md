# Discussion Map (Private 2D Rigging Lab / Prototype)

> `discussion/` 直下のファイル・ディレクトリだけを示す入口地図。下層の詳細は各ディレクトリ内の `_map.md` に委譲する。

---

## 位置付け

`discussion/` は Private 2D Rigging Lab / Prototype のコンセプト、AC、シナリオ、設計判断、調査、検証結果を保持する外部記憶である。

要求・スコープの正は、[concept/modified_concept.md](concept/modified_concept.md)、[acceptance-criteria/00_RootQuestion.md](acceptance-criteria/00_RootQuestion.md)、[acceptance-criteria/01_RootAcceptanceCriteria.md](acceptance-criteria/01_RootAcceptanceCriteria.md)、[acceptance-criteria/03_MVP_Acceptance_Criteria.md](acceptance-criteria/03_MVP_Acceptance_Criteria.md) である。Runtime の schema / solver / cardinality の現行意味論は、accepted [dynamics-world-frame-chain.md](design/dynamics-world-frame-chain.md) と [Wave106](implementation/waves/wave106/_map.md) を参照する（AC/scenario の要求オラクルとは分離）。

旧公開エコシステム前提は superseded であり、現在は次の4トラックを分離する。

- Private Prototype。
- Streaming Demo Surface。
- Live2D Feature Proposal。
- Future Public Clean Subset。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_conventions.md](_conventions.md) | `discussion/` 全体の構造、命名、所有権、map運用、Demo and Proposal Hygiene の規約 | Private baselineへ更新済み |
| [_map.md](_map.md) | `discussion/` 直下の入口地図 | Private baselineへ更新済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [concept/](concept/) | コンセプト、スコープ、方針変更メモ | Private baselineとmemo対応完了状態を記録済み |
| [acceptance-criteria/](acceptance-criteria/) | 受け入れ基準。後続作業の要件・合否オラクル | Current oracle。dynamics-file-v3/profile-v2 の具体意味論は design/Wave106。Domain-09 の追跡表現は未決 |
| [scenarios/](scenarios/) | ACを検証可能な具体シナリオへ精緻化するトピック | deterministic preview / validation / demo-safe を保持。旧 scalar 文言と現行 dynamics semantics の対応は未決 |
| [design/](design/) | Private Prototype の設計論点、設計判断、未決事項、検証観点 | dynamics v3、WebGL2 + Canvas2D fallback、Skyline/Option E を反映。GPU/pixel、Canvas sunset、full Evidence は下層 gate |
| [demo/](demo/) | Streaming Demo Surfaceの表示範囲、避けるもの、preflight、disclaimer | policy は current。rights-clean fixture、最終 disclaimer/UI、preflight は user/legal gate |
| [proposal/](proposal/) | Live2D Feature Proposalのテンプレート、提案draft、非目標 | template は current。最初の proposal target は未決 |
| [development_convention/](development_convention/) | P0/P1開発規約、source file organization規約、basis、統合レビュー成果物 | 旧 `/goal` 向け orchestration policy は破棄済み。現行規約は実装・review に適用 |
| [implementation/](implementation/) | 実装オーケストレーション、wave計画、domain completion、review、integration、final report | **Wave102 を Editor mainline の計画停止点として維持**。W103–109 は specialized evidence として別索引。詳細は下層mapへ委譲 |
| [runtime-player/](runtime-player/) | Editor外のRuntime Player / Capture Host appの調査、UX、設計、未決事項 | W1–20 source/review pass、W21 Domain A/B pass・C pending、W22/23 source/test pass。real-device/OBS/製品 gate は未完了 |
| [model-authoring/](model-authoring/) | LLM(Fable)によるモデル制作挑戦の前提合意、閉問題、制作定石 | 装備と閉問題01–19・craft second cycle は完了。PNG再認証、strict-ref/sidecar portability、次scopeは user gate |
| [mesh-generation/](mesh-generation/) | メッシュ自動生成の商用風改修(v7)の概念設計、現状調査、実装、品質評価、v6系整理 | v6D default + v7 comparison toggle。v6/v7品質 hold と Wave2/v6削除は未決。W108/109 render/data contract は完了 |
| [render-performance/](render-performance/) | Editor/Viewer 描画パフォーマンス改善(計測基盤、実測、改善設計、実装、再計測) | Editor Perf Wave2 は accepted close。Player W13–19 diagnostics/fast-path/cadence は完了。C7 二体負荷は optional・未計測 |
| [editor-electron-migration/](editor-electron-migration/) | apps/editor の Web→Electron 移行(why合意、分解、work-stream) | WS1–WS4 + electron-builder packaging は完了。PSD E2E、typecheck/unit、dead branch、metadata warning は残債 |
| [ai-cohost/](ai-cohost/) | ユーザー×自律AIの共演配信構想(コンセプト、前提、調査、設計) | C1–C7（器）完了、S1–S8 実装進行。S8 kill、brain-swap、stream-memory は human gate。D4 YouTube / D6 key-operation / D7 Variant-out-of-scope を保持。LLM/知覚は `apps/soul` 特区内のみ許可 |
| [expo/](expo/_map.md) | 外部イベントへの出展物(ポスター・LT等)の設計と出典事実 | 既存6面 HTML/PDF完成・外部acceptance未検証。別途7分LTの共通ベースと本編1を視覚確認中 |
| [reports/](reports/) | 技術調査・成立性調査レポート | Cubism/旧性能資料は private historical archive。現行 performance/runtime は専用 topic map が owner |

## 現在の状態サマリ

| 項目 | 状態 |
|------|------|
| コンセプト変更 | Private 2D Rigging Lab / Prototype へ更新済み |
| 4トラック分離 | Private Prototype / Streaming Demo Surface / Live2D Feature Proposal / Future Public Clean Subset をroot conceptに記録済み |
| MVP再定義 | Private Authoring-to-Viewer Prototype へ更新済み |
| Cubism形式方針 | SDK/Core、Cubismモデル読み込み、`.model3.json`、`.moc3`、`.cmo3`、`.physics3.json`、`.motion3.json`、`.pose3.json` の検査・読み込みを行わない方針へ更新済み |
| Design contract | 旧Live2D名のPSD profileを `layered-character-psd-profile-v1` に置換済み |
| Domain AC / scenario | Domain 201-225をCurrent / Optional / Future分類へ整理済み |
| Design docs | `design/`配下をPrivate baseline語彙へ整理済み |
| GPT-5.5 Pro review responses | review 001-007 の反映済み判断は下層design文書へ委譲。最新のRuntimeState / RuntimeSequence artifact semanticsをreview_004単体から推定しない |
| Demo / Proposal | `demo/streaming-demo-policy.md` と `proposal/live2d-feature-proposal-template.md` を追加済み |
| Codex-friendly automation | [design/codex-friendly-automation-policy.md](design/codex-friendly-automation-policy.md) で、Editor/repoは提案・推論・自動分類を行わず、外部Codex/LLMが人間同等操作をdeterministic API経由で実行する方針をAccepted user decisionとして記録済み |
| Development Convention | `development_convention/` にP0/P1規約16本とsource file organization規約を追加済み。旧 `implementation-orchestration-policy.md` と `/goal` companion文書は破棄済み |
| Implementation baseline | **Editor mainline は Wave102 をもって計画停止（ユーザー決定、2026-07-02記録）**。修復済みの [implementation/_map.md](implementation/_map.md) / [implementation/orchestration/_map.md](implementation/orchestration/_map.md) が W0–109 の索引を所有し、W103–109 は specialized evidence として別扱い。`current-capability-map.md` / `remaining-work-backlog.md` は dated snapshot |
| Current implementation work | Editor mainline は Wave102 で停止中。主戦場は [model-authoring/](model-authoring/) と [runtime-player/](runtime-player/) の topic family。W103–109 は再承認なしに Editor mainline を再開しない bounded evidence |
| Implementation maps | 次Wave判断は [implementation/_map.md](implementation/_map.md)、[implementation/orchestration/_map.md](implementation/orchestration/_map.md)、各 specialized map を basis とする。Wave54-era capability/backlog は単独の current oracle ではない |
| Runtime Player topic | 現在の入口は [runtime-player/_map.md](runtime-player/_map.md) と [runtime-player/implementation/_map.md](runtime-player/implementation/_map.md)。W1–20 source/review pass、W21 Domain A/B pass・C pending、W22/23 source/test passを索引し、W11/W20/W21/W22/W23 の実機・製品 gate（iFacialMocap/OBS/ライフサイクル/母音）は未完了 |
| memo/new_concept.md対応 | `discussion/`文書移行は完了扱い。実装・法務・素材・提案テーマ・Future公開subsetは別課題 |
| Model Authoring topic | 「Fableに2Dモデルを作らせる」挑戦を [model-authoring/](model-authoring/) として記録。装備・閉問題01–19・craft second cycle は完了。PNG bytes の再認証、strict-ref/sidecar portability、次の閉問題 scope、W107→W22/23 母音 gate は未決 |
| Mesh Generation topic | メッシュ自動生成は [mesh-generation/](mesh-generation/) を参照。v6D default + v7 comparison toggle、往復2「一長一短」の品質 hold と v6削除/Wave2 user gate を保持。W108/109 は transparent-margin / `contentInset` / `uvRect` render/data contract の実装 evidence |
| Render Performance topic | Editor Perf Wave2 は accepted close。Player W13–19 の diagnostics/fast-path/cadence は完了し、[reports/editor-render-performance/](reports/editor-render-performance/) は historical baseline。C7 二体同時起動は optional・未計測で、product deep profiler は再導入しない |
| Editor Electron Migration topic | apps/editor の WS1–WS4 + electron-builder packaging は完了。残債は PSD E2E の workspace/native-picker precondition、独立 typecheck/unit、portable dead branch、packaging metadata warning。詳細は [editor-electron-migration/_map.md](editor-electron-migration/_map.md) |
| AI Cohost topic | [ai-cohost/](ai-cohost/) は C1–C7（器）を完全閉鎖し、S1–S8 の実装・reading/interjection・4頭 registry・stream-memory を索引。S8 kill、brain-swap、stream-memory は human gate、persona/S9 voice は product decision。知性経路は Max 20x + Agent SDK、LLM/知覚は `apps/soul` 特区内のみ許可（特区外は禁止）。入口は [ai-cohost/_map.md](ai-cohost/_map.md) |

## 次の行動

1. 次の実装判断では [implementation/_map.md](implementation/_map.md)、[implementation/orchestration/_map.md](implementation/orchestration/_map.md)、各 specialized W103–109 map、[design/codex-friendly-automation-policy.md](design/codex-friendly-automation-policy.md) を basis とし、Editor mainline は Wave102 停止として扱う。`current-capability-map.md` / `remaining-work-backlog.md` は dated snapshot。
2. external HTTP / WebSocket / MCP API work と LLM provider integration の Future scope 指定は、[ai-cohost/concept/mvp-boundary-amendment.md](ai-cohost/concept/mvp-boundary-amendment.md)(**改定二号=特区憲章 2026-07-11**)に従う。runtime-player の loopback 操縦チャネルと生理層生成器は解禁、LLM provider integration・知覚は `apps/soul` 特区内のみ許可、特区外は禁止。それ以外の external API は Future scope。
3. Dynamics v3/profile-v2 の Domain-09 AC/scenario traceability・cardinality 表現は user decision として [acceptance-criteria/](acceptance-criteria/) / [scenarios/](scenarios/) / [design/dynamics-world-frame-chain.md](design/dynamics-world-frame-chain.md) を照合する。
4. Runtime Player は [runtime-player/_map.md](runtime-player/_map.md) と [runtime-player/implementation/_map.md](runtime-player/implementation/_map.md) を入口にし、W21 Domain C、W11/W20/W22/W23 の iFacialMocap/OBS/ライフサイクル/母音 gate を実機で確認する。
5. Fable によるモデル制作は [model-authoring/_map.md](model-authoring/_map.md) を入口にし、PNG再認証、strict-ref/sidecar portability、次の閉問題 scope を user が選ぶ。
6. Mesh/render は [mesh-generation/_map.md](mesh-generation/_map.md) と [render-performance/_map.md](render-performance/_map.md) を入口にする。v6D/v7 quality hold、v6削除/Wave2、W108/109 atlasRuntime/GPU/pixel/Canvas sunset gate は自動 pass にしない。C7 二体負荷は optional experiment。
7. Electron は [editor-electron-migration/_map.md](editor-electron-migration/_map.md) を入口にし、PSD E2E precondition、独立 typecheck/unit、portable dead branch、metadata warning の残債を扱う。
8. AI共演配信は [ai-cohost/_map.md](ai-cohost/_map.md) を入口にし、S8 kill、brain-swap、stream-memory の human gate と persona/S9 voice の product decision を先に扱う。`apps/soul` 例外境界を維持する。
9. Demo/Expo/Proposal は [demo/_map.md](demo/_map.md)、[expo/_map.md](expo/_map.md)、[proposal/_map.md](proposal/_map.md) を入口にし、rights-clean fixture・disclaimer/preflight、Expo acceptance/proof print、最初の proposal target を確認する。
10. Future Public Clean Subset は必要時に scope と rights/dependency review を別途設計する。Cubism archive の再開は permission / legal / scope review 後に限る。

## 未決事項

| 項目 | 状態 |
|------|------|
| Streaming Demo Surface の安全 gate | rights-clean fixture、最終 disclaimer/UI wording、automated preflight は未完了（[demo/_map.md](demo/_map.md)） |
| Live2D Feature Proposal の target | template は作成済み。最初の draft / submission target は未決（[proposal/_map.md](proposal/_map.md)） |
| Dynamics v3 traceability | Domain-09 AC/scenario に profile-v2 / dynamics-file-v3 の cardinality をどう追跡表示するか user decision |
| Runtime Player 実機・製品 gate | W11 calibration/parity、W13–19 OBS/CEF/real-model confidence、W20 lifecycle、W21 Domain C、W22/23 real speech/vowel は未確認（[runtime-player/_map.md](runtime-player/_map.md)） |
| Model-authoring gate | post-`45d2734` PNG byte 再認証、strict-ref/sidecar portability、次の閉問題 scope、W107→W22/23 母音確認は未決（[model-authoring/_map.md](model-authoring/_map.md)） |
| Mesh / render gate | v6 retention・v6/v7 toggle lifetime・Wave2、W108 atlasRuntime formal acceptance、GPU/pixel parity、Canvas2D sunset、original inset recheck は未決 |
| Optional C7 performance experiment | 二体同時起動の hardware/browser CPU/GPU/FPS capture は optional・未計測。product deep-profiler transport は再導入しない |
| Electron residuals | PSD E2E precondition、独立 typecheck/unit、portable dead branch、packaging metadata warning の処理時期は未決（[editor-electron-migration/_map.md](editor-electron-migration/_map.md)） |
| AI cohost human/product gate | S8 kill/restore/no-regression、brain-swap rollout/choice、stream-memory privacy/OFF/auto-load、persona/S9 voice は未完了（[ai-cohost/_map.md](ai-cohost/_map.md)） |
| Expo acceptance / proof print | 6 HTML + 6 A2 PDF は repo 完成。外部 acceptance、採択後実寸 proof print、公開前 rights/legal は未確認（[expo/_map.md](expo/_map.md)） |
| Cubism archive restart | private historical archive。再開は permission / legal / scope review 後に限る（[reports/_map.md](reports/_map.md)） |
| Implementation index/history status | W0–50/W56–109 の child/review indexes と W22/23/W107 registrations は backfilled/current。W51–55 は意図的に purged / Git-history-only。残る6件の baseline orphan candidates は必要時のみ構造・歴史 hygiene として扱い、W109 の partial evidence と human gates は既存記録どおり保持 |
| Future Public Clean Subset の具体範囲 | 現在MVP外。必要時に別途 scope / rights / dependency review |
