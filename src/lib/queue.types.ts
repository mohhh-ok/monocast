export type AudioSegment = {
  url: string;
  durationSec: number;
};

export type Program = {
  id: string;
  title: string;
  body: string;
  /** 公開済みの段落音声。インデックス順に並び、最終的に expectedSegmentCount と同数になる。 */
  audioSegments: AudioSegment[];
  /** 段落の総数。audioSegments.length < expectedSegmentCount の間はまだ合成中。 */
  expectedSegmentCount: number;
  durationSec: number;
  createdAt: string;
  sources: { title: string; link: string; source: string; contentSnippet?: string }[];
  llm: { id: string; label: string; model: string };
};
