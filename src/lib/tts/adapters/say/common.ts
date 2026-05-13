import { localeMatches } from "../../../lang";
import type { TtsCommon } from "../types";

export const sayCommon: TtsCommon = {
  isLanguageSupported(code, fetchedLocales) {
    if (!code) return true;
    // 取得前は判定保留 (許可)。voice 一覧が手に入ったらその locale で判定する。
    if (!fetchedLocales || fetchedLocales.length === 0) return true;
    return fetchedLocales.some((l) => localeMatches(l, code));
  },
};
