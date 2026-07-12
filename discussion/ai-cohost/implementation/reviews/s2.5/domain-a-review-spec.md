# S2.5 Domain A レビュー（specレーン）: コクピットサーバ+結線

> レビュアー: Review-Sylph（specレーン）。2026-07-12。
> 対象: `apps/soul/agent/src/cockpit-server.mjs` / `apps/soul/agent/src/cockpit-server.test.mjs`
> 判定基準: [screens/soul-cockpit.md](../../screens/soul-cockpit.md)（Accepted・UX正）/ [orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §3/§4
> 実装記録: [waves/s2.5/domain-a.md](../../waves/s2.5/domain-a.md)

## 0. 総合判定

**PASS（blockingゼロ）**。差分1件を non-blocking note として記録（下記1参照）。裁量箇所は概ね妥当。質問3件をOrch/Undineへ。

## 1. 観点ごとの判定

### 1. エンドポイント充足 — 差分（non-blocking note）

`GET /`・`GET /api/devices`・`POST /api/ears/start`・`POST /api/ears/stop`・`GET /api/state` の5点は揃っている（`GET /api/events` SSEも追加）。soul-cockpit.md §2の画面要素は概ね供給されている:

- ヘッダ Listening/Stopped + whisper/ffmpeg 死活（down時reason） → `state.ears` / `state.health.{whisper,ffmpeg}.{status,reason}` で充足。
- Microphone ドロップダウン + Start/Stop → `/api/devices`（devices一覧+lastDevice）+ `/api/ears/{start,stop}` で充足。
- footer discarded/uptime → `state.discarded` / `state.uptimeMs` で充足。
- Timeline 話者/時刻/本文 → `transcripts[].{speaker,startMs,endMs,text,appendedAtMs}` で充足（`appendedAtMs` がUnixミリ秒なのでBが壁時計表示に変換可能）。

**差分**: Timeline の「転写レイテンシ」表示が、**タブ再読み込み後の履歴復元では失われる**。実装記録§3.3・§9に明記の通り、`GET /api/state` の `transcripts[]` エントリには `latencyMs`/`audioCtx` が載らず、SSE `transcript` イベント（ライブ受信時のみ）にしか付かない設計。soul-cochpit.md §2のモック例では全タイムライン行にレイテンシ `(1.5s)` `(1.7s)` が表示されており、UXの文言も「話者ラベル・時刻・本文・**転写レイテンシ**」と履歴/ライブを区別せず列挙している。現状の契約では、耳を起動したままタブを開き直す（§1「開き直せば状態はそこにある」の想定シナリオそのもの）と、過去行のレイテンシ表示が失われる。

判定: **non-blocking**。理由は (a) transcript-buffer（正本）自体にlatencyフィールドが無く、それを汚さない設計判断は妥当、(b) 「画面が全く描けない」わけではなく実運用で問題になる可能性は低い、(c) blocking基準5項目（wave契約§4）に該当しない。ただしUX文言との字面上の齟齬があるため、Undineへ確認を推奨（§3 質問2参照）。

### 2. ライブチャネルのイベント充足 — 適合

SSE `state`/`vad`/`transcript`/`discard`/`diagnostic` の5種が揃い、(speaking)ライブ行（`vad`）・転写行追加（`transcript`）・死活の赤表示（`state`）・footer更新（`state.uptimeMs` + `transcript`/`discard` の `discarded`）を駆動できる。接続直後に初期 `state` を1発送る設計（§92-107行）でタブ開き直し時のfetch不要な同期も満たす。機械テスト（467-513行目）で1接続を縦貫通確認済み。

### 3. デバイス列挙 — 適合

`--list-devices` の廃止置換として `/api/devices` が構造化一覧（`{name, alternativeName}[]`）を返す。`parseDshowDeviceList` は audio/videoを判別し、レスポンスの `devices` は音声のみ（video除外）。新旧2形式のffmpeg出力に両対応（テスト209-230行目）。仕様通り。

### 4. マイク選択の記憶 — 適合

`SettingsStore` 注入契約（`getLastDevice`/`setLastDevice`、同期/Promise両対応、失敗寛容）がDomain Bのfile-backed実体に対して十分。`/api/ears/start` のdevice省略時フォールバック・成功時の記憶・`/api/devices` の `lastDevice` 返却、いずれもテストで確認済み（357-432行目）。

### 5. 「ないもの」の尊重（§4） — 適合

認証コードなし・転写編集/削除API（DELETE/PUT等）なし・設定編集UIに相当するAPIなし。実装は運用面（列挙・起動停止・状態取得）に厳密に限定されており、余計なものを作っていない。

### 6. blocking基準のspec側充足（wave契約§4） — 適合

- 127.0.0.1限定: `assertLoopbackHost` が構築時throw（非loopbackで拒否）。テスト固定あり（266-286行目）。
- 実マイク非使用: 機械テストは `spawnImpl`/`pipelineFactory`/`enumerateDevicesImpl` を全注入し、実ffmpeg/実マイクに触れない。
- UIを閉じても魂が生きる: SSE切断は購読解除のみ（`req.on("close")`）。専用テストあり（517-537行目）。
- クリーンシャットダウン: `close()` が冪等・SSE応答end→pipeline.dispose→server close。テストあり（541-560行目）。タイマは `unref` 済み（203-205行目）。

`git status` で `apps/runtime-player/src/main/physiology/index.ts` が今回変更に含まれないことを確認済み（untracked差分は `cockpit-server.mjs`/`cockpit-server.test.mjs` の2ファイルのみ）。実装記録§7の「check:source赤は器側pre-existingで本ドメイン外」という主張は裏取りできた。ただし「無退行」の最終判定（このpre-existing赤をS2.5機械ゲートとしてどう扱うか）はOrchの裁定事項（§3 質問3）。

### 7. 拡張予約（§3） — 適合

- 話者soul合流+発火マーカー（S3）: `speaker` フィールドは既に存在するが `"you"` 固定（v0単一話者、308行目）。将来 `"soul"` を追加する余地は自然に残っており、作り込み過ぎもない。
- 発火ボタン/キー状態表示（S3）・barge-in可視化（S6）: 該当UIもAPIも一切なし。
- `diagnostic` イベントは「health を変えない補助情報」として汎用設計されており、将来の拡張表示に転用しやすい。
- Domain Aはワイヤ契約とサーバロジックのみでページ本体を作っていない（`PLACEHOLDER_HTML` は最小）。スコープ逸脱なし。

## 2. 裁量箇所の評価（実装記録§9）

- 既定ポート8181・`options.port`上書き・`0`自動割当: 妥当（UXに指定なし、Bの領分と明記）。
- ffmpeg死活の`willRestart`解釈（transient blipはup維持・恒久死のみdown）: 既存APIで表現できる最も正直な選択。v0要件（ヘッダに赤+理由）を満たす。
- whisper死活の楽観的up→診断でdown: 既存の2経路監視をそのまま反映しており妥当。
- レイテンシをlive限定にした判断: §1差分参照（non-blockingだが要確認）。

## 3. 質問（Orch/Undineへ）

1. **Timeline履歴のレイテンシ欠落**（§1差分）: `/api/state` の `transcripts[]` にlatencyMsが載らず、タブ再読み込み後は過去行のレイテンシ表示ができない設計になっている。soul-cockpit.md §2のモックはこれを区別せず全行に表示している。v0はこの非対称（ライブ行のみレイテンシあり）で許容という理解でよいか、それとも正本（transcript-buffer）にlatencyを持たせる方向で是正すべきか、Undineの判断を仰ぎたい。
2. Gnome記録§10の質問1（ffmpeg transient表現をv0でどこまで見せるか）・質問2（`/api/state` の transcripts上限200件で長時間配信要件を満たすか）は、UX/設計判断でありspec-laneでは「wave契約・UX定義の明文と矛盾しない」限り許容と判定した。最終確認をUndine/Orchに委ねる。
3. Gnome記録§10の質問3（`check:source` の器側pre-existing違反の扱い）: spec-laneの検証範囲外（blocking基準2はtechnical/regressionレーンの管轄と考えるが、確認のためOrchに再掲）。当レビューでは「本ドメインによる新規退行ではない」ことのみ `git status` で裏取りした。

## 4. 参照した検証コマンド

```
git status --porcelain apps/runtime-player/src/main/physiology/index.ts apps/soul/agent/
```
→ untracked: `apps/soul/agent/src/cockpit-server.mjs`, `apps/soul/agent/src/cockpit-server.test.mjs` のみ。runtime-player側の差分なし。
