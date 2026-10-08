# 「朗読と合いの手」wave 計画

> Status: 計画確定(2026-07-18)・発進待ち。
> 根拠: [reading-interjection-inventory.md](reading-interjection-inventory.md)(裁定 9 件+L0 設計裁定 3 件+配管事実)。
> 方式: 単一 Orch-Sylph(opus)が Domain A→B 順次。各ドメイン Gnome(sonnet)実装+Review-Sylph(sonnet)3 レーン(spec/design/test)。鉄の規律・在席プロトコル(委任文に PowerShell 在席ループ明示)は従来どおり。

## 1. ゴールとゲート

- **ゴール**: 朗読セッションが成立する——barge-in を切って(または猶予 2 秒の見合いで)かぶりを許し、読み続ける声に 30〜45 秒ごと(おしゃべり)の合いの手が入る。
- **機械ゲート**: `node --test` 全緑(ベースライン 842)・実 LLM 消費ゼロ・器/契約/依存/lockfile 不変・server ワイヤ契約 additive のみ(POST +1・snapshot キー +1・SSE 種別増なし)。
- **人間ゲート(朗読ゲート・実射)**: ①トグル OFF で朗読→かぶってもこーでぃーが最後まで言い切る ②ON で猶予→かぶって 2 秒以内に君が止まればこーでぃー続行・続ければ切断(見合いの体感) ③おしゃべりで朗読→30〜45 秒ごとに読んどる話に即した合いの手が入る ④通常会話の無退行(呼びかけ・区切り・沈黙・コメントが従来どおり)。

## 2. 設計の枠(裁定済み・詳細は inventory §2/§4/§5)

- barge-in: gate 拡張の二段構え(200ms ノイズ弁不変+**2000ms speechEnd 監視の猶予段**)+gate 自身に setEnabled/isEnabled。OFF は猶予ごと無効。
- 合いの手: 連続 run(間隙 < turnEndSilenceMs=2s で継続)の累積駆動・基礎 30/60/120s+ジッター 15/30/60s+不応期 15/30/60s(発火瞬間の門番のみ)・**予算なし・確率なし**・自発火/連続切れ/口数切替でリセット・不応期/busy では累積を殺さず再武装・vision preferred・kind="interjection"(server/UI 素通し)。
- KILL/NG 検問所・転写到着ゲート(armed)機構は不変。

## 3. ドメイン分割

### Domain A: 魂(src/mind/)

- barge-in.mjs: `BARGE_IN_GRACE_MS = 2000` export・猶予段(speechEnd で取り消し/満了+継続で onConfirm)・`setEnabled(bool)`/`isEnabled()`(OFF で全タイマー畳む)。既存 200ms 弁・onConfirm 意味論は不変。
- fire-scheduler.mjs: 連続 run 追跡(speechStart/speechEnd・間隙は turnEndSilenceMs 共用)・合いの手タイマー(基礎+ジッター)・発火時チェック(enabled/busy/不応期)と再武装・`emitFire("interjection")`・FireRequest 型拡張・VERBOSITY_BUNDLES 9→12 値・setVerbosity/setEnabled/dispose での仕切り直し。
- 機械テスト(fake clock/rng): 猶予内 speechEnd で切られない/猶予超過で切断/OFF で割り込みゼロ/短い相槌(<2s)無害/run 継続と 2s 切断/30s 累積→発火→リセット→再累積/不応期割り込み時の再武装/busy 再試行/口数 3 モードの値切替/**区切りとの排他**(2s 境界で両語彙が同時発火しない)。

### Domain B: 配線+操縦席+docs

- POST /api/barge-in(`{enabled:bool}` 検証・selfFire 写経・gate.setEnabled 委任・snapshot に `bargeIn:{enabled}`・broadcastState)。settings キー bargeInEnabled(boolean・selfFireEnabled 写経+4 種テスト)・cockpit.mjs hooks(createSelfFireHooks 写経)・**起動時に初期値を gate へ伝播**(born-disabled の漏れなし)。
- 運転バーに barge-in Pill(SelfFirePill 写経・自発トグルの隣)。view-logic+page テスト。
- server テスト 6 種(S8 /api/kill 写経)+エンドポイント数コメント追随+onFireRequest が "interjection" を vision:"preferred" で通すことのテスト固定。
- README(発火語彙表に合いの手・barge-in トグルと猶予)+followup 台帳 `discussion/ai-cohost/implementation/waves/reading-interjection/followup.md`。

## 4. blocking レビュー基準

1. **猶予の意味論**: 猶予内 speechEnd →切断ゼロ(interrupt 不呼び出し)。二段(200ms 弁→2000ms 猶予)の合成が正しい(speechCancel は第一段のみ・speechEnd は第二段のみに効く)。
2. **トグルの完全性**: OFF で interrupt に至る経路がゼロ(進行中の猶予も畳む)。born-disabled(起動時 OFF 永続値)の漏れなし。
3. **語彙の排他**: 2 秒境界で合いの手と区切りが同時発火しない(境界値テスト)。合いの手が既存 5 語彙+manual の挙動を 1 ビットも変えない(既存テスト全緑で担保)。
4. **KILL/NG/転写到着ゲート不変**。
5. **ワイヤ契約 additive**・器/依存不変・実消費ゼロ。
6. **不応期の意味論**: 累積を止めない(門番のみ)・再武装で機会を保つ(「ある段階から全く発火しなくなる」状態を作らない=予算廃止の裁定意図)。

## 5. choke point(ユーザーの作業)

- install なし。人間ゲート(§1 の 4 点=朗読実射)のみ。

## 6. Status

- **完全閉鎖(2026-07-19)**。実装+追撃(猶予段 speechCancel 取消弁=followup#1 裁定改訂)= 887/887 緑・全 6 レーン PASS(307a923・5f883b7)。
- **人間ゲート合格**: 1 時間 40 分の実配信で破綻なく喋り切り、①OFF かぶり許容 ②猶予の見合い ③合いの手 ④通常会話の無退行、の 4 点すべて「特に問題なし」(ユーザー実射・2026-07-19)。
- プロセス記録: 在席プロトコル 3 波連続の 1 ターン完走(L0 中継ゼロ・孤児ゼロ)。Orch が機械ゲート未達を自己検知し Gnome 復帰で是正した初事例。
