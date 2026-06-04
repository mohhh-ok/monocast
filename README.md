# monocast — 聞き流し情報収集

作業しながら・移動しながら。情報を流しっぱなしで情報収集するためのツールです。LLM（ローカル or クラウド）で台本を書き、音声合成エンジン（選択可能）で読み上げます。

ローカル完結、自分専用。音楽は流さず、情報のトーク主体。私的使用の範囲で動かす前提です。

## Quick Start

```bash
pnpm install
cp .env.local.example .env.local           # 使うクラウド API のキーだけ入れる
docker compose --profile voicevox up -d    # TTS エンジンを起動（後述）
pnpm dev                                   # http://localhost:3000
```

ブラウザを開くと、自動生成が始まります。再生ボタンで開始してください。

キューが 2 本未満になると裏で補充されます。プロバイダ・モデル・話者などはトップ画面の PROFILE バーの「編集」から切り替えられます（プロファイル単位で保存）。出力言語と任意のニュアンス指示（例: 固有名詞は英語読みのまま）もこのダイアログから設定でき、選んだ言語に応じて TTS の voice 一覧が自動で絞り込まれます。PROFILE で「🎲 ランダム」を選ぶと、番組生成のたびに既存プロファイルから 1 つランダムに使われます（LLM・TTS・RSS は 1 本の番組内で混ざらない）。

## ヘッドレス再生（ブラウザなし）

ブラウザを開かず、ターミナルだけで再生し続けることもできます（macOS 専用・`afplay` を使用）。

```bash
pnpm play
```

ブラウザ版と同じく、キューが 2 本未満になると裏で番組を補充しながら、完成した番組をセグメント順に再生します。`n` で番組スキップ、`q` / Ctrl+C で終了します。プロファイルや各種設定はブラウザ版と同じ `data/` を共有するので、設定の変更は従来どおりトップ画面（`pnpm dev`）から行ってください。起動時に、合成途中で落ちて残った未完成番組は破棄されます。生成と再生は同一プロセスで並行に回るので、番組間はほぼ途切れません。

## 必要なもの

- Node.js 22+
- LLM プロバイダのいずれか
  - Anthropic API キー / OpenAI API キー / Google Gemini API キー
  - もしくは Ollama（ローカル LLM、無料）
- TTS エンジンのいずれか（Docker 推奨）
  - VOICEVOX / AivisSpeech（日本語特化、Docker 1 コマンドで起動）
  - Kokoro（多言語、Docker 1 コマンドで起動）
  - macOS の `say` コマンド（macOS のみ・追加インストール不要）
  - OpenAI TTS / ElevenLabs（API キーが必要）
- Docker / Docker Desktop（ローカル TTS を使う場合）

## セットアップ

`.env.local` で扱うのは **API キーとローカルエンジンの接続先 URL** です。プロバイダ切替・モデル・話者などの設定は **起動後にトップ画面の PROFILE バーの「編集」から** 開く設定ダイアログで行い、プロファイル単位で `data/profiles/<id>.json` に保存されます。

利用可能な環境変数（必要なものだけで構いません）:

| 変数 | 用途 |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude (LLM) を使うとき必須 |
| `OPENAI_API_KEY` | OpenAI の LLM・TTS を使うとき必須 |
| `GEMINI_API_KEY` | Gemini を使うとき必須 |
| `ELEVENLABS_API_KEY` | ElevenLabs を使うとき必須 |
| `OLLAMA_URL` | Ollama の接続先（既定 `http://localhost:11434`） |
| `VOICEVOX_URL` | VOICEVOX の接続先（既定 `http://localhost:50021`） |
| `AIVISSPEECH_URL` | AivisSpeech の接続先（既定 `http://localhost:10101`） |
| `KOKORO_URL` | Kokoro-FastAPI の接続先（既定 `http://localhost:8880`） |

接続先 URL はプロファイルではなく環境全体で 1 つです。Docker のポートを変えた場合やリモートホストで動かす場合だけ設定してください。

### LLM プロバイダ

| ID | デフォルトモデル | 備考 |
| --- | --- | --- |
| `anthropic` (既定) | `claude-haiku-4-5` | `ANTHROPIC_API_KEY` |
| `openai` | `gpt-4.1-nano` | `OPENAI_API_KEY` |
| `gemini` | `gemini-2.5-flash-lite` | `GEMINI_API_KEY` |
| `ollama` | `qwen2.5:3b-instruct` | `OLLAMA_URL`（既定 `http://localhost:11434`） |

いずれも JSON Schema で `{title, body}` を構造化出力させているのでフォーマット崩れは起きません。

Ollama を使う場合は同梱の `docker-compose.yml` で起動できます（インストール不要）:

```bash
docker compose --profile ollama up -d
docker compose exec ollama ollama pull qwen2.5:3b-instruct   # 既定（軽量・日本語OK）
# 余裕があれば qwen2.5:7b-instruct / qwen2.5:14b-instruct なども
```

macOS の Docker は GPU を使えず CPU 実行になるため、速度が欲しい場合はホスト直実行も選べます:

```bash
brew install ollama
ollama serve &
ollama pull qwen2.5:3b-instruct
```

設定画面から `LLM = Ollama` に切替・モデル名を変更してください。

### TTS エンジン

| ID | デフォルト | 備考 |
| --- | --- | --- |
| `voicevox` (既定) | 話者 `2`（四国めたん） | 日本語特化。Docker で起動。URL は `VOICEVOX_URL` |
| `aivisspeech` | — | VOICEVOX 互換 API。Docker で起動。URL は `AIVISSPEECH_URL` |
| `kokoro` | `af_heart` | 多言語（en/ja/zh ほか）。Docker で起動。URL は `KOKORO_URL` |
| `say` | システム既定の声 / 180wpm | macOS 内蔵、追加不要 |
| `openai` | `gpt-4o-mini-tts` / `alloy` | `OPENAI_API_KEY` |
| `elevenlabs` | `eleven_turbo_v2_5` / `21m00Tcm4TlvDq8ikWAM` | `ELEVENLABS_API_KEY` |

ローカル TTS は同梱の `docker-compose.yml` を profile 指定で起動できます:

```bash
docker compose --profile voicevox up -d        # 日本語ナレーション（既定）
docker compose --profile aivisspeech up -d     # VOICEVOX 互換、別キャラ
docker compose --profile kokoro up -d          # 多言語、英語/日本語/中国語
```

VOICEVOX の話者 ID 一覧:

```bash
curl -s http://localhost:50021/speakers | jq '.[] | {name, styles: [.styles[] | {name, id}]}'
```

Kokoro / say / SAPI の voice 一覧は、プロファイルの出力言語で自動的に絞り込まれます（マッチが 0 件なら全件にフォールバック）。

voice 一覧の各行と「現在選択中の voice」の横には 🔊 試聴ボタンがあり、設定画面上部の「試聴テキスト」欄（空欄ならその voice の言語のサンプル文）で音声を試せます。

Kokoro の voice 一覧は設定画面の「Voice」セレクトに自動で並びます（言語推定付き）。CLI で確認したい場合は以下:

```bash
curl -s http://localhost:8880/v1/audio/voices | jq
```

### ニュースソース

設定画面の textarea に **1 行 1 URL** で RSS / Atom フィードを記述します。既定では NHK・はてブ・Publickey・ITmedia・GIGAZINE・Zenn・TechCrunch・The Verge・BBC・Hacker News などをまとめた URL 一覧が入っています（`src/lib/news/defaults.ts`）。「取得テスト」ボタンで各 URL の取得可否とフィードタイトルを確認できます。ソース表示名は RSS の `<title>` を採用し、取れなければホスト名にフォールバックします。

取得した記事は **ソース別バケットからラウンドロビンで 1 件ずつ取る** ように選出します。フィード本数が多いソースに結果が支配されないようにしています。

各フィードは **SQLite に 30 分キャッシュ**し、同一ドメインのフィードは直列で叩いて相手側に負荷をかけないようにしています（`data/rss-cache.sqlite`）。キャッシュキーは URL そのものです。

過去 14 日に番組化済みの URL は SQLite (`seen_urls`) で記録し、設定の「重複制御」で扱いを選べます。

- **緩め**（既定）: 除外せず、ランダム50件抽出 → 新着10件 → ランク重み（指数）× 既出ペナルティで非復元抽選。重複は許容するができるだけ避ける。
- **厳格**: 既出URLを完全に除外。新規が尽きれば番組生成を中止。

## データ置き場

| パス | 内容 |
| --- | --- |
| `data/config.json` | アクティブプロファイル ID を保持 |
| `data/profiles/<id>.json` | プロファイルごとの設定（編集ダイアログから自動保存） |
| `data/queue.json` | 番組キューのメタデータ |
| `data/rss-cache.sqlite` | RSS の 30 分キャッシュ |
| `data/seen.sqlite` | 過去 14 日に読んだ URL |
| `data/audio/<id>/seg-NNN.wav` | 各番組の段落音声（`/api/audio/<id>/seg-NNN.wav` で配信、再生終了でディレクトリごと削除） |
| `.logs/app.jsonl` | 詳細ログ（起動ごとにクリア） |

## 仕様ドキュメント

詳細は [`docs/features/`](docs/features/) を参照してください。

- [番組とキュー](docs/features/program.md)
- [ログ](docs/features/logging.md)

## 設計方針 — なぜ 1 人ナレーション・音楽なしなのか

最近の NotebookLM / podcastfy 系の「2 人ホストが軽妙に掛け合う」スタイルは初聴のインパクトはあるものの、長時間流すと次のような違和感が指摘されています。

- 同じ相槌（"Deep Dive" / "Hmm, that's interesting" / "I'm intrigued" など）が定型化して耳につく
- ずっと同じ 2 人の声と話法が脳に居座って疲れる（Reddit でよく語られる「最初の 1 週間は良いが、ずっと同じ 2 人だと気づくと耐えられなくなる」現象）
- 過剰に「自然」を狙った相槌や笑いが逆に uncanny に感じる
- 新規 podcast の約 39% が AI 生成と推定され、英語圏では "podslop" と揶揄され始めている

monocast はこの「うざさ」を意図的に避ける方向で作られています。

- **1 人ナレーション**。掛け合い・相槌・笑い・キャラ立て全部なし。
- **定型フレーズに頼らない** system プロンプト（"Deep Dive" 的な決まり文句を出さない）
- **音楽 / BGM / ジングルなし**。淡々と読むだけ。
- 話題の切り替わりに約 0.9 秒の無音を挟むだけで、感情演出はしない
- **流しっぱなしでも疲れずに情報が頭に入ってくる、聞き流し情報収集**が目標

参考:

- [Google's NotebookLM had to teach its AI podcast hosts not to act annoyed at humans — TechCrunch](https://techcrunch.com/2025/01/14/googles-notebooklm-had-to-teach-its-ai-podcast-hosts-not-to-act-annoyed-at-humans/)
- [I listened to 200 Notebook LM podcasts so you don't have to — Medium](https://medium.com/@bamby_media/i-listened-to-200-notebook-lm-podcasts-so-you-dont-have-to-d5b206911592)
- ['Podslop' is a real and growing problem — TechRadar](https://www.techradar.com/audio/podslop-is-a-real-and-growing-problem-data-shows-39-percent-of-new-podcasts-are-now-likely-generated-by-ai-heres-why-i-wont-be-listening)

## 今後の予定

- **ドキュメントを全部英語化する**。README / `docs/features/` 配下を含むすべてのドキュメントを将来的に英語に統一します。日本語コメントやログメッセージの扱いは別途検討します。
