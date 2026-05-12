import { Field } from "./Field";
import { btnStyle, cardStyle, sectionStyle } from "./styles";

type Props = {
  profileName: string;
  onRename: () => void;
};

export function ProfileSection({ profileName, onRename }: Props) {
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
    </section>
  );
}
