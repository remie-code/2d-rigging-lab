# C4 Domain A レビュー(Lane3: test adequacy)

> Review-Sylph(test adequacy 専任)→ Orch-Sylph。対象=`cohost-c4-channel-server-contract`(契約の家+チャネルWSサーバ+拒否列挙+port/token採番)。
> 他2レーン(Lane1 spec / Lane2 design)とは統合していない独立評価。読み取り専任。

## 判定: 合格

blocking観点(拒否列挙の全コード個別発火・クランプせず拒否・未知kind拒否かつ接続維持)はすべて実アサーションで固定されている。test adequacy 10観点すべて充足。残る不足は non-blocking の微小な同期漏れ1点のみ。

## テスト結果(自分で実行)

`pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/main/control-channel`
→ **9 files / 51 tests 全 passed**(自分で実行し確認。node_modules 存在)。
- overlay-store 5 / intent-validation 12 / semantic-slot-normalized-range 3 / request-dispatch 7 / slot-ports 3 / token 3 / config-store 4 / protocol-contract 6 / server 8。
- 既知baseline fail 2件(`src/main/broadcast-source/browser-source-server.test.ts`・`src/stage/browser-source/browser-source-server-message.test.ts`)は **browser-source パス配下**で control-channel と別モジュール。Domain A の対象テストとは無関係(パスで確認。全体スイートは再実行せず、focused のみ実行)。

## 観点別 充足状況

| # | 観点 | 判定 | 根拠 |
|---|---|---|---|
| 1 | 契約schema/型 三者同期 | 充足(微小漏れ有) | `channel-protocol-contract.test.ts`: envelope schema の protocolVersion/supportedKinds/rejectionCodes/rejectedResponse.error.code.enum を TS const と `toStrictEqual`。intent-set payload の `slotId.enum` を `runtimePlayerMappingSlotIds` と同期。exchange examples ↔ builder(hello=example[0]・request envelope 全 parse・accepted builder 一致・**6拒否コード各1例が builder と一致**)。実結合。 |
| 2 | token検証 | 充足 | `channel-token.test.ts`: 正token自己一致・URL安全・長さ≥24、null/空/末尾付加/別token 拒否。加えて server テスト「rejects a connection presenting a bad token」で実socket経路も固定。 |
| 3 | hello送出 | 充足 | contract テストで hello 構造を literal で固定(`{v:1,kind:"server.hello",payload:{protocol:1,supportedKinds:["intent.set"]}}`)かつ example[0] と一致。server テスト「announces server.hello immediately on connect」で接続直後送出を実socketで固定。 |
| 4 | request/reply相関 | 充足 | server テストで `replyTo==="req-42"` を実socketで確認。dispatch テストで各 `replyTo` を固定。contract テストで `id`/`kind` parse。 |
| 5 | 拒否列挙 全コード個別発火(**blocking**) | 充足 | 6コードが**個別に**発火: unknownKind(dispatch+server)/invalidPayload(validation: 非record・非有限value・不正ttlMs)/unknownSlot(validation)/slotValueOutOfRange(validation: centered 1.5/-1.5・weight 1.2/-0.1)/slotNotWritable(validation: disabled・null・absent)/channelClosed(dispatch: accepting:false)。**クランプせず拒否**は validation「no clamp」+「accepts range boundary values」(−1/0 境界受理)で両面固定。 |
| 6 | 未知kind拒否かつ接続維持(**blocking**) | 充足 | server テスト「rejects an unknown kind but keeps the connection usable」: 拒否後 `readyState===OPEN` **かつ**後続の正intentが accepted になることまで固定(接続維持を実証)。 |
| 7 | 手動開閉ライフサイクル | 充足 | server テスト: closed起動・open後listen・repeated open冪等・open→close→reopen(states に "closed" 含む・再接続成立)・切断→clearAll→open復帰。全段固定。 |
| 8 | port/token採番のスロット独立 | 充足 | `channel-slot-ports.test.ts`(17310・autonomousのみ・trackingは undefined・browser-source portと非一致・全browser-source portと非衝突)。`channel-config-store.test.ts`(別ファイル `channel/channel-config.json`・別token・別port・相互非汚染をファイル内容 substring で検証)。 |
| 9 | 偽陰性・決定論性 | 充足 | アサーションは実質(`toStrictEqual` で中身検証、空緑でない)。決定核 dispatch は socket-free で全拒否コード網羅。server統合は `port:0`(ephemeral loopback)+ `nowMs` 注入(`FIXED_NOW_MS`)で**TTL/expiry判定に実時計を使わない**。TTL網羅は overlay-store が固定nowで境界検証。flaky要素は実socket接続のみで waitFor(1000ms/10ms poll)+ afterEach クローズ。実タイマ待ちなし。 |
| 10 | TTL基本動作(store 未失効のみ) | 充足 | `control-channel-overlay-store.test.ts`: snapshot 未失効返却・失効境界(999生存/1000失効/1001失効=`expiresAtMs>nowMs`)・同slot上書き・複数slotの未失効subset・clearAll。境界がちょうど失効で固定。 |

## 不足(non-blocking)

1. **intent-set payload schema の `normalizedRanges` が TS 分類器と同期テストされていない**。`channel-intent-set-payload-schema.json` は `normalizedRanges`(head-centered=-1..1 等9件)を宣言するが、`semanticSlotNormalizedRange()`(TS)の出力と一致することを固定するテストが無い。contract テストは slotId enum は同期するが normalizedRanges は対象外。ランタイムは TS 関数を読むため実害は無いが、魂が読む JSON 側が黙って陳腐化しうる(契約の家の三者同期の意図から漏れる)。**契約の家の完全性を上げるなら**、`semanticSlotNormalizedRange(kind)` == schema.normalizedRanges[kind] を回す1テスト追加が望ましい。Domain E の最終確認 or follow-up 候補。
2. **channelClosed の live-server 統合テストは無い**(dispatch 単体の accepting:false のみ)。server では `accepting = #server!==null` で、close 時は先に connection を閉じるため実運用で到達 race は稀。決定核が決定論的に網羅しており Gnome も §8.5 で明示。偽陰性ではないが、live経路の1本は欠く。non-blocking。
3. **payload の余剰プロパティ**(schema は `additionalProperties:false`)を validation が拒否も検証もしない。どちらの挙動もテスト無し。additive寛容として実装は緩く受理(合理的)。挙動固定が欲しければテスト1本だが、主に Lane1/Lane2 の関心。non-blocking。

いずれも blocking 観点(§10)には触れない。

## 偽陰性の精査結果

- 全テストが `toStrictEqual`/`toMatchObject` で具体値を検証しており、空アサーション・トートロジーは無し。
- schema同期は JSON import を実 TS const と突合(モックでない)。slotId enum は `runtimePlayerMappingSlotIds` と実結合。
- 「クランプせず拒否」は「範囲外で ok:false」と「境界値で ok:true」の両方を持つため、"常に拒否" や "常にクランプ受理" の退化を検出できる。
- overlay 失効境界は 999/1000/1001 の三点で `>` 半開区間を固定(off-by-one を検出可能)。
- server テストの時間依存(expiry)は `nowMs` 注入で決定化されており実時計フリー。

## 質問

なし(blocking な判断保留は無い)。non-blocking の #1(normalizedRanges 同期テスト)を Domain E ないし follow-up で拾うか否かは Orch/Undine 判断に委ねる。
