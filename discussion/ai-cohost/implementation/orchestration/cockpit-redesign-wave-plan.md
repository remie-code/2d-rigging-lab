# 操縦席UI改定 wave計画: コントロールルーム化(preact+htm)

> Status: **計画確定(2026-07-14)・発進待ち**。
> 根拠: UX正 [../screens/cockpit-redesign.md](../screens/cockpit-redesign.md)(三層IA+視覚仕様§7・モック承認済み) / 棚卸し [cockpit-redesign-inventory.md](cockpit-redesign-inventory.md)(preact+htm standalone・保存オラクル・L0決定)。
> 位置づけ: S8前の独立閉問題(能力waveでなく**振る舞い保存のリファクタ+IA再設計+外観刷新**)。器コード・魂の他部位・契約・実行時依存・lockfileは不変。
> 方式: 単一Orch-Sylph(opus)がDomain A→B→C→Dを順次実行。Gnome実装+Review-Sylph 3レーン(spec/design/test)。鉄の規律は従来。

## 1. ゴールとゲート

- **人間ゲート**: 操縦席を起動→**モック([../screens/cockpit-redesign.md](../screens/cockpit-redesign.md)§7)の見た目で立ち上がる**+**現操縦席の全機能が動く**(保存チェックリスト§2を1個ずつ)+三層IA(観測が主役・設定は畳まれ⚙で開く・運転バー常駐)+二回目以降は観測に直行。S1〜S7の実挙動(発火・会話・視覚・barge-in・チャット)が操縦席越しに従来通り。
- **機械ゲート**: **server test(ワイヤ契約=16エンドポイント×13 SSE×6設定キー)が全緑=無退行の一次証明**+新規純関数(view-logic)のfixture全緑+全テスト無退行+3チェック無退行(sourceの器側既存赤1件はベースライン)+lockfile不変+**新規npm依存ゼロ**(preact+htmはブラウザ配信のvendorでpackage.json不変)+器コード完全不変+ビルド段ゼロ(`npm run cockpit` 一発起動)。

## 2. 設計の枠(裁定済み・詳細はinventory)

- **vendor**: `htm/preact/standalone.mjs`(preact 10.29.7+htm 3.1.1・1ファイル・gz5.3KB・import map不要・hooks込み)を `src/cockpit/vendor/` にコミット。編集しない凍結ファイル。実行時npm依存を増やさない(ブラウザが読むだけ)。
- **配信**: cockpit-server に操縦席UI `.mjs` ツリーを配る静的ルート追加(トラバーサル防止・`content-type: text/javascript`・ルート配下限定)。エントリはcockpit.html内inline module(`<script type="module">import from "./ui/app.mjs"</script>`・src属性は使わない)。
- **構造**: うちらのコードはIA区画ごとに分割(`ui/header.mjs`・`ui/feed.mjs`・`ui/control-bar.mjs`・`ui/settings-drawer.mjs`・`ui/app.mjs`エントリ)。表示ロジック(SSE→表示文字列・状態導出)は**preact非依存の純関数** `view-logic/*.mjs` に括り出しnode:testで検証。standaloneバンドルされるのはサードパーティのみ・うちらの部品は積層させず構造化。
- **無退行の背骨**: server test(ワイヤ契約)は不変オラクル。UI描画は人間ゲート。旧page test(HTML文字列regex・`<script src>`全面禁止:72・CDN禁止)は旧思想の産物として書き換え(自己完結強制は「外部ネットワーク非依存」の本旨=ローカルvendorは適合、に読み替えたテストへ)。
- **テスト**: 純関数化+**devDepゼロ維持**(linkedomは描画退行が頻発したら初導入する梯子)。
- **視覚仕様**: cockpit-redesign.md §7(モック承認済み)。CSSカスタムプロパティで手書き・フレームワークなし・ダーク基調・teal基調の話者色分け。
- **S2.5単一HTML思想は操縦席については引退**。継承する本当の制約=ビルドなし・ソース=実行物・新規npm依存ゼロ。

## 3. ドメイン分割

### Domain A: 土台(vendor配置+静的配信+エントリ+純関数化の口)

- vendor: `src/cockpit/vendor/htm.preact.standalone.mjs` を取得・配置(実ファイルをコミット)。**取得は棚卸し実測のunpkg/npm tarball由来のstandaloneファイル**。SRI/バージョンをdocsに記録。
- cockpit-server: UI `.mjs` ツリー静的配信ルート(トラバーサル防止・許可拡張子固定・ルート配下限定)。既存 `serveIndex` と同型のヘルパで。**ワイヤ契約(既存16エンドポイント×13 SSE)は一切変えない**——追加ルートのみ。
- **view-logic純関数の抽出**: 現cockpit.htmlの「SSEデータ→表示文字列」変換(fired N lines・saw title WxH・barge-in X/Y字・latency・uptime整形・redactトークン等)をpreact非依存の `view-logic/*.mjs` へ。各々fixtureでnode:test。**これが保存オラクルの表示側の固定点**。
- テスト: 静的ルートのユニット(traversal防止・MIME・404)+view-logic純関数fixture+server testの無退行(既存が緑のまま)。

### Domain B: 観測+ヘッダ(主役の移植)

- preactコンポーネント: header(状態ランプ・健康・⚙)・feed(全行種: 転写you/soul/viewer・speaking行・ゴースト行9種+意図的非表示リスト遵守・発火マーカー・演出行・視覚マーカー+サムネ・barge-inマーカー・自発マーカー)・usage/discarded/uptime表示・**Timeline自動スクロール**(hooksで末尾追従)・**タブ開き直し履歴復元**(GET /api/state)。
- SSE購読(EventSource)をpreact状態へ(既存13イベントのハンドラを移植)。表示はview-logic純関数を呼ぶ薄い層に。
- 視覚: モック§7の配色・行レイアウト。
- テスト: view-logic(Domain Aで固定)+server test無退行。描画は人間ゲート。

### Domain C: 運転バー+設定引き出し(IAの再配置)

- 運転バー(常駐): Fire・Fire+視覚(busy中disable=applySoulState移植)・自発トグル(POST /api/self-fire・null時not available・syncing無限ループ防止)・口数モード(**プルダウンは場所のみ・実配線はs6-followup §12の将来課題**=UIは置くが値は現状固定/no-op+「将来」注記)・KILL(**枠のみ・S8予約**=no-op or disabled)。
- 設定引き出し(⚙で開閉・hooks): 接続(器Channel=token秘匿Set後クリア・redact状態色/YouTube Connect・Disconnect=state駆動有効無効・source記憶復元)・入出力(マイク+Start/Stop・声の出力先=その場再起動・視界ゲーム窓=一覧更新)。全エンドポイント・全設定キーの結線を移植。
- **導線**: 初回(設定空)は引き出し自動展開・二回目以降(記憶済)は観測へ直行(snapshotのchannel/device等で判定)。
- テスト: view-logic(トグル状態導出・disable条件・redact)純関数+server test無退行。

### Domain D: 統合+docs+人間ゲート手順

- cockpit.html最終形(inline moduleエントリ+CSSカスタムプロパティ)・旧バニラJS撤去の確認(死コードゼロ)。
- 旧 cockpit-page.test.mjs の書き換え(HTML文字列regex→新構造に合う最小のスモーク+自己完結の本旨=外部ネットワーク非依存の検査へ)。
- docs: README更新・**人間ゲート手順書**(起動→モックの見た目確認→保存チェックリスト§2を1個ずつ→三層IA/導線確認)。followup台帳(口数モードの実配線=s6-followup §12へ集約・KILL=S8・linkedom梯子・将来のUI分割方針)。
- SDK実消費ゼロ(実射不要=既存経路の見た目替えのみ)。

## 4. blockingレビュー基準

1. **器コード・契約JSON・lockfile・package.json完全不変。新規npm依存ゼロ**(vendorはブラウザ配信・実行時依存に非算入)。**ビルド段ゼロ**(起動経路にコンパイルなし・ソース=実行物)。
2. **server test(ワイヤ契約16+13+6)が全緑=無退行の背骨**。既存の全テストが緑(書き換えるのはUI描画前提のpage testのみ・その書き換えも機能同値をコメントで根拠化)。
3. view-logicは**preact非依存の純関数+fixture必須**(node:testでブラウザ非依存に速く回る=制約b)。
4. 保存チェックリスト(inventory §2-1〜2-3)の全項目が新実装に存在(観測9行種・運転3+予約2・設定6群・履歴復元・遅延生成・shutdown)。**意図的非表示diagnosticリストの遵守**。
5. devDepゼロ維持(linkedom等を入れない)。3チェック無退行。終了処理・タイムアウト。

## 5. choke point(ユーザーの作業)

人間ゲートのみ: 操縦席起動→モックの見た目で立つか+全機能が動くか(手順書はDomain Dが用意)。※実配信・実YouTubeは不要(見た目と結線の確認・既存経路の無退行が対象)。S7 YouTube実ゲートは別途保留のまま。

## 6. Status

計画確定・発進待ち。
