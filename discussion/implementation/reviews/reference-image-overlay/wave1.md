# 参照画像表示 Wave 1 独立レビュー

[Wave 1 実装根拠](../../waves/reference-image-overlay/wave1-basis.md) と [共有契約](../../waves/reference-image-overlay/wave1-contract.md) を基準に、Host の CLI から保存・再読込・描画までを確認した。

**Wave 1 の内部判定は合格。** Editor での操作・保存再開は Wave 2、比較しながら編集する作業感と造形の受領は [User Gate](../../orchestration/reference-image-overlay-wave-plan.md#2-accepted-user-gate) で確認する。

## 実装と契約

- 共通型は画像寸法、SHA-256、バイト長、表示モード、opacity、変換を検証する。座標演算は Y 下向きのモデル座標へ一様拡縮・時計回り回転・平行移動を適用する。pivot 再指定だけなら origin は同じで、拡縮・回転時は新しい変換で pivot のモデル座標を逆算して origin を求める。画像とモデルは同じ viewport 変換を使う。 [共有型](../../../../packages/contracts/src/reference-image.ts)、[座標演算](../../../../packages/authoring-core/src/reference-image-transform.ts)、[描画用四角形](../../../../apps/authoring-host/src/perception/reference-image-foreground.ts)
- Host の CLI と直接呼び出しは既存の package-wide lock を経由する。参照の書き込みは同じディレクトリ内の一時ファイルを rename し、PNG の公開後に JSON を切り替える。旧ハッシュの PNG が残るため、切替前の JSON を読んだ処理も旧画像を開ける。画像の再読込でバイト長、SHA-256、復号寸法を照合する。登録・除去は既存の破損状態を読み込まず復旧できる。 [Host 入口](../../../../apps/authoring-host/src/run-authoring-host-command.ts)、[参照保存](../../../../apps/authoring-host/src/workspace-reference-image-io.ts)
- 参照 JSON はモデル用 file set の列挙から外れ、モデルの再保存は自分の file set だけを書く。明示的なモデル単独描画は参照の状態を読まない。参照のない workspace での通常描画はモデルを使う。重ね合わせはモデルの drawable、マスク、テクスチャ ID から独立した描画パスで、元 PNG の alpha と参照 opacity を掛け合わせる。 [モデル保存](../../../../apps/authoring-host/src/package-directory-io.ts)、[Host 描画](../../../../apps/authoring-host/src/run-render-view-command.ts)、[合成](../../../../packages/render-software/src/software-renderer.ts)
- sidecar はモデル ID・版、parameter override、解決済み viewport・出力寸法、有効モード、参照を描いたときの PNG 識別情報・変換・opacity を記録する。指定のないパラメータ値を含む再現には同じモデル版が必要。 [sidecar](../../../../apps/authoring-host/src/perception/render-view-sidecar.ts)
- ファイルの責務は共有契約・座標演算・PNG 検証・保存 I/O・Host dispatch・比較描画に分かれる。変更した三つの `index.ts` は再エクスポートのみ。Orch の source organization 検査は基点と同じ既存の `apps/runtime-player/src/main/physiology/index.ts` の違反を報告した。

## テスト

- 独立実行の専用 Host テスト 1 件が通過。別呼び出しでの再読込、外部原本の削除後に保存済み PNG を取得、透明と半透明の alpha、権限不足、登録失敗時の状態保持、PNG 欠落・JSON 破損時のモデル単独描画、除去による復旧を確認した。 [Host CLI テスト](../../../../apps/authoring-host/src/run-reference-image-command.test.ts)
- 独立実行の root unit 251 ファイル・1,553 件が通過し、座標変換の試験を含む。Orch は依存関係と Soul 境界チェックの通過、Gnome は Host 型検査の通過を報告した。Host 全体は 164/165 件で、既存 state-directory guard の失敗は Gnome が HEAD でも再現した。

## 実 CLI の出力

- `tmp/reference-overlay-wave1/reproduce.py` は検証用 r815 コピーで、コマンドごとに新しい CLI プロセスを起動する。実 PNG の元バイトを workspace に取り込み、登録元の一時コピーを削除してから再読込と描画を続ける。
- 非中心 pivot の画像座標 (550, 535) を指定した前後で、参照 PNG がバイト一致した。保存値からモデル座標を独立再計算し、倍率 0.875・回転 2.4° への変更前後で (969, 389) を保つことを確認した。
- 広域 viewport で通常描画、モデル単独、opacity 0 の overlay がバイト一致した。参照単独の出力 alpha の最大値は opacity 0、0.45、1 で順に 0、115、255 だった。モデル表示に切り替えて戻した設定と、失敗した登録・基準点更新の後の設定は再現手順で照合した。
- 再現手順は参照保存の前後でモデルのファイル全件を SHA-256 比較する。同じ r815 で組み立てた Runtime Export の全4エントリについて、前後のファイルパスと SHA-256 が一致することを独立に確認した。
- 片目の既存キー `param_eye_right_open=1` で、`rig_eye_r_open` の点 183 をモデル Y 下方向へ 9 移動し、CLI の dry run と commit で r815 から r816 に保存した。独立に採った保存前後のスナップショットでは、そのキーで変更された制御点は一つ、参照を除く全51ファイルでバイト差が出たのは `manifest.json` と `model/keyforms.json` だった。
- 目の拡大 viewport で編集前後の参照単独 PNG（opacity 0.45）がバイト一致した。sidecar の viewport・出力寸法・parameter override・参照設定は一致し、モデル版は r815 から r816 へ進んだ。編集の画素差はモデル単独 6,087 px、overlay 6,031 px で、どちらも出力座標の矩形 `[247, 102, 346, 180)` に収まった。
- 実際に表示した比較では、虹彩の上にある上まつ毛の暗い輪郭が局所的に下がった。出力の x=290 で、y=100〜207 の範囲を上から走査し RGB 全チャネルが 112 未満になる最初の画素は、モデルで y=130 から 144 へ動き、参照では y=178 だった。この位置では差が縮まり、線の高さの差と中央の折れが残る。 [参照・モデル比較](../../../../tmp/reference-overlay-wave1/outputs/comparison-eye.png)、[overlay 前後](../../../../tmp/reference-overlay-wave1/outputs/comparison-eye-overlays.png)、[広域比較](../../../../tmp/reference-overlay-wave1/outputs/comparison-wide.png)
- 差替えた半透明 PNG の描画、除去後の別プロセス再読込とモデル単独描画、元の参照設定の再登録まで実行が完了した。 [実証スクリプト](../../../../tmp/reference-overlay-wave1/reproduce.py)、[検証結果](../../../../tmp/reference-overlay-wave1/outputs/verification.json)
