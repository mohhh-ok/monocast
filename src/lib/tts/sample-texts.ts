// 試聴 (preview) で使う言語別サンプル文。
// voice の locale から prefix 一致で 1 つ引く。
const SAMPLES: Record<string, string> = {
  ja: "こんにちは。これは音声サンプルです。",
  en: "Hello. This is a voice sample.",
  zh: "你好，这是一段语音示例。",
  ko: "안녕하세요. 이것은 음성 샘플입니다.",
  es: "Hola. Esta es una muestra de voz.",
  fr: "Bonjour. Ceci est un échantillon vocal.",
  de: "Hallo. Dies ist eine Sprachprobe.",
  it: "Ciao. Questo è un campione vocale.",
  pt: "Olá. Esta é uma amostra de voz.",
  hi: "नमस्ते। यह एक आवाज़ का नमूना है।",
};

const FALLBACK = SAMPLES.ja;

/** locale 文字列 (ja / ja-JP / ja_JP / en-US / zh など) から prefix 一致で 1 文返す。 */
export function getSampleForLocale(locale: string | undefined | null): string {
  if (!locale) return FALLBACK;
  const lower = locale.toLowerCase();
  if (SAMPLES[lower]) return SAMPLES[lower];
  const base = lower.split(/[-_]/)[0];
  if (SAMPLES[base]) return SAMPLES[base];
  return FALLBACK;
}
