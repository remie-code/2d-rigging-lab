# シナリオ: AI Assistant and Validator Operation

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/213_AI-native_Operation.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/213_AI-native_Operation.md)
> Status: Accepted draft for Private Prototype MVP.

## 0. 目的

このシナリオは、AIを自動rig生成者ではなく、validator reportを説明し、dry-run、diff、repair suggestion、provenance確認を支援するassistantとして検証する。

## 1. Source-of-Truth

### Design Decisions

- AI assistantはprivate project/packageに対する説明、検査、提案、差分提示を担う。
- File変更はユーザー承認後に行う。
- Public API、外部アプリ連携、完全自動riggingはMVP外である。

### Research Notes

- 旧AI Agent / Cubism参照操作は現在のMVP仕様ではない。

## SC-AI-001: validator reportを説明できる

### Given

- Validator reportには、mesh破綻、provenance不足、未使用parameter、demo-safe warningが含まれている。

### When

1. ユーザーがAI assistantにreportの説明を求める。
2. AI assistantが対象path、原因、影響、推奨対応を要約する。

### Then

- AI assistantはreport itemに基づく説明だけを返す。
- 不明点は推測で断定せず、追加確認として提示する。
- 権利や法的安全性を断言しない。

### 検証するAC

- AC-AI-001
- AC-AI-002

## SC-AI-002: repair suggestionをdry-runで提示できる

### Given

- Projectには、未接続control、範囲外parameter、欠けたmetadataなどの修正候補がある。

### When

1. ユーザーがAI assistantに修正案を求める。
2. AI assistantがdry-runとして候補を生成する。
3. Editorがdiffを表示する。

### Then

- Diffは変更対象、変更前、変更後、根拠となるvalidation itemを含む。
- ユーザーが採用するまでpackage本体は変更されない。
- 不可逆操作や大規模再構成は明示的な確認なしに実行されない。

### 検証するAC

- AC-AI-003
- AC-AI-004

## SC-AI-003: provenanceとdemo-safe分類を支援できる

### Given

- Projectには複数の素材とrights/provenance metadataがある。

### When

1. ユーザーがAI assistantにdemo可否の整理を求める。
2. AI assistantがmetadata不足、demo不可素材、確認待ち素材を分類する。
3. ユーザーが不足metadataを補う。

### Then

- AI assistantはmetadataに基づく分類だけを提示する。
- 不足情報はNeeds reviewとして残る。
- Demo-safe判定はvalidator reportと一致する。

### 検証するAC

- AC-AI-005
- AC-RIGHTS-002

## SC-AI-004: AI操作の監査ログを残せる

### Given

- ユーザーがAI assistantに複数の説明と修正案を求めている。

### When

1. AI assistantが提案を生成する。
2. ユーザーが採用、却下、保留を選ぶ。
3. Editorが操作履歴を保存する。

### Then

- Prompt要約、参照report item、提案diff、ユーザー判断、適用結果が記録される。
- あとからどのAI提案がpackageへ反映されたか追跡できる。
- AI出力だけを根拠にrights-safeやdemo-safeを確定しない。

### 検証するAC

- AC-AI-006

## 2. 未決事項

- AI assistantのprompt/contextに含めるpackage情報の最小範囲。
- Diff形式をJSON Patch相当にするか、project-specific patchにするか。
