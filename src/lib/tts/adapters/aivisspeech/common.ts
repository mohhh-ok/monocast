import { localeMatches } from "../../../lang";
import type { TtsCommon } from "../types";

export const aivisspeechCommon: TtsCommon = {
  isLanguageSupported(code) {
    if (!code) return true;
    return localeMatches("ja", code);
  },
};
