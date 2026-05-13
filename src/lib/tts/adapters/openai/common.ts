import type { TtsCommon } from "../types";

export const openaiCommon: TtsCommon = {
  // OpenAI TTS は多言語モデル (gpt-4o-mini-tts 等) 前提で常に対応扱いにする。
  isLanguageSupported() {
    return true;
  },
};
