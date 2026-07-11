# AI Cohost C3 Wave Plan: 視線と頭が生きる

> Objective: 自律ホストのモデルが、まばたきに加えて視線(サッカード+固視)・頭(多時間軸ノイズ+視線追従)・姿勢(ドリフト+組み替え)で生き、Physiologyページのツマミで質感がその場で変わり、Stage Presence(既定Off)で画面上の存在感をon/off比較できる。30秒眺めて機械のループに見えない。

## 1. Status

- Status: **実装完了・機械ゲート green・3レーンレビュー全 PASS(2026-07-11)。手動ゲート(§7、ユーザー実施)待ち。**
  - Domain A→B→C→D→E を単一 Orch-Sylph が順次実行。各実装は別コンテキスト Gnome、レビューは別コンテキスト Review-Sylph(ネスト分離)。実装報告=[../waves/c3/](../waves/c3/)、レビュー=[../reviews/c3/](../reviews/c3/)。
  - **レビュー判定**: Domain A/B/D は spec/design/test 3レーンとも PASS。Domain C は lane2(design)が Strength スライダー機能不全の確定バグで一旦「要修正」→ Gnome の F1 修正(`physiology-state.ts` 一点、`assertNumericField`→`assertToneField` 緩和)で解消・再レビュー合格、lane1/lane3 は PASS。**全12レーン最終 PASS、blocking ゼロ。**
  - **Domain E 最終統合(2026-07-11)**: 全体テスト **729 passed / 2 failed**(731、失敗は既知 Wave21 browser-source baseline のみ・下記)、typecheck パス。§2 無変更確認を git 証拠つきで完了(blink golden 2本・resolver 等価 golden・`headless-slot-resolver`/`body-follow-state`/`semantic-slot-definitions`/window-state stageMotion.settings・`stage-motion-transform`/transport・Editor/package-format/Runtime Export schema/lockfile・自律ホスト既存 Stage Motion UI いずれも無変更)。全差分は `apps/runtime-player/` + `discussion/` に限局。Domain D レビュー Lane3 N1(deadZone/reaction 未固定)を回収する test-only スナップショット1本を `stage-presence-drive.test.ts` に追加。詳細=[../waves/c3/domain-e-final-integration.md](../waves/c3/domain-e-final-integration.md)。
  - **既知 baseline fail(C3 対象外・無変更)**: `src/main/broadcast-source/browser-source-server.test.ts` + `src/stage/browser-source/browser-source-server-message.test.ts`。差分は `effectiveDynamicsTuning: null` の1キーのみ(Wave21 由来)。live HTTP server 群で失敗数が 2〜3 に揺れる flaky(どの test が落ちるかは run 毎に変動するが常に同2ファイル・同 shape)。physiology/stage-presence/role-composition 系は3連続実行で一度も失敗せず。
- Planning gate: context-check(前提監査)→ inventory(実施済み → [c3-planning-inventory.md](c3-planning-inventory.md)。Verdict `needs_design` → 下記ユーザー裁定で解消)。
- Model Allocation: **L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須**。
- ユーザー裁定(2026-07-11):
  1. **滑らかさは閉形式の減衰乱歩**(timeの純関数、フレームレート非依存)。dt積分による非純関数化を禁止(C2のfixture規律維持)。
  2. **body平滑は生成器内部の決定論バネで完結**。既存EMA(`body-follow-state`)は通さない(あれはトラッキングのジッタ取り。生成器出力は構成的に滑らか)。fixture境界を清潔に保つ。
  3. **ツマミ即時反映のseam**: Physiology state(main、両ロール共通)→ 合成depsのconfig provider → autonomousHostのみ心臓へ配線(role差は合成テーブル1点)。config変更時は生成器再構築、**位相不連続は許容**(視線は元々跳ぶ。頭・姿勢のスナップが手動ゲートで気になればクロスフェードを追撃——escalate可能な形にする)。Blink baselineも同経路に載せ替える。
  4. **プロファイルは並列複製**(Dynamics Tune storeの型を写す。共通化しない)+fingerprintパス分離+schemaVersion拒否のみ(dynamicsSignatureHash相当は不要——生理は普遍語彙)。保存先はスロットuserData配下。
  5. **30秒ゲートの機械側代理=周期非検出の属性テスト**(多層ノイズの合成周期が30秒窓で検出されないこと)。fixture配分: **blink=フルgolden維持、連続系(gaze/head/body)=代表時刻スナップショット+分布属性**(golden肥大回避)。
  6. **Stage PresenceはC3本体スコープとして無条件実装**(ユーザー修正: 「実装はするけどon/offできるようにしておく。これ込みで人間がチェックする」)。ドメイン順序は姿勢の下流として最後、トグル+strength(既定Off)、人間ゲートに「onにして比較」を含める。駆動は姿勢連動のみ、既存 `stageMotion.settings` に相乗りしない(設計§5)。
  7. **Blink露出はC3スコープ**(Frequency/Calmness/Crispness/Quirk。設計§6表に追記済み)。
  8. **自律ホストの既存Stage Motion UI(押せるが効かない)はC3で触らない**(正規解はC4の自律Control UX)。
- Source of truth(実装前に読む):
  - 本計画。
  - 設計討議: [../../architecture/c3-gaze-head-posture.md](../../architecture/c3-gaze-head-posture.md)(三現象の解剖・文法・結合・アンチパターン・Stage Motion裁定・質感語対応)
  - UX定義: [../screens/c3-physiology-profile.md](../screens/c3-physiology-profile.md)(Physiologyページ)
  - 棚卸し: [c3-planning-inventory.md](c3-planning-inventory.md)(コード接地事実+主要ファイル索引)
  - Stage Motion調査: [../../research/stage-motion-for-autonomous-idle.md](../../research/stage-motion-for-autonomous-idle.md)(候補c)
  - 前提の型: [c2-wave-plan.md](c2-wave-plan.md)(physiology純度・合成テーブル・fixture流儀)
  - wave方式: [../../../runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md](../../../runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md)

## 2. Product Goal

この波の後にできること:

- 自律ホストのモデルが、視線を跳ばせて留め、頭を多時間軸で揺らし、たまに座り直す。目が先・頭が後の協調、大サッカードへの瞬き同期、体は頭の親、が効いている。
- Control Windowの `Physiology` ページで質感語スライダーを掴むと、隣で生きている体の空気がその場で変わる(Blink含む)。
- プロファイルはRuntime Export fingerprintごとに自動保存され、再起動で復元される。
- Stage Presenceトグル(既定Off)をonにすると、姿勢に連動して画面上の位置がわずかに動く。人間ゲートでon/off比較できる。
- トラッキングホストは挙動等価(退行ゼロ)。C2のblink goldenは既定設定で不変。

## 3. 責務境界

### 3.1 この波がやること

- 決定論ノイズ/バネ基盤: 閉形式の減衰乱歩・ホームバネのヘルパ(`deterministic-hash.ts` の拡張)。
- ツマミ即時反映プラミング: Physiology state(main)→config provider→心臓の生成器再構築seam。Blink baselineの同経路への載せ替え。
- 振る舞いクラス3種: gaze(サッカード+固視+着地点分布)/ head(3層ノイズ+目頭協調)/ posture(ドリフト+組み替え)。結合3つ(目先頭後・大サッカード瞬き同期・体は頭の親)。
- fixture拡張: 連続系のスナップショット+分布属性+周期非検出テスト。blinkフルgolden維持。
- Physiologyページ+プロファイル永続化(並列複製、bridge両ロール登録、trackingHost空状態)。
- Stage Presence: 姿勢信号→ `composeRuntimePlayerStageMotionTransform` 供給(候補c)、トグル+strength、既定Off。

### 3.2 この波がやらないこと(Out of Scope)

- 呼吸(keyform未作成)、口・眉の生理(C2既定のまま)。
- 情動・変調(C5)。ツマミはbaseline層のみ(modulation=恒等)。
- パッケージのエンベロープ宣言(第二段)、Editorのアイドルプレビュー。
- 自律ホストの既存Stage Motion UI(Live Controller "Motion Safety" / StageページEnabled)の手当て(裁定8、C4)。
- 操縦チャネル(C4)。
- Editor / package-format / Runtime Export schema / lockfile変更、新規依存、`pnpm install`。
- 頭無しリゾルバ(`headless-slot-resolver.ts`)の変更(不要のはず。必要ならescalate)。

## 4. 設計要点(棚卸し接地)

### 4.1 決定論ノイズ/バネ(Domain A)

- `physiology/` に閉形式ヘルパを追加: 平滑ノイズ(点サンプル `hashUnit` の平滑補間)、減衰乱歩、ホームバネ。全てtimeの純関数(裁定1)。
- 心臓のconfig反映口: 現状は起動時seedのみ・configクロージャ捕捉(`autonomous-frame-heart.ts`)。config providerを合成depsに追加し、変更時に生成器を再構築(位相不連続許容)。両ロール共通のPhysiology state(main)がconfigの持ち主。
- Blink baseline configを同経路へ載せ替え。**既定configの出力がC2のblink golden 2本と完全一致すること**(載せ替えの退行ゲート)。

### 4.2 振る舞いクラス(Domain B)

- gaze: 固視時間分布(ばらつき+不応期)、着地点の重み付き空間バケツ抽選(ホーム=カメラ優勢)、サッカードは瞬時遷移(lerp禁止=アンチパターン1)。
- head: 3層ノイズ(周波数比は普遍既定)+ホームバネ+目頭協調(大サッカード時に300〜700ms遅れで部分追従)。
- posture: 遅いドリフト+稀な組み替えイベント(基線移動)。体は頭の親(組み替えは頭の基線ごと動かす)。body slotは生成器内部バネで完結(裁定2)。
- 大サッカードへの瞬き同期(確率的)。
- 全て `SemanticSlotActivationContribution` 契約(-1..1)で出力し、既存リゾルバをそのまま通す。
- テスト: スナップショット+分布属性(固視時間分布・不応期・追従遅延・組み替え頻度)+**周期非検出**(裁定5)+同種同列・異種異列。

### 4.3 Physiologyページとプロファイル(Domain C)

- store/state/save-controllerはDynamics Tuneの並列複製(`dynamics-tuning-profiles/` の型を `physiology-profiles/` に写す)。stale意味論=fingerprintパス分離+schemaVersion拒否のみ(裁定4)。
- bridgeは両ロール登録し、`getStatus` が「生理サブシステム有無」をdataで返す → renderer/mainとも `if(role===)` を書かずにtrackingHost空状態(UX §6.2)を出す。
- ページはUX定義([../screens/c3-physiology-profile.md](../screens/c3-physiology-profile.md))どおり: 質感語スライダー(数字なし)、セクション別Reset、自動保存(debounce)、プレビューボタン不在(Stageが常時プレビュー)。
- ツマミ→内部素子の写像は設計§6の対応表に従う。

### 4.4 Stage Presence(Domain D)

- 姿勢生成器の正規化信号(body基線+ドリフト)を純計算器 `composeRuntimePlayerStageMotionTransform` へ供給(候補c。偽TrackingFrame/偽キャリブレーション禁止)。
- subsystem seam(供給の有無)で役割差を表現。トグル+strengthはPhysiologyページのStage Presenceセクション(既定Off)。既存 `stageMotion.settings` とウインドウ状態には触れない。
- 二重適用リスク(body.angleリグ変形+Stageオフセット)への手当て: strength既定は控えめに。

## 5. Wave Strategy

単一のOrch-SylphがDomainを順次実行する(A→B→C→D→E)。

| Domain | Work | 順序 |
|---|---|---|
| Domain A | 決定論ノイズ/バネ基盤+ツマミ即時反映seam+Blink載せ替え(golden不変) | 先行 |
| Domain B | 振る舞いクラス3種+結合+fixture拡張 | Aの後 |
| Domain C | Physiologyページ+プロファイル永続化+bridge | Bの後(configスキーマに依存) |
| Domain D | Stage Presence(姿勢信号→Stage transform供給+トグル) | Cの後(トグルの家がページ) |
| Domain E | 最終統合: モノレポ検証、docs/maps更新、手動ゲート手順、clean review | 最後 |

## 6. ドメイン別の要点(詳細は§4)

- **Domain A** (`cohost-c3-noise-and-config-seam`): テスト=閉形式ヘルパの純関数性(同time同値)・平滑性(隣接サンプル差の有界)・心臓のconfig差し替え・**C2 blink golden 2本の完全一致**・タイマーリークなし。Escalate=心臓のconfig seamが既存publish経路の広い改修を要する場合。
- **Domain B** (`cohost-c3-gaze-head-posture-behaviors`): テスト=§4.2記載+physiology純度の構造テスト。Escalate=リゾルバ変更が必要に見えた場合(§3.2)。
- **Domain C** (`cohost-c3-physiology-page-profile`): テスト=store parse/save/stale拒否・二スロット/二export独立・bridge契約(生理不在ステータス)・ページrender(スライダー/Reset/空状態2つ)・数字非露出。Escalate=既存Control shellがページ追加を受けない場合。
- **Domain D** (`cohost-c3-stage-presence`): テスト=供給on/offでcomposed transformが変わる/基底に戻る・既存stageMotion.settings非接触・Browser Source parity(sanitized composed transformのみ)。Escalate=純計算器の再利用が意味論的に成立しない場合。
- **Domain E** (`cohost-c3-final-integration`): C2と同じ(typecheck/対象テスト/既知baseline明示/無変更確認/docs更新「実装事実に合わせて関連ドキュメントを更新する」/手動ゲート手順)。

## 7. Manual Check Notes(ユーザー手動ゲート)

1. 自律ホスト起動→ロード→まばたき+視線+頭+姿勢が設定なしで生きている。
2. **30秒眺めて「機械のループに見えない」を判定**(単一周波数・完全中心回帰・三台の機械・動きすぎ、のアンチパターンが出ていないか)。
3. Physiologyページの各スライダーを掴んで、**隣の体の質感がその場で変わる**(Blink/Gaze/Head/Posture各1本以上)。
4. **Stage Presenceをonにして比較**(姿勢に連動した画面上の微動。過剰・不気味なら戻す——Offのまま運用でもC3は合格)。
5. プロファイルが再起動で復元される。Resetで既定に戻る。
6. トラッキングホストが従来どおり(退行なし)。トラッキングホストのPhysiologyページは空状態の一文。
7. OBS Browser Sourceでも同じ動き(視線・頭・姿勢+Stage Presence on時のtransform)。

## 8. Acceptance Criteria

- 自律ホストで視線・頭・姿勢が生き、結合3つが効いている(機械: 分布属性+協調遅延テスト。人間: §7-2)。
- ツマミ即時反映が全ファミリーで動く(Blink含む)。位相不連続は許容(裁定3)。
- 周期非検出テストがパスする(裁定5)。
- **C2のblink golden 2本が既定設定で不変**(載せ替え退行ゼロ)。
- physiology/純度維持(Electron import・壁時計・非シード乱数ゼロ)。`body-follow-state` を生成器経路が通らない(裁定2)。
- プロファイル: fingerprint別自動保存・stale拒否・スロット内配置・Saveボタン不在。
- Stage Presence: 既定Off、on時のみ姿勢連動transform、既存stageMotion.settings非接触、Browser Source parity。
- trackingHost合成に生理サブシステム不在(既存テスト維持)。実行時role分岐ゼロ(bridgeの「生理不在」はdataであってrole問い合わせではない)。
- リゾルバ・Editor・package-format・Runtime Export schema・lockfile無変更。新規依存なし。`pnpm install` なし。
- 対象テスト・typecheckパス、または失敗が証拠つきで分類される。

## 9. Subagent Contract

- `pnpm install` 禁止(回避工作も禁止。必要ならescalate)。
- Editorソース・package-format・Runtime Export schema・lockfile変更禁止。`headless-slot-resolver.ts` 変更は原則禁止(必要ならescalate)。
- 実行時role分岐禁止(役割差は合成テーブル+subsystem seamの一点)。
- physiology/の純度(Electron importゼロ・論理時刻・シード乱数のみ・閉形式)を守る。
- C1(スロット/役割合成/身元表示)・C2(リゾルバ等価性・blink golden・心臓ライフサイクル)の成果を退行させない。
- Browser Source primary path、Wave10 suspension、Wave11 Stage Motion(トラッキング側)、Wave12 Variant、Wave17 fast path、Wave18/19 diagnostics、Wave20 lifecycle、Wave21 Dynamics Tune、Wave22/23 vowel lip sync を退行させない。
- rendererへシード・rawスロット・私的情報を流さない。
- 無関係変更をrevertしない。決定論的な箇所にfocusedテスト。ドメイン想定外の共有ファイルは触る前に報告。

## 10. Review Policy

各実装ドメインに3レーンのReview-Sylph(別subagent、統合禁止): ①spec(本計画+設計討議+UX定義突合) ②design/development ③test adequacy。

blocking観点: 実行時role分岐の不在 / physiology純度(閉形式含む) / `body-follow-state` 非経由 / C2 blink golden不変 / トラッキング経路無退行 / sanitization境界 / 既存stageMotion.settings非接触 / 数字非露出(質感語のみ)。

## 11. Orchestration Policy

Implementation Orchestration skill の全規則に従う(C1/C2と同一: ネスト分離 / 在席ポーリング / 閉域 / モデル明示 / ループ上限5 / 早期脱出 / 必須文言)。

- L0(Undine): 計画・裁定・最終判定。実装しない。
- Orch-Sylph: 単一。Domain A→B→C→D→Eを順次。実装はGnome、レビューは3レーンReview-Sylphへ委譲。成果物は `../waves/c3/` / `../reviews/c3/`。
- 設計に無い判断分岐は実装で埋めずescalate。子が未完のままwave gateを通過しない。
