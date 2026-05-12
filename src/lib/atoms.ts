import { atom } from "jotai";

export type HistorySource = {
  source: string;
  title: string;
  link: string;
  /** どの番組で取り上げたかを区別するための ISO 文字列 */
  playedAt: string;
};

/** セッション中に再生（または skip）した番組のソース履歴。リロードで消える前提。 */
export const historyAtom = atom<HistorySource[]>([]);
