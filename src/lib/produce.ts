import { randomUUID } from "node:crypto";
import path from "node:path";
import { getConfig } from "@/config";
import { fetchNews } from "./news";
import { generateProgramScript, type LlmProvider } from "./script";
import { synthesizeToMp3 } from "./tts";
import { addProgram, type Program } from "./queue";

export type ProduceResult =
  | { status: "ok"; program: Program }
  | { status: "empty" };

/** ニュース取得 → 台本 → 音声 → キュー追加 をまとめて行う */
export async function produceProgram(
  provider: LlmProvider,
): Promise<ProduceResult> {
  const cfg = await getConfig();
  const news = await fetchNews(5, cfg.enabledSources);
  if (news.length === 0) return { status: "empty" };

  const script = await generateProgramScript(news, provider);

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
  };
  await addProgram(program);
  return { status: "ok", program };
}
