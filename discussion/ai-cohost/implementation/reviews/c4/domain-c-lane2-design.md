# C4 Domain C レビュー(Lane2: design/development品質) — Channel bridge + ページ + Overview + degraded + 合成根配線

> Review-Sylph → Orch-Sylph。担当レーン=design/development品質(bridge並列複製・Domain A追加2点の妥当性・合成根のサーバ配線・data seam によるrole分岐不在・degraded の data源設計・保守性)。仕様適合=Lane1、テスト網羅=Lane3 に委ねる。読み取り専任。
>
> **判定: 合格(要修正なし)。Domain A 追加2点=可(受容)。blocking design差分ゼロ。非blocking観察のみ。**

## 検証方法の前提(重要)

`control-channel/` ディレクトリ全体が **git 未追跡**(Domain A/B の未コミット成果)。そのため `git diff apps/.../control-channel/` は空を返し、Domain A 追加分を「コミット済みbaselineとの機械diff」で確認することは**構造上不可能**。代替として (a) `control-channel-overlay-store.ts`・`channel-server.ts` を全読して追加が構造的に分離された read-only seam であることを確認、(b) `domain-b-report.md §1` と heart/input-subsystem の working-tree 差分を突き合わせ、Domain C が Domain B ファイルを再変更していないことを確認した。この前提の下でも「既存挙動不変」は十分な確度で確認できたが、機械diffが取れない点は記録しておく(コミット後は diff での再確認が可能)。

## 各design観点の評価

### 観点1: Domain A への最小追加2点の妥当性(blocking・最重要) — 可

**`control-channel-overlay-store.ts` の `activeOverlays(nowMs)`**(`:81-97`):
- 既存 `snapshot`(`:62-72`)・`setOverlay`・`clearAll`・`RuntimePlayerControlChannelOverlayEntry` 型は**無変更**。追加は新 export 型 `RuntimePlayerControlChannelActiveOverlay` と `activeOverlays` メソッドのみ(additive)。
- `snapshot` と**完全に同一の liveness 規則**(`entry.expiresAtMs > nowMs`)。エントリの `set`/`delete`/失効を一切行わない純読み取り(`#entries` を for-of で読むのみ)。→ Domain B の失効の正を侵さない。
- 各行に**相対**残TTL(`expiresAtMs - nowMs`)のみを載せ、絶対 `expiresAtMs` を返さない。renderer に絶対壁時計を渡さない規律を store 層で担保。
- 判断: **可**。read-only 観測 seam で既存挙動不変。UX§1「Active overlays: slotId+値+残TTL」は `snapshot`(Record<slotId,value>)だけでは残TTLを出せず、この追加は不可欠かつ最小。

**`channel-server.ts` の `onEvent(listener)`/event型**(`:76-87`,`:150-157`,`:341-345`):
- 追加物は (a) event型 `RuntimePlayerControlChannelServerEvent`、(b) listener set `#eventListeners` + `onEvent`(`onStateChanged` と対称、unsubscribe返し)、(c) `#emitEvent`、(d) 4箇所の emit(`#handleUpgrade`→connected / `#handleClientMessage`→accepted|rejected / `#handleClientClose`→disconnected)。
- **状態機械**(`#setState`/`#refreshConnectedState`)・**open/close**・**overlay 書込**(`setOverlay`/`clearAll`)・**dispatch**(`dispatchControlChannelRequest`)・**拒否列挙**・**token検証/upgrade**は無変更。emit は既存ハンドラ内の副作用通知として挿入されているだけで、`connection.send`・store書込・状態遷移の制御フローを変えていない(accepted の emit は setOverlay の後・reply送信の手前、reply送信は従来どおり実行)。
- event型は enum/公開語彙に限定(`kind`/`slotId`/`value`/公開 `code`)。token・seed・raw内部スロットは型上乗らない。
- 判断: **可**。read-only 観測 seam で契約(拒否列挙・TTL・overlay意味論)を壊していない。`onStateChanged` だけでは accept/reject/connect/disconnect が観測不能で、UX§1 Recent Events が実装不能なため、この seam は Gnome の代替案(bridgeがserverをwrap)では実現できず、追加が正当。

### 観点2: 合成根のサーバ配線(blocking) — 適合

`runtime-player-main.ts:492-536`(`registerPhysiologyBridgeHandlers` 直後):
- **自律のみ生成が data 分岐**: `controlChannelOverlayStore = inputSubsystem.getControlChannelOverlayStore()` の `!== null` でのみ config store/server を生成。実行時 `if(role===)` **無し**。tracking は store=null → server=null → bridge が available:false。
- **overlayStore 同一インスタンス**: `getControlChannelOverlayStore()` の返す**同一 store** を server option `overlayStore` と bridge の両方に渡す。Domain B の heart が読む store と同一(input-subsystem `:276` が同一インスタンスを返すことを確認)。
- **getCurrentSlots の slots 乖離なし**: 合成根 `:577` が `currentControlChannelSlots = createAutoMappingSlots(payload)`、heart 側 input-subsystem `:285` も `createAutoMappingSlots(payload)`。**同一純関数・同一 runtime export payload → 同一 slots**。乖離なし(確認済み)。
- **起動時 start しない(Closed起動)**: server は `new` のみで `open()` 未呼び出し。open/close は bridge invoke 経由。
- **port採番**: fixed → `runtimePlayerControlChannelDefaultPort`(17310定数)、custom自律 → `findFreeLoopbackPort()`(browser-source と同じ規律・別token別ファイル)。
- **モデル unload の掃除**: `onRuntimeExportChanging`/`Cleared` で `currentControlChannelSlots=null` + `controlChannelOverlayStore?.clearAll()` + `controlChannelBridge.publishStatus()`。channel server 自体は unload で閉じない(手動開閉のみ)。妥当。
- **quit**: `will-quit` で `controlChannelBridge.dispose()` + `void controlChannelServer?.close()`。

### 観点3: bridge 並列複製の品質(blocking) — 適合

`channel-bridge-handlers.ts`:
- **両ロール登録**(server null 許容)・**available data**(`server !== null`)・**status push**(`webContents.send(statusChanged)`、`isDestroyed()` ガード付き)。physiology-bridge の流儀に沿う。
- **session-only リングバッファ**: クロージャ内の `recentEvents` 配列、`maxRecentEvents`(20)で `splice` 上限管理、**永続化なし**(ファイル書込ゼロ)。browser-source client diagnostic の in-memory リングバッファ前例に沿う。
- **層分離**: preload `channel-bridge-contract.ts` は**import 一切なし**の自己完結(`protocolVersion:number`, `code:string` で受ける)。main の wire 契約(`channel-protocol-contract` 等)を import しない。main の bridge handler が権威型 → renderer 形へ写す(`toConnectionState`/`toRendererEvent`)。physiology-bridge と同方向。

### 観点4: role分岐不在・data seam(blocking) — 適合

renderer は全面 subsystem 有無 data で描き分け、role を問い合わせない:
- `control-window-app.tsx:640-642`: `providesPhysiology = physiologyStatus?.available === true` / `providesChannel = channelStatus?.available === true` / `drivenByPhysiology = providesPhysiology`。全て status の `available` data 派生。
- Header の `inputLabel`/`inputTone` は `drivenByPhysiology`(data)で `Drive: Physiology`(teal)/従来 を分岐。role 参照なし(`role={startupStatus?.role}` は Header への表示名propで既存・degraded判定には不使用)。
- degraded 6面(input/mapping/live-controller Motion Safety/stage-motion-panel/header)は `drivenByPhysiology`、overview は `providesPhysiology`/`providesChannel` で分岐。すべて data。

### 観点5: token・秘匿の露出境界(blocking) — 適合

renderer に渡る `RuntimePlayerControlChannelStatus` を精査:
- `endpointUrl`: `createControlChannelWebSocketUrl({port, token})`=`ws://127.0.0.1:<port>/channel?token=…` のみ。**Open/Connected 時のみ非null**(`buildEndpointUrl` が `server===null||closed` で null)。**token が露出する唯一の面**。
- `connection`: `toConnectionState` が `port` を落とす(renderer 契約の open/connected に port フィールドなし)→ port は endpointUrl 文字列内のみ。
- `activeOverlays`: slotId/value/`remainingTtlMs`(相対)のみ。絶対 `expiresAtMs` 非露出(store の `activeOverlays` が相対のみ返す)。
- `recentEvents`: id/kind/slotId?/value?/code? のみ。server event 型が公開語彙限定のため token/seed/rawスロット非露出。
- seed・rawスロットは契約型に存在しない。

### 観点6: degraded の data源設計(`drivenByPhysiology`=physiology availability) — 妥当

6面共通 data源を physiology availability にした判断(報告§5)は妥当。physiology は自律専有・channel と常に共在(両者とも自律composerでのみ生成)なので channel availability と等価だが、無関係ページへ channel status を通さないため既配線の physiology マーカーを採用したのは**過結合回避として良い設計判断**。「physiology駆動=tracking入力なし」の意味論としても正しいマーカー。等価性は「自律では両者常在・trackingでは両者不在」という構成上の不変条件に依存し、v0 ではこれが成立(報告が等価性を明示)。将来 physiology有・channel無(逆)のホストが出れば見直しが要るが、v0 スコープでは無理なし。**非blocking**。

### 観点7: 無関係変更・退行の不在 — 適合

- `git diff --stat`: 変更は Domain C レンダラ群/合成根/preload + Domain B の heart・input-subsystem・input-subsystem.test.ts + boundary test。
- **heart/input-subsystem は Domain B 成果**: 差分は `domain-b-report.md §1`(`autonomous-frame-heart.ts:128/158/222-228`、input-subsystem の store生成/getChannelOverlay/getControlChannelOverlayStore、tracking=null)と**完全一致**。Domain C は再変更していない。
- **boundary test 修正は Domain B 帰属**: 正規表現 `../control` → `../control[/"']` の厳格化は `domain-b-report.md §1/§7` が自身の修正と明記、Domain C 報告も「触っていない」と整合(二重帰属の矛盾なし)。修正自体は `control-channel`(main兄弟)の誤検知を除くだけで、renderer `control/` への実import は依然すべて捕捉する厳密化(退行なし・masking なし)。
- **physiology/・headless-slot-resolver.ts 無変更**(`git diff --stat` 空を確認)。
- 既存 export を壊さず additive(`EmptySubsystemNotice` は control-window-components への追加 export、既存無変更)。overview の `ModelOverviewPanel` 抽出に伴う `erroredRuntimeExport.status === "error"` ガード追加は、`erroredRuntimeExport` が非nullなら常に true(`:98-100` の導出上)で挙動不変、抽出後の TS narrowing 用。退行なし。

## 差分

### blocking差分
- **なし。**

### non-blocking観察(修正必須ではない・記録)
1. **`#emitEvent`/`#setState` は listener を try/catch なしで同期呼び出し**(`channel-server.ts:334-345`)。bridge listener(`recordEvent`+`publishStatus`)が throw すると WS ハンドラ(`#handleUpgrade`/`#handleClientMessage`/`#handleClientClose`)へ伝播しうる。ただし (a) `publishStatus` は `isDestroyed()` ガードあり throw 低リスク、(b) 既存 `onStateChanged` も同一の無ガードパターンで、`onEvent` は**新種のリスクを導入していない**。許容。将来 listener 側の堅牢化を入れるなら onEvent/onStateChanged 双方で。
2. **`revision` は `buildStatus()` 呼び出しごとに増加**(読み取りの getStatus invoke でも増える)。open/close 1回で action result 用 + onStateChanged/onEvent 由来の複数回 bump が起きる。単調マーカーとして仕様どおりで、単一 control window では無害。
3. **複数接続時、各 connect/disconnect ごとに `connected`/`disconnected` を emit し、任意の切断で `clearAll`**(Domain A fail-safe 意味論)。Recent Events に複数行が出るが診断ログとして妥当。報告§7 の v0 複数接続方針(許容+全clearAll据え置き)に整合。

## Domain A 追加2点の可否判断(明示)

- **`control-channel-overlay-store.ts` の `activeOverlays(nowMs)`: 可(受容)。** read-only・additive・既存挙動不変。UX§1 Active overlays の残TTL に不可欠で最小。
- **`channel-server.ts` の `onEvent(listener)`/`RuntimePlayerControlChannelServerEvent`: 可(受容)。** read-only 観測 seam・additive・状態機械/open-close/overlay書込/dispatch/拒否列挙 無変更。UX§1 Recent Events(accept/reject/connect/disconnect)は seam 無しでは観測不能で、代替案(bridgeがserverをwrap)では実現不能なため正当。

いずれも Domain A の契約(拒否列挙・TTL・overlay意味論)を壊さず、`activeOverlays` は失効/mutate を行わず Domain B の失効の正を侵さない。

## 判定

**合格(要修正なし)。**

design/development 観点7項すべて適合。blocking差分ゼロ。Domain A への最小追加2点は read-only 観測 seam として構造的に分離され、既存挙動不変を確認(コミット済みbaselineとの機械diffは未追跡ゆえ不可だが、全読 + Domain B報告突合で確度十分)。合成根は data 分岐で role 実行時分岐を排し、同一 overlay store・同一 slots 導出でサブシステム乖離なし。bridge は physiology-bridge/browser-source 前例に忠実で層分離・session-only・秘匿境界を守る。renderer は全面 data seam で role 非問い合わせ。

## 質問(Orch/Undine判断が要る点)

1. **未コミット baseline の扱い**: Domain A/B/C の成果が一体で未コミットのため、Domain A 追加2点の「既存挙動不変」を**コミット済みbaselineとの機械diffで再確認できない**。本レビューは全読+Domain B報告突合で確度を確保したが、コミット順序(Domain A → B → C を分けて commit)を採るなら、その時点で `git diff` による最終確認が可能。この確認を求めるか、現状の確度で足りるか。
2. **観点6の等価性不変条件**: degraded data源=physiology availability は「自律では physiology と channel が常に共在」という構成不変条件に依存。この不変条件を設計文書側に明示的な前提として記録しておくべきか(将来 physiology有/channel無 のホスト形態が現れた場合の回帰防止)。判断は non-blocking。
