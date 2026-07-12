# S4 planning gate 棚卸し(コード接地)+設計裁定

> Status: 完了(2026-07-13)。Sylph棚卸し(コード接地・根拠パス付き)をUndineが統合。ユーザー裁定はS4設計討議(2026-07-13)+本棚卸し後の4件で解消。
> 対象: S4「表情が乗る」——**定義改定(留保条項の行使)**: 素材に表情差分が無い現状に合わせ、「表情」=**基本顔操作の演出語彙**(視線・頭・目・口角・体の振り付け)とする。Variant差分はpersona/素材の将来トラック(D7除外継続)。

## 1. スロット在庫(チャネル語彙16個、演出向きの抜粋)

| slotId | 意味 | 域 | 生理の書き手 |
|---|---|---|---|
| head-horizontal / head-vertical / head-tilt | 顔の向き2軸+傾げ | -1..1 | head |
| eye-blink-left / eye-blink-right | 目の**閉じ度**(0=開,1=閉) | 0..1 | blink |
| gaze-horizontal / gaze-vertical | 眼球XY | -1..1 | gaze |
| mouth-smile | 口角 | 0..1 | (生理なし・**発話6スロット群の外**=喋りながら駆動可) |
| body-x / body-z | 体2軸 | -1..1 | posture |

- 対応の定義元: `parameter-presets.ts`(Editor標準33個)⇔ `model-mapping-bridge-contract.ts`(チャネル16 slot)⇔ `semantic-slot-definitions.ts` / auto-mapping。
- **眉はチャネル語彙に無い**(Editorプリセットには brow.* が在る)。追加は契約拡張の連鎖=器の小工事。
- mouth-smileは**現素材にkeyform未設定**(ユーザー白状 2026-07-13)——「魂は標準語彙に書く・見えるかは素材の責務」の方針どおり語彙には含める。

## 2. チャネルの機械的事実

- **部分適用可能**: set/envelopeは1intent=1スロット、スロット単位でaccepted/rejected(モデルに無いパラメータは該当intentのみ slotNotWritable)。群単位拒否はspeechのみ。
- **intent.envelope**: `{slotId, peak, attackMs, sustainMs, decayMs}`(ms・合計>0・peakは域内でクランプなし拒否)。TTLなし=ADS自体が寿命。decay後は**release 400ms(固定)で生きた基底へ**。同一slot再送は上書き・実効値からのre-attack(スナップなし)。複数スロット演出=複数intent送出(参照ドライバに先例)。
- **合成は置換merge**: 駆動中そのslotの生理は見えなくなる→**細目中は自発瞬きが止まる**(数秒演出なら許容・裁定3)。
- 魂側挿入点: `fire-orchestrator.mjs` の ask返り(replyText)→speak の間。channel-clientに `sendEnvelope` は未実装(sendSpeechと同型で追加・helloのrequiredKinds拡張に注意)。**現状replyTextはタグ込みで会話ログに積まれる**→speechTextのみに修正(裁定済み)。

## 3. 設計裁定(ユーザー、2026-07-13)

1. **粒度=(b)演出語彙(単語)**。LLMは応答にインラインタグを添えるだけ、語→スロット演出束の写像は決定論。梯子「質感/単語/文」の単語段。
2. **翻訳層は魂の中(v0)**: 写像先をEditorデフォルトパラメータに限定した帰結として、写像は**エコシステム普遍**(リグ固有でない)。四層の昇格の道: 普遍既定値(魂の演出表・v0)→パッケージ宣言(このモデルのsmileの深さ・将来)→Player側プロファイル補正(将来)→変調(将来)。
3. **タグ剥離は魂のパーサ**(TTS直前・純関数・未知タグも剥がして診断ログ)——討議②§2.6「最終テキスト検査」の最初の住人。読み上げ・会話ログは**speechTextのみ**。v0は発話開始時発動(タグ位置は保持のみ)。
4. **眉はv0語彙から外す**(必要なら固有Issue=器の契約拡張waveを別途)。**mouth-smileは語彙に含める**。細目のblink停止はv0許容(sustain 2〜4秒で設計)。
5. **語彙初期セット6語**: smile / troubled / surprised / nod / look-away / look-camera(注視語2つはS5の引数付きAPI=`語+任意引数`の口を先行して開ける)。
6. **数値は宣言表**(魂内のデータ駆動テーブル・コード埋め込み禁止)+**演出強さの一括係数**(全peakスケール・魂のCLI/設定。操縦席には置かない=運用面限定の裁定維持)。
7. S5からの拡張性要件: 翻訳層APIは「語+任意引数」/表はデータ駆動(look-at(x,y)は行とAPI引数で足せる形)/視線スロットの取り合いはC5合成が捌く(設計注記)。
