import { randomUUID } from "node:crypto";
import path from "node:path";
import { getConfig } from "@/config";
import type { LlmAdapter } from "./llm";
import { fetchNews } from "./news";
import { addProgram, type Program } from "./queue";
import { generateProgramScript } from "./script";
import { synthesizeToMp3 } from "./tts";

export type ProduceResult =
  | { status: "ok"; program: Program }
  | { status: "empty" };

/** ニュース取得 → 台本 → 音声 → キュー追加 をまとめて行う（1 adapter で 1 本） */
export async function produceProgram(
  adapter: LlmAdapter,
): Promise<ProduceResult> {
  const cfg = await getConfig();
  const news = await fetchNews(5, cfg.enabledSources);
  if (news.length === 0) return { status: "empty" };

  const script = await generateProgramScript(news, adapter);

  const id = randomUUID();
  const filename = `${id}.mp3`;
  const outPath = path.join(process.cwd(), "public", "audio", filename);
  const { durationSec } = await synthesizeToMp3(script.body, outPath);

  const program: Program = {
    id,
    title: script.title,
    body: script.body,
    audioUrl: `/audio/${filename}`,
    durationSec,
    createdAt: new Date().toISOString(),
    sources: script.sources,
    llm: {
      id: adapter.id,
      label: adapter.label,
      model: adapter.model,
    },
  };
  await addProgram(program);
  return { status: "ok", program };
}
