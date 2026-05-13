import type { TtsId } from "@/config.shared";
import { aivisspeechCommon } from "./adapters/aivisspeech/common";
import { elevenlabsCommon } from "./adapters/elevenlabs/common";
import { kokoroCommon } from "./adapters/kokoro/common";
import { openaiCommon } from "./adapters/openai/common";
import { sapiCommon } from "./adapters/sapi/common";
import { sayCommon } from "./adapters/say/common";
import { voicevoxCommon } from "./adapters/voicevox/common";
import type { TtsCommon } from "./adapters/types";

/**
 * TtsId → common メタデータ。client / server 両方からこの map 経由で参照する。
 * Record で型を縛っているので、TTS_IDS に新エンジンを追加すると common の欠落をコンパイラが検出する。
 */
export const TTS_COMMON: Record<TtsId, TtsCommon> = {
  voicevox: voicevoxCommon,
  aivisspeech: aivisspeechCommon,
  say: sayCommon,
  sapi: sapiCommon,
  openai: openaiCommon,
  elevenlabs: elevenlabsCommon,
  kokoro: kokoroCommon,
};
