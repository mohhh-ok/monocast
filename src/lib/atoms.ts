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

/** いま再生している番組 id。null なら未再生（or 番組なし）。 */
export const playingProgramIdAtom = atom<string | null>(null);

/** いま再生している番組内のセグメント番号（0 始まり）。 */
export const segmentIndexAtom = atom<number>(0);

/** <audio> が PLAYING 状態かどうか。ヘッダーのインジケータ表示用。 */
export const isPlayingAtom = atom<boolean>(false);
