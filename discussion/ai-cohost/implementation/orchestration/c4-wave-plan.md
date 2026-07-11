# AI Cohost C4 Wave Plan: 外から動かせる(操縦チャネルv0)

> Objective: 外部プロセスがloopback WS+tokenで自律ホストに接続し、`intent.set` で `face.angle.x` が動く。契約違反は列挙コードで拒否される。参照ドライバ(特区 `apps/soul` の最初の住人)が持続駆動の機械テストを通す。Channelページ・自律ホスト版Overview・degradedページ解消でControlの借金を返す。人間の美的ゲートはない(外部駆動の美はC5)。

## 1. Status

- Status: **完全閉鎖(2026-07-11)**。機械ゲート緑+人間の一目確認合格(ユーザー実施 2026-07-11「動かしてみたが多分大丈夫だと思う」——外部駆動・イベントログ・切断→基底復帰・空状態を確認)。**持ち越し裁定1件**: Stage Presence×チャネルの結合可否(C4は非結合で閉鎖。Undine推奨=C5設計討議の冒頭議題として「合成後の実効body信号に追従」を本命仮説に。[../waves/c4/c4-followup.md](../waves/c4/c4-followup.md) ⚠)。v0繰延5件も同followup。以下は実装完了時の記録:
- (実装完了記録) 実装完了(Domain A〜E 実装+3レーンレビュー合格、機械ゲート緑)。
  - Domain A(契約の家+チャネルWSサーバ+拒否列挙6件+port/token採番): 完了・3レーン合格 → [../waves/c4/domain-a-report.md](../waves/c4/domain-a-report.md)。
  - Domain B(粗いオーバーレイprovider・心臓tick統合・TTL・切断→基底復帰・physiology純度不変): 完了・3レーン合格 → [../waves/c4/domain-b-report.md](../waves/c4/domain-b-report.md)。
  - Domain C(Channelページ+bridge+自律版Overview+degraded 6面解消+合成根のサーバ配線): 完了・3レーン合格 → [../waves/c4/domain-c-report.md](../waves/c4/domain-c-report.md)。
  - Domain D(特区 `apps/soul`+依存ゼロ参照ドライバ+持続駆動テスト RTT p95≈1.5〜2ms+方向ルール検査2ルール): 完了・3レーン合格 → [../waves/c4/domain-d-report.md](../waves/c4/domain-d-report.md)。
  - Domain E(最終統合: モノレポ検証・無変更確認・docs更新・fixture最終整合・follow-up記録): 完了 → [../waves/c4/domain-e-report.md](../waves/c4/domain-e-report.md)。
  - 機械ゲート: runtime-player typecheck 緑 / root typecheck 緑 / runtime-player 全体テスト **823 passed / 2 failed**(既知baseline Wave21 browser-source系2件は不変)/ check:deps 緑 / check:soul-zone 緑(1243 files)+ fixtures 5ケース緑。
  - **既知 baseline(C4起因でない)**: (a) 全体テストの2 fail = Wave21 browser-source系(`browser-source-server.test.ts`・`browser-source-server-message.test.ts` の `effectiveDynamicsTuning` 不一致、Domain A〜D 全報告で同一・browser-source は無変更)。(b) check:source の唯一の違反 = `apps/runtime-player/src/main/physiology/index.ts`(C3 既存 committed、C4 で未接触)。この2つ以外の fail・違反は無い。
  - 無変更確認(git): `pnpm-lock.yaml`・`pnpm-workspace.yaml`・Editorソース・package-format・Runtime Export schema・`physiology/` 配下(golden JSON 含む)・`headless-slot-resolver.ts` すべて無変更。`apps/soul` に package.json 無し。`pnpm install` 未実行。
  - 残: 人間の一目確認(§7、美的判定ではない)→ C4 閉鎖。外部駆動の美的ゲートは C5。
- Planning gate: context-check(前提監査)→ inventory(実施済み → [c4-planning-inventory.md](c4-planning-inventory.md)。Verdict `needs_design` → 下記ユーザー裁定で解消)。
- Model Allocation: **L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須**。
- ユーザー裁定(2026-07-11):
  1. **オーバーレイseam**: C3のconfig seamと**並列の第二provider**として心臓のtickに追加。`generator.sample()` 出力へRecordマージ、TTLはtickごとに壁時計照合。生成器の純度は無傷(オーバーレイはfixture境界の外のruntime状態)。config seamとは混ぜない。
  2. **チャネルは自律ホスト専有**(トラッキングホスト合成にチャネルサブシステムは存在しない)。
  3. **第二ポート・token**: browser-source型の並列複製。チャネル既定=autonomous-default 17310、別tokenファイル、スロット採番(手動ポート設定なしの規律維持)。
  4. **特区はstandalone回避**: `apps/soul/` に **package.jsonを置かない**(lockfile importer増加=install儀式を回避)。参照ドライバは依存ゼロのstandalone(Node 22ネイティブWebSocketクライアント)。正式workspace app化は実物の魂(依存を持つ日)まで繰延。
  5. **参照ドライバは `.mjs`**(素のNodeで動く。魂の形態非依存の手本)。「TSの参照クライアント」の約束は器側の機械テストハーネス(TS)が果たす。
  6. **特区方向ルール検査をC4で新設**: ①特区外から `apps/soul` をimportしたら違反 ②特区内から器のコードをimportしたら違反、の2ルールのみ(汎用DAG検証は作らない)。憲章§6の事実誤認訂正([../../concept/mvp-boundary-amendment.md](../../concept/mvp-boundary-amendment.md))とセット。
  7. **応答遅延ゲート**: 参照ドライバがintent送信→accepted応答のRTTを計測・記録し、**p95 < 100ms(loopback、緩め)**を機械ゲートとする(実測後に締める余地は残す)。
  8. **契約の家**: `apps/runtime-player/src/main/control-channel/contract/` にschema JSON+やり取り例JSON(+隣にTS型)。特区はJSONを**読むだけ**。packages/contracts昇格は実物の魂の日に検討(繰延)。
  9. **Channelページのnav位置**: Physiology直後(一旦確定)。
- Source of truth(実装前に読む):
  - 本計画。
  - 設計討議: [../../architecture/c4-control-channel-v0.md](../../architecture/c4-control-channel-v0.md)(契約二層化、外殻5点、TTL統一、v0 intent.set、粗いオーバーレイ、参照ドライバ、fixture=純JSON)
  - UX定義: [../screens/c4-channel-diagnostics.md](../screens/c4-channel-diagnostics.md)(Channelページ・自律Overview・degraded解消)
  - 特区憲章: [../../concept/mvp-boundary-amendment.md](../../concept/mvp-boundary-amendment.md) §6(6条+訂正)
  - 棚卸し: [c4-planning-inventory.md](c4-planning-inventory.md)(コード接地事実+主要ファイル索引)
  - 前提の型: [c3-wave-plan.md](c3-wave-plan.md)(合成テーブル・bridge dataパターン・fixture流儀)

## 2. Product Goal

この波の後にできること:

- 自律ホストのChannelページで `Open Channel` → 外部プロセスが `ws://127.0.0.1:17310/channel?token=…` で接続 → `server.hello`(capabilities)を受け、`intent.set` を送ると器のモデルの頭が動く。
- 契約違反(未知kind・不正payload・不正スロット・範囲外・書込不可)は列挙コードつきで拒否され、接続は維持される。Channelページのイベントログで人間にも見える。
- インテントはTTLで失効し、送信が止まれば(切断すれば)体は生理の基底へ落ちる。
- 参照ドライバ(`apps/soul/`、依存ゼロ `.mjs`)がシナリオ駆動(見る・傾げる・黙る・切断・再接続)を流し、持続駆動テスト(停滞なし・再接続成立・RTT p95<100ms)が機械で通る。
- 特区方向ルール検査が検証パイプラインに座る。
- 自律ホストのControlからdegradedページが消える(空状態一文+誘導)。

## 3. 責務境界

### 3.1 この波がやること

- 契約の家: 外殻+`intent.set` のschema JSON・やり取り例JSON・TS型(裁定8)。
- チャネルWSサーバ: transport核(frame codec/connection/token/loopback-listen)は既存再利用、session意味論(request/reply+hello+拒否列挙)と**手動開閉ライフサイクル**(起動時closed、UIから開閉)は新設。
- オーバーレイprovider: 心臓tickへの第二provider、TTL失効、Recordマージ、切断→全失効(裁定1)。
- スロット採番拡張: チャネルport/tokenのrecord追加(裁定3)。
- Channelページ+bridge(physiology-bridgeパターン)、Overviewカード、degraded解消(UX定義の三点セット)。
- 参照ドライバ(`apps/soul/reference-driver/` 等、`.mjs`・依存ゼロ・package.jsonなし)+持続駆動の機械テスト+RTT計測(裁定4/5/7)。
- 特区方向ルール検査の新設と検証パイプラインへの組み込み(裁定6)。
- fixture(純JSON)の整備——魂側開発の受け入れ基準を兼ねる。

### 3.2 この波がやらないこと(Out of Scope)

- エンベロープ付きインテント・変調・音素タイムラインのpayload(C5/C6/情動語彙の閉鎖時に追加。外殻のadditive extensionが受け皿)。
- 合成の精緻化(滑らかな立ち上がり・減衰・優先規則=C5)。スナップの不格好さはC4の判定対象外。
- 実物の魂(LLM・知覚・ASR/TTS)。特区へのpackage.json追加・依存追加。
- 人間の美的ゲート(C5で参照ドライバの実駆動プロファイルにより実施)。
- Editor / package-format / Runtime Export schema / lockfile変更、新規依存、`pnpm install`。
- 汎用DAG検証(裁定6の2ルールのみ)。

## 4. 設計要点(棚卸し接地)

- **サーバ**: Browser Sourceサーバの transport核を再利用し、チャネル session意味論を別モジュールに。手動開閉はChannelページのコマンド(bridge action)で。起動時は常にclosed。
- **オーバーレイ**: `getChannelOverlay()` 相当の第二providerを合成depsに追加(autonomousHost合成のみ。役割差は合成テーブル一点)。tick内で `generator.sample()` → オーバーレイ(未失効分)をRecordマージ → リゾルバ。physiology/のコード・golden・fixtureは無変更。
- **検証**: スロットID・値域・書込可否は既存のスロット定義/auto-mapping面に接地(棚卸し観点6)。拒否コード列挙は契約の家のTS型と同期。
- **rendererへの露出**: 状態・Active overlays(slot/値/残TTL)・イベントログ(session-only、直近N件)。tokenはChannel URL構成でのみ表示。role問い合わせ禁止(サブシステム有無data)。
- **参照ドライバ**: シナリオ(注視→傾げ→沈黙→再開→意図的切断→再接続)をタイムテーブルで流す。RTT計測を標準出力/レポートに出す。機械テストはドライバをspawnして検証(実時間は圧縮したシナリオでよい。флakyになるならescalate)。
- **方向ルール検査**: 既存 `check:*` スクリプト群の流儀に合わせた新スクリプト(2ルール)。CI/検証コマンドに組み込み。

## 5. Wave Strategy

単一のOrch-SylphがDomainを順次実行する(A→B→C→D→E)。

| Domain | Work | 順序 |
|---|---|---|
| Domain A | 契約の家+チャネルWSサーバ(手動開閉・hello・request/reply・拒否列挙)+port/token採番 | 先行 |
| Domain B | オーバーレイprovider(心臓tick統合・TTL・切断失効)+機械テスト | Aの後(契約型に依存) |
| Domain C | Channelページ+bridge+Overviewカード+degraded解消 | Bの後(状態/ログの実体に依存) |
| Domain D | 特区+参照ドライバ+持続駆動テスト+RTT計測+方向ルール検査 | Cの後(開閉UIと全経路が揃ってから) |
| Domain E | 最終統合: モノレポ検証、docs/maps更新、fixture最終確認、clean review | 最後 |

## 6. ドメイン別の要点

- **Domain A** (`cohost-c4-channel-server-contract`): テスト=契約schema/型の整合・token検証・hello送出・request/reply相関・拒否列挙の全コード・未知kind拒否かつ接続維持・手動開閉ライフサイクル(closed起動・開閉・再開)・port/token採番のスロット独立。Escalate=transport核の再利用が構造的に不可能な場合。
- **Domain B** (`cohost-c4-overlay-provider`): テスト=TTL失効(既定窓/明示ttlMs)・Recordマージの優先・切断→全失効→基底復帰・physiology golden/fixture全種不変・純度維持・trackingHost合成にチャネル不在。Escalate=心臓tick構造が第二providerを受けない場合。
- **Domain C** (`cohost-c4-channel-page-degraded`): テスト=ページrender(状態/URL copy/overlays/ログ)・開閉コマンド・空状態(トラッキングホスト)・Overviewカードのdata描画・degraded置換(Input/Mapping/Motion Safety/Header)・token以外の秘匿非露出。Escalate=既存ページ構造が置換を受けない場合。
- **Domain D** (`cohost-c4-soul-zone-reference-driver`): テスト=ドライバ単体(シナリオ進行・再接続)・持続駆動統合(spawn・停滞なし・RTT p95<100ms)・方向ルール検査(違反fixtureで赤、現状で緑)・`apps/soul` にpackage.json/依存が無いこと・lockfile無変更。Escalate=持続駆動テストがCI環境でflakyな場合(実時間圧縮の設計判断)。
- **Domain E** (`cohost-c4-final-integration`): モノレポ検証(typecheck/対象テスト/既知baseline明示)・無変更確認(Editor/schema/lockfile/physiology golden)・「実装事実に合わせて関連ドキュメントを更新する」・手動確認メモ(下記)・clean review。

## 7. Manual Check Notes(機械ゲート通過後の一目。美的判定ではない)

1. 自律ホストでChannelページを開き `Open Channel` → 参照ドライバを起動(`node apps/soul/.../reference-driver.mjs <url>`)→ モデルが外部駆動で動くのを見る。
2. Active overlaysに残TTLつきでスロットが並び、イベントログに受理/拒否が流れるのを見る。
3. ドライバを殺す → 体が生理の基底へ落ちるのを見る(粗いオーバーレイのスナップは減点対象外)。
4. トラッキングホストでChannel/Input/Mappingページが品位ある空状態であること、Headerが `Drive: Physiology`(自律)/従来(トラッキング)であることを一目。

## 8. Acceptance Criteria

- fixtureテストから `face.angle.x` が動く(縦の貫通)。
- 拒否列挙の全コードがテストされ、違反は拒否・接続維持・ログ記録される。
- hello capabilities告知と寛容規則(双方向)が実装・テストされる。
- TTL統一機構: 明示ttlMs/既定窓の両スタイル、失効・切断→基底復帰。
- 参照ドライバ: 依存ゼロ`.mjs`・package.jsonなし・持続駆動テスト(停滞なし・再接続・RTT p95<100ms)が通る。
- 方向ルール検査2ルールが検証パイプラインに座り、緑。
- チャネルは自律ホスト専有・手動開放(起動時closed)。実行時role分岐ゼロ。
- physiology純度・golden/fixture全種・トラッキング経路・C1〜C3成果の無退行。
- Channelページ/Overview/degraded解消がUX定義どおり。token以外の秘匿非露出。
- Editor / package-format / Runtime Export schema / lockfile無変更。新規依存なし。`pnpm install` なし。
- 対象テスト・typecheckパス、または失敗が証拠つきで分類(既知baseline=Wave21 browser-source系)。

## 9. Subagent Contract

- `pnpm install` 禁止(回避工作も禁止)。`apps/soul` にpackage.json・依存を置かない(本waveでは)。lockfile無変更は機械確認対象。
- Editorソース・package-format・Runtime Export schema変更禁止。`headless-slot-resolver.ts`・physiology/配下の変更は原則禁止(必要ならescalate)。
- 実行時role分岐禁止(役割差は合成テーブル+subsystem seam一点)。rendererの描き分けはサブシステム有無data。
- C1(スロット/役割合成)・C2(リゾルバ等価性・blink golden・心臓)・C3(生成器golden・Physiologyページ・Stage Presence)の成果を退行させない。
- 既存wave群(Browser Source primary path、Wave10-23の各挙動)を退行させない。
- rendererへシード・rawスロット・チャネルtoken以外の秘匿を流さない。イベントログはsession-only。
- 無関係変更をrevertしない。決定論的な箇所にfocusedテスト。想定外の共有ファイルは触る前に報告。

## 10. Review Policy

各実装ドメインに3レーンのReview-Sylph(別subagent、統合禁止): ①spec(本計画+設計討議+UX定義突合) ②design/development ③test adequacy。

blocking観点: 実行時role分岐の不在 / physiology純度・golden不変 / オーバーレイがfixture境界の外に正しく分離 / 拒否列挙の網羅 / token・秘匿の露出境界 / `apps/soul` の依存ゼロ・lockfile無変更 / 方向ルール検査の実効(違反fixtureで赤くなること) / トラッキング経路無退行。

## 11. Orchestration Policy

Implementation Orchestration skill の全規則に従う(C1〜C3と同一: ネスト分離 / 在席ポーリング / 閉域 / モデル明示 / ループ上限5 / 早期脱出 / 必須文言)。

- L0(Undine): 計画・裁定・最終判定。実装しない。
- Orch-Sylph: 単一。Domain A→B→C→D→Eを順次。実装はGnome、レビューは3レーンReview-Sylphへ委譲。成果物は `../waves/c4/` / `../reviews/c4/`。
- 設計に無い判断分岐は実装で埋めずescalate。子が未完のままwave gateを通過しない。
