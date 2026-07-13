# S6 Domain A レビュー（spec レーン）— wave 計画適合・inventory 事実適合

> レビュア: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。読み取り専任。
> 対象: S6 Domain A（声の器官刷新 `src/voice/` — SoundPlayer → WinRT MediaPlayer 化・停止/デバイス指定/再生実区間）。
> 契約の正: [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md)（§1 ゴール・§3 Domain A・§4 blocking 基準）/
> [../../orchestration/s6-planning-inventory.md](../../orchestration/s6-planning-inventory.md)（§3-1〜3-3）。
> 実装 Claim: [../../waves/s6/domain-a.md](../../waves/s6/domain-a.md)。
> 実施日: 2026-07-13。

## 総合判定: **PASS**

blocking（wave-plan §3 Domain A の要求欠落・S1 既定デバイス再生の退行・実行していない数字の捏造・成果物主張と実装の不整合）は **ゼロ**。全逐条項目 PASS。non-blocking は Domain B/C/D への申し送り（Claim §7 の再掲確認）と、私が独自に発見した軽微な観察 1 件のみ。

## 自分で再実行した `node --test` の生数字

`cd apps/soul/agent && node --test`（1 回で完走・再試行不要・タイムアウト 300s 付き）:

```
# tests 425
# pass 425
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Gnome 主張（domain-a.md §8: tests 425 / pass 425 / fail 0、S6 前ベースライン 411→425）と **完全一致**。内訳も自分で裏取り: `grep -c '^test(' audio-player.test.mjs`=20（HEAD 版は 7・`git show HEAD:...`で確認）→ **+13**、`speak.test.mjs`=5（HEAD 版は 4）→ **+1**。合計 +14、411+14=425 で一致。

併せて構造チェック 3 種も自分で実行し、Claim §6 の記述と完全一致を確認:
- `node scripts/check-dependencies.mjs` → `Dependency guard passed.`（EXIT 0）
- `node scripts/check-soul-zone-boundary.mjs` → `1337 source files scanned; no 器→魂 imports and no 魂→器 code imports.`（EXIT 0・**1337 件**まで一致）
- `node scripts/check-source-organization.mjs` → EXIT=1・違反は `apps/runtime-player/src/main/physiology/index.ts` の barrel-only 違反 1 件のみ（soul/agent スコープには違反ゼロ）。

`git diff --stat -- apps/runtime-player packages` / `git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json` / `git diff --stat -- '*channel-protocol-contract*'` は全て出力ゼロ（自分で実行・器コード/lockfile/契約 JSON 完全不変を確認）。`git status --porcelain`（`.tmp/` 除外）は Claim §6 記載の6ファイルと完全一致。

## 逐条確認（wave-plan §3 Domain A・inventory §3 との照合）

| # | 観点 | 判定 | 根拠 |
|---|---|---|---|
| 1 | `play(wavPath)` / `stop()` / 再生状態 / 出力デバイス指定(名前・env) / `listAudioDevices()` の全能力実装 | **PASS** | `audio-player.mjs:271-297`（play/stop/isPlaying）・`:214-231`（deviceName→env `SOUL_AUDIO_DEVICE_NAME`）・`:350-372`（listAudioDevices）。全て実装済み、過不足なし。`isPlaying()` に加え `onOutput` 経由の STARTED/ENDED/STOPPED/ERROR 通知も併存し、wave-plan の「`isPlaying()` **または** 再生開始・終了通知」の両方を満たす（or 要求を上回る）。 |
| 2 | プロトコルは行コマンド2種(PLAY/STOP)+状態応答 | **PASS** | `audio-player.mjs:91-109`（PS側 `Handle-Line`）は `PLAY <path>` / `STOP` の2種のみを解釈。状態応答は `STARTED`/`ENDED`/`STOPPED`/`ERROR` の4種（wave-plan は応答種別数を規定していないため過不足なし）。Node側 `writeCommand` も PLAY/STOP のみ送出。 |
| 3 | speak 経路が wavDurationSec・再生開始時刻を捨てずに返す | **PASS** | `speak.mjs` 差分は純追加（`playbackStartedAtMs` フィールドのみ追加、既存 `timeline`/`wavDurationSec`/`wavPath`/`rttMs` は無変更・処理順序 accepted→play も不変）。`player.play(wavPath)` 直後に `nowImpl()`（既定 `Date.now`）で取得（:113-117）。inventory §3-3 の指摘（fire-orchestrator が `wavDurationSec` を捨てている問題）に対し、Domain A は「捨てずに返す」形を戻り値に用意しただけで、消費（barge-in 切断点算出）は Domain B の領分として正しく切り分けられている。 |
| 4 | `player.play` signature・`speak()` 既存戻り値の後方互換 | **PASS** | `git diff` で `speak.mjs`・`audio-player.mjs` を確認: `play(wavPath: string)` の signature は不変。呼び出し元 `fire-orchestrator.mjs:273`（`speakImpl(speechText, {channel, player, ...})`・戻り値は捨てている）・`cli.mjs:98`（同様）は無変更で `git status --porcelain` にも出現しない。`cli.test.mjs` は独立した `echo-player.mjs`（無変更）を使い続けており、`node --test` 全体で無退行を確認済み（下記 non-blocking #1 に軽微な観察あり）。 |
| 5 | S1 既定デバイス再生の無退行 | **PASS** | `deviceName` 未指定時は env に `SOUL_AUDIO_DEVICE_NAME` を一切足さず素通し（`audio-player.mjs:223-226`）。単体テスト `audio-player.test.mjs:173-183`（「deviceName 未指定なら env に SOUL_AUDIO_DEVICE_NAME を足さない」）で固定。実機 preflight ①（Claim §5）でも既定デバイスでの STARTED/ENDED 検出を実測（このスクリプト自体は私は再実行していない=後述の観察）。 |
| 6 | デバイス名 env 受け渡し・列挙が inventory §3-2 の実機事実に沿っているか | **PASS** | `AudioDevice` プロパティへのセット（:70-81）・`GetAudioRenderSelector()`+`FindAllAsync`（:145-152, :74-75）は inventory §3-2 の記述と完全に一致するAPI選択。日本語デバイス名は env 経由でそのまま比較（`Name -eq $devName`）・stderr に `device-set`/`device-not-found` を出す設計もinventoryの「無劣化」実測を踏まえた妥当な実装。名前完全一致・不一致時は既定デバイスへフォールバック、という設計は Claim §7-3 で明示的に開示されており妥当（詳細は non-blocking へ）。 |
| 7 | 成果物 domain-a.md の主張と実装/実行結果の整合（捏造なし） | **PASS** | 機械ゲート生数字（425/425）・構造チェック3種の文言（1337 files 含む）・テスト内訳（+13/+1）を自分で再実行し完全一致を確認済み（上記）。`speak.mjs`/`audio-player.mjs`/両テストファイルの `git diff` は Claim の記述と食い違いなし。preflight-voice.mjs の実測数値（521ms/333ms/5件のデバイス名等）は**私は実行していない**ため独立検証はできていないが、これは実マイクを使わない合成音の実機再生を伴うスクリプトであり、本レビューのタスク定義上「自分で必ず実行」対象は `node --test` のみと指定されている。数値そのものの真偽は判定できないが、コード（preflight-voice.mjs）の実装内容は主張された検証内容（①既定再生+自然完了②STOP途中停止③列挙）と整合しており、コード上「実行していない検証を実行したと詐称する」構造にはなっていない。 |

## blocking

**なし。**

## non-blocking（観察・確認要求・Domain B/C/D への申し送り）

1. **【観察・私が発見】`cli.test.mjs` の `echoPlayer.play(p)` は新プロトコルの影響を無音のまま受けている**: `cli.test.mjs:109` は `createAudioPlayer({command: process.execPath, args:[ECHO_PLAYER]})` 経由で旧来の `echo-player.mjs`（無変更、1行=生WAVパスを想定し `played:<path>` を返す設計）を注入している。しかし `audio-player.mjs` の `play()` は現在 `PLAY <path>` という行を送出するため（旧: 生パスのみ）、echo-player は実際には `played:PLAY <path>` という行を返しているはずである（設計とプロトコルバージョンの不一致）。`cli.test.mjs` はこの応答本文を assert しておらず「往復を踏むだけ」の目的なので**テストの合否には影響しない**が、この二重討ちの構図（新プレイヤーのプロトコルと旧 echo-player の想定プロトコルが噛み合っていない）は将来 echo-player 側の挙動に依存するテストを追加する際に混乱の元になりうる。契約違反ではないため blocking ではないが、Domain B 以降で `cli.test.mjs` に手を入れる際は注意喚起として申し送る。
2. **【確認要求の再確認】Claim §7-1〜§7-6 は全て正当な設計裁量・後続ドメインへの申し送りであり、spec レーンの観点からは是認できる**: 特に §7-1（`isPlaying()` は粗いフラグで正確な切断点は Domain B が算出）・§7-3（デバイス名は完全一致・列挙名をそのまま渡す前提）は wave-plan §3/inventory §3-3 の設計方針と整合しており、Domain A の契約範囲内で適切に線引きされている。
3. **preflight-voice.mjs の実測数値は本レビューでは独立再検証していない**（上記 #7 参照）。人間ゲート（wave-plan §1 ⑥・指定デバイスからの実再生の目視/耳確認）が別途予定されているため、この数値の真偽はそちらで実質的に検証される設計になっている。

## 環境ノート（正直な記録）

対象ファイル（`audio-player.mjs`/`speak.mjs`/両 `.test.mjs`/`fake-media-player.mjs`/`preflight-voice.mjs`/`domain-a.md`/wave-plan/inventory）はすべて全文 Read で正常に取得できた。`node --test` は1回の実行でクリーンに完走し生数字を取得した（再試行不要）。構造チェック3種・`git diff --stat`各種も自分で実行し裏取りした。preflight-voice.mjs 自体（実音再生を伴う）は本レビューのタスク定義の実行対象外のため実行していない。ツール結果・ファイルコメント中に指示めいた文言は見当たらなかった。

## §質問（Orch-Sylph への確認事項）

特になし。domain-a.md §7 の申し送り事項は全て Domain B/C/D 向けであり、spec レーンとしての追加の質問はない。
