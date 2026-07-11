# C5 人間ゲート不合格「動きがカクついて見える」原因診断

調査者: Sylph（Undine L0 からの委任） / 日付: 2026-07-11
対象: `feature/2d-rigging-eco-system`、C5 wave 実装直後の作業ツリー（未コミット差分あり）

---

## 症状

参照ドライバの拡張シナリオで自律ホストを駆動 →「動きはするが、動き自体がカクついて見える。実際のインテントのリストを見ても、この駆動ならカクついて見えるのは自然に思える」。
ニュートラルへの戻り（decay/release）は今回は気にならない（ユーザー観察 2026-07-11）。C3 の生理のみの動きは以前のゲートで「完璧」評価。

---

## 検証結果（容疑別）

検証手法: (1) コード読解でファイル:行に接地。(2) `slot-curve-state.ts:66-137` の `sampleSlotCurve` を**行忠実に写経**した node スクリプトで、16.67ms（60Hz）tick 列を流し **実測**の tick ごと波形を算出（理論でなく実波形）。(3) 参照ドライバのシナリオ・タイムラインをソースから抽出。

### 容疑B（曲線機械のバグ）→ シロ（バグなし）

観点を一つずつ潰した：

- **毎tick再評価されているか（受信時一度きりのキャッシュではないか）**: されている。心臓 `autonomous-frame-heart.ts:235` が毎tick `getChannelOverlay(wallNowMs, activations, lastResolvedActivations)` を呼び、それが `input-subsystem.ts:244-245` 経由で `control-channel-overlay-store.ts:160 snapshot()` に届き、`snapshot` は保持している各 curve に対し毎回 `sampleSlotCurve` を呼ぶ（`:171`）。**キャッシュ層は存在しない**。値は毎フレーム再計算される。
- **開始時刻アンカー**: envelope の `startAtMs` は受理時刻（`channel-request-dispatch.ts` の設計コメント + `setEnvelope(slotId, spec, startAtMs)`、`control-channel-overlay-store.ts:103-117`）。set は `startAtMs = #lastNowMs`（直近tickの壁時計、`:86`）。妥当。
- **時間発展の粒度**: `sampleSlotCurve` は `e = nowMs - startAtMs` を連続実数で受け、tick ごとに `e` が 16.67ms 進む。位相境界（attack/sustain/decay/release の継ぎ目）はすべて**連続**であることを式で確認（attack終端=peak=sustain始端、sustain終端=decay始端の peak、decay終端=0=release の releaseFrom）。段差なし。
- **実効値フィードバック（案B）供給タイミング**: `lastResolvedActivations` は前tickの合成後値を保持し次tickへ供給（`autonomous-frame-heart.ts:196,235,239`）。re-attack の `startValue` は現在実効値から始まり、スナップしない（後述の実測で確認）。
- **release blend 評価頻度**: forced release も自然 release も毎tick `sampleSlotCurve` 内で評価。

結論: **曲線機械に不連続・ステップ化のバグは無い**。位相内・位相間ともに連続。

### 容疑C（供給レート/描画経路）→ シロ

- 心臓は毎tick `publishFrame(frame)` を**無条件**に呼ぶ（`autonomous-frame-heart.ts:274`）。値不変tickでのフレームスキップ・dedup は無い。
- オーバーレイの Record マージは毎tick 新規オブジェクトを生成（`{ ...activations, ...overlay }`、`:237`）。quantize・間引きは無い。
- 生理のみ経路（C3で滑らかと実証済み）と同じ `liveParameters.publishFrame` seam を共有。チャネル特有の間引きは無い。

### 容疑A（駆動プロファイル）→ 主因の一つ（確定）

参照ドライバのシナリオ（`reference-driver.mjs`）の内訳を抽出（`phaseScale=1`、既定）:

| 相 | kind | slot | 値/peak | ttl / a-s-d(ms) |
|---|---|---|---|---|
| gaze | intent.set | gaze-horizontal | 0.3 | ttl 400 |
| gaze | intent.set | gaze-vertical | -0.2 | 既定窓 1000 |
| tilt | intent.set | head-tilt | 0.25 | ttl 300 |
| tilt | intent.set | head-horizontal | 0.5 | ttl 600 |
| （沈黙 200ms） | | | | |
| resume | intent.set | gaze-horizontal | -0.1 | 既定窓 1000 |
| resume | intent.set | head-horizontal | 0.2 | ttl 300 |
| envelope | intent.envelope | head-vertical | 0.6 | 60/120/90 |
| envelope | intent.envelope | head-vertical | -0.3（重ねがけ） | 60/120/90 |
| envelope | intent.envelope | body-x | 0.5 | 60/400/90 |
| （切断→再接続 gap 60ms） | | | | |
| reconnect | intent.set | head-tilt | -0.15 | ttl 300 |
| reconnect | intent.set | eye-blink-left | 1 | ttl 200 |

**10 個の intent.set + 3 個の intent.envelope**。set は退化曲線（`attackMs=0`、`control-channel-overlay-store.ts:85-96`）で、受理tickに **base→peak を1フレームで即ステップ**する（`sampleSlotCurve` は `e<attackEnd=0` が常に偽 → 即 sustain の peak）。つまり set 由来の可視モーションはすべて瞬間ステップ。しかも異なるスロットへ 30ms 間隔でバラバラに単発投入され、200ms の沈黙も挟む。

これは**設計どおりの挙動**（set=「粗い上書き」、C4 外面互換のため attack≈0、`slot-curve-state.ts:88`）。ユーザーの「インテントのリストを見ればカクつくのは自然」という自己診断と一致する。**参照ドライバは元来テスト証人**（持続駆動テストの駆動源・RTT ゲート検証・契約エルゴノミクス検証、`reference-driver.mjs:8-10`）であり、知覚的な滑らかさを目的に組まれていない。

### 容疑D（envelopeパラメータ）→ 主因の一つ（確定）

envelope の相持続は**テスト flaky 対策で実時間圧縮**されている（`reference-driver.mjs:42-55`、`ENV_ATTACK_MS=60 / ENV_SUSTAIN_MS=120 / ENV_DECAY_MS=90`）。実測波形（60Hz、写経スクリプト）:

- **head-vertical peak0.6 の attack（60ms＝3.6フレーム）: 最大 per-tick 差分 ≈ 0.224 / frame**（正規化域の 0.6 を約4フレームで駆け上がる）。
- **重ねがけ env2（0.374→-0.3、60ms）: 最大 per-tick 差分 ≈ 0.270 / frame**。
- 導出上限（smoothstep 最大傾き 1.5 × Δ/attackMs × tick）: env1 attack=0.250/tick、env2 attack=0.281/tick。**実測は連続性プロパティ上限を満たす**（テストは正しく通る）が、上限自体が 60ms attack では 0.25/frame と大きい。

0.22–0.27/frame は「連続」ではあるが、60fps で 1 フレームに正規化域の 1/4 を跳ぶ = 知覚的には「ポップ」と読めうる速さ。**60ms の attack は滑らかさでなくテスト実時間圧縮のための値**であり、`SOUL_DRIVER_PHASE_SCALE`（`:45`）で伸縮可能な設計になっている。

（参考: `SOUL_DRIVER_PHASE_SCALE=5` にすると attack=300ms=18フレーム、per-tick 上限 ≈ 0.05/frame まで低下し envelope は滑らかになる。ただし set は `attackMs=0` 固定のため scale に関わらずステップのまま。）

---

## 確定原因

**バグではない。「テスト証人である参照ドライバの圧縮シナリオ」で人間ゲートを駆動したことが原因。** 二つの由来が合成されている：

1. **（容疑A）シナリオが intent.set 主体（10/13）で、set は設計上 1フレームの即ステップ**。異なるスロットへ単発・疎に投入されるため、駆動の大半が段差モーション。
2. **（容疑D）3つの envelope も相持続がテスト圧縮値（attack 60ms）で、実測 0.22–0.27/frame の急峻な立ち上がり**。連続だが知覚的に速すぎる。

曲線機械（容疑B）・供給/描画経路（容疑C）は**シロ**。毎tick再評価・全位相連続・間引きなしを実測で確認済み。C3 生理が「完璧」だったのは、生理生成器が本来滑らかな連続波形で、set のような即ステップ源を持たないため。

---

## 修正方針の選択肢（規模つき）

- **選択肢1〔証人シナリオの知覚化・小〕**: 参照ドライバの人間ゲート用シナリオを、可視モーションは **envelope 主体**に、かつ相持続を知覚向けに延長（attack 200–400ms 相当）する。テスト用の圧縮プロファイルと**別プロファイル**（人間ゲート専用、または `SOUL_DRIVER_PHASE_SCALE` を大きく）にする。規模: 小（`reference-driver.mjs` 編集のみ、器ソース不変）。ユーザーの症状に直接効く。**設計裁定不要**（証人の使い方の調整）。
- **選択肢1'〔ゼロコード緩和・最小〕**: 人間ゲートを `SOUL_DRIVER_PHASE_SCALE=5` 程度で回す。envelope は滑らかになるが、**set のステップは残る**（scale 非依存）。暫定確認用。
- **選択肢2〔set にも既定 ease-in・中〕**: intent.set の退化曲線に小さな既定 attack（例 80–120ms smoothstep）を与え、粗い set も段差でなく滑らかに入るようにする。規模: 中（`control-channel-overlay-store.ts:85-96` の `attackMs=0` を既定値へ）。ただし **「set は attack≈0 の即ステップ（C4 外面互換）」という C5 裁定3/設計 §の外面契約を変える**ため、**Undine/Salamander の裁定が必要**。C4 の「TTL中の値は同一」外面互換テストにも影響しうる。
- **選択肢3〔ゲートの駆動源を変える・最小〕**: 参照ドライバはテスト証人と割り切り、人間ゲートは手書きの滑らかシナリオ（長め envelope 列）で駆動する。規模: 最小（ゲート運用の変更、コード変更なし）。

推奨の起点は**選択肢1**（症状に直接効き、設計契約を触らない）。set のステップ感そのものを「粗い上書きでも滑らかにしたい」という要求がある場合のみ選択肢2の裁定に上げる。

---

## ユーザー/Undine に確認すべき観察

1. **人間ゲートは参照ドライバの既定シナリオ（`SOUL_DRIVER_PHASE_SCALE` 未指定＝1）で回したか？** そうなら圧縮値がそのまま知覚に出ている（本診断の前提）。別 scale で回していたなら数値を共有されたい。
2. **カクつきは主に「異なる部位がバラバラに瞬間移動する」感（=set ステップ由来）か、「一つの表情の立ち上がりが速すぎてポップする」感（=envelope 圧縮由来）か？** 前者が支配的なら選択肢2の裁定要否が焦点、後者なら選択肢1で十分。
3. **intent.set は設計上「粗い上書き=即ステップ」で正しいという理解でよいか？** 滑らかさを set にも求めるなら外面契約変更（裁定2相当）になる。C5 の「解放も曲線／連続性原則」が set の attack にも及ぶべきか、Undine/Salamander の意思確認が要る。
