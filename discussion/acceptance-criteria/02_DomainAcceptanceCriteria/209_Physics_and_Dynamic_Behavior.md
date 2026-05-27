# DOMAIN-09: Open Dynamics and Secondary Motion

> Status: Current MVP for Minimum Open Dynamics v1.

## 問い

Private Prototypeは、Minimum Open Dynamics v1として、髪・服・リボン・アクセサリなどのsecondary motionをどう保存・評価・検証するべきか。

## 方針

このdomainは、髪・服・小物などのsecondary motionを、project-defined Open DynamicsとしてCurrent MVPに含める。MVPではparameter-driven deterministic dynamicsに限定し、driver parameterからcomputed output parameterを生成して通常のkeyform / rig control評価へ渡す。

Cubism Physics互換、外部solver互換、`.physics3.json`互換、timeline bake、direct vertex physics、direct rigControl physics output、cloth simulation、collision、IK、Cubism Viewer一致、Cubism Editor Physics UI再現は対象外とする。

### AC-PHYS-001: dynamics groupを定義できること

Project-defined packageは、入力parameter、出力computed parameter、遅れ、減衰、制限、reset条件を持つdynamics groupを定義できること。

MVPでは、1つのdynamics groupはちょうど1つのcomputedDynamics output parameterだけを生成する。複数の揺れ出力が必要な場合は複数groupを作る。同じcomputed output parameterを複数groupが出力対象にすることは禁止する。

### AC-PHYS-002: dynamics入出力の依存関係を検証できること

Minimum Open Dynamics v1では、dynamics groupはauthoredInput parameterだけをdriverとして参照し、computedDynamics parameterだけへ出力できること。

複数driverはweighted sumで決定的に合成すること。Computed output parameterを同じgroupまたは他groupのdriverとして使うこと、group間依存を作ること、mesh / rig control / drawable stateを読むこと、mesh / rig control / drawable stateへ直接書き込むことはMVPでは禁止し、validatorで報告できること。

### AC-PHYS-003: deterministic secondary motionを再現できること

Minimum Open Dynamics v1はstateful evaluatorである。Runtime coreはhidden mutable stateを持たず、previous `RuntimeStateDto` を入力し、`RuntimeSnapshotDto` と next `RuntimeStateDto` を返すこと。

同じpackage、同じinitial `RuntimeStateDto`、同じauthored parameter input sequence、同じfixed timestepに対して、private runtime coreは同じdynamics output sequenceを返せること。

### AC-PHYS-004: previewとviewerで同じ結果になること

Dynamics groupはproject-defined packageへ保存され、Editor previewとprivate viewerで同じ入力列なら同じcomputed output parameter列とsnapshot diagnosticsを返せること。

### AC-PHYS-005: runtime snapshotでdynamics状態を観測できること

Runtime snapshotは、dynamics group ID、enabled状態、solverKind、driver値、output値、内部状態summary、tick、fixedStepMs、resetCounter、diagnosticsを含められること。

Runtime diffは、computed parameter差分に加えて、dynamics groupのposition、velocity、tick、resetCounter、outputParameterIdの差分を観測できること。

### AC-PHYS-006: demo-safeに見せられること

Dynamics demoでは、rights-cleanな自作素材で髪・服・小物が遅れて揺れる結果と高レベルなdriver/output UIだけを見せ、Cubism Physics比較、`.physics3.json`表示、内部solver詳細、Live2D互換の物理という表現を出さないこと。

## 2. MVP外に残すもの

- Cubism Physics互換。
- `.physics3.json` import / export。
- direct vertex physics。
- direct rigControl physics output。
- cloth simulation。
- collision。
- IK。
- timeline bake。
- Cubism Viewer結果一致。
- Cubism Editor Physics UI再現。
- AIによる自動物理パラメータ最適化。
