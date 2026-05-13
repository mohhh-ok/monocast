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

/**
 * client / server 両方から参照できる adapter のメタデータ。
 * adapter ごとに `<id>/common.ts` で実体を作り、`tts/common.ts` で id → common の対応を集約する。
 * 必要に応じてフィールドを追加していく拡張点（例: defaultVoice, sampleText, requiresUrl 等）。
 */
export type TtsCommon = {
  /**
   * 指定の出力言語コード (BCP 47 風) をこのエンジンが扱えるか。
   * @param code 出力言語コード。空文字なら判定をパス。
   * @param fetchedLocales エンジンから取得済みの voice locale 一覧。
   *   `undefined` または空配列なら未取得扱いで判定保留 (= 許可)。
   */
  isLanguageSupported(code: string, fetchedLocales?: readonly string[]): boolean;
};
