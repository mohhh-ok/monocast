# monocast — ひとり用ききながしラジオ

Claude Haiku 4.5 もしくはローカル LLM (Ollama) で台本を書き、VOICEVOX で音声化する、ローカル完結・自分専用のニュースききながしラジオ。音楽は流さず、情報のトーク主体。私的使用の範囲で動かす前提（公衆送信はしない）。

```
RSS (NHK / はてブ Tech) → LLM で台本 → VOICEVOX で合成 → ブラウザでキュー再生
                                                       ↑
                              キューが減ると自動補充
```

## 設計方針 — なぜ 1 人ナレーション・音楽なしなのか

最近の NotebookLM / podcastfy 系の「2 人ホストが軽妙に掛け合う」スタイルは初聴のインパクトはあるが、長時間流すと次のような違和感が指摘されている。

- 同じ相槌（"Deep Dive" / "Hmm, that's interesting" / "I'm intrigued" など）が定型化して耳につく
- ずっと同じ 2 人の声と話法が脳に居座って疲れる（Reddit でよく語られる「最初の 1 週間は良いが、ずっと同じ 2 人だと気づくと耐えられなくなる」現象）
- 過剰に「自然」を狙った相槌や笑いが逆に uncanny に感じる
- 新規 podcast の約 39% が AI 生成と推定され、英語圏では "podslop" と揶揄され始めている

monocast はこの「うざさ」を意図的に避ける方向で作られている。

- **1 人ナレーション**。掛け合い・相槌・笑い・キャラ立て全部なし。
- **定型フレーズに頼らない** system プロンプト（"Deep Dive" 的な決まり文句を出さない）
- **音楽 / BGM / ジングルなし**。淡々と読むだけ。
- 話題の切り替わりに約 0.9 秒の無音を挟むだけで、感情演出はしない
- **流しっぱなしでも疲れない作業 BGM 的なききながし**が目標

参考:

- [Google's NotebookLM had to teach its AI podcast hosts not to act annoyed at humans — TechCrunch](https://techcrunch.com/2025/01/14/googles-notebooklm-had-to-teach-its-ai-podcast-hosts-not-to-act-annoyed-at-humans/)
- [I listened to 200 Notebook LM podcasts so you don't have to — Medium](https://medium.com/@bamby_media/i-listened-to-200-notebook-lm-podcasts-so-you-dont-have-to-d5b206911592)
- ['Podslop' is a real and growing problem — TechRadar](https://www.techradar.com/audio/podslop-is-a-real-and-growing-problem-data-shows-39-percent-of-new-podcasts-are-now-likely-generated-by-ai-heres-why-i-wont-be-listening)

## 必要なもの

- Node.js 20+
- ffmpeg (`brew install ffmpeg`)
- VOICEVOX エンジン (デフォルト `http://localhost:50021` で起動)
- Anthropic API キー **または** Ollama (ローカル LLM)

## セットアップ

```bash
npm install
cp .env.local.example .env.local
# .env.local を編集して LLM_PROVIDER と必要な設定を入れる
```

### LLM プロバイダ

`LLM_PROVIDER` で切替（既定 `anthropic`）。両プロバイダとも JSON Schema で `{title, body}` を構造化出力させているので、フォーマット崩れは起きない。

#### Anthropic (デフォルト)

`.env.local` に `ANTHROPIC_API_KEY` を入れるだけ。モデルは `ANTHROPIC_MODEL` で変更可（既定 `claude-haiku-4-5`）。

#### Ollama (ローカル、無料)

[Ollama](https://ollama.com/) をインストールしてモデルを落としておく:

```bash
brew install ollama
ollama serve &
ollama pull qwen2.5:7b-instruct     # 日本語＋構造化出力に強い既定モデル
# 余裕があれば qwen2.5:14b-instruct / gemma3:12b なども試す
```

`.env.local`:

```bash
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:7b-instruct
```

### 環境変数

| 変数 | デフォルト | 説明 |
| --- | --- | --- |
| `LLM_PROVIDER` | `anthropic` | `anthropic` か `ollama` |
| `ANTHROPIC_API_KEY` | (anthropic 時必須) | Claude API キー |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | Anthropic モデル ID |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama エンドポイント |
| `OLLAMA_MODEL` | `qwen2.5:7b-instruct` | Ollama モデル名 |
| `VOICEVOX_URL` | `http://localhost:50021` | VOICEVOX エンジン |
| `VOICEVOX_SPEAKER` | `2` (四国めたん ノーマル) | 話者 ID。`/speakers` で確認できる |

話者 ID の例:

```bash
curl -s http://localhost:50021/speakers | jq '.[] | {name, styles: [.styles[] | {name, id}]}'
```

## 起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開くと、最初の番組を自動生成して再生し始める。キューが 2 本未満になると裏で補充される。

## 仕様メモ

- 1 番組 = 5 件程度のニュースをまとめた 90〜180 秒の読み上げ
- 番組メタは `data/queue.json` に永続化
- 音声は `public/audio/*.mp3` に置かれ、再生終了時に削除される
- 1 リクエストにつき生成は 1 件ずつ (二重生成防止)

## ありそうな拡張

- 雑談コーナーや天気コーナーを追加して番組タイプを混ぜる
- スピーカーをコーナーごとに変えて複数 DJ 風に
- 番組履歴の保存 / お気に入り
- BGM の薄いミックス (ffmpeg で背景音楽を重ねる)
