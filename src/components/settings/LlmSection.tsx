import { LLM_IDS, type Config, type LlmId } from "@/config.shared";
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
          <input
            type="text"
            list="anthropic-models"
            value={cfg.anthropicModel}
            onChange={(e) => update("anthropicModel", e.target.value)}
            style={inputStyle}
          />
          <datalist id="anthropic-models">
            {ANTHROPIC_MODELS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
      )}

      {cfg.selectedLlm === "openai" && (
        <Field
          label="OpenAI モデル"
          hint="API キー: OPENAI_API_KEY / 候補は目安・自由入力可"
        >
          <input
            type="text"
            list="openai-models"
            value={cfg.openaiModel}
            onChange={(e) => update("openaiModel", e.target.value)}
            style={inputStyle}
          />
          <datalist id="openai-models">
            {OPENAI_MODELS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
      )}

      {cfg.selectedLlm === "gemini" && (
        <Field
          label="Gemini モデル"
          hint="API キー: GEMINI_API_KEY / 候補は目安・自由入力可"
        >
          <input
            type="text"
            list="gemini-models"
            value={cfg.geminiModel}
            onChange={(e) => update("geminiModel", e.target.value)}
            style={inputStyle}
          />
          <datalist id="gemini-models">
            {GEMINI_MODELS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
      )}

      {cfg.selectedLlm === "ollama" && (
        <>
          <Field
            label="Ollama URL"
            hint="OpenAI 互換エンドポイント (/v1/chat/completions) を使用"
          >
            <input
              type="url"
              value={cfg.ollamaUrl}
              onChange={(e) => update("ollamaUrl", e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field
            label="Ollama モデル"
            hint="ローカルに pull 済みのモデル名を入力（候補はあくまで参考）"
          >
            <input
              type="text"
              list="ollama-models"
              value={cfg.ollamaModel}
              onChange={(e) => update("ollamaModel", e.target.value)}
              style={inputStyle}
            />
            <datalist id="ollama-models">
              {OLLAMA_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        </>
      )}

      <LlmSetup id={cfg.selectedLlm} />
    </section>
  );
}
