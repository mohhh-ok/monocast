export type SynthesizeOptions = {
  /** 段落末に挿入する無音の長さ（秒）。最終段落では 0 が渡される。 */
  trailingSilenceSec: number;
};

export type TtsAdapter = {
  /** adapter 識別子。ログ・デバッグ用。 */
  readonly name: string;
  /** テキストを 1 段落単位で WAV バッファに合成する。 */
  synthesize(text: string, opts: SynthesizeOptions): Promise<Buffer>;
};
