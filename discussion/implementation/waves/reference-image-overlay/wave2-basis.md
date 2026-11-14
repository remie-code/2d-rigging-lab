# Wave 2 の実装根拠

[2 Wave 計画 §2 の受領条件](../../orchestration/reference-image-overlay-wave-plan.md#2-accepted-user-gate) と [§5 の操作合意](../../orchestration/reference-image-overlay-wave-plan.md#5-wave-2--editor操作と制作の往復) を実装とレビューの基準とする。[Wave 1 の共有契約](wave1-contract.md) は独立レビュー済み。

## Editor の接続

- Canvas / Preview toolbar に `Reference Image` を配置する。PNG 選択・差替え・除去、`Model` / `Reference` / `Overlay` と opacity を設定できる。モデル単独表示でも opacity を保持する。
- `Adjust Reference` で四隅・回転のハンドルと基準点の指定を有効にする。非中心 pivot を使って拡縮・回転し、pivot を指定する操作だけでは描画を動かさない。倍率・角度の数値入力を併設する。`Done` 後に既存 Rig 操作へ戻る。wheel zoom と middle/Space+left pan を両モードで確認する。
- Editor は参照の変更をセッションで保持し、Undo/Redo と `Save Workspace` を通す。Editor の未保存状態と Host が読む保存済み状態を区別する。PNG を公開してから状態 JSON を切り替える Wave 1 契約に従う。
- 既存 1D キー編集経路を使う。Editor と Host の同順位 1D / Grid2D 評価は限定 fixture と r815 の比較で確認し、差が再現する場合は影響範囲を示したうえで最小の整合修正をレビューする。

## 証拠と受け渡し

- 外部 r815 workspace のコピーを隔離プロファイルの実 Electron で開く。画像選択、非中心 pivot、拡縮・回転、三表示・opacity、pan/zoom、固定後の既存 warp 編集、Undo/Redo、保存・再開を UI イベントで通す。操作と設定の記録に Canvas のスクリーンショットを添える。
- 別プロセスの Host CLI が Editor の保存した状態を読む。参照の PNG 識別情報・変換・opacity の一致と、モデル版・パラメータ・viewport の一致を別々に記録する。片目の一か所について参照・変更前・変更後と重ね合わせを提示する。
- `apps/editor/package.json` の Windows x64 portable 構成を候補経路とする。隔離候補で起動を確かめ、モデル workspace と PNG の入口を操作手順に記録する。
- 実装と証拠作成は Gnome が担当し、別コンテキストの Review-Sylph 一人が契約・コード・試験・実 UI を照合する。内部判定の後、作業感と造形の印象を本人へ渡す。
