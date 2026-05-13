import { localeMatches } from "../../../lang";
import type { TtsCommon } from "../types";

export const kokoroCommon: TtsCommon = {
  isLanguageSupported(code, fetchedLocales) {
    if (!code) return true;
    if (!fetchedLocales || fetchedLocales.length === 0) return true;
    return fetchedLocales.some((l) => localeMatches(l, code));
  },
};
