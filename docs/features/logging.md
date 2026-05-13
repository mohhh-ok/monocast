# ログ

monocast のログ機構の仕様。

## 出力先

| 出力先 | 内容 |
| --- | --- |
| コンソール | `info` / `warn` / `error` のみ、人間可読の 1 行テキスト |
| `.logs/app.jsonl` | `debug` 含めた全レベル、JSON Lines 形式（構造化フィールド付き） |

ファイルは `npm run dev` / `npm run start` の **起動時に毎回クリア**される（`scripts/reset-log.mjs` を `predev` / `prestart` で実行）。`.logs/` は git 管理外。

## レベル方針

- `debug` … コンソールには出さない、ファイルだけに出す。詳細トレース・HTTP フェーズ計測・テキスト先頭抜粋など。
- `info` / `warn` / `error` … コンソールとファイル両方に出す。

## API

```ts
import { log } from "@/lib/log";

log.info(tag, "音声合成開始");
log.debug(tag, "原稿プロファイル", { totalLen: 4231, paragraphs: 1 });
log.error(tag, "失敗", { chain: [...], stack: "..." });
```

第3引数の `extra` は JSONL 行にトップレベルでマージされる（`{ts, level, tag, msg, ...extra}`）。

## tag 命名

- 番組生成: `produce:<shortId>` （`<shortId>` は UUID の先頭 8 文字）
- TTS アダプタ: `tts:<adapter名>` （例: `tts:voicevox`）

`produceProgram` は内部で全例外を catch して `tag` 付きで `error` 行を吐いてから rethrow するので、上位（`createServerFn` の handler 等）でログを二重に出す必要はない。

## 主要な debug フィールド

| ログ | 場所 | extra フィールド |
| --- | --- | --- |
| 原稿プロファイル | `produce.ts` | `totalLen` / `paragraphs` / `longestLen` / `newlineCount` |
| 段落合成開始 | `tts/server.ts` | `index` / `total` / `len` / `head` (先頭40字) |
| 段落合成失敗 | `tts/server.ts` | `index` / `total` / `len` / `head` (先頭80字) / `elapsedMs` |
| VOICEVOX `audio_query` 開始/完了 | `tts/adapters/voicevox/server.ts` | `url` / `speaker` / `textLen` / `status` / `elapsedMs` |
| VOICEVOX `synthesis` 開始/完了 | `tts/adapters/voicevox/server.ts` | `url` / `speaker` / `status` / `elapsedMs` / `bytes` |
| produce 失敗 | `produce.ts` | `chain` / `stack` / `elapsedMs` |

## 追跡例

```bash
# 失敗した番組の全ログを取り出す
jq -c 'select(.tag == "produce:c620ebb1")' .logs/app.jsonl

# VOICEVOX で何ms かかった段落だけ抽出
jq -c 'select(.tag == "tts:voicevox" and .msg == "synthesis 完了") | {elapsedMs, bytes}' .logs/app.jsonl

# エラーだけ時系列で
jq -c 'select(.level == "error")' .logs/app.jsonl
```
