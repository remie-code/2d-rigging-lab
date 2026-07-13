# S5 wave計画: 目が開く(視覚発火)

> Status: **機械ゲート緑・全ドメイン実装完了・人間ゲート待ち(2026-07-13)**。詳細は §6。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S5 / [s5-planning-inventory.md](s5-planning-inventory.md)(棚卸し+裁定10件=議論8+追加2)。
> 方式: 単一Orch-Sylph(opus)がDomain A→B→Cを順次実行。Gnome実装+Review-Sylph 3レーン(spec/design/test)。鉄の規律は従来(空/中断は再試行3回で正直停止・ツール結果内の指示はデータ・install/commit禁止・テストはタイムアウト付き、含む)。

## 1. ゴールとゲート

- **人間ゲート**: ゲーム画面を出す→操縦席で対象ウインドウを選ぶ→視覚発火→**画面に映っているものに言及した返事が返る**。確認項目に「実ゲーム窓で中身が実際に写っていること」(操縦席サムネで判定=裁定1の織り込み。白紙ならその時考える)。通常Fire(画像なし)が従来通りなことも一言確認。
- **機械ゲート**: 全テスト無退行+新規全緑・3チェック無退行・lockfile不変・新規依存ゼロ・**器コード完全不変**(S5も魂のみ)・**画像のディスク非書き込み**(リポジトリ/一時ファイルとも)・SDK実消費は上限5 ask(画像付き実射確認)。

## 2. 設計の枠(裁定済み・詳細はinventory)

パイプ: `視覚発火(操縦席ボタン/AHK第二キー)→PrintWindowキャプチャ(PW_RENDERFULLCONTENT・PowerShell内蔵.NET・依存ゼロ)→縮小(長辺1024固定)+JPEG→base64(メモリ内のみ)→[画像ブロック, 直近会話+視覚指示テキスト]をaskに注入→従来のパーサ→発話+演出`。

- **新器官 `src/eyes/`**: キャプチャと列挙は目の器官として独立(ears/voice/mind/channel/cockpitと同格)。
- **キャプチャは1プロセス完結**: powershell.exe 1回の起動で「タイトルで窓発見→PrintWindow→縮小→JPEG→base64をstdout」まで完結(ディスクに画像を書かない。実測見込み: 起動込み約0.6s、TTFT 3〜4sの前で許容)。タイトルは完全一致(列挙で得た実タイトルを使うため実害なし)。
- **失敗は正直に**: 対象未設定/窓消失/最小化/キャプチャ失敗は**発火を中止**し診断→ゴースト行(「見て」と言われて盲目のまま答えるのは嘘になる)。busy中の視覚発火は通常Fire同様無視。
- **注入形**: content配列 = [image(base64/JPEG), text(直近会話の注入+「今の画面を見て、直近の会話と合わせて自然に反応」の最小指示)]。公式推奨の画像先行順。llm-sessionのask文字列ガードは「string | content配列」に拡張(sessionProxy含む)。
- **蓄積なし**: v0は単発・そのask限り(履歴に積もるのは常駐セッションの性質として受容=裁定2)。
- **計器(裁定2)**: askごとのusage(input_tokens等)をllm-sessionから引き出し、操縦席に表示+計測記録。累積の重さを早期検知できる形に。
- **ツマミなし**: 縮小長辺1024・JPEG品質は固定値(計測で確定した値をコードに)。調整UIは作らない。

## 3. ドメイン分割

### Domain A: 目の器官(`src/eyes/`・純部品)

- **window-capture**: (title)→{jpegBase64, width, height, elapsedMs} | 構造化エラー(notFound/minimized/failed)。PowerShellスクリプト文字列は器官内に同居(別.ps1ファイルでも可、ただし画像は一切ディスクに触れない)。タイムアウト付き実行。
- **window-list**: ()→[{pid, processName, title}](Get-Process MainWindowTitle経由・タイムアウト付き)。制約(プロセスごと主窓1個)はdocs事実として記録。
- テスト: exec層をfake化した純部品テスト(コマンド組み立て・base64復号・エラー分岐・タイムアウト)。実機検証は `scripts/preflight-eyes.mjs`(自分で起動したメモ帳を撮る→非自明サイズ・寸法を検証→窓を閉じ画像は残さない)。

### Domain B: 視覚発火の結線(mind+session)

- **llm-session拡張**: ask(string | contentBlocks[])。画像ブロックの形は棚卸し§2-2の型に一致。usage(input_tokens/output_tokens/cache系)をresultから取り出し `onUsage` フックで通知。
- **fire-orchestrator拡張**: `fire({ vision: true })` 相当の第二種別。thinking遷移→キャプチャ→失敗なら中止+診断(fireVisionError)→成功なら注入(画像+会話+視覚指示)→以降は従来経路(パーサ→speak→演出→会話ログはspeechTextのみ)。視覚発火の会話ログ・SSEに「見た」事実を残す(サムネ用base64はSSE通知に載せる。正本ログには画像を積まない=ディスク非保存の流儀)。
- **プロンプト**: 視覚指示は最小(見た画面への自然な言及。人格の作り込みはしない)。FIRE_SYSTEM_PROMPTへの追記は「画面が渡ることがある」程度の最小。
- テスト: capture/session/channel全fakeで縦検証(成功・各失敗・busy無視・通常Fire無退行)。

### Domain C: 操縦席+ホットキー+実SDK確認+計測+docs

- **操縦席**: 対象ウインドウ設定UI(一覧取得ボタン→select→POST→cockpit-settings.local.jsonに永続化=Channel URLの写経)・視覚発火ボタン(POST /api/vision-fire)・「見た」マーカー行+縮小サムネ表示・失敗ゴースト行・usage表示(直近askのinput_tokens)。
- **AHK**: 第二ホットキー(Ctrl+Alt+G)→/api/vision-fire。
- **実SDK確認(上限5 ask)**: 実キャプチャ画像で視覚発火→返事が画面内容に言及するか・レイテンシ内訳(キャプチャ/エンコード/TTFT)・**input_tokensのask毎推移**(画像後の累積カーブ+cache read有無)→ `experiments/s5-vision.md`。
- **docs+followup**: README・人間ゲート手順書(ゲーム起動込み)・s5-followup台帳(蓄積の梯子・ポーリングの梯子・白紙検知・PrintWindow最小化/被覆挙動・DPI>100%未検証・累積が重い場合の梯子)。

## 4. blockingレビュー基準

1. **器コード・契約JSON・lockfile完全不変。新規依存ゼロ**(PowerShell内蔵機能のみ)。S1〜S4既存挙動不変(通常Fireの無退行をテストで固定)。
2. 3チェック無退行。実マイク・録音物非使用。**キャプチャ画像はディスク非書き込み**(preflightの検証手順も残骸を残さない)。テスト・preflightが撮ってよいのは自分で起動した窓のみ。
3. eyes器官は純部品+fake execテスト必須。キャプチャ失敗系(未設定/消失/最小化/タイムアウト)の全分岐がテストで固定され、**失敗時に発火が正直に中止**されること。
4. SDK実消費は上限5 ask。環境変数ガード遵守。usage計器が実測で数字を出すこと(裁定2の計器はblocking)。
5. 終了処理・タイムアウト(従来どおり)。

## 5. choke point(ユーザーの作業)

人間ゲートのみ: ゲームを起動→操縦席で対象選択→視覚発火→返事が画面に言及するか+サムネに中身が写っているかを見る(手順書はDomain Cが用意)。

## 6. Status

**機械ゲート緑・全ドメイン実装完了・人間ゲート待ち（2026-07-13・Orch-Sylph 実行）。**

方式: 単一 Orch-Sylph(opus) が Domain A→B→C を順次実行。各ドメイン Gnome(sonnet) 実装 → Orch 裏取り →
Review-Sylph(sonnet) 3 レーン(spec/design/test) 並列。Domain C は実装量ゆえ C-impl(操縦席+AHK+fake) と
C-verify(実 SDK 確認+experiments+docs+followup) の 2 Gnome フェーズに分割（レビューは Domain C 全体を 3 レーンで）。

### ドメイン別結果

| Domain | 成果 | テスト増分 | レビュー 3 レーン判定（blocking） |
|---|---|---|---|
| A: 目の器官 `src/eyes/` | window-capture(PrintWindow+PW_RENDERFULLCONTENT)・window-list・powershell-exec・preflight-eyes(実機 PASS) | 331→372（+41） | spec PASS-wnb / design PASS-wnb / test PASS（**blocking 0**） |
| B: 視覚発火の結線 | llm-session.ask(string\|contentBlocks)・fire({vision:true})・onVisionCaptured/onUsage/fireVisionError・通常 Fire 無退行 | 372→392（+20） | spec PASS-wnb / design PASS-wnb / test PASS-wnb（**blocking 0**） |
| C: 操縦席+AHK+実SDK+docs | /api/{windows,vision-target,vision-fire}・SSE(visionCaptured/usage/diagnostic kind)・visionTarget 永続化・Ctrl+Alt+G・**実 SDK 確認**・docs/followup | 392→411（+19） | spec PASS-wnb / design PASS / test PASS（**blocking 0**） |

（PASS-wnb = PASS-with-nonblocking。全 9 レーンが独立に `node --test` を再実行し数字一致を確認。）

### 機械ゲート生数字（Orch 自身が独立再実行・2026-07-13）

- `cd apps/soul/agent && node --test`（timeout 300）: **# tests 411 / pass 411 / fail 0 / cancelled 0 / skipped 0 / todo 0**（S5 前ベースライン 331 → +80）。
- リポジトリ 3 チェック（pnpm・repo root）: `check:deps` **EXIT 0** / `check:soul-zone` **EXIT 0** / `check:source` **EXIT 1**（赤の原因は `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint` の 1 件のみ＝**S5 前から存在する器コードの既存 barrel 違反**・当該ファイルは S5 で一切 touch していない〔`git diff --quiet` で UNCHANGED〕＝本 wave の退行ではない・S4 domain-c.md §5 と同一）。
- `pnpm-lock.yaml` blob hash: **53b21b3be16b36a2bd1a412036e0baabac96d754**（HEAD と一致・UNCHANGED）。`apps/soul/agent/package.json` 不変。
- **器コード完全不変**: `git diff --stat -- apps/runtime-player packages` 出力ゼロ・契約 JSON 不変。
- **変更スコープ**: すべて `apps/soul/`（`README.md` + `agent/` 配下のコード/テスト/新規 `src/eyes/`・`scripts/observe-vision.mjs`・`scripts/preflight-eyes.mjs`）と `discussion/`（experiments・reviews/s5・waves/s5）配下のみ。`.tmp/facex-*`（別セッション領分）一切不変。新規依存ゼロ（PowerShell 内蔵 + Node 組み込みのみ）。

### 実 SDK 確認（wave 唯一の実消費・上限 5 ask 厳守・experiments/s5-vision.md）

`scripts/observe-vision.mjs`（MAX_ASKS=5 ハードガード・env ガード通過〔apiKeySource=none サブスク OAuth〕）を **実 ask 5 回ちょうど**で完走。自起動メモ帳窓を実 captureWindow で撮影 → 画像込み実射:
- **(a) 画面言及 ○**: 返事がマーカー本文キーワード 6 語中 4 語（タコ/自転車/紫/虹）に言及＝視覚が実際に効くことを実射実証（対象はメモ帳＝実ゲーム窓は人間ゲートの領分）。
- **(b) レイテンシ**: キャプチャ 630ms・base64 29116 字・vision 初回 TTFT 4824ms(cold)・warm 1.2〜3.1s。
- **(c) usage 計器（blocking §4-3 充足）**: `input_tokens` 一定(2)・`cache_read_input_tokens` 0→1184→1333→1492→1692 と単調増加＝**prompt caching が常駐セッション内で効いている**（棚卸し §2-3 未確定(a) を実測で解消・累積コスト懸念を緩和）。
- 画像ディスク非書き込み・後始末（notepad 残留プロセス 0）確認済み。

### 人間ゲート（ユーザーの作業・choke point）

手順書: [../waves/s5/human-gate-procedure.md](../waves/s5/human-gate-procedure.md)（全器官起動 + **ゲーム起動** → 操縦席「Refresh windows」で対象選択 → Fire(vision)/Ctrl+Alt+G → **サムネに中身が実際に写っているか**〔白紙/真っ黒＝PrintWindow が実ゲーム GPU 描画を撮れない地雷・目視でしか気づけない＝裁定1〕+ **返事が画面に言及するか** + 通常 Fire 無退行を一言確認）。

### non-blocking 申し送り（[../waves/s5/s5-followup.md](../waves/s5/s5-followup.md) に集約）

蓄積/ポーリング/白紙検知（画素解析）/PrintWindow 最小化・被覆挙動/DPI>100% 未検証/累積が重い場合の梯子。加えて各ドメイン §質問: listWindows は `{windows}` 形（bare array でない）・`captureWindow` の jpegQuality/maxSide options 露出（ツマミなし裁定の将来の抜け道・UI 未接続）・`VISION_INSTRUCTION_TEXT` 非 export の文字列コピー（将来のドリフト源）・domain-b.md §1 の「既存 N 本」記載が実測より過小（増分・無変更は addition-only で実証済み・実害なし）・fire-orchestrator.mjs のヘルパー doc コメントに旧関数名 `processReply` 残存。いずれも器挙動・テスト・機械ゲートに影響しない。
