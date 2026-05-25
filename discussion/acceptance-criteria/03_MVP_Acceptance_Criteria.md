# Open Live2D Stack Acceptance Criteria System Draft

# 3. MVP Acceptance Criteria

## MVPの問い

最初に何ができれば、Open Live2D Stack は「実在する」と言えるのか。

MVPでは、Cubism 既存モデルの完全読み込み、`.cmo3` 復元、`.moc3` 互換出力を成功条件にしない。

MVPの中心は、権利的にクリーンな最小モデルを Open Model Format として定義し、Open Runtime / Viewer で読み込み・表示・操作・検証できることである。


## AC-MVP-001: 最小 Open Model Format を定義できること

Open Live2D Stack は、最小サンプルモデルを表現するための Open Model Format を定義できること。

最小モデルには、少なくとも texture、drawable、mesh、parameter、keyform、part、metadata を含める。


## AC-MVP-002: 最小モデルを保存・読み込みできること

Open Live2D Stack は、最小モデルを Open Model Package として保存し、再読み込みできること。

保存・読み込み後に、モデル構造、参照、parameter 範囲、mesh、texture 対応が保持されること。


## AC-MVP-003: Open Runtime が parameter に応じてモデル状態を評価できること

Open Runtime は、Open Model Format を読み込み、parameter 値に応じた drawable / mesh / vertex 状態を評価できること。

最小成功条件は、1つ以上の parameter によって、少なくとも1つの drawable の頂点位置または表示状態が変化することである。


## AC-MVP-004: Open Viewer がモデルを表示・操作できること

Open Viewer は、最小 Open Model Package を読み込み、モデルを表示し、parameter slider などで parameter 値を変更できること。

変更結果が runtime 評価と描画結果に反映されること。


## AC-MVP-005: Open Package Validator が検証レポートを出力できること

Open Package Validator は、最小 Open Model Package に対して、必須ファイル、参照解決、mesh整合性、parameter定義、runtime load可否を検証できること。

検証結果は、人間とAIエージェントが読める構造化レポートとして出力できること。


## AC-MVP-006: 権利的にクリーンな最小サンプルモデルを持つこと

MVPに使うサンプルモデル、テクスチャ、検証データは、Open Source 公開可能な権利状態であること。

Cubism 公式サンプル、商用モデル、再配布不可のSDK/CoreをMVP必須データにしない。


## AC-MVP-007: 最小編集または生成フローを成立させること

Open Editor または authoring script は、最小 Open Model Package に対して、軽微な編集または生成操作を行い、その結果を保存できること。

初期段階では、完全なGUI Editorではなく、構造化操作またはスクリプトによる authoring を許容する。


## AC-MVP-008: AIエージェントがMVP工程を観測・操作・検証できること

AIエージェントは、最小モデルの読み込み、構造観測、parameter操作、軽微編集、保存、runtime表示、validator結果確認を、構造化情報として扱えること。


## AC-MVP-009: Cubism 資産は参照・移行調査対象として扱えること

MVPは `.moc3` 互換出力や `.cmo3` 復元を要求しない。

ただし、Cubism runtime package を観測し、Open Model Format へ移行可能な情報と欠落する authoring 情報を区別する調査・検証は行ってよい。
