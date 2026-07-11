# C5 planning gate inventory: 合成とエンベロープ(器が曲線を描く)コード接地棚卸し

> Status: 調査完了(Sylph、2026-07-11)。対象=`apps/runtime-player` 現HEAD(**C4完全閉鎖済み**、コミット `4475795`)+ 特区 `apps/soul`(参照ドライバ)。**読み取りのみ**(ソース変更・テスト実行・`pnpm install`・アプリ起動なし)。
> 基盤設計=[../../architecture/c5-composition-and-envelopes.md](../../architecture/c5-composition-and-envelopes.md)(Accepted、裁定3件+派生2原則)。親=[../../architecture/c4-control-channel-v0.md](../../architecture/c4-control-channel-v0.md)(契約外殻・additive extension)。C4棚卸し=[c4-planning-inventory.md](c4-planning-inventory.md)。
> 事実はファイル:行で接地。設計上の見立ては「推測:」を前置。C2〜C4棚卸しと同じ構造。
> 依頼元: Undine(L0)。Verdict は §5、先行判断すべき論点は §6、質問は §7。

---

## 1. 要約(先に結論)

- **C5はC4が打った基礎の上に「時間発展」を足す仕事**。C4 Domain B が心臓tickに**オーバーレイ第二seam**(`autonomous-frame-heart.ts:222-228`、Stage Presence snapshot の後・resolver の前で `{ ...activations, ...overlay }`)を既に据えており、評価点は動かさない。C5の核は、この seam が読む**オーバーレイstoreを「静的値+失効時刻」から「時間発展する曲線状態(attack/sustain/decay/release)」へ育てる**こと一点に集約される。契約(`intent.envelope` kind追加)は C4 が用意した additive extension の型どおりに素直に入る。エンベロープ曲線そのものは**C3の blink 生成器(`blink-behavior.ts:207-228`)が既に close(attack)/hold(sustain)/open(decay)+smoothstep で実装済み**——設計§2「C3のsmoothstep流儀」はこの実物を指す。曲線の数学は発明ではなく写経。
- **主コストは1点に偏る(§3)**: **オーバーレイstoreの曲線エンジン化 + 「現在の実効値」フィードバック経路 + release一般化**(§2.1/§2.2/§2.3)。これがC5設計荷重のほぼ全て。残り(契約additive・Stage差し替え・参照ドライバ拡張)は構造が既に接地していて素直。
- **中心の未確定は「現在の実効値の取得経路」**(§2.2、連続性原則3.1/解放曲線3.2の共通前提)。連続性原則は「re-attack起点・release起点=現在の実効値」を要求するが、**現行storeは生成器の基底値を知らない**(storeは自分のTTLエントリしか持たない、`control-channel-overlay-store.ts:37`)。基底値を心臓からstoreへ流す経路(2案、§2.2)を先に裁定しないと、store・心臓・サーバの3ファイルにまたがる切り方が決まらない。
- **Stage Presence差し替えはC4が明示的にC5へ繰延済み**(C4 Domain B報告§8-1: Stage snapshot は pure `activations` のまま。「C5の精緻化対象と解釈」)。裁定1「実効body信号追従」は、心臓の Stage snapshot 位置を**マージ後 `resolvedActivations`** に移す局所変更(§2.4)。
- **C4棚卸しの最大懸念(check:depsのDAG検証ギャップ)はC4実装で解消済み**: `scripts/check-soul-zone-boundary.mjs`(+fixtures)が実在し、特区の一方向依存を機械検証する。特区は package.json 無しの standalone(選択肢B)で確定済み(`apps/soul/README.md:16-18`)。**C5に特区の物理コスト・境界機構の新規負債は無い**。参照ドライバは既に依存ゼロ `.mjs` で稼働(`reference-driver.mjs`)。
- **Verdict: `needs_design`**(§5)。設計討議はAccepted・骨格適合性は極めて高いが、§6の先行判断4点——特に(i)**現在の実効値の取得経路**(store×心臓のフィードバック形)、(ii)release-to-baseline が動く基底を追うか凍結するか、(iii)`intent.set` と `intent.envelope` を単一のスロット状態機械に統合するか、(iv)不正エンベロープ値の拒否コード——がstoreエンジンの内部形とドメイン分割の前提になる。裁定が済めば実装は素直。

---

## 2. 観点別リポジトリ事実

### 2.1 観点1: オーバーレイstoreの拡張性(静的値→時間発展する曲線状態)

**現行store(事実、`control-channel-overlay-store.ts`)**:
- 状態は `Map<slotId, { value: number; expiresAtMs: number }>`(`:37-40`、`RuntimePlayerControlChannelOverlayEntry` `:19-22`)。**静的値+絶対壁時計の失効時刻**のみ。
- `setOverlay(slotId, value, expiresAtMs)`(`:47-49`)= 上書き。`clearAll()`(`:52-54`)= 全消去。`snapshot(nowMs)`(`:62-72`)= `expiresAtMs > nowMs` の生存分を `Record<slotId, number>` で返す(**時間発展なし・単なる生存フィルタ**)。`activeOverlays(nowMs)`(`:81-97`)= 診断用の残TTL付き行(Domain C read model)。
- store 自身は**時刻source-free**(照会 `nowMs` 以外に時計を持たない、`:5-9` docコメント)。失効時刻はサーバが受理時に確定(`channel-request-dispatch.ts:108` `receivedAtMs + ttlMs`)。

**心臓の評価点(事実、`autonomous-frame-heart.ts`)**:
- tick 内で `getChannelOverlay(wallNowMs)`(`:222`)を呼び、`overlay === null ? activations : { ...activations, ...overlay }`(`:223-224`)で resolver 手前にマージ。**評価は tick ごと・壁時計で**。C4はこれで「有効な間は上書き、失効で基底復帰」を Record 生存フィルタとして実現。
- 自律composerが `getChannelOverlay: (nowMs) => store.snapshot(nowMs)`(`input-subsystem.ts:244`)で配線。store は1インスタンスを心臓(read)とサーバ(write)で共有(`input-subsystem.ts:233-234`/`:276`)。

**C5での切り方(推測)**:
- store のエントリを **曲線descriptor** に育てる: `{ peak, attackMs, sustainMs, decayMs, startAtMs, startValue, phase }`(またはより一般に「相の開始時刻列」)。`snapshot(nowMs)` を**生存フィルタから曲線評価**へ変える——各エントリを `nowMs - startAtMs` の経過で attack(startValue→peak)/sustain(peak)/decay(peak→基底)/release へ写像し、smoothstep(`blink-behavior.ts:207-209` の3行を写経)で滑らかにする。
- **評価点(心臓 `:222-224`)は不変**。変わるのは store の `snapshot` の中身だけ。C4の「resolver手前でマージ」構造・純度不変(`{ ...activations, ...overlay }` は新Record、`autonomous-frame-heart-channel-overlay.test.ts:283-313`)はそのまま維持できる。
- **但し `snapshot` の signature が育つ可能性大**(§2.2/§2.3): release-to-baseline と re-attack-from-current が**生成器の基底値**を必要とするため、`snapshot(nowMs, baseValues)` へ拡張するのが自然。この1点が観点2の裁定に依存する。
- **先例の強さ(事実)**: `blink-behavior.ts:212-228` の `blinkDepthAt` は **event = { closeDurationMs, holdDurationMs, openDurationMs, depth }** を経過時間で attack/hold/open に写像し smoothstep を掛ける——**C5エンベロープと構造同型**。C5は「0固定起点・生成器内・logical time」を「現在値起点・store内・壁時計」に置換した版。曲線数学の新規リスクは低い。

### 2.2 観点2: 「現在の実効値」の取得経路(C5設計の中心)

**問題(事実+推測)**: 連続性原則(設計§3.1)は attack/re-attack を**現在の実効値**から立ち上げよと要求する。実効値 = 「その slot が今画面に出している値」= (そのslotに有効なオーバーレイがあれば)前のエンベロープの途中値、無ければ**生成器の基底値**。ところが:
- store は自分のエントリ(前のエンベロープ)は知る(自分で評価するから、`:62-72`)。
- **store は生成器の基底値(`activations[slot]`)を知らない**。基底値は心臓の `heartbeat.generator.sample(logicalTimeMs)`(`:200`)が毎tick産む、store の外の値。
- かつ新エンベロープの受理(`setEnvelope`)は**WSサーバ側で tick間に非同期に起きる**(`channel-server.ts:287-297` の `setOverlay`)。受理の瞬間に「今の実効値」を知る手段が store には無い。

**2案(推測、これが§6の先行判断①)**:
- **案A(storeが直前tickの基底を退避)**: `snapshot(nowMs, baseValues)` に育て、store は毎tick渡される `baseValues` を `#lastBaseValues` にキャッシュ。`setEnvelope` が来たら startValue = (そのslotに稼働中エンベロープあり ? その現時点評価値 : `#lastBaseValues[slot]`)。最大1tick(≒16ms)の陳腐化を許容。storeが「実効値の合成規則」を内包する。
- **案B(心臓が実効値をフィードバック)**: 心臓が前tickの `resolvedActivations`(マージ後=真の実効値、`:223-224`)を `lastResolvedActivations` として保持し、store に供給。`setEnvelope` の startValue = `lastResolvedActivations[slot]`。**意味的に最も正確**(前エンベロープ+基底+set を全部含んだ合成後の値)。心臓は既に `resolvedActivations` を毎tick持つ(`:223`)ので、直前分を1本retainするだけ。
- **physiology純度は両案とも不変**: 生成器 `sample()` は pure のまま(fixture固定対象、`:200`)。実効値フィードバックは**storeまたは心臓のruntime状態**で、生成器には触れない。C3/C4が timestamp/overlay を決定論境界の外に置いた前例と同型(C4 Domain B報告§5)。
- **案の分岐が波及する先**: `snapshot` signature、store の内部状態、心臓が実効値をretainするか、`setOverlay`/`setEnvelope` の引数。**store×心臓×(場合により)サーバの3ファイルにまたがる**ので、ドメイン分割前に裁定が要る。

### 2.3 観点3: release機構の一般化(即時スナップ→解放曲線)

**現行の即時スナップ(事実)**:
- **TTL失効**: `snapshot` が `expiresAtMs > nowMs` で落とす(`:66`)→ 次tickで Record から消える → resolver が基底値に戻る(`autonomous-frame-heart-channel-overlay.test.ts:153-177` が固定)。**即時**。
- **切断**: サーバの `#handleClientClose` が `overlayStore.clearAll()`(`channel-server.ts:313`)→ store 空 → 全slot即時基底復帰(`autonomous-frame-heart-channel-overlay.test.ts:252-281`)。`close()` も同じ `clearAll()`(`channel-server.ts:195`)。**全clearが即時スナップの実装箇所**。

**C5での一般化(推測)**:
- **TTL失効 → release相へ遷移**: エントリを消さず、`nowMs >= sustain終端` で release相に入れる。release は「現在値→基底へ既定release時間で」。**基底は毎tick動く**ので release は blend係数 `lerp(releaseStartValue, baseValue[slot], t)`(t: 0→1 over releaseMs)——これが観点2の基底供給を release でも要求する。t=1 でエントリを削除。
- **切断 → 全slot同時release**: `clearAll()` を **`releaseAll()`** に置換(全エントリを release相へ一斉に、即時消去でなく)。設計§3.2「魂の死=表情がすっと解けて呼吸だけが残る」がこれで完成。
- **局所性**: 変更は (a) store に相フィールド+release評価、(b) `channel-server.ts:195`/`:313` の `clearAll` → `releaseAll` の2箇所、(c) `snapshot` signature(基底供給)。**サーバ側の変更は clearAll呼び出しの差し替えのみ**で薄い。storeが重い。
- **注意(事実→設計判断)**: 現行テスト(`autonomous-frame-heart-channel-overlay.test.ts:153-281`)は**即時スナップを固定している**(失効/切断の次tickでちょうど基底値)。C5でreleaseを入れると**これらのテストは「release中の中間値を経て基底へ」に書き換わる**。C4の即時スナップは「判定対象外」(C4設計§6)だったので、テスト改訂は退行ではなくC5の意図的置換だが、goldenでなくアサーションの書き換えとして明示計上が要る。

### 2.4 観点4: Stage Presence入力差し替え(生成器姿勢値→合成後実効body信号)

**現行配線(事実)**:
- 心臓は Stage Presence用に body-x/body-z を **pure `activations` からsnapshot**(`autonomous-frame-heart.ts:205-209`、**オーバーレイマージの手前**)。`getLatestStageMotionSignal()`(`:285`)が返す。
- `input-subsystem.ts:266` の `getStageMotionDrive` が `heart.getLatestStageMotionSignal()` を読み、`horizontalInput`/`depthInput` に載せる(`:269-271`)。
- **C4 Domain B が意図的にpureのまま残した**(Domain B報告§8-1: 「チャネルが body-x を上書きしても Stage transform は生成器 body-x に従う…C5の精緻化対象と解釈。方向確認したい」)。心臓 `:210-220` のコメントも「Stage Presence snapshot は pure activations を読む位置のまま」と明記。

**C5での差し替え(推測)**:
- 裁定1「合成後の実効body信号へ追従」= Stage snapshot を **マージ後 `resolvedActivations`**(`:223-224`)から取るよう位置を移す(`:205-209` を `:224` の後へ、または `resolvedActivations[BODY_X_SLOT_ID]` を読む)。**局所変更**。「体は一つ、誰が動かしても画面はついてくる」。
- **二重適用リスクへの影響(事実+推測)**: C3が手当てした strength の凸ゲイン(`stage-presence-drive.ts:82-102` の `strength²`)は**入力信号の出所に依存しない**(deriveは strength → settings の写像のみ)。入力を pure→実効に替えても strength 導出は不変なので、**C3の二重適用手当ては再破綻しない**。ただし意味は拡張される: チャネルが body-x を駆動すると、リグの `body.angle` 変形(resolver 経由)**と** Stage オフセット(実効 body-x 経由)が**両方**追従する——これは裁定1の意図どおり(構造的coupling)。C3が懸念した「Stageオフセット vs リグ変形が同じ姿勢に二重反応」の構図は元から意図的couplingで、実効信号化はそれをチャネル駆動値にも広げるだけ。**新たな破綻ではないが、Stage が実効body(チャネル込み)に追従することの機械テストが要る**。

### 2.5 観点5: 契約追加(`intent.envelope` kind)

**additive extension の型が既に接地(事実)**:
- supportedKinds は const 配列(`channel-protocol-contract.ts:29-31` `["intent.set"]`)。hello はこれから自動生成(`channel-protocol-messages.ts` の `createControlChannelServerHello`、supportedKinds を載せる)。→ **`"intent.envelope"` を配列に足すだけで hello が自動告知**。古い魂は知らない kind を送らないだけで共存(設計§3.5、`reference-driver.mjs:311-319` が hello の supportedKinds を自己照合)。
- dispatch は kind で分岐(`channel-request-dispatch.ts:73` `isSupportedKind`、`:85` validateControlChannelIntentSet)。→ **`intent.envelope` 分岐を足し、envelope用validation→envelope write を返す**。overlay write 型(`ControlChannelOverlayWrite` `:25-29`)を envelope write 型に拡張or追加。
- 契約JSONは3枚(`contract/channel-envelope-schema.json`=外殻封筒[C5アニメエンベロープとは別物、名前衝突注意]、`channel-intent-set-payload-schema.json`=payload、`channel-exchange-examples.json`=やり取り例)。**TS型とJSONは `channel-protocol-contract.test.ts` がbyte-sync検証**——両方を同時更新すればテストが整合を守る。
- rejection列挙(`:49-56`)は `unknownKind/invalidPayload/unknownSlot/slotValueOutOfRange/slotNotWritable/channelClosed`。

**envelope validation の追加コスト(推測)**:
- 新規 `channel-intent-envelope-payload-schema.json` + TS型 `RuntimePlayerControlChannelIntentEnvelopePayload`(`{ slotId, peak, attackMs, sustainMs, decayMs }`)+ 新規 validation 関数(`channel-intent-validation.ts` の型を踏襲: peak を `semanticSlotNormalizedRange`(`:70-71`)で範囲チェック[slotValueOutOfRange・クランプ禁止]、slotId を `findSemanticSlotDefinition`[unknownSlot]、書込可否[slotNotWritable])。
- **新規rejection code の要否(§6-④の裁定点)**: 不正な attack/sustain/decay(負値・非有限)は**既存 `invalidPayload`(payloadパース失敗)で吸収可能**(`intent.set` の `parseTtlMs` が `value <= 0` を invalid にする前例、`channel-intent-validation.ts:129-139`)。peak範囲外は `slotValueOutOfRange` を流用。→ **推測: 新規code不要、既存列挙で足りる**。設計§2「additive」とも整合。ただし「envelope固有の不正(例: attack+sustain+decay=0 で生存ゼロ)」を独立codeにするか invalidPayload に畳むかは明示裁定が要る。

### 2.6 観点6: 参照ドライバ拡張(エンベロープ送信)

**現行ドライバ(事実、`reference-driver.mjs`)**:
- `intent.set` のみ送る(`sendIntent` `:322-336`、payload `{ slotId, value, ttlMs? }`)。シナリオは4フェーズの固定タイムテーブル(gaze/tilt/resume/reconnect、`:87-103`)。全intentが accepted 前提で `rejectedCount>0` なら exit 1(`:195-198`)。
- 契約自己照合: 契約JSONの `slotId enum` を読み(`loadContract` `:206-241`)、送る slotId が語彙内か照合(`:105-118`)。hello の supportedKinds を `expectedKinds`(既定 `["intent.set"]`)が満たすか照合(`:311-319`)。
- 依存ゼロ `.mjs`、Node22ネイティブ WebSocket(`:248`)、`node reference-driver.mjs <url>` 直実行。

**C5での拡張(推測)**:
- `sendEnvelope(intent)` を足す(kind: `"intent.envelope"`、payload `{ slotId, peak, attackMs, sustainMs, decayMs }`)。RTT計測(`sendIntent` の `t0`/replyTo相関、`:328-335`)はそのまま流用可(封筒は共通)。
- シナリオに**エンベロープ相**を追加(例: brow/mouth-smile のピークが立ち上がり減衰する「表情ピーク」、body系の持続駆動)。設計§5人間ゲートの証人プロファイル=「魂を殺してもキャラが息をしている(release込み)」+「表情ピークが滑らかに立ち上がり減衰」を体現する振り付け。
- `expectedKinds` に `"intent.envelope"` を含める(hello が両kindを告知することの自己照合)。契約JSON読み取りは `apps/soul/README.md:9-12`/憲章§6.2で許可済み(readFileSync は import でない)。
- **持続駆動テストへの波及(事実)**: `reference-driver-sustained-drive.test.ts:223-225` は `intentCount === 8 / acceptedCount === 8` を固定。シナリオ拡張でこの件数が変わる→テスト更新。同テストは`head-horizontal>=5`で「動いた」を証明(`:246-249`)する構造——エンベロープでも「ピーク値がフレームに出た」+「release中の中間値」の観測を足せる。

### 2.7 観点7: fixtureの形(決定論曲線・連続性の性質テスト)

**決定論fixture(推測)**:
- **store層(pure evaluate)が最適**: `snapshot(nowMs[, baseValues])` は WS・timer 無しの純関数(現行 `:62-72` も純)。「インテント列(受理時刻付き `setEnvelope`)+ tick列(nowMs列)[+ baseValues列]→ 出力Record列」を store 単体で固定できる。決定論(同じ入力→同じ出力列、設計§5機械ゲート)の最も清潔な置き場。曲線形状(smoothstep)・相境界(attack→sustain→decay→release)・re-attack起点をここでpin。
- **心臓統合層(連続性の性質テスト)**: `autonomous-frame-heart-channel-overlay.test.ts` が**完全な雛形**——`createManualScheduler`(`:74-88` handler捕獲+`fire()`)、`setNow(ms)`(`:108-112`)、`lastValues(frames)`(`:115-120`)で、fake now を進めながら publish frame を観測する流儀が確立。**連続性の性質テスト(隣接tick差の有界=スナップ不在)**は、attack/sustain/decay/release 全域で `|frame[n].param - frame[n-1].param| < bound` をこの雛形で回す。既存の即時スナップテスト(§2.3)がこの雛形上にあるので、release置換後の「中間値を経て基底へ」も同じ形で書ける。
- **fixtureの流儀(事実)**: physiology golden は `blink-behavior-fixture`/`full-generator-snapshot.golden.json` 等の JSON スナップショット照合(C4 Domain B報告§5)。C5の曲線fixtureは**pure eval の入出力列アサーション**(golden JSON でも直アサーションでも可)。fake timer は使わず引数の nowMs 列で駆動できるのが store層の利点。

**smoothstep共有(事実+推測)**: `smoothstep`(`blink-behavior.ts:207-209`)は physiology/ 内の private helper。overlay store は physiology/ の**外**(runtime状態、決定論境界の外)にあるので、境界規律上 physiology/ からの import は避け**3行を写経**するのが清潔(あるいは中立mathリーフへ抽出)。些細。

---

## 3. C5計画への含意(ドメイン分割の示唆、主コスト)

**ドメイン分割の示唆(推測、設計の二層=契約/合成 と整合)**:
- **Domain 契約(envelope kind additive)**: `intent.envelope` を supportedKinds に追加 + payload schema JSON + TS型 + envelope validation(peak範囲・attack/sustain/decay検証)+ dispatch 分岐 + hello 自動告知の確認 + `channel-protocol-contract.test.ts` の byte-sync 更新。rejection は既存列挙流用(§2.5、新code要否は§6-④)。**依存が浅く並行可能**。
- **Domain オーバーレイ曲線エンジン + 心臓seam進化(C5の核)**: store を曲線状態機械へ(attack/sustain/decay/release + smoothstep)+ `snapshot` signature 進化(基底供給)+ **現在の実効値フィードバック経路**(§2.2、案A/案B)+ release一般化(§2.3、`clearAll`→`releaseAll`)+ 決定論曲線fixture(store層)+ 連続性の性質テスト(心臓統合層)。**store×心臓×サーバ(clearAll差し替え)にまたがる**。§6-①②③の裁定が前提。
- **Domain Stage Presence 実効信号差し替え**: 心臓の Stage snapshot を pure→`resolvedActivations` に移す(裁定1、§2.4)+ 「Stageが実効body[チャネル込み]に追従」の機械テスト。小さいが二重適用の意味を確認しつつ。
- **Domain 参照ドライバ + 人間ゲート証人 + 持続駆動テスト拡張**: `sendEnvelope` 追加 + エンベロープ相のシナリオ(「魂殺害→release」「表情ピーク立ち上がり減衰」)+ `expectedKinds` 拡張 + `reference-driver-sustained-drive.test.ts` の件数/観測更新。人間ゲートの実駆動プロファイルの証人役。

**主コスト順(推測)**:
1. **オーバーレイ曲線エンジン + 実効値フィードバック + release一般化**(§2.1/§2.2/§2.3)——C5設計荷重のほぼ全て。特に現在の実効値の取得経路(§6-①)が store×心臓の内部形を決める。曲線数学自体は blink 先例の写経で低リスク。
2. **契約 envelope kind + validation + dispatch分岐**(§2.5)——additive の型が既に接地、構造は素直。新規は payload schema/型/validation とdispatch 1分岐。
3. **参照ドライバ + シナリオ拡張 + 持続駆動テスト更新**(§2.6)——`sendEnvelope` と振り付け、テスト件数更新。
4. **Stage Presence 実効信号差し替え**(§2.4)——局所だが裁定1・couplingの意味確認とテスト。

**C4/C3からの再利用(事実)**: 心臓のオーバーレイseam(`:222-228`)・overlay store共有配線(`input-subsystem.ts:233/244/276`)・additive契約(supportedKinds const・dispatch分岐・byte-sync test)・rejection列挙・semantic範囲分類器(`semantic-slot-normalized-range.ts`)・fake schedulerテスト雛形(`autonomous-frame-heart-channel-overlay.test.ts`)・blinkエンベロープ+smoothstep(`blink-behavior.ts:207-228`)・参照ドライバ骨格(RTT/hello/契約自己照合)・特区境界機構(`check-soul-zone-boundary.mjs`)は全て流用可。**C5の真の新規は「store の時間発展化」「現在の実効値フィードバック」「release曲線」の3本**——いずれも既存seam上の育成であり、新サブシステムの新設は無い。

---

## 4. リスクと未知

1. **現在の実効値の取得経路(§2.2、最重要)**: store は基底値を知らない。案A(storeが直前基底を退避)/案B(心臓が実効値をフィードバック)の分岐が store・心臓・サーバの切り方を決める。裁定前はドメイン分割が固まらない。→ §6-①。
2. **release-to-baseline の基底が動くこと(§2.3)**: 基底は毎tick変わる(呼吸)。release を「凍結した基底へ」か「動く基底を追うblend係数」か。連続性(3.1)は動く基底を追う方が正確だが、実装は blend係数管理が要る。→ §6-②。
3. **`intent.set` と `intent.envelope` の統合(§2.1/§2.5)**: 同一slotに set(静的+TTL)の後 envelope が来たら、envelope は set値から re-attack すべき(連続性3.1「同一スロットへ新intent=現在値からre-attackで置換」)。**set を「attack=0・sustain=TTL・release=既定 の特殊エンベロープ」として単一のスロット状態機械に畳む**のが素直だが、これは store 内部モデルの統一設計。→ §6-③。
4. **不正エンベロープ値の拒否(§2.5)**: 負のattack、生存ゼロ(attack+sustain+decay=0)等を invalidPayload に畳むか独立codeにするか。→ §6-④。
5. **即時スナップテストの意図的置換(§2.3)**: `autonomous-frame-heart-channel-overlay.test.ts:153-281` は即時スナップ前提。release導入で書き換わる(退行でなくC5置換)が、C4のオーバーレイ意味論テストの大半に触れる。件数と意図の明示計上が要る。
6. **連続性の性質テストのbound(§2.7/§7)**: 「隣接tick差の有界」の具体閾値(peak/attack時間/60Hz から導く上限)が未定義。attack 120ms・60Hz なら約7tickで peak 到達、tick差 ≈ peak/7 が理論上限。release時間の既定値も未定(設計§3.2「露出しない普遍既定」)。→ §7。
7. **未知: 人間ゲートの証人シナリオの具体形**: 「魂を殺してもキャラが息をしている」= ドライバの意図的切断→release観測、「表情ピーク滑らか」= エンベロープ相。この振り付けの具体(どのslot・どのpeak・どのタイミング)は参照ドライバ拡張時に確定。設計§5は性質を述べるのみ。

**発見したドキュメント矛盾/ギャップ(黙って直さず列挙)**:
- **設計§2の例 payload `slotId: "brow.updown"` は実在しない語彙**。実スロット語彙(`runtimePlayerMappingSlotIds`)は `head-horizontal/head-vertical/head-tilt/eye-blink-left/eye-blink-right/gaze-horizontal/gaze-vertical/mouth-open/mouth-smile/body-x/body-z`(`reference-driver.mjs:52-64` の写し、契約 enum が正)。「brow.updown」は例示の便宜で実語彙にマップされない。表情ピークの証人には `mouth-smile` 等の既存slotを使う想定と読むのが自然だが、設計例が語彙に接地していない点は明示。
- **名前衝突注意(事実)**: C4の外殻封筒スキーマが `contract/channel-envelope-schema.json`(=メッセージの「封筒 envelope」)。C5のアニメーション「エンベロープ envelope」とは**別概念で同語**。C5の payload schema を `channel-intent-envelope-payload-schema.json` 等にし、外殻の "envelope"(封筒)と混同しない命名規律が要る。ドキュメント上も両者の "envelope" を区別する注記が望ましい。
- **設計§3.2 の release と C4即時スナップの関係**: C4設計§6「スナップの不格好さはC4では判定対象外(C5の被告)」と整合。C5はこれを一般化する立場で矛盾なし。ただし C4テスト(§2.3)が即時スナップを**固定**しているため、C5は設計意図どおりテストを置換する必要がある——これは矛盾ではなく引き継ぎ事項。

---

## 5. Verdict

**`needs_design`**。

設計討議([c5-composition-and-envelopes.md](../../architecture/c5-composition-and-envelopes.md))はAccepted(裁定3件+派生2原則)で、C4が心臓のオーバーレイseam・overlay store共有配線・additive契約・fake schedulerテスト雛形・blinkエンベロープ+smoothstepの先例を残したおかげで**構造適合性は極めて高く、C5の核は「storeの時間発展化」一点に集約される**(新サブシステム新設なし)。C4棚卸しの最大懸念(特区DAG検証)もC4実装で `check-soul-zone-boundary.mjs` として解消済み。しかし wave分割の前に §6 の先行判断4点——特に(i)**現在の実効値の取得経路**(store×心臓のフィードバック形。連続性3.1/解放3.2の共通前提で、store・心臓・サーバの切り方を決める)、(ii)release-to-baseline が動く基底を追うか凍結か、(iii)`intent.set`/`intent.envelope` を単一スロット状態機械に統合するか、(iv)不正エンベロープ値の拒否コード——がstoreエンジンの内部形とドメイン分割の前提になり未確定。裁定が済めば実装は素直で、C3/C4資産を大きく再利用できる。

---

## 6. 先行判断すべき論点(wave計画前にユーザー/Undine裁定)

1. **現在の実効値の取得経路**(§2.2、最重要): **案A(storeが `snapshot(nowMs, baseValues)` で毎tick基底を受け取りキャッシュ、setEnvelope時に startValue を [稼働中エンベロープ評価値 or キャッシュ基底] から確定)** か、**案B(心臓が前tickの `resolvedActivations`=真の実効値をretainし store に供給、startValue=lastResolvedActivations[slot])** か。案Bが意味的に最も正確(合成後の値を起点)。どちらでも physiology純度は不変。この裁定が store の signature・内部状態・心臓の retain 有無を決める。
2. **release-to-baseline の基底の扱い**(§2.3): release中、基底(呼吸で毎tick動く)へ**動的に追従するblend係数** `lerp(releaseStart, baseValue(t), t)` か、**release開始時の基底を凍結**して固定ターゲットへ返すか。連続性(3.1)は動的追従が正確だが実装は係数管理が要る。既定release時間の定数値(露出しない、設計§3.2)も併せて確定。
3. **`intent.set` と `intent.envelope` の統合モデル**(§2.1/§4-3): 同一slotへの set→envelope の re-attack(連続性3.1「現在値から置換」)を成立させるため、**set を「attack=0・sustain=TTL・decay/release=既定 の特殊エンベロープ」として単一のスロット状態機械に畳む**で確定か。それとも set と envelope を別状態として持ち、切替時に実効値を橋渡しするか。store 内部モデルの統一方針。
4. **不正エンベロープ値の拒否コード**(§2.5/§4-4): 負・非有限の attack/sustain/decay、生存ゼロ(合計0)等を**既存 `invalidPayload` に畳む**(推測: 足りる)か、envelope固有の独立 rejection code を additive に足すか。設計§2 の additive 原則との整合で方向確認。

---

## 7. 質問(Undine経由でユーザー確認したい点)

1. **連続性の性質テストのbound と release既定時間**(§4-6/§2.7): 「隣接tick差の有界(スナップ不在)」の合否閾値を、attack/decay の既定時間+60Hz から導く上限(例: peak/(attackMs/16.7) の定数倍)として機械判定してよいか。release の既定時間(露出しない普遍既定、設計§3.2)の具体値の希望はあるか(例: 400ms)。C5機械ゲートの数値化に必要。
2. **人間ゲートの証人シナリオの具体**(§4-7): 参照ドライバのエンベロープ相で、「魂殺害→release」は意図的切断→全slot同時release の観測、「表情ピーク」は特定slot(例 `mouth-smile`)への peak+attack/sustain/decay、で証人役を果たす想定でよいか。設計§2例の `brow.updown` は実語彙に無い(§4ドキュメント矛盾)ため、表情ピークに使う実slotの指定があれば。
3. **契約 "envelope" 命名の区別**(§4ドキュメント矛盾): C4外殻の封筒 `channel-envelope-schema.json` と C5アニメエンベロープが同語衝突する。C5 payload を `channel-intent-envelope-payload-schema.json` 等とし、ドキュメント/コードで両 "envelope" を区別する命名規律で進めてよいか(実装時決定だが方向確認)。

---

## 付録: 主要ファイル索引(絶対パス)

**オーバーレイstore / 曲線エンジン化(観点1/2/3、C5の核)**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\control-channel-overlay-store.ts`(:37-40 静的値+失効時刻state・:47-54 setOverlay/clearAll・:62-72 snapshot生存フィルタ=曲線評価へ育てる対象・:81-97 activeOverlays診断)
- `...\apps\runtime-player\src\main\physiology\blink-behavior.ts`(:207-209 smoothstep・:212-228 blinkDepthAt=attack/hold/open エンベロープ先例=C5曲線の写経元)

**心臓seam / 評価点 / Stage差し替え(観点2/4)**:
- `...\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.ts`(:222-228 オーバーレイマージ評価点[不変]・:200 pure sample・:205-209 Stage snapshot=pureのまま[裁定1で実効へ移す対象]・:223-224 resolvedActivations=真の実効値[案Bのフィードバック源]・:285 getLatestStageMotionSignal)
- `...\apps\runtime-player\src\main\role-composition\input-subsystem.ts`(:233-234 store生成・:244 getChannelOverlay配線・:261-273 getStageMotionDrive[Stage入力の読み口]・:276 store共有露出)
- `...\apps\runtime-player\src\main\presence\stage-presence-drive.ts`(:82-102 strength凸ゲイン=二重適用手当て[入力出所非依存])

**契約 additive(観点5)**:
- `...\apps\runtime-player\src\main\control-channel\contract\channel-protocol-contract.ts`(:29-31 supportedKinds const[envelope追加点]・:49-59 rejection列挙・:115-119 intent.set payload型[envelope型の雛形])
- `...\apps\runtime-player\src\main\control-channel\contract\channel-envelope-schema.json`(外殻封筒=名前衝突注意・:7 supportedKinds・:64-73 rejectionCodes enum)
- `...\apps\runtime-player\src\main\control-channel\contract\channel-intent-set-payload-schema.json`(payload schema=envelope schema の雛形)
- `...\apps\runtime-player\src\main\control-channel\contract\channel-protocol-contract.test.ts`(TS↔JSON byte-sync検証=envelope追加時に両更新)
- `...\apps\runtime-player\src\main\control-channel\channel-intent-validation.ts`(:70-71 semantic範囲チェック・:129-139 parseTtlMs[不正値→invalidの前例]=envelope validation の雛形)
- `...\apps\runtime-player\src\main\control-channel\semantic-slot-normalized-range.ts`(:22-38 sourceKind→正規化域[peak範囲チェックに流用])
- `...\apps\runtime-player\src\main\control-channel\channel-request-dispatch.ts`(:73/:85 kind分岐[envelope分岐追加点]・:25-29 ControlChannelOverlayWrite[envelope write型])

**サーバ / release一般化(観点3)**:
- `...\apps\runtime-player\src\main\control-channel\channel-server.ts`(:52 defaultWindowMs・:195/:313 clearAll[releaseAll差し替え点]・:287-297 setOverlay呼び出し[setEnvelope追加点]・:266 hello送信)

**参照ドライバ / 持続駆動(観点6)**:
- `...\apps\soul\reference-driver\reference-driver.mjs`(:87-103 シナリオ4相[envelope相追加点]・:322-336 sendIntent[sendEnvelope雛形]・:311-319 hello supportedKinds自己照合・:206-241 契約JSON読み取り)
- `...\apps\soul\README.md`(:16-18 package.json無しstandalone確定・:9-12 契約読み取り許可)
- `...\apps\runtime-player\src\main\control-channel\reference-driver-sustained-drive.test.ts`(:223-225 intentCount=8固定[拡張で更新]・:246-249 「動いた」証明構造)
- `...\scripts\check-soul-zone-boundary.mjs`(特区一方向依存の機械検証=C4棚卸し懸念の解消物)

**fixture / テスト雛形(観点7)**:
- `...\apps\runtime-player\src\main\role-composition\autonomous-frame-heart-channel-overlay.test.ts`(:74-88 createManualScheduler・:108-120 setNow/lastValues・:153-281 即時スナップテスト[release置換対象]=連続性性質テストの雛形)
- `...\apps\runtime-player\src\main\control-channel\control-channel-overlay-store.test.ts`(store単体テスト=決定論曲線fixtureの置き場)
