# S6 Domain D レビュー — test レーン

> レビュー担当: Review-Sylph（test レーン）。対象: `discussion/ai-cohost/implementation/waves/s6/domain-d.md`
> 判定基準: `discussion/ai-cohost/implementation/orchestration/s6-wave-plan.md` §3 Domain D・§4 blocking基準。

## 判定: **PASS**

新エンドポイント・永続化・トグル・デバイス選択・タイムラインマーカーの新規テストはすべて fake 注入で
決定論的。S1〜S5 既存テストは追加のみ（隠れた改変なし）。`node --test` は 507/507 緑・ハングなし。
`observe-conversation.mjs` は機械テストに混入していない。blocking 指摘なし。non-blocking のカバレッジの
穴を 2 件、下記に列挙する。

## 1. 自分で再実行した生数字

```
$ cd apps/soul/agent && node --test 2>&1 | tail -8
# tests 507
# suites 0
# pass 507
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1224.6915
```

- 実行1回で完走。ハングなし・プロンプト正常復帰。Gnome の§8申告「507/507」と一致。

```
$ cd apps/soul/agent && node --test src/cockpit/cockpit-settings-store.test.mjs \
    src/cockpit/cockpit-server.test.mjs scripts/cockpit.test.mjs 2>&1 | tail -8
# tests 107
# pass 107
# fail 0
```

- 内訳を `grep -c '^test('` で実カウント: `cockpit-settings-store.test.mjs`=20、
  `cockpit-server.test.mjs`=60、`cockpit.test.mjs`=27（合計107）。Gnome申告の
  「12→20(+8)」「49→60(+11)」「18→27(+9)」と完全一致。

## 2. S1〜S5 無退行の確認（git diff で検証）

```
$ git diff -- apps/soul/agent/src/cockpit/cockpit-server.test.mjs \
    apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs \
    apps/soul/agent/scripts/cockpit.test.mjs | grep -E "^-[^-]"

-import { parseCockpitArgs, createLazyChannel, createSessionProxy, createVisionTargetHooks } from "./cockpit.mjs";
```

- 削除/改変行はこの1行のみ。内容は import 文に `createAudioDeviceHooks`/`createSelfFireHooks` を
  追加するための書き換えで、既存テストの期待値・アサーションには一切触れていない。
- `git diff --stat` も Gnome §1/§8 の申告と一致（`cockpit-settings-store.test.mjs` +142、
  `cockpit-server.test.mjs` +346、`cockpit.test.mjs` +109 -1）。
- 既存の手動Fire・視覚発火（S5 vision）・barge-in（S2.5/S3系）・自発発火 Domain C のテスト本文を
  目視確認 — 期待値の書き換えは見当たらない（既存の `selfFire`/`fire` テスト群 line 1215-1329 も
  Domain C 由来のまま無変更）。

**結論: 追加のみ。隠れた退行の証跡なし。**

## 3. 新機能テストの逐条確認（全 fake・決定論）

| 機能 | テスト内容 | fake 化の確認 |
|---|---|---|
| audio device 永続化 | roundtrip・他キー（device/channel/vision）との同居・corrupt JSON・非文字列 shape・unwritable path | `mkdtempSync` + OS temp path 注入。実 `cockpit-settings.local.json` 非汚染 |
| self-fire enabled 永続化 | roundtrip（bool）・同居・corrupt/非bool JSON（`"true"`文字列は bool でない→null）・unwritable path | 同上。`asStringOrNull` ではなく bool 専用判別関数で「未記憶(null)」と「明示false」を区別する点をテストで固定済み |
| `GET /api/audio-devices` | 成功（`.devices`）・失敗（`.error`→`devices:[]`）・未注入時のデフォルト実装への型のみ確認 | `listAudioDevicesImpl` を必ず注入。既定実装（実 PowerShell）は**呼び出さない**ことをコメントで明記し、実行される経路も型確認のみ |
| `POST /api/audio-device` | 未注入503・trim+橋渡し・空白文字列でクリア（null） | `onSetAudioDevice`/`audioDeviceStatus` を fake 関数で注入 |
| `POST /api/self-fire` | 未生成503・切替+state反映+`selfFireStatus()`・`onSetSelfFireEnabled`永続化フックへの橋渡し（複数回） | `makeFakeOrchestrator` で `fireScheduler` を模擬 |
| SSE `selfFire`（fired:true/false） | kind/fired/reason の値を確認 | `fakePipe`/`fakeOrch` 双方 fake。`openSseClient` は既存 S3〜S5 と共通のテストヘルパー（実ネットワークだが同一プロセス内の loopback） |
| SSE `bargeIn` 診断フィールド | `elapsedMs`/`charsSpoken`/`totalChars`/`prefix` が additive で載ることを確認 | `makeFakeOrchestrator({ drive })` が `hooks.onDiagnostic(...)` を直接呼ぶだけ。実 barge-in 経路は未経由（Domain B の縦串テストが別途担当） |
| `createAudioDeviceHooks`（cockpit.mjs） | getter透過・setter橋渡し・status形状・throw握り | fake settings（`getAudioDevice`/`setAudioDevice`のみ持つ最小オブジェクト） |
| `createSelfFireHooks`（cockpit.mjs） | 未記憶フォールバック・defaultEnabled指定・記憶優先・永続化橋渡し・throw握り | fake settings 同上 |

実 SDK・実マイク・実 PowerShell への依存は見当たらない。`GET /api/audio-devices` の既定実装
（Domain A `listAudioDevices` = 実 PowerShell 起動）に触れるテストは1本のみだが、これは
「未注入でも construct が throw しない」ことの型確認であり、`server.listen()`/実際の HTTP 呼び出しは
行っていない（実行しない設計が明示的にコメントされ、コードもそれに従っている）。

## 4. observe-conversation.mjs の分離確認

- ファイル名は `.mjs`（`.test.mjs` ではない）。`apps/soul/agent/package.json` の `"test": "node --test"`
  は Node 標準の test-file 検出規則（`*.test.{js,mjs,cjs}` 等）に従うため、`observe-conversation.mjs`
  は `node --test` の対象に含まれない（実測507本の内訳ともファイル名一致せず、実行時間1.2秒という
  短さからも実 SDK ask が紛れ込んでいないことは明らか）。
- 本レビューでは `observe-conversation.mjs` を実行していない（委任指示どおり）。冒頭コメントで
  「実 SDK を最小回数だけ叩く」「fire-orchestrator/fire-scheduler は実物・player/channel/speak は
  fake・session だけ実 SDK」と明記されており、機械テストとして書かれたものではないことは記述からも
  読み取れる。

## 5. カバレッジの穴（non-blocking）

1. **デバイス変更の「その場再起動」（player dispose）が単体テスト対象外**:
   `scripts/cockpit.mjs` の実際の `onSetAudioDevice`（150行目台、`main()` 内クロージャ・
   `player.dispose(); player = null;` を行う実体）は `main()` の内部にあり export されていない。
   テストされているのは `createAudioDeviceHooks`（settings ⇄ hooks の橋渡しのみ）で、
   「既存 player を dispose して次回 `ensureFireResources()` で再生成させる」という設計判断
   （domain-d.md §3・§7質問1）の核心部分は unit test で固定されていない。
   ただし `main()` はこのコードベースで一貫して unit test 対象外（`ensureFireResources` 自体も
   S2.5〜S5 を通じて未テスト）という既存パターンに沿っており、Domain D 固有の後退ではない。
2. **cockpit.html のマーカー行描画（`addBargeInMarkerRow`/`addSelfFireMarkerRow`/ゴースト行）が
   フロントエンド JS として無テスト**: `cockpit.html` を参照するテストファイルは存在しない
   （S1〜S5 でも同様にフロントエンドは無テスト・人間ゲートでの目視確認に委ねる既存の運用）。
   `fired:false` ゴースト行・`bargeInStopError`等の型別描画分岐がコード上どう描かれるかは
   このレーンの検証範囲外だが、抜けとして明記しておく。

いずれも「軽微な穴」の範疇（既存の設計パターン・許容されたテスト境界の踏襲）であり、blocking 基準
（新機能に決定論テストが皆無・実SDK/実マイク混入・隠れた退行・ハング）には該当しない。

## 6. blocking / non-blocking まとめ

- **blocking: なし。**
- **non-blocking**: §5 の2件（player dispose の main() 内ロジック・cockpit.html マーカー行描画は
  unit test 範囲外）。followup 台帳への記載を推奨するが、S6 Domain D の機械ゲート合格を妨げない。

## §質問（Orch への申し送り）

- 質問なし。判断に迷う点はなし（domain-d.md §7 の設計判断5件は test レーンの管轄外——spec/design
  レーンの判定に委ねる）。
