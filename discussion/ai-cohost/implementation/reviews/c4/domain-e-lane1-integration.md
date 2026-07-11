# C4 最終 clean review(Domain E Lane-A: 統合整合・AC全項目・無退行・docs整合)

> Review-Sylph(clean review・Lane-A=統合整合)→ Orch-Sylph。読み取り専任。もう1レーン(機械ゲート再実行)とは非統合・独立評価。
> 判定基準=c4-wave-plan §8 AC(最重要)/§2/§3/§9/§10、c4-control-channel-v0、c4-channel-diagnostics、mvp-boundary-amendment §6。
> 突合の基礎=Domain A〜E 報告 + 全12レーンレビュー + 全体 git diff を自分の手で実行して照合。

## 総合判定: **合格**(C4 wave 全体として閉じてよい。非blocking の docs 齟齬1件=テスト件数の陳腐化のみ、閉鎖を妨げない)

統合の穴・退行・AC取りこぼし・docs乖離は無い。全AC 11項目を対応する実装/テストファイルを実際に開いて充足を確認した(報告の主張を鵜呑みにせず、縦貫通テストの実アサーション・role seam・拒否列挙・方向検査スクリプト本体・protected path の git・契約テスト件数を自分で検証)。全体 diff は各ドメイン報告と完全一致し、想定外の変更・無関係変更・revert は無い。**未コミット同居で各ドメインが機械diff不可だった懸念は、本レビューで全体diffを各報告と突合して解消した**(下記§2)。

---

## 1. AC 全項目の充足マトリクス(wave-plan §8、自分で実体確認)

| # | AC 項目 | 判定 | 根拠(実際に開いて確認した場所) |
|---|---|---|---|
| 1 | fixtureテストから `face.angle.x`(実語彙 `head-horizontal`)が動く(縦の貫通) | ○ | `reference-driver-sustained-drive.test.ts`:117 baseline generator が `head-horizontal:0` のみ出力→witness `ParamAngleX` baseline=0(:208)→外部ドライバの intent で published frame に `+15` 反映(`movedFrames.length>0`, :249)→切断後 baseline 0 復帰(:252)。**外部プロセス→WS→token→契約検証→overlay→heart→resolver の縦貫通を実アサーションで固定**。契約 `channel-exchange-examples.json` happyPath も実 payload `slotId:"head-horizontal"`。 |
| 2 | 拒否列挙 全コードがテスト・違反は拒否/接続維持/ログ記録 | ○ | 6コード(`unknownKind`/`invalidPayload`/`unknownSlot`/`slotValueOutOfRange`/`slotNotWritable`/`channelClosed`)。Lane3-spec が「6コード個別発火・クランプせず拒否・境界受理」を実アサーションで確認済み。接続維持=`channel-server.test.ts`「rejects unknown kind but keeps connection usable」(拒否後 readyState OPEN かつ後続 intent accepted)。ログ記録=`channel-server.ts` の `onEvent` emit(accept/reject/connect/disconnect 4点)→bridge recentEvents。exchange-examples に6拒否例が全存在(schema/例/TS union を contract.test が同期束縛)。 |
| 3 | hello capabilities 告知 + 寛容規則(双方向) | ○ | server→client: `server.hello {protocol:1, supportedKinds:["intent.set"]}` を connect 即送(exchange-examples happyPath, channel-server.test)。器の寛容: 未知kind=拒否+接続維持、封筒不成立(非JSON/id無/kind無)=沈黙ドロップ+接続維持。魂の寛容: 参照ドライバが未知イベントを黙殺(`unknownEventsIgnored`)。双方向の寛容が実装・テストされている。 |
| 4 | TTL統一(明示ttlMs/既定窓・失効・切断→基底復帰) | ○ | `defaultWindowMs=1000`(dispatch が `receivedAtMs+(ttlMs??default)` で expiresAtMs 確定)。heart は `getChannelOverlay(wallNowMs)` で**壁時計評価**(logicalTime と非混同、専用テスト「judges TTL against the WALL clock」が誤配線を落とす)。`autonomous-frame-heart-channel-overlay.test.ts`(8件)が両スタイル失効・Record マージ優先・切断→clearAll→基底復帰を固定。Lane3-B が real assertion と確認。 |
| 5 | 参照ドライバ 依存ゼロ.mjs・package.jsonなし・持続駆動(停滞なし/再接続/RTT p95<100ms) | ○ | `apps/soul/reference-driver/reference-driver.mjs`(node builtin + global WebSocket のみ)。`apps/soul/package.json` **無し**(自分で `ls` 確認=good)。持続駆動テスト: frames前進>20 かつ厳密単調(:236,239)、`reconnected===true`・8 intent 全 accepted(:222-225)、`rttMs.p95<100`(実測≈1.5〜2ms, :231)。4回連続 PASS(flaky なし)。 |
| 6 | 方向ルール検査2ルールが検証パイプラインに座り緑 | ○ | `scripts/check-soul-zone-boundary.mjs` を実際に読了: **2ルールのみ**(器→魂 import 禁止 / 魂→器コード import 禁止、`.json`=契約は許容, :143)。純関数 `findSoulZoneBoundaryViolations` + standalone CLI。多行 import 対応の `[^'"]*?` 正規表現(:61, Domain D Lane2 の「要修正」を「ループ2追記」で修正済みと一致)。composite `check` に `check:soul-zone` 連結(package.json diff で確認)。fixtures 5ケース(valid緑+単一行/多行の両違反2種を赤)。実リポジトリ緑(1243 files)。 |
| 7 | チャネル自律ホスト専有・手動開放(起動時closed)・実行時role分岐ゼロ | ○ | `input-subsystem.ts`: tracking composer `getControlChannelOverlayStore:()=>null`(:190)、autonomous が `new ...OverlayStore()` を1個生成(:234)し同一インスタンスを露出(:276)。`runtime-player-main.ts` が store 非null(=自律)のときだけ server を配線(**data 分岐, 実行時 `if(role)` なし**)。server は生成のみ=Closed 起動、open/close は Channel bridge invoke 経由。Lane2-C が「role 参照なし」を確認。 |
| 8 | physiology純度・golden/fixture全種・トラッキング経路・C1〜C3無退行 | ○ | git で `physiology/` 配下・golden JSON・`headless-slot-resolver.ts` すべて**無変更**(自分で `git status --short` 確認=空)。heart の overlay provider 既定 `()=>null` で `overlay===null` 分岐=C2/C3 バイト等価。既存 heart 15件・golden 無改変で緑。Lane 群が純度機構(resolver 手前の新 Record マージ、sample 出力を mutate しない)を確認。 |
| 9 | Channelページ/Overview/degraded解消が UX定義どおり・token以外の秘匿非露出 | ○(non-blocking の mockup 例示差2件は follow-up 記録済み) | `channel-page.test.ts`(Closed/Open/Connected/Active overlays/Recent Events/tracking空状態)。自律 Overview=Model/Physiology/Channel カード。degraded 6面=`EmptySubsystemNotice`(単一 data源 `drivenByPhysiology`)。bridge test で token は endpointUrl 内1回のみ・seed/raw非露出・絶対 expiresAtMs 非露出を固定。**mockup 例示差(rejected 行 slotId・connected 行 IP)は non-blocking**で c4-followup §1/§2 に記録(ゲート要点「拒否がコードつきで見える」は充足)。 |
| 10 | Editor/package-format/Runtime Export schema/lockfile無変更・新規依存なし・pnpm installなし | ○ | git で `apps/editor/`・`packages/package-format/`・Runtime Export schema・`pnpm-lock.yaml`・`pnpm-workspace.yaml` **全て無変更**(自分で確認=空)。`package.json` diff は `check:soul-zone`/`check:soul-zone:fixtures`/composite 連結の**3行追加のみ**(自分で `git diff` 確認)。check:deps 緑=新規依存なし。 |
| 11 | 対象テスト・typecheck パス、または失敗が証拠つき分類(既知baseline=Wave21 browser-source系) | ○(**docs の件数表記に陳腐化1件**=下記§4非blocking) | 既知2 fail=browser-source `effectiveDynamicsTuning`(C4 未接触・因果無関係、A〜E 全報告で同一)。check:source 唯一違反=C3 `physiology/index.ts`(C4 未接触)。契約テストは8件(6+2, 自分で `grep -c` 確認)=Domain E 追加後の 823 と整合。**機械ゲートの実数値再確認は Lane-B(機械再実行)の担当**。 |

**11項目すべて ○。** blocking な統合の穴は無い。

---

## 2. 全体 diff と各報告の整合(blocking)— 一致(未コミット同居の懸念を解消)

`git status --short` / `git diff --stat` を自分で実行し、変更ファイルを各ドメイン報告の主張と1件ずつ突合:

- **Domain A**(契約の家・サーバ・store・検証・採番): 全て新規 `control-channel/` 配下(`??`)。既存tracking変更ゼロ=報告と一致。
- **Domain B**(overlay provider): 変更3ファイル(`autonomous-frame-heart.ts`・`input-subsystem.ts`・`input-subsystem.test.ts`)+ 新規 `autonomous-frame-heart-channel-overlay.test.ts` + `runtime-player-boundary.test.ts`(境界正規表現の追随修正)=報告§1・§7 と一致。
- **Domain C**(ページ・bridge・degraded・合成根): control-window 系9ファイル + `runtime-player-main.ts` + preload 2ファイル変更、channel-page/bridge 新規、control-channel への additive 2点(`activeOverlays`/`onEvent`)=報告と一致。
- **Domain D**(特区・参照ドライバ・方向検査): `package.json` 3行 + `scripts/check-soul-zone-boundary*.mjs` + `soul-zone-boundary-fixtures/` + `apps/soul/` + control-channel の持続駆動テスト1件=報告§1 と一致。
- **Domain E**(統合): docs 5ファイル + `channel-exchange-examples.json`(note 実語彙化)+ `channel-protocol-contract.test.ts`(同期テスト2件)+ 新規 follow-up・本報告=報告§8 と一致。exchange-examples note が `head-horizontal` になっていること・契約テストが8件であることを自分で確認。

**想定外の変更ファイル・無関係変更・revert は皆無。** 各ドメインが「未コミット同居で機械 diff 不可」とした懸念(Domain A/D レビューの質問)は、全体 diff が各報告の主張ファイル集合と過不足なく一致することで**解消**。protected path(physiology/・editor/・package-format・resolver・lockfile・runtime-export schema)への変更は git で NONE を確認。

---

## 3. ドメイン境界の齟齬 — 無し

- **overlay store インスタンス共有**(B↔C): autonomous composer が1個生成(input-subsystem:234)、heart が read(`snapshot`)、`getControlChannelOverlayStore()` が同一を返し(:276)C の合成根が server の `overlayStore` に渡す。read/write が同一インスタンスで結線=穴なし。
- **getCurrentSlots の slots 一致**(A↔C): 合成根が `createAutoMappingSlots(payload)` を渡し、heart も同じ純関数・同じ payload を使う=乖離なし(C 報告§3、A の `getCurrentSlots` seam)。
- **契約の家の三者同期**(A↔D↔E): schema JSON / 例 JSON / TS 型を contract.test が `toStrictEqual` 束縛(8件緑)。E の normalizedRanges 同期テストが JSON↔TS 値域の陳腐化も防波堤化。D の参照ドライバは `readFileSync` で同 JSON を読む(import でない=方向検査対象外)。
- **方向検査の緑**(D): 実リポジトリ 1243 files 緑、参照ドライバが最初の住人として器コード非import。

---

## 4. docs 整合の評価(blocking)— 整合(非blocking の件数陳腐化1件)

- **mvp-boundary-amendment §6「実体化の完了」**: 記述(`scripts/check-soul-zone-boundary.mjs`・純関数 `findSoulZoneBoundaryViolations({files})` + standalone CLI・2ルール・`.json` 許容・composite `check` 連結・fixtures 5ケース・実リポジトリ 1243 files 緑・参照ドライバが最初の住人)を**スクリプト本体と1件ずつ照合し完全一致**。過度な断定なし。「境界が機械検証可能になる分だけ強くなる」が C4 で成立、の記述は事実に接地。
- **c4-channel-diagnostics §3(構成不変条件)**: degraded の単一 data源=physiology availability、自律で physiology と channel が常に共在、逆形態が現れたら分離見直し、の回帰防止メモが実装(EmptySubsystemNotice の data源)と整合。
- **c4-followup.md**: v0 繰延6件(rejected slotId・connected IP・複数接続・封筒 v 検証・契約JSON配置・Stage Presence×チャネル結合可否)が各報告/レビューの non-blocking・soft question と対応し漏れなし。⚠ で Undine 方向確認事項(follow-up 6)を明示=妥当。
- **_map.md 群**: C4 を「実装完了・3レーンレビュー全PASS・機械ゲート緑・手動確認待ち」で反映し、**完全閉鎖を名乗っていない**(人間の一目確認前)=C3 流儀に忠実で過度な書き換えなし。

### ⚠ 非blocking: テスト件数の陳腐化(docs vs 実装事実)

Domain E は §4.3 で契約テストに normalizedRanges 同期テスト**2件を追加**し、自身の報告§1では最終総数を **823 passed / 2 failed** と記す。しかし E が更新した Status 行は Domain D 時点の **821 passed / 2 failed** のまま:

- `c4-wave-plan.md`:13 「全体テスト **821 passed / 2 failed**」
- `implementation/_map.md`:26 「全体テスト 821 passed/2 failed」

契約テストは実測8件(=6+2)で 823 と整合するため、**821 は陳腐化した数値**。緑/fail の実態(既知baseline 2件のみ、他は全緑)は不変で閉鎖判定を妨げないが、docs と実装事実の乖離であり Lane-A の責務として surface する。**推奨修正**: 上記2箇所を `823 passed / 2 failed` に更新(ai-cohost/_map.md は数値非明示なので修正不要)。機械ゲートの実数値の権威確認は Lane-B(機械再実行)に委ねる。

---

## 5. 手動確認メモの妥当性(Domain E §7)— 妥当

`node apps/soul/reference-driver/reference-driver.mjs "ws://127.0.0.1:17310/channel?token=<token>"` の起動コマンドは実ファイル・実 port(17310=autonomous-default 固定)と一致。URL は Channelページの `Copy Channel URL`(Open 後のみ表示)で取得、token は URL 構成要素としてのみ露出、の流れは bridge contract(endpointUrl のみ token 保持)と整合。4項目(外部駆動でモデルが動く/Active overlays+Recent Events/ドライバ kill→生理基底/トラッキング側の品位ある空状態)はユーザーが実際に辿れる。

---

## 6. 質問(Undine 判断が要る点)

いずれも C4 閉鎖判定を妨げない:

1. **テスト件数 821→823 の docs 修正**を Domain E に差し戻す(または Orch/Undine が直す)か。実態は不変・非blocking だが docs 正確性のため推奨。
2. **follow-up 6(Stage Presence×チャネル結合可否)**は Domain E も⚠で上げた Undine 方向確認事項。C4 は非結合で閉じてよいが、C5 精緻化着手前に裁定が要る。
3. **完全閉鎖の権威記録**は C1〜C3 同様「人間の一目確認(§7)合格後」に別途行う温度感で問題ないか(現状 docs は「手動確認待ち」で正しく留保)。

---

## 結論

**C4 wave は統合整合の観点で閉じてよい(合格)。** AC 11項目すべて実体で充足、全体 diff は各報告と完全一致し想定外変更ゼロ、protected path 無変更、ドメイン境界の穴なし、docs は実装事実と整合(mvp-boundary §6 の方向検査記述はスクリプト本体と一致)。唯一の非blocking は Status 行のテスト件数陳腐化(821→823)で、緑/fail の実態は不変。残は人間の一目確認(§7)→ C4 完全閉鎖。
