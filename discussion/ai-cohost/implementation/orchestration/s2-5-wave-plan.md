# S2.5 wave計画: 操縦席がある(魂のローカルWebコクピット)

> Status: **完全閉鎖(2026-07-12)**。両ドメイン+追撃domain-f、レビュー全PASS、機械ゲート231/231緑、人間ゲート合格(「完璧だ」・長尺再ゲート込み)。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S2.5(追補) / [../screens/soul-cockpit.md](../screens/soul-cockpit.md)(**Accepted、実装のsource of truth**)。棚卸しなし(context-check判定=Plan directly: 部品は全部S2実装済み・外部未知ゼロ・新規依存ゼロ)。
> 方式: 単一Orch-Sylph(opus)がDomain A→Bを順次実行。各ドメインはGnome実装+Review-Sylph 3レーン。S1/S2と同一の鉄の規律。

## 1. ゴールとゲート

- **人間ゲート(一目)**: ブラウザで操縦席を開き、マイクを選んで耳を起動し、喋ると転写がタイムラインに積もるのが見える。**CLIを一切触らない**。
- **機械ゲート**: cockpitサーバ(HTTP/ライブ更新/制御API)のテスト全緑+既存全テスト(196件)無退行+3チェック無退行+lockfile不変+新規npm依存ゼロ。

## 2. 設計の枠(UX定義§1の写し+実装制約)

- 127.0.0.1バインドのみ・認証なし(v0)・単一ファイル配信のvanilla HTML/CSS/JS・ビルドチェーン非導入・**新規npm依存ゼロ**。
- 正本はプロセス側: コクピットは既存API(ear-pipeline・transcript-buffer・デバイス列挙・死活監視)の**ビュー**。魂のロジックへの変更は結線点の追加のみ(S2挙動不変)。
- ライブ更新の伝送(WS自前 or SSE)は**Gnomeの設計事項**。ただし既知事項: undici WSクライアント×自作WSサーバの相性問題(S2記録)——機械テストのクライアントはundici禁止、S2の最小WSクライアント(node:net)を使う。SSE採用ならこの問題自体が消える。
- マイク選択の記憶: 魂ローカルの設定ファイル(`apps/soul/agent/` 内・gitignore対象)。

## 3. ドメイン分割

### Domain A: cockpitサーバ+魂の結線

- HTTPサーバ(静的1ページ配信+制御API: デバイス列挙/耳start/stop/状態取得)+ライブ更新チャネル(転写append・discard・VADイベント・死活変化のpush)。
- 耳パイプラインとの結線(起動停止のライフサイクル・2経路監視の状態反映)。クリーンシャットダウン(S1/S2教訓: ハンドル解放・タイマref規律)。
- テスト: HTTP/制御API/ライブ更新の機械テスト(実マイク不使用・fake-ffmpeg/合成PCM流用)。
- 成果物: waves/s2.5/domain-a.md、レビュー reviews/s2.5/domain-a-review.md。

### Domain B: ページ本体+仕上げ

- UX定義§2の画面(ヘッダ状態・Microphoneドロップダウン+Start/Stop・Timeline((speaking)ライブ行・時刻/話者/本文/レイテンシ)・footer)。拡張予約(§3)を意識したDOM構造(ただし作り込まない)。
- デバイス選択の永続化・起動コマンド(URL表示)・preflight(HTTPで開けて状態が返る)。
- docs(README・人間ゲート手順書)+followup記録。
- 成果物: waves/s2.5/domain-b.md、レビュー reviews/s2.5/domain-b-review.md。

## 4. blockingレビュー基準

1. pnpm-lock.yaml・器コード・C4契約fixture・S1/S2実装の既存挙動、全て不変(196テスト無退行)。**新規npm依存ゼロ**。
2. check:soul-zone / check:deps / check:source 無退行。
3. バインドが127.0.0.1限定であることのテスト固定(外部露出の構造的防止)。
4. 実マイク音声・録音データの非使用/非保存(S2と同一)。
5. 子プロセス・サーバの終了処理明示(ハング教訓)。UI(ブラウザ)を閉じても魂が生き続けることのテスト。

## 5. choke point(ユーザーの作業)

人間ゲートのみ: ブラウザで操縦席を開いてマイクを選び、喋る(手順書はDomain Bが用意)。install・配置なし。

## 6. Status

- **機械ゲート完了・両ドメインPASS（2026-07-12, Orch-Sylph）。人間ゲート待ち。**
- Domain A（cockpitサーバ+結線）: PASS。SSE採用（undici回避）。`cockpit-server.mjs`/`.test.mjs` 新規。3レーンレビュー全PASS → [../reviews/s2.5/domain-a-review.md](../reviews/s2.5/domain-a-review.md)。実装記録 [../waves/s2.5/domain-a.md](../waves/s2.5/domain-a.md)。
- Domain B（ページ本体+永続化+起動+preflight+docs）: PASS。`cockpit.html`/`cockpit-page.mjs`/`cockpit-settings-store.mjs`/`scripts/cockpit.mjs`/`scripts/preflight-cockpit.mjs` 新規。3レーンレビュー全PASS → [../reviews/s2.5/domain-b-review.md](../reviews/s2.5/domain-b-review.md)。実装記録 [../waves/s2.5/domain-b.md](../waves/s2.5/domain-b.md)。
- 機械ゲート（Orch独立実測）: 魂全テスト **226/226 緑**（S1/S2の196無退行 + A21 + B9）。`preflight-cockpit` PASS（exit0・ハングなし）。`check:soul-zone`/`check:deps` 緑。`check:source` は器 `runtime-player/physiology/index.ts` の pre-existing 違反のみ（S2.5無関係・新規違反ゼロ＝無退行）。lockfile差分ゼロ・新規npm依存ゼロ。127.0.0.1限定バインドをテスト固定。
- 人間ゲート手順書: [../waves/s2.5/human-gate-procedure.md](../waves/s2.5/human-gate-procedure.md)。起動 `npm run cockpit --prefix apps/soul/agent` → `http://127.0.0.1:8181/`。
- followup: [../waves/s2.5/s2-5-followup.md](../waves/s2.5/s2-5-followup.md)。
- **Undineへエスカレーション**: (a) `check:source` の器側 pre-existing 違反は器コード変更禁止のため本wave非対応（wave締めのユーザー報告に扱いを乗せる→器の別件チップとして周知済み）。(b) 履歴レイテンシ非対称（正本を汚さないv0非対称の許容可否）はUX裁定として申し送り→**Undine裁定でv0許容**(UX定義§2に注記)。
- 2026-07-12: **追撃 domain-f(長尺転写消失対策)**: 人間ゲート中の観測(3.2秒超の発話が丸ごと消える/「,」ゴミ行)→診断→修正。`-nfa`(flash-attn OFF)をwhisper-server起動既定に(無害実証: 品質同等・+約200ms)+コクピットにdiscard/asrFailureの**ゴースト行**(無言の消失の廃止)+恒久診断記録([../waves/s2.5/long-utterance-diagnosis.md](../waves/s2.5/long-utterance-diagnosis.md))。**flash-attn犯人説は追撃プローブ(実Silero VADトリム・7回)で非再現=機構未確定と正直に記録**。231/231緑・レビュー合格([../reviews/s2.5/domain-f-review.md](../reviews/s2.5/domain-f-review.md))。教訓: 計測音源は本番経路と同形で作る。
- 2026-07-12: **人間ゲート合格(ユーザー実施)→ S2.5 完全閉鎖**。判定「完璧だ」——CLIレスで操縦席から耳を運転、転写が積もり、**長めの発話でも違和感なし**(domain-f後の再ゲートで長尺消失は非再発)。再発時はfollowup台帳の集中wave(実マイク経路の再現+崩壊判定強化)を起こす条件を残置。
