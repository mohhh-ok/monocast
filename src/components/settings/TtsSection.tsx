import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TTS_IDS, type Config, type TtsId } from "@/config.shared";
import { languageLabel, localeMatches } from "@/lib/lang";
import { getSampleForLocale } from "@/lib/tts/sample-texts";
import {
  fetchAivisSpeakersFn,
  fetchKokoroVoicesFn,
  fetchSapiVoicesFn,
  fetchSayVoicesFn,
  fetchSpeakersFn,
  previewTtsVoiceFn,
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

type PreviewState = {
  // 試聴対象 voice の識別キー (engine:voice 値)。再生中 / ロード中の表示に使う。
  loadingKey: string | null;
  playingKey: string | null;
  error: string | null;
};

/** 1 度に 1 voice しか鳴らさない試聴プレイヤー。 */
function usePreviewPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PreviewState>({
    loadingKey: null,
    playingKey: null,
    error: null,
  });

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setState({ loadingKey: null, playingKey: null, error: null });
  };

  const play = async (key: string, voice: string | number, text: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState({ loadingKey: key, playingKey: null, error: null });
    try {
      const res = await previewTtsVoiceFn({ data: { voice, text } });
      if (res.status !== "ok") {
        setState({ loadingKey: null, playingKey: null, error: res.message });
        return;
      }
      // Blob URL より data URL の方が型/解放のハンドリングがシンプル。試聴は数百KB以下。
      const src = `data:${res.mime};base64,${res.audioBase64}`;
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setState((s) =>
          s.playingKey === key ? { loadingKey: null, playingKey: null, error: null } : s,
        );
      };
      audio.onerror = () => {
        setState({ loadingKey: null, playingKey: null, error: "再生に失敗" });
      };
      await audio.play();
      setState({ loadingKey: null, playingKey: key, error: null });
    } catch (err) {
      setState({
        loadingKey: null,
        playingKey: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return { ...state, play, stop };
}

function previewIcon(loading: boolean, playing: boolean): string {
  if (loading) return "…";
  if (playing) return "⏹";
  return "🔊";
}

const previewBtnStyle: CSSProperties = {
  padding: "2px 8px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "#e6e9f5",
  fontSize: 12,
  cursor: "pointer",
  lineHeight: 1.4,
};

/** 「現在選択中の voice」を試聴するボタン (フィールド横置き用)。 */
function CurrentPreviewButton({
  onClick,
  loading,
  playing,
}: {
  onClick: () => void;
  loading: boolean;
  playing: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title="試聴"
      style={btnStyle()}
    >
      {previewIcon(loading, playing)} 試聴
    </button>
  );
}

type VoiceLists = {
  speakers: SpeakerOption[];
  aivisSpeakers: SpeakerOption[];
  sayVoices: SayVoiceOption[];
  sapiVoices: SapiVoiceOption[];
  kokoroVoices: KokoroVoiceOption[];
};

/** 現在選択中の voice の locale を推定。試聴テキストの placeholder 用。 */
function currentVoiceLocale(cfg: Config, lists: VoiceLists): string | undefined {
  switch (cfg.selectedTts) {
    case "voicevox":
    case "aivisspeech":
      return "ja";
    case "say":
      return lists.sayVoices.find((v) => v.name === cfg.sayVoice)?.locale;
    case "sapi":
      return lists.sapiVoices.find((v) => v.name === cfg.sapiVoice)?.locale;
    case "kokoro":
      return lists.kokoroVoices.find((v) => v.name === cfg.kokoroVoice)?.locale;
    case "openai":
    case "elevenlabs":
      return undefined;
  }
}

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

  const player = usePreviewPlayer();
  const [previewText, setPreviewText] = useState("");

  const currentLocale = currentVoiceLocale(cfg, {
    speakers,
    aivisSpeakers,
    sayVoices,
    sapiVoices,
    kokoroVoices,
  });
  // 試聴テキスト欄が空のときに使う placeholder。voice 選択に応じて言語が変わる。
  const placeholder = getSampleForLocale(currentLocale);

  // 試聴を発射 / トグル。locale は voice 一覧の各行から渡されると、その voice の言語で再生する。
  const onPreview = (key: string, voice: string | number, locale?: string) => {
    if (player.loadingKey === key) return;
    if (player.playingKey === key) {
      player.stop();
      return;
    }
    const text = previewText.trim()
      ? previewText
      : locale
        ? getSampleForLocale(locale)
        : placeholder;
    void player.play(key, voice, text);
  };

  /** SearchableSelect の各行に 🔊 を描画。 */
  const rowAction = (
    engine: string,
    voiceToValue: (v: string) => string | number,
    voiceToLocale?: (v: string) => string | undefined,
  ) =>
    (rawValue: string) => {
      // "(システム既定)" 行は voice 値が空文字。試聴は不可にして表示も消す。
      if (rawValue === "") return null;
      const key = `${engine}:${rawValue}`;
      const voice = voiceToValue(rawValue);
      const loading = player.loadingKey === key;
      const playing = player.playingKey === key;
      return (
        <button
          type="button"
          title="試聴"
          aria-label="試聴"
          disabled={loading}
          onClick={() => onPreview(key, voice, voiceToLocale?.(rawValue))}
          style={previewBtnStyle}
        >
          {previewIcon(loading, playing)}
        </button>
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

      <Field
        label="試聴テキスト"
        hint="空欄なら voice の言語に合わせたサンプル文を自動で使います。voice 一覧の 🔊 で個別に試聴できます。"
      >
        <input
          type="text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
        />
        {player.error && (
          <div style={{ fontSize: 12, color: "#ffb8c0", marginTop: 6 }}>
            試聴エラー: {player.error}
          </div>
        )}
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
            <div style={{ display: "flex", gap: 8 }}>
              {speakers.length > 0 ? (
                <SearchableSelect
                  value={String(cfg.voicevoxSpeaker)}
                  options={speakers.map((s) => ({
                    value: String(s.id),
                    label: `${s.label} (id: ${s.id})`,
                  }))}
                  onChange={(v) => update("voicevoxSpeaker", Number(v))}
                  style={{ flex: 1 }}
                  inputStyle={inputStyle}
                  renderRowAction={rowAction(
                    "voicevox",
                    (v) => Number(v),
                    () => "ja",
                  )}
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
              <CurrentPreviewButton
                onClick={() =>
                  onPreview(
                    `voicevox:${cfg.voicevoxSpeaker}`,
                    cfg.voicevoxSpeaker,
                    "ja",
                  )
                }
                loading={player.loadingKey === `voicevox:${cfg.voicevoxSpeaker}`}
                playing={player.playingKey === `voicevox:${cfg.voicevoxSpeaker}`}
              />
            </div>
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
            <div style={{ display: "flex", gap: 8 }}>
              {aivisSpeakers.length > 0 ? (
                <SearchableSelect
                  value={String(cfg.aivisSpeechSpeaker)}
                  options={aivisSpeakers.map((s) => ({
                    value: String(s.id),
                    label: `${s.label} (id: ${s.id})`,
                  }))}
                  onChange={(v) => update("aivisSpeechSpeaker", Number(v))}
                  style={{ flex: 1 }}
                  inputStyle={inputStyle}
                  renderRowAction={rowAction(
                    "aivisspeech",
                    (v) => Number(v),
                    () => "ja",
                  )}
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
              <CurrentPreviewButton
                onClick={() =>
                  onPreview(
                    `aivisspeech:${cfg.aivisSpeechSpeaker}`,
                    cfg.aivisSpeechSpeaker,
                    "ja",
                  )
                }
                loading={
                  player.loadingKey === `aivisspeech:${cfg.aivisSpeechSpeaker}`
                }
                playing={
                  player.playingKey === `aivisspeech:${cfg.aivisSpeechSpeaker}`
                }
              />
            </div>
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
            <div style={{ display: "flex", gap: 8 }}>
              <SearchableSelect
                value={cfg.openaiTtsVoice}
                options={toStringOptions(OPENAI_TTS_VOICES)}
                onChange={(v) => update("openaiTtsVoice", v)}
                freeInput
                style={{ flex: 1 }}
                inputStyle={inputStyle}
                renderRowAction={rowAction("openai", (v) => v)}
              />
              <CurrentPreviewButton
                onClick={() =>
                  onPreview(`openai:${cfg.openaiTtsVoice}`, cfg.openaiTtsVoice)
                }
                loading={player.loadingKey === `openai:${cfg.openaiTtsVoice}`}
                playing={player.playingKey === `openai:${cfg.openaiTtsVoice}`}
              />
            </div>
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
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={cfg.elevenlabsVoiceId}
                onChange={(e) => update("elevenlabsVoiceId", e.target.value)}
                placeholder="21m00Tcm4TlvDq8ikWAM"
                style={inputStyle}
              />
              <CurrentPreviewButton
                onClick={() =>
                  onPreview(
                    `elevenlabs:${cfg.elevenlabsVoiceId}`,
                    cfg.elevenlabsVoiceId,
                  )
                }
                loading={
                  player.loadingKey === `elevenlabs:${cfg.elevenlabsVoiceId}`
                }
                playing={
                  player.playingKey === `elevenlabs:${cfg.elevenlabsVoiceId}`
                }
              />
            </div>
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
                <div style={{ display: "flex", gap: 8 }}>
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
                      style={{ flex: 1 }}
                      inputStyle={inputStyle}
                      renderRowAction={rowAction(
                        "kokoro",
                        (v) => v,
                        (v) => kokoroVoices.find((x) => x.name === v)?.locale,
                      )}
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
                  <CurrentPreviewButton
                    onClick={() =>
                      onPreview(
                        `kokoro:${cfg.kokoroVoice}`,
                        cfg.kokoroVoice,
                        kokoroVoices.find((x) => x.name === cfg.kokoroVoice)
                          ?.locale,
                      )
                    }
                    loading={player.loadingKey === `kokoro:${cfg.kokoroVoice}`}
                    playing={player.playingKey === `kokoro:${cfg.kokoroVoice}`}
                  />
                </div>
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
                      renderRowAction={rowAction(
                        "say",
                        (v) => v,
                        (v) => sayVoices.find((x) => x.name === v)?.locale,
                      )}
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
                  <CurrentPreviewButton
                    onClick={() =>
                      onPreview(
                        `say:${cfg.sayVoice}`,
                        cfg.sayVoice,
                        sayVoices.find((x) => x.name === cfg.sayVoice)?.locale,
                      )
                    }
                    loading={player.loadingKey === `say:${cfg.sayVoice}`}
                    playing={player.playingKey === `say:${cfg.sayVoice}`}
                  />
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
                      renderRowAction={rowAction(
                        "sapi",
                        (v) => v,
                        (v) => sapiVoices.find((x) => x.name === v)?.locale,
                      )}
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
                  <CurrentPreviewButton
                    onClick={() =>
                      onPreview(
                        `sapi:${cfg.sapiVoice}`,
                        cfg.sapiVoice,
                        sapiVoices.find((x) => x.name === cfg.sapiVoice)?.locale,
                      )
                    }
                    loading={player.loadingKey === `sapi:${cfg.sapiVoice}`}
                    playing={player.playingKey === `sapi:${cfg.sapiVoice}`}
                  />
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
