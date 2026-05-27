はい。今の設計なら、テスト設計フェーズでやるべきことはかなり明確です。

まず前提として、このプロジェクトのテストは「普通のアプリの単体テスト」だけでは足りません。
目的は、**AC・Scenario・Module Contractを満たした証拠を、fixture、operation log、runtime snapshot、validation report、diff、GUI evidenceとして残せるようにすること**です。

つまりテスト設計フェーズの成果物は、単なる「テストケース一覧」ではなく、**MVP達成を証明する evidence design** になります。

---

# 1. テスト設計フェーズの中心目的

今回のテスト設計の中心問いはこれです。

> Private GUI Editorで権利クリーンな素材からモデルを作り、保存し、Viewerで動かし、Dynamicsを含むruntime結果を得て、ValidatorとAI assistantで検証できることを、どのfixture・どのoperation・どのsnapshot・どのreportで証明するか。

この問いに答えるために、テスト設計では以下を決める必要があります。

1. 何をテスト対象にするか。
2. どのAC / Scenarioを証明するか。
3. どのfixtureを使うか。
4. どの操作列を実行するか。
5. どの成果物をexpected outputにするか。
6. 何をpass / fail / needs_reviewにするか。
7. 自動判定するものと人間確認するものをどう分けるか。
8. Editor / Runtime / Viewer / Validator / AI のどこが責任を持つか。
9. Dynamicsのような時間依存機能をどう決定的に検証するか。
10. 配信デモ安全性やCubism非依存性をどう検査するか。

---

# 2. テスト設計フェーズで作るべき成果物一覧

テスト設計フェーズでは、最低限この成果物群を作るのがよいです。

## 2.1 Test Strategy

目的は、テスト全体の方針を固定することです。

作るアウトプット:

* `test-strategy.md`

内容:

* テストの目的。
* MVP達成判定の考え方。
* 自動テストと手動確認の分離。
* Contract test / integration test / acceptance test / visual review の役割。
* 「商用品質の見た目」はMVP acceptanceの自動fail条件にしない、などの境界。
* Cubism非依存・配信デモ安全性もテスト対象に含めること。
* Dynamicsはdeterministic sequence testで検証すること。

書くべき方針:

* MVP達成は、GUI操作、保存package、runtime snapshot、validation report、AI dry-run、demo-safe preflight の証拠で判定する。
* pixel-perfectな見た目一致より、構造化runtime stateと代表captureを優先する。
* 見た目品質は初期MVPでは human visual review として扱う。
* 直接Cubismとの比較をテストoracleにしない。

---

## 2.2 Test Taxonomy

テスト種別を分類する成果物です。

作るアウトプット:

* `test-taxonomy.md`

分類例:

1. **Schema tests**
   package JSON / DTO / Zod schemaが通るか。

2. **Contract tests**
   package-format、operation-core、runtime-core、validator、AI interfaceの契約が守られるか。

3. **Operation tests**
   GUIやAIが発行するoperationがdry-run / commit / undo / redoで正しく動くか。

4. **Runtime tests**
   parameter、keyform、grid、rigControl、mask、draw order、Dynamicsを評価できるか。

5. **Dynamics sequence tests**
   fixed timestep、initial state、input sequenceに対して同じoutput sequenceになるか。

6. **Validator tests**
   invalid fixtureから期待diagnosticsが出るか。

7. **GUI evidence tests**
   GUIで実際に制作した証拠がoperation log / GUI evidenceとして残るか。

8. **AI assistant tests**
   AIがdry-run、diff、validation report参照、repair suggestionを行い、packageを直接破壊しないか。

9. **Acceptance tests**
   AC / Scenario単位でMVP達成証拠をまとめる。

10. **Demo-safe tests**
    配信画面に出してよい情報だけが出るか。

11. **Rights / provenance tests**
    自作素材・権利情報・AI利用有無が追跡できるか。

12. **Guardrail tests**
    Cubism形式、SDK/Core、既存モデル、危険語彙が入り込まないか。

---

## 2.3 AC / Scenario / Test Traceability Matrix

最重要成果物の一つです。

作るアウトプット:

* `test-traceability-matrix.md`
* 可能なら `test-traceability-matrix.json`

これは既存の `traceability-matrix.md` を、さらにテスト観点へ落としたものです。

最低限の列:

| Field              | 内容                                      |
| ------------------ | --------------------------------------- |
| AC ID              | `AC-MVP-010` など                         |
| Scenario ID        | `SC-DYN-002` など                         |
| Test ID            | `TC-DYN-002-001` など                     |
| Fixture            | `minimal-dynamics-hairSway` など          |
| Operation flow     | 実行する操作列                                 |
| Expected artifacts | snapshot / report / diff / log          |
| Oracle             | 何と比較するか                                 |
| Automation         | auto / manual / hybrid                  |
| Gate               | MVP blocking / warning / optional       |
| Owner module       | runtime-core / validator / editor-ui など |

重要なのは、**ACに対してテストがあるだけでなく、テストがどの成果物で証明されるかまで書くこと**です。

例:

| AC         | Scenario   | Test                | Fixture                   | Expected                                                                  |
| ---------- | ---------- | ------------------- | ------------------------- | ------------------------------------------------------------------------- |
| AC-MVP-010 | SC-DYN-002 | TC-DYN-SEQUENCE-001 | minimal-dynamics-hairSway | snapshot sequence, computed hairSway values, no nondeterminism diagnostic |
| AC-MVP-013 | SC-DYN-003 | TC-VAL-DYN-003      | invalid-dynamics-cycle    | validation report with `dynamics.groupCycle`                              |
| AC-MVP-014 | SC-AI-xxx  | TC-AI-DRYRUN-001    | ai-repair-dry-run         | dry-run diff, no committed package mutation                               |

---

# 3. Fixture設計

今の設計ではfixtureが非常に重要です。
テスト設計フェーズでは、fixture名だけでなく、**fixtureが何を含み、何を期待出力にするか**まで固定するべきです。

作るアウトプット:

* `fixture-manifest.md`
* `fixture-manifest.json`
* `fixtures/<fixture-id>/README.md`
* `fixtures/<fixture-id>/manifest.json`

各fixtureの定義に必要な項目:

| Field                 | 内容                          |
| --------------------- | --------------------------- |
| fixtureId             | `minimal-dynamics-hairSway` |
| purpose               | 何を証明するfixtureか              |
| related AC            | 関連AC                        |
| related scenarios     | 関連scenario                  |
| package files         | 含まれるmodel package           |
| source assets         | PSD / split PNGなど           |
| rights metadata       | 自作・許諾・AI利用有無                |
| operations            | fixture生成操作列                |
| expected validation   | 期待diagnostics               |
| expected runtime      | 期待snapshot                  |
| expected diff         | 期待diff                      |
| expected GUI evidence | GUI制作証拠                     |
| automation level      | auto / manual / hybrid      |
| update policy         | golden更新条件                  |

---

# 4. Fixtureの分類

今の設計なら、fixtureは次のカテゴリに分けるとよいです。

## 4.1 Happy-path fixture

MVPの正常系です。

代表:

* `minimal-valid-package`
* `psd-import-happy-path`
* `tutorial-like-authoring`
* `manual-face-grid-2d`
* `parent-child-rigControl-diagonal`
* `minimal-dynamics-hairSway`

目的:

* GUIから作ったモデルが、保存、再読み込み、runtime表示、validator passまで通ることを示す。

期待アウトプット:

* `package/`
* `operation-log.json`
* `validation-report.json`
* `runtime-snapshot-summary.json`
* `runtime-snapshot-full.json`
* `runtime-diff.json`
* `gui-evidence.json`
* 必要なら代表capture画像

---

## 4.2 Invalid fixture

Validatorのための異常系です。

代表:

* `invalid-mesh-triangle`
* `invalid-missing-texture`
* `invalid-rigControl-cycle`
* `invalid-mask-reference`
* `invalid-dynamics-missing-driver`
* `invalid-dynamics-missing-output`
* `invalid-dynamics-cycle`
* `invalid-dynamics-output-target-duplicate`
* `rights-provenance-missing`

目的:

* 期待されるdiagnosticが確実に出ること。
* blocking / error / warning / needs_review の分類が正しいこと。

期待アウトプット:

* `validation-report.json`
* `expected-diagnostics.json`
* `repair-candidates.json` がある場合はそれも。

---

## 4.3 Dynamics fixture

Dynamicsは時間依存なので、専用カテゴリにするべきです。

代表:

* `minimal-dynamics-hairSway`
* `dynamics-output-range-clamp`
* `dynamics-reset-determinism`
* `dynamics-fixed-step-replay`
* `invalid-dynamics-cycle`
* `invalid-dynamics-output-target-duplicate`

期待アウトプット:

* `dynamics-input-sequence.json`
* `runtime/states/initial.runtime-state.json`
* `runtime/state-sequences/expected.runtime-state-sequence.json`
* `expected-computed-parameters.json`
* `expected-snapshots.json`
* `expected-dynamics-diff.json`
* `validation-report.json`

`runtime/state-sequences/expected.runtime-state-sequence.json` は `states[0]` をinitial `RuntimeStateDto`、`states[i + 1]` をframe `i` 評価後のstateとして保持する。`states.length = frameCount + 1` を満たさない場合は `runtime.stateSequenceLengthMismatch` として扱う。

特に `minimal-dynamics-hairSway` は、MVPの代表fixtureにするべきです。

---

## 4.4 GUI evidence fixture

GUI制作入口がMVP必須なので、GUI証拠用fixtureが必要です。

代表:

* `tutorial-like-authoring`
* `gui-hit-test-rigControl`
* `gui-dynamics-panel-authoring`
* `gui-mask-setup`
* `gui-keyform-grid-authoring`

期待アウトプット:

* `gui-evidence.json`
* `operation-log.json`
* `screen-state-sequence.json`
* `hit-test-results.json`
* `selection-state.json`
* `panel-state.json`

重要なのは、**スクリーンショットだけを証拠にしないこと**です。
GUIテストの証拠は、安定IDを持つsemantic stateで残すべきです。

---

## 4.5 AI fixture

AI assistant用fixtureです。

代表:

* `ai-invalid-mutation`
* `ai-repair-dry-run`
* `out-of-range-parameter-dry-run`
* `ai-screenshot-rigControl-parameter`

期待アウトプット:

* `ai-command-request.json`
* `ai-command-response.json`
* `dry-run-operation-log.json`
* `model-diff.json`
* `runtime-diff.json`
* `validation-diff.json`
* `approval-required.json`
* `no-commit-proof.json`

ここでは、「AIが賢いか」ではなく、**AIが安全な境界内で操作しているか**をテストします。

---

## 4.6 Demo-safe fixture

配信デモ安全性のためのfixtureです。

代表:

* `demo-safe-dynamics-capture`
* `demo-safe-viewer-capture`
* `demo-unsafe-internal-name`
* `demo-unsafe-cubism-term`

期待アウトプット:

* `demo-preflight-report.json`
* `allowed-capture-state.json`
* `redacted-fields.json`
* `unsafe-term-diagnostics.json`

検査対象:

* `.moc3`
* `.cmo3`
* `model3.json`
* `physics3.json`
* `Cubism Physics`
* `Live2D互換`
* `Cubism互換`
* `Glue`
* `ArtMesh`
* `Deformer`
* 内部solver詳細
* source file path
* schema詳細
* third-party素材情報

---

# 5. Expected Artifact設計

テスト設計では、各テストが何を出すかを固定する必要があります。

作るアウトプット:

* `expected-artifacts-policy.md`
* `expected-artifacts-manifest.json`

主要artifact:

## 5.1 Operation Log

GUI / AI / import / validator repairが行った操作列です。

用途:

* GUI制作入口を証明する。
* AI dry-runが直接packageを壊していないことを証明する。
* undo / redo / commit境界を検証する。

最低限のフィールド:

* operationId
* actor
* surface
* operationKind
* targetId
* payload
* dryRun
* timestamp
* packageRevisionBefore
* packageRevisionAfter
* relatedAC
* relatedScenario

---

## 5.2 Runtime Snapshot

runtime評価結果です。

用途:

* Viewer表示が非空であること。
* parameter / keyform / rigControl / mask / draw order / Dynamicsが評価されたこと。
* Editor previewとViewerの一致を検証する。

snapshot種類:

* summary
* targeted
* full

Dynamics復帰後は、snapshotに次を入れる必要があります。

* authoredParameterValues
* computedParameterValues
* effectiveParameterValues
* dynamicsGroup state
* dynamics output
* tick
* resetCounter
* fixedStepMs
* diagnostics

---

## 5.3 Runtime State

Dynamicsのためのstateです。

用途:

* hidden mutable stateを避ける。
* deterministic replayを検証する。
* `evaluateRuntimeFrame` の previous / next state を比較する。

成果物:

* `runtime/states/initial.runtime-state.json`
* `runtime/states/expected-next.runtime-state.json`
* `runtime/state-sequences/expected.runtime-state-sequence.json`

sequence artifactでは、`states[0]` がinitial state、`states[i + 1]` がpost-frame stateである。Exact deterministic replayでは `packageHash`、`inputFramesHash`、`runtimeEvaluationContext`、`evaluatorVersionSummary`、`fixedStepMs`、`frameCount`、`states.length`、全 `states[i]` のepsilon内一致、`runtime.stateSequenceLengthMismatch` がないことを確認する。final stateのみを見る場合はsmoke testであり、exact deterministic replay evidenceではない。

---

## 5.4 Validation Report

validator出力です。

用途:

* AC-MVP-013の証拠。
* AI assistantが読み取れる構造化report。
* acceptance runnerの判定材料。

必要項目:

* reportId
* profile
* packageId
* packageHash
* summary
* checks[]
* severity
* status
* targetKind
* targetId
* evidence
* relatedAC
* relatedScenario
* repairCandidateIds
* snapshotIds
* operationIds

---

## 5.5 Diff

AI / dry-run / repair / runtime比較に必要です。

種類:

* model diff
* runtime diff
* validation diff
* dynamics diff
* GUI state diff

Dynamics復帰後は、`dynamicsChanges` を明示的に持つべきです。

---

## 5.6 GUI Evidence

GUIを必須制作入口とするための証拠です。

内容:

* screenId
* panelState
* selectedObjectIds
* visiblePanels
* activeTool
* hitTestResult
* operationTriggered
* semanticTargetId
* testId
* captureAllowed flag

これはスクリーンショットより重要です。
スクリーンショットは補助証拠に留めるのがよいです。

---

## 5.7 Demo-safe Preflight Report

配信安全性の検査結果です。

内容:

* allowedToCapture
* unsafeTerms
* hiddenFields
* redactedFields
* rightsStatus
* thirdPartyAssetDetected
* cubismFormatDetected
* internalSchemaVisible
* solverDetailsVisible
* recommendedDisclaimer

---

# 6. Dynamicsテスト設計で考えること

DynamicsはMVP内で最もテスト設計が難しい部分です。
テスト設計フェーズでは、ここをかなり明確にしておくべきです。

## 6.1 Dynamics test policy

作るアウトプット:

* `dynamics-test-policy.md`

内容:

* fixed timestepを使う。
* Runtimeはprevious stateを受け取りnext stateを返す。
* 同じinitial state / input sequence / fixedStepMsなら同じ出力になる。
* variable deltaTimeを直接solverに渡さない。
* acceptanceではsequence単位で検証する。
* image比較ではなくcomputed output sequenceとsnapshotで検証する。

---

## 6.2 Dynamics input sequence

作るアウトプット:

* `dynamics-input-sequences.json`

例:

* `faceYaw-step-0-to-1`
* `faceYaw-sine-small`
* `bodyAngle-step-reset`
* `large-input-jump-reset`
* `demo-capture-start-reset`

各sequence:

* frameIndex
* deltaTimeMs
* authoredParameterValues
* resetDynamics
* resetReason

---

## 6.3 Dynamics expected sequence

作るアウトプット:

* `expected-dynamics-output-sequences.json`

内容:

* frameIndex
* computed output parameter
* position
* velocity
* tick
* resetCounter
* diagnostics

例:

* `hairSway` が遅れて追従する。
* clamp時に `dynamics.outputClamped` が出る。
* reset後にpositionがtargetへ初期化される。
* 同じsequenceを再実行すると同じhashになる。

---

## 6.4 Dynamics oracle

DynamicsのoracleはCubismではありません。
runtime contractで固定した `scalarDampedFollowV1` の式です。

作るアウトプット:

* `scalarDampedFollowV1-oracle.md`
* 可能なら `scalarDampedFollowV1-reference.ts`

内容:

* driver weighted sum
* output scale / offset
* stiffness / damping
* maxVelocity
* maxAmplitude
* output clamp
* parameter clamp
* reset behavior
* fixed timestep
* epsilon policy

---

# 7. Visual Review設計

このプロジェクトでは、見た目は重要です。
ただし、初期MVPで「見た目がかわいいか」を完全自動判定するのは現実的ではありません。

なので、visual reviewは手動・半自動に分けるべきです。

作るアウトプット:

* `visual-review-policy.md`
* `visual-review-checklist.md`
* `capture-set-manifest.json`

自動検査するもの:

* draw listが空でない。
* boundsがNaNでない。
* vertex hashが決定的。
* visibility / opacity / draw orderがsnapshotと一致。
* representative captureが生成できる。
* demo-safeである。

人間が見るもの:

* 顔向きが破綻していない。
* まばたきが不自然すぎない。
* 口開閉が意図通り。
* 髪揺れが見た目として意味を持つ。
* maskやdraw orderの破綻がない。
* 配信で見せられる程度の見た目か。

判定:

* pass
* needs_review
* fail

ただし、human visual reviewはMVP blockingにしすぎない方がよいです。
最初は `needs_review` を許容する運用が現実的です。

---

# 8. Acceptance Runner設計

今の設計では、Validatorより上にAcceptance Runnerが必要です。

作るアウトプット:

* `acceptance-runner-design.md`
* `acceptance-runner-result-schema.json`
* `acceptance-profiles.md`

Acceptance Runnerの役割:

* AC / Scenario / Fixture / Testをつなぐ。
* operation logを読む。
* GUI evidenceを読む。
* packageをvalidatorにかける。
* runtime snapshotを取る。
* dynamics sequenceを評価する。
* AI dry-run結果を読む。
* demo-safe preflightを実行する。
* 最終的にAC単位でpass / fail / needs_reviewを出す。

Validatorとの違い:

| 層                 | 役割                        |
| ----------------- | ------------------------- |
| Validator         | packageやruntimeの構造的不整合を検出 |
| Acceptance Runner | AC達成証拠を集約してMVP判定する        |

Acceptance Runner resultに必要なフィールド:

* acId
* scenarioId
* testId
* fixtureId
* status
* blockingFailures
* warnings
* evidenceArtifacts
* missingEvidence
* manualReviewRequired
* notes

---

# 9. Test Profiles

テストプロファイルを分けるべきです。

作るアウトプット:

* `test-profiles.md`

推奨profile:

## 9.1 `dev-fast`

目的:

* 開発中の高速確認。

実行:

* schema
* unit
* selected contract tests
* small runtime snapshot

## 9.2 `contract`

目的:

* module間のDTO / API互換確認。

実行:

* package schema
* operation schema
* runtime API
* validator report schema
* AI command schema

## 9.3 `mvp-acceptance`

目的:

* MVP達成判定。

実行:

* major fixtures
* GUI evidence
* runtime snapshot
* dynamics sequence
* validator report
* AI dry-run
* demo-safe preflight

## 9.4 `strict-determinism`

目的:

* runtime / dynamicsの決定性確認。

実行:

* repeated runtime sequence
* same state / same input replay
* hash comparison
* epsilon policy

## 9.5 `demo-safe`

目的:

* 配信前確認。

実行:

* unsafe term scan
* rights metadata
* capture surface filtering
* internal schema redaction
* Cubism-related forbidden strings

## 9.6 `proposal-package`

目的:

* Live2D提案資料に出す素材確認。

実行:

* non-affiliation wording
* no compatibility claim
* no internal code/schema exposure
* demo videos/screenshots reviewed

---

# 10. Guardrailテスト

今のプロジェクトでは、機能テストと同じくらいguardrailテストが重要です。

作るアウトプット:

* `guardrail-tests.md`
* `forbidden-surface-scan-rules.json`

検査対象:

* package files
* UI labels
* operation logs
* demo capture state
* documentation
* fixture metadata
* test data

禁止・警告語彙:

* `.moc3`
* `.cmo3`
* `model3.json`
* `physics3.json`
* `motion3.json`
* `pose3.json`
* `Cubism SDK`
* `Cubism Core`
* `Cubism Physics`
* `Live2D互換`
* `Cubism互換`
* `Glue`
* `ArtMesh`
* `Deformer`
* `Live2D代替`
* `Cubism replacement`

注意点:

* 研究レポート内には出現してよい。
* public/demo surface、fixture、UI、operation logには出さない。
* テストは「出現箇所のsurface」を見て判断する。

---

# 11. GUIテストで考えるべきこと

GUIはMVP必須なので、テスト設計で後回しにしない方がよいです。

作るアウトプット:

* `gui-test-design.md`
* `gui-evidence-schema.md`
* `stable-test-id-policy.md`

GUIテストで確認するもの:

* PSD import flow
* split PNG fallback flow
* drawable selection
* part lock / hide / select
* mesh edit
* keyform edit
* parameter slider
* parameter-grid-2d edit
* rigControl creation
* Dynamics panel creation
* mask relation creation
* save / reload
* preview
* validator panel
* AI assistant panel
* demo-safe capture mode

GUIテストの原則:

* pixel座標に依存しすぎない。
* semantic hit-testを使う。
* stable test IDを使う。
* operation coreに正しいoperationが渡ったことを証明する。
* GUI表示だけでなく、operation logとmodel diffを確認する。

---

# 12. AI Assistantテストで考えるべきこと

AIは「便利さ」より「境界内で安全に操作すること」をテストします。

作るアウトプット:

* `ai-assistant-test-design.md`
* `ai-command-transcript-schema.md`
* `ai-safety-boundary-tests.md`

テスト項目:

* AIがmodel structureをinspectできる。
* AIがvalidation reportを読める。
* AIがdry-run operationを返す。
* dry-runがpackageを直接変更しない。
* commitにはhuman approvalが必要。
* AIがdiffを返す。
* AIがrepair suggestionにprovenanceを付ける。
* AIがCubismモデル変換やauto-riggingを提案しない。
* AIが画像からcomplete rigを自動生成しない。
* AIがcomputedDynamics / rigControl / keyformを正しいoperation境界で扱う。

---

# 13. Rights / Provenanceテスト

配信デモや提案資料に直結するので重要です。

作るアウトプット:

* `rights-provenance-test-design.md`
* `asset-provenance-fixture-policy.md`

検査項目:

* source assetにauthorがある。
* licenseがある。
* displayAllowedがある。
* redistributionAllowedがある。
* AI生成・AI編集の有無がある。
* source assetからtexture / drawable / packageまで追跡できる。
* blocked rights素材がdemo-safe captureに出ない。
* third-party Live2D modelが使われていない。
* Cubism sample由来でない。

---

# 14. Golden Output更新ルール

snapshotやvalidation reportをgoldenにする場合、更新ルールが必要です。

作るアウトプット:

* `golden-update-policy.md`

決めること:

* どのartifactがgoldenか。
* golden更新時に誰が承認するか。
* runtime式変更時の再生成手順。
* Dynamics oracle変更時の再生成手順。
* GUI evidenceの更新条件。
* expected diagnostics変更時のレビュー条件。
* visual captureはgoldenにするか参考扱いにするか。

おすすめ:

* JSON snapshot / validation report / dynamics sequence はgolden。
* Screenshotは参考artifact。MVP初期ではpixel-perfect goldenにしない。
* Dynamics expected sequenceは、固定式から生成したreference outputをgoldenにする。

---

# 15. Epsilon / Determinism Policy

RuntimeとDynamicsには必須です。

作るアウトプット:

* `epsilon-determinism-policy.md`

決めること:

* 浮動小数比較のepsilon。
* vertex position比較のepsilon。
* computed parameter比較のepsilon。
* Dynamics position / velocity比較のepsilon。
* snapshot hash対象。
* hash対象から除外するもの。
* timestampやoperationIdなど非決定要素の扱い。
* repeated runの回数。
* same input sequenceの比較方法。

おすすめ:

* structural snapshot比較を主にする。
* 浮動小数はepsilon比較。
* `createdAt` などはhash対象から外す。
* Dynamicsはsame initial state / same input sequence / same fixedStepMsで完全一致またはepsilon一致を要求する。

---

# 16. テスト設計フェーズの最終成果物セット

最終的には、以下のようなセットを作るとよいです。

```text
tests/
  strategy/
    test-strategy.md
    test-taxonomy.md
    test-profiles.md
    golden-update-policy.md
    epsilon-determinism-policy.md

  traceability/
    test-traceability-matrix.md
    test-traceability-matrix.json

  fixtures/
    fixture-manifest.md
    fixture-manifest.json
    minimal-valid-package/
    psd-import-happy-path/
    manual-face-grid-2d/
    minimal-dynamics-hairSway/
    invalid-dynamics-cycle/
    demo-safe-dynamics-capture/

  expected/
    validation-reports/
    runtime-snapshots/
    runtime-states/
    dynamics-sequences/
    diffs/
    gui-evidence/
    demo-preflight/

  runners/
    acceptance-runner-design.md
    validator-profile-design.md
    dynamics-sequence-runner-design.md
    gui-evidence-runner-design.md

  policies/
    visual-review-policy.md
    guardrail-tests.md
    rights-provenance-test-design.md
    ai-assistant-test-design.md
    streaming-demo-test-policy.md
```

---

# 17. 優先順位

テスト設計を全部一気にやると重いので、優先順位をつけるならこうです。

## P0: 最初に作る

1. `test-strategy.md`
2. `test-taxonomy.md`
3. `test-traceability-matrix.md`
4. `fixture-manifest.json`
5. `expected-artifacts-policy.md`
6. `dynamics-test-policy.md`
7. `acceptance-runner-design.md`

## P1: 実装直前までに作る

8. `epsilon-determinism-policy.md`
9. `golden-update-policy.md`
10. `gui-evidence-schema.md`
11. `validator-profile-design.md`
12. `ai-assistant-test-design.md`
13. `demo-safe-test-policy.md`
14. `rights-provenance-test-design.md`

## P2: 初回実装後でもよい

15. `visual-review-checklist.md`
16. `proposal-package-test-policy.md`
17. performance smoke test方針
18. long-run stability test方針

---

# 18. 私の推奨する最初の一手

まずは、次の1ファイルを作るのがよいです。

**`tests/strategy/test-design-overview.md`**

そこに次を入れます。

1. テストの目的。
2. テスト分類。
3. MVP blocking testの定義。
4. fixture一覧。
5. expected artifact一覧。
6. AC / Scenario / Testのtraceability方針。
7. Dynamics deterministic sequence test方針。
8. GUI evidence方針。
9. AI dry-run test方針。
10. Demo-safe preflight方針。

その後、`fixture-manifest.json` と `test-traceability-matrix.md` に展開するのが一番自然です。

---

# 19. まとめ

今の設計でテスト設計フェーズに必要なのは、単なるテストケース作成ではありません。

必要なのは、次の対応関係を固定することです。

```text
AC / Scenario
  ↓
Test Case
  ↓
Fixture
  ↓
Operation Flow
  ↓
Expected Package / Snapshot / Report / Diff / Evidence
  ↓
Acceptance Runner Result
```

特に重要なのはこの5つです。

1. **Traceability**
   どのテストがどのACを証明するか。

2. **Fixture**
   何を入力データとして使うか。

3. **Expected Artifacts**
   何が出れば成功と言えるか。

4. **Dynamics Determinism**
   時間依存の揺れをどう再現可能に検証するか。

5. **GUI / AI / Demo-safe Evidence**
   「手元用のGUI制作環境」「AI補助」「配信で見せる範囲」をどう証明するか。

この5つを先に設計すれば、実装フェーズで「これはMVPを満たしているのか？」という判断がかなり楽になります。
