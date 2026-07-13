# S5 follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録開始（2026-07-13, Gnome / S5 Domain C 後半）。台帳の流儀は
> [../s4/s4-followup.md](../s4/s4-followup.md) を踏襲。
> 出典: [domain-a.md](domain-a.md) §7 質問 + [domain-b.md](domain-b.md) §7 質問 +
> [domain-c.md](domain-c.md) §7 質問（前半 C-impl）+
> [../../../experiments/s5-vision.md](../../../experiments/s5-vision.md) §6（未実測）+
> [../../orchestration/s5-planning-inventory.md](../../orchestration/s5-planning-inventory.md) §4。

## 1. 実ゲーム窓での実写り（人間ゲート待ち・最優先の梯子）

wave-plan §1 の人間ゲート本体。[human-gate-procedure.md](human-gate-procedure.md) §8-1 に判定
手順を用意した。**この wave の機械ゲート・実 SDK 観測（s5-vision.md）はすべて「自分で起動した
メモ帳窓」に対する検証であり、実ゲーム窓（GPU スワップチェーン描画）で PrintWindow が composited
内容を撮れるかは未検証のまま**（棚卸し §3-1 の重大な地雷「gdigrab は DirectComposition 系描画が
真っ白でも成功扱いになった」の教訓が、採用経路の PrintWindow にも及ぶかは実ゲームで試すまで
分からない）。

- **白紙成功リスクの扱い**（domain-a.md §7 質問 2）: `MIN_PLAUSIBLE_BASE64_LENGTH` ガードは
  形式チェック（100 文字未満を弾く）であり画素解析ではない。「サイズは妥当だが中身が真っ黒/透明」
  は検出できない。**梯子**: 人間ゲートで実際にこの地雷を踏んだら、(a) 画素解析（例: 全ピクセルが
  単色に近いかのヒストグラム判定）を `window-capture.mjs` の PowerShell スクリプト側または Node
  側に足す、(b) gdigrab 等の代替キャプチャ経路への切替、のどちらかを検討する段を起こす
  （棚卸し §5 追加裁定 1「問題になるようならその時考えよう」に沿う・先回りの多重実装はしない）。
- **PrintWindow の最小化/被覆時の実挙動**（domain-a.md §7 質問 1・棚卸し §4-3）: 本実装は
  `IsIconic` を PrintWindow の**前に**呼んで最小化を弾く予防的設計だが、PrintWindow 自体が
  最小化/被覆時にどう振る舞うかは未検証。[human-gate-procedure.md](human-gate-procedure.md) §9
  に切り分け手順を用意した。実機で異なる挙動が観測されたら `window-capture.mjs` の判定順序/
  kind 分岐を見直す。
- **JPEG 品質 75・縮小長辺 1024 はゲーム画面（高密度）で未実測**（domain-a.md §7 質問 3）。
  `s5-vision.md` はメモ帳（低密度・白背景）でのみ実測（base64 ≈21.8KB）。棚卸し §3-3 の見積り
  （ゲーム画面想定で 100〜160KB/枚）との乖離は人間ゲートで実機観測してから判断する。もし大きすぎる
  /劣化が気になる場合、`jpegQuality`/`maxSide` は `captureWindow` の options で調整可能（v0 は
  操縦席にツマミを出さない裁定のまま・固定値を変えるならコード側の定数を直す）。
- **DPI スケーリング >100% は未検証のまま**（domain-a.md §7 質問 5・棚卸し §4-4）。実機検証環境が
  全モニタ 100% だったため、この wave でも検証できていない。

## 2. 累積の重さ（裁定 2「計測できるように・早期検知」の実測結果）

**良いニュース: 急ぎの梯子ではない。** `s5-vision.md` §4 (c) の実測で **prompt caching が
効いており、画像込み履歴の再送コストは cache-read 価格として計上される**ことを確認した
（`input_tokens` は毎回 2 のまま一定・`cache_read_input_tokens` が 0→1184→1333→1492→1692 と
単調増加）。棚卸し §2-3 未確定 (a)「prompt caching が常駐セッション内で効いて再送分が
cache-read 価格になるか」への回答は「効いている」。

- **梯子（急ぎではないが記録しておく）**: cache-read の実際の金額換算（削減率）は未検証
  （s5-vision.md §6）。長時間配信（1 セッションが数時間続く）で cache TTL（今回の観測では
  `ephemeral_1h_input_tokens` にのみ値が乗り 5 分 TTL 側は 0 だった）が切れた場合の挙動
  （キャッシュ切れ後に再度フル料金になるか）は未検証。長時間運用で「重さ」の兆候
  （TTFT/ask_ms の劣化・cache_creation_input_tokens の再増加）が観測されたら、
  棚卸し §2-3 未確定 (b)(c)（履歴から画像を後から落とす手段・Files API の可否）の調査を含む
  段を起こす。
- **usage 表示の粒度**（domain-c.md §7 質問 1・前半 C-impl）: 前半 Gnome は「直近 1 回分」のみを
  表示する最小実装に留めた。s5-vision.md の実測では、cache_read_input_tokens の単調増加という
  形で「累積の重さ」の兆候が ask ごとの値だけでも十分読み取れた（前後比較すれば増加傾向が分かる）
  ため、**v0 のままで早期検知の役目は果たせていると判断できる**。履歴（スパークライン相当）が
  必要になるのは、実運用で「直近値だけでは変化に気づきにくい」という声が出てから（急ぎではない）。

## 3. 蓄積の梯子（棚卸し §5 議論裁定 7 の想定シーン）

v0 は単発・そのask限り（画像を蓄積する機能は作らない）。棚卸し §1 裁定 7 が示した想定シーン
（二択の相談/ビフォーアフター/覚え書き係）——「複数の画面を見比べたうえでの発言」は言語痕跡の
非可逆性（ピクセル粒度の比較不能）が実配信で不足と観測されたら、複数画像蓄積を一段として検討する。
**この wave では観測材料が無い**（実配信運用そのものが人間ゲート後の話）ため、着手判断は将来へ
持ち越す。

## 4. ポーリングの梯子（v0 外・実測後）

棚卸し §1 裁定 3 の再確認: ポーリング（定期的な自動視覚発火）は v0 外。s5-vision.md の実測
（cold ask #1 が 6.8s・warm でも 3〜5.6s 程度）を踏まえると、頻繁なポーリングは配信のテンポと
LLM 枠消費の両面で負荷になりうる。実運用で「毎回ボタンを押すのが煩わしい」という声が出てから、
間隔・トリガ条件（例: 一定時間ごと/シーン変化検知）を設計する段を起こす。

## 5. Domain B §7 質問のうち Domain C（前半・本 wave 内）で解消済みのもの

- **onUsage に `vision` フラグを独自追加**（質問 2）: **【CLOSED】** Domain C 前半がそのまま
  SSE `usage` イベントへ橋渡しした（cockpit-server.mjs・domain-c.md §2-4）。形状変更は不要だった。
- **getVisionTarget の注入形**（質問 3）: **【CLOSED】** `createVisionTargetHooks(settings)` が
  cockpit-settings から実装済み（domain-c.md §3・§4）。
- **onVisionCaptured のサムネを SSE にどう載せるか**（質問 4）: **【CLOSED】** SSE `visionCaptured`
  イベントとして配線済み（domain-c.md §2-4・§4）。
- **onFire ペイロードの `vision:true`**（質問 5）: **【CLOSED】** Domain B の実装のまま
  Domain C 側で吸収不要だった（追加の変換ロジックは書かれていない・そのまま透過で足りた）。
- **captureImpl の引数不正 throw**（質問 6）: 実運用でこの throw 経路を踏むことはない設計のまま
  （non-issue。closed 扱い）。

## 6. Domain A §7 質問のうち非 blocking のまま持ち越すもの

- **spawn pid ≠ 実ウインドウ所有 pid**（domain-a.md §7 質問 4）: `captureWindow`/`listWindows`
  自体には影響しない（`listWindows` が返す pid のみを正としているため）。この wave の
  `scripts/observe-vision.mjs` も preflight-eyes.mjs と同じパターン（`listWindows` で見つけた
  pid + spawn pid の両方に taskkill）で後始末しており、実害は出ていない。今後「自起動アプリの
  pid を追跡する」設計をする側（human-gate procedure の手動運用も含む）は引き続き注意する。
- **タイムアウト既定値は見積りベース**（domain-a.md §7 質問 6）: `captureWindow` 既定 5000ms・
  `listWindows` 既定 3000ms は引き続き見積りのまま。s5-vision.md の実測（capture 630ms）は
  この範囲に収まっている。運用でタイムアウトが頻発/逆に短すぎる場合は options で調整可能。

## 7. Domain C（前半）§7 質問のうち非 blocking のまま持ち越すもの

- **`GET /api/windows` の実地確認**（domain-c.md §7 質問 2）: `scripts/observe-vision.mjs` は
  `listWindows()` を直接呼んで実地確認した（メモ帳の一覧取得は疎通済み）が、cockpit-server 経由の
  `GET /api/windows` エンドポイント自体（HTTP 層）は実地未確認のまま。
  [human-gate-procedure.md](human-gate-procedure.md) §6「Refresh windows ボタン」の手順で
  人間ゲート時に確認する。
- **サムネがディスクに書かれないことの直接証跡**（domain-c.md §7 質問 3）:
  [human-gate-procedure.md](human-gate-procedure.md) に「任意（余裕があれば）」として DevTools
  確認の手順を追記した。必須の合格条件にはしていない（構造的な担保で十分と判断・余裕があれば
  裏取りする位置づけ）。
- **`fireVisionError` を diagnostic イベントの拡張にした設計判断**（domain-c.md §7 質問 4）:
  既存 `diagnostic` ハンドラへの相乗り設計。レビューで異論が出なければこのままでよい
  （新規イベント種別を増やさない選択のメリットを優先）。
- **`visionTargetStatus` を `channelStatus` と非対称にした理由**（domain-c.md §7 質問 5）:
  ウインドウタイトルは機密情報を含まない前提での非 redact 設計。将来ウインドウタイトルに
  ユーザー名等が含まれるケースを気にすべきかは判断が割れうるため、レビューでの確認を推奨。
- **`POST /api/vision-target` の入力形をタイトル文字列限定にした点**（domain-c.md §7 質問 6）:
  同名ウインドウが複数存在するケースの識別性は担保していない（domain-a.md の「プロセスごと主窓
  1 個のみ列挙」制約と合わせて実運用で問題になるかは未観測）。マルチウインドウ構成のゲームで
  問題が出たら、`pid` を対象識別子に含める設計（`POST /api/vision-target` に `pid` を足す・
  `getVisionTarget` の解決を `pid` 優先にする）への拡張を検討する。

## 8. Domain B §7 質問のうち裁定として残る非 blocking 事項

- **視覚発火は空窓でも続行する設計**（domain-b.md §7 質問 1）: 「見て」と言われたら会話が無くても
  画面だけで反応してよい、という Domain B の解釈は本 wave のレビュー・人間ゲートで明示的な裁定を
  経ていない。s5-vision.md の実射では毎回 you 発話を積んだ状態で観測しており、空窓時の挙動は
  この wave でも実射確認していない（`fireVision` 内に 1 判定を足すだけで対応できる旨は
  domain-b.md に記載済み）。次にこの経路を触る機会があれば裁定を確定させる。
