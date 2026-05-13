import type { TtsCommon } from "../types";

export const elevenlabsCommon: TtsCommon = {
  // ElevenLabs は voice ID 入力 UI で、ID 単体からは言語が分からないため常に対応扱い。
  isLanguageSupported() {
    return true;
  },
};
