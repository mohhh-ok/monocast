import { TTS_IDS, type Config, type TtsId } from "@/config.shared";
import {
  fetchAivisSpeakersFn,
  fetchSapiVoicesFn,
  fetchSayVoicesFn,
  fetchSpeakersFn,
  type SapiVoiceOption,
  type SayVoiceOption,
  type SpeakerOption,
} from "@/server/settings";
import { DockerHint } from "./DockerHint";
import { EngineStatus } from "./EngineStatus";
import { Field } from "./Field";
import {
  ELEVENLABS_MODELS,
  KOKORO_VOICES,
  OPENAI_TTS_MODELS,
  OPENAI_TTS_VOICES,
  TTS_LABELS,
} from "./model-choices";
import { btnStyle, cardStyle, inputStyle, sectionStyle, sourceItemStyle } from "./styles";

type Props = {
  cfg: Config;
  update: <K extends keyof Config>(key: K, value: Config[K]) => void;
  speakers: SpeakerOption[];
  setSpeakers: (list: SpeakerOption[]) => void;
  aivisSpeakers: SpeakerOption[];
  setAivisSpeakers: (list: SpeakerOption[]) => void;
  sayVoices: SayVoiceOption[];
  setSayVoices: (list: SayVoiceOption[]) => void;
  sapiVoices: SapiVoiceOption[];
  setSapiVoices: (list: SapiVoiceOption[]) => void;
};

export function TtsSection({
  cfg,
  update,
  speakers,
  setSpeakers,
  aivisSpeakers,
  setAivisSpeakers,
  sayVoices,
  setSayVoices,
  sapiVoices,
  setSapiVoices,
}: Props) {
  const refreshSpeakers = async () => {
    setSpeakers(await fetchSpeakersFn());
  };
  const refreshAivisSpeakers = async () => {
    setAivisSpeakers(
      await fetchAivisSpeakersFn({ data: { url: cfg.aivisSpeechUrl } }),
    );
  };
  const refreshSayVoices = async () => {
    setSayVoices(await fetchSayVoicesFn());
  };
  const refreshSapiVoices = async () => {
    setSapiVoices(await fetchSapiVoicesFn());
  };

  return (
    <section style={cardStyle}>
      <h2 style={sectionStyle}>音声合成</h2>

      <Field label="使用するエンジン">
        <div style={{ display: "grid", gap: 6 }}>
          {TTS_IDS.map((id) => (
            <label key={id} style={sourceItemStyle}>
              <input
                type="radio"
                name="selectedTts"
                checked={cfg.selectedTts === id}
                onChange={() => update("selectedTts", id as TtsId)}
              />
              <span style={{ fontSize: 13, color: "#cbd2ee" }}>
                {TTS_LABELS[id]}
              </span>
            </label>
          ))}
        </div>
      </Field>

      {cfg.selectedTts === "voicevox" && (
        <>
          <Field label="VOICEVOX URL">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                value={cfg.voicevoxUrl}
                onChange={(e) => update("voicevoxUrl", e.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={refreshSpeakers}
                style={btnStyle()}
              >
                話者を再取得
              </button>
            </div>
            <EngineStatus id="voicevox" url={cfg.voicevoxUrl} />
            <DockerHint profile="voicevox" />
          </Field>

          <Field
            label="話者"
            hint={
              speakers.length === 0
                ? "VOICEVOX に接続できない場合は ID を直接入力"
                : undefined
            }
          >
            {speakers.length > 0 ? (
              <select
                value={cfg.voicevoxSpeaker}
                onChange={(e) =>
                  update("voicevoxSpeaker", Number(e.target.value))
                }
                style={inputStyle}
              >
                {speakers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} (id: {s.id})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={cfg.voicevoxSpeaker}
                onChange={(e) =>
                  update("voicevoxSpeaker", Number(e.target.value))
                }
                style={inputStyle}
              />
            )}
          </Field>
        </>
      )}

      {cfg.selectedTts === "aivisspeech" && (
        <>
          <Field label="AivisSpeech URL" hint="既定ポートは 10101">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                value={cfg.aivisSpeechUrl}
                onChange={(e) => update("aivisSpeechUrl", e.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={refreshAivisSpeakers}
                style={btnStyle()}
              >
                話者を再取得
              </button>
            </div>
            <EngineStatus id="aivisspeech" url={cfg.aivisSpeechUrl} />
            <DockerHint profile="aivisspeech" />
          </Field>

          <Field
            label="話者"
            hint={
              aivisSpeakers.length === 0
                ? "AivisSpeech に接続できない場合は ID を直接入力"
                : undefined
            }
          >
            {aivisSpeakers.length > 0 ? (
              <select
                value={cfg.aivisSpeechSpeaker}
                onChange={(e) =>
                  update("aivisSpeechSpeaker", Number(e.target.value))
                }
                style={inputStyle}
              >
                {aivisSpeakers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} (id: {s.id})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={cfg.aivisSpeechSpeaker}
                onChange={(e) =>
                  update("aivisSpeechSpeaker", Number(e.target.value))
                }
                style={inputStyle}
              />
            )}
          </Field>
        </>
      )}

      {cfg.selectedTts === "openai" && (
        <>
          <Field
            label="OpenAI TTS モデル"
            hint="API キー: OPENAI_API_KEY / 候補は目安・自由入力可"
          >
            <input
              type="text"
              list="openai-tts-models"
              value={cfg.openaiTtsModel}
              onChange={(e) => update("openaiTtsModel", e.target.value)}
              style={inputStyle}
            />
            <datalist id="openai-tts-models">
              {OPENAI_TTS_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label="Voice">
            <input
              type="text"
              list="openai-tts-voices"
              value={cfg.openaiTtsVoice}
              onChange={(e) => update("openaiTtsVoice", e.target.value)}
              style={inputStyle}
            />
            <datalist id="openai-tts-voices">
              {OPENAI_TTS_VOICES.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Field>
        </>
      )}

      {cfg.selectedTts === "elevenlabs" && (
        <>
          <Field
            label="ElevenLabs モデル"
            hint="API キー: ELEVENLABS_API_KEY / 候補は目安・自由入力可"
          >
            <input
              type="text"
              list="elevenlabs-models"
              value={cfg.elevenlabsModelId}
              onChange={(e) => update("elevenlabsModelId", e.target.value)}
              style={inputStyle}
            />
            <datalist id="elevenlabs-models">
              {ELEVENLABS_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field
            label="Voice ID"
            hint="ElevenLabs ダッシュボードの Voice Library で確認した ID"
          >
            <input
              type="text"
              value={cfg.elevenlabsVoiceId}
              onChange={(e) => update("elevenlabsVoiceId", e.target.value)}
              placeholder="21m00Tcm4TlvDq8ikWAM"
              style={inputStyle}
            />
          </Field>
        </>
      )}

      {cfg.selectedTts === "kokoro" && (
        <>
          <Field label="Kokoro-FastAPI URL" hint="既定ポートは 8880">
            <input
              type="url"
              value={cfg.kokoroUrl}
              onChange={(e) => update("kokoroUrl", e.target.value)}
              style={inputStyle}
            />
            <EngineStatus id="kokoro" url={cfg.kokoroUrl} />
            <DockerHint profile="kokoro" />
          </Field>
          <Field
            label="Voice"
            hint="jf_/jm_=日本語, af_/am_=英語(米), bf_/bm_=英語(英), zf_/zm_=中国語。自由入力可。"
          >
            <input
              type="text"
              list="kokoro-voices"
              value={cfg.kokoroVoice}
              onChange={(e) => update("kokoroVoice", e.target.value)}
              style={inputStyle}
            />
            <datalist id="kokoro-voices">
              {KOKORO_VOICES.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Field>
        </>
      )}

      {cfg.selectedTts === "say" && (
        <>
          <Field
            label="Voice"
            hint={
              sayVoices.length === 0
                ? "macOS 以外、または say コマンドが利用できない可能性があります"
                : "ja_JP の voice (Kyoko / Otoya 等) を選ぶと日本語が自然に発話されます"
            }
          >
            <div style={{ display: "flex", gap: 8 }}>
              {sayVoices.length > 0 ? (
                <select
                  value={cfg.sayVoice}
                  onChange={(e) => update("sayVoice", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">(システム既定)</option>
                  {sayVoices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.locale})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={cfg.sayVoice}
                  onChange={(e) => update("sayVoice", e.target.value)}
                  placeholder="Kyoko"
                  style={inputStyle}
                />
              )}
              <button
                type="button"
                onClick={refreshSayVoices}
                style={btnStyle()}
              >
                再取得
              </button>
            </div>
          </Field>

          <Field
            label="発話速度 (words/min)"
            hint="既定 180。大きいほど速く読み上げます。"
          >
            <input
              type="number"
              min={50}
              max={500}
              value={cfg.sayRate}
              onChange={(e) => update("sayRate", Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
        </>
      )}

      {cfg.selectedTts === "sapi" && (
        <>
          <Field
            label="Voice"
            hint={
              sapiVoices.length === 0
                ? "Windows 以外、または PowerShell が利用できない可能性があります"
                : "ja-JP の voice (Haruka / Ayumi / Ichiro 等) を選ぶと日本語が自然に発話されます"
            }
          >
            <div style={{ display: "flex", gap: 8 }}>
              {sapiVoices.length > 0 ? (
                <select
                  value={cfg.sapiVoice}
                  onChange={(e) => update("sapiVoice", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">(システム既定)</option>
                  {sapiVoices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.locale})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={cfg.sapiVoice}
                  onChange={(e) => update("sapiVoice", e.target.value)}
                  placeholder="Microsoft Haruka Desktop"
                  style={inputStyle}
                />
              )}
              <button
                type="button"
                onClick={refreshSapiVoices}
                style={btnStyle()}
              >
                再取得
              </button>
            </div>
          </Field>

          <Field
            label="発話速度 (-10..10)"
            hint="0 が標準。負で遅く、正で速く読み上げます。"
          >
            <input
              type="number"
              min={-10}
              max={10}
              value={cfg.sapiRate}
              onChange={(e) => update("sapiRate", Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
        </>
      )}

      <Field
        label="並列合成数"
        hint="段落単位の合成を何並列で走らせるか (1 で逐次)。大きくすると速くなる代わりに VOICEVOX/AivisSpeech などローカルエンジンの CPU 負荷が上がる。"
      >
        <input
          type="number"
          min={1}
          max={8}
          value={cfg.ttsConcurrency}
          onChange={(e) => update("ttsConcurrency", Number(e.target.value))}
          style={inputStyle}
        />
      </Field>
    </section>
  );
}
