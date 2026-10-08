---
name: align-user-gate
description: "大きな作業をコンテキスト分割・サブエージェント委譲する前に、最終的なユーザー体験と合格判断をユーザーとrootの間で言語化・合意し、変更不可のUser Gateとして後続計画と委譲promptへ継承する。ユーザーの操作・観察・受領・判断を伴う実装、調査、設計、比較検討で使う。単純なバグ修正、内部リファクタ、機械的に正解が確定する小作業には使わない。"
---

# Align User Gate

大きな作業のhowを考える前に、その作業が最終的にユーザーへ何を体験させ、何をもって合格とするのかを相互確認する。

これは最終User Gateの実行ではない。User Gateを成立させ、後続作業の正解として固定するためのメタGateである。

## Core boundary

- 計画、設計文書、実装、調査、委譲を開始する前に使う。
- rootが理解したユーザー体験を先に言語化し、ユーザーが検算できる状態にする。
- ユーザーとの往復が閉じるまで、計画や成果物へ進まない。
- 実装方法、内部work package、テスト構成をこの報告へ混ぜない。
- 再現性、網羅性、診断容易性などの代理指標を、説明と合意なくUser Gateへ追加しない。
- AIが正しさを判定できない自然さ、美しさ、身体感覚、使い心地は、ユーザーをauthorityとして明示する。

## Gate authority

Accepted User Gateは、完成候補を受け取ったuserが実行し、体験の合否を判断するためのGateである。

これは計画担当、Orch-Sylph、Gnome、Review-Sylphの内部completion gate／review gateではない。

後続agentは次の目的にだけ参照できる。

- 作る候補の目的とscopeを理解する。
- userへ渡す操作・観察対象を欠落させない。
- 裁量追加が元の体験から逸脱していないか判断する。
- Gateをuserへ渡せない事実が判明した場合にescalateする。

後続agentは次を行ってはならない。

- User Gateの合否を代行する。
- User Gateを自動testやreview項目へ一対一変換する。
- 内部品質基準をUser Gateへ追加する。
- source／test／reviewのPassをUser GateのPassとして報告する。

内部completionとreviewの基準はUser Gateとは別に、候補をuserへ安全に渡せるための比例的なmechanical criteriaとして計画側が定義する。

## Alignment workflow

### 1. Restate the final experience

ユーザーの依頼から、作業完了後の体験を次の5項目で返す。

```markdown
## あなたが受け取るもの／行うこと

- ...

## あなたが判断すること

- ...

## あなたが判断しないこと

- ...

## 合格条件

- ...

## 違和感や不足があった場合のフィードバック

- ...
```

操作のない調査・設計作業では、「受け取るもの」を中心に書く。ソフトウェア操作がある場合は、ユーザーが実際に行う手順を具体的に書く。

### 2. Expose uncertainty

5項目を埋めるためにユーザー判断が必要なら、推測で補わず質問する。

特に次を暗黙に決めない。

- ユーザーが何を見るか、何を操作するか
- 誰が自然さ・正しさ・十分さを判断するか
- 何を比較対象とするか
- どの結果を合格とするか
- 何を今回の判断対象から外すか

### 3. Iterate until accepted

ユーザーの訂正を受けたら5項目を更新し、再び全文を返す。部分的な「OK」を全体承認へ拡大解釈しない。

ユーザーがUser Gate全体を受け入れるまで、計画・委譲・成果物作成へ進まない。

### 4. Freeze the accepted gate

合意後、5項目を次の固定ブロックとして扱う。

```markdown
## Accepted User Gate

### あなたが受け取るもの／行うこと
...

### あなたが判断すること
...

### あなたが判断しないこと
...

### 合格条件
...

### 違和感や不足があった場合のフィードバック
...
```

- 短い作業では、後続計画へブロック全文を埋め込む。
- 長い作業では、focused artifactへ保存してもよい。ただし計画と全委譲promptから同じauthorityを参照する。
- Orch-Sylphなどへの委譲promptには、要約せずブロック全文を渡す。
- 計画・委譲promptへ全文を渡す目的は、agentにGateを実行させるためではなく、userへ渡す最終体験をコンテキスト分割後も保持するためである。
- 言い換え、代理目的への変換、追加のUser Gateへの置換を禁止する。

## Downstream change control

計画担当、Orch-Sylph、Gnome、Review-SylphにAccepted User Gateの変更権限はない。

作業中にGateを満たせない、別の体験が必要、新しい判断項目が必要と判明した場合は、implementation-orchestration等のescalationとしてrootへ返す。

報告には次だけを含める。

- Accepted User Gateのどの項目を満たせないか
- なぜ満たせないか
- 何を変更する必要があると考えているか

移譲先はGateを修正せず、ユーザーとrootが再度alignmentを行うまで停止する。

## Scope test for downstream work

後続計画の各ユーザー向け操作・判断・成果物は、Accepted User Gateのいずれかへ直接対応しなければならない。

対応を説明できないものは、次のどちらかである。

- 内部mechanicsとしてUser Gateへ露出させず実施できる
- 要求拡大なので、実施前にescalationが必要

内部mechanicsをUser Gateへ昇格させない。自動テストのPassを、ユーザーが判断する自然さや品質の代替にしない。

## Do not use for

- 挙動と完了条件が明白な小さなバグ修正
- ユーザー体験を変えない内部リファクタ
- 正解を機械的に判定できる小作業
- 既にAccepted User Gateが存在し、その内容を変えずに行う限定follow-up

ただしfollow-upがユーザー操作・判断・合格条件を変えるなら、再度このスキルを使う。
