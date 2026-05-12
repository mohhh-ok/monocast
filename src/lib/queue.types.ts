export type Program = {
  id: string;
  title: string;
  body: string;
  audioUrl: string;
  durationSec: number;
  createdAt: string;
  sources: { title: string; link: string; source: string }[];
  llm: { id: string; label: string; model: string };
};
