# Workspace activity refresh — Editor development history

> 基準日: 2026-08-08 (Asia/Tokyo)。担当は Editor 開発史（Wave 0–109）であり、現行能力の網羅的棚卸しではない。これは既存の map、wave report/review、Git 履歴を突き合わせた歴史報告である。実装 pass は人間による製品・視覚・実機受入を意味しない。

## 1. Scope / inspected entry points

先に `discussion/reports/workspace-activity-refresh/audit-contract.md`、`discussion/_conventions.md`、`discussion/_map.md` を読み、次を入口にした。

- `discussion/implementation/_map.md:19-35,146-171` — 現在の実装入口、Wave57 以降の proven scope、Wave102 stop、Wave103–109 の child-map index。
- `discussion/implementation/orchestration/_map.md:9-59,60-80,81-101,102-118` — Wave0–50、purge/reset、Wave57–92、Wave93–109 の圧縮された計画・完了状態。`orchestration/_map.md:110` の Wave101 は plan header が歴史的 `Planned` で、leaf final report/review が実際の closeout を裏付ける。
- `discussion/implementation/waves/wave0/_map.md` … `wave50/_map.md` および `wave56/_map.md` … `wave109/_map.md`、同じ範囲の `discussion/implementation/reviews/wave*/_map.md`。実在数は各105（0–109 の110枠から、purged Wave51–55 の5枠を除く）。Wave51–55 の map/report/review を再作成していない。
- Waveごとの final-like report/review（初期は名称・粒度が不均一）を代表的に確認: `waves/wave1/wave1-final-report.md`、`wave6`、`wave12`、`wave15`、`wave23`、`wave31`、`wave40`、`wave44`、`wave50`、`wave57`、`wave59`、`wave67`、`wave71`、`wave80`、`wave92`、`wave102`、`wave103`、`wave104`、`wave105`、`wave106`、`wave107`、`wave108`、および Wave109 Domain A report。これは歴史証拠であり、現行の acceptance oracle ではない。
- Git chronology: `git log --reverse --format='%h %ad %s' --date=short -- apps/editor packages` と、post-102 代表コミットの `git show --stat --oneline`。期間の区切りは wave map と path/stat の両方で照合した。

## 2. Executive summary

1. **契約から最初の Editor vertical slice（W0–7）:** package/DTO/validator/runtime evidence、operation/dry-run/commit、永続化とブラウザ Editor の最初の保存・再読込を積み上げた。後の Editor の基本単位が「明示 operation + evidence + validation」になった（`orchestration/_map.md:9-16`）。
2. **AI境界・runtime編集・画像入力の土台（W8–30）:** AI は read/inspect/validate/dry-run/approval/transcript に限定し、keyform/runtime/embedded preview、drawable/mesh、PSD仕様、dynamics v1、Viewer、rig/mask/Parts Tree、tutorial mini modelを段階的に追加した。PSD/PNG は意図的に parser/decode/compositing/full renderer の境界を残した（`orchestration/_map.md:17-39`）。
3. **入出力・preflight・明示PSD import（W31–50）:** byte intake、IndexedDB、portable bundle、archive/filesystem capability decision、mesh topology/UV、Product Preflight、Codex-facing explicit operation、quality/source guards、parser/materialization pilot、明示 leaf/group/subtree import を検証した。自動分類・意味推論・auto-rigging・auto-fix・外部transportは追加しなかった（`orchestration/_map.md:40-59`）。
4. **不連続な reset（W51–57）:** W51–55 は commit `99a31c8` で purge/Git-history-only。W56 は abandoned（headless/package separation の一部だけ継承）、W57 は `apps/editor` を React stack で再構築した accepted foundation であり、旧GUI系の継続ではない（`orchestration/_map.md:60-66`）。
5. **実作業系 Editor の再構成と mesh/render 基盤（W58–71）:** PSD import E2E、Canvas/Parts Tree/DnD、mesh/deformer/parameter/keyform、Canvas evaluation、WebGL2、v6候補探索を経て、W70–71 で v6D lineage を Editor の既定経路へ昇格し、表示式 algorithm selector を撤去した（`orchestration/_map.md:67-80`, `:124-129`）。
6. **authoring UX と runtime/viewer の一周（W72–92）:** rotation/deformer editing、save/load、keyform、multi-select、Viewer controls、dynamics/diagnostics、atlas artifact/runtime、workspace save、runtime export を積み上げた。各 wave の pass は記録されたが、real WebGL/pixel/device gate の不在を明記する waveもある（`orchestration/_map.md:81-101`）。
7. **履歴・性能・variant と mainline の停止（W93–102）:** history binary de-dup、nested Warp、multi-alpha-island、atlas cache、idle throttle、instrumentation、Variant/Expression/Viewer、Skyline、Runtime Export `baseVisible` を行い、Wave102 を Editor mainline の accepted planning stop とした（`discussion/implementation/_map.md:23,146-164`、`orchestration/_map.md:102-111`）。
8. **W103–109 は specialized evidence:** headless authoring/perception/variant visibility、dynamics-file-v3、Runtime Player vowel mapping、transparent margin Option E、uvRect preflight を扱った。Editor に触る後続 commitが存在しても、post-102 specialized scopeであり、Editor mainline の暗黙の再開ではない（`orchestration/_map.md:112-118`）。
9. **証拠の時間性:** W101 の `Planned` は計画時点の見出しで、leaf final report/review は actual passを記録する。W103–105 の PNG visual gate、W107 の real-device gate、W108 の atlasRuntime visual gate、W109 の「commit未実施」は各 closeout時点の記録であり、後続 map/Git と突き合わせて現在形に読み替えてはいけない。

## 3. What was built or investigated

### 圧縮された期間区分

| 期間 | 波 | 開発上の意味（historical evidence） | 代表的な根拠 |
|---|---:|---|---|
| A. 契約・操作・保存の骨格 | 0–7 | Wave0 foundation、W1 contracts、W2 package/runtime/validator、W3 authoring/operation、W4 runtime evidence、W5 persistence/log、W6 Editor operation persistence、W7 browser save/load と E2E。最初の authoring-to-editor loop が成立した。 | `orchestration/_map.md:9-16`; `waves/wave1/wave1-final-report.md`, `waves/wave6/`, `waves/wave7/`; Git `8304709`→`7782ada` |
| B. AI command、runtime keyform、preview、drawable/texture | 8–19 | AI dry-run/approval/transcript/read を deterministic command surface として接続。keyform/runtime sampling、diff/Grid2D、embedded preview、drawable/mesh、layer visibility、split PNG provenance、texture-backed preview/part mappingを追加。 | `orchestration/_map.md:17-28`; `waves/wave8/`–`wave19/`; Git `a2c114c`→`c9933fd` |
| C. PSD仕様、dynamics、Viewer、rig/tree、mesh editing | 20–30 | PSD field/profile、binary boundary、Minimum Open Dynamics v1、Private Viewer、rig controls/keyforms、mask/clipping/opacity、Parts/Texture/Layer Tree、Canvas mesh editing、rights-clean tutorial。実データの解析・compositing・Cubism互換は範囲外として固定。 | `orchestration/_map.md:29-39`; `waves/wave20/`, `wave23/`, `wave24/`, `wave28/`, `wave29/`, `wave30/`; Git `cacbe58`→`b9c7ec6` |
| D. intake、portable storage、preflight、明示PSD import | 31–50 | browser byte intake、WarpLattice2d、layer-tree direct manipulation、preflight、IndexedDB、portable bundle、archive/filesystem capability boundary、mesh topology/UV、Product Preflight、Codex proposal API/diff、quality/evidence guards、parser pilot、explicit PSD leaf→batch→group plan→general leaf→subtree scaffold。自動分類/auto-rigging/外部transportは明示的に除外。 | `orchestration/_map.md:40-59`; `waves/wave31/`–`wave50/`; Git `0f66aef`→`c705918` |
| E. purge、React reset、PSD/Canvas/Partsの再構成 | 51–60 | W51–55 purge、W56 abandoned、W57 React foundation。続くW58 PSD import E2E、W59 Canvas PSD drawable display、W60 Parts Tree/Inspector/DnDで再構築後の concrete Editor surface が形成された。W59 は public parser API/private-shape boundary により clipping extraction を未実装と明記。 | `orchestration/_map.md:60-69`; `discussion/implementation/_map.md:26-29`; `waves/wave57/`–`wave60/`; Git `99a31c8`, `ae02025`, `0cd773d`/`94ef938`, `fd59f8c`, `ee862d8` |
| F. mesh/deformer/render の authoring基盤 | 61–71 | mixed ordered hierarchy/import preview/mesh generation、auto-outline v1–v2.6、Warp/deformer management、parameter/keyform、Canvas evaluation、WebGL2 parent-child local-space semantics。W68–69のv6 sidecar候補探索を経て、W70でv6D mainline support-rings、W71でadaptive staggered-bandへ既定 routingを更新、visible selectorを戻さない決定。 | `orchestration/_map.md:70-80`; `discussion/implementation/_map.md:30-40`; `waves/wave61/`–`wave71/`; Git `43c1c30`→`73bd313`, `49a0510`, `6b38eeb` |
| G. deformer UX・保存・Viewer | 72–80 | rotation deformer editing、portable save/load restoration、keyform hardening、WebGL clipping fix（fake-GL evidence only）、drawable/deformer multi-select、wrap rig、keyed warp scale、Viewer/runtime view と interaction densityを統合。 | `orchestration/_map.md:81-89`; `discussion/implementation/_map.md:41-45`; `waves/wave72/`–`wave80/`; Git `35f119e`→`e336cd0` |
| H. dynamics、diagnostics、atlas、workspace/export | 81–92 | Dynamics Tool/runtime contract、scrub/preview/quick tune、Viewer playback/solver consolidation、validation/diagnostics、mesh crossing repair、atlas task/artifact/runtime/performance、workspace save、deformer lifecycle、runtime export。 | `orchestration/_map.md:90-101`; `discussion/implementation/_map.md:90-101`; `waves/wave81/`–`wave92/`; Git `cc1feaf`→`16294d4` |
| I. history/performance/variants と Editor mainline stop | 93–102 | history binary asset de-dup、nested Warp rest/bind、multi-alpha-island、atlas cache、dynamics idle throttle、duplicate evaluation removal/instrumentation、Variant/Expression Manager、Viewer switching、Skyline、Runtime Export `baseVisible`。W101 actual passを訂正して索引し、W102を accepted Editor mainline stopping baseline とした。 | `orchestration/_map.md:102-111`; `discussion/implementation/_map.md:146-164`; `waves/wave93/`–`wave102/`; Git `bf3e03a`→`d2e7b7e` |
| J. post-102 specialized boundary | 103–109 | W103 headless authoring host + pure-TS rasterizer、W104 perception/measurement、W105 variant visibility gate、W106 dynamics-file-v3 + Editor/Player tuning、W107 vowel lipsync（Runtime Player）、W108 transparent margin Option E/content-inset/LINEAR parity、W109 uvRect preflight reconcile（Domain A only）。mainline continuationではない。 | `orchestration/_map.md:112-118`; `discussion/implementation/_map.md:163-171`; `waves/wave103/`–`wave109/`; Git `2f80ca0`, `6645c2f`, `1f07270`, `356959c`, `04e24cd`, `e4e8c9d`, `70485f4`, `8640d12`, `899cb2e` |

### 代表的な置換・廃止・方向転換

- **W51–55 purge:** 旧UI surface/task-shell/reset の成果はGit-history-only。報告・reviewを復元しない。W56は完全な後継ではなく abandoned、headless/package separation の限定的事実だけを継承し、W57 React reset が新しい Editor foundationになった。
- **Mesh candidate → v6D default:** W68–69 は v6a–v6f sidecar/candidate と比較 selector の時期。W70–71 は v6D lineage を昇格し、selectorを撤去して adaptive staggered-band を既定経路にした。過去の候補 pass を現在の選択可能UIと解釈しない。
- **Minimum Dynamics v1 → `dynamics-file-v3`:** W23 の Minimum Open Dynamics v1 は初期 vertical slice。W106 は world-frame Verlet chain、複数 outputs、kind-aware anchor を持つ breaking replacement として別の specialized track に記録される。W23のhistorical名称を現行 schema の証拠にしない。
- **Transparent-margin contract:** W108 は旧固定K/r制約をOption E（層サイズ関数のcoverage margin、transparent padding/content-inset、LINEAR/software parity）で上書きした accepted design。W109 は同じcontent sub-rectの `uvRect` preflight helperを再利用する契約修正で、wave-level final closeoutを生成していない。

## 4. Current repository state

これは現行コードの能力表ではなく、開発史から見える current boundary の要約である。

| 観点 | 現時点で区別できる事実 | 根拠・読み方 |
|---|---|---|
| Mainline planning | accepted Editor mainline planning stop は Wave102。現行判断入口は orchestration map、W102 leaf、post-102 specialized indexes。 | `discussion/implementation/_map.md:21-26,146-171,516-520`; `orchestration/_map.md:120-124`。これは「W102以降にコードがない」という主張ではない。 |
| Post-102 source activity | GitにはEditorを含む後続specialized commitがある。W106 `356959c`（Editor Dynamics Tool/Viewer + runtime-player tuning）、`04e24cd`（mesh v7 UI/authoring-core）、`e4e8c9d`（Editor perf instrumentation/evaluation）、Electron migration `d9f3f1d`/`e9113ab`/`d1b2348`、W108 `70485f4`、contentInset remap `8640d12` が確認できる。 | `git show --stat --oneline <hash>`。これらは topic-specific evidence として読む。W102のmainline stopを自動的に解除しない。 |
| Specialized no-Editor tracks | W103（`2f80ca0`）、W104（`6645c2f`）、W105（`1f07270`）、W109（`899cb2e`）は主に authoring-host/authoring-core/report surface。Editor mainlineの再開ではない。 | Git path/stat と各wave map。W106/W108はEditorに触れるが specialized boundary が map に明記される。 |
| Wave101 status | `wave101-plan.md` の Planned/ready は計画時点の値。Wave101 final report/review、parent child-map rowは actual closeout pass。 | `orchestration/_map.md:110`; `discussion/implementation/_map.md:163`。計画見出しを現状statusとして使わない。 |
| Wave109 status | Domain A report/review は pass。wave-level final integration/clean reviewは存在しない。reportの「commit未実施」はWave109時点のsnapshotで、後続Git `899cb2e` が記録されている。 | `waves/wave109/_map.md`、`reviews/wave109/_map.md`、`899cb2e`。後続commitの存在だけで人間acceptanceを推定しない。 |
| Artifact index density | `waves`/`reviews` は各105 map（W0–50, W56–109）。W51–55はpurged。final-like filename scan は119件だが、名称の異なるcloseoutやdomain reportsを含むartifact数であり、全waveの同一形式final verdict数ではない。 | PowerShell `Get-ChildItem` scan（下記Evidence index）。 |

## 5. Accepted decisions and boundaries

ここは歴史上確認できた accepted decision と明示された boundary だけを列挙し、新しい製品判断を追加しない。

- Wave102をEditor mainlineの計画停止点とする。W103–109は separately indexed specialized evidence として扱い、後続のコード差分だけではmainlineを再開しない（`discussion/implementation/_map.md:23,516-520`、`orchestration/_map.md:124`）。
- Wave51–55は `99a31c8` 下で purged/Git-history-only。Wave56は abandonedで、headless baseline/package separation の限定的事実だけを保持。Wave57 React foundationが reset後の accepted Editor基盤（`orchestration/_map.md:60-66`）。
- AI/PSD/packageの歴史的境界は、明示 operation・dry-run・approval・evidence と、explicit PSD leaf/group/subtree importまで。semantic recognition、auto-rigging、repo-side proposal generation、auto-fix、external HTTP/WebSocket/MCP、Cubism SDK/Core/互換は wave report/mapで除外されている（`waves/wave40/`, `wave44/`–`wave50/`）。
- W70–71のmesh decisionは v6D lineageを既定routingにし、visible algorithm selectorを戻さない。W68–69候補は比較の歴史証拠であって、現在の選択可能UIの主張ではない（`orchestration/_map.md:126-129`）。
- W108 Option E とW109のcontent-inset/`uvRect` helperは mesh/render/export contract の specialized decision。W109はpartial evidenceであり、Editor mainline stop・formal visual/device gateを変更しない。

## 6. Verification and experiment evidence

### 6.1 Wave reports/reviews

- W0–7は foundation/vertical-slice completion report と当時のテスト/E2E記録がある。W8–50では waveごとに final report、domain report、clean reviewの名称・粒度が揺れるが、orchestration mapは実装proven/clean reviewの範囲を要約する。
- W57–102では wave map/review map と final integration/clean review が大部分揃い、parent mapのchild indexが実在パスと判定を索引する。W101だけは plan headerの`Planned`をactual closeoutへ訂正して読む。
- W103–106は final integration/clean review passを記録するが、W104/105のref PNG目視、W106のbaseline比較というように、実装判定とユーザー/実験gateが別れている。
- W107は implementation/final clean review pass、vowel関連テスト/typecheck greenのhistorical evidenceがある一方、player起動・発話・ちらつき・toggle/strengthを確認するreal-device gateはwave外。後続runtime-player semanticsの現行acceptanceをこのwaveから推定しない（`waves/wave107/_map.md`、`reviews/wave107/_map.md`）。
- W108は当時のtypecheck、packages 1492 tests、dependency/source guard、final clean review passを記録し、pre-existing redをwave由来と分離した。atlasRuntimeの実機/視覚確認は外部gateであり、passを人間受入に変換しない。
- W109はauthoring-core 41 files/317 tests、packages 242 files/1500 tests、typecheckのreport-level evidenceとDomain A review passのみ。final integration artifactがないため、wave-level final passは主張しない（`waves/wave109/_map.md`）。

### 6.2 実行した読み取り・照合コマンド

- `git log --reverse --format='%h %ad %s' --date=short -- apps/editor packages` — W0 (`8304709`) からW102 (`d2e7b7e`)、post-102 specialized commitsまでの時系列を得た。doc-only wave（例: W42–43等）はsource-path logに一対一で現れないため、map/reportと併読した。
- `git show --stat --oneline 2f80ca0 6645c2f 1f07270 356959c 04e24cd e4e8c9d 70485f4 8640d12 899cb2e` — post-102の変更領域をEditor、authoring-host/core、render、runtime-player、Electron別に分類した。
- PowerShellで `Get-ChildItem discussion/implementation/waves -Directory` と `.../reviews -Directory` の各`_map.md`を数えた結果: `wave_count=105`, `review_count=105`, range 0–109, missing `51,52,53,54,55`。
- `Get-ChildItem discussion/implementation/waves -Recurse -File` の final/closeout名抽出は119件。これは同形式のfinal reportが119波ある意味ではなく、初期波のcompletion/domain/final integrationを含むファイル名ベースの監査補助値である。
- `Get-Content`でW101 plan/final、W102 map、W103–109 wave/review mapsを再読した。新規source/testを実行していないため、以下は既存evidenceの再分類である。

## 7. Historical progression / turning points

1. **Contract-first開始:** W0–5で package/runtime/operation/persistence/evidence の語彙と境界を先に作り、W6–7でEditor UIをその上に載せた。後続のPSD、mesh、dynamicsも同じ operation/evidence/validation構造に置かれた。
2. **AIをproduction transportから切り離した:** W8–10で dry-run、approval、transcript、read/inspect/validateをUIとoperationへ統合したが、provider/LLM/外部transportは作らなかった。これは後のCodex-facing API (W40)にも継承された。
3. **Runtime意味論をEditor authoringへ戻した:** W11–17でkeyform/runtime sampling、preview、drawable/mesh editingを増やし、W23–29でdynamics、Viewer、rig、mask、tree、Canvas編集を加えた。
4. **PSDを「明示的・bounded」にした:** W18–22、W31、W44–50を通じてbyte intake、profile、parser boundary、selected leaf、group plan、subtree scaffoldを追加した一方、semantic import・全層自動化・compositing・Cubism互換を意図的に置かなかった。
5. **Stack reset:** W51–57は機能追加の連続ではなく、purge→abandon→React rebuildという実装履歴の断層。W58以降のCanvas/Parts/Meshは新しいfoundationからの実作業である。
6. **Mesh探索から一つの既定経路へ:** W61–69はauto-outline、deformer、WebGL2、v6候補を比較・sidecar化。W70–71でv6D lineageをmain direction/defaultへ昇格し、UI上のalgorithm choiceを縮退させた。
7. **Authoringからviewer/exportへ:** W72–92で保存、deformer/keyform、Viewer interaction、dynamics、atlas、workspace、runtime exportを横断した。ここで「Editorで編集できる」だけでなく「Viewer/Exportへ同じ意味論を渡す」境界が強くなった。
8. **履歴と性能を含む運用面:** W93–101はbinary history pressure、nested Warp、atlas/variant/performance、Skylineを扱い、W102はRuntime Export variant visibility (`baseVisible`)の実装provenanceを mainline baselineとして閉じた。
9. **停止後の専門化:** W103–109は authoring-host perception、dynamics schema、Runtime Player lipsync、mesh/render contractへ分岐した。これは「停止後もrepo活動が続いた」というGit上の事実と、「Editor mainlineは停止した」というaccepted planning decisionを同時に満たす。

## 8. Open gates, debts, and uncertainties

以下は既存記録が未解決として残したもの。解決を提案・決定しない。

- **Visual/device gates:** W104/105 ref-render PNGの人間目視、W107 real-device vowel lipsync、W108 atlasRuntime visual confirmation。各wave passでは閉じない外部gateである。
- **Wave109 completeness:** Domain A report/reviewのみで、wave-level final integration/clean reviewなし。`899cb2e`後の現行意味論・人間受入は別証拠が必要。
- **W101 historical wording:** plan headerのPlannedとactual final passの混在は、今後もleaf final report/reviewを優先して読む必要がある。
- **Mesh/render follow-up:** v6D lineageの後続quality/Wave2、real WebGL/readPixels/pixel oracle、atlas content-inset/uvRectのcross-path確認は、specialized mapに記録されたまま。W108のpre-existing red ledgerを新規失敗と混同しない。
- **Performance:** W97–98、W106、W108の測定・baselineは範囲限定。任意C7や一般的な「性能改善完了」をこの歴史reportからは主張できない。
- **Electron migration:** GitにElectron shell/filesystem/Web retirement/packagingのcommitがあるが、対応するdistribution/E2E/typecheck/unit/dead-branchの残債は別報告・別gateで扱う。Editor mainline史へ自動統合しない。
- **Artifact asymmetry:** W51–55は意図的欠損、W56はstandalone finalなし、W109はpartial。欠損を新規成果や未実施の断定に変換しない。

## 9. Candidate next work（決定ではない）

履歴と既存gateから導ける「候補の論点」を記録するだけに留める。

- Wave102後のEditor mainlineを再認可するか、specialized tracksのまま維持するかを明示する。
- W103–109各topic mapの外部 visual/device/manual gate と、現行source/Gitの対応を再照合する。
- W109にwave-level final integrationを作るか、Domain A partial evidenceとして保持するかを、適切な承認後に選ぶ。
- mesh quality/atlas uvRect/real WebGL pixel evidence、Electron residual checks、W107 device validationのどれを別waveまたは別実験として扱うかを分離して記録する。
- W51–55のGit-history-only方針と、W56 abandoned/W57 replacementの説明を今後の統合報告でも保持する。

## 10. Evidence index

| 種別 | パス / commit / command | 結果・用途 |
|---|---|---|
| Audit contract | `discussion/reports/workspace-activity-refresh/audit-contract.md` | current/historical/experiment/human gateを分離し、必須11節と「調査のみ・単一report」を規定。 |
| Parent implementation map | `discussion/implementation/_map.md:19-35,146-171,514-520` | W102 stop、W57 reset、W101 actual pass、W103–109 specialized child index、次のrouting。 |
| Orchestration map | `discussion/implementation/orchestration/_map.md:9-59,60-80,81-101,102-118,120-171` | W0–109の計画意味、purge/reset、v6D、W102 stopとpost-102 boundary。 |
| Wave/review map inventory | `discussion/implementation/waves/wave0/_map.md` … `wave50/_map.md`, `wave56/_map.md` … `wave109/_map.md`; same `reviews/` | 各105 map。W51–55は意図的欠損。W107/W109 mapsは後付けindexであり、新規review実行を意味しない。 |
| Early wave evidence | `waves/wave1/wave1-final-report.md`, `wave6/`, `wave8/`–`wave23/`, `wave31/`–`wave50/` | contracts→Editor→AI/runtime→PSD/preflight/explicit import の各節目。 |
| Reset/rebuild evidence | `waves/wave57/wave57-domain-c-map-closeout-report.md`, `reviews/wave57/`; `orchestration/wave56-plan.md` | W56 abandoned、W57 React reset pass。 |
| Editor mainline evidence | `waves/wave58/`–`wave102/`, `reviews/wave58/`–`wave102/` | PSD/Canvas/mesh/deformer/viewer/dynamics/atlas/history/variant/baseVisible の歴史。W101 plan-vs-actualを訂正して読む。 |
| Specialized evidence | `waves/wave103/` … `wave109/`, `reviews/wave103/` … `wave109/` | post-102 bounded tracks。W107 real-device gate、W108 external visual gate、W109 no final closeout。 |
| Wave chronology | `git log --reverse --format='%h %ad %s' --date=short -- apps/editor packages` | W0 `8304709`、W57 `ae02025`、W70 `49a0510`、W92 `16294d4`、W102 `d2e7b7e`等の時系列。 |
| Post-102 path classification | `git show --stat --oneline 2f80ca0 6645c2f 1f07270 356959c 04e24cd e4e8c9d d9f3f1d e9113ab d1b2348 70485f4 8640d12 899cb2e` | authoring-host、Editor dynamics/mesh/perf、Electron、transparent margin、contentInset、uvRectをmainlineではなくspecializedとして分類。 |
| Map count scan | PowerShell `Get-ChildItem .../waves|reviews` + `_map.md` existence | `wave_count=105`, `review_count=105`, missing `51..55`。 |
| Final-like scan | PowerShell `Get-ChildItem discussion/implementation/waves -Recurse -File` + final/closeout filename filter | 119 filenames。artifact数であり、同型final verdict数ではない。 |

## 11. Limitations

- このrefreshでは新規source/test、browser、GPU、Electron、real-device、PNG目視を実行していない。既存 report/review/commit の証拠種別を再分類した。
- Wave0–50はreport/reviewの命名・粒度が均一でない。Wave51–55はpurgeにより原典map/report/reviewが存在しない。W56はstandalone finalなし、W109はDomain A partialである。
- Gitのsource-path logはdocumentation-only waveを完全に表さない。wave map/orchestrationとcommitの片方だけでstatusを確定しない。
- `implementation pass`、clean review、focused tests、baseline comparisonは、そのまま product/visual/device/legal human acceptanceではない。
- 現在のEditor能力一覧、未追跡ファイル、worktreeの並行変更、他topic（Runtime Player、model-authoring、Electron、Soul等）の完全な状態はこのreportの非目標である。
