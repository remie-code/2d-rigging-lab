# C4 Domain A レビュー (Lane2: design/development品質)

> Review-Sylph → Orch-Sylph。task=`cohost-c4-channel-server-contract`。読み取り専任。
> 対象: `apps/runtime-player/src/main/control-channel/` 配下の全新規ファイル。既存 `broadcast-source/` と対照。
> Gnome報告: `discussion/ai-cohost/implementation/waves/c4/domain-a-report.md`。

## 判定: **合格**

design/development 観点で blocking な差分なし。additive のみ。既存資産(browser-source テンプレ・resolver 値域 source-of-truth)と整合し、blocking 5観点すべて満たす。non-blocking な設計メモを3点付す(いずれも v0 スコープ内で Gnome が明示済み)。

---

## blocking観点の評価

### 1. transport核の再利用判断(複製) — 妥当
- `channel-websocket-frame.ts` を `browser-source-websocket-frame.ts` と行対照。**挙動byte互換**を確認: マスク必須・payload長126/127分岐・`MAX_SAFE_INTEGER` ガード・unmask XOR・header割付(2/4/10)がすべて同一ロジック。差分は識別子名と `controlChannelMaxClientMessageBytes`(=4096、browser-sourceと同値)のみ。
- `channel-websocket-connection.ts` も同様に byte互換。唯一の意図的差分は `send(message: unknown)`(browser-source は `send(message: RuntimePlayerBrowserSourceServerMessage)` に型束縛)。**これが「抽出共有すると browser-source の共有ファイル群に波及する」根拠の実体**であり、報告§2の判断は正しい。共有connectionの `send()` 型を汎用化する編集は browser-source-server/テストに及ぶ。
- 複製により browser-source を**1行も編集していない**(§8で `git status --short` 確認済み。既知baseline fail 2件のある fragile 経路を触らない選択は合理的)。将来の neutral module 統合を follow-up に繰延する判断も、複製部が request/reply 意味論ゼロの純transportである以上、重複保守コストは限定的で妥当。
- **評価: 適合。** wave plan §A-2 が明示許容した「複製」を、fragile経路回避という積極的根拠つきで選んでおり、design上正しい。

### 2. 拒否列挙の検証層が resolver 手前の前置ゲート — 適合
- `headless-slot-resolver.ts` は**無変更**(`git status` で確認)。検証層は resolver に相乗りせず独立層。
- `channel-intent-validation.ts` の `isSlotWritable` は `slot.enabled && slot.target !== null` を要求。これは resolver の drop 条件 `!slot.enabled || slot.target === null`(headless-slot-resolver.ts:54)の**厳密な鏡写しの反転**。つまり「resolver が沈黙で落とす箇所」で channel は `slotNotWritable` を返す。「沈黙で落とす＋クランプ」を「明示拒否」へ反転する設計が正しく前置されている。
- `semantic-slot-normalized-range.ts` の値域は resolver 冒頭コメント(headless-slot-resolver.ts:19-21)の source-of-truth と**完全一致**: weight系(blink-left/right/mouth-open/mouth-smile/mouth-vowel)=0..1、centered系(head-centered/gaze-centered/body-x/body-z)=-1..1。`SemanticSlotSourceKind` union の9値すべてを switch で網羅(default句なし=新sourceKind追加時に型で検出)。乖離なし。クランプせず範囲外を `slotValueOutOfRange` で拒否(§3.3準拠)。
- **評価: 適合。** 独立した前置ゲートとして正しく分離され、値域source-of-truthと同期。

### 3. overlay store seam の形 — 適合
- `control-channel-overlay-store.ts` は `setOverlay / clearAll / snapshot(nowMs)` の3操作のみを持つ純runtime状態。`expiresAtMs` は受理時に確定した絶対壁時計を外部(server)から受け取り、store自身は `snapshot(nowMs)` の nowMs 以外の時刻source-free。**fixture境界の外の runtime状態**として正しく分離(裁定1)。
- Domain B の配線形 `getChannelOverlay(nowMs) → snapshot(nowMs)` に直結できる形。返り値は `Record<string, number>`(未失効のみ、`expiresAtMs > nowMs`)で、生成器 `activations` へ Record マージ可能。
- physiology 生成器の pure sample には触れていない(`physiology/` 無変更を `git status` で確認)。決定論境界を侵していない。
- **評価: 適合。** Domain B が heart tick に配線する seam として過不足なし。

### 4. 実行時 role 分岐の不在 — 適合
- `if (role===...)` 相当の実行時分岐は**存在しない**。役割差は `channel-slot-ports.ts` の合成テーブル `runtimePlayerDefaultSlotChannelPorts` で表現: `autonomous-default` slot のみ port を持ち、`tracking-default` は**record に存在しない**(=チャネルサブシステム非合成、裁定2)。これは subsystem seam による表現で、実行時 role 分岐ではない。
- **評価: 適合。**

### 5. token・秘匿の露出境界 — 適合
- token は `channel-url.ts` の URL 構成(`?token=`)と `channel-token.ts` の照合、config store の永続化でのみ扱われる。
- bridge向け観測面 `getState()` / `onStateChanged()` が返す状態は `{kind:"closed"}` / `{kind:"open",port}` / `{kind:"connected",port,protocolVersion}` の3形のみ。**token・seed・raw スロットを一切含まない**。`server.token` getter は存在するが、これは Domain C が URL 構成に使うmain側APIで、renderer露出面ではない。
- **評価: 適合。** 秘匿を bridge-facing 状態に混ぜていない。

---

## non-blocking観点の評価

### 6. 手動開閉の状態機械 — 破綻なし
- Closed→(open)→Open→(connect)→Connected の遷移が `#setState`/`#refreshConnectedState` で一貫。`open()` は `#server !== null` で冪等。`close()` は connection切断→`clearAll`→server.close→Closed の順で、overlay掃除を切断前に確実実施。
- **port fallback時のEndpoint更新**: `listenOnLoopback(server, this.#port)` が EADDRINUSE 時に `listenOnLoopback(server, 0)` へフォールバックし、`readListeningPort(server.address())` で**実際の listening port** を `#listeningPort` に採り、state の port もこれを反映。固定portでなく実bind portを載せる点は正しい。
- **複数接続・切断時clearAll**: 後述メモBの通り v0 意味論として意図的。破綻ではない。

### 7. 既存資産との整合 — 適合
- `channel-config-store.ts` は `browser-source-config-store.ts` の**忠実な並列複製**: 同一の getOrCreate/readPersisted/createDocument/saveDocument 構造、同一の `parseToken` 正規表現(`/^[A-Za-z0-9_-]{24,128}$/`)・`parsePort` 範囲(1..65535)、schema version パターン(`runtime-player-control-channel-config-v1`)。別ファイル(`channel/channel-config.json`)・別token・別port。テンプレ流儀に沿う。
- 命名規約(`RuntimePlayer*` / `runtimePlayer*` prefix、`channel-*.ts` ファイル分割)は既存 browser-source 流儀に一致。
- 契約テスト `channel-protocol-contract.test.ts` が JSON↔TS を**双方向同期強制**(protocolVersion/supportedKinds/rejectionCodes/slotId enum・6拒否コードの例網羅)。additive-extension基礎の contract-of-record として堅牢。

### 8. 無関係変更の不在 — 適合
- `git status --short` は `?? apps/runtime-player/src/main/control-channel/` と `?? discussion/.../waves/c4/` の2未追跡のみ。**tracked ファイルの modify/revert ゼロ**。physiology/・headless-slot-resolver.ts の無変更を個別確認。完全 additive。

---

## 裁量判断(報告§8)の design評価

- **§8.1 複製 / §8.8 port独立const**: 妥当(観点1・4で評価済み)。
- **§8.3 拒否コード=6件確定**: contract test が3面(JSON schema/exchange examples/TS union)を同期し、6件で閉じる設計は additive-extension を壊さない。妥当。
- **§8.4 相関不能封筒=沈黙ドロップ**: `parseControlChannelRequestEnvelope` が非JSON/id無し/kind無しを null 化 →`dispatch` が `ignore`(reply捏造せず接続維持)。§3.5 寛容規則の解釈として正しい。
- **§8.5 channelClosed 到達**: `accepting = #server !== null`。dispatch単体で `accepting:false` を決定論網羅する分離設計は良い(socket-free 決定核)。
- **§8.7/§8.9 値域・失効境界**: 閉区間 `[min,max]` 受理・`expiresAtMs > nowMs` 生存(ちょうどで失効)は一貫。snapshot が失効entry を削除しない点は16スロット有界で妥当、失効意味論の正を Domain B が所有する引き継ぎも明確。

---

## design観点の設計メモ(non-blocking・v0スコープ内で対処不要)

**A. 封筒 `v`(protocol版)が未検証**
`parseControlChannelRequestEnvelope` は `value.v` を読まず、`v: runtimePlayerControlChannelProtocolVersion` をハードコードで載せる(channel-protocol-messages.ts:42-47)。クライアントが `v:2` を送っても v:1 として扱われ、版不一致は表面化しない。v0 の寛容規則(版交渉は server.hello 経由)としては許容できるが、将来 C5/C6 で版が動く際は Domain D 向けに「版検証をどこで行うか」が未定の境界として残る。**本waveでは対処不要**。

**B. 複数接続許容 + いずれの切断でも clearAll の意味論的緊張**
`#handleUpgrade` は接続数を制限せず複数接続を許容するが、`#handleClientClose` は**どの接続の切断でも全 overlay を clearAll** する(channel-server.ts:260-267)。真に複数ドライバを許すなら「片方の切断で全 overlay 消滅」は驚き得る挙動。報告§8.6 が「v0=単一参照ドライバ前提、複数駆動は想定外、切断→基底復帰の fail-safe」と明示しており、v0 意味論として defensible。**設計意図は明確なので blocking にしない**が、C5 で複数ドライバを扱う場合は接続ごとの overlay 所有 or 接続数1制限のどちらへ倒すか要裁定。

**C. `getCurrentSlots` 既定が常時 null**
server option 未指定時 `#getCurrentSlots = () => null` で全 write が `slotNotWritable`。合成根(Domain C)が `createAutoMappingSlots(payload)` を供給する前提が report §5/§9 で明示済み。Domain A 単体としては安全側の既定で妥当。

---

## テスト実行の確認(design健全性の裏取り)
`pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/main/control-channel`
→ **9 files / 51 tests 全passed**(報告§7の主張と一致、私も実行確認)。
(テスト網羅の十分性評価は Lane3 の担当。ここでは design が壊れていないことの裏取りのみ。)

---

## 質問(Orch/後続判断)
1. メモB(複数接続 + 全clearAll)の意味論を C5 で扱う際、「接続数1制限」と「接続ごと overlay 所有」のどちらへ倒すかは C4 スコープ外だが、Domain C の Channel ページUX(複数接続をユーザーにどう見せるか)と結びつく。C の設計時に一度拾う価値があるか、Orch の判断を仰ぐ。
2. メモA(封筒 `v` 未検証)は Domain D(特区の魂側)が版を送り始める日まで顕在化しない。C4 では未対処で問題ないが、Domain D 委任時に「版検証の所在」を引き継ぎ事項として明記すべきか。
