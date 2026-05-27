# シナリオ: Animation and Timeline Production

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/210_Animation_and_Timeline_Production.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/210_Animation_and_Timeline_Production.md)
> Status: Optional / out of current MVP.

## 0. 目的

Animation timelineは現在MVPの成功条件ではない。将来扱う場合に、project-defined motion dataとしてprivate runtimeで検証する境界だけを記録する。

## SC-ANIM-001: timeline機能をMVP外として分類できる

### Given

- ユーザーがtimeline editor、motion export、production animation workflowを要望している。

### When

1. ReviewerがMVP ACとこのscenarioを確認する。
2. Reviewerがauthoring-to-viewerに必須かどうかを分類する。

### Then

- Timeline editorとmotion exportはOptional / Futureとして扱われる。
- Current MVPはparameter/keyformとprivate viewer確認までを優先する。

### 検証するAC

- AC-ANIM-001
- AC-ANIM-002
- AC-ANIM-003
- AC-ANIM-004
- AC-ANIM-005

## SC-ANIM-002: 将来motion dataをproject-defined構造として検討できる

### Given

- Future設計でsimple idle motionを検討する。

### When

1. Designerがparameter keyframe列をproject-defined motion dataとして定義する。
2. Private runtime coreで再生可能か検証する。

### Then

- 外部motion形式互換ではなくproject-defined motion dataとして扱う。
- Demo-safeに出す場合は内部構造を見せない。

### 検証するAC

- AC-ANIM-004
- AC-ANIM-005
