# コンセプト変更メモ: Private 2D Rigging Lab / Prototype

> Status: Current baseline
> Supersedes: 旧公開エコシステム方針
> Positive input: `memo/new_concept.md`

## 1. 現在の主目的

本プロジェクトの現在の主目的は、個人利用の **Private 2D Rigging Lab / Prototype** を作ることである。

Private 2D Rigging Lab / Prototype とは、権利クリーンな2Dキャラクター素材を、独自形式・独自UI・独自runtimeで可動モデルとして制作、検証、表示するための private な実験環境である。

目的は、Cubism互換製品を作ることではない。目的は、Cubism水準の創作結果と制作支援UXを、個人利用の範囲で検証することである。

特に検証したい価値は以下である。

- private GUI editor で、素材から可動モデルを制作できること。
- private runtime core と private viewer で、保存後のモデルを同じ評価系で表示できること。
- project-defined model package に、model graph、assets、operation log、validation、provenance を保持できること。
- AI assistant が dry-run、diff、validation、repair suggestion を出し、人間の制作判断を補助できること。
- 配信や提案資料に出す面を、private実装の内部詳細から分離できること。

## 2. 非互換・非依存の決定

本プロジェクトは Live2D Cubism 互換エディタではない。

現在の実装方針では、以下を行わない。

- Cubism形式の読み書き。
- Cubism形式の解析、変換、再構築。
- Cubism SDK/Core の利用。
- 既存Cubismモデルの読み込み。
- Live2D公式サンプル、第三者Live2Dモデル、nizima素材の利用。
- `.model3.json`、`.moc3`、`.cmo3`、`.physics3.json`、`.motion3.json`、`.pose3.json` の検査、読み込み、変換。
- Cubism Editor のUI、メニュー、ショートカット、画面構成の模倣。
- Cubism互換、Live2D代替、自作Cubismとしての主張。

Live2D / Cubism に関する既存レポートは、過去調査、リスク確認、非互換宣言、スコープ除外判断のための private research archive として扱う。実装仕様、runtime oracle、UI仕様、fixture source、配信素材にはしない。

## 3. 4つのトラック

現在の方針では、private実装、配信デモ、提案資料、将来公開可能性を混ぜない。

| Track | 位置付け | 現在の扱い |
|---|---|---|
| Private Prototype | 個人利用の実装本体。private GUI editor、private runtime core、private viewer、project-defined model package、validator、AI assistant を含む | 現在の主対象 |
| Streaming Demo Surface | 配信、動画、SNS等で見せる高レベルな結果とUX。コード、内部形式、アルゴリズム詳細、Cubism比較は出さない | 実装本体から分離 |
| Live2D Feature Proposal | Live2Dへ渡す可能性がある制作課題、UX検証、AI支援案、before/after資料 | 互換実装ではなく機能要望として整理 |
| Future Public Clean Subset | 将来公開する場合に、private prototypeから十分に切り離して再設計する最小subset | 現在MVP外 |

### Track A: Private Prototype

Private Prototype は、現在の実装・設計の正である。

含めてよいもの:

- rights-clean な自作または明示許諾素材。
- layered character PSD profile または split PNG fallback からの素材取り込み。
- drawable、texture、part、mesh、parameter、keyform、rig control、mask、draw order。
- private runtime core による評価。
- private viewer による parameter 操作と確認。
- validation report、runtime snapshot、operation log、provenance。
- AI dry-run、model diff、runtime diff、validation diff、repair suggestion。
- demo-safe capture のためのスクリーンショット/動画出力。

### Track B: Streaming Demo Surface

Streaming Demo Surface は、外に見せる範囲であり、実装仕様の正ではない。

許可する方向:

- 自作素材による完成結果。
- 独自UIの高レベルな操作感。
- AIが検証結果や修正候補を示す概念デモ。
- 個人研究、非互換、非提携を明示した説明。

避けるもの:

- コード、schema、ファイル構造、内部アルゴリズム。
- Cubism形式名、SDK/Core連携、既存モデル読み込みを示唆する画面。
- Cubism Editorとの画面比較。
- 公式ロゴ、公式素材、第三者モデル。
- 互換、代替、再実装として受け取られる表現。

### Track C: Live2D Feature Proposal

Live2D Feature Proposal は、private prototype の成果を競合・互換実装として見せるのではなく、制作課題と欲しい機能を説明する資料である。

提案候補:

- AI dry-run。
- before/after diff。
- structured validation。
- repair suggestion。
- operation log。
- provenance。
- keyform修正前の影響範囲確認。
- 複数parameter組み合わせ破綻の検出。

このトラックでは、Cubism形式を読める/書ける、内部構造を再現した、SDK/Coreを代替する、という示唆を出さない。

### Track D: Future Public Clean Subset

Future Public Clean Subset は、将来公開する可能性がある場合にだけ、private prototype から別途切り出して再設計する。

候補にできるもの:

- project-defined package の最小 viewer。
- rights-clean sample。
- validation / provenance checker。
- AI dry-run / diff の汎用的な枠組み。

現在含めないもの:

- private prototype のフル機能。
- Future SDK。
- Future integration surface。
- Future streaming app。
- OBS output。
- plugin system。
- public distribution store / catalog。
- public sample distribution。
- Cubism相当機能を広く含む公開物。

## 4. 現在のMVP定義

現在のMVPは **Private Authoring-to-Viewer Prototype** である。

中心問い:

> 権利クリーンな自作または明示許諾の layered character art を private GUI editor で可動モデル化し、project-defined model package として保存し、private runtime core / private viewer で表示し、validation と AI dry-run / diff / repair suggestion を確認し、demo-safe capture まで一周できるか。

MVPに含めるもの:

- private GUI editor。
- private runtime core。
- private viewer。
- project-defined model package。
- layered character PSD profile / split PNG fallback。
- drawable、texture、part、mesh、parameter、keyform、rig control、mask、draw order。
- editor preview、保存、再読み込み、viewer表示。
- validator report。
- AI assistant の dry-run、diff、repair suggestion。
- rights metadata、provenance。
- demo-safe screenshot/video capture。

MVP外に下げるもの:

- Future SDK。
- Future integration surface。
- Future streaming app。
- OBS output。
- plugin system。
- marketplace / registry。
- public sample distribution。
- Cubism形式 import/export。
- Cubism SDK/Core。
- 既存Cubismモデル読み込み。

## 5. 旧方針との関係

旧方針では、公開可能なエコシステムとして、model format、runtime、viewer、editor、SDK、streaming app、integration surface、sample model、documentation を広く対象にしていた。

この方向は現在 superseded である。

現在の正は、Private Prototype を主対象とし、Streaming Demo Surface、Live2D Feature Proposal、Future Public Clean Subset を明確に分離することである。

旧文書に由来する公開前提、SDK、streaming app、公開配布store/catalog、integration surface、public sample distribution は、明示的に再採用されない限り、現在MVPの要件ではない。

## 6. memo/new_concept.md対応完了状態

`memo/new_concept.md` に対する `discussion/` 文書移行は完了扱いである。

完了済み:

- Root concept / Root AC / MVP ACをPrivate Prototype baselineへ更新。
- Domain ACとDomain scenarioをCurrent / Optional / Future分類へ整理。
- Private Prototypeのactive vocabularyをproject-defined package、private runtime core、private viewer、validator、AI assistantへ統一。
- 接続部はmanual overlap / mask / draw order / keyform / joint-area validation、MVPの髪・服・小物の揺れはMinimum Open Dynamics v1によるparameter-driven deterministic secondary motion、computed output parameter、通常keyform / rig control評価で扱う。顔向き風の変化はmanual authored parameter grid、parameter名はprojectPresetAlias / semantic roleへ整理。
- AIはassistant / validator / dry-run / diff / repair suggestionとして整理。
- Streaming Demo SurfaceとLive2D Feature Proposalの専用文書を追加。

文書移行を超える別課題:

- 実装コード作成。
- 法務判断や特許クリア判断。
- 配信用素材、capture scene、最終disclaimerの確定。
- Live2Dへ最初に提案する機能テーマの決定。
- Future Public Clean Subsetの詳細設計。
