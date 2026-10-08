# S5 planning inventory: 目が開く(視覚発火)

> Status: 完了(2026-07-13)。議論裁定8件+追加裁定2件(§5)で全て解消。wave計画は [s5-wave-plan.md](s5-wave-plan.md)。
> 実施: Sylph A(コード+SDK型定義+公式docs)・Sylph B(実機キャプチャ検証・Windows 11 / 3モニタ / ffmpeg 8.1.2)。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S5(v0=発火時スナップショットのみ・ゲームウインドウ限定・負荷は棚卸し項目)。

## 1. 議論で確定した裁定(2026-07-13)

1. **引き金**: 視覚発火を独立の第二発火として新設(通常Fire無傷)。「見たうえで発火」のUXは実在する(ユーザー裁定)。見る=反応する=ログに残る、は分離しない。
2. **蓄積なし**: v0は単発・そのask限り。見比べは会話ログの言語痕跡で成立(魂の発話済み反応が記憶の役)。ユーザー原文: 「複数の画面を見比べたうえでの発言、というシーンは存在するが、見てほしい画像ごとに発火する運用が望ましく、見るための画像を蓄積するだけの機能は好ましくない」。
3. **ポーリングはv0外**(S分解§3の先行裁定の再確認)。実測後の梯子。
4. **ウインドウ指定**: 操縦席の設定(Channel URLと同じ流儀・local設定に永続化)。起動中ウインドウ一覧から選択+更新ボタン。対象消失/最小化時はゴースト行で正直に可視化。
5. **痕跡**: キャプチャ画像はディスクに書かない(メモリ内使い捨て・録音物と同じ非保存流儀)。操縦席タイムラインに「見た」マーカー行+縮小サムネ。
6. **ツマミなし**: v0は固定縮小(数値は計測で確定)。ゲインの教訓——知覚調整ツマミをCLIにもv0 GUIにも生やさない。
7. **「見るだけ(無言蓄積)」は作らない**。無言の行為は配信のコンテンツにならない。梯子: 言語痕跡の非可逆性(ピクセル粒度の比較不能)が実配信で不足と観測されたら、複数画像蓄積を一段として検討。想定シーン: 二択の相談/ビフォーアフター/覚え書き係。
8. **反応の性格**: 画面キャプチャ+直近会話を合わせて自然に反応。視覚発火は「この画面を見て反応せえ」の意図が乗る(通常Fireとプロンプトを分けられる)。

## 2. コード+SDKの事実(Sylph A)

### 2-1. 現在のメッセージ送信形状

- `src/mind/llm-session.mjs:212-216`: `input.push({ type:"user", message:{ role:"user", content: text }, parent_tool_use_id:null })` — content は現状プレーン文字列。
- 常駐streaming入力: `queryImpl({ prompt: input, options })`(llm-session.mjs:179-191)。input は押し込み型 AsyncIterable(createInputStream :53-100)。options: model claude-opus-4-8 / settingSources [] / persistSession false / maxTurns 1 / tools [] / includePartialMessages true。
- `ask(text)` は非文字列を TypeError で拒否(:204-206)。**画像対応の変更点はこのガードと push 形状の両方**。
- 呼び出し側: fire-orchestrator.mjs:215 `formatFireInjection`(窓5分・上限4000字、fire-injection.mjs:27,30,64-97)→ :229 `session.ask(injectedText)`。本番は scripts/cockpit.mjs:256-265 の sessionProxy 経由(ask(text) シグネチャが通り道)。

### 2-2. 画像ブロックは型レベルで可(streaming入力)

- `SDKUserMessage.message` = `MessageParam`(claude-agent-sdk/sdk.d.ts:4439-4441)。`content: string | ContentBlockParam[]` で `ImageBlockParam` を含む(@anthropic-ai/sdk resources/messages.d.ts:555,610-617,807-810)。
- 形状: `{ type:'image', source:{ type:'base64', data, media_type:'image/jpeg'|'image/png'|'image/gif'|'image/webp' } }`。非beta型に file_id ソースは無い。
- 公式docsも streaming入力モードの画像添付を明示(単発モードは画像非対応): code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode。
- 上限(platform.claude.com vision.md): 1画像10MB・8000×8000px・リクエスト全体32MB。opus-4-8 は高解像度ティア(長辺2576px・最大4784 visual tokens・超過は自動縮小)。トークン≒⌈w/28⌉×⌈h/28⌉(1920×1080→約2691)。

### 2-3. 常駐セッションの文脈は積もる(実測済み・S5設計に効く)

- maxTurns:1 はセッション寿命ではない(1入力あたりの自律ループ上限)。1常駐セッションで複数askはS1実測済み(waves/s1/domain-c.md:68-70)。
- 会話履歴はin-memoryで累積: input_tokens 252→284→318→364 と単調増加(experiments/s1-first-light.md:81-82)。persistSession:false はディスク永続の無効化のみ。
- **含意**: 画像1枚を注入すると、そのセッションの以後すべてのaskで履歴として再送され input tokens を払い続ける(公式vision.mdも multi-turn の base64 再送を明記)。
- **未確定**: (a) prompt caching が常駐セッション内で効いて再送分が cache-read 価格になるか(未計測)。(b) 履歴から画像を後から落とす手段が今の使い方で利くか(未調査)。(c) Files API は非beta型に無く Agent SDK 経由の可否未確認。

### 2-4. 挿入点地図(第二発火種別の受け皿)

- fire-orchestrator.mjs: fire() :198 / busy状態機械 :119-120,203-206,225,252,276-279 / 注入組み立て :213-222 / ask :229 / パーサ分岐 :233-247 / 診断の口 emit(onDiagnostic) :274ほか。
- cockpit-server.mjs: POST /api/fire :632-644 / POST /api/channel(設定フックの写経元) :645-660 / SSE broadcast :371-381・イベント種別 :385-744。
- cockpit.html: Channel URL入力UI :132-139,408-423 / Fireボタン :143,337-352 / 発火マーカー行 :302-315 / 演出行 :320-336 / ゴースト行 :272-284。
- cockpit-settings-store.mjs: writeMerged :60-68 / getter・setterペア :74-87 — **新キー追加は同型ペア+JSONキー1個で済む構造**。保存先 cockpit-settings.local.json(gitignore済み) :33。
- scripts/fire-hotkey.ahk: Ctrl+Alt+F 1本 :27 → FireSoul() :31-42。**第二ホットキーは Hotkey 行1行+POST先を変えた関数1個**。
- scripts/cockpit.mjs: ensureFireResources :233-252 / sessionProxy :256-265 / orchestrator生成 :275-288。

## 3. 実機キャプチャの事実(Sylph B・Windows 11実機)

### 3-1. ffmpeg gdigrab: 機構としては動くが**合成描画が写らない地雷**

- 動く形: `ffmpeg -y -loglevel error -f gdigrab -i "title=<完全一致タイトル>" -frames:v 1 out.png`(stdoutパイプ形も実証)。所要 142〜231ms。タイトルは**完全一致必須**(部分一致・正規表現なし)。日本語+空白は引用符でOK・Nodeは配列引数でOK。
- **重大**: GDI BitBlt取得のため **DirectComposition系の描画内容が写らない**。Win11新メモ帳は「成功」してもほぼ真っ白(本文・タブ・タイトル文字が全欠落)。winverですら静的テキスト欠落。**GPUスワップチェーンで描くゲーム窓が写るかは高リスク・実ゲーム未検証**。「白紙で成功扱い」になるため機械検証をすり抜ける形の失敗。
- 被覆時: 覆いは写らず対象のみ写る(DWMリダイレクトサーフェス)。**最小化時: 即失敗**(exit -5・画像なし)。別モニタ(負座標・4K)問題なし。DPIスケーリング>100%の挙動は検証不能(実機全モニタ100%)。

### 3-2. PrintWindow + PW_RENDERFULLCONTENT(PowerShell .NET): **唯一 composited 内容を撮れた経路**

- 新規依存ゼロ・install不要(System.Drawing は PowerShell 5.1 内蔵)。実測 64ms。gdigrab で真っ白だった新メモ帳が**本文テキスト含め完全に写った**。
- Node からは powershell.exe 起動経由で **+約550ms**(列挙実測から類推)。最小化時・被覆時の挙動は未計測。

### 3-3. 縮小と実サイズ

- `-vf "scale='min(1024,iw)':-2"` で1パス縮小(元が小さければ等倍・偶数丸め)。
- 実測: 白背景UIはPNG優位、高密度画(mandelbrot 1024×576)は JPEG q2=110KB / q5=72KB vs PNG=307KB。**ゲーム画面想定: 長辺1024・JPEG q2〜q5 で 75〜115KB、base64 で 100〜160KB 程度**(mjpeg品質は2=最良〜31)。
- トークン見積り(§2-2の式): 1024×576 → 約777トークン/枚。

### 3-4. ウインドウ列挙

- `Get-Process | Where-Object { $_.MainWindowTitle } | Select Id,ProcessName,MainWindowTitle`: プロセス内 29〜98ms・日本語正常。Node から powershell.exe 起動込みで **546〜563ms/回**(更新ボタン用途なら許容帯)。
- 制約: プロセスごとに MainWindow 1個のみ(同一プロセス複数窓は潰れる。Win11新メモ帳はタブ統合で1プロセス1タイトル)。ゲームは通常1プロセス1窓で実害薄。

### 3-5. 代替手段の事実(選定なし)

- Windows Graphics Capture API: DirectX内容も撮れるが Node からはネイティブモジュール必須=新規依存。
- npm系(screenshot-desktop=全画面のみ / node-screenshots・windows-capture=窓限定可): いずれも新規依存=install発生。
- System.Drawing CopyFromScreen / gdigrab desktop+offset: 画面領域コピーのため覆いごと写る。

## 4. 未確定事項(waveへ持ち込む計測・検証項目)

1. **実ゲーム窓での1枚実写**(gdigrab / PrintWindow 両経路)——「白紙で成功扱い」地雷があるため、waveの最初の検証ゲートに置くべき事実。
2. prompt caching による履歴再送コストの軽減率(input_tokens の ask 毎推移を計器に)。
3. PrintWindow の最小化・被覆時挙動。
4. DPI スケーリング>100% の挙動(実機で検証不能・既知の未検証として記録のみ)。
5. 画像1枚あたりの追加レイテンシ(キャプチャ+base64+API往復)実測。

## 5. 追加裁定(2026-07-13・ユーザー)

1. **キャプチャ経路**: PrintWindow(PW_RENDERFULLCONTENT)を第一候補に採用。実ゲーム窓で中身が写ることの確認は人間ゲートに織り込む。「問題になるようならその時考えよう」——先回りの多重実装はしない(gdigrab等への切替は問題が実際に出た時の追撃)。
2. **画像累積代金**: v0は受容+計器。「計測できるようにして、問題が起きるかを早期に検知できる方向性にしよう」——input_tokensのask毎推移を可視化し、重さが観測されたら梯子(セッション再生成・履歴除去等)を立てる。
