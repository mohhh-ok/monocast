import { TTS_IDS, type Config, type TtsId } from "@/config.shared";
import { languageLabel, localeMatches } from "@/lib/lang";
import {
  fetchAivisSpeakersFn,
  fetchKokoroVoicesFn,
  fetchSapiVoicesFn,
  fetchSayVoicesFn,
  fetchSpeakersFn,
  type KokoroVoiceOption,
  type SapiVoiceOption,
  type SayVoiceOption,
  type SpeakerOption,
} from "@/server/settings";
import { SearchableSelect } from "../SearchableSelect";
import { EngineStatus } from "./EngineStatus";
import { Field } from "./Field";
import {
  ELEVENLABS_MODELS,
  OPENAI_TTS_MODELS,
  OPENAI_TTS_VOICES,
  TTS_LABELS,
} from "./model-choices";
import { btnStyle, cardStyle, inputStyle, sectionStyle, sourceItemStyle } from "./styles";
import { TtsSetup } from "./TtsSetup";

const toStringOptions = (xs: readonly string[]) =>
  xs.map((v) => ({ value: v, label: v }));

/**
 * 出力言語コードで voice を絞り込む。0 件になったら全件にフォールバック。
 * 何件絞ったかを呼び出し側で表示するため、結果には件数と適用フラグも返す。
 */
function applyLanguageFilter<T extends { locale: string }>(
  voices: T[],
  code: string,
): { list: T[]; applied: boolean; hidden: number } {
  if (!code || voices.length === 0) {
    return { list: voices, applied: false, hidden: 0 };
  }
  const matched = voices.filter((v) => localeMatches(v.locale, code));
  if (matched.length === 0) {
    return { list: voices, applied: false, hidden: 0 };
  }
  return {
    list: matched,
    applied: matched.length !== voices.length,
    hidden: voices.length - matched.length,
  };
}

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
  kokoroVoices: KokoroVoiceOption[];
  setKokoroVoices: (list: KokoroVoiceOption[]) => void;
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
  kokoroVoices,
  setKokoroVoices,
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
  const refreshKokoroVoices = async () => {
    setKokoroVoices(
      await fetchKokoroVoicesFn({ data: { url: cfg.kokoroUrl } }),
    );
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
              <SearchableSelect
                value={String(cfg.voicevoxSpeaker)}
                options={speakers.map((s) => ({
                  value: String(s.id),
                  label: `${s.label} (id: ${s.id})`,
                }))}
                onChange={(v) => update("voicevoxSpeaker", Number(v))}
                inputStyle={inputStyle}
              />
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
              <SearchableSelect
                value={String(cfg.aivisSpeechSpeaker)}
                options={aivisSpeakers.map((s) => ({
                  value: String(s.id),
                  label: `${s.label} (id: ${s.id})`,
                }))}
                onChange={(v) => update("aivisSpeechSpeaker", Number(v))}
                inputStyle={inputStyle}
              />
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
            <SearchableSelect
              value={cfg.openaiTtsModel}
              options={toStringOptions(OPENAI_TTS_MODELS)}
              onChange={(v) => update("openaiTtsModel", v)}
              freeInput
              inputStyle={inputStyle}
            />
          </Field>
          <Field label="Voice">
            <SearchableSelect
              value={cfg.openaiTtsVoice}
              options={toStringOptions(OPENAI_TTS_VOICES)}
              onChange={(v) => update("openaiTtsVoice", v)}
              freeInput
              inputStyle={inputStyle}
            />
          </Field>
        </>
      )}

      {cfg.selectedTts === "elevenlabs" && (
        <>
          <Field
            label="ElevenLabs モデル"
            hint="API キー: ELEVENLABS_API_KEY / 候補は目安・自由入力可"
          >
            <SearchableSelect
              value={cfg.elevenlabsModelId}
              options={toStringOptions(ELEVENLABS_MODELS)}
              onChange={(v) => update("elevenlabsModelId", v)}
              freeInput
              inputStyle={inputStyle}
            />
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
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                value={cfg.kokoroUrl}
                onChange={(e) => update("kokoroUrl", e.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={refreshKokoroVoices}
                style={btnStyle()}
              >
                Voice を再取得
              </button>
            </div>
            <EngineStatus id="kokoro" url={cfg.kokoroUrl} />
          </Field>
          {(() => {
            const f = applyLanguageFilter(kokoroVoices, cfg.outputLanguageCode);
            const hintBase =
              kokoroVoices.length === 0
                ? "Kokoro-FastAPI に接続できない場合は voice 名を直接入力 (jf_/jm_=ja, af_/am_=en-US, bf_/bm_=en-GB, zf_/zm_=zh)"
                : `${kokoroVoices.length} voice 取得済み (ja → en → 他言語の順で表示)`;
            const hint = f.applied
              ? `${hintBase} / 出力言語 ${languageLabel(cfg.outputLanguageCode)} で ${f.list.length} 件に絞り込み (${f.hidden} 件を非表示)`
              : hintBase;
            return (
              <Field label="Voice" hint={hint}>
                {kokoroVoices.length > 0 ? (
                  <SearchableSelect
                    value={cfg.kokoroVoice}
                    options={[
                      ...(f.list.some((v) => v.name === cfg.kokoroVoice)
                        ? []
                        : [
                            {
                              value: cfg.kokoroVoice,
                              label: `${cfg.kokoroVoice} (言語フィルタ外/未取得)`,
                            },
                          ]),
                      ...f.list.map((v) => ({
                        value: v.name,
                        label: `${v.name} (${v.locale})`,
                      })),
                    ]}
                    onChange={(v) => update("kokoroVoice", v)}
                    inputStyle={inputStyle}
                  />
                ) : (
                  <input
                    type="text"
                    value={cfg.kokoroVoice}
                    onChange={(e) => update("kokoroVoice", e.target.value)}
                    placeholder="af_heart"
                    style={inputStyle}
                  />
                )}
              </Field>
            );
          })()}
        </>
      )}

      {cfg.selectedTts === "say" && (
        <>
          {(() => {
            const f = applyLanguageFilter(sayVoices, cfg.outputLanguageCode);
            const hintBase =
              sayVoices.length === 0
                ? "macOS 以外、または say コマンドが利用できない可能性があります"
                : "ja_JP の voice (Kyoko / Otoya 等) を選ぶと日本語が自然に発話されます";
            const hint = f.applied
              ? `${hintBase} / 出力言語 ${languageLabel(cfg.outputLanguageCode)} で ${f.list.length} 件に絞り込み (${f.hidden} 件を非表示)`
              : hintBase;
            return (
              <Field label="Voice" hint={hint}>
                <div style={{ display: "flex", gap: 8 }}>
                  {sayVoices.length > 0 ? (
                    <SearchableSelect
                      value={cfg.sayVoice}
                      options={[
                        { value: "", label: "(システム既定)" },
                        ...f.list.map((v) => ({
                          value: v.name,
                          label: `${v.name} (${v.locale})`,
                        })),
                      ]}
                      onChange={(v) => update("sayVoice", v)}
                      style={{ flex: 1 }}
                      inputStyle={inputStyle}
                    />
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
            );
          })()}

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
          {(() => {
            const f = applyLanguageFilter(sapiVoices, cfg.outputLanguageCode);
            const hintBase =
              sapiVoices.length === 0
                ? "Windows 以外、または PowerShell が利用できない可能性があります"
                : "ja-JP の voice (Haruka / Ayumi / Ichiro 等) を選ぶと日本語が自然に発話されます";
            const hint = f.applied
              ? `${hintBase} / 出力言語 ${languageLabel(cfg.outputLanguageCode)} で ${f.list.length} 件に絞り込み (${f.hidden} 件を非表示)`
              : hintBase;
            return (
              <Field label="Voice" hint={hint}>
                <div style={{ display: "flex", gap: 8 }}>
                  {sapiVoices.length > 0 ? (
                    <SearchableSelect
                      value={cfg.sapiVoice}
                      options={[
                        { value: "", label: "(システム既定)" },
                        ...f.list.map((v) => ({
                          value: v.name,
                          label: `${v.name} (${v.locale})`,
                        })),
                      ]}
                      onChange={(v) => update("sapiVoice", v)}
                      style={{ flex: 1 }}
                      inputStyle={inputStyle}
                    />
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
            );
          })()}

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

      <TtsSetup id={cfg.selectedTts} />
    </section>
  );
}
