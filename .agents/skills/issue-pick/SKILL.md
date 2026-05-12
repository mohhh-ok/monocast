---
name: issue-pick
description: >-
  GitHub の open Issue 一覧を提示してユーザーに 1 件選んでもらい、その Issue の
  全文（title・labels・assignees・body・comments・URL）を会話に展開するスキル。
  「Issue を選んで」「Issue を読み込んで」「あの件やろう」「issue 一覧から」
  「未対応の issue を直す」「issue から始める」「/issue-pick」などの文脈で
  自動適用する。番号引数（/issue-pick 12）や絞り込み引数（mine / high / fix
  など）にも対応。**このスキルは Issue の内容を読み込むだけ** で、assign /
  ブランチ作成 / 実装 / PR 作成は一切しない。
---

# issue-pick — GitHub Issue をチャットに展開する skill

このスキルの責務は **Issue の内容をチャットに流し込むこと、それだけ**。実装・assign・ブランチ作成・PR 作成には踏み込まない。展開後、ユーザーが自然に次のアクション（実装に進む / 議論する / 別 Issue を見る）を選べるよう待つ。

## 使うべきタイミング

- ユーザーが `/issue-pick` と打った（引数有り無し両方）
- 「Issue 選んで」「Issue 読み込んで」「あの件やろう」「未対応の Issue 直したい」「Issue 一覧出して」のように、既存 Issue を会話の起点にしたい意図を示した
- ユーザーが Issue 番号を直接指示した（`/issue-pick 12` や 「#12 を見て」）

## 使ってはいけないタイミング

- 新規 Issue を起票したい → **`issue-create` skill** を使う
- Issue から実装まで進めたい → このスキルで Issue を展開した後、**`/feature-dev:feature-dev`** などを使う

## 前提チェックはしない

`gh auth status` / `gh repo view` の事前チェックは行わない。`gh issue list` / `gh issue view` が失敗した場合のみ stderr を見てユーザーに案内する（後述「エラー時の対応」）。

リポジトリは `gh` のデフォルト（カレント）を使う。別リポジトリを対象にしたいとユーザーが言った場合のみ `--repo owner/name` を付ける。

## フロー

### Step 1: Issue 一覧の取得

ユーザーが番号引数を **指定していない** 場合のみ実行。番号指定済みなら Step 3 へ直行する。

```bash
gh issue list \
  --state open \
  --limit 50 \
  --json number,title,labels,assignees,updatedAt
```

#### フィルタ引数（任意）

| 入力 | 適用するフィルタ |
|---|---|
| `/issue-pick mine` | `--assignee @me` を追加 |
| `/issue-pick high` | `--label "priority:high"` を追加 |
| `/issue-pick fix` / `feat` / `chore` / `refactor` / `docs` | `--label "type:<x>"` を追加 |
| `/issue-pick <番号>` | 一覧スキップで Step 3 直行 |

複数のフィルタ語を組み合わせても良い（例: `/issue-pick mine high`）。フィルタ引数で 0 件になった場合は **フィルタを外して再検索はしない**（押し付けにならないよう、ユーザーの判断に委ねる）。

closed Issue を見たい場合はユーザーに `--state all` を使うか確認してから実行する。

### Step 2: 並び替えて提示

取得した結果を **以下の優先順位でソート** してから番号を振る。

1. 第 1 キー: priority ラベル `high` → `mid` → `low` → **未設定** の順（ラベル運用が無いリポジトリでは全件「未設定」になる）
2. 第 2 キー: `updatedAt` の降順（最近更新された順）

priority ラベルが運用されているリポジトリでは **グループ見出しを入れて表示**、運用が無いリポジトリでは更新日順のフラットなリストにする。各グループ内で **連番は通し番号** にする（後段で番号選択を受け取るため）。

**重要**: `gh` の出力（ツール結果）はユーザーに見えないことがある。取得した一覧を必ず **自分のメッセージ本文に Markdown 箇条書きで書き出して** ユーザーに提示すること。`gh` を実行しただけで番号を聞いてはいけない。

#### 表示例（priority ラベル運用あり）

```
どの Issue を展開しますか？番号を入力してください。

■ priority:high
1. #10 [type:fix] 期限超過判定が JST でズレる (1 day ago)
2. #7  [type:feat] 通知の重複配信を直す (3 days ago)

■ priority:mid
3. #12 [type:chore] docker-compose でローカル環境を整備 (assigned: @user) (1 day ago)
4. #11 [type:feat] 通知設定のオプトアウト UI を追加 (2 days ago)

■ priority:low
5. #9 [type:docs] DEVELOPMENT.md のセットアップ節を更新 (5 days ago)

■ priority 未設定
6. #5 [type:chore] CI の paths-ignore に画像を追加 (1 week ago)
```

#### 表示例（ラベル運用なし）

```
どの Issue を展開しますか？番号を入力してください。

1. #149 アップロードファイルのサイズ制限を入れる (1 day ago)
2. #148 動画クリップ統合 Phase 4: 並び替え対応 [bug] (1 day ago)
3. #147 設定画面のレイアウト修正 (3 days ago)
```

#### 表示ルール

- ラベルは `type:*` を抜粋（その他汎用ラベルがあれば `[label]` 形式で含めてよい。`priority:*` はグループ見出しで分かるので **行内では type だけ** 出す）
- `updatedAt` は `(N day(s) ago)` の形で末尾に付ける
- assignee は **誰かが割り当てられているときだけ** `(assigned: @user)` を表示。空なら省略
- グループ内に Issue が 0 件のときは、その見出しごと省略
- Issue 全体が 0 件の場合: 「条件に合う open な Issue がありません。」と返して終了

#### 番号入力の受け付け

提示の末尾で「対応する Issue の番号を入力してください（複数なら半角スペース区切り）」と短く聞く。複数番号を許す。`#` プレフィックスは無視する（`#3` でも `3` でも受け付ける）。

### Step 3: Issue 全文の取得と展開

ユーザーが番号を入力したら（または引数指定済みなら）、その Issue を取得。

```bash
gh issue view <番号> --json number,title,body,labels,assignees,comments,url
```

複数番号を選ばれた場合は **1 件ずつ順番に展開** する。

取得結果を **以下のフォーマットでチャットに展開** する。

```markdown
# Issue #<番号>: <タイトル>

- **URL**: <html_url>
- **Labels**: <label1>, <label2>  ← 空なら省略
- **Assignees**: <user1>, <user2>  ← 空なら "なし"

---

## 本文

<body そのまま>

---

## コメント (<件数>)

### @<author> (<created_at の日付部分>)

<comment body>

### @<author> (<created_at の日付部分>)

<comment body>
```

- 本文・コメントは **改変せずそのまま** 展開する（要約・整形しない）
- 外部 URL や大量のスタックトレースが含まれていても、推測で省略しない
- コメントが 0 件のときは「コメント」セクションごと省略
- 改行・コードブロック・チェックボックスはそのまま保持

### Step 4: 軽い要約と次の一歩を案内

展開の最後に、以下を **短く** 添える。

1. **要点を 2〜4 行で要約**（本文・コメントを踏まえて）
2. **次の一歩の選択肢を 1 行**（押し付けない）

```
次にどうしますか？（実装に進む / 議論する / 別の Issue を見る）
```

複数 Issue を選んだ場合は、まとめて 1 つの作業ブランチで対応するか分けるかをユーザーに確認してよい。

ここで終了。**skill は能動的に次のステップに進まない**。ユーザーが何を言うかを待つ。

なお、選んだ Issue 番号は会話の文脈として覚えておき、以降の作業でコミット末尾や PR 本文に `Closes #<番号>` を付けられるようにする。

## エラー時の対応

- **`gh: command not found`** → `gh` のインストール（`brew install gh` など）を案内して終了
- **認証エラー** → `gh auth login` を案内して終了
- **`repository not found`** → リポジトリ指定の打ち直しを促して終了
- **その他の失敗** → stderr をそのまま提示してユーザーの判断を仰ぐ

## 守るべきこと

- 事前チェック (`gh auth status` / `gh repo view`) は **しない**
- Issue 本文・コメントは **要約しない**。原文ママで展開する（最後の「要点を 2〜4 行で要約」は別建ての追加情報）
- このスキルから **Issue を編集しない / assign しない / ブランチを切らない / PR を作らない**。すべて責務外
- 番号選択を待つステップで、ユーザーが「やっぱやめる」「キャンセル」と言ったら何もせず終了
- フィルタ引数で 0 件になった場合は **フィルタを外して再検索はしない**

## やらないこと

- Issue の作成 / 編集 / クローズ
- assignee の追加・削除
- ブランチ作成・切り替え
- PR 作成・コメント投稿
- 実装計画の立案やコード生成（`/feature-dev:feature-dev` の責務）
