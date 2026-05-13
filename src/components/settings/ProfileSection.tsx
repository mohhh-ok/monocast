import type { Config } from "@/config.shared";
import { LANGUAGE_OPTIONS } from "@/lib/lang";
import { SearchableSelect } from "../SearchableSelect";
import { Field } from "./Field";
import { btnStyle, cardStyle, inputStyle, sectionStyle } from "./styles";

type Props = {
  profileName: string;
  onRename: () => void;
  cfg: Config;
  update: <K extends keyof Config>(key: K, value: Config[K]) => void;
};

const LANGUAGE_SELECT_OPTIONS = LANGUAGE_OPTIONS.map((o) => ({
  value: o.code,
  label: o.label,
}));

export function ProfileSection({ profileName, onRename, cfg, update }: Props) {
  return (
    <section style={cardStyle}>
      <h2 style={sectionStyle}>プロファイル</h2>
      <Field
        label="編集中のプロファイル"
        hint="各フィールドは自動で保存されます。"
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              flex: "1 1 200px",
              padding: "10px 12px",
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#e6e9f5",
              fontSize: 14,
            }}
          >
            {profileName || "(無名)"}
          </span>
          <button type="button" onClick={onRename} style={btnStyle()}>
            名前を変更
          </button>
        </div>
      </Field>

      <Field
        label="出力言語"
        hint="番組原稿の言語。TTS の voice 一覧もこの言語で絞り込まれます。"
      >
        <SearchableSelect
          value={cfg.outputLanguageCode}
          options={
            LANGUAGE_SELECT_OPTIONS.some(
              (o) => o.value === cfg.outputLanguageCode,
            )
              ? LANGUAGE_SELECT_OPTIONS
              : [
                  {
                    value: cfg.outputLanguageCode,
                    label: `${cfg.outputLanguageCode} (カスタム)`,
                  },
                  ...LANGUAGE_SELECT_OPTIONS,
                ]
          }
          onChange={(v) => update("outputLanguageCode", v)}
          inputStyle={inputStyle}
        />
      </Field>

      <Field
        label="ニュアンス指示 (任意)"
        hint="言語スタイルの細かい指示。例: 「固有名詞は英語読みのまま」「フォーマルに」「関西弁で」。空欄なら追加指示なし。"
      >
        <textarea
          value={cfg.outputLanguageNotes}
          onChange={(e) => update("outputLanguageNotes", e.target.value)}
          placeholder="（自由記述・空欄可）"
          rows={2}
          style={{ ...inputStyle, resize: "vertical", minHeight: 64 }}
        />
      </Field>
    </section>
  );
}
