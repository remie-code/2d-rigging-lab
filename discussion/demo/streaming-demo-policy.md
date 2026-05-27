# Streaming Demo Policy

> Status: Draft for Streaming Demo Surface.
> Scope: Private Prototypeを配信・録画・スクリーンショットで見せるときのhygiene。実装仕様ではない。

## 0. 目的

Private 2D Rigging Lab / Prototypeを見せるとき、rights-cleanな見た目と編集体験だけを示し、互換実装、形式対応、既存モデル読み込み、public配布を示唆しない。

この文書は、配信デモ前に確認するポリシーである。法的安全性を保証するものではない。

## 1. 見せてよいもの

- 自作、生成、または明示許諾済みのlayered character art。
- Private GUI editorの一般的な編集体験。
- Private viewerでのruntime preview。
- Project-defined parameter、rig control、drawable mesh、secondary motionなどの一般語彙。
- Validator reportのうち、素材名や内部pathを伏せたdemo-safeなsummary。
- AI assistantのdry-run、diff、repair suggestionの概念説明。
- 自作モデルで髪・服・小物が遅れて揺れるMinimum Open Dynamics v1の結果。
- Driver parameterを動かしたときにcomputed output parameterが変化する高レベルなUI。

## 2. 避けるもの

- 既存Cubismモデル、公式サンプル、第三者Live2Dモデル、nizima素材、商用モデル。
- `.moc3`, `.cmo3`, `model3.json`, `motion3.json`, `physics3.json`, `pose3.json` などの形式名をUIやファイルツリーで見せること。
- Cubism SDK/Core、SDK/Core代替、互換runtime、format import/exportを示唆する説明。
- Cubism Physicsとの比較、`.physics3.json`表示、Cubism Editor Physics UIとの並列比較。
- Solver式、内部state構造、dynamics schemaの詳細説明。
- 「Live2D互換の物理」など、互換physicsを示唆する表現。
- Cubism互換、VTube Studio互換、Future streaming app、public distribution store/catalog、Future SDK、Future integration surfaceをMVPに含むような表現。
- Internal package schema、private file path、未確定API、実験用調査メモ。
- 法的安全、特許クリア、権利問題なしと断言する表現。

## 3. Preflight Checklist

配信・録画・スクリーンショットの前に確認する。

- Capture対象はrights-clean素材だけか。
- 素材ごとのprovenance、利用区分、demo表示可否が記録されているか。
- Demo画面に内部形式名、外部形式名、SDK/Core、既存モデル読み込みを示唆する文言が出ていないか。
- File explorer、debug panel、terminal、private research archiveが映らないか。
- AI assistantの出力が自動riggingや法的確定判断のように見えないか。
- Viewer sceneだけで伝わる内容に絞れているか。
- Dynamicsを見せる場合、結果と高レベルなdriver/output UIに留め、内部solver詳細やCubism Physics比較を出していないか。
- Proposal用の話題とPrivate Prototypeの実装話を混ぜていないか。

## 4. 推奨Disclaimer

短い表示または口頭説明として、次の趣旨を使う。

> This is a private prototype exploring a 2D rigging workflow with original or permitted assets. It is not compatible with Cubism and does not read, write, convert, or reconstruct Cubism model formats.

日本語で説明する場合:

> これは自作または許諾済み素材で試している個人用プロトタイプです。Cubism互換エディタではなく、Cubismモデル形式の読み書き、変換、再構築は行いません。

Dynamicsを見せる場合の日本語説明:

> 自作2Dモデル向けのsecondary motion実験です。顔や体の動きに応じて、髪や小物が自動で遅れて揺れるようにしています。Live2D/Cubism互換ではなく、独自形式・自作素材の個人研究プロトタイプです。

## 4.1 Dynamics Demo

Allowed:

- 自作モデルで髪・服・小物が遅れて揺れる結果を見せる。
- Driver parameterを動かしたときにcomputed output parameterが変化する高レベルなUIを見せる。
- 「個人研究用のOpen Dynamics / secondary motion」と説明する。
- 内部solver詳細を出さず、制作結果とUXのみ見せる。

Avoid:

- Cubism Physicsとの比較。
- `.physics3.json` という語の表示。
- Cubism Editor Physics UIとの並列比較。
- Solver式、内部state構造、データschemaの詳細説明。
- 「Live2D互換の物理」などの表現。

## 5. Proposalとの関係

Streaming Demo Surfaceは、Live2Dへの機能提案に添える観察材料にはできる。ただし、demoそのものを互換実装、形式対応、SDK/Core代替の証拠として扱わない。

Proposalでは「こういう編集体験が欲しい」という要望を中心にし、Private Prototypeの内部実装を公開前提にしない。

## 6. 未決事項

- 配信で見せる最小viewer scene。
- Demo-safe preflightをvalidatorにどこまで自動化するか。
- DisclaimerをUI内に常時表示するか、配信説明欄に置くか。
