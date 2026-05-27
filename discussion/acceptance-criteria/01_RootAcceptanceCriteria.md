# Private 2D Rigging Lab Acceptance Criteria System Draft

# 1. Root Acceptance Criteria

## AC-ROOT-001: Private 2D Rigging Lab / Prototype として成立すること

Private 2D Rigging Lab / Prototype は、権利クリーンな2Dキャラクター素材から、可動モデルを private に制作、保存、検証、表示できる実験環境であること。

現在の主対象は、private GUI editor、private runtime core、private viewer、project-defined model package、validator、AI assistant である。

Future SDK、Future integration surface、Future streaming app、OBS output、plugin system、public distribution store / catalog、public sample distribution は、現在MVPの要件ではない。

## AC-ROOT-002: Project-defined model package を第一級の正とすること

Private 2D Rigging Lab は、`.cmo3`、`.moc3`、`.model3.json`、`.physics3.json`、`.motion3.json`、`.pose3.json` ではなく、project-defined model package を中核仕様として持つこと。

Project-defined model package は、少なくとも以下を表現または追跡できること。

- source asset provenance。
- texture。
- drawable。
- mesh。
- vertex / uv / triangle index。
- part。
- draw order。
- clipping / mask。
- parameter。
- keyform。
- rig control。
- validation report。
- runtime snapshot。
- operation log。
- AI向けの構造化情報。

## AC-ROOT-003: Private runtime core / viewer がモデルを評価・表示できること

Private runtime core / viewer は、project-defined model package を読み込み、parameter 値に応じてモデル状態を評価し、描画結果とruntime stateを生成できること。

Runtime は、Editor preview と Viewer で同じ評価意味論を共有し、表示結果、diagnostics、snapshot を人間およびAI assistantが確認できる構造として提供すること。

## AC-ROOT-004: Private GUI editor が制作入口になること

Private GUI editor は、入力素材または project-defined model package からモデルを制作、編集、検証し、保存、再読み込みできること。

Cubism Editor の画面構成、メニュー配置、ショートカット、UI挙動の模倣は目的ではない。

再構築すべきものは、2Dキャラクターの制作成果を作る能力、制作途中の見通し、保存後の再検証、AI補助である。

## AC-ROOT-005: AI assistant による観測・dry-run・diff・検証が成立すること

Private 2D Rigging Lab は、人間のGUI制作を正としつつ、AI assistant が構造化された観測、dry-run、diff、validation、repair suggestion を扱えること。

AI assistant は少なくとも以下を行えること。

- モデル状態を構造化データとして観測する。
- 編集operationをdry-runする。
- 操作前後の model diff、runtime diff、validation diff を取得する。
- 操作結果をACまたはシナリオに照らして検証する。
- 失敗理由と影響範囲を特定する。
- 人間が承認または却下できる repair suggestion を提示する。
- provenance を記録する。

AI assistant は、既存モデル変換、画像からの完全自動リギング、Cubism級モデルの自動生成を現在MVPの成功条件にしない。

## AC-ROOT-006: Cubism 非互換・非依存であること

Private 2D Rigging Lab は、主要工程を Cubism Editor、Cubism Core、Cubism SDK、Live2D公式/第三者モデル、nizima素材に依存せず完結できること。

現在の方針では、以下を行わない。

- Cubism形式の読み書き。
- Cubism形式の解析、変換、再構築。
- Cubism SDK/Core の利用。
- 既存Cubismモデルの読み込み。
- `.model3.json`、`.moc3`、`.cmo3`、`.physics3.json`、`.motion3.json`、`.pose3.json` の検査、読み込み、変換。

Cubism関連資料は、過去調査、リスク確認、非互換宣言、スコープ除外判断の文脈に限定して扱う。

## AC-ROOT-007: Demo and Proposal Hygiene を満たすこと

Private 2D Rigging Lab は、個人利用、配信デモ、Live2Dへの機能提案において、素材、表示、説明、依存関係の権利境界と誤認防止を保てること。

配信デモや提案資料で使用する素材、モデル、画像、動画、音声、AI生成物は、自作または明示的に利用可能なものに限定する。

配信デモでは、コード、内部形式、ファイル構造、実装詳細、Cubism比較、Cubism形式対応を示唆する画面を出さないこと。

Live2Dへの提案資料では、互換エディタ、形式変換、SDK/Core代替としてではなく、制作課題、UX検証、機能要望として提示すること。

将来公開する場合は、Future Public Clean Subset として別途スコープ、権利、依存、表示範囲を再設計・再レビューすること。

## AC-ROOT-008: 仕様体系が行動可能な正解であること

このプロジェクトで抽出・定義されるAC、仕様、シナリオは、説明文ではなく、後続エージェントの行動可能な正解であること。

すなわち、Undine が仕様・シナリオを起こし、Gnome が実装し、Sylph がレビューする際に、何を作るべきか、何を満たせば正しいか、何を根拠に合否判断するかを示すものでなければならない。

旧公開エコシステム方向の文書は、現在baselineとして明示的に更新された文書に従属する。
