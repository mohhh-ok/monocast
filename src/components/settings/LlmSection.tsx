import { LLM_IDS, type Config, type LlmId } from "@/config.shared";
import { SearchableSelect } from "../SearchableSelect";
import { Field } from "./Field";
import { LlmSetup } from "./LlmSetup";
import {
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
  LLM_LABELS,
  OLLAMA_MODELS,
  OPENAI_MODELS,
} from "./model-choices";
import { cardStyle, inputStyle, sectionStyle, sourceItemStyle } from "./styles";

const toOptions = (xs: readonly string[]) => xs.map((v) => ({ value: v, label: v }));

type Props = {
  cfg: Config;
  update: <K extends keyof Config>(key: K, value: Config[K]) => void;
};

export function LlmSection({ cfg, update }: Props) {
  return (
    <section style={cardStyle}>
      <h2 style={sectionStyle}>LLM</h2>

      <Field label="使用する LLM">
        <div style={{ display: "grid", gap: 6 }}>
          {LLM_IDS.map((id) => (
            <label key={id} style={sourceItemStyle}>
              <input
                type="radio"
                name="selectedLlm"
                checked={cfg.selectedLlm === id}
                onChange={() => update("selectedLlm", id as LlmId)}
              />
              <span style={{ fontSize: 13, color: "#cbd2ee" }}>
                {LLM_LABELS[id]}
              </span>
            </label>
          ))}
        </div>
      </Field>

      {cfg.selectedLlm === "anthropic" && (
        <Field
          label="Anthropic モデル"
          hint="API キー: ANTHROPIC_API_KEY / 候補は目安・自由入力可"
        >
          <SearchableSelect
            value={cfg.anthropicModel}
            options={toOptions(ANTHROPIC_MODELS)}
            onChange={(v) => update("anthropicModel", v)}
            freeInput
            inputStyle={inputStyle}
          />
        </Field>
      )}

      {cfg.selectedLlm === "openai" && (
        <Field
          label="OpenAI モデル"
          hint="API キー: OPENAI_API_KEY / 候補は目安・自由入力可"
        >
          <SearchableSelect
            value={cfg.openaiModel}
            options={toOptions(OPENAI_MODELS)}
            onChange={(v) => update("openaiModel", v)}
            freeInput
            inputStyle={inputStyle}
          />
        </Field>
      )}

      {cfg.selectedLlm === "gemini" && (
        <Field
          label="Gemini モデル"
          hint="API キー: GEMINI_API_KEY / 候補は目安・自由入力可"
        >
          <SearchableSelect
            value={cfg.geminiModel}
            options={toOptions(GEMINI_MODELS)}
            onChange={(v) => update("geminiModel", v)}
            freeInput
            inputStyle={inputStyle}
          />
        </Field>
      )}

      {cfg.selectedLlm === "ollama" && (
        <Field
          label="Ollama モデル"
          hint="ローカルに pull 済みのモデル名を入力（候補はあくまで参考）/ URL を変える場合は .env.local の OLLAMA_URL（既定 http://localhost:11434）"
        >
          <SearchableSelect
            value={cfg.ollamaModel}
            options={toOptions(OLLAMA_MODELS)}
            onChange={(v) => update("ollamaModel", v)}
            freeInput
            inputStyle={inputStyle}
          />
        </Field>
      )}

      <LlmSetup id={cfg.selectedLlm} />
    </section>
  );
}
