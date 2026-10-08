# 「朗読と合いの手」planning gate 棚卸し

> Status: 完了(2026-07-18)。実配信フィードバック(アークナイツ朗読セッション・2026-07-18)発の閉問題。
> 計画本体: [reading-interjection-wave-plan.md](reading-interjection-wave-plan.md)。

## 1. 発端(ユーザーフィードバック・実朗読セッション)

1. 区切り発火の転写到着ゲート化(5bf3cfd)は実戦合格(「私の発言を待って読み上げるようになった」)。
2. **barge-in が朗読では邪魔**: ストーリー読み上げ中に気づかず喋り続けるとこーでぃーの発話を止めてしまう。「二人の発話がかぶっている状況の方がまだ望ましい」。
3. **連続朗読は発火語彙の空白地帯**: 区切りは「2 秒の完全無音」待ちで朗読の息継ぎ(0.5〜1s)では判定に入らず、沈黙は活動リセットで永遠に来ない。ユーザー仮説「発火判定に入るタイミングが存在していない」は構造的に正しいと確認。

## 2. 裁定(2026-07-18 ユーザー確定)

| # | 論点 | 裁定 |
|---|---|---|
| 1 | barge-in トグル | ON/OFF トグルを**運転バー**に置く・永続・既定 ON。OFF は猶予もろとも無効=完全かぶり許容 |
| 2 | 切断猶予 | speechStart で即切らず **2000ms** 見合う。猶予内に speechEnd が来たらこーでぃーは切られず続行。超えて発話継続なら切断。副次効能=短い相槌(<2s)で切れなくなる |
| 3 | 第 7 の語彙「合いの手(interjection)」 | 連続発話の累積駆動。「沈黙の別バージョン=場が流れ続けとる→流れに軽く一言」(ユーザーの言語化)。沈黙の写経(基礎+ジッター+不応期・**確率なし**) |
| 4 | 連続の意味論 | **発話間隙 < 2 秒なら連続**(声を出し続ける必要はない)。2 秒以上で連続が切れ、区切り発火の管轄に引き継ぐ(2 秒境界を共有=分担に隙間も重複もない)。切れたら累積リセット |
| 5 | 口数連動 | 基礎 30/60/120s(おしゃべり/ふつう/控えめ)・ジッター +0〜15/30/60s・不応期 15/30/60s |
| 6 | 不応期の意味論 | **発火する瞬間の最低間隔チェックのみ**(累積を止めたり遅らせたりしない)。通常の朗読では基礎>不応期ゆえ姿を見せず、直前に別の発火(呼びかけ・コメント)が割り込んだ時だけ効く保険 |
| 7 | 予算 | **なし**(ユーザー裁定: 頻度が低いので上限の利益より「ある段階から全く発火しなくなる」害が大きい) |
| 8 | 画像 | 自発発火と同じ同乗 preferred(失敗は静かに劣化) |
| 9 | 発火時の累積 | 自分の発火で累積リセット(「一言入れた、次はまた 30 秒聞いてから」) |

## 3. リポジトリ事実(Sylph 調査・file:line 付き)

- **barge-in ゲート**: barge-in.mjs `createBargeInGate`(:160-215)。speechStart→`minSpeechMs`(200ms・:30)の speechCancel 監視弁→`onConfirm`。**speechEnd は現状無視**(:205)・**有効/無効の口なし**・タイマー注入は setTimeoutImpl/clearTimeoutImpl(:166-167・nowImpl なし)。結線は cockpit-server.mjs :1239-1250(onConfirm→fireOrchestrator.interrupt best-effort)・handle 呼び出し :655。
- **トグル写経元(selfFire 5 点セット)**: Pill UI(control-bar.mjs:87-101/:186-205)・view-logic(control.mjs:93-125)・POST /api/self-fire(cockpit-server.mjs:903-923)・settings boolean キー(settings-store.mjs:139-146)・hooks(cockpit.mjs createSelfFireHooks :296-312)・snapshot(:518)・server テスト群(:1923-1959/:2426-2450 ほか)。
- **語彙マッピング**: onFireRequest(cockpit-server.mjs:1263-1302)は `silence→vision:true / それ以外→vision:"preferred"` の二分(:1282-1285)。**新 kind "interjection" は else 枝に自動で入る=server 側無改修**。selfFire SSE は kind 素通し(:1288-1292)=無改修。
- **発火札**: markers.mjs/ghost.mjs は kind 文字列をそのまま出す(日本語テーブルは存在しない)。
- **fire-scheduler**: handleVadEvent(:524-544・転写到着ゲート込みの現行形)。「連続発話の累積」を追う状態は現状なし(armed パターンが最近い雛形)。注入流儀=nowImpl/rng/setTimeoutImpl(:387-390)。VERBOSITY_BUNDLES は 3 モード×9 値(:283-320・normal は export 定数への参照で単一の源)。
- **diagnostic**: bargeIn 診断は severSpeaking 発の切断点情報のみ(fire-orchestrator.mjs:551-557→cockpit-server.mjs:596-608)。猶予・トグル状態の観測は現状なし。

## 4. L0 設計裁定(Sylph の設計質問 3 件への回答)

1. **トグルの層**: `bargeInGate` 自身に `setEnabled(bool)`/`isEnabled()` を新設(selfFire が fireScheduler 自身に setEnabled を持つのと対称。server は委任するだけ)。OFF 遷移時は進行中の猶予/弁タイマーも畳む。
2. **猶予の形**: `createBargeInGate` の**拡張**(別層は作らん)。二段構え——第一段=既存 200ms speechCancel ノイズ弁(不変)・第二段=**新設 2000ms speechEnd 監視の猶予段**(`BARGE_IN_GRACE_MS = 2000` を export 定数+注入可)。第一段通過→猶予タイマー起動→speechEnd 到着で取り消し(切らない)→猶予満了かつ発話継続なら onConfirm(切断)。speechEnd 後に再び speechStart が来たら新しい一巡(弁 200ms から)。
3. **発火札**: kind 文字列 `"interjection"` をそのまま(既存語彙も英語のまま=統一・日本語テーブルは作らない)。

## 5. 合いの手の機構(計画への持ち込み)

- **連続 run の追跡**(scheduler 新設): speechStart で run 開始(未開始なら)+間隙タイマー取り消し。speechEnd で間隙タイマー(**turnEndSilenceMs を共用**=2 秒境界の定義一致)起動→満了で run 終了(合いの手タイマー取り消し・累積リセット)。
- **発火タイマー**: run 開始時に `基礎 + ジッター×rng` で武装。満了時に enabled/busy/不応期(lastFireAtMs 基点)をチェック→通れば `emitFire("interjection")`+累積リセット(run は継続・次の一巡を再武装)。**不応期/busy で弾かれたら累積は殺さず、明けを見計らって再判定**(静かに諦めるのではなく再武装——朗読が続いとる限り機会は保つ。正確な再武装形は Gnome 裁量+レビューで固定)。
- **VERBOSITY_BUNDLES**: 9 値→**12 値**(interjectionBaseMs/interjectionJitterMs/interjectionRefractoryMs ×3 モード)。setVerbosity で仕切り直し(run/タイマー解除)。
- FireRequest 型に kind 追加。server/UI は素通しで無改修(§3)。
