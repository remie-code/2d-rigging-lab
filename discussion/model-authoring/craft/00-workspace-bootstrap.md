# レシピ 00: ワークスペース開眼

新規モデルの作業開始時に一度だけ実行する。目的: 体を知り、実行系を確立し、baseline を切る。

## 前提状態

- ユーザーが Editor で PSD をインポートし、ワークスペース（= `open-model-package-v1` パッケージ）を保存済み。パスを受領している（以下 `<PKG>`）
- ユーザーが `<PKG>` に git init + 初期コミット済み（無ければ自分で `git init && git add -A && git commit -m "[init]"`）
- Editor リポジトリ: `C:/workspace/remie/code/ai-native-live2d-editor`（以下 `<REPO>`。CLI はここから実行する）

## 実行系（全レシピ共通の道具）

- CLI: `<REPO>` で `npx -y tsx apps/authoring-host/src/cli.ts --package-dir <PKG> --state-dir <STATE> --command-file <file.json>`
- `<STATE>` は **`<PKG>` の外**に取る（例: `<PKG>-state`）。中に置くと CLI が reject する
- 変異操作は dry-run→commit の 2 プロセスが必要。実証済みランナー: `discussion/model-authoring/closed-problems/01-eyeball-x/experiment/apply-op.mjs`（op スペック `{operationId, operationType, basePackageRevision, payload}` を渡すと dry-run → 自動承認確認 → commit まで流し、全レスポンスを保存する。PACKAGE_DIR/STATE_DIR 定数を書き換えて使う）
- 読み取り系コマンドの封筒: `{schemaVersion:"ai-command-request-v1", commandId, session:{agentId, capabilities:[...]}, basis:{relatedAC:[],relatedScenarios:[]}, command, payload}`。capabilities: validatePackage→`["read","validate"]` / inspectEvaluatedGeometry→`["read","validate"]` / renderView→`["render"]`

## 手順

1. **健診**: `validatePackage` `{profile:"strict"}`。新規インポートは error 0 が期待値。error があれば ★内容を読んで判断（進行可能な既知クラスか、ユーザー相談か）
2. **開眼レンダ**: `renderView` `{outDir, outputName}`（view 省略 = model bounds 全身）。**新規インポート直後は完全透明が正常**——全 drawable がプレースホルダメッシュ（bounds のみ、頂点 0）であり、ラスタライザに描くものが無いだけ。故障と誤診しないこと
3. **標的同定**: `<PKG>/model/drawables.json` を直接読む（displayName と drawableId の対応、baseDrawOrder）。表情差分で同名パーツが複数ある場合、**無印（サフィックス無し）のセットが第 1 =デフォルト表情**。`<PKG>/model/meshes.json` で各メッシュの頂点数を見れば、どこまでリグ済みかが分かる
4. **巻尺の初計測**: `inspectEvaluatedGeometry` `{targets:[{kind:"drawable",drawableId:...}], includeVertices:false}` で作業対象の rest bbox を取る。以降の設計数値はすべてここから導出する
5. **baseline git commit**（未コミット差分があれば）

## 完了チェック

- validate の結果を把握した / 全身レンダの意味を説明できる / 作業対象の drawableId と rest bbox を列挙できる / git log に baseline がある

## 既知の罠（検証一般）

- **rest 恒等の sha 比較は固定 stageViewport で行う**（3周目発見）: renderView の auto viewport は素材でなく**ワープ domain の union**に追従する——warp デフォーマを新設しただけで viewport が広がり、rest が画素恒等でも sha が変わる。恒等検証のレンダは初回に決めた固定 viewport を封筒に明記して使い回すこと

## 既知の罠（headless validate の error クラス）

CLI の validatePackage は document-only 経路（runtimeSnapshot 不在）であり、リグが育つにつれ**構造的に消せない error クラス**が積み上がる（3周目=claude-chan 周回で裁定）:

- `mesh.uvCoordinateOutOfBounds` / `mesh.orphanedVertex`: 生成器仕様（レシピ01 既知の罠を参照）
- `*.runtimeEvidenceMissing`（rigControl / mask / dynamics / mesh / viewer の一族）: runtimeSnapshot が無い限り enabled な該当構造の**全数に無条件発行**される。op の正誤とは無関係

validate を出口基準に使うときは「blocking 0 + error は既知クラスのみ + **件数が構造数（enabled rigControl 数・mask 数等）と一致**」と書く。既知クラス外の error が 1 件でも出たら停止が正。

## エスカレーション条件

- validate に blocking がある / パッケージ構造が `open-model-package-v1` と違う / テクスチャ寸法解決が reject される（sidecar の `textureDimensionSources` に現れる）→ ユーザーへ
