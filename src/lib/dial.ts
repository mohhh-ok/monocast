// 周波数ダイヤル表示のための純粋関数群。
// 再生進捗（セグメント単位 + セグメント内位置）を 0..1 に正規化し、
// 日本のワイド FM 帯（76.0–95.0 MHz）の周波数表示に変換する。

export const FM_MIN = 76.0;
export const FM_MAX = 95.0;

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * 番組全体の再生進捗を 0..1 で返す。
 * @param segIndex 現在のセグメント番号（0 始まり）
 * @param segmentProgress セグメント内の再生位置（0..1）。範囲外はクランプ。
 * @param expectedSegmentCount 番組のセグメント総数。0 のときは 0 を返す。
 */
export function playbackProgress(
  segIndex: number,
  segmentProgress: number,
  expectedSegmentCount: number,
): number {
  if (expectedSegmentCount <= 0) return 0;
  const pos = segIndex + clamp01(segmentProgress);
  return clamp01(pos / expectedSegmentCount);
}

/**
 * 進捗 0..1 を FM 周波数（MHz）に線形変換し、0.1 MHz 単位に丸める。
 */
export function progressToFrequency(progress: number): number {
  const p = clamp01(progress);
  return Math.round((FM_MIN + p * (FM_MAX - FM_MIN)) * 10) / 10;
}
