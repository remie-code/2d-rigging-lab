# Design / Development Convention Map Freshness Audit

基準点は監査契約の指定どおり Git HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`、2026-08-08 (Asia/Tokyo)。既存 map / source / test / config は変更していない。担当範囲は `discussion/design/**/_map.md` と `discussion/development_convention/_map.md` である。

## 1. 確認対象と判定

| Map | Role | 判定 |
|---|---|---|
| `discussion/design/_map.md` | living-current-state + living-index | **Stale** |
| `discussion/design/canvas-evaluation/_map.md` | living-current-state + living-index | **Partially stale** |
| `discussion/design/mesh-generation/_map.md` | living-current-state + living-index | **Partially stale** |
| `discussion/design/mesh-rendering/_map.md` | living-current-state + living-index | **Partially stale** |
| `discussion/design/module-contracts/_map.md` | living-index + design decision index | **Stale** |
| `discussion/design/mvp-authoring-runtime/_map.md` | living-index of MVP design set | **Partially stale** |
| `discussion/design/screen-design/_map.md` | living-current-state + living-index | **Stale** |
| `discussion/design/screen-design/components/_map.md` | living-index | **Current** |
| `discussion/design/screen-design/screens/_map.md` | living-index | **Partially stale** |
| `discussion/design/texture-atlas/_map.md` | living-current-state + living-index | **Stale** |
| `discussion/development_convention/_map.md` | living-index + policy handoff | **Partially stale** |

対象 map は上記 11 件。全 map の相対リンクを read-only に検査したところ、明確な不存在リンクは `discussion/design/screen-design/_map.md:21` の `inventories/_map.md` だけだった。

## 2. 共通の現在事実（設計判断と実装事実を分離）

- **実装事実:** Wave66 は `CanvasEvaluatedScene` 境界、評価済み mesh / overlay / hit-test を実装済み（`discussion/implementation/waves/wave66/wave66-final-integration-report.md:38-47`）。実体は `apps/editor/src/workspace/canvas/canvas-evaluation.ts:31-45` と同ファイルの `createCanvasEvaluatedScene`。
- **実装事実:** WebGL2 共通 renderer foundation は Wave67 で `packages/render-core` / `packages/render-webgl2` に追加され、Editor は WebGL2 を先に試し Canvas2D fallback を使う（`discussion/implementation/waves/wave67/wave67-final-integration-report.md:20-34`）。
- **実装事実:** Mesh Tool の既定 method は `auto-outline-v6d-adaptive-contour-constrainautor`（`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:69-71`）。現行 UI には評価用 v6/v7 generation toggle も存在する（同:73-94、`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:264-290`）。
- **実装事実:** Texture Atlas の新規 preview/apply 既定 algorithm は `single-page-skyline-v1`（`packages/authoring-core/src/texture-atlas-packing.ts:25-31,138-176`）。Wave101 final report は既定化、旧 shelf artifact 読み取り互換、Blocking Issues UX を `pass` と記録する（`discussion/implementation/waves/wave101/wave101-final-integration-report.md:5-15,60-64`）。
- **実装事実:** Variant Manager v0 は Wave99 `pass`（`discussion/implementation/waves/wave99/wave99-final-integration-report.md:5-15,79-83`）で、React UI は `apps/editor/src/workspace/variants/variant-manager-screen.tsx:1-25` にある。
- **実装事実:** Validation / Diagnostics v0 は Wave85 `pass`。専用 read-only Diagnostics screen、badges、jump、inline diagnostics が実装済み（`discussion/implementation/waves/wave85/wave85-final-integration-report.md:1-25`）。
- **実装事実:** Runtime Export v0 は Wave92 `pass`（`discussion/implementation/waves/wave92/wave92-final-integration-report.md:1-24`）。
- **設計・方針決定:** Dynamics v0/v2 の `scalarDampedFollowV1` / `dynamics-file-v2` は Wave106 で、世界系 Verlet chain `worldFrameChainV1` / `dynamics-file-v3` に破壊的置換された。設計 oracle は `discussion/design/dynamics-world-frame-chain.md`、最終 report は `discussion/implementation/waves/wave106/wave106-final-integration-report.md:5-13`。
- **実装事実:** Wave108 は boundary-transparent-margin Option E を `pass` とし、透明 gutter、非 clamp UV、LINEAR、editor/export/runtime parity を確定した（`discussion/implementation/orchestration/_map.md:215`）。
- **実装事実:** 現在の Editor package boundary は `apps/editor/package.json:19-25`（authoring-core / contracts / operation-core / render-core / render-webgl2 / runtime-core）、runtime core 自身は contracts + zod のみ（`packages/runtime-core/package.json:2-11`）。
- **計画・未決:** Wave108 後の次 action は user visual gate であり、wave48 を「planned next wave」とする記述は現行 planning truth ではない（`discussion/implementation/orchestration/_map.md:215`）。

## 3. Map 別所見

### 3.1 `discussion/design/_map.md` — **Stale**

**疑わしい行:**

- `:51` は Minimum Open Dynamics v1 の固定式を `scalarDampedFollowV1` とするが、現在の正は `worldFrameChainV1` / `dynamics-file-v3`（Wave106 evidence 上記）。これは設計判断（旧方式の置換）と実装事実（現行 schema/solver）双方に反する。
- `:54` は V2 系統と `auto-outline-v4-contour-band` を次 wave sidecar 候補として扱うが、現行 Editor default は v6d adaptive contour（`mesh-tool-state.ts:69-71`）。v4 は Wave67 で非既定 sidecar、v7 margin は Wave108 系統の別実装である。
- `:56` は skyline を「次の target」とするが、Wave101 で既定化済み（`wave101-final-integration-report.md:9,60`）。
- `:57` は Canvas evaluation を設計中とするが、Wave66 が評価済み scene / overlay / hit-test を実装済み（Wave66 report:38-47）。
- `:70` の「実装着手時に設計から module contract/tests へ落とす」は、contracts/runtime/operation/validator の source と fixtures/test が既に存在する現在には古い next action である。
- `:78-80` は AI 接続、shared runtime、GUI screen scope を未決のまま記録する。AI boundary は accepted policy（`discussion/design/codex-friendly-automation-policy.md:8-18`）、shared runtime の package boundary は `apps/editor/package.json:19-25` / `packages/runtime-core/package.json:2-11`、screen の多数は Wave57-W101 で実装済みであり、少なくとも「未決」のままでは不正確。
- `:81` の Pre-Wave51 screen discussion は歴史的メモとしては正しいが、現在の設計焦点としては stale。
- `:83` の runtime evaluation semantics 未決は、Wave106 の accepted dynamics oracle と現在の runtime-core evidence（上記）により部分的に解消済み。ただし未決の細部が残るなら、確定済み部分と分離すべき。

**現在の情報種別:** `:51/:54/:56/:57/:70` は誤った repository/implementation status、`:78-83` は resolved decision と remaining user decision の混在、`:84` の preset/facade 未決は設計未決として妥当。

**親 map への含意:** root `discussion/_map.md` 統合では、この map を current design entry として無条件に採用せず、Dynamics v3、v6d/v7 mesh、Canvas evaluation、Skyline/Wave101 を正規参照へ差し替える必要がある。

**未知点:** `:78-80` のうち「外部 Codex transport を将来どこまで開くか」「最終 screen policy」は未決のまま。resolved baseline と future decision をユーザー承認後に分割する必要がある。

### 3.2 `discussion/design/canvas-evaluation/_map.md` — **Partially stale**

**疑わしい行:** `:21-24` は「次の主目標」「評価済み scene へ寄せる」を現在焦点としているが、Wave66 で達成済み。`:28-31` の最小型具体化、headless helper 切り出し、renderer migration、draft/drag履歴テストも、Wave66 source/tests と同 report によって大部分が実装済み。

**現在の事実:** `CanvasEvaluatedScene` 型と評価関数は `apps/editor/src/workspace/canvas/canvas-evaluation.ts:31-45` にあり、Wave66 final report は parameter/deformer/opacity/rotation/draft と evaluated rendering/overlay/hit-test を pass とする。

**情報種別:** map の境界 (`:12-17`) は設計責務として current。stale は current-focus/next-action の実装状態だけで、設計 oracle 自体は有効。

**親 map への含意:** design root では Canvas evaluation を「設計中」ではなく「implemented; remaining polish/verification」として扱う。

**未知点:** Wave66 の renderer/pixel oracle は semantic/call-level evidence であり、screenshot/pixel correctness は未証明（同 report の evidence basis）。

### 3.3 `discussion/design/mesh-generation/_map.md` — **Partially stale**

**疑わしい行:**

- `:38-39` は V2.5/V2.6 を current主候補/refinement とするが、現行 default は `auto-outline-v6d-adaptive-contour-constrainautor`（`mesh-tool-state.ts:69-71`）。
- `:43-45` は v6a/v6b/v6c の一時 selector、v6d/e/f 次候補、selector撤去を current narrative とする。Wave68-71 でその候補系列は比較・選定を終え、v6d mainline が受け入れられている（`discussion/implementation/orchestration/_map.md:123-127`、`discussion/design/mesh-generation/_map.md:47-48`）。
- `:48` の「algorithm selector UI は復活させない」は、通常の semantic backend selector を復活しないという意図なら維持可能だが、実際には評価用 v6/v7 toggle がある（`mesh-tool-state.ts:73-94`、`mesh-tool-inspector.tsx:264-290`）。この区別が map にない。

**現在の事実:** default method は v6d、v6/v7 evaluation toggle は source にあり、Wave108 は v6d margin/transparent-boundary semantics をさらに確定した。V2/V3/V4/V6 candidate 文書は比較・歴史的 evidence としてはリンク価値がある。

**情報種別:** `:10-25` の child inventory は design/experiment index として概ね current。`:38-48` は historical experiment と current default を混在させた repository/design status。

**親 map への含意:** root/design screen の mesh status は v6d mainline + v7/transparent-margin sidecar とし、V2.5/V2.6 は historical sidecar、V4/V6 candidates は evidence index として分離する。

**未知点:** v7 toggle を user-facing UX として残すか、internal evaluation-only とするかは map/doc と実装の scope decision が未明確。

### 3.4 `discussion/design/mesh-rendering/_map.md` — **Partially stale**

**疑わしい行:** `:31` は WebGL2 renderer foundation を「次 wave で設計・実装」するとするが、Wave67 で `render-core`/`render-webgl2` と Editor adapter が実装済み（Wave67 report:20-34）。`:33` は V4 を次候補とするが、V4 sidecar は同 Wave67 で実装済み。` :10` の Draft architecture basis は、architecture contract がまだ draft という意味なら維持可能だが、実装未着手を意味してはならない。

**現在の事実:** Primary WebGL2、shared RenderScene contract、Canvas2D fallback は map `:20-27` と source/report で整合。Wave108 の transparent margin/LINEAR/atlas parity は boundary child doc と final report で implemented。

**情報種別:** `:20-27` は accepted design direction、`:31-33` は stale implementation next actions。

**親 map への含意:** Mesh rendering は「foundation implementation済み、full pixel oracle/Stage sunset は未証明」と要約する。

**未知点:** 実 WebGL/readPixels pixel proof と Canvas2D Stage 完全撤退時期は未確定（Wave76/remaining backlog の fake-GL・pixel-oracle制約）。

### 3.5 `discussion/design/module-contracts/_map.md` — **Stale**

**疑わしい行:**

- `:38` は module contract の中心判断として `scalarDampedFollowV1`、weighted sum、Minimum Open Dynamics v1 を固定するが、Wave106 がその runtime/package/schema を `dynamics-file-v3`/`worldFrameChainV1` へ破壊的置換している（Wave106 report:5-13）。この row は現在の contract truth ではない。
- `:20` の RuntimeEvaluationContext/sequence artifact 更新は現行 contracts/runtime evidence と整合する一方、同一 child `runtime-core-contract.md` の scalar solver 詳細（例 `:40`）は置換後も残るため、map と child docs が分裂している。
- `:52` の「contract testsへ落とす fixture 実体を作る」は `fixtures/contracts/` と多数の package tests が既に存在するため、未着手 action としては stale/過度に広い。

**現在の事実:** `packages/contracts/src/runtime-sequence.ts`、`packages/runtime-core/src/runtime-core.ts`、`packages/operation-core/src/operation-result.ts`、`packages/validator-core` の evidence tests が RuntimeEvaluationContext/state/sequence refs を実装済み。Runtime Export は Wave92 pass である。

**情報種別:** `:38` は誤った accepted design decision、`:20/:22-26` は現行 repository facts と design contract の混合、`:52` は実装後の next action。

**親 map への含意:** module-contracts は dynamics v3 への contract refresh が完了するまで current source-of-truth として扱わず、更新後に root map から参照する。

**未知点:** Wave106 破壊的置換を module contract 文書全体へ適用する owner/ユーザー承認が未記録。旧 scalar docs を historical evidence として残すか、全面 rewrite するかは判断点。

### 3.6 `discussion/design/mvp-authoring-runtime/_map.md` — **Partially stale**

**疑わしい行:** `:41` は Minimum Open Dynamics v1 を MVP 採用済みとする。MVP 縦切り・shared runtime・validator/AI boundaries (`:36-40`) は概ね有効だが、Dynamics 部分は Wave106 の v3 chain に置換済み。child `03-runtime-evaluation-semantics.md` および module-contracts child docs に scalar solver 記述が残る。

**現在の事実:** package/app boundary は `apps/editor/package.json:19-25` と `packages/runtime-core/package.json:2-11`、runtime evaluation evidence は current source/tests にある。MVP map は design-set index としてはリンク網羅している。

**情報種別:** `:36-40` は設計方針、`:41` は obsolete implementation/contract claim、child docs の `Draft` は設計文書 status であり実装未着手の主張とは限らない。

**親 map への含意:** MVP map は全体を捨てず、Dynamics row と child references のみ v3/current runtime evidence に差し替える。旧 scalar docs を historical record と明示する必要がある。

**未知点:** MVP AC と Wave106 v3 chain の完全な traceability（どの AC を v2→v3 で再承認したか）はこの map から確認できない。

### 3.7 `discussion/design/screen-design/_map.md` — **Stale**

**疑わしい行:**

- `:21` は `inventories/_map.md` を索引するが、`discussion/design/screen-design/inventories/` は存在しない（read-only `Test-Path` false）。
- `:31` の「placeholder preview から visible layer/group preview へ」は、現在 `PsdPreview` が `createPsdImportPreview(plan)` と visible layer count/canvas を描画済み（`apps/editor/src/features/psd-import/components/psd-import-modal.tsx:260-292`）。これは Wave58 の歴史的 scope と現行状態を分離すべき記述。
- `:40` は Wave54 A-H 後も Mesh / Atlas / Parameter Manager / Variant UI が未完了とするが、Mesh/Parameter/Atlas/Variant は Wave64-71/87-101 で実装済み。Diagnostics/Codex の full human-facing view が残る部分だけは current backlog（`discussion/implementation/remaining-work-backlog.md:65-90`）と整合する。
- `:45` は V2.5/V2.6 を現在の mesh主候補とするが、v6d default（`mesh-tool-state.ts:69-71`）に superseded。
- `:54` の v0 keyform target は Rotation angle を列挙するが translation を欠く。Wave73-75 と current backlog は Rotation angle / translation / opacity を accepted target とする（`discussion/implementation/remaining-work-backlog.md:47-51`）。
- `:55` は Variant Manager を「次の開発スコープ」とするが、Wave99 Editor Variant Manager v0 は `pass`（Wave99 report:5-15,79-83）。
- `:62-63` の Wave57/Wave58 後に Mesh/Rig/Atlas/Parameter/Variant/Dynamics/Viewer を昇格する next action は大部分が完了済みで obsolete。Diagnostics/Codex full UI と PSD polish は remaining backlog に再整理されている。

**現在の事実:** Wave85 Diagnostics v0、Wave92 Runtime Export、Wave99 Variant Manager、Wave101 Skyline/Blocking Issues、Wave106 Dynamics v3、Wave108 renderer boundary は各 final report で pass。Wave54-era statements を current として使わないよう remaining backlog 自身が警告している（`discussion/implementation/remaining-work-backlog.md:120-128`）。

**情報種別:** `:27-34,41-44,46-58` の多くは UX policy/accepted intent、`:35-40,45,54-55,62-63` は stale implementation status、`:66-73` は unresolved UX policy と quality-gate decisions。

**親 map への含意:** screen-design map は current entry としての再構成が必須。Wave54 historical scope、current implemented features、remaining Diagnostics/Codex/visual QA を三層に分ける。

**未知点:** 最終 task presentation policy（modal/task-window/dedicated view）、full Diagnostics/Evidence/Codex views の置き場所、visual accessibility sign-off は未決。

### 3.8 `discussion/design/screen-design/components/_map.md` — **Current**

リンク先 9 component docs（Toolbox、Parts Tree、Canvas、Inspector、Mesh、Rig、Dynamics、Parameter/Keyform）は全て存在し、map 自身は role/status の lightweight index に徹している。Child docs に Wave-era detail が残るものはあるが、map 行の role/status を誤らせる証拠は確認できなかった。

**親 map への含意:** components map はそのまま参照可能。ただし child docs の implementation claims は source/wave reports と照合する。

**未知点:** component docs の `Draft` と implemented behavior の境界を、今後 map status に表すかは未決。

### 3.9 `discussion/design/screen-design/screens/_map.md` — **Partially stale**

**疑わしい行:**

- `:14` は Texture Atlas Task を Wave88 artifact-only Apply までしか記録しないが、Wave101 で Skyline default/Blocking Issues も実装済み（Wave101 report:9-15,60-64）。
- `:15` は Runtime Export Task を Accepted/Draft とするが、Wave92 final integration は Runtime Export v0 を `pass` とする（Wave92 report:3-24）。設計文書が Draft であることと実装済み status を分離すべき。
- `:19` は Viewer を Wave88 Atlas Runtime までしか記録しない。Wave84 playback と Wave100 Variant switching も current implementation facts。
- `:20` は Diagnostics を Wave84 後議論の Draft とするが、Wave85 で read-only Diagnostics screen/badges/jumps/inline diagnostics が `pass`。full Evidence view は未実装なので、v0 implemented と full view draft を分けるべき。

**現在の事実:** listed screen files は全て存在。`project-storage-task.md` の superseded direction、`tutorial-task.md` placeholder などは status と整合する。

**親 map への含意:** screen child map は `design status` 列と `implementation status` 列を分けると、Draft screen spec と Wave pass を同時に表現できる。

**未知点:** Viewer/Diagnostics/Codex の最終 UI surface と visual QA gate は未決。Wave85 Diagnostics v0 が full Evidence View の代替かどうかは user scope decision が必要。

### 3.10 `discussion/design/texture-atlas/_map.md` — **Stale**

**疑わしい行:**

- `:20` は「現行 `single-page-shelf-v1`」とするが、source の `DEFAULT_TEXTURE_ATLAS_PACKING_ALGORITHM_ID` は Skyline（`packages/authoring-core/src/texture-atlas-packing.ts:25-31`）。
- `:21-22` は Skyline を次の改善 target とするが、Wave101 で既定化済み。旧 shelf は backward-readable artifact として残る（Wave101 report:9,60）。
- `:28` の next action「Skyline を実装し default 接続」は完了済み。`:29-30` の mixed-size/determinism/旧 artifact verification も Wave101 tests/report で pass。

**現在の事実:** `boundary-transparent-margin-design.md` / map `:11,24` の Wave108 Option E は current。Texture Atlas target extraction、artifact-only Apply、Original/Atlas Runtime boundary は Wave87-101 で current.

**情報種別:** `:20-22,28-30` は誤った implementation status、`:24` は accepted/implemented rendering decision、`:33-35` は future design questions。

**親 map への含意:** texture-atlas map は current algorithm を Skyline とし、shelf を historical compatibility path に降格する更新が必要。Root design map `:56` も同時に更新対象。

**未知点:** Skyline 後に algorithm selector を user-facing に出さない方針、将来 trim/rotation/multi-page の扱いは未決（map `:33-35`）。

### 3.11 `discussion/development_convention/_map.md` — **Partially stale**

**疑わしい行:** `:36` は「planned next wave = wave48-plan.md」とするが、現在は Wave108 final complete/pass と user visual gate pending（`discussion/implementation/orchestration/_map.md:215`）。Wave48 は完了済み historical implementation plan（`discussion/implementation/orchestration/_map.md:201`）であり、next wave ではない。

**現在の事実:** `:9-13` の entry points は存在し、policy groups `:19-22` は directory files を概ね網羅する。`source-file-organization-policy.md` / `ux-backed-package-logic-authority.md` の accepted policy handoff と `.agents/skills/implementation-orchestration/SKILL.md` の active procedure は current.

**情報種別:** `:36` は stale planning fact、`:26-31` は current policy/decision summary、`:35`/`:37` は reusable process guidance。

**親 map への含意:** development convention map は policy index として維持できるが、next action を Wave108 user gate / planning-gate に差し替え、Wave48 を historical entry と明示する。

**未知点:** 次の実装 wave（Viewer/Dynamics hardening、Diagnostics/Codex UI、または別 product direction）は user choice pending。

## 4. 情報種別の分離チェック

- **公式事実:** この監査では外部仕様を根拠にせず、repository source/test/Git implementation reports のみを使用した。
- **リポジトリ事実:** package/app boundary、existing files、source defaults、test/report pass を上記 file:line で確認した。
- **設計・方針決定:** Codex-friendly automation boundary、shared runtime、Dynamics v3、WebGL2 primary、transparent-margin Option E、Texture Atlas artifact semantics は accepted docs/reports として扱った。
- **実験・検証結果:** Wave66/67/85/92/99/101/106/108 の final reports と focused tests を pass evidence として扱った。Wave67/remaining backlog が pixel oracle 未証明と記録している点は implementation claim に昇格させていない。
- **未決事項:** final screen presentation, full Diagnostics/Evidence/Codex surface, visual/pixel QA, Skyline future trim/rotation/multi-page, v7 toggle policy は unresolved のまま残した。

## 5. 未調査・ユーザー判断点

1. この監査は対象 map と主要 child design docs/source/tests/reports に限定した。各 child doc 本文の全 stale prose（特に旧 Wave-era paragraphs）までは網羅修正していない。
2. `discussion/design/module-contracts/` の Dynamics v3 全文 rewrite、`discussion/design/mvp-authoring-runtime/` の AC traceability refresh、旧 scalar docs の historical archive 化は、ユーザー/文書 owner の判断が必要。
3. Wave108 user visual gate（atlasRuntime の目視）は本監査では実行していない。
4. Map 更新の順序（子 map → 親 map、または一括）と、stale map を current 状態へ更新するか historical index として固定するかは、監査後のユーザー判断である。

## 6. 親 map 統合用短結論

- Current としてそのまま採用可能なのは `screen-design/components/_map.md`。
- Current design map の更新優先度が高いのは、`design/_map.md`（Dynamics/Mesh/Canvas/Atlas）、`screen-design/_map.md`（Wave54-era claims + missing inventories link）、`texture-atlas/_map.md`（Shelf→Skyline）、`module-contracts/_map.md`（scalar→Dynamics v3）。
- `canvas-evaluation/_map.md`、`mesh-generation/_map.md`、`mesh-rendering/_map.md`、`mvp-authoring-runtime/_map.md`、`screen-design/screens/_map.md`、`development_convention/_map.md` は、設計意図と child links を保ちながら current implementation/status 行だけを更新するのが安全である。
